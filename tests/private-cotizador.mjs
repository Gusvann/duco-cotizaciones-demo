import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {PrivateStore,openPrivateStore} from '../tools/private-store.mjs';
import {createPrivateServer} from '../tools/private-server.mjs';
import {asanaList,calendarDay,connectAsana,importSuppliers} from '../tools/private-import.mjs';

const id='DUCO-'+'1'.repeat(32);
const user={username:'prueba',role:'account'};
const director={username:'direccion-prueba',role:'direction'};
const form={title:'Mesa ficticia'};
const record={id,request:form,version:1,versions:[],history:[]};
const item={id:'ITM-TEST',description:'Mesa ficticia',materials:'Madera',finishes:'Natural',unit:'Pieza',quantity:'1',specs:[]};
const snapshot={quote:{id,versionId:id+'-V1',items:[item]},summary:{savedRevision:1,priceCents:12000},
  request:form,local:{wood:[[item.id,{applied:[{name:'Prueba',woodKind:'Tzalam',width:'30',length:'60'}],workshop:{values:{}},boardSettings:{}}]]}};
const supplierFixture='Proveedor_ID,Proveedor,Alias,Estado_Proveedor\nPRV-01,Ficticio Almacén,Ficción,Activo\nPRV-02,Ficticio dado de baja,,Inactivo';

test('Asana filters by date of creation in Mexico City and keeps explicitly linked subtasks and projects',()=>{
  assert.equal(calendarDay('2026-10-01T05:59:59Z'),'2026-09-30');
  assert.equal(calendarDay('2026-10-01T06:00:00Z'),'2026-10-01');
  assert.equal(calendarDay('2026-12-01T05:59:59Z'),'2026-11-30');
  assert.equal(calendarDay('2026-12-01T06:00:00Z'),'2026-12-01');
  const heads='Task ID,Created At,Name,Parent task,Assignee,Assignee Email,Notes,FOLIO PROYECTO,ESTATUS COTIZACION\n';
  const quotes=asanaList(heads+'11001,2026-10-02,Silla ficticia,,Prueba,prueba@example.test,"Plano: https://example.test/ficha",2611-14,ACEPTADA\n'+
    '11002,2026-10-03,Despiece,Silla ficticia,,,,,\n11003,2026-12-01,Fuera del rango,,,,,,',{kind:'quote',projectId:'10000'});
  const projects=asanaList(heads+'12001,2026-11-30,2611-14 Proyecto ficticio,,,,,2611-14,',{kind:'project',projectId:'20000'});
  const [quote,project]=connectAsana([...quotes.records,...projects.records]);
  assert.equal(quotes.records.length,1);
  assert.equal(quote.asana.subtasks[0].name,'Despiece');
  assert.equal(quote.asana.commercial.linkedProjectId,project.id);
  assert.equal(project.folio,'2611-14');
  assert.equal(quote.statusEnteredAt,null);
  assert.equal(quote.asana.commercial.netCents,null);
  assert.equal(quote.importedStatus,'project');
  assert.deepEqual(connectAsana([quote,project]),[quote,project]);
  const [reconciled]=connectAsana([quote]);
  assert.equal(reconciled.importedStatus,'accepted');
  assert.equal(reconciled.asana.related,undefined);
  assert.equal(reconciled.asana.commercial.linkedProjectId,undefined);
  assert.deepEqual(reconciled.asana.links,['https://example.test/ficha']);
});

test('local drafts and the approved recipe survive a restart and reject stale or unauthorized approval',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'duco-private-test-'));
  const sourceRoot=new URL('..',import.meta.url);
  let store=openPrivateStore(directory,sourceRoot);
  assert.equal(store.put(user,{record,snapshot,revision:0},()=>true).revision,1);
  assert.equal(store.put(user,{record,snapshot,revision:0},()=>true).revision,1);
  const request=store.requestLine(user,{quoteId:id,itemId:item.id,versionId:snapshot.quote.versionId,revision:1}).request;
  assert.throws(()=>store.approveLine(user,{id:request.id,revision:1}),{status:403});
  assert.throws(()=>store.approveLine(director,{id:request.id,revision:2}),{status:409});
  assert.equal(store.approveLine(director,{id:request.id,revision:1}).request.approvedBy,director.username);
  store.db.close();
  store=openPrivateStore(directory,sourceRoot);
  assert.deepEqual(store.readQuote(id).snapshot.local.wood,snapshot.local.wood);
  assert.equal(store.catalog().products[0].variants[0].localBreakdown.wood[0].name,'Prueba');
  store.db.close();
});

test('Asana categories, status and client filters use exported labels without assigning a first sale',()=>{
  const csv='Task ID,Created At,Name,Parent task,ESTATUS COTIZACION,CATEGORÍAS,CLIENTE\n'+
    '11001,2026-10-02,Primera cotización,,EN ESPERA DE APROBACION,ARQUITECTÓNICO,Cliente ficticio\n'+
    '11002,2026-10-03,Segunda cotización,,PAUSADA POR CLIENTE,MARCAS DE DISEÑO,Cliente ficticio\n'+
    '11003,2026-10-03,Tercera cotización,,ULTIMA VERSION COT,,Otra cuenta ficticia';
  const {records}=asanaList(csv,{kind:'quote',projectId:'10000'});
  assert.deepEqual(records.map(r=>r.category),['architecture','brands',null]);
  assert.deepEqual(records.map(r=>r.importedStatus),['waiting','paused','']);
  assert.equal(records[0].clientId,records[1].clientId);
  assert.notEqual(records[0].clientId,records[2].clientId);
  assert.equal(records[0].statusEnteredAt,null);
  assert.equal(records[0].asana.commercial.firstSentAt,null);
  const store=new PrivateStore(new DatabaseSync(':memory:'));
  store.importBundle({asana:{records,coverage:null}});
  assert.deepEqual(store.initial(user).clients[records[0].clientId],{name:'Cliente ficticio',firstSaleAt:null});
  store.db.close();
});

test('conversion depends on the persisted acceptance and is idempotent',()=>{
  const store=new PrivateStore(new DatabaseSync(':memory:'));
  const sent={version:1,snapshot,response:{result:'accepted',version:1}};
  const accepted={...record,sent};
  const project={id:'PR-'+id,sourceId:id,version:1,conversionKey:id+':V1',baseline:snapshot};
  assert.throws(()=>store.put(user,{record:{...accepted,project},snapshot,revision:0},()=>true),{status:422});
  store.put(user,{record:accepted,snapshot,revision:0},()=>true);
  const converted={...accepted,project};
  assert.equal(store.put(user,{record:converted,snapshot,revision:1},()=>true).revision,2);
  assert.equal(store.put(user,{record:converted,snapshot,revision:1},()=>true).revision,2);
  assert.throws(()=>store.put(user,{record:{...converted,project:{...project,baseline:{}}},snapshot,revision:2},()=>true),{status:409});
  store.db.close();
});

test('Dirección can authorize the exact saved recipe after the offer is sent',()=>{
  const store=new PrivateStore(new DatabaseSync(':memory:'));
  store.put(user,{record,snapshot,revision:0},()=>true);
  const pending=store.requestLine(user,{quoteId:id,itemId:item.id,versionId:snapshot.quote.versionId,revision:1}).request;
  assert.deepEqual(store.lineForSent(director,id),{requests:[]});
  const sent={version:1,snapshot,quoteVersionId:snapshot.quote.versionId};
  store.put(user,{record:{...record,sent},snapshot,revision:1},()=>true);
  assert.throws(()=>store.lineForSent(user,id),{status:403});
  assert.deepEqual(store.lineForSent(director,id),{requests:[{id:pending.id,revision:1,item:item.description,version:1}]});
  assert.equal(store.approveLine(director,{id:pending.id,revision:1}).request.status,'approved');
  assert.deepEqual(store.lineForSent(director,id),{requests:[]});
  assert.equal(store.catalog().products.length,1);
  store.db.close();
});

test('private client creation does not need an imported roster and its ID survives restart',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'duco-clients-test-')),sourceRoot=new URL('..',import.meta.url);
  let store=openPrivateStore(directory,sourceRoot);
  const request={requestId:'REQ-CLIENTE-FICTICIO',name:'Cliente Álamo Ficticio',contact:'Contacto de prueba',
    contactPhone:'5550000123',contactEmail:'contacto@example.test'};
  assert.deepEqual(store.clients('alamo').items,[]);
  assert.throws(()=>store.createClient(director,request),{status:403});
  assert.deepEqual(store.savedClient(store.clientOperation(user,request.requestId)),{found:false});
  const created=store.createClient(user,request);
  assert.match(created.client.id,/^CL-[a-f0-9]{32}$/);
  assert.deepEqual(store.createClient(user,request),created);
  assert.throws(()=>store.createClient(user,{...request,contact:'Otro contacto'}),{status:409});
  assert.throws(()=>store.createClient(user,{...request,name:'Cliente Alamo Ficticio',requestId:'REQ-OTRO-CLIENTE'}),{code:'DUPLICATE_CLIENT'});
  store.db.close();
  store=openPrivateStore(directory,sourceRoot);
  assert.deepEqual(store.clients('alamo').items,[{id:created.client.id,name:request.name,status:'Activo'}]);
  assert.deepEqual(store.clientContact(created.client.id),{clientId:created.client.id,contact:request.contact,contactPhone:request.contactPhone,contactEmail:request.contactEmail});
  assert.deepEqual(store.savedClient(store.clientOperation(user,request.requestId)),created);
  assert.deepEqual(store.initial(user).clients[created.client.id],{name:request.name,firstSaleAt:null});
  store.db.close();
});

test('HTTP private routes enforce authentication and CSRF before exposing supplier data',async()=>{
  const store=new PrivateStore(new DatabaseSync(':memory:'));
  store.provision(user.username,user.role,'contraseña-ficticia-2026');
  store.importBundle({suppliers:importSuppliers(supplierFixture)});
  const probe=net.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const server=createPrivateServer({store,port,publicHtml:'<head></head>',privateJs:'',checkQuote:()=>true});
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+port;
  try {
    assert.equal((await fetch(origin+'/api/suppliers?q=fICCion')).status,401);
    const login=await fetch(origin+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},
      body:JSON.stringify({username:user.username,password:'contraseña-ficticia-2026'})});
    assert.ok(login.ok);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const results=await fetch(origin+'/api/suppliers?q=fICCion',{headers:{cookie}});
    assert.deepEqual((await results.json()).items,[{id:'PRV-01',name:'Ficticio Almacén',status:'Activo'}]);
    const rejected=await fetch(origin+'/api/line/approve',{method:'POST',headers:{origin,cookie,'content-type':'application/json'},body:'{}'});
    assert.equal(rejected.status,403);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    store.db.close();
  }
});
