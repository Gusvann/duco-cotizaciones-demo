import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transformEconomicDefaults} from '../tools/economic-defaults.mjs';

const source=readFileSync(new URL('../src/cotizador.html',import.meta.url),'utf8');
const domain=[...transformEconomicDefaults(source).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).find(script=>script.includes('var QuoteDomain ='));
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');

function fixture(variant='SYN-NUBE-C') {
  const sandbox=vm.createContext({});
  for(const script of [domain,read('recipe-reference.js'),read('recipe-catalog.js')])vm.runInContext(script,sandbox);
  const {QuoteDomain:D,QuoteManufacturing_:M,DemoRecipeCatalog:catalog}=sandbox;
  let sequence=0;
  const uid=kind=>kind+'-'+(++sequence);
  const q=D.upgrade(D.blank(uid),uid),item=D.newItem(uid);
  Object.assign(item,{description:'Artículo de prueba',quantity:'1',unit:'Pieza'});
  Object.assign(q,{id:'COT-TEST',versionId:'VER-TEST',revision:1,items:[item],costs:[],resources:[],workUnits:[],needs:[],coverageLinks:[]});
  q.manufacturing=M.blank(q,uid);
  const recipe=catalog.instantiate('R-'+variant,uid,'1');
  const row=q.manufacturing.items[0];
  Object.assign(row,{mode:'detailed',groups:recipe.groups,materials:recipe.materials,processes:recipe.processes});
  return {D,M,q,row,uid,item};
}

test('a recipe price is an editable estimate and missing purchase VAT stays unknown',()=>{
  const {M,q,row}=fixture(),piece=row.materials[0];
  const breakdown=()=>M.evaluate(q,{date:'2026-11-24'});
  const findCost=()=>breakdown().costs.find(cost=>cost.description===piece.name);
  assert.equal(findCost().netAmount,'20.00');
  assert.equal(findCost().netCents,null);
  assert.ok(breakdown().issues.some(issue=>issue.field==='manufacturing.items.materials.taxRate'&&issue.target.id===piece.id));
  piece.taxRate='0';
  assert.equal(findCost().netCents,2000);
  assert.equal(findCost().status,'Estimado con sustento');
  assert.match(findCost().basis,/histórico/);
  // A new supply can be purchased directly in the total quantity entered.
  // This input never fills a made-up quantity per product or mutates the recipe.
  piece.quantity='';
  assert.equal(findCost().netCents,2000);
  assert.equal(piece.quantity,'');
  piece.unitPrice='6.25';piece.purchaseQuantity='8';
  assert.equal(findCost().netCents,5000);
  piece.unitPrice='0';
  assert.equal(findCost().netCents,0);
  piece.unitPrice='';
  assert.equal(findCost().netCents,null);
  assert.ok(breakdown().issues.some(issue=>issue.field.endsWith('.unitPrice')&&issue.target.id===piece.id));
  piece.unitPrice='5';piece.validUntil='2020-01-01';
  assert.equal(findCost().netCents,null);
  assert.ok(breakdown().issues.some(issue=>issue.field.endsWith('.validUntil')&&issue.target.id===piece.id));
});

test('an entered manual service and a fixed package use their source and amount once',()=>{
  const {M,q,row,uid}=fixture();
  for(const material of row.materials)material.taxRate='0';
  const process={id:uid('PRC'),name:'Servicio de prueba',type:'assembly',execution:'external',
    target:{kind:'product',groupId:'',componentIds:[]},source:{kind:'manual',reviewed:false,quality:'pending',netAmount:'7.50',taxRate:'16'}};
  row.processes=[process];
  q.manufacturing.packaging={method:'fixed',netAmount:'0',taxRate:'0',basis:'',quality:'pending',manualAntecedents:[]};
  const run=()=>M.evaluate(q,{date:'2026-11-24'});
  const service=()=>run().costs.find(c=>c.description===process.name);
  assert.equal(service().netCents,750);
  assert.equal(service().grossCents,870);
  assert.equal(run().costs.find(c=>c.description==='Empaque calculado').netCents,0);
  process.source.taxRate='';
  assert.equal(service().grossCents,null);
  assert.ok(run().issues.some(issue=>issue.field.endsWith('.source.taxRate')));
  process.source={kind:'included',reviewed:false,includedInMaterialId:row.materials[0].id};
  assert.equal(service(),undefined);
  assert.ok(!run().issues.some(issue=>issue.target.id===process.id));
  assert.equal(run().items[0].manufacturingNetCents,2200);
});

test('a manual zero counts once, while a missing tax, an unapproved supplier or an expired staff rate stays unresolved',()=>{
  const {q,D,uid}=fixture();
  const cost={id:uid('COST'),description:'Costo general de prueba',category:'Otros',nature:'Otro',
    netAmount:'0',taxRate:'0',status:'Pendiente',basis:'',external:false};
  q.costs=[cost];
  const evaluate=()=>D.evaluate(q,{preview:true,date:'2026-11-24'});
  const eligible=()=>evaluate().eligibleComponents.find(c=>c.id===cost.id);
  assert.equal(eligible()?.amount,0);
  cost.taxRate='';assert.equal(eligible(),undefined);
  cost.taxRate='0';cost.external=true;cost.providerMode='Solicitar alta';assert.equal(eligible(),undefined);
  cost.providerMode='Por definir';assert.equal(eligible(),undefined);
  cost.basis='Cotización vigente de servicio externo.';assert.equal(eligible()?.amount,0);
  assert.equal(cost.status,'Pendiente');
  const workId=uid('WORK'),resource={id:uid('RESOURCE'),workId,activity:'Carpintería',areaId:uid('AREA'),profileId:uid('PROFILE'),people:'1',mode:'Horas',hours:'2',rate:'100',rateStatus:'Validada',status:'Pendiente',basis:'',assignments:[]};
  q.workUnits=[{id:workId,description:resource.activity,source:'Recursos internos'}];
  q.resources=[resource];
  assert.equal(evaluate().eligibleComponents.find(c=>c.id===resource.id)?.amount,20000);
  resource.rateUntil='2020-01-01';
  assert.equal(evaluate().eligibleComponents.find(c=>c.id===resource.id),undefined);
});
