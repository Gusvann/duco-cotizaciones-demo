import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extendCoverageDefaults} from '../tools/coverage-defaults.mjs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const transformed = extendCoverageDefaults(read('src/cotizador.html'));
const domain = [...transformed.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('var QuoteSchema'))[1];
function fixture() {
  const ctx = vm.createContext({structuredClone});
  vm.runInContext('globalThis.window=globalThis',ctx);
  vm.runInContext(domain,ctx);
  vm.runInContext(read('src/quote-issues.js'),ctx);
  const {QuoteDomain:D,DemoQuoteIssues:workflow,QuoteManufacturing_:M}=ctx;
  let serial=0;
  const uid=tag=>tag+'-SYN-'+(++serial);
  const old=D.blank(uid);
  old.items=[Object.assign(D.newItem(uid),{description:'Mesa Uno',quantity:'1',unit:'Pieza',materials:'Madera',finishes:'Natural'})];
  const cost=old.costs.find(row=>row.category==='Empaque');
  Object.assign(cost,{status:'Confirmado',description:'Caja',netAmount:'10',amount:'10',taxRate:'0',nature:'Otro'});
  old.costs=[cost];old.resources=[];
  const q=D.upgrade(old,uid);
  Object.assign(q,{id:'COT-SYN',versionId:'VERSION-SYN'});
  const need=q.needs.find(row=>row.topic==='Empaque');
  for (const row of q.needs) Object.assign(row,{resolution:'No requerida',reason:'Fuera de alcance'});
  Object.assign(need,{resolution:'Cubierta por Duco',reason:''});
  const evaluate=(quote=q,base=null)=>D.evaluate(quote,{preview:true,base,date:'2026-10-14'});
  return {q,need,D,M,uid,workflow,evaluate};
}
test('decision and applicable linked cost resolve coverage without a second approval or a fabricated signature',()=>{
  const {q,need,evaluate}=fixture();
  const state=evaluate();
  assert.equal(state.structuralValid,true);
  const coverage=state.needs.find(result=>result.id===need.id);
  assert.equal(coverage.complete,true);
  assert.equal(coverage.confirmed,false);
  assert.equal(coverage.decisionFromData,true);
  assert.equal(coverage.derived,undefined,'cost cards reserve derived for exclusions');
  assert.equal(q.needs.find(row=>row.id===need.id).confirmedBy,'');
  assert.equal(state.knownCost,1000);
});
test('incomplete linked purchase is presented once as the cause, and a genuine scope change still requires action',()=>{
  const {q,need,evaluate,workflow}=fixture();
  q.costs[0].taxRate='';
  let state=evaluate();
  assert.equal(state.needs.find(row=>row.id===need.id).complete,false);
  let issues=workflow.collect(q,state);
  assert.equal(issues.filter(row=>row.code==='NEED_UNRESOLVED' && row.target.entityId===need.id).length,0);
  assert.ok(issues.some(row=>row.code==='COST_INCOMPLETE' && row.target.entityId===q.costs[0].id));
  q.costs[0].taxRate='0';
  const previous=structuredClone(q);
  q.included='Fabricación y montaje';
  state=evaluate(q,previous);
  issues=workflow.collect(q,state);
  assert.ok(issues.some(row=>row.code==='SCOPE_IMPACT'));
  assert.equal(issues.filter(row=>row.target.field==='confirm').length,0);
  q.scopeReview.declared=true;q.scopeReview.scopes=['GENERAL'];
  assert.ok(evaluate(q,previous).issues.some(row=>row.code==='NEED_UNRESOLVED' && row.target.entityId===need.id && row.target.field==='confirm'));
});
test('technical delivery without installation resolves an undecided installation once and an explicit disagreement remains visible',()=>{
  const {q,evaluate,workflow,M,uid}=fixture();
  q.manufacturing=M.blank(q,uid);
  Object.assign(q.manufacturing,{installation:'no',installationReason:'Entrega en puerta'});
  const install=q.needs.find(need=>need.topic==='Instalación');
  install.resolution='Pendiente';install.reason='';
  const result=evaluate();
  const decision=result.needs.find(row=>row.id===install.id);
  assert.equal(decision.complete,true);
  assert.equal(decision.resolution,'No requerida');
  const scope={context:{id:q.id,versionId:q.versionId},selection:{include:['SCOPE_INSTALLATION']},
    stages:{STAGE_INSTALLATION:{scopeId:'SCOPE_INSTALLATION',responsible:'Duco'}}};
  const issues=workflow.collect(q,result,{scopeState:scope});
  const conflicts=issues.filter(row=>row.code==='INSTALLATION_CONFLICT');
  assert.equal(conflicts.length,1);assert.equal(conflicts[0].step,2);
  scope.context.id='DISTINTO';
  assert.ok(!workflow.collect(q,result,{scopeState:scope}).some(row=>row.code==='INSTALLATION_CONFLICT'));
});
test('percent packaging waiting on two articles is one status, and a missing percentage is an editable shared action',()=>{
  const {q,workflow}=fixture();
  q.manufacturing={packaging:{method:'percent'},packagingRate:'3',packagingVatRate:'0'};
  q.items.push({...q.items[0],id:'OTRO',description:'Mesa Dos'});
  const issues=q.items.map(item=>({code:'MANUFACTURING_PENDING',field:'manufacturing.packagingRate',
    message:'Base pendiente',target:{entity:'manufacturing',parentId:item.id,field:'manufacturing.packagingRate',context:{itemId:item.id,sourceCostId:'PACK-'+item.id}}}));
  const input={issues};
  let rows=workflow.collect(q,input);
  assert.equal(rows.length,1);assert.equal(rows[0].severity,'info');assert.equal(rows[0].itemId,'');
  q.manufacturing.packagingRate='';
  rows=workflow.collect(q,input);
  assert.equal(rows.length,1);assert.equal(rows[0].severity,'error');assert.equal(rows[0].target.controlField,'rate');
});
test('two copies with the same name identify their current positions and keep their destinations after reordering',()=>{
  const {q,workflow,D}=fixture();
  const id=q.items[0].id;
  q.items.unshift({...q.items[0],id:'OTRA'});
  const issues=q.items.map((row,i)=>D.issue(q,'items.'+i+'.tax','Indica el impuesto.'));
  const result=workflow.collect(q,{issues});
  assert.equal(result.length,2);assert.notEqual(result[0].key,result[1].key);
  assert.equal(result[0].step,3);assert.equal(result[1].target.entityId,id);
  assert.match(result[0].message,/Artículo 1 · «Mesa Uno»/);
  assert.match(result[1].message,/Artículo 2 · «Mesa Uno»/);
  const stable=result[1].key;
  q.items.reverse();
  const moved=workflow.collect(q,{issues:[D.issue(q,'items.0.tax','Indica el impuesto.') ]})[0];
  assert.equal(moved.key,stable);assert.match(moved.message,/Artículo 1 · «Mesa Uno»/);
});
test('delivery changes invalidate a sealed decision even if its original snapshot is unavailable',()=>{
  const {q,need,evaluate,D}=fixture();
  need.confirmedHash=D.coverageFingerprint(q,need.id);
  assert.equal(evaluate().needs.find(row=>row.id===need.id).complete,true);
  q.deliveryDate='2027-04-01';
  assert.ok(evaluate().issues.some(row=>row.code==='NEED_UNRESOLVED'&&row.target.entityId===need.id&&row.target.field==='confirm'));
});
test('changing a packaging rate preserves the agreed scope while switching its method changes that scope',()=>{
  const {q,D,M,uid}=fixture();
  q.manufacturing=M.blank(q,uid);
  q.manufacturing.packaging.method='percent';q.manufacturing.packagingRate='2';
  const prior=structuredClone(q);
  q.manufacturing.packagingRate='3';
  assert.equal(D.scopeImpact(q,prior).generalChanged,false);
  q.manufacturing.packaging.method='fixed';
  assert.equal(D.scopeImpact(q,prior).generalChanged,true);
});
