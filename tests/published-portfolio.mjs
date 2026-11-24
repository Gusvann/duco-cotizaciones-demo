import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {portfolioScript,projectPublicPortfolio,validatePublicPortfolio} from '../tools/publish-portfolio.mjs';

const origin={
  source:'ASANA_IMPORT',id:'PRIVATE-USER-ID',clientId:'PRIVATE-CUSTOMER',
  responsibleId:'PRIVATE-OWNER',history:[{comment:'PRIVATE-NOTE'}],
  request:{title:'123 Cliente ficticio',client:'PRIVATE-CUSTOMER',quoteDue:'2026-11-07',deliveryDate:'2026-11-15',notes:'internal@example.test'},
  asana:{id:'12345678901',kind:'quote',createdAt:'2026-10-01T06:12:00Z',statusLabel:'En proceso',
    url:'https://example.test/PRIVATE-ASANA',fields:{'Start Date':'2026-11-01','FOLIO PROYECTO':'2611-99'},
    commercial:{netCents:9199900},subtasks:[{name:'PRIVATE-SUBTASK'}]}
};
const coverage={from:'2026-10-01',through:'2026-11-24',lists:{project:'2026-11-24',quote:'2026-11-24'}};
const source={
  records:[
    {...origin,folio:'',importedStatus:'accepted'},
    {...origin,folio:'2611-88',asana:{...origin.asana,id:'9999912456789',kind:'project'}}
  ],
  coverage
};

test('public Asana cut includes only dated, approved fields and canonical states',()=>{
  const bundle=projectPublicPortfolio(source);
  assert.deepEqual(bundle.quotes,[{folio:null,status:'accepted',createdAt:'2026-10-01',quoteDue:'2026-11-07',deliveryDate:'2026-11-15'}]);
  assert.deepEqual(bundle.projects,[{folio:'261188',status:'in-progress',createdAt:'2026-10-01',startDate:'2026-11-01',
    dueDate:'2026-11-07',deliveryDate:'2026-11-15'}]);
  const script=portfolioScript(bundle);
  assert.doesNotMatch(script,/PRIVATE|Cliente|@|https:|9199900|12345678901|2611-99/);
  const context={};
  vm.runInNewContext(script,context);
  assert.deepEqual(JSON.parse(JSON.stringify(validatePublicPortfolio(context.DucoPublishedPortfolio))),bundle);
  for(const extra of ['id','amount','notes','client']){
    assert.throws(()=>portfolioScript({...bundle,quotes:[{...bundle.quotes[0],[extra]:'example'}]}),/campos o valores/);
  }
});

test('an approved release keeps the complete title as text and omits the other Asana fields',()=>{
  const title=' 123 Mesa & silla — OC 421 <cotización> ';
  const first={...source.records[0],request:{...source.records[0].request,title}};
  const bundle=projectPublicPortfolio({...source,records:[first,source.records[1]]},{
    quoteFolioFromTitle:true,includeTitles:true
  });
  assert.equal(bundle.quotes[0].title,title);
  assert.equal(bundle.quotes[0].folio,'123');
  assert.equal(bundle.projects[0].title,source.records[1].request.title);
  assert.doesNotThrow(()=>validatePublicPortfolio(bundle,{requireTitles:true}));
  const classic=projectPublicPortfolio(source);
  assert.throws(()=>validatePublicPortfolio(classic,{requireTitles:true}),/campos o valores/);
  const script=portfolioScript(bundle);
  assert.doesNotMatch(script,/<cotizaci|PRIVATE|@|https:|9199900|12345678901/);
  const context={};
  vm.runInNewContext(script,context);
  assert.equal(context.DucoPublishedPortfolio.quotes[0].title,title);
});

test('quote title prefix is used only when authorized and no explicit folio is present',()=>{
  assert.equal(projectPublicPortfolio(source).quotes[0].folio,null);
  const withPrefix=projectPublicPortfolio(source,{quoteFolioFromTitle:true});
  assert.equal(withPrefix.quotes[0].folio,'123');
  for(const title of ['123456 Documento','ABC 123 Oferta','123-555 Documento','123 Oferta']){
    const record={...origin,folio:'valor libre ajeno',request:{...origin.request,title}};
    assert.equal(projectPublicPortfolio({coverage,records:[record]},{quoteFolioFromTitle:true}).quotes[0].folio,null);
  }
});

test('copy rejects duplicate source rows and out-of-cut timestamps without exposing record data',()=>{
  assert.throws(()=>projectPublicPortfolio({coverage,records:[origin,origin]}),/fuera de su corte/);
  const previous={...origin,asana:{...origin.asana,createdAt:'2026-10-01T05:59:59Z'}};
  assert.throws(()=>projectPublicPortfolio({coverage,records:[previous]}),/fuera de su corte/);
  const missing={...origin,importedStatus:'untested free text',request:{}};
  assert.deepEqual(projectPublicPortfolio({coverage,records:[missing]}).quotes,[
    {folio:null,status:'unknown',createdAt:'2026-10-01',quoteDue:null,deliveryDate:null}
  ]);
});
