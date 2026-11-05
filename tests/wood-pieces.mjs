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
const scripts=[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1].replace('globalThis.__client = {','globalThis.__client = {solidWoodSet,solidWoodApply,'));
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

test('catalogue suggests common pieces without dimensions, while allowing custom names',()=>{
  const h=harness(),before=plain(h.component());
  const markup=h.html();
  assert.match(markup,/list="solid-wood-piece-catalog"/);
  for(const name of ['Cubierta','Pata','Travesaño','Asiento','Respaldo'])assert.ok(markup.includes('<option value="'+name+'"'),name);
  const choices=markup.match(/<datalist id="solid-wood-piece-catalog">([\s\S]*?)<\/datalist>/)?.[1];
  assert.ok(choices);assert.doesNotMatch(choices,/\d/,'Suggested pieces must not prescribe measurements or quantities');
  assert.equal(h.c.solidWoodSet('name','Cubierta'),true);
  assert.equal(h.component().name,'Cubierta');
  for(const field of ['width','length','thickness','quantityPerProduct'])assert.equal(h.component()[field],before[field],field+' was unexpectedly inferred');
  assert.equal(h.c.solidWoodSet('name','Pieza especial'),true);
  assert.equal(h.component().name,'Pieza especial');
});

test('wood editor keeps independent width and length without shape controls',()=>{
  const h=harness(),markup=h.html();
  assert.match(markup,/data-solid-field="width"/);
  assert.match(markup,/data-solid-field="length"/);
  assert.doesNotMatch(markup,/data-solid-field="(?:shape|diameter)"/);
  assert.equal(h.c.solidWoodSet('shape','round'),false);
  assert.equal(h.c.solidWoodSet('diameter','60'),false);
  assert.equal(h.c.solidWoodSet('width','60'),true);
  assert.equal(h.c.solidWoodSet('length','80'),true);
  assert.equal(h.component().width,'60');
  assert.equal(h.component().length,'80');
});
