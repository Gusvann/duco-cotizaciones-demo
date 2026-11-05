import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {extendRecipes} from '../tools/recipe-extension.mjs';
import {extendRecipePresentation} from '../src/recipe-presentation.mjs';
import {extendPhone} from '../tools/phone-extension.mjs';
import {extendWoodPieces} from '../tools/wood-pieces-extension.mjs';
import {extendArticleMeasures} from '../tools/article-measure-extension.mjs';

// Execute the transformed client in an isolated VM; this does not replace browser QA.
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=extendArticleMeasures(extendPhone(extendWoodPieces(extendRecipePresentation(extendRecipes(read('src/cotizador.html'))))));
const scripts=[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1].replace('globalThis.__client = {','globalThis.__client = {solidWoodSet,solidWoodApply,solidWoodAction,solidWoodEditorReferenceHtml,solidWoodRefresh,'));
const plain=value=>JSON.parse(JSON.stringify(value));
function harness(){
  const nodes=new Map();
  let document;
  const make=id=>({id,innerHTML:'',outerHTML:'',textContent:'',hidden:false,inert:false,open:false,disabled:false,dataset:{},style:{},listeners:new Map(),attributes:new Map(),
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(type,callback){const list=this.listeners.get(type)||[];list.push(callback);this.listeners.set(type,list);},
    querySelector(selector){if(selector.startsWith('#')){const key=selector.slice(1);if(nodes.has(key))return nodes.get(key);if(nodes.get('workspace')?.innerHTML.includes('id="'+key+'"')){const value=make(key);nodes.set(key,value);return value;}}if(selector==='.form-panel > fieldset')return make('fieldset');return null;},
    querySelectorAll(){return [];},contains(target){return target===this||target?.container===this;},
    getAttribute(name){return this.attributes.get(name)??null;},hasAttribute(name){return this.attributes.has(name);},setAttribute(name,value){this.attributes.set(name,String(value));},removeAttribute(name){this.attributes.delete(name);},
    focus(){document.activeElement=this;},scrollIntoView(){},replaceChildren(){this.innerHTML='';},insertAdjacentHTML(){},appendChild(){},before(){},remove(){},showModal(){this.open=true;},close(){this.open=false;},getClientRects(){return [];}});
  for(const id of ['quote-host','session','notice','workspace','busy','busy-label'])nodes.set(id,make(id));
  document={activeElement:null,body:make('body'),getElementById:id=>nodes.get(id)||null,querySelector:selector=>nodes.get('quote-host').querySelector(selector),querySelectorAll:()=>[],createElement:()=>make('created'),contains:()=>true,addEventListener(){}};
  const sandbox=vm.createContext({structuredClone,queueMicrotask,document,crypto:{randomUUID},TextEncoder,TextDecoder,requestAnimationFrame:callback=>{callback();return 1;},cancelAnimationFrame(){},setTimeout(){return 1;},clearTimeout(){},CSS:{escape:String},location:{href:'about:blank',search:''},navigator:{},matchMedia:()=>({matches:false})});
  vm.runInContext(`globalThis.window=globalThis;globalThis.addEventListener=()=>{};globalThis.confirm=()=>true;
    for(const key of ['fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','indexedDB'])Object.defineProperty(globalThis,key,{get(){throw new Error('Forbidden API: '+key);}});`,sandbox);
  for(const file of ['src/recipe-reference.js','src/recipe-catalog.js','src/country-codes.js','src/demo-phone.js'])vm.runInContext(read(file),sandbox,{filename:file});
  for(const [index,script] of scripts.entries())vm.runInContext(script,sandbox,{filename:'client-'+index+'.js'});
  vm.runInContext(read('src/quote-bridge.js'),sandbox,{filename:'quote-bridge.js'});
  const c=sandbox.__client,Q=sandbox.DemoQuote;
  Q.create('DEMO-WOOD','complete',{title:'Prueba',client:'Cliente ficticio',contact:'Contacto ficticio',need:'Prueba',included:'Fabricación; Empaque',excluded:'Obra civil',account:'Ejemplo',designer:'Ejemplo',quoteDue:'2026-10-21',deliveryDate:'2026-11-12'},{scopePreset:'fabrication-packaging'});
  Q.open('DEMO-WOOD');Q.showStep(1);
  const id=c.app.q.items[0].id;c.openPartEditor(id);c.solidWoodOpen(id);
  return {c,Q,id,nodes,sandbox,component:()=>c.app.breakdownEditor.solidWoodF,html:()=>nodes.get('workspace').innerHTML};
}

const technicalCopy = /Precio documental|vigencia|moneda|sin acreditar|PREVIEW|ESTIMATED/i;
function captureReference(h) {
  const fields={name:'CUBIERTA',woodKind:'Tzalam',width:'60',length:'60',lengthUnit:'cm',thickness:'1.5',quantityPerProduct:'1',finishFaces:'2',jointed:'1',wasteRate:'30'};
  for(const [key,value] of Object.entries(fields))assert.equal(h.c.solidWoodSet(key,value),true,key);
  h.component().recipeSource='LOCAL_REFERENCE_D91';
}
function liveNodes(h) {
  const nodes=Object.fromEntries(['unitMeasurements','unitCost','unitPriceInfo','articleTotals'].map(key=>[key,{dataset:{solidLive:key},innerHTML:''}]));
  h.nodes.get('quote-host').querySelectorAll=selector=>selector==='[data-solid-live]'?Object.values(nodes):[];
  return nodes;
}
function region(html,key) {
  const marker='<section class="wood-editor-group" data-editor-group="'+key+'">';
  const at=html.indexOf(marker);assert.ok(at>=0,key);
  return html.slice(at,html.indexOf('</section>',at)+10);
}

test('wood capture shows one unit metrics grid without repeated totals or observed processes',()=>{
  const h=harness();captureReference(h);
  const before=plain(h.c.recipeWoodResult(h.id,h.component()));
  const html=h.c.solidWoodEditorReferenceHtml();
  assert.equal((html.match(/class="wood-unit-metrics"/g)||[]).length,1);
  assert.match(region(html,'unit'),/wood-unit-metrics/);
  assert.doesNotMatch(region(html,'result'),/wood-unit-metrics|layoutProcesses|Procesos observados/);
  assert.doesNotMatch(html,/data-solid-live="layoutProcesses"|Procesos observados/);
  assert.doesNotMatch(region(html,'price'),technicalCopy);
  assert.doesNotMatch(region(html,'result'),technicalCopy);
  assert.match(region(html,'price'),/Motivo del ajuste/);
  assert.match(region(html,'pending'),/data-solid-live="referencePending"/);
  assert.match(region(html,'technical'),/Consulta técnica/);
  assert.deepEqual(plain(h.c.recipeWoodResult(h.id,h.component())),before,'Rendering does not modify calculations or validation flags');
});

test('live refresh keeps compact blocks, unchanged amounts and visible missing price',()=>{
  const h=harness();captureReference(h);
  const blocks=liveNodes(h),before=plain(h.c.recipeWoodResult(h.id,h.component()));
  h.c.solidWoodRefresh();
  assert.match(blocks.unitMeasurements.innerHTML,/wood-unit-metrics/);
  for(const key of ['unitCost','unitPriceInfo','articleTotals'])assert.doesNotMatch(blocks[key].innerHTML,technicalCopy,key);
  assert.doesNotMatch(blocks.articleTotals.innerHTML,/wood-unit-metrics|Procesos observados/);
  assert.match(blocks.unitCost.innerHTML,/738\.59/,'Independent known 60 × 60, 1.5 in, 30% waste and 80 reference price');
  assert.equal(before.unitCosts.woodCost,738.59);
  assert.equal(before.articleCosts.woodCost,1477.18,'The two-unit test article scales once before monetary rounding');
  assert.match(blocks.articleTotals.innerHTML,/1,477\.18/);
  assert.deepEqual(plain(h.c.recipeWoodResult(h.id,h.component())),before);
  assert.equal(before.unitCosts.financialConfirmed,false);
  assert.ok(before.pendingDecisions.length>0);

  assert.equal(h.c.solidWoodSet('woodKind',''),true,'A real edit invokes the production refresh wrapper');
  assert.match(blocks.unitPriceInfo.innerHTML,/Precio pendiente/);
  assert.match(blocks.unitCost.innerHTML,/Pendiente/);
  assert.doesNotMatch(blocks.articleTotals.innerHTML,/wood-unit-metrics|Procesos observados/);
  const pending=h.c.recipeWoodResult(h.id,h.component());
  assert.equal(pending.unitCosts.woodCost,null);
  assert.equal(pending.unitCosts.financialConfirmed,false);
  assert.equal(pending.priceResolution.quality,'PENDING');
  for(const key of ['unitCost','unitPriceInfo','articleTotals'])assert.doesNotMatch(blocks[key].innerHTML,technicalCopy,key);
});

test('piece waste and material price have separate fields and actions without demo presets',()=>{
  const h=harness();captureReference(h);
  const before=plain(h.component()),html=h.c.solidWoodEditorReferenceHtml();
  const waste=region(html,'waste'),price=region(html,'price');
  assert.match(waste,/<h6>Desperdicio de esta pieza<\/h6>/);
  assert.match(waste,/data-solid-field="wasteRate"/);
  assert.doesNotMatch(waste,/data-solid-action|adjustment\./);
  assert.match(price,/<h6>Precio del material<\/h6>/);
  assert.match(price,/data-solid-action="reset"[^>]*>Restablecer precio de referencia<\/button>/);
  assert.match(price,/data-solid-action="group-price"[^>]*>Aplicar este precio a piezas compatibles<\/button>/);
  assert.doesNotMatch(price,/data-solid-field="wasteRate"/);
  assert.doesNotMatch(waste+price,/DEMO|UAT|preview|grupo explícito|parámetro pendiente/i);
  assert.doesNotMatch(html,/data-solid-action="demo-parameters"|data-editor-group="exceptions"|Ajustar parámetros por excepción/);
  for(const field of ['wasteRate','adjustment.price','adjustment.reason'])assert.equal(html.split('data-solid-field="'+field+'"').length,2,field+' appears only once');
  assert.deepEqual(plain(h.component()),before);
});

test('material price still confirms compatible pieces and never copies their waste percentages',()=>{
  const h=harness(),quoteBefore=plain(h.c.app.q),ids=[];
  const pieces=[['Cubierta A','Tzalam','1.5','10'],['Cubierta B','Tzalam','1.5','20'],['Pata','Tzalam','1','25'],['Otro material','Encino rojo','1.5','30']];
  for(const [index,[name,woodKind,thickness,wasteRate]] of pieces.entries()){
    if(index)assert.equal(h.c.solidWoodOpen(h.id),true);
    captureReference(h);
    for(const [key,value] of Object.entries({name,woodKind,thickness,wasteRate}))assert.equal(h.c.solidWoodSet(key,value),true);
    ids.push(h.component().id);assert.equal(h.c.solidWoodApply(),true);
  }
  const entriesBefore=plain(h.c.solidWoodEntries(h.id));
  assert.equal(h.c.solidWoodOpen(h.id,ids[0]),true);
  assert.equal(h.c.solidWoodSet('wasteRate','35'),true);
  assert.equal(h.c.solidWoodSet('adjustment.price','90.00'),true);
  assert.equal(h.c.solidWoodSet('adjustment.reason','Ajuste de prueba'),true);
  const confirmations=[];
  h.sandbox.confirm=text=>{confirmations.push(text);return false;};
  assert.equal(h.c.solidWoodAction('group-price'),false);
  assert.equal(confirmations.length,1);
  assert.match(confirmations[0],/Aplicar este precio.*misma madera y espesor: Cubierta A, Cubierta B/);
  assert.doesNotMatch(confirmations[0],/Pata|Otro material|UAT|grupo explícito/);
  assert.deepEqual(plain(h.c.solidWoodEntries(h.id)),entriesBefore,'Cancelling the confirmation changes no other piece');
  assert.equal(h.c.app.breakdownEditor.pendingGroupIds??null,null);
  h.sandbox.confirm=()=>true;
  assert.equal(h.c.solidWoodAction('group-price'),true);
  assert.deepEqual(plain(h.c.app.breakdownEditor.pendingGroupIds),ids.slice(0,2));
  assert.deepEqual(plain(h.c.solidWoodEntries(h.id)),entriesBefore,'Confirmation still waits for Apply piece');
  assert.equal(h.c.solidWoodApply(),true);
  const entries=plain(h.c.solidWoodEntries(h.id));
  assert.deepEqual(entries.map(piece=>piece.wasteRate),['35','20','25','30']);
  assert.deepEqual(entries.map(piece=>piece.adjustment?.price??null),['90.00','90.00',null,null]);
  assert.deepEqual(plain(h.c.app.q),quoteBefore,'No confirmed quote is overwritten by a local price action');

  assert.equal(h.c.solidWoodOpen(h.id,ids[0]),true);
  assert.equal(h.c.solidWoodAction('reset'),true);
  assert.equal(h.component().adjustment,null);
  assert.equal(h.component().wasteRate,'35','Reset price does not reset waste');
  assert.equal(h.c.recipeWoodResult(h.id,h.component()).priceResolution.appliedPrice,80);
  assert.deepEqual(plain(h.c.solidWoodEntries(h.id)),entries,'Reset remains in the current piece draft');
});

test('missing waste stays pending without suggesting a removed demo button',()=>{
  const h=harness();captureReference(h);
  const pending={dataset:{solidLive:'referencePending'},innerHTML:''};
  h.nodes.get('quote-host').querySelectorAll=selector=>selector==='[data-solid-live]'?[pending]:[];
  assert.equal(h.c.solidWoodSet('wasteRate',''),true);
  assert.equal(h.component().wasteRate,'');
  assert.ok(h.c.recipeWoodResult(h.id,h.component()).pendingDecisions.includes('WASTE_RATE'));
  assert.match(pending.innerHTML,/Captura un porcentaje de desperdicio válido para esta pieza/);
  assert.doesNotMatch(pending.innerHTML,/parámetro DEMO|demo-parameters/);
  assert.equal(h.c.solidWoodSet('wasteRate','0'),true);
  assert.ok(!h.c.recipeWoodResult(h.id,h.component()).pendingDecisions.includes('WASTE_RATE'),'Explicit zero is distinct from absence');
  assert.equal(h.c.solidWoodSet('wasteRate','inválido'),true);
  assert.equal(h.c.solidWoodApply(),false);
  assert.equal(h.component().wasteRate,'inválido','Invalid capture remains available for correction');
});

