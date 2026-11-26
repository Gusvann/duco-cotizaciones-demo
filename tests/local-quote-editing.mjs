import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {quoteTemplate} from '../tools/build.mjs';
import {copyApprovedBreakdown,extendLocalQuoteEditing,prototypeCostsReady,suggestMarginPrice,suggestPrototypePrice} from '../tools/local-quote-editing-extension.mjs';
import {commercialCostEstimate} from '../src/quote-costs.mjs';

const native=readFileSync(new URL('../src/cotizador.html',import.meta.url),'utf8');
const built=quoteTemplate(native);
const template=built.includes('function prototypeEstimate')?built:extendLocalQuoteEditing(built);
const scripts=Array.from(template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),match=>match[1]);
const sandbox=vm.createContext({});
vm.runInContext(scripts.find(script=>script.includes('var QuoteDomain')),sandbox);
const D=sandbox.QuoteDomain;

test('una caja y los indirectos del pedido se reparten una vez y el margen usa el costo asignado sin IVA',()=>{
  let sequence=0;const uid=prefix=>prefix+'-CASE-'+(++sequence);
  const q=D.upgrade(D.blank(uid),uid),m=sandbox.QuoteManufacturing_;
  q.items=[{...D.newItem(uid),description:'Mesa',quantity:'1'},
    {...D.newItem(uid),description:'Silla',quantity:'6',discount:'10',tax:'16',targetMargin:'25'}];
  q.costs=[];q.resources=[];q.needs=[];q.workUnits=[];q.coverageLinks=[];q.manufacturing=m.blank(q,uid);
  Object.assign(q.manufacturing,{packaging:{method:'fixed',netAmount:'40.02',taxRate:'16',quality:'confirmed',basis:'Caja de control',manualAntecedents:[]},
    indirectMethod:'percent',indirectRate:'10',installation:'no',installationReason:'Entrega sin instalación'});
  for(const row of q.manufacturing.items)row.mode='detailed';
  const wood=new Map([[q.items[0].id,{cents:25000,partial:false}],[q.items[1].id,{cents:75000,partial:false}]]);
  const valuation=D.evaluate(q,{commercialWood:wood});
  assert.equal(valuation.structuralValid,true,JSON.stringify(valuation.issues));
  const expected=commercialCostEstimate(q,valuation,wood,m,D);
  assert.equal(expected.netCents,114402);
  assert.deepEqual(Array.from(expected.items,r=>[r.directNet,r.generalNet,r.indirectNet]),[[25000,7201,5200],[75000,7201,5200]]);
  const price=suggestMarginPrice(D,q.items[1],expected.items[1].assignedNet,'25');
  assert.equal(price.unitPrice,'202.97');
  assert.equal(suggestMarginPrice(D,q.items[1],null,'25'),null);
  assert.equal(D.sanitize(q).items[1].targetMargin,'25');
  wood.get(q.items[1].id).partial=true;
  const partial= commercialCostEstimate(q,D.evaluate(q,{commercialWood:wood}),wood,m,D);
  assert.equal(partial.netCents,104002);
  assert.equal(partial.complete,false);
  assert.equal(partial.items[1].partial,true);
});

test('suggests the first unit-price cent that reaches each prototype margin after the line discount',()=>{
  const first={prototype:true,quantity:'2',discount:'10',tax:'16'};
  const second={prototype:true,quantity:'3',discount:'0',tax:'0',prototypeMargin:'50'};
  assert.deepEqual(suggestPrototypePrice(D,first,10000),{unitPrice:'92.60',unitPriceCents:9260,costCents:10000});
  assert.deepEqual(suggestPrototypePrice(D,second,9999),{unitPrice:'66.66',unitPriceCents:6666,costCents:9999});
  for(const [item,cost,below] of [[first,10000,'92.59'],[second,9999,'66.65']]){
    const chosen=suggestPrototypePrice(D,item,cost).unitPrice;
    const net=D.line({...item,unitPrice:chosen}).net;
    const previous=D.line({...item,unitPrice:below}).net;
    const limit=10000-D.decimal(item.prototypeMargin??'40',2);
    assert.ok(net*limit>=cost*10000);
    assert.ok(previous*limit<cost*10000);
  }
  assert.equal(suggestPrototypePrice(D,{...first,prototype:false},10000),null);
  assert.equal(suggestPrototypePrice(D,{...first,prototypeMargin:'100'},10000),null);
  assert.equal(suggestPrototypePrice(D,{...first,discount:'100'},10000),null);
  assert.equal(suggestPrototypePrice(D,first,null),null);
  assert.equal(suggestPrototypePrice(D,{...first,quantity:'5.50',discount:'99.99'},Number.MAX_SAFE_INTEGER),null);
  assert.equal(first.unitPrice,undefined);
});

test('keeps explicit prototype metadata in a sanitized quotation and preserves the legacy item shape',()=>{
  let seq=0;
  const uid=type=>type+'-TEST-'+(++seq);
  const quote=D.blank(uid);
  const first=D.newItem(uid);
  const second={...D.newItem(uid),prototype:true,prototypeMargin:'42.75'};
  quote.items=[first,second];
  const sanitized=D.sanitize(quote);
  assert.equal(Object.hasOwn(sanitized.items[0],'prototype'),false);
  assert.equal(sanitized.items[1].prototype,true);
  assert.equal(sanitized.items[1].prototypeMargin,'42.75');
  second.prototypeMargin='100';
  assert.throws(()=>D.sanitize(quote),/Precisión o límite/);
});

test('a pending cost on a different article does not prevent an independent suggestion',()=>{
  const quote={costs:[{id:'CST-OTHER',itemId:'ITEM-2'}]};
  const other={code:'COST_INCOMPLETE',target:{entity:'costs',entityId:'CST-OTHER'}};
  const general={code:'MANUFACTURING_PENDING',field:'manufacturing.packagingRate',target:{entity:'manufacturing'}};
  assert.equal(prototypeCostsReady(quote,'ITEM-1',{completeCosts:false,validationIssues:[other]}),true);
  assert.equal(prototypeCostsReady(quote,'ITEM-2',{completeCosts:false,validationIssues:[other]}),false);
  assert.equal(prototypeCostsReady(quote,'ITEM-1',{completeCosts:false,validationIssues:[other,general]}),false);
});

test('copies the exact approved technical version with independent IDs and rebases quote totals',()=>{
  let seq=0;
  const uid=type=>type+'-COPY-'+(++seq);
  const template={articleQuantity:'2',groups:[{id:'GROUP-01'}],
    materials:[{id:'MAT-01',groupId:'GROUP-01',purchaseGroup:'BUY-01',purchaseUnit:'PZA',purchaseQuantity:'5'}],
    processes:[{id:'PRC-01',quantityScope:'quote',quantity:'4',target:{kind:'components',componentIds:['MAT-01']},
      source:{kind:'manual',netAmount:'14.75'}}],
    finishSystems:[{target:{kind:'components',componentIds:['MAT-01']},layerIds:['PRC-01']}],
    wood:[{id:'WOOD-01',groupId:'GROUP-WOOD',adjustment:{componentIds:['WOOD-01']}}],
    workshop:{version:1,values:{'domino.componentId':'WOOD-01'},dayNames:[]},boardSettings:{'MAT-01':{sheetAreaM2:'2.98'}}};
  const baseline=JSON.stringify(template);
  const first=copyApprovedBreakdown(template,'LOCAL-PRD','LOCAL-V01',uid,D);
  const again=copyApprovedBreakdown(template,'LOCAL-PRD','LOCAL-V01',uid,D);
  const piece=first.materials[0];
  assert.notEqual(piece.id,again.materials[0].id);
  assert.equal(piece.groupId,first.groups[0].id);
  assert.equal(piece.purchaseQuantity,'2.5');
  assert.equal(first.processes[0].quantity,'2');
  assert.equal(first.processes[0].source.netAmount,'7.38');
  assert.deepEqual(first.processes[0].target.componentIds,[piece.id]);
  assert.deepEqual(first.finishSystems[0].layerIds,[first.processes[0].id]);
  assert.deepEqual(first.wood[0].adjustment.componentIds,[first.wood[0].id]);
  assert.equal(first.workshop.values['domino.componentId'],first.wood[0].id);
  assert.deepEqual(first.boardSettings[piece.id],{sheetAreaM2:'2.98'});
  assert.equal(JSON.stringify(template),baseline);
  assert.throws(()=>copyApprovedBreakdown({...template,articleQuantity:''},'LOCAL-PRD','LOCAL-V01',uid,D),/unidad de referencia/);
});

test('integrates supplier lookup, product controls and closed wood details through the actual build pipeline',()=>{
  assert.doesNotMatch(template,/Otros datos de compra/);
  assert.match(template,/supplierSearch\(el,app.breakdownEditor,'breakdown'\)/);
  assert.match(template,/data-local-recipe-confirm/);
  assert.match(template,/prototypePriceControl\(r,i,totals\)/);
  assert.match(template,/folds:\{general:false,supplies:true,wood:false\}/);
  assert.match(template,/panels\?\.\[itemId\+'\|workshop-'\+key\] === true/);
  for(const script of scripts)new vm.Script(script);
});
