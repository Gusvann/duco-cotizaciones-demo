import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {extendRecipes} from '../tools/recipe-extension.mjs';
import {extendRecipePresentation} from '../src/recipe-presentation.mjs';
import {extendPhone} from '../tools/phone-extension.mjs';
import {extendWoodPieces} from '../tools/wood-pieces-extension.mjs';
import {extendArticleMeasures} from '../tools/article-measure-extension.mjs';
import {extendRowVariant} from '../src/row-variant.mjs';
import {extendSessionAutosave} from '../src/session-autosave.mjs';
import {extendViewPolish} from '../src/view-polish.mjs';
import {extendRecipeWorkshop} from '../src/recipe-workshop.mjs';

// Commercial catalog identities and D91 recipe preview with unconfirmed historical economics. The actual transformed D85 client, domain and
// bridge execute in a Node VM with a DOM substitute. This is not browser QA.
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const native=read('src/cotizador.html');
const referenceSource=read('src/recipe-reference.js');
const catalogSource=read('src/recipe-catalog.js');
const bridgeSource=read('src/quote-bridge.js');
const portfolioSource=read('src/portfolio-kpis.js'),journeySource=read('src/journey.js');
const operationsSource=read('src/project-operations.js'),projectViewsSource=read('src/project-views.js');
const extended=extendRecipeWorkshop(extendViewPolish(extendSessionAutosave(extendRowVariant(extendArticleMeasures(extendPhone(extendWoodPieces(extendRecipePresentation(extendRecipes(native)))))))));
const scripts=[...extended.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const plain=value=>value==null?value:JSON.parse(JSON.stringify(value));
const request=()=>({title:'Recorrido de receta inventada',client:'Cliente ficticio',contact:'Contacto ficticio',need:'Explorar recetas sintéticas sin servicios.',included:'Fabricación; Empaque',excluded:'Obra civil',account:'Account de ejemplo',designer:'Diseño de ejemplo',quoteDue:'2026-10-21',deliveryDate:'2026-11-12'});
function input(dataset,value,type='text'){
  return {id:'',dataset:{digits:'3',...dataset},value,type,tagName:'INPUT',max:'100000000',validity:{badInput:false},selectionStart:null,selectionEnd:null,
    hasAttribute:()=>false,getAttribute:()=>null,setAttribute(){},setCustomValidity(){}};
}
function editPart(h,itemId,field,value,type='text'){
  const index=h.c.app.partDraft.quote.items.findIndex(row=>row.id===itemId);
  assert.ok(index>=0);assert.equal(h.c.partInput(input({path:'items.'+index+'.'+field},value,type),false),true);
}
const itemRow=(quote,id)=>quote.manufacturing.items.find(row=>row.itemId===id);
test('5 Nov wood waits for explicit confirmation and hides the edit pencil while preserving discard and locks',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C'),first=h.c.solidWoodEntries(itemId)[0],before=plain(first),snapshot=h.Q.snapshot(h.c.app.q.id);
  h.c.solidWoodOpen(itemId,first.id);
  await h.event('change',{solidField:'width'},'70');
  assert.equal(h.c.rowAutoFlush(),false,'Navigation/timers must not confirm a wood draft');
  assert.deepEqual(plain(h.c.solidWoodEntries(itemId)[0]),before);
  h.c.editor();let html=h.nodes.get('workspace').innerHTML;
  const active=html.match(new RegExp('<article[^>]*data-record-id="'+first.id+'"[\\s\\S]*?</article>'))?.[0];
  assert.ok(active);assert.match(active,/Confirmar cambios/);assert.match(active,/data-break-action="wood-discard"/);assert.doesNotMatch(active,/data-solid-action="edit"/);
  await h.event('click',{breakAction:'wood-discard'});
  assert.equal(h.c.app.breakdownEditor,null);assert.deepEqual(plain(h.c.solidWoodEntries(itemId)[0]),before);
  h.c.solidWoodOpen(itemId,first.id);await h.event('change',{solidField:'width'},'70');
  h.c.app.operation={id:'SYNTHETIC_BUSY'};await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.solidWoodEntries(itemId)[0].width,before.width);assert.ok(h.c.app.breakdownEditor);
  h.c.app.operation=null;
  await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.app.breakdownEditor,null);assert.equal(h.c.solidWoodEntries(itemId)[0].width,'70');assert.deepEqual(h.Q.snapshot(h.c.app.q.id),snapshot);
  h.c.solidWoodOpen(itemId,first.id);await h.event('change',{solidField:'width'},'número incorrecto');
  await h.event('click',{breakAction:'wood-confirm'});assert.ok(h.c.app.breakdownEditor);assert.equal(h.c.solidWoodEntries(itemId)[0].width,'70');
});
test('5 Nov Florencia has explicit technical decisions and priced hardware has no repeated validation prompt',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const wood=h.c.solidWoodEntries(itemId);assert.deepEqual(plain(wood.map(x=>x.jointed)),['1','0','0']);assert.deepEqual(plain(wood.map(x=>x.cnc.decision)),['yes','no','no']);
  h.c.editor();const html=h.nodes.get('workspace').innerHTML;
  const hardware=html.match(/<section[^>]*data-detail-section="supplies"[\s\S]*?<\/section>/)?.[0];assert.ok(hardware);assert.doesNotMatch(hardware,/Costo por validar|Referencia pendiente de validar/);
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials[0].economicReviewed,false,'Presentation is not financial promotion');
});
test('5 Nov Bolonia is a separate product with its hardware, board and metal recipe and exact board base',async()=>{
  const h=harness();h.open();const {itemId,product}=await h.select('SYN-BOLONIA-R');assert.equal(product.name,'Bolonia');
  editPart(h,itemId,'quantity','1');assert.equal(h.c.rowAutoFlush(),true);
  const quote=h.c.app.partDraft.quote,item=quote.items.find(x=>x.id===itemId),row=itemRow(quote,itemId);
  assert.equal(item.description,'Bolonia · Encino rojo');assert.equal(row.materials.filter(m=>m.section==='supplies').length,2);
  assert.equal(row.materials.find(m=>m.name==='TUERCA INSERTO').purchaseUnit,'PZA');
  assert.equal(h.sandbox.DemoRecipeReference.recipe('SYN-BOLONIA-R').hardware[1].unit,'HOJA','Original is preserved; user explicitly corrected the active unit');
  const board=row.materials.find(m=>m.section==='boards');assert.equal(board.substrate,'Lisapol');assert.equal(board.thickness,'12');
  assert.equal(row.materials.filter(m=>m.section.startsWith('metal-')).length,3);
  h.c.editor();let html=h.nodes.get('workspace').innerHTML;assert.match(html,/Composición de tablero/);assert.match(html,/0\.5041/);assert.match(html,/174\.84/);
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:board.id,rowField:'substrate'});
  html=h.nodes.get('workspace').innerHTML;assert.match(html,/Superficie sólida/);const substrate=html.match(/<select[^>]*data-break-field="substrate"[^>]*>[\s\S]*?<\/select>/)?.[0];assert.ok(substrate);assert.equal((substrate.match(/<option value="(?:MDF|Triplay|Sábana|MDP|Triplay flexible|MDF Flexible|Lisapol|MDF de color|Acrílico|Aglomerado|MDF melamínico|Superficie sólida|Otro)"/g)||[]).length,13);
  assert.match(html,/Recorrido CNC/);assert.match(html,/868\.62/);assert.match(html,/PLACOVE/);
  await h.event('change',{breakField:'width'},'80');assert.equal(h.c.rowAutoFlush(),true);
  assert.equal(itemRow(h.c.app.q,itemId).materials.find(x=>x.id===board.id).width,'80');
  assert.equal(board.width,'71');assert.equal(h.R.recipe('R-SYN-BOLONIA-R').boards[0].width,'71');
});
test('5 Nov new requests have no example module and catalog viewing never inserts Bolonia',async()=>{
  const h=harness();h.Q.create('DEMO-EMPTY','complete',request(),{emptyArticles:true});h.Q.open('DEMO-EMPTY');h.Q.showStep(1);
  assert.equal(h.c.app.q.items.length,0);assert.equal(h.c.app.q.manufacturing.items.length,0);
  assert.equal(h.c.app.q.costs.some(cost=>cost.itemId),false);assert.doesNotMatch(h.nodes.get('workspace').innerHTML,/Módulo de ejemplo/);
  h.begin();const product=h.R.products.find(product=>product.name==='Bolonia');await h.event('change',{lineVariant:product.id},'SYN-BOLONIA-R');
  assert.equal(h.c.app.q.items.length,0);assert.equal(h.Q.snapshot('DEMO-EMPTY'),null);
});
test('5 Nov board settings and edits remain isolated and invalid prices never show a valid base cost',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-BOLONIA-R');editPart(h,itemId,'quantity','1');h.c.rowAutoFlush();
  const board=itemRow(h.c.app.partDraft.quote,itemId).materials.find(m=>m.section==='boards');
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:board.id,rowField:'unitPrice'});
  await h.event('change',{boardSetting:'sheetAreaM2',boardId:board.id},'0');
  assert.equal(h.c.solidWoodState(itemId).boardSettings[board.id].sheetAreaM2,'0');h.c.editor();
  let row=h.nodes.get('workspace').innerHTML.match(new RegExp('<article[^>]*data-record-id="'+board.id+'"[\\s\\S]*?</article>'))?.[0];assert.ok(row);assert.match(row,/>Pendiente<\/output>/);
  await h.event('change',{boardSetting:'sheetAreaM2',boardId:board.id},'2.88');
  await h.event('input',{breakField:'unitPrice'},'12,34');h.c.editor();
  row=h.nodes.get('workspace').innerHTML.match(new RegExp('<article[^>]*data-record-id="'+board.id+'"[\\s\\S]*?</article>'))?.[0];assert.match(row,/>Pendiente<\/output>/);
  await h.event('click',{breakAction:'cancel-editor'});h.c.partDiscard();
  h.Q.create('DEMO-OTHER-BOARDS','complete',request());assert.equal(h.Q.open('DEMO-OTHER-BOARDS'),true);
  h.Q.showStep(1);
  const next=await h.select('SYN-BOLONIA-R'),other=itemRow(h.c.app.partDraft.quote,next.itemId).materials.find(m=>m.section==='boards');
  assert.notEqual(other.id,board.id);assert.equal(h.c.solidWoodState(next.itemId).boardSettings[other.id].sheetAreaM2,'2.88');
  assert.equal(h.Q.snapshot('DEMO-OTHER-BOARDS'),null);
});
test('5 Nov duplicating a board copies its base settings without duplicating a purchase or changing the source',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-BOLONIA-R');editPart(h,itemId,'quantity','1');h.c.rowAutoFlush();
  const original=itemRow(h.c.app.partDraft.quote,itemId).materials.find(m=>m.section==='boards');
  await h.event('click',{breakAction:'duplicate-component',id:original.id});
  const draft=h.c.app.breakdownEditor;assert.ok(draft.isNew);assert.notEqual(draft.value.id,original.id);
  assert.deepEqual(plain(h.c.solidWoodState(itemId).boardSettings[draft.value.id]),{sheetAreaM2:'2.88',wasteRate:'15'});
  assert.equal(draft.value.purchaseQuantity,'');assert.equal(draft.value.economicReviewed,false);
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials.filter(m=>m.section==='boards').length,1);
  assert.equal(h.R.recipe('R-SYN-BOLONIA-R').boards.length,1);
});
function pureCatalog(images){
  const sandbox=vm.createContext({structuredClone,DemoRecipeImages:images});
  vm.runInContext(referenceSource,sandbox,{filename:'recipe-reference.js'});
  vm.runInContext(catalogSource,sandbox,{filename:'recipe-catalog.js'});
  return sandbox.DemoRecipeCatalog;
}
function harness({partDraftFault=false}={}){
  const nodes=new Map(),documentListeners=new Map();
  let document;
  const make=id=>({id,innerHTML:'',outerHTML:'',textContent:'',hidden:false,inert:false,open:false,disabled:false,dataset:{},style:{},listeners:new Map(),attributes:new Map(),
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(type,callback){const list=this.listeners.get(type)||[];list.push(callback);this.listeners.set(type,list);},
    querySelector(selector){
      if(selector.startsWith('#')){
        const key=selector.slice(1);
        if(nodes.has(key))return nodes.get(key);
        if(nodes.get('workspace')?.innerHTML.includes('id="'+key+'"')){const value=make(key);nodes.set(key,value);return value;}
      }
      if(selector==='.form-panel > fieldset')return make('read-only-fieldset');
      if(selector.startsWith('[data-')&&this.open)return make('dialog-control');
      return null;
    },querySelectorAll(){return [];},contains(target){return target===this||target?.container===this;},
    getAttribute(name){return this.attributes.get(name)??null;},hasAttribute(name){return this.attributes.has(name);},setAttribute(name,value){this.attributes.set(name,String(value));},removeAttribute(name){this.attributes.delete(name);},
    focus(){document.activeElement=this;},scrollIntoView(){},replaceChildren(){this.innerHTML='';},insertAdjacentHTML(){},appendChild(){},before(){},remove(){},showModal(){this.open=true;},close(){this.open=false;},getClientRects(){return [];}});
  for(const id of ['quote-host','session','notice','workspace','busy','busy-label'])nodes.set(id,make(id));
  document={activeElement:null,body:make('body'),getElementById:id=>nodes.get(id)||null,
    querySelector:selector=>nodes.get('quote-host').querySelector(selector),querySelectorAll:()=>[],createElement:()=>make('created'),contains:()=>true,
    addEventListener(type,callback){const list=documentListeners.get(type)||[];list.push(callback);documentListeners.set(type,list);}};
  const sandbox=vm.createContext({structuredClone,queueMicrotask,document,crypto:{randomUUID},TextEncoder,TextDecoder,
    requestAnimationFrame:callback=>{callback();return 1;},cancelAnimationFrame(){},setTimeout(){return 1;},clearTimeout(){},
    CSS:{escape:String},location:{href:'about:blank',search:''},navigator:{},matchMedia:()=>({matches:false})});
  vm.runInContext(`globalThis.window=globalThis;globalThis.addEventListener=()=>{};globalThis.confirm=()=>true;
    for(const key of ['fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','indexedDB'])
      Object.defineProperty(globalThis,key,{get(){throw new Error('Forbidden external/storage API: '+key);}});`,sandbox);
  vm.runInContext(referenceSource,sandbox,{filename:'recipe-reference.js'});
  vm.runInContext(catalogSource,sandbox,{filename:'recipe-catalog.js'});
  vm.runInContext(read('src/country-codes.js'),sandbox,{filename:'country-codes.js'});
  vm.runInContext(read('src/demo-phone.js'),sandbox,{filename:'demo-phone.js'});
  let faultAt=null,openCalls=0;
  for(const [index,source] of scripts.entries()){
    if(partDraftFault&&source.includes('globalThis.__client = {')){
      // QuotePartDraft is a frozen lexical export. Inject only its open boundary
      // into the real client closure; all domain methods and successful opens stay real.
      const actual=vm.runInContext('QuotePartDraft',sandbox);
      sandbox.__testPartDraft={...actual,open(...args){if(++openCalls===faultAt)throw new Error('Synthetic fault after metadata insertion');return actual.open(...args);}};
      vm.runInContext('(function(QuotePartDraft){\n'+source+'\n})(__testPartDraft);',sandbox,{filename:'transformed-client-'+index+'.js'});
    }else vm.runInContext(source,sandbox,{filename:'transformed-client-'+index+'.js'});
  }
  vm.runInContext(bridgeSource,sandbox,{filename:'quote-bridge.js'});
  const c=sandbox.__client,Q=sandbox.DemoQuote,R=sandbox.DemoRecipeCatalog,host=nodes.get('quote-host');
  const event=async(type,dataset,value,options={},eventOptions={})=>{
    const target={container:host,dataset,value,type:type==='change'?'select-one':'button',tagName:type==='change'?'SELECT':'BUTTON',disabled:false,
      hasAttribute:()=>false,matches:()=>false,getAttribute:()=>null,
      closest(selector){for(const [field,key] of [['action','data-action'],['partAction','data-part-action'],['breakAction','data-break-action'],['solidAction','data-solid-action'],['rowDetails','data-row-details']])if(selector==='['+key+']'&&dataset[field]!=null)return this;return null;},...options};
    for(const listener of host.listeners.get(type)||[])await listener({target,...eventOptions,preventDefault(){},stopPropagation(){}});
    await Promise.resolve();
    return target;
  };
  const open=(id='DEMO-RECIPE',scenario='complete')=>{Q.create(id,scenario,request(),{scopePreset:'fabrication-packaging'});Q.open(id);Q.showStep(1);return c.app.q;};
  const begin=()=>{
    c.lineAction('line-add',{dataset:{}});
    const nonce=c.productStart().match(/data-product-intent="([^"]+)"/)?.[1];
    assert.ok(nonce,'A fresh native product intent is required');
    c.lineAction('line-open',{dataset:{productIntent:nonce}});
    return nonce;
  };
  const select=async variantId=>{
    const product=R.products.find(row=>row.variants.some(variant=>variant.id===variantId));
    assert.ok(product,'The explicit variant belongs to a synthetic product');
    const nonce=begin();
    await event('change',{lineVariant:product.id},variantId);
    c.lineAction('line-use',{dataset:{product:product.id,productIntent:nonce}});
    return {itemId:c.app.openPartId,product,nonce};
  };
  const initJourney=async()=>{
    for(const id of ['journey-root','journey-footer','j-main'])nodes.set(id,make(id));
    vm.runInContext(portfolioSource,sandbox,{filename:'portfolio-kpis.js'});
    vm.runInContext(operationsSource,sandbox,{filename:'project-operations.js'});
    vm.runInContext(projectViewsSource,sandbox,{filename:'project-views.js'});
    vm.runInContext(journeySource,sandbox,{filename:'journey.js'});
    await sandbox.DemoJourney.ready;
    const action=async(action,extra={})=>{
      const root=nodes.get('journey-root'),target={container:root,dataset:{action,...extra},disabled:false,closest:()=>target};
      for(const listener of root.listeners.get('click')||[])listener({target,preventDefault(){}});
      await new Promise(resolve=>setImmediate(resolve));
    };
    return {J:sandbox.DemoJourney,action};
  };
  const bubbleToDocument=async type=>{
    // This DOM substitute does not bubble host events automatically. Explicitly
    // dispatch their document phase when testing native-to-journey navigation.
    for(const listener of documentListeners.get(type)||[])await listener({target:{container:host}});
    await Promise.resolve();
  };
  return {sandbox,c,Q,R,nodes,host,open,begin,select,event,bubbleToDocument,initJourney,armOpenFault(at){assert.ok(partDraftFault);openCalls=0;faultAt=at;},openCalls:()=>openCalls};
}

test('the approved native D85 source stays unchanged; the extension is applied only to the generated client',()=>{
  assert.equal(createHash('sha256').update(native).digest('hex'),'3291618da77246df866be50ce53e3a74589435797e0b75975e35d69b71bb6a67');
  assert.notEqual(extended,native);
});

test('article capture removes the requested title, checkboxes and recipe disclosure',async()=>{
  const h=harness();h.open();
  const {itemId}=await h.select('SYN-NUBE-C'),before=JSON.stringify(h.c.recipeEntry(itemId));
  h.c.editor();
  const html=h.nodes.get('workspace').innerHTML,index=h.c.app.q.items.findIndex(item=>item.id===itemId);
  assert.doesNotMatch(html,/<h4>Despiece y fabricación<\/h4>|Receta de referencia · consulta técnica y pendientes|synthetic-recipe-source/);
  assert.doesNotMatch(html,/No se requiere|data-path="items\.\d+\.specs\.\d+\.na"/);
  for(let i=0;i<3;i++)assert.match(html,new RegExp('data-path="items\\.'+index+'\\.specs\\.'+i+'\\.value"'));
  // Later browser annotation, 4 Nov: remove the whole introductory status.
  assert.doesNotMatch(html,/article-flow-status|Captura las piezas y servicios que correspondan/);
  assert.match(html,/data-article-cost-status=/,'The functional article cost state remains visible');
  assert.match(html,/Insumos \/ herrajes/);assert.match(html,/Madera maciza/);
  assert.equal(JSON.stringify(h.c.recipeEntry(itemId)),before,'The hidden reference metadata stays intact');
  assert.ok(h.c.solidWoodState(itemId).applied.length>0,'The product recipe remains loaded');
});

test('compact quote presentation removes the financial sidebar and implementation labels while keeping pending states',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const current=()=>h.nodes.get('workspace').innerHTML;
  const text=html=>html.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  assert.doesNotMatch(current(),/Tu cotización, en cifras|<aside class="aside"/);
  assert.doesNotMatch(text(current()),/\b(?:UAT|PREVIEW|PENDING_CONFIG|PARAMETER_PENDING)\b|Variante en evaluación|Descartar preview/i);
  assert.match(text(current()),/Costo incompleto|por validar|parcial/i,'Incomplete cost information remains visible');
  const piece=h.c.solidWoodState(itemId).applied[0];
  await h.event('click',{solidAction:'edit',articleId:itemId,id:piece.id});
  assert.doesNotMatch(text(current()),/\b(?:UAT|PREVIEW|PENDING_CONFIG|PARAMETER_PENDING)\b|Variante en evaluación/i);
  // User decision, 4 Nov: capture is automatic; CNC no longer has its own Apply.
  assert.doesNotMatch(current(),/data-solid-action="apply-cnc"|data-break-action="save-editor"|data-action="part-apply"/);
  assert.match(current(),/data-solid-field="cnc.decision"/);
  await h.event('input',{solidField:'name'},'Pieza preview UAT');h.c.editor();
  assert.match(current(),/value="Pieza preview UAT"/,'Presentation copy edits never rewrite user-entered text');
  const blocked=await h.Q.save('DEMO-RECIPE');
  assert.equal(blocked.state,'blocked','Removing the summary does not bypass incomplete wood persistence');
  assert.doesNotMatch(blocked.summary.blockers.join(' '),/\b(?:UAT|PREVIEW|PENDING_CONFIG|PARAMETER_PENDING)\b|vista previa/i);
});

test('product catalog keeps selection and omits testing labels in its heading',()=>{
  const h=harness();h.open();h.begin();
  const html=h.c.lineCatalogPanel(),visible=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  assert.match(visible,/Catálogo de productos/);
  assert.doesNotMatch(visible,/Catálogo general de Duco · DEMO|productos sintéticos|\bPREVIEW\b/i);
  assert.match(html,/data-action="line-use"|data-action="line-details-toggle"/,'Catalog actions stay available');
});

test('the financial sidebar is absent at every quote step without changing totals',()=>{
  const h=harness();h.open();const before=plain(h.Q.summary('DEMO-RECIPE'));
  for(const step of [0,1,2,3,4]){
    h.c.app.step=step;h.c.editor();
    assert.doesNotMatch(h.nodes.get('workspace').innerHTML,/Tu cotización, en cifras|<aside class="aside"/);
  }
  const after=plain(h.Q.summary('DEMO-RECIPE'));
  assert.equal(after.priceCents,before.priceCents);assert.equal(after.taxCents,before.taxCents);assert.equal(after.totalCents,before.totalCents);
});

test('article uses expandable family sections and shared headers without altering its data',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const before=JSON.stringify({row:itemRow(h.c.app.partDraft.quote,itemId),wood:h.c.solidWoodState(itemId).applied});
  h.c.editor();const html=h.nodes.get('workspace').innerHTML;
  assert.match(html,/data-article-study="desglose"/);
  assert.doesNotMatch(html,/<nav class="article-study-nav"/);
  assert.match(html,/<details class="article-study-fold" data-article-fold="supplies"[^>]* open>/);
  assert.match(html,/<details class="article-study-fold" data-article-fold="wood"[^>]* open>/);
  assert.match(html,/Dimensiones de materia prima/);
  assert.match(html,/rv-table-heading rv-grid/);assert.match(html,/rv-table-heading rv-grid rv-wood-grid/);
  assert.match(html,/rv-table-heading rv-grid rv-supply-grid/);
  assert.match(html,/Medidas y acabado/);assert.match(html,/Espesor · in/);
  assert.doesNotMatch(html,/data-break-action="edit-group"[^>]*data-section="supplies"/,'The redundant supplies group button is gone');
  assert.equal(JSON.stringify({row:itemRow(h.c.app.partDraft.quote,itemId),wood:h.c.solidWoodState(itemId).applied}),before);
  const toggle={dataset:{articleFold:'wood',articleId:itemId},isConnected:true,open:false,matches:s=>s==='details[data-article-fold]'};
  for(const listener of h.host.listeners.get('toggle')||[])listener({target:toggle});
  h.c.editor();
  assert.doesNotMatch(h.nodes.get('workspace').innerHTML,/<details class="article-study-fold" data-article-fold="wood"[^>]* open>/);
  const id=h.c.solidWoodState(itemId).applied[0].id;
  await h.event('click',{solidAction:'edit',articleId:itemId,id});
  assert.match(h.nodes.get('workspace').innerHTML,/<details class="article-study-fold" data-article-fold="wood"[^>]* open>/,'Opening a piece reveals its family');
});

function woodCardMarkup(html,id){
  const marker='<article class="fab-detail-line article-panel-record rv-row" data-record-id="'+id+'" data-record-kind="wood">';
  const start=html.indexOf(marker);assert.ok(start>=0,'Wood row '+id+' must remain in the list');
  const tags=/<\/?article\b[^>]*>/g;tags.lastIndex=start;let depth=0,match;
  while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,tags.lastIndex);}
  throw Error('Unclosed wood row');
}
function woodRowOrder(html){
  return [...html.matchAll(/<article class="fab-detail-line article-panel-record rv-row" data-record-id="([^"]+)" data-record-kind="wood">/g)].map(match=>match[1]);
}

function variantRow(html, id, kind) {
  const marker=html.indexOf(' data-record-id="'+id+'" data-record-kind="'+kind+'">'),start=marker<0?-1:html.lastIndexOf('<article ',marker);
  assert.ok(start>=0,'The '+kind+' row must remain in its family');
  const tags=/<\/?article\b[^>]*>/g;tags.lastIndex=start;let depth=0,match;
  while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,tags.lastIndex);}
  throw Error('Unclosed variant row');
}

test('hardware rows expose existing values and dropdowns without changing the underlying recipe',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const row=itemRow(h.c.app.partDraft.quote,itemId),[first,second]=row.materials, snapshot=JSON.stringify(row);
  const html=h.nodes.get('workspace').innerHTML,firstRow=variantRow(html,first.id,'material'),secondRow=variantRow(html,second.id,'material');
  assert.match(firstRow,/NIVELADORES ASTRIADO/);assert.match(secondRow,/TUERCA INSERTO/);
  assert.match(firstRow,/data-row-field="purchaseUnit"/);assert.match(firstRow,/>Proveedor<\/button>/);
  const fieldOrder=['category','specification','sku','purchaseQuantity','purchaseUnit','unitPrice'].map(field=>firstRow.indexOf('data-row-field="'+field+'"'));
  assert.ok(fieldOrder.every((position,index)=>position>=0&&(index===0||position>fieldOrder[index-1])),'Type, concept, SKU and quantities stay on the same row in order');
  assert.match(firstRow,/<strong>\$\s*20\.00<\/strong>/);assert.match(secondRow,/<strong>\$\s*2\.00<\/strong>/);
  // 5 Nov: complete unit prices no longer ask for repeated row validation.
  assert.doesNotMatch(firstRow,/Costo por validar/);assert.match(firstRow,/Precio de referencia/);
  assert.equal(JSON.stringify(row),snapshot,'Rendering rows does not create a charge or modify the recipe');

  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:first.id});
  assert.equal(h.c.app.breakdownEditor.value.id,first.id);
  assert.match(variantRow(h.nodes.get('workspace').innerHTML,first.id,'material'),/data-fab-panel="variant-row-detail-[^"]+" open/);
  await h.event('click',{breakAction:'cancel-editor'});
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:first.id,rowField:'purchaseUnit'},'');
  assert.equal(h.c.app.breakdownEditor.value.id,first.id);
  let active=variantRow(h.nodes.get('workspace').innerHTML,first.id,'material');
  const mainRow=active.slice(0,active.indexOf('<details class="rv-details"'));
  const editOrder=['category','specification','sku','purchaseQuantity','purchaseUnit','unitPrice'].map(field=>mainRow.indexOf('data-break-field="'+field+'"'));
  assert.ok(editOrder.every((position,index)=>position>=0&&(index===0||position>editOrder[index-1])),'The actual editable fields keep the same order');
  assert.equal((active.match(/data-break-field="sku"/g)||[]).length,1);
  assert.match(active,/<select[^>]*data-break-field="category"/);
  assert.match(active,/<select[^>]*data-break-field="purchaseUnit"/);
  assert.match(active,/<summary>Proveedor<\/summary>/);assert.match(active,/data-break-field="supplier"/);
  assert.doesNotMatch(active,/data-break-provider-query|data-break-action="search-provider"|Editar renglón de despiece/);
  assert.match(active,/data-break-field="purchaseQuantity"/);
  h.c.breakdownSetField(input({breakField:'purchaseQuantity'},'9','number'),false);
  h.c.breakdownSetField(input({breakField:'specification'},'Pieza"><img src=x onerror="alert(1)">'),false);
  h.c.editor();
  active=variantRow(h.nodes.get('workspace').innerHTML,first.id,'material');
  assert.doesNotMatch(active,/<img\b|<script\b/i);
  assert.match(active,/&lt;img/,'The editable concept is escaped in the rendered row');
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:second.id,rowField:'specification'},'');
  assert.equal(h.c.app.breakdownEditor.value.id,second.id);
  assert.equal(h.c.app.breakdownContinuation,null,'The 4 Nov decision retains valid changes automatically');
  assert.equal(itemRow(h.c.app.q,itemId).materials[0].purchaseQuantity,'9');
  assert.equal(itemRow(h.c.app.q,itemId).materials[0].specification,'Pieza"><img src=x onerror="alert(1)">');
  await h.event('click',{breakAction:'cancel-editor'});
});

test('supply provider is an optional single field, persists only on apply, and never starts a search',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');
  const row=itemRow(h.c.app.partDraft.quote,itemId),[first,second]=row.materials,before=plain(first),other=plain(second);
  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:first.id});
  let html=variantRow(h.nodes.get('workspace').innerHTML,first.id,'material');
  assert.match(html,/<summary>Proveedor<\/summary>/);assert.match(html,/Proveedor \(opcional\)/);
  assert.match(html,/<input[^>]*data-break-field="supplier"[^>]*maxlength="200"/);
  assert.doesNotMatch(html,/data-break-provider-query|data-break-action="search-provider"|Editar renglón de despiece/);
  h.c.breakdownSetField(input({breakField:'supplier'},'Proveedor"><img src=x onerror="alert(1)">'),false);
  h.c.editor();html=variantRow(h.nodes.get('workspace').innerHTML,first.id,'material');
  assert.doesNotMatch(html,/<img\b|<script\b/i);assert.match(html,/&lt;img/);
  assert.equal(row.materials[0].supplier,'');
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials[0].supplier,'');
  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:first.id});
  h.c.breakdownSetField(input({breakField:'supplier'},'Proveedor ficticio'),false);
  assert.equal(h.c.breakdownSave(),true);
  let changed=itemRow(h.c.app.partDraft.quote,itemId).materials;
  assert.equal(changed[0].supplier,'Proveedor ficticio');
  for(const field of ['purchaseQuantity','purchaseUnit','unitPrice'])assert.equal(changed[0][field],before[field]);
  assert.deepEqual(plain(changed[1]),other);
  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:first.id});
  html=variantRow(h.nodes.get('workspace').innerHTML,first.id,'material');assert.match(html,/value="Proveedor ficticio"/);
  h.c.breakdownSetField(input({breakField:'supplier'},''),false);assert.equal(h.c.breakdownSave(),true);
  changed=itemRow(h.c.app.partDraft.quote,itemId).materials;assert.equal(changed[0].supplier,'');
  assert.equal(changed[0].unitPrice,before.unitPrice);assert.equal(changed[0].purchaseQuantity,before.purchaseQuantity);
});

test('a linked provider and service are preserved until an explicit confirmed change',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');
  const row=itemRow(h.c.app.partDraft.quote,itemId),material=row.materials[0],id=material.id;
  Object.assign(material,{supplier:'Proveedor ficticio',providerId:'PROV-FICTICIO',serviceId:'SERV-FICTICIO',serviceName:'Servicio ficticio'});
  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:id});
  let html=variantRow(h.nodes.get('workspace').innerHTML,id,'material');
  assert.match(html,/<input readonly aria-readonly="true"[^>]*data-break-field="supplier"/);
  assert.match(html,/Cambiar proveedor/);assert.match(html,/Otros datos de compra/);
  h.c.breakdownSetField(input({breakField:'sku'},'SKU-FICTICIO'),false);
  assert.equal(h.c.breakdownSave(),true);
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials[0].providerId,'PROV-FICTICIO');
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials[0].serviceId,'SERV-FICTICIO');
  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:id});
  h.sandbox.confirm=()=>false;
  await h.event('click',{breakAction:'rv-change-linked-provider'});
  assert.equal(h.c.app.breakdownEditor.value.providerId,'PROV-FICTICIO');
  assert.equal(h.c.app.breakdownEditor.value.serviceId,'SERV-FICTICIO');
  h.sandbox.confirm=()=>true;
  await h.event('click',{breakAction:'rv-change-linked-provider'});
  assert.equal(h.c.app.breakdownEditor.value.providerId,'');assert.equal(h.c.app.breakdownEditor.value.serviceId,'');
  assert.equal(h.c.app.breakdownEditor.value.supplier,'Proveedor ficticio');
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials[0].providerId,'PROV-FICTICIO','Cancel restores the linked provider');
  assert.equal(itemRow(h.c.app.partDraft.quote,itemId).materials[0].serviceId,'SERV-FICTICIO','Cancel restores the linked service');
  await h.event('click',{rowDetails:'material',rowItem:itemId,rowId:id});
  await h.event('click',{breakAction:'rv-change-linked-provider'});
  h.c.breakdownSetField(input({breakField:'supplier'},'Proveedor nuevo ficticio'),false);
  assert.equal(h.c.breakdownSave(),true);
  const saved=itemRow(h.c.app.partDraft.quote,itemId).materials[0];
  assert.equal(saved.supplier,'Proveedor nuevo ficticio');assert.equal(saved.providerId,'');assert.equal(saved.serviceId,'');
});

test('editing type and SKU applies only to the selected supply without changing its amount',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');
  const row=itemRow(h.c.app.partDraft.quote,itemId),[first,second]=row.materials;
  const before=plain(first),other=plain(second),savedQuote=JSON.stringify(h.c.app.q);
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:first.id,rowField:'category'},'');
  h.c.breakdownSetField(input({breakField:'category'},'Tornillería','select-one'),false);
  h.c.breakdownSetField(input({breakField:'sku'},'SKU-FICTICIO-1'),false);
  assert.equal(row.materials[0].category,before.category,'Unapplied input stays isolated');
  assert.equal(h.c.breakdownSave(),true);
  const changed=itemRow(h.c.app.partDraft.quote,itemId).materials;
  assert.equal(changed[0].category,'Tornillería');assert.equal(changed[0].sku,'SKU-FICTICIO-1');
  for(const field of ['purchaseQuantity','purchaseUnit','unitPrice'])assert.equal(changed[0][field],before[field]);
  assert.deepEqual(plain(changed[1]),other);assert.equal(JSON.stringify(h.c.app.q),savedQuote);
  h.c.editor();
  const rendered=variantRow(h.nodes.get('workspace').innerHTML,first.id,'material');
  assert.match(rendered,/Tornillería/);assert.match(rendered,/SKU-FICTICIO-1/);
  assert.match(rendered,/<strong>\$\s*20\.00<\/strong>/);
});

test('with missing article quantity, a type or SKU edit leaves the calculated purchase pending',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const id=itemRow(h.c.app.partDraft.quote,itemId).materials[0].id;
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:id,rowField:'sku'},'');
  h.c.breakdownSetField(input({breakField:'sku'},'SKU-FICTICIO-2'),false);
  assert.equal(h.c.breakdownSave(),true);
  const updated=itemRow(h.c.app.partDraft.quote,itemId).materials.find(value=>value.id===id);
  assert.equal(updated.sku,'SKU-FICTICIO-2');assert.equal(updated.purchaseQuantity,'');
  h.c.editor();assert.match(variantRow(h.nodes.get('workspace').innerHTML,id,'material'),/<strong>Pendiente<\/strong>/);
});

test('a new supply uses the same ordered columns and can be cancelled without changing the article',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const before=JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).materials);
  await h.event('click',{breakAction:'add-detail-material',section:'supplies'});
  assert.equal(h.c.app.breakdownEditor.value.section,'supplies');
  const id=h.c.app.breakdownEditor.value.id,html=h.nodes.get('workspace').innerHTML;
  const start=html.indexOf('<div class="rv-new-row">'),end=html.indexOf('<details class="rv-details"',start);
  assert.ok(start>=0&&end>start,'The new editor sits inside the table with the shared heading');
  const row=html.slice(start,end),fields=['category','specification','sku','purchaseQuantity','purchaseUnit','unitPrice'];
  const positions=fields.map(field=>row.indexOf('data-break-field="'+field+'"'));
  assert.ok(positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])));
  assert.equal((html.match(new RegExp('data-row-editor="'+id+'"','g'))||[]).length,1);
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).materials),before);
  await h.event('click',{breakAction:'add-detail-material',section:'supplies'});
  const newId=h.c.app.breakdownEditor.value.id;
  for(const [field,value,type] of [['category','Tornillería','select-one'],['specification','Pija ficticia','text'],['sku','SKU-FICTICIO-3','text'],['purchaseQuantity','3','number'],['purchaseUnit','Pieza','select-one'],['unitPrice','4','number']])
    h.c.breakdownSetField(input({breakField:field},value,type),false);
  assert.equal(h.c.breakdownSave(),true);
  const created=itemRow(h.c.app.partDraft.quote,itemId).materials.find(value=>value.id===newId);
  assert.equal(created.category,'Tornillería');assert.equal(created.specification,'Pija ficticia');assert.equal(created.sku,'SKU-FICTICIO-3');
  assert.equal(created.purchaseQuantity,'3');assert.equal(created.purchaseUnit,'Pieza');assert.equal(created.unitPrice,'4');
  h.c.editor();assert.match(variantRow(h.nodes.get('workspace').innerHTML,newId,'material'),/<strong>\$\s*12\.00<\/strong>/);
});

test('wood rows use only pieces and keep their dimensional calculation and existing CNC guard',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const piece=h.c.solidWoodState(itemId).applied[0],before=plain(piece),html=woodCardMarkup(h.nodes.get('workspace').innerHTML,piece.id);
  for(const field of ['woodKind','width','length','lengthUnit','thickness','finishFaces','jointed','wasteRate'])assert.ok(html.includes('data-row-field="'+field+'"'),field+' is visible in the piece row');
  assert.match(html,/<select[^>]*aria-label="Unidad de la pieza"><option value="Pieza" selected>Pieza<\/option><\/select>/);
  assert.match(html,/data-row-field="lengthUnit"[^>]*aria-label="Unidad de medidas · cm"/);
  assert.match(html,/Calculado con medidas/);assert.match(html,/Precio del material/);
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:piece.id,rowField:'name'},'');
  const active=woodCardMarkup(h.nodes.get('workspace').innerHTML,piece.id);
  const grid=active.slice(active.indexOf('<div class="rv-grid rv-wood-grid">'),active.indexOf('<p class="error" data-solid-error'));
  const fields=['name','quantityPerProduct','woodKind','thickness','width','length','lengthUnit','finishFaces','jointed','wasteRate','adjustment.price','adjustment.reason','cnc.decision'];
  const positions=fields.map(field=>grid.indexOf('data-solid-field="'+field+'"'));
  assert.ok(positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])),'All wood inputs follow the requested order in one grid');
  assert.doesNotMatch(active,/data-solid-action="apply-cnc"|data-solid-field="cnc\.(length|unit|repetitions)"/);
  assert.match(active,/data-solid-action="group-price"/);assert.match(active,/data-solid-action="reset"/);
  assert.doesNotMatch(active,/Opciones: caras, CNC y entablerado|class="break-editor tech-entry/);
  assert.match(active,/<select[^>]*aria-label="Unidad de la pieza"><option value="Pieza" selected>Pieza<\/option><\/select>/);
  assert.equal((active.match(/<option value="Pieza" selected>Pieza<\/option>/g)||[]).length,1);
  await h.event('click',{breakAction:'cancel-editor'});
  assert.deepEqual(plain(h.c.solidWoodState(itemId).applied[0]),before);
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked');
});

test('empty optional subtotals show zero without converting incomplete captures into zero',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const before=JSON.stringify(h.c.app.q);
  const subtotal=()=>h.nodes.get('workspace').innerHTML.match(new RegExp('<output data-maquila-summary="'+itemId+'"[\\s\\S]*?<\\/output>'))?.[0];
  assert.match(subtotal(),/<strong>\$\s*0\.00<\/strong>/);
  assert.match(h.nodes.get('workspace').innerHTML,/Sin maquilas\./);
  await h.event('click',{breakAction:'add-detail-process',section:'maquilas'});
  assert.match(subtotal(),/<strong>Pendiente<\/strong>/,'An incomplete added maquila stays pending');
  for(const [field,value,type] of [['category','Corte láser madera','select-one'],['specification','Servicio ficticio','text'],['unit','Servicio','select-one'],['quantity','2','number'],['detail.unitPrice','3.50','number']])
    h.c.breakdownSetField(input({breakField:field},value,type),false);
  h.c.editor();assert.match(subtotal(),/<strong>\$\s*7\.00<\/strong>/);
  await h.event('click',{breakAction:'cancel-editor'});
  assert.match(subtotal(),/<strong>\$\s*0\.00<\/strong>/);
  assert.equal(JSON.stringify(h.c.app.q),before,'The empty subtotal is a presentation and does not create a cost or save a quote');
});

test('family headers show captured amounts, empty sections and incomplete drafts without confirming costs',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const header=key=>h.nodes.get('workspace').innerHTML.match(new RegExp('<output data-rv-family-total="'+key+'"[^>]*>([^<]*)<\\/output>'))?.[1];
  assert.match(header('supplies'),/\$\s*22\.00/,'4 × $5 plus 4 × $0.50');
  assert.match(header('maquilas'),/^\$\s*0\.00$/);
  assert.match(header('boards'),/^\$\s*0\.00$/);
  assert.match(header('metal'),/^\$\s*0\.00$/);
  assert.match(header('wood'),/\$.* · parcial/,'Unpriced wood processes remain explicitly partial');
  const quoteBefore=JSON.stringify(h.c.app.q);
  await h.event('click',{breakAction:'add-detail-process',section:'maquilas'});
  assert.equal(header('maquilas'),'Pendiente');
  for(const [field,value,type] of [['category','Corte láser madera','select-one'],['specification','Servicio ficticio','text'],['unit','Servicio','select-one'],['quantity','2','number'],['detail.unitPrice','3.50','number']])
    h.c.breakdownSetField(input({breakField:field},value,type),false);
  h.c.editor();assert.match(header('maquilas'),/\$\s*7\.00 · por validar/);
  await h.event('click',{breakAction:'cancel-editor'});
  assert.match(header('maquilas'),/^\$\s*0\.00$/);
  assert.equal(JSON.stringify(h.c.app.q),quoteBefore,'Header totals do not apply or save the draft');
});

test('family header groups shared purchases once and reports cross-family or conflicting purchases as pending',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const row=itemRow(h.c.app.partDraft.quote,itemId),[first,second]=row.materials;
  const header=key=>h.nodes.get('workspace').innerHTML.match(new RegExp('<output data-rv-family-total="'+key+'"[^>]*>([^<]*)<\\/output>'))?.[1];
  first.purchaseGroup='SYN-SHARED';
  row.materials[1]={...plain(first),id:second.id};
  h.c.editor();assert.match(header('supplies'),/\$\s*20\.00/,'The same declared purchase appears once');
  row.materials[1].unitPrice='8';
  h.c.editor();assert.equal(header('supplies'),'Pendiente','Conflicting terms never produce a false subtotal');
  row.materials[1].unitPrice=first.unitPrice;row.materials[1].section='board-other';
  h.c.editor();assert.equal(header('supplies'),'Pendiente');assert.equal(header('boards'),'Pendiente','A shared purchase spanning families is not double counted');
});

test('family header follows live edits and marks an invalid draft as partial',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const first=itemRow(h.c.app.partDraft.quote,itemId).materials[0];
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:first.id,rowField:'unitPrice'},'');
  const output={dataset:{rvArticle:itemId,rvFamilyTotal:'supplies'},textContent:'',title:''};
  h.host.querySelectorAll=selector=>selector==='[data-rv-family-total]'?[output]:[];
  h.c.breakdownSetField(input({breakField:'unitPrice'},'6','number'),false);
  assert.match(output.textContent,/\$\s*26\.00/,'4 × $6 plus the unchanged $2 line');
  const invalid=input({breakField:'unitPrice'},'invalid','number');invalid.validity.badInput=true;
  h.c.breakdownSetField(invalid,false);
  assert.match(output.textContent,/\$\s*2\.00 · parcial/,'The previous valid price is not retained after invalid input');
  assert.match(output.title,/pendiente/i);
});

test('wood family total refreshes for dimension edits and does not retain a removed dimension',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const piece=h.c.solidWoodState(itemId).applied[0];
  await h.event('click',{solidAction:'edit',articleId:itemId,id:piece.id});
  const output={dataset:{rvArticle:itemId,rvFamilyTotal:'wood'},textContent:'',title:''};
  h.host.querySelectorAll=selector=>selector==='[data-rv-family-total]'?[output]:[];
  await h.event('input',{solidField:'width'},'80');const changed=output.textContent;
  assert.match(changed,/\$.* · parcial/);
  await h.event('input',{solidField:'width'},'');
  assert.equal(output.textContent,'Pendiente','Missing width cannot retain the previous preview');
});

test('family totals exclude an included process and never double count historical wood',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');
  const row=itemRow(h.c.app.partDraft.quote,itemId),header=key=>h.nodes.get('workspace').innerHTML.match(new RegExp('<output data-rv-family-total="'+key+'"[^>]*>([^<]*)<\\/output>'))?.[1];
  await h.event('click',{breakAction:'add-detail-process',section:'maquilas'});
  const process=plain(h.c.app.breakdownEditor.value);
  process.category='Corte láser madera';process.name='Servicio ficticio';process.source.kind='included';process.source.reviewed=true;process.source.includedInMaterialId=row.materials[0].id;
  row.processes.push(process);await h.event('click',{breakAction:'cancel-editor'});
  h.c.editor();assert.match(header('maquilas'),/^\$\s*0\.00 · incluido$/);
  assert.match(header('supplies'),/\$\s*22\.00/,'The included service does not alter the linked material total');
  process.source.includedInMaterialId='SYN-MISSING';row.processes[0]=process;
  h.c.editor();assert.equal(header('maquilas'),'Sin evaluar','An invalid relationship cannot be presented as zero');
  process.source.includedInMaterialId=row.materials[0].id;row.processes[0]=process;
  const groupId='SYN-LEGACY-WOOD';
  row.groups.push({id:groupId,type:'wood',woodKind:'',unit:'pieza',lengthUnit:'cm',woodWasteRate:'',specification:''});
  row.materials.push({...plain(row.materials[0]),id:'SYN-WOOD',groupId,type:'wood',section:'wood',name:'Pieza histórica ficticia'});
  h.c.editor();assert.equal(header('wood'),'Pendiente','F and historical wood are not added when their overlap is unknown');
});

test('empty wood shows zero only when there are no local or historical pieces',async()=>{
  const h=harness();h.open();const itemId=h.c.app.q.items[0].id;
  assert.equal(h.c.openPartEditor(itemId),true);h.c.editor();
  const total=()=>h.nodes.get('workspace').innerHTML.match(/<output class="solid-wood-f-total">[\s\S]*?<\/output>/)?.[0];
  assert.match(total(),/<span>\$\s*0\.00 <small>Sin piezas capturadas<\/small><\/span>/);
  await h.event('click',{solidAction:'new',articleId:itemId});
  assert.match(total(),/Pendiente/,'An unfilled wood draft remains pending');
  await h.event('click',{breakAction:'cancel-editor'});
  assert.match(total(),/<span>\$\s*0\.00 <small>Sin piezas capturadas<\/small><\/span>/);
  const row=itemRow(h.c.app.partDraft.quote,itemId),groupId='SYN-LEGACY-WOOD',id='SYN-LEGACY-PIECE';
  row.groups.push({id:groupId,type:'wood',woodKind:'',unit:'pieza',lengthUnit:'cm',woodWasteRate:'',specification:''});
  row.materials.push({...plain(row.materials[0]),id,groupId,type:'wood',section:'wood',name:'Pieza histórica ficticia'});
  h.c.editor();assert.match(total(),/Pendiente/,'Historical wood cannot be represented as an empty zero');
});

test('inline wood price adjustment retains its reason, compatible-piece confirmation and individual waste',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');
  const before=plain(h.c.solidWoodState(itemId).applied),first=before[0],snapshot=JSON.stringify(h.c.app.q);
  await h.event('click',{solidAction:'edit',articleId:itemId,id:first.id});
  await h.event('input',{solidField:'adjustment.price'},'90');
  await h.event('input',{solidField:'adjustment.reason'},'Ajuste ficticio');
  h.sandbox.confirm=()=>true;
  await h.event('click',{solidAction:'group-price',articleId:itemId,id:first.id});
  const ids=plain(h.c.app.breakdownEditor.pendingGroupIds);
  assert.ok(ids.includes(first.id),'The confirmation identifies the affected pieces');
  await h.event('click',{breakAction:'save-editor'});
  const after=plain(h.c.solidWoodEntries(itemId));
  for(const original of before){
    const piece=after.find(value=>value.id===original.id);
    assert.equal(piece.wasteRate,original.wasteRate,'Price adjustment never copies the waste');
    if(ids.includes(original.id)){assert.equal(piece.adjustment.price,'90');assert.equal(piece.adjustment.reason,'Ajuste ficticio');}
    else assert.deepEqual(piece.adjustment,original.adjustment);
  }
  assert.equal(JSON.stringify(h.c.app.q),snapshot,'Applying wood in the editor does not save the quote');
});

test('maquila row retains service units, quantity scope, calculation and cancellation',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','2','number');
  const before=JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).processes);
  await h.event('click',{breakAction:'add-detail-process',section:'maquilas'});
  assert.equal(h.c.app.breakdownEditor.value.section,'maquilas');
  for(const [field,value,type] of [['category','Corte','select-one'],['specification','Servicio ficticio','text'],['unit','Servicio','select-one'],['quantity','3','number'],['quantityScope','product','select-one'],['detail.unitPrice','12.50','number']])
    h.c.breakdownSetField(input({breakField:field},value,type),false);
  h.c.editor();
  const html=h.nodes.get('workspace').innerHTML;
  assert.match(html,/<select[^>]*data-break-field="category"/);
  assert.match(html,/<select[^>]*data-break-field="unit"/);
  assert.match(html,/Cada producto: el subtotal incluye la cantidad de productos/);
  assert.match(html,/<strong>\$\s*75\.00<\/strong>/,'Two products × three services × $12.50, scaled once');
  const draft=h.c.app.breakdownEditor,materialId=itemRow(h.c.app.partDraft.quote,itemId).materials[0].id;
  draft.value.source.kind='included';draft.value.source.reviewed=true;draft.value.source.includedInMaterialId='missing';
  h.c.editor();assert.ok(h.nodes.get('workspace').innerHTML.includes('<strong>Inclusión pendiente</strong>'));
  draft.value.source.includedInMaterialId=materialId;
  h.c.editor();assert.ok(h.nodes.get('workspace').innerHTML.includes('<strong>Incluido</strong>'));
  draft.value.source.kind='tariff';
  h.c.editor();assert.ok(h.nodes.get('workspace').innerHTML.includes('<strong>Pendiente</strong>'),'An unprojected tariff does not reuse the manual line amount');
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).processes),before);
});

test('new board, metal and other material rows retain their real unit selectors and can be cancelled',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const before=JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).materials);
  // The later annotation removes the additional wood-other capture fold;
  // its stored data contract is preserved, but it is no longer a UI entry point.
  for(const section of ['boards','metal-sheet','metal-tube','board-other','metal-other']){
    await h.event('click',{breakAction:'add-detail-material',section});
    assert.equal(h.c.app.breakdownEditor.value.section,section);
    const html=h.nodes.get('workspace').innerHTML;
    assert.match(html,/class="rv-edit(?: rv-board-edit)?"/,section+' renders the row editor');
    assert.ok(/<select[^>]*data-break-field="purchaseUnit"/.test(html),section+' renders its unit selector');
    assert.match(html,/data-break-field="purchaseQuantity"/);assert.match(html,/data-break-field="unitPrice"/);
    await h.event('click',{breakAction:'cancel-editor'});
  }
  assert.equal(JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).materials),before);
});

test('an existing board row and its group retain separate editors',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const row=itemRow(h.c.app.partDraft.quote,itemId),groupId='SYN-GROUP-BOARD',id='SYN-BOARD-ONE';
  row.groups.push({id:groupId,type:'board',woodKind:'',unit:'pieza',lengthUnit:'cm',woodWasteRate:'',specification:'Tablero ficticio'});
  row.materials.push({...plain(row.materials[0]),id,groupId,type:'board',section:'boards',name:'Cubierta de tablero',specification:'',quantity:'1',length:'80',width:'40',lengthUnit:'cm',detail:{}});
  h.c.editor();
  assert.match(variantRow(h.nodes.get('workspace').innerHTML,id,'material'),/Cubierta de tablero/);
  await h.event('click',{breakAction:'edit-component',id});
  const html=variantRow(h.nodes.get('workspace').innerHTML,id,'material');
  assert.match(html,/data-row-editor="SYN-BOARD-ONE"/);assert.match(html,/data-break-field="length"/);
  await h.event('click',{breakAction:'cancel-editor'});
  await h.event('click',{breakAction:'edit-group',id:groupId,section:'boards'});
  assert.match(h.nodes.get('workspace').innerHTML,/aria-label="Editor de grupo"/);
  await h.event('click',{breakAction:'cancel-editor'});
});

test('each existing wood component expands in its own row without changing the order',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const components=plain(h.c.solidWoodState(itemId).applied),ids=components.map(row=>row.id);
  assert.equal(ids.length,3);
  const calls=[],originalQuery=h.host.querySelector.bind(h.host);
  h.host.querySelector=selector=>selector.startsWith('[data-solid-action="edit"][data-article-id=')?{focus:options=>calls.push(plain(options))}:originalQuery(selector);
  for(const id of ids){
    await h.event('click',{solidAction:'edit',articleId:itemId,id});
    let html=h.nodes.get('workspace').innerHTML;
    assert.deepEqual(woodRowOrder(html),ids,'Opening a row never moves any component');
    const active=woodCardMarkup(html,id);
    assert.match(active,/data-break-action="wood-confirm"/);
    assert.doesNotMatch(active,/data-solid-action="edit"/,'Editing hides the pencil');
    assert.ok(active.includes('id="wood-piece-editor-'+id+'" class="fab-inline-editor wood-piece-inline-editor"'));
    assert.match(active,/data-solid-field="name"/,'The editor is inside its selected row');
    for(const other of ids.filter(row=>row!==id)){
      const card=woodCardMarkup(html,other);
      assert.match(card,/aria-expanded="false"/);assert.doesNotMatch(card,/data-solid-field="name"/);
      assert.ok(card.includes('id="wood-piece-editor-'+other+'" hidden'));
    }
    assert.ok(active.includes('role="region"'),'The editor retains its labeled region');
    await h.event('click',{solidAction:'edit',articleId:itemId,id});
    assert.equal(h.c.app.breakdownEditor,null,'An unchanged row closes from its toggle');
    html=h.nodes.get('workspace').innerHTML;
    assert.deepEqual(woodRowOrder(html),ids);assert.match(woodCardMarkup(html,id),/aria-expanded="false"/);
    assert.deepEqual(calls.at(-1),{preventScroll:true});
  }
  await h.event('click',{solidAction:'edit',articleId:itemId,id:ids[0]});
  await h.event('input',{solidField:'width'},'61');
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(h.c.app.breakdownEditor,null);
  assert.equal(h.c.solidWoodEntries(itemId)[0].width,components[0].width);
  assert.deepEqual(calls.at(-1),{preventScroll:true},'Cancel returns focus to the same row');
  await h.event('click',{solidAction:'edit',articleId:itemId,id:ids[0]});
  await h.event('input',{solidField:'width'},'62');
  await h.event('click',{breakAction:'save-editor'});
  assert.equal(h.c.app.breakdownEditor,null);
  assert.equal(h.c.solidWoodEntries(itemId)[0].width,'62');
  assert.deepEqual(calls.at(-1),{preventScroll:true},'Apply returns focus to the same row');
});

test('wood row names remain escaped in accordion labels and content',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const id=h.c.solidWoodState(itemId).applied[0].id,name='Pieza"><img src=x onerror="alert(1)">';
  await h.event('click',{solidAction:'edit',articleId:itemId,id});
  await h.event('input',{solidField:'name'},name);
  await h.event('click',{breakAction:'save-editor'});
  await h.event('click',{solidAction:'edit',articleId:itemId,id});
  const card=woodCardMarkup(h.nodes.get('workspace').innerHTML,id);
  assert.doesNotMatch(card,/<img\b|<script\b/i);
  assert.doesNotMatch(card,/data-solid-action="edit"/,'Editing hides the pencil');
  assert.match(card,/aria-label="Edición de Pieza&quot;&gt;&lt;img/);
  assert.equal(h.c.app.breakdownEditor.solidWoodF.name,name);
});

// User decision, 5 Nov, supersedes automatic confirmation of wood pieces.
test('switching wood rows requires confirming or discarding the current capture',async()=>{
  const h=harness();h.open();await h.Q.save('DEMO-RECIPE');const saved=plain(h.Q.snapshot('DEMO-RECIPE'));
  const {itemId}=await h.select('SYN-NUBE-C');
  const before=plain(h.c.solidWoodState(itemId).applied),[first,second]=before;
  await h.event('click',{solidAction:'edit',articleId:itemId,id:first.id});
  await h.event('input',{solidField:'width'},'61');
  await h.event('click',{solidAction:'edit',articleId:itemId,id:second.id});
  assert.equal(h.c.app.breakdownEditor.solidWoodF.id,first.id);
  assert.ok(h.c.app.breakdownContinuation);
  await h.event('click',{breakAction:'save-continue'});
  assert.equal(h.c.app.breakdownEditor.solidWoodF.id,second.id);
  assert.equal(h.c.solidWoodEntries(itemId).find(row=>row.id===first.id).width,'61');
  assert.equal(h.c.app.breakdownContinuation,null);
  assert.deepEqual(plain(h.Q.snapshot('DEMO-RECIPE')),saved,'Automatic session capture never replaces a confirmed snapshot');
  await h.event('input',{solidField:'width'},'invalid');
  await h.event('click',{solidAction:'edit',articleId:itemId,id:first.id});
  assert.equal(h.c.app.breakdownEditor.solidWoodF.id,second.id,'Invalid capture is not discarded or moved to another piece');
  assert.equal(h.c.app.breakdownEditor.solidWoodF.width,'invalid');
  assert.equal(h.c.solidWoodEntries(itemId).find(row=>row.id===second.id).width,before[1].width,'Invalid text is never committed to the stored piece');
  assert.equal(h.c.solidWoodState(itemId).applied.find(row=>row.id===second.id).width,before[1].width);
  await h.event('click',{breakAction:'keep-editing'});
  await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.app.rowAutosave.state,'invalid');
  await h.event('click',{breakAction:'wood-discard'});
  assert.equal(h.c.solidWoodEntries(itemId).find(row=>row.id===second.id).width,before[1].width);
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked','Unpriced, unpersistable wood still blocks a confirmed save');
});

test('a newly added wood piece retains its separate local editor and can be cancelled',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const ids=plain(h.c.solidWoodState(itemId).applied).map(row=>row.id);
  await h.event('click',{solidAction:'new',articleId:itemId,id:''});
  const html=h.nodes.get('workspace').innerHTML;
  assert.deepEqual(woodRowOrder(html),ids);
  for(const id of ids)assert.doesNotMatch(woodCardMarkup(html,id),/data-solid-field="name"/);
  assert.equal((html.match(/data-solid-field="name"/g)||[]).length,1);
  assert.equal(h.c.app.breakdownEditor.isNew,true);
  await h.event('click',{breakAction:'cancel-editor'});
  assert.equal(h.c.app.breakdownEditor,null);
  assert.deepEqual(plain(h.c.solidWoodState(itemId).applied).map(row=>row.id),ids);
});

test('blank dimensions remain blank through applying and saving; dependent geometry stays pending',async()=>{
  const h=harness();h.open();const id=h.c.app.q.items[0].id;
  assert.equal(h.c.openPartEditor(id),true);
  const original=plain(h.c.app.q.items[0].specs);
  editPart(h,id,'specs.1.value','','number');
  assert.equal(h.c.app.q.items[0].specs[1].value,original[1].value,'An unapplied field does not modify the quote');
  assert.equal(h.c.partApply(),true);
  const item=h.c.app.q.items[0],missing=item.specs[1];
  assert.equal(missing.value,'');assert.equal(missing.na,false);assert.equal(missing.reason,'');
  assert.deepEqual(plain(item.specs.filter((_,i)=>i!==1)),original.filter((_,i)=>i!==1));
  const issues=h.c.D.evaluate(h.c.app.q,{preview:true}).issues;
  assert.ok(!issues.some(issue=>issue.field==='items.0.specs.1.value'||issue.field==='items.0.specs.1.unit'),'An empty optional field needs no checkbox or unit');
  const geometry=h.sandbox.QuoteManufacturing_.dimensions(item,{type:'board',measureSource:'part'});
  assert.equal(geometry.pending,true,'A component requiring both inherited dimensions must not treat absence as zero');
  assert.equal(geometry.width,undefined);
  const dependentQuote=plain(h.c.app.q),row=dependentQuote.manufacturing.items[0],material=row.materials[0];
  row.groups[0].type='board';Object.assign(material,{type:'board',section:'boards',measureSource:'part',thickness:'1'});
  const dependentResult=h.sandbox.QuoteManufacturing_.evaluate(dependentQuote,{date:'2026-10-14'});
  assert.ok(dependentResult.issues.some(issue=>issue.field==='manufacturing.items.materials'&&/medidas/.test(issue.message)));
  assert.equal(dependentResult.complete,false,'A dependent component and its cost remain incomplete');
  assert.equal(dependentResult.items[0].measurements[0].areaM2,null,'Missing width never creates a zero area');
  const quoteForPdf=h.c.D.commercial(h.c.app.q,{folio:'DEMO',number:1,state:'Borrador',date:'2026-10-14'});
  const offer=h.sandbox.QuotePdf.render(quoteForPdf);
  assert.match(offer,/Largo: 90 cm/);assert.match(offer,/Alto: 60 cm/);
  assert.doesNotMatch(offer,/Ancho: Pendiente|Ancho: 0/,'A blank optional measure is not presented as pending or zero');
  const result=await h.Q.save('DEMO-RECIPE');assert.equal(result.state,'success');
  assert.equal(h.Q.snapshot('DEMO-RECIPE').quote.items[0].specs[1].value,'');
  assert.equal(h.Q.snapshot('DEMO-RECIPE').quote.items[0].specs[1].na,false);

  const noUnit=plain(h.c.app.q);noUnit.items[0].specs[0].unit='';
  assert.ok(h.c.D.evaluate(noUnit,{preview:true}).issues.some(issue=>issue.field==='items.0.specs.0.unit'),'A specified measurement still requires its unit');
  h.c.openPartEditor(id);editPart(h,id,'specs.0.value','0','number');
  assert.equal(h.c.partApply(),false,'Zero remains an invalid positive measurement');
  assert.equal(h.c.app.q.items[0].specs[0].value,'90');
  assert.equal(h.Q.snapshot('DEMO-RECIPE').quote.items[0].specs[0].value,'90','Invalid input does not replace the confirmed snapshot');
});

test('legacy no-apply details survive viewing, cancellation and an explicit dimension edit',()=>{
  const h=harness();h.open();const id=h.c.app.q.items[0].id;
  Object.assign(h.c.app.q.items[0].specs[1],{na:true,value:'',unit:'mm',reason:'Motivo histórico de prueba'});
  const legacy=plain(h.c.app.q.items[0].specs[1]);
  h.c.openPartEditor(id);h.c.editor();
  const html=h.nodes.get('workspace').innerHTML;
  assert.match(html,/data-path="items\.0\.specs\.1\.value"/);
  assert.doesNotMatch(html,/data-path="items\.0\.specs\.1\.na"|Ancho · Motivo/);
  assert.deepEqual(plain(h.c.app.q.items[0].specs[1]),legacy,'Rendering does not rewrite historical fields');
  editPart(h,id,'specs.1.value','42','number');
  let draft=h.c.app.partDraft.quote.items[0].specs[1];
  assert.equal(draft.na,false);assert.equal(draft.value,'42');assert.equal(draft.unit,'cm');
  assert.equal(draft.reason,legacy.reason,'The original explanation is not silently discarded');
  assert.deepEqual(plain(h.c.app.q.items[0].specs[1]),legacy);
  h.c.partDiscard();assert.deepEqual(plain(h.c.app.q.items[0].specs[1]),legacy);
  h.c.openPartEditor(id);editPart(h,id,'specs.1.value','42','number');assert.equal(h.c.partApply(),true);
  draft=h.c.app.q.items[0].specs[1];
  assert.equal(draft.na,false);assert.equal(draft.value,'42');assert.equal(draft.unit,'cm');assert.equal(draft.reason,legacy.reason);
});

test('a shared unit can be selected before filling legacy blank measurements',()=>{
  const h=harness();h.open();const id=h.c.app.q.items[0].id;
  for(const spec of h.c.app.q.items[0].specs)Object.assign(spec,{na:true,value:'',unit:'',reason:'Referencia histórica'});
  h.c.openPartEditor(id);
  const el=input({measureUnit:'0'},'mm','select-one');el.tagName='SELECT';el.hasAttribute=name=>name==='data-measure-unit';
  assert.equal(h.c.partInput(el,false),true);
  assert.deepEqual(plain(h.c.app.partDraft.quote.items[0].specs.map(spec=>spec.unit)),['mm','mm','mm']);
  h.c.editor();assert.match(h.nodes.get('workspace').innerHTML,/<option value="mm"\s+selected>mm<\/option>/);
  editPart(h,id,'specs.0.value','420','number');
  const first=h.c.app.partDraft.quote.items[0].specs[0];
  assert.equal(first.value,'420');assert.equal(first.unit,'mm');assert.equal(first.na,false);
  assert.equal(h.c.app.partDraft.quote.items[0].specs[1].na,true);
  assert.equal(h.c.app.q.items[0].specs[0].unit,'','The original quote stays unchanged until Apply');
});

test('the native phone editor uses the offline countries and preserves invalid drafts across expedientes',async()=>{
  const h=harness();
  h.open('DEMO-PHONE');h.Q.showStep(0);
  const html=h.nodes.get('workspace').innerHTML;
  const select=html.match(/<select id="contact-phone-country"[\s\S]*?<\/select>/)?.[0];
  assert.ok(select,'The actual native form exposes a country selector');
  assert.equal((select.match(/<option value="[A-Z]{2}"/g)||[]).length,245);
  assert.match(select,/<option value="MX" selected>México \(\+52\)<\/option>/);
  assert.doesNotMatch(html,/¿Tiene extensión\?|data-phone-part="extension/);
  assert.match(html,/Continuar sin guardar →/);
  assert.equal(h.c.app.q.contactPhone,'','A default calling code alone is never stored');

  await h.event('change',{phonePart:'country'},'CA');
  assert.equal(h.c.app.phoneDraft.country,'+1');
  assert.equal(h.c.app.phoneDraft.choice,'CA');
  assert.equal(h.c.app.q.contactPhone,'');
  h.Q.create('DEMO-OTHER-PHONE','complete',request(),{scopePreset:'fabrication-packaging'});
  assert.equal(h.Q.open('DEMO-OTHER-PHONE'),true);h.Q.showStep(0);
  assert.equal(h.c.app.phoneDraft.choice,'MX','Country choices are isolated by expediente');
  assert.equal(h.c.app.q.contactPhone,'');
  assert.equal(h.Q.open('DEMO-PHONE'),true);h.Q.showStep(0);
  assert.equal(h.c.app.phoneDraft.choice,'CA','A chosen country survives navigation even before a number is entered');
  assert.equal(h.c.app.q.contactPhone,'');
  await h.event('input',{phonePart:'number'},'416 555 0100');
  assert.equal(h.c.app.q.contactPhone,'+1 416 555 0100');
  await h.event('change',{phonePart:'country'},'US');
  assert.equal(h.c.app.q.contactPhone,'+1 416 555 0100','Changing the country with a shared code does not rewrite the phone');
  await h.event('change',{phonePart:'country'},'CA');
  await h.event('input',{phonePart:'number'},'416 ext. 09');
  assert.equal(h.c.app.q.contactPhone,'+1 416 555 0100','Invalid input cannot overwrite the previous valid number');
  assert.equal((await h.Q.save('DEMO-PHONE')).state,'blocked');
  assert.equal(h.Q.open('DEMO-OTHER-PHONE'),true);
  assert.equal(h.Q.open('DEMO-PHONE'),true);h.Q.showStep(0);
  assert.equal(h.c.app.phoneDraft.number,'416 ext. 09','The invalid capture remains visible for correction');
  assert.ok(h.c.app.inputErrors.size);
  await h.event('input',{phonePart:'number'},'416 555 0101');
  assert.equal(h.c.app.q.contactPhone,'+1 416 555 0101');
  assert.equal(h.c.app.inputErrors.size,0);
  await h.event('input',{phonePart:'number'},'1'.repeat(61));
  assert.equal(h.c.app.q.contactPhone,'+1 416 555 0101');
  assert.equal((await h.Q.save('DEMO-PHONE')).state,'blocked','A phone over the 60-character contract cannot save');
  await h.event('input',{phonePart:'number'},'416 555 0101');
  assert.equal((await h.Q.save('DEMO-PHONE')).state,'success');
});

test('shared and unknown historical calling codes do not invent a country',()=>{
  const h=harness();
  h.Q.create('DEMO-SHARED','complete',{...request(),contactPhone:'+1 242 555 0101'});
  h.Q.open('DEMO-SHARED');h.Q.showStep(0);
  assert.equal(h.c.app.phoneDraft.choice,'shared:+1');
  assert.equal(h.c.app.q.contactPhone,'+1 242 555 0101');
  h.Q.create('DEMO-UNLISTED','complete',{...request(),contactPhone:'+999 123 4567'});
  h.Q.open('DEMO-UNLISTED');h.Q.showStep(0);
  assert.equal(h.c.app.phoneDraft.choice,'other');
  assert.equal(h.c.app.phoneDraft.country,'+999');
  assert.equal(h.c.app.q.contactPhone,'+999 123 4567');
});

test('an ambiguous historical extension stays visible and blocks saving until corrected',async()=>{
  const h=harness(),original='+52 55 0000 0018 ext. varios';
  h.Q.create('DEMO-PHONE-REVIEW','complete',{...request(),contactPhone:original});
  h.Q.open('DEMO-PHONE-REVIEW');h.Q.showStep(0);
  assert.equal(h.c.app.q.contactPhone,original,'The main number is not guessed or truncated');
  assert.match(h.nodes.get('workspace').innerHTML,/Revisa el número original para retirar la extensión/);
  assert.equal((await h.Q.save('DEMO-PHONE-REVIEW')).state,'blocked');
  assert.equal(h.Q.snapshot('DEMO-PHONE-REVIEW'),null);
  await h.event('click',{action:'edit-phone'},'');
  await h.event('change',{phonePart:'country'},'MX');
  await h.event('input',{phonePart:'number'},'55 0000 0018');
  assert.equal(h.c.app.q.contactPhone,'+52 55 0000 0018');
  assert.equal((await h.Q.save('DEMO-PHONE-REVIEW')).state,'success');
});

test('synthetic historical phone copies remove explicit extensions and preserve unrelated snapshots',()=>{
  const {sandbox}=harness(),phone=sandbox.DemoPhone;
  const snapshot={quote:{id:'Q1',revision:7,contactPhone:'+52 55 0000 0018 ext. 09'},request:{contactPhone:'+1 242 555 0101 x123'},summary:{priceCents:123456}};
  const version={version:1,sentAt:'2026-10-01',snapshot};
  const source={id:'DEMO-HISTORY',request:{contactPhone:'+34 123 456 789 extensión 004'},sent:version,versions:[version],project:{baseline:structuredClone(snapshot)}};
  const clean=phone.cleanRecord(source);
  assert.equal(clean.request.contactPhone,'+34 123 456 789');
  assert.equal(clean.sent.snapshot.quote.contactPhone,'+52 55 0000 0018');
  assert.equal(clean.sent.snapshot.request.contactPhone,'+1 242 555 0101');
  assert.equal(clean.project.baseline.quote.contactPhone,'+52 55 0000 0018');
  assert.equal(clean.sent,clean.versions[0],'Version aliases remain linked for later responses');
  assert.equal(clean.sent.snapshot.summary.priceCents,123456);
  assert.equal(clean.sent.snapshot.quote.revision,7);
  assert.equal(source.sent.snapshot.quote.contactPhone,'+52 55 0000 0018 ext. 09','Source fixture is not changed');
  assert.equal(phone.analyze('+52 55 0000 0018 ext. varios').ambiguous,true);
  assert.equal(phone.analyze('+52 55 0000 0018 #09').ambiguous,true,'A bare # may be a service code and cannot be assumed to be an extension');
  assert.equal(phone.analyze('+52 55 0000 0018 #09').value,'+52 55 0000 0018 #09');
  assert.equal(phone.recordNeedsAttention({request:{contactPhone:'+52 55 0000 0018 ext. varios'},versions:[]}),true);
});

test('five D91 commercial variants have exact labels, materials, dimensions and unconfirmed reference recipes',()=>{
  const R=pureCatalog();
  assert.equal(R.products.length,3);
  const d91Products=R.products.filter(product=>product.id!=='SYN-BOLONIA');
  assert.deepEqual(plain(d91Products.map(product=>product.name).sort()),['Cubierta redonda de madera','Mesa Florencia']);
  const variants=d91Products.flatMap(product=>product.variants);
  assert.deepEqual(plain(variants.map(variant=>variant.id).sort()),['SYN-NUBE-C','SYN-NUBE-O','SYN-PRISMA-C','SYN-PRISMA-G','SYN-PRISMA-O']);
  const expected={
    'SYN-NUBE-C':{label:'Mesa Florencia · Tzalam',material:'Tzalam',size:[60,60,50]},
    'SYN-NUBE-O':{label:'Mesa Florencia · Encino rojo',material:'Encino rojo',size:[60,60,50]},
    'SYN-PRISMA-C':{label:'Cubierta de madera · Tzalam',material:'Tzalam',size:[76,76,3.2]},
    'SYN-PRISMA-O':{label:'Cubierta de madera · Encino blanco',material:'Encino blanco',size:[76,76,3.2]},
    'SYN-PRISMA-G':{label:'Cubierta de madera · Encino rojo',material:'Encino rojo',size:[76,76,3.2]},
  };
  assert.doesNotMatch(JSON.stringify(R.products),/Mesa Nube|Cubierta Prisma/,'Former fictional product names must not remain visible in the catalog');
  const imageIds=[];
  for(const product of d91Products)for(const variant of product.variants){
    const identity=expected[variant.id];
    assert.equal(R.variant(product.id,variant.id).id,variant.id);
    assert.equal(variant.articleLabel,identity.label);assert.equal(variant.materials,identity.material);
    assert.equal(variant.name,identity.material,'The explicit variant name is its commercial material');
    assert.ok(variant.description.trim());assert.ok(variant.materials.trim());
    assert.deepEqual(['Largo','Ancho','Alto'].map(type=>{
      const spec=variant.specs.find(spec=>spec.type===type);
      assert.ok(spec);assert.match(String(spec.value),/^\d+(?:\.\d+)?$/);assert.equal(spec.unit,'cm');return Number(spec.value);
    }),identity.size);
    assert.equal(variant.recipeId,'R-'+variant.id);
    const recipe=R.recipe(variant.recipeId);
    assert.ok(recipe);assert.equal(recipe.source,'LOCAL_REFERENCE_D91');assert.equal(recipe.accredited,false,'Commercial identity must not accredit recipe economics');
    assert.match(R.images[variant.imageId],/^data:image\//);
    imageIds.push(variant.imageId);
  }
  assert.equal(new Set(imageIds).size,5,'Each explicit variant has its own preview image identity');
  assert.equal(new Set(imageIds.map(id=>R.images[id])).size,5,'The preview is not one shared image silently reused for every variant');
});

test('the package PNG prelude matches all five synthetic assets and uses IA images instead of SVG fallbacks',()=>{
  const manifest=JSON.parse(read('src/assets/catalogo-sintetico/manifest.json'));
  assert.equal(manifest.source,'ImageGen');assert.equal(manifest.assets.length,5);
  const images={};
  for(const asset of manifest.assets){
    assert.equal(asset.file,asset.id+'.png');
    assert.equal(asset.kind,'AI_GENERATED_SYNTHETIC_ILLUSTRATION');
    const bytes=readFileSync(new URL('../src/assets/catalogo-sintetico/'+asset.file,import.meta.url));
    assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),asset.width);assert.equal(bytes.readUInt32BE(20),asset.height);
    images[asset.id]='data:image/png;base64,'+bytes.toString('base64');
  }
  const R=pureCatalog(images);
  assert.deepEqual(plain(Object.keys(R.images).sort()),[...manifest.assets.map(asset=>asset.id),'SYN-BOLONIA-R'].sort());
  assert.equal(R.imageKinds['SYN-BOLONIA-R'],'SVG','Bolonia has a separate labeled geometric illustration');
  for(const asset of manifest.assets){
    assert.equal(R.imageKinds[asset.id],'IA');assert.match(R.images[asset.id],/^data:image\/png;base64,/);
    assert.equal(createHash('sha256').update(Buffer.from(R.images[asset.id].split(',')[1],'base64')).digest('hex'),asset.sha256);
  }
});

test('the authored catalog and recipes are immutable and never infer a variant from its family',()=>{
  const R=pureCatalog();
  assert.equal(R.source,'LOCAL_REFERENCE_D91');
  assert.equal(Object.values(R.recipes).length,6);
  for(const product of R.products){
    assert.equal(Boolean(R.variant(product.id,'')),false);
    assert.equal(Boolean(R.variant(product.id,'UNKNOWN-VARIANT')),false);
    assert.equal(Object.isFrozen(product),true);
    assert.equal(Object.isFrozen(product.variants),true);
    for(const variant of product.variants){
      assert.equal(Object.isFrozen(variant),true);
      assert.equal(Object.isFrozen(R.recipe(variant.recipeId)),true);
    }
  }
  assert.throws(()=>{R.products[0].name='A synthetic mutation must not become a master recipe';});
});

test('D91 materialization preserves per-unit quantities, fresh identities and documentary-only processes',()=>{
  const R=pureCatalog();let sequence=0;const uid=prefix=>prefix+'-TEST-'+(++sequence);
  const one=R.instantiate('R-SYN-NUBE-C',uid,'1'),two=R.instantiate('R-SYN-NUBE-C',uid,'2');
  assert.deepEqual(plain(one.wood.map(row=>[row.quantityPerProduct,row.width,row.length])),[['1','60','60'],['4','50','6'],['2','60','4']]);
  assert.deepEqual(plain(two.wood.map(row=>row.quantityPerProduct)),['1','4','2'],'The commercial quantity must not be baked into per-product wood quantities');
  assert.deepEqual(plain(one.materials.map(row=>row.purchaseQuantity)),['4','4']);
  assert.deepEqual(plain(two.materials.map(row=>row.purchaseQuantity)),['8','8']);
  // Independent D91 reference: 4 × 500 + 4 × 50 = 2200 cents; twice for two articles.
  const hardwareCents=output=>output.materials.reduce((sum,row)=>sum+Number(row.purchaseQuantity)*Math.round(Number(row.unitPrice)*100),0);
  assert.equal(hardwareCents(one),2200);assert.equal(hardwareCents(two),4400);
  assert.deepEqual(plain(one.processes),[],'Documentary process references must not create cost lines, tariffs or duplicate charges');
  assert.ok(one.materials.every(row=>row.taxRate===''&&row.economicReviewed===false),'Historical prices do not confirm tax treatment or economic review');
  const ids=output=>[...output.groups.map(row=>row.id),...output.materials.map(row=>row.id),...output.processes.map(row=>row.id),...output.wood.flatMap(row=>[row.id,row.groupId])];
  const firstIds=ids(one),secondIds=ids(two);
  assert.equal(new Set(firstIds).size,firstIds.length);
  assert.equal(new Set([...firstIds,...secondIds]).size,firstIds.length+secondIds.length);
  assert.deepEqual(plain(one.metadata.woodIds),plain(one.wood.map(row=>row.id)));
  assert.deepEqual(plain(one.metadata.hardware.map(row=>row.id)),plain(one.materials.map(row=>row.id)));
  assert.throws(()=>R.instantiate('UNKNOWN-RECIPE',uid));
  assert.equal(R.scaled('4','2'),'8');
  assert.throws(()=>R.scaled('0.001','0.001'),'Unrepresentable purchase precision must not silently round to zero');
});

test('every D91 variant materializes its own technical recipe without creating charges from documentary references',()=>{
  const R=pureCatalog();let sequence=0;
  for(const variant of R.products.filter(product=>product.id!=='SYN-BOLONIA').flatMap(product=>product.variants)){
    const recipe=R.recipe(variant.recipeId),created=R.instantiate(recipe.id,prefix=>prefix+'-REF-'+(++sequence),'2');
    const table=variant.id.startsWith('SYN-NUBE');
    assert.deepEqual(plain(created.wood.map(row=>row.name)),table?['CUBIERTA','PATAS','TRAVESAÑOS']:['CUBIERTA']);
    assert.deepEqual(plain(created.wood.map(row=>row.quantityPerProduct)),table?['1','4','2']:['1']);
    assert.deepEqual(plain(created.wood.map(row=>[row.width,row.length])),table?[['60','60'],['50','6'],['60','4']]:[['81','81']]);
    assert.ok(created.wood.every(row=>row.wasteRate==='30'&&row.woodKind===variant.materials));
    // The later user correction assigns CNC only to the Florencia top, not to
    // every part nor to the independent Cubierta recipes.
    for(const [index,row] of created.wood.entries())assert.deepEqual(plain(row.cnc),table&&index===0?{decision:'yes',length:'244.00',unit:'cm',repetitions:'1.00'}:{decision:table?'no':'',length:'',unit:'cm',repetitions:''});
    assert.deepEqual(plain(created.processes),[],'Reference labor, consumables and CNC create no operational process charge');
    assert.deepEqual(plain(created.materials.map(row=>row.name)),table?['NIVELADORES ASTRIADO','TUERCA INSERTO']:[]);
    assert.deepEqual(plain(created.materials.map(row=>row.purchaseQuantity)),table?['8','8']:[]);
    const documentary=recipe.documentary;
    assert.equal(documentary.basis,'ONE_ARTICLE');assert.equal(documentary.currency,'UNVERIFIED');assert.equal(documentary.financialConfirmed,false);
    assert.equal(documentary.cncMinutesPerMeter,'5');
    assert.ok(documentary.sections.some(section=>section.rows.some(row=>row.kind==='CNC')));
    assert.equal(recipe.accredited,false);
  }
});

test('Florencia top CNC preload is 244 cm times one, scales once and remains unpriced',async()=>{
  for(const variantId of ['SYN-NUBE-C','SYN-NUBE-O']){
    const h=harness();h.open();const documentaryBefore=plain(h.sandbox.DemoRecipeReference.recipe(variantId));
    const {itemId}=await h.select(variantId);
    for(const [articleQuantity,expectedTotal] of [['1',2.44],['3',7.32]]){
      editPart(h,itemId,'quantity',articleQuantity,'number');assert.equal(h.c.partApply(),true);
      const entries=h.c.solidWoodState(itemId).applied,top=entries[0];
      assert.equal(top.name,'CUBIERTA');
      assert.deepEqual(plain(top.cnc),{decision:'yes',length:'244.00',unit:'cm',repetitions:'1.00'});
      const result=h.c.recipeWoodResult(itemId,top),cnc=result.automaticProcesses.find(process=>process.id==='cnc');
      assert.equal(cnc.unitMl,2.44);assert.equal(cnc.articleMl,expectedTotal);
      assert.equal(cnc.previewCost,null);assert.equal(cnc.articlePreviewCost,null);assert.equal(cnc.financialConfirmed,false);
      assert.equal(cnc.applicability,'APPLIES');assert.equal(cnc.parameterSource,'PARAMETER_PENDING');
      assert.ok(entries.slice(1).every(piece=>piece.cnc.decision==='no'&&piece.cnc.length===''));
      assert.equal(h.c.solidWoodOpen(itemId,top.id),true);
      assert.deepEqual(plain(h.c.app.breakdownEditor.cncStage),plain(top.cnc),'The CNC subeditor must open with the preloaded inputs');
      const markup=h.nodes.get('workspace').innerHTML;
      assert.match(markup,/<select[^>]*data-solid-field="cnc.decision"/);
      assert.doesNotMatch(markup,/data-solid-field="cnc\.(length|repetitions|unit)"/,'The 4 Nov UI hides cutting inputs while preserving the authoritative recipe values');
      h.c.partDiscard();h.c.openPartEditor(itemId);
    }
    assert.deepEqual(plain(h.sandbox.DemoRecipeReference.recipe(variantId)),documentaryBefore,'The historical D91 reference is not rewritten by the local correction');
  }
});

test('D91 wood preview resolves reference prices by thickness and keeps unpriced species or thickness pending',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);
  const original=plain(h.c.solidWoodState(itemId).applied[0]);
  assert.equal(original.name,'CUBIERTA');assert.equal(original.width,'60');assert.equal(original.length,'60');assert.equal(original.wasteRate,'30');
  // Independent D91 oracles: calculate at full precision, then round each unit
  // or article result once. An article total is not twice an already-rounded unit.
  for(const [thickness,price,unit,total] of [['1',78,480.08,960.17],['1.5',80,738.59,1477.18],['2',88,1083.27,2166.53]]){
    const result=h.c.recipeWoodResult(itemId,{...original,thickness});
    assert.equal(result.priceResolution.basePrice,price);assert.equal(result.priceResolution.appliedPrice,price);assert.equal(result.priceResolution.quality,'PREVIEW');
    assert.equal(result.unitCosts.woodCost,unit);assert.equal(result.articleCosts.woodCost,total);
    assert.equal(result.unitCosts.financialConfirmed,false);assert.equal(result.articleCosts.financialConfirmed,false);
  }
  for(const thickness of ['1 1/2','1.500','3/2'])assert.equal(h.c.recipeWoodResult(itemId,{...original,thickness}).priceResolution.appliedPrice,80,'Equivalent thickness '+thickness+' resolves to the same reference');
  for(const thickness of ['3','','invalid','1.6']){
    const result=h.c.recipeWoodResult(itemId,{...original,thickness});
    assert.equal(result.priceResolution.appliedPrice,null);assert.equal(result.priceResolution.quality,'PENDING');assert.equal(result.articleCosts.woodCost,null);
  }
  const adjusted={...original,thickness:'3',adjustment:{articleId:itemId,species:original.woodKind,componentIds:[original.id],price:'90',reason:'Excepción local de prueba',actor:'Account ficticio',unit:h.sandbox.SolidWoodAutoPreview.unit}};
  const estimate=h.c.recipeWoodResult(itemId,adjusted);
  assert.equal(estimate.priceResolution.basePrice,null);assert.equal(estimate.priceResolution.appliedPrice,90);assert.equal(estimate.priceResolution.quality,'ESTIMATED');
  assert.equal(estimate.articleCosts.financialConfirmed,false,'A justified local exception remains an estimate');
  const white=await h.select('SYN-PRISMA-O'),whiteOriginal=plain(h.c.solidWoodState(white.itemId).applied[0]);
  assert.equal(h.c.recipeWoodResult(white.itemId,whiteOriginal).priceResolution.appliedPrice,165.76);
  for(const change of [{thickness:'2'},{woodKind:'Encino rojo'}]){
    const result=h.c.recipeWoodResult(white.itemId,{...whiteOriginal,...change});
    assert.equal(result.priceResolution.appliedPrice,null);assert.equal(result.priceResolution.quality,'PENDING');assert.equal(result.unitCosts.woodCost,null,'No reference price may leak from another recipe');
  }
  assert.deepEqual(plain(h.c.solidWoodState(itemId).applied[0]),original,'Preview queries do not mutate the materialized recipe');
});

test('all five variants stay in Producto de línea without preloading articles when opened, inspected or cancelled',async()=>{
  for(const scenario of ['complete','wood']){
    const h=harness();h.open('DEMO-CATALOG-'+scenario.toUpperCase(),scenario);
    const variants=h.R.products.flatMap(product=>product.variants);
    assert.equal(variants.length,6);
    assert.equal(h.c.app.q.items.length,1,'The existing scenario keeps only its original example article');
    assert.equal(h.c.app.q.items.some(item=>variants.some(variant=>variant.articleLabel===item.description)),false);
    assert.deepEqual(plain(h.c.app.syntheticRecipes.articles),{});
    const checkpoint=()=>JSON.stringify({quote:h.c.app.q,recipes:h.c.app.syntheticRecipes.articles,wood:[...(h.c.app.solidWoodLocal?.articles||new Map())]});
    const original=checkpoint();
    h.begin();
    for(const product of h.R.products){
      for(const variant of product.variants){
        assert.ok(h.c.lineCatalogPanel().includes('value="'+variant.id+'"'),'The explicit variant remains available in the catalog');
        await h.event('change',{lineVariant:product.id},variant.id);
        h.c.lineAction('line-details-toggle',{dataset:{product:product.id}});
        assert.ok(h.c.lineVariantSummary(product).includes(variant.articleLabel));
        assert.equal(checkpoint(),original,'Inspecting a catalog variant must not add an article, recipe metadata or wood preview');
      }
    }
    h.c.lineAction('line-cancel',{dataset:{}});
    h.c.lineAction('line-selector-cancel',{dataset:{}});
    assert.equal(checkpoint(),original,'Cancelling the catalog must preserve the original scenario');
    h.begin();
    assert.equal(h.c.lineState().variantId,'','Reopening must require another explicit variant selection');
    assert.equal(h.c.app.lineCatalog.products.flatMap(product=>product.variants).length,6);
    assert.equal(checkpoint(),original);
  }
});

test('Mesa and Flujo open the same commercial quote flow and require explicit catalog selection before adding a recipe',async()=>{
  for(const view of ['mesa','flujo']){
    const h=harness(),{J,action}=await h.initJourney();
    await action('view',{view});
    assert.equal(J.inspect().state.view,view);
    await action('open',{id:'DEMO-101'});
    assert.equal(J.inspect().state.screen,'request');
    assert.equal(J.inspect().state.id,'DEMO-101');
    assert.equal(h.c.app.q.id,'DEMO-101');
    const before=plain(h.c.app.q.items);
    assert.equal(before.some(row=>row.description.startsWith('Mesa Florencia')),false,'Opening a request does not preload a recipe');
    assert.deepEqual(plain(h.c.app.syntheticRecipes.articles),{});
    await action('stage',{screen:'quote'});
    assert.equal(J.inspect().state.screen,'quote');
    assert.equal(h.c.app.step,1);
    assert.deepEqual(plain(h.c.app.q.items),before,'Working in the quote does not preload catalog entries');
    const product=h.R.products.find(row=>row.id==='SYN-NUBE'),nonce=h.begin();
    assert.ok(h.c.lineCatalogPanel().includes('Mesa Florencia'));
    assert.deepEqual(plain(h.c.app.q.items),before,'Merely opening Producto de línea leaves Artículos unchanged');
    await h.event('change',{lineVariant:product.id},'SYN-NUBE-C');
    assert.deepEqual(plain(h.c.app.q.items),before,'Inspecting a variant leaves Artículos unchanged');
    h.c.lineAction('line-use',{dataset:{product:product.id,productIntent:nonce}});
    assert.equal(h.c.app.q.items.length,before.length+1);
    const article=h.c.app.q.items.at(-1);
    assert.equal(article.description,'Mesa Florencia · Tzalam');
    assert.equal(h.c.recipeEntry(article.id).variantId,'SYN-NUBE-C');
    assert.equal(h.c.app.q.id,'DEMO-101');
    assert.equal(J.inspect().state.id,'DEMO-101');
    assert.ok(h.c.solidWoodState(article.id).applied.length>0,'Explicit use opens the article with its recipe');
    assert.deepEqual(plain(h.c.app.q.items.slice(0,-1)),before,'The preexisting article remains unchanged');
    assert.equal(J.portfolio().totalCents,21000000,'Catalog exploration and recipe use do not create a sale');
  }
});

test('the D91 commercial catalog requires explicit selection and previews the selected variant before creation',async()=>{
  const h=harness();h.open();
  const count=h.c.app.q.items.length,nonce=h.begin(),product=h.R.products.find(row=>row.id==='SYN-NUBE');
  assert.equal(h.c.lineState().variantId,'');
  h.c.lineAction('line-use',{dataset:{product:product.id,productIntent:nonce}});
  assert.equal(h.c.app.q.items.length,count,'Family selection must not silently choose its first variant');
  assert.match(h.c.lineVariantSummary(product),/Selecciona una variante/);
  await h.event('change',{lineVariant:product.id},'SYN-NUBE-O');
  assert.equal(h.c.lineState().variantId,'SYN-NUBE-O');
  const preview=h.c.lineResults(),variant=h.R.variant(product.id,'SYN-NUBE-O');
  assert.ok(preview.includes(h.R.images[variant.imageId]));
  assert.match(preview,/Mesa Florencia · Encino rojo/);
  assert.match(h.c.lineVariantSummary(product),/3 componentes de madera · 2 herrajes<\/dd>/);
  h.c.lineAction('line-use',{dataset:{product:product.id,productIntent:nonce}});
  assert.equal(h.c.app.q.items.length,count+1);
  const item=h.c.app.q.items.at(-1);
  assert.equal(item.description,'Mesa Florencia · Encino rojo');
  assert.deepEqual(plain(item.specs.filter(row=>['Largo','Ancho','Alto'].includes(row.type)).map(row=>Number(row.value))),[60,60,50]);
  assert.equal(h.c.recipeEntry(item.id).variantId,'SYN-NUBE-O');
  h.c.lineAction('line-use',{dataset:{product:product.id,productIntent:nonce}});
  assert.equal(h.c.app.q.items.length,count+1,'A detached repeated use cannot reuse its consumed intent');
  const pieceId=h.c.solidWoodState(item.id).applied[0].id;
  h.c.solidWoodOpen(item.id,pieceId);
  const woodHtml=woodCardMarkup(h.nodes.get('workspace').innerHTML,pieceId);
  // The local row variant now presents the same capture without the nested groups.
  assert.match(woodHtml,/rv-grid rv-wood-grid/);
  for(const field of ['quantityPerProduct','woodKind','thickness','width','length','lengthUnit','finishFaces','jointed','wasteRate','adjustment.price','cnc.decision'])
    assert.ok(woodHtml.includes('data-solid-field="'+field+'"'),'The row retains the '+field+' capture');
  assert.match(woodHtml,/<select[^>]*aria-label="Unidad de la pieza"><option value="Pieza" selected>Pieza<\/option><\/select>/);
  assert.doesNotMatch(woodHtml,/data-solid-action="apply-cnc"|data-solid-field="cnc\.(length|unit|repetitions)"/);
  assert.doesNotMatch(woodHtml,/wood-editor-ordered|class="break-editor tech-entry/);
  assert.doesNotMatch(woodHtml,/data-break-action="save-editor"/);
  assert.match(woodHtml,/data-break-action="wood-confirm"/);
  assert.doesNotMatch(woodHtml,/>Aplicar pieza F<\/button>/,'The D91 component action retains its approved concise label');
});

test('editing, cancelling and applying use native PartDraft isolation and scale recipe quantities once',async()=>{
  const h=harness();h.open();const originalItem=plain(h.c.app.q.items[0]),originalRow=plain(h.c.app.q.manufacturing.items[0]);
  const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);
  const applied=plain(h.c.app.q),woodBefore=plain(h.c.solidWoodState(itemId).applied),masterBefore=plain(h.R.recipe('R-SYN-NUBE-C'));
  editPart(h,itemId,'description','Nombre local descartable');editPart(h,itemId,'quantity','2','number');
  assert.equal(h.c.app.q.items.find(row=>row.id===itemId).quantity,'1');
  assert.deepEqual(plain(itemRow(h.c.app.partDraft.quote,itemId).materials.map(row=>row.purchaseQuantity)),['8','8']);
  assert.equal(h.Q.summary('DEMO-RECIPE').hasPending,true);
  h.c.partDiscard();
  assert.deepEqual(plain(h.c.app.q),applied,'Cancel only discards the local buffer');
  assert.deepEqual(plain(h.c.solidWoodState(itemId).applied),woodBefore);
  h.c.openPartEditor(itemId);editPart(h,itemId,'description','Nombre aplicado localmente');editPart(h,itemId,'quantity','2','number');
  assert.equal(h.c.partApply(),true);
  assert.equal(h.c.app.q.items.find(row=>row.id===itemId).description,'Nombre aplicado localmente');
  assert.equal(h.c.app.q.items.find(row=>row.id===itemId).quantity,'2');
  const row=itemRow(h.c.app.q,itemId);
  assert.deepEqual(plain(row.materials.map(material=>material.purchaseQuantity)),['8','8']);
  assert.deepEqual(plain(row.materials.map(material=>material.unitPrice)),['5','0.5']);
  assert.equal(Number(row.materials[0].purchaseQuantity)*500+Number(row.materials[1].purchaseQuantity)*50,4400,'Declared purchase subtotal scales once: 8 × 500 + 8 × 50 cents');
  const costs=h.sandbox.QuoteManufacturing_.evaluate(h.c.app.q).costs.filter(cost=>cost.itemId===itemId&&['NIVELADORES ASTRIADO','TUERCA INSERTO'].includes(cost.description));
  assert.equal(costs.length,2);
  assert.ok(costs.every(cost=>cost.netCents===null),'An unreviewed synthetic purchase remains financially pending');
  const item=h.c.app.q.items.find(row=>row.id===itemId);
  const required=h.c.solidWoodState(itemId).applied.map(component=>h.sandbox.SolidWoodAutoPreview.calculate({article:item,component,priceCatalog:h.c.app.solidWoodUatConfig.prices,parameterPreview:{wasteRate:'30'}}).requiredQuantity);
  assert.deepEqual(plain(required),[2,8,4]);
  assert.deepEqual(plain(h.c.app.q.items[0]),originalItem);assert.deepEqual(plain(h.c.app.q.manufacturing.items[0]),originalRow);
  assert.deepEqual(plain(h.R.recipe('R-SYN-NUBE-C')),masterBefore);
});

test('manual hardware purchase edits can be cancelled or applied without changing another component or master recipe',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const materialId=itemRow(h.c.app.q,itemId).materials[0].id;
  const editPurchase=async()=>{
    await h.event('click',{breakAction:'edit-purchase',id:materialId});
    assert.equal(h.c.app.breakdownEditor.kind,'purchase');
    const workspace=h.nodes.get('workspace').innerHTML,editorAt=workspace.indexOf('<article class="fab-detail-line article-panel-record rv-row" data-record-id="'+materialId+'"');
    let purchase='',depth=0;
    const sections=/<\/?article\b[^>]*>/g;sections.lastIndex=editorAt;
    for(let tag=sections.exec(workspace);editorAt>=0&&tag;tag=sections.exec(workspace)){
      depth+=tag[0].startsWith('</')?-1:1;
      if(depth===0){purchase=workspace.slice(editorAt,sections.lastIndex);break;}
    }
    assert.ok(purchase,'The real rendered native purchase editor is present');
    assert.match(purchase,/Precio unitario de referencia/);
    assert.match(purchase,/moneda.*(?:IVA|impuestos).*sin acreditar/i);
    assert.doesNotMatch(purchase,/Precio unitario sin IVA · MXN|\bMXN\b/,'Historical hardware prices do not acquire an accredited currency or tax base through a label');
    const field=key=>[...purchase.matchAll(/<(?:input|select)\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes('data-break-field="'+key+'"'));
    for(const key of ['unitPrice','purchaseQuantity','purchaseUnit','taxRate'])assert.ok(field(key),'The existing '+key+' capture input remains available');
    assert.match(field('unitPrice'),/\bdata-money\b/);assert.match(field('unitPrice'),/type="text"/);
    assert.equal(Number(field('unitPrice').match(/value="([^"]*)"/)[1]),5);
    assert.match(purchase,/<select[^>]*data-break-field="purchaseUnit"[^>]*><option value="PZA" selected>/);
    assert.equal(field('taxRate').match(/value="([^"]*)"/)[1],'','Tax rate remains unconfirmed, not a default 0 or 16');
    h.c.breakdownSetField(input({breakField:'purchaseQuantity'},'9','number'),false);
    assert.equal(h.c.breakdownSave(),true);
  };
  await editPurchase();
  assert.equal(itemRow(h.c.app.q,itemId).materials[0].purchaseQuantity,'4');
  h.c.partDiscard();assert.equal(h.c.recipeEntry(itemId).hardware[0].mode,'AUTO');
  h.c.openPartEditor(itemId);await editPurchase();assert.equal(h.c.partApply(),true);
  assert.equal(h.c.recipeEntry(itemId).hardware[0].mode,'MANUAL');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['9','8']);
  assert.equal(h.R.recipe('R-SYN-NUBE-C').hardware[0].quantity,'4');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).processes),[],'Documentary CNC and labor references are not silently converted into operational processes');
});

test('documentary supplements omit duplicate wood and hardware tables without mutating costs or source data',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const item=h.c.app.q.items.find(row=>row.id===itemId),recipe=h.R.recipe(h.c.recipeEntry(itemId).recipeId);
  const before=JSON.stringify({quote:h.c.app.q,local:plain(h.c.solidWoodState(itemId).applied),metadata:h.c.recipeEntry(itemId)});
  const sourceBefore=JSON.stringify(recipe.documentary);
  const html=h.c.recipeSourceCostsHtml(item);
  assert.match(html,/<summary><span>Costos de referencia<\/span><small>Por una unidad<\/small><\/summary>/);
  assert.doesNotMatch(html,/recipe-reference-scope|Alcance de las referencias/,'Later annotation removes the scope disclosure');
  assert.equal((html.match(/class="recipe-economics-table" role="region" tabindex="0"/g)||[]).length,2,'Both tables are keyboard-scrollable');
  assert.match(html,/Referencia de una unidad del Artículo/);
  assert.match(html,/no es una compra adicional/);
  assert.match(html,/243\.21/);assert.match(html,/659\.08/);
  assert.match(html,/<h6>Otros materiales/);assert.match(html,/<h6>Procesos y jornadas/);
  assert.doesNotMatch(html,/Insumos \/ herrajes|Madera · magnitud observada en Excel/);
  assert.equal((html.match(/data-recipe-subtotal=/g)||[]).length,2,'Only the two supplementary tables remain visible');
  assert.match(html,/data-reference-status="PARTIAL"/);assert.match(html,/8 renglón\(es\) pendiente\(s\)/);
  assert.match(html,/Referencia de una unidad del Artículo/);
  assert.doesNotMatch(html,/C:[\\/]|file:\/\/|https?:\/\/|\.xlsx\b/i);
  for(const section of recipe.documentary.sections){
    // The user requested removal from the view, not deletion of D91 source rows.
    assert.equal(html.includes('data-recipe-subtotal="'+section.title+'"'),!['hardware','wood'].includes(section.key),section.key+' visibility');
  }
  assert.deepEqual(plain(recipe.documentary.sections.map(section=>section.key)),['hardware','wood','consumables','processes']);
  assert.equal(JSON.stringify(recipe.documentary),sourceBefore,'All documentary rows are preserved');
  assert.equal(JSON.stringify({quote:h.c.app.q,local:plain(h.c.solidWoodState(itemId).applied),metadata:h.c.recipeEntry(itemId)}),before,'Rendering the historical disclosure is read only');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);
  assert.equal(h.c.recipeSourceCostsHtml(h.c.app.q.items.find(row=>row.id===itemId)),html,'One-article historical reference is not an actual cost and does not scale with ordered quantity');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['8','8'],'Actual editable purchases still scale once');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).processes),[]);
  const summary=h.Q.summary('DEMO-RECIPE');assert.equal(summary.complete,false);assert.match(summary.blockers.join(' '),/Madera:/);
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked','Documentary subtotals do not accredit a complete saved quote');
});

test('absence and invalid quantities stay pending rather than becoming a confirmed zero purchase',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','','number');
  assert.deepEqual(plain(itemRow(h.c.app.partDraft.quote,itemId).materials.map(row=>row.purchaseQuantity)),['','']);
  editPart(h,itemId,'quantity','bad','number');
  assert.deepEqual(plain(itemRow(h.c.app.partDraft.quote,itemId).materials.map(row=>row.purchaseQuantity)),['','']);
  assert.equal(h.c.partApply(),false);
  editPart(h,itemId,'quantity','2','number');
  assert.deepEqual(plain(itemRow(h.c.app.partDraft.quote,itemId).materials.map(row=>row.purchaseQuantity)),['8','8']);
});

test('Apply Article commits a still-dirty purchase subeditor as MANUAL and later quantities preserve its explicit intent',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);
  const [first,second]=itemRow(h.c.app.q,itemId).materials;
  await h.event('click',{breakAction:'edit-purchase',id:first.id});
  h.c.breakdownSetField(input({breakField:'purchaseQuantity'},'9','number'),false);
  // Deliberately do not call breakdownSave: Apply Article must commit it atomically.
  assert.equal(h.c.partApply(),true);assert.equal(h.c.recipeEntry(itemId).hardware[0].mode,'MANUAL');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['9','8']);
  await h.event('click',{breakAction:'edit-component',id:second.id});
  h.c.breakdownSetField(input({breakField:'quantity'},'3','number'),false);assert.equal(h.c.breakdownSave(),true);assert.equal(h.c.partApply(),true);
  assert.equal(itemRow(h.c.app.q,itemId).materials[1].purchaseQuantity,'6','AUTO follows the edited per-product quantity, not a stale seed');
  editPart(h,itemId,'quantity','3','number');assert.equal(h.c.partApply(),true);
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['9','9']);
  await h.event('click',{breakAction:'edit-purchase',id:second.id});
  h.c.breakdownSetField(input({breakField:'purchaseQuantity'},'9','number'),false);assert.equal(h.c.partApply(),true);
  assert.equal(h.c.recipeEntry(itemId).hardware[1].mode,'MANUAL','An explicit unchanged purchase value still records manual intent');
  editPart(h,itemId,'quantity','4','number');assert.equal(h.c.partApply(),true);
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['9','9']);
  await h.event('click',{breakAction:'edit-purchase',id:second.id});
  h.c.breakdownSetField(input({breakField:'purchaseUnit'},'m','select-one'),false);
  assert.equal(h.c.app.breakdownEditor.value.purchaseQuantity,'');assert.equal(h.c.app.breakdownEditor.value.unitPrice,'','Changing the purchase unit cannot silently reuse a price in another unit');
});

test('a fault after native append rolls back article, preview, recipe metadata and related editing containers',async()=>{
  const h=harness({partDraftFault:true});h.open();const product=h.R.products.find(row=>row.id==='SYN-NUBE'),nonce=h.begin();
  await h.event('change',{lineVariant:product.id},'SYN-NUBE-C');
  const serialize=value=>JSON.parse(JSON.stringify(value,(_key,child)=>Object.prototype.toString.call(child)==='[object Map]'?{map:[...child]}:Object.prototype.toString.call(child)==='[object Set]'?{set:[...child]}:child));
  const checkpoint=()=>serialize(Object.fromEntries(['q','solidWoodLocal','syntheticRecipes','lineOrigins','technicalDrafts','deferredPartIds','openPartId','partDraft','breakdownEditor','dirty'].map(key=>[key,h.c.app[key]])));
  const before=checkpoint();h.armOpenFault(2);
  assert.doesNotThrow(()=>h.c.lineAction('line-use',{dataset:{product:product.id,productIntent:nonce}}));
  assert.equal(h.openCalls(),2,'The injected failure occurs after the native append and recipe metadata insertion');
  assert.deepEqual(checkpoint(),before,'No orphaned item, wood preview or recipe lineage may remain after failure');
  assert.equal(h.Q.summary('DEMO-RECIPE').costCents,279741);
});

test('only confirmed native deletion removes a recipe preview and metadata; other articles and cancelled/shared work survive',async()=>{
  const h=harness();h.open();const originalItem=plain(h.c.app.q.items[0]),originalRow=plain(h.c.app.q.manufacturing.items[0]);
  const first=await h.select('SYN-NUBE-C');const firstWood=plain(h.c.solidWoodState(first.itemId).applied),firstMeta=plain(h.c.recipeEntry(first.itemId));
  const second=await h.select('SYN-PRISMA-G');const secondWood=plain(h.c.solidWoodState(second.itemId).applied),secondMeta=plain(h.c.recipeEntry(second.itemId));h.c.partDiscard();
  const remove=async id=>h.event('click',{action:'remove-item',index:String(h.c.app.q.items.findIndex(row=>row.id===id))});
  h.sandbox.confirm=()=>false;await remove(first.itemId);
  assert.deepEqual(plain(h.c.solidWoodState(first.itemId).applied),firstWood);assert.deepEqual(plain(h.c.recipeEntry(first.itemId)),firstMeta);
  h.sandbox.confirm=()=>true;
  const sharedWork={id:'WORK-SYNTHETIC-SHARED',itemId:first.itemId,description:'Trabajo compartido ficticio',source:'SYNTHETIC_TEST'};
  const sharedCost={...h.c.app.q.costs[0],id:'COST-SYNTHETIC-SHARED',itemId:h.c.app.q.items[0].id,workId:sharedWork.id};
  h.c.app.q.workUnits.push(sharedWork);h.c.app.q.costs.push(sharedCost);await remove(first.itemId);
  assert.deepEqual(plain(h.c.recipeEntry(first.itemId)),firstMeta,'Shared work blocks deletion without clearing its recipe');
  h.c.app.q.workUnits=h.c.app.q.workUnits.filter(row=>row.id!==sharedWork.id);h.c.app.q.costs=h.c.app.q.costs.filter(row=>row.id!==sharedCost.id);
  await remove(first.itemId);
  assert.equal(h.c.app.q.items.some(row=>row.id===first.itemId),false);assert.equal(h.c.app.solidWoodLocal.articles.has(first.itemId),false);assert.equal(h.c.recipeEntry(first.itemId),null);
  assert.deepEqual(plain(h.c.solidWoodState(second.itemId).applied),secondWood);assert.deepEqual(plain(h.c.recipeEntry(second.itemId)),secondMeta);
  assert.match(h.Q.summary('DEMO-RECIPE').blockers.join(' '),/Madera:/,'Only the remaining recipe still blocks financial completion');
  await remove(second.itemId);
  assert.equal(h.c.app.solidWoodLocal.articles.has(second.itemId),false);
  for(const [id,local] of h.c.app.solidWoodLocal.articles){assert.ok(h.c.app.q.items.some(item=>item.id===id));assert.equal(local.applied.length,0);}
  assert.deepEqual(plain(h.c.app.syntheticRecipes.articles),{});
  assert.doesNotMatch(h.Q.summary('DEMO-RECIPE').blockers.join(' '),/Madera:/);
  assert.deepEqual(plain(h.c.app.q.items[0]),originalItem);assert.deepEqual(plain(h.c.app.q.manufacturing.items[0]),originalRow);
  assert.equal((await h.Q.save('DEMO-RECIPE')).ok,true,'The original fixture can save again after recipe cleanup');
});

test('repeated variants have fresh article/component IDs and remain isolated across articles, quotes and reset',async()=>{
  const h=harness();h.open('DEMO-FIRST');const first=await h.select('SYN-NUBE-C');
  editPart(h,first.itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);
  const firstItem=plain(h.c.app.q.items.find(row=>row.id===first.itemId)),firstRow=plain(itemRow(h.c.app.q,first.itemId)),firstWood=plain(h.c.solidWoodState(first.itemId).applied),firstMeta=plain(h.c.recipeEntry(first.itemId));
  const second=await h.select('SYN-NUBE-C');
  assert.notEqual(second.itemId,first.itemId);
  const row2=itemRow(h.c.app.q,second.itemId),ids1=[...firstRow.materials,...firstRow.processes,...firstWood].map(row=>row.id),ids2=[...row2.materials,...row2.processes,...h.c.solidWoodState(second.itemId).applied].map(row=>row.id);
  assert.equal(ids2.some(id=>ids1.includes(id)),false);
  assert.deepEqual(plain(h.c.app.q.items.find(row=>row.id===first.itemId)),firstItem);assert.deepEqual(plain(itemRow(h.c.app.q,first.itemId)),firstRow);assert.deepEqual(plain(h.c.recipeEntry(first.itemId)),firstMeta);
  h.Q.create('DEMO-SECOND','complete',request(),{scopePreset:'fabrication-packaging'});assert.equal(h.Q.open('DEMO-SECOND'),true);h.Q.showStep(1);
  assert.equal(h.c.recipeEntry(first.itemId),null);
  const third=await h.select('SYN-PRISMA-G');
  assert.equal(itemRow(h.c.app.q,third.itemId).materials.length,0);assert.equal(h.c.solidWoodState(third.itemId).applied.length,1);
  assert.deepEqual(plain(itemRow(h.c.app.q,third.itemId).processes),[]);
  assert.equal(h.Q.open('DEMO-FIRST'),true);h.Q.showStep(1);
  assert.deepEqual(plain(h.c.solidWoodState(first.itemId).applied),firstWood);assert.equal(h.c.recipeEntry(third.itemId),null);
  const staleNonce=second.nonce;
  h.Q.reset();assert.deepEqual(plain(h.c.app.syntheticRecipes.articles),{});
  h.open('DEMO-FIRST');assert.equal(h.c.app.q.items.length,1);assert.equal(h.c.recipeEntry(first.itemId),null);
  h.c.lineAction('line-use',{dataset:{product:'SYN-NUBE',productIntent:staleNonce}});assert.equal(h.c.app.q.items.length,1);
  assert.equal(h.c.app.lineCatalog.products.length,3);assert.equal(h.R.recipes.length,6);
});

test('invalid PartDraft, unknown saves and frozen snapshots cannot be bypassed by direct recipe actions',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','invalid','number');const count=h.c.app.q.items.length;
  h.c.lineAction('line-add',{dataset:{}});assert.equal(h.c.app.rowAutosave.state,'invalid');assert.equal(h.c.app.q.items.length,count);
  h.Q.create('DEMO-OTHER','complete',request(),{scopePreset:'fabrication-packaging'});assert.equal(h.Q.open('DEMO-OTHER'),false);
  assert.equal(h.c.app.q.id,'DEMO-RECIPE');h.c.partDiscard();assert.equal(h.Q.open('DEMO-OTHER'),true);
  for(const mode of ['unknown','frozen']){
    const locked=harness();locked.open();
    if(mode==='unknown')assert.equal((await locked.Q.save('DEMO-RECIPE','unknown')).state,'unknown');
    else{assert.equal((await locked.Q.save('DEMO-RECIPE')).ok,true);assert.ok(locked.Q.freeze('DEMO-RECIPE'));}
    const quoteBefore=plain(locked.c.app.q),metaBefore=plain(locked.c.app.syntheticRecipes);
    assert.equal(locked.Q.canEdit('DEMO-RECIPE'),false);
    locked.c.lineAction('line-add',{dataset:{}});locked.c.openPartEditor(locked.c.app.q.items[0].id);
    locked.c.partInput(input({path:'items.0.quantity'},'9','number'),false);assert.equal(locked.c.partApply(),false);
    locked.c.solidWoodOpen(locked.c.app.q.items[0].id);
    assert.deepEqual(plain(locked.c.app.q),quoteBefore);assert.deepEqual(plain(locked.c.app.syntheticRecipes),metaBefore);
  }
});

test('applying a recipe keeps F/CNC incomplete and does not enable review, sending, acceptance or a sale',async()=>{
  const h=harness(),{J,action}=await h.initJourney();
  assert.equal(J.portfolio().totalCents,21000000);
  await action('open',{id:'DEMO-101'});h.Q.showStep(1);
  const {itemId}=await h.select('SYN-NUBE-C');editPart(h,itemId,'quantity','1','number');editPart(h,itemId,'unitPrice','500','number');assert.equal(h.c.partApply(),true);
  const summary=h.Q.summary('DEMO-101');assert.equal(summary.complete,false);assert.match(summary.blockers.join(' '),/Madera:/);
  assert.equal((await h.Q.save('DEMO-101')).state,'blocked');assert.equal(h.Q.snapshot('DEMO-101'),null);assert.equal(h.Q.freeze('DEMO-101'),null);
  await action('stage',{screen:'review'});assert.notEqual(J.inspect().state.screen,'review');await action('stay');
  await action('validate');await action('send');await action('convert');
  const record=J.inspect().records.find(row=>row.id==='DEMO-101');
  assert.equal(record.review,null);assert.equal(record.sent,null);assert.equal(record.project,null);assert.equal(record.versions.length,0);
  assert.equal(J.portfolio().totalCents,21000000,'A recipe preview must not enter the accepted-sales universe');
});

test('B aligns headings and each piece in eight columns with price separate from calculated amount',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const entries=plain(h.c.solidWoodState(itemId).applied),snapshot=JSON.stringify(h.c.app.q);
  const expected=['concept','quantity','wood-material','thickness','wood-measures','price','wood-cnc','amount'];
  const cellNames=html=>[...html.matchAll(/class="rv-cell rv-([^"]+)"/g)].map(match=>match[1]);
  const html=h.nodes.get('workspace').innerHTML,at=html.indexOf('class="rv-table-heading rv-grid rv-wood-grid"');
  assert.ok(at>=0);
  const heading=html.slice(at,html.indexOf('<div class="recipe-piece-list">',at));
  assert.deepEqual(cellNames(heading),expected);
  for(const text of ['Medidas y acabado','Ancho','Largo','Unidad','Caras','Entablado','Desperdicio %','Importe'])assert.ok(heading.includes(text),text);
  assert.match(html,/class="rv-table-scroll" role="region" tabindex="0" aria-label="Tabla de piezas de madera"/);
  const check=(card,active=false)=>{
    assert.deepEqual(cellNames(card),expected);
    const priceAt=card.indexOf('class="rv-cell rv-price"'),cncAt=card.indexOf('class="rv-cell rv-wood-cnc"'),amountAt=card.indexOf('class="rv-cell rv-amount"');
    assert.ok(priceAt<cncAt&&cncAt<amountAt);
    assert.doesNotMatch(card.slice(priceAt,cncAt),/<output/,'The input price never contains the calculated amount');
    assert.match(card.slice(amountAt),/<output class="rv-amount"/);
    if(active)assert.match(card,/<select[^>]*data-solid-field="cnc.decision"/);
  };
  for(const piece of entries)check(woodCardMarkup(html,piece.id));
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:entries[0].id,rowField:'name'});
  const active=woodCardMarkup(h.nodes.get('workspace').innerHTML,entries[0].id);
  check(active,true);
  for(const field of ['name','quantityPerProduct','woodKind','thickness','width','length','lengthUnit','finishFaces','jointed','wasteRate','adjustment.price','cnc.decision'])
    assert.equal((active.match(new RegExp('data-solid-field="'+field.replaceAll('.','\\.')+'"','g'))||[]).length,1,field+' has one control');
  assert.deepEqual(woodRowOrder(h.nodes.get('workspace').innerHTML),entries.map(piece=>piece.id));
  assert.match(active,/<strong>\$\s*738\.59<\/strong>/,'The dimensional money oracle remains unchanged');
  assert.equal(JSON.stringify(h.c.app.q),snapshot,'Presentation does not save or mutate the quote');
});

test('B CNC is only a yes/no choice and confirms with its piece without creating a cost',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const before=plain(h.c.solidWoodState(itemId).applied),first=before[0];
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:first.id,rowField:'cnc.decision'});
  const current=()=>woodCardMarkup(h.nodes.get('workspace').innerHTML,first.id);
  assert.match(current(),/<select[^>]*data-solid-field="cnc.decision"/);
  assert.doesNotMatch(current(),/data-solid-action="apply-cnc"|data-solid-field="cnc\.(length|repetitions|unit)"|data-break-action="save-editor"/);
  await h.event('change',{solidField:'cnc.decision'},'no');
  assert.equal(h.c.app.breakdownEditor.solidWoodF.cnc.decision,'no','The decision needs no second confirmation');
  assert.equal(h.c.rowAutoFlush(),false);
  await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.solidWoodState(itemId).applied[0].cnc.decision,'no');
  assert.deepEqual(plain(h.c.solidWoodState(itemId).applied).slice(1),before.slice(1),'Other pieces are isolated');
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:first.id,rowField:'cnc.decision'});
  await h.event('change',{solidField:'cnc.decision'},'yes');
  await h.event('click',{breakAction:'wood-confirm'});
  const after=plain(h.c.solidWoodState(itemId).applied[0]);
  assert.deepEqual(after.cnc,first.cnc,'Changing No back to Sí preserves the historical 244 cm × 1');
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null,'Local automatic capture is separate from confirmed quote saving');
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked');
  assert.doesNotMatch(current(),/data-solid-action="apply-cnc"|data-break-action="save-editor"/);
});


function localCaptureClock(h){
  const callbacks=new Map();let next=1000;
  h.sandbox.setTimeout=(callback,delay)=>{const id=++next;if(delay===450)callbacks.set(id,callback);return id;};
  h.sandbox.clearTimeout=id=>callbacks.delete(id);
  return {pending:()=>[...callbacks.values()],flush(){const work=[...callbacks.values()];callbacks.clear();for(const callback of work)callback();}};
}

test('automatic capture retains a supply and the article after editing, without confirming a financial review or quote snapshot',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();
  const {itemId}=await h.select('SYN-NUBE-C');editPart(h,itemId,'quantity','1','number');h.c.editor();
  assert.equal(h.c.partApply(),true,'Prepare the existing canonical normalization as the comparison baseline');
  const row=itemRow(h.c.app.partDraft.quote,itemId),[first,second]=plain(row.materials);
  const master=JSON.stringify(h.R.recipe('R-SYN-NUBE-C'));
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:first.id,rowField:'purchaseQuantity'});
  h.c.breakdownSetField(input({breakField:'purchaseQuantity'},'9','number'),false);
  await h.event('focusout',{breakField:'purchaseQuantity'});
  assert.ok(clock.pending().length);
  clock.flush();
  const actual=itemRow(h.c.app.q,itemId).materials;
  assert.equal(actual[0].purchaseQuantity,'9');
  assert.equal(actual[0].economicReviewed,false,'Automatic capture does not promote financial review');
  assert.equal(actual[0].purchaseQuality,'pending');
  assert.deepEqual(plain(actual[1]),second,'Other components retain their data');
  assert.equal(h.c.app.breakdownEditor.value.id,first.id,'Editing stays in the same row');
  assert.equal(h.c.partDraftDirty(),false);
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
  assert.equal(JSON.stringify(h.R.recipe('R-SYN-NUBE-C')),master);
  const html=h.nodes.get('workspace').innerHTML;
  assert.doesNotMatch(html,/data-break-action="save-editor"|data-solid-action="apply-cnc"|data-action="part-apply"/);
  assert.match(html,/Cambios conservados durante esta sesión/);
});

test('automatic capture preserves invalid raw input, the last valid value, and isolates correction from other rows',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const [first,second]=plain(itemRow(h.c.app.partDraft.quote,itemId).materials),quote=JSON.stringify(h.c.app.q);
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:first.id,rowField:'unitPrice'});
  h.c.breakdownSetField(input({breakField:'unitPrice'},'-2','number'),false);
  await h.event('focusout',{breakField:'unitPrice'});clock.flush();
  assert.equal(h.c.app.rowAutosave.state,'invalid');
  assert.ok(Object.values(h.c.app.breakdownEditor.rawValues).some(value=>value.value==='-2'));
  assert.equal(JSON.stringify(h.c.app.q),quote,'A failed automatic capture cannot modify the applied article');
  await h.event('focusin',{rowOpen:'material',rowItem:itemId,rowId:second.id,rowField:'unitPrice'});
  assert.equal(h.c.app.breakdownEditor.value.id,first.id,'The invalid row stays available for correction');
  h.c.breakdownSetField(input({breakField:'unitPrice'},'6.25','number'),false);
  await h.event('focusout',{breakField:'unitPrice'});clock.flush();
  assert.equal(itemRow(h.c.app.q,itemId).materials[0].unitPrice,'6.25');
  assert.equal(itemRow(h.c.app.q,itemId).materials[1].unitPrice,second.unitPrice);
  assert.equal(h.c.app.rowAutosave.state,'saved');
});

test('CNC yes without cutting data is retained as an incomplete unpriced decision and never inferred as zero',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');h.c.editor();
  const piece=h.c.solidWoodState(itemId).applied[1],before=plain(piece.cnc);
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:piece.id,rowField:'cnc.decision'});
  await h.event('change',{solidField:'cnc.decision'},'yes');clock.flush();
  assert.equal(h.c.solidWoodState(itemId).applied.find(value=>value.id===piece.id).cnc.decision,'no','No timer confirms a wood choice');
  await h.event('click',{breakAction:'wood-confirm'});
  const actual=h.c.solidWoodState(itemId).applied.find(value=>value.id===piece.id);
  assert.equal(actual.cnc.decision,'yes');assert.equal(actual.cnc.length,before.length);assert.equal(actual.cnc.repetitions,before.repetitions);
  assert.match(woodCardMarkup(h.nodes.get('workspace').innerHTML,piece.id),/data-rv-required="cnc.decision" data-rv-missing="false"/,'An answered choice is distinct from incomplete cutting data');
  const calculated=h.sandbox.SolidWoodAutoPreview.calculate({article:h.c.app.q.items.find(value=>value.id===itemId),component:actual,priceCatalog:h.c.app.solidWoodUatConfig.prices,parameterPreview:{wasteRate:'30'}});
  assert.notEqual(calculated.inputStates.cnc,'VALUE');
  const cnc=calculated.automaticProcesses.find(process=>process.id==='cnc');
  assert.equal(cnc.previewCost,null);assert.equal(cnc.articlePreviewCost,null,'No automatic rate or zero cost is invented');
  assert.equal(cnc.financialConfirmed,false);
  assert.equal(h.Q.summary('DEMO-RECIPE').complete,false);
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked');
});

test('wood changes schedule no automatic callbacks and cannot leave the expediente unconfirmed',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const piece=h.c.solidWoodState(itemId).applied[0];
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:piece.id,rowField:'width'});
  await h.event('input',{solidField:'width'},'61');
  assert.equal(clock.pending().length,0);
  await h.event('input',{solidField:'width'},'62');
  assert.equal(h.c.solidWoodState(itemId).applied[0].width,'60','A superseded timer cannot commit a newer edit early');
  clock.flush();assert.equal(h.c.solidWoodState(itemId).applied[0].width,'60');
  await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.solidWoodState(itemId).applied[0].width,'62');
  await h.event('focusin',{rowOpen:'wood',rowItem:itemId,rowId:piece.id,rowField:'width'});
  await h.event('input',{solidField:'width'},'63');
  h.Q.create('DEMO-OTHER','complete',request());assert.equal(h.Q.open('DEMO-OTHER'),false);
  await h.event('click',{breakAction:'wood-discard'});assert.equal(h.Q.open('DEMO-OTHER'),true);
  const checkpoint=JSON.stringify(h.c.app.q);clock.flush();
  assert.equal(JSON.stringify(h.c.app.q),checkpoint,'The old timer cannot affect the newly opened quote');
});

test('failed or unknown quote saves preserve their outcome while fields are retained automatically in session',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();await h.Q.save('DEMO-RECIPE');
  const saved=plain(h.Q.snapshot('DEMO-RECIPE')),id=h.c.app.q.items[0].id;
  h.c.openPartEditor(id);editPart(h,id,'description','Cambio en sesión');
  await h.event('focusout',{path:'items.0.description'});clock.flush();
  assert.equal(h.c.app.q.items[0].description,'Cambio en sesión');
  assert.deepEqual(plain(h.Q.snapshot('DEMO-RECIPE')),saved);
  assert.equal((await h.Q.save('DEMO-RECIPE','fail')).state,'failed');
  assert.deepEqual(plain(h.Q.snapshot('DEMO-RECIPE')),saved);
  assert.equal((await h.Q.save('DEMO-RECIPE','unknown')).state,'unknown');
  const checkpoint=JSON.stringify(h.c.app.q);assert.equal(h.c.rowAutoFlush(),false);
  assert.equal(JSON.stringify(h.c.app.q),checkpoint);assert.deepEqual(plain(h.Q.snapshot('DEMO-RECIPE')),saved);
  assert.equal((await h.Q.resolveSave('DEMO-RECIPE')).state,'success');
  assert.equal(h.Q.snapshot('DEMO-RECIPE').quote.items[0].description,'Cambio en sesión');
});

test('reset cancels an old callback even when deterministic quote and article identities are reused',()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const id=h.c.app.q.items[0].id;
  h.c.openPartEditor(id);editPart(h,id,'description','Captura anterior');
  return h.event('focusout',{path:'items.0.description'}).then(()=>{
    const stale=clock.pending()[0];assert.ok(stale);h.Q.reset();h.open();
    assert.equal(h.c.app.q.items[0].id,id,'Fixture IDs intentionally repeat after reset');
    h.c.openPartEditor(id);editPart(h,id,'description','Nuevo contexto pendiente');
    const before=JSON.stringify(h.c.app.q),draft=JSON.stringify(h.c.app.partDraft.quote);
    stale();
    assert.equal(JSON.stringify(h.c.app.q),before);
    assert.equal(JSON.stringify(h.c.app.partDraft.quote),draft);
    assert.equal(h.c.app.rowAutosave,null);
  });
});

test('a new maquila is retained automatically once, with its quantity scope and pending economic review intact',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);
  await h.event('click',{breakAction:'add-detail-process',section:'maquilas'});
  const id=h.c.app.breakdownEditor.value.id;
  for(const [field,value,type] of [['category','Corte láser madera','select-one'],['specification','Servicio ficticio','text'],['unit','Servicio','select-one'],['quantity','3','number'],['quantityScope','product','select-one'],['detail.unitPrice','12.50','number']])
    h.c.breakdownSetField(input({breakField:field},value,type),false);
  await h.event('focusout',{breakField:'detail.unitPrice'});clock.flush();
  const process=itemRow(h.c.app.q,itemId).processes.find(value=>value.id===id);
  assert.ok(process);assert.equal(process.quantity,'3');assert.equal(process.quantityScope,'product');assert.equal(process.source.reviewed,false);
  const costId='CST_MFG_'+h.c.D.sha256(itemId+'|P_'+id).slice(0,32);
  const cost=h.sandbox.QuoteManufacturing_.evaluate(h.c.app.q).costs.find(value=>value.id===costId);
  assert.ok(cost);assert.equal(h.c.D.decimal(cost.netAmount,2),7500,'Two articles × three services × $12.50');
  const before=JSON.stringify(h.c.app.q);
  await h.event('focusout',{breakField:'detail.unitPrice'});clock.flush();
  assert.equal(JSON.stringify(h.c.app.q),before,'Repeating a blur cannot duplicate the service or its charge');
  assert.equal(h.c.app.rowAutosave.state,'saved');
  assert.equal(itemRow(h.c.app.q,itemId).processes.filter(value=>value.id===id).length,1);
});

test('automatic article quantity scales recipe purchases once and preserves original CNC conditions',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);
  const index=h.c.app.q.items.findIndex(value=>value.id===itemId),cncBefore=plain(h.c.solidWoodState(itemId).applied[0].cnc);
  editPart(h,itemId,'quantity','2','number');
  await h.event('focusout',{path:'items.'+index+'.quantity'});clock.flush();
  assert.equal(h.c.app.q.items[index].quantity,'2');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(value=>value.purchaseQuantity)),['8','8']);
  assert.deepEqual(plain(h.c.solidWoodState(itemId).applied[0].cnc),cncBefore);
  const result=h.c.recipeWoodResult(itemId,h.c.solidWoodState(itemId).applied[0]);
  assert.equal(result.automaticProcesses.find(value=>value.id==='cnc').articleMl,4.88);
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
  assert.equal(h.c.partDraftDirty(),false);
});

test('journey navigation flushes automatic capture before reading guards and never offers another Apply',async()=>{
  const h=harness(),clock=localCaptureClock(h),{J,action}=await h.initJourney();
  await action('open',{id:'DEMO-101'});await action('stage',{screen:'quote'});
  const id=h.c.app.q.items[0].id;
  h.c.openPartEditor(id);editPart(h,id,'description','Cambio conservado al navegar');
  await h.event('focusout',{path:'items.0.description'});
  assert.ok(clock.pending().length);
  await action('stage',{screen:'request'});
  assert.equal(J.inspect().state.screen,'request');assert.equal(J.inspect().state.guard,null);
  assert.equal(h.c.app.q.items[0].description,'Cambio conservado al navegar');
  await action('stage',{screen:'quote'});
  assert.doesNotMatch(h.nodes.get('journey-footer').innerHTML,/data-action="apply-pending"|data-action="apply-and-leave"/);
  assert.equal(h.Q.snapshot('DEMO-101'),null);
  h.c.openPartEditor(id);editPart(h,id,'quantity','invalid','number');
  await h.event('focusout',{path:'items.0.quantity'});clock.flush();
  await action('stage',{screen:'request'});
  assert.equal(J.inspect().state.guard,'pending');
  assert.match(h.nodes.get('journey-footer').innerHTML,/Hay datos por corregir/);
  assert.doesNotMatch(h.nodes.get('journey-footer').innerHTML,/data-action="apply-and-leave"/);
  assert.match(h.nodes.get('journey-footer').innerHTML,/data-action="discard-and-leave"/);
  assert.equal(h.Q.snapshot('DEMO-101'),null);
});

test('annotated B has a single article quantity in its header, outside the accordion toggle',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');h.c.editor();
  const html=h.nodes.get('workspace').innerHTML,index=h.c.app.q.items.findIndex(item=>item.id===itemId);
  const quantity='data-path="items.'+index+'.quantity"';
  assert.equal(html.split(quantity).length-1,1,'There is exactly one native quantity writer');
  assert.doesNotMatch(html,/part-dimensions-quantity|class="editor-context"|article-flow-status/);
  const headingStart=html.indexOf('<div class="part-accordion-heading">',html.indexOf('data-part-id="'+itemId+'"'));
  const detailStart=html.indexOf('<div id="part-detail-'+itemId+'"',headingStart);
  const heading=html.slice(headingStart,detailStart);
  assert.ok(heading.includes(quantity),'The native field now belongs to the article heading');
  assert.match(heading,/<label for="f-items-\d+-quantity">Cantidad<\/label>/);
  for(const button of heading.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g))assert.doesNotMatch(button[1],/<input|<select|<label/,'No interactive controls nested in the disclosure button');
  assert.ok(heading.indexOf('</h3>')<heading.indexOf(quantity),'The input is outside the heading semantics');
  assert.match(heading,/aria-expanded="true" aria-controls="part-detail-/);
  assert.match(heading,/data-article-header-unit/);assert.match(heading,/data-article-cost-status=/);
  assert.match(html,/aria-label="Secciones del cotizador"/);
  assert.doesNotMatch(html,/class="stepnum"/,'Quote sections are tabs, not a second numbered flow');
});

test('annotated B header quantity opens a collapsed article and scales integer piece quantities once',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);
  await h.event('click',{action:'toggle-part',id:itemId});
  assert.equal(h.c.app.openPartId,'');
  assert.match(h.nodes.get('workspace').innerHTML,new RegExp('readonly data-header-open="'+itemId+'"'));
  await h.event('focusin',{headerOpen:itemId});
  assert.equal(h.c.app.openPartId,itemId);assert.equal(h.c.app.partDraft.itemId,itemId);
  const index=h.c.app.q.items.findIndex(item=>item.id===itemId),snapshot=h.Q.snapshot('DEMO-RECIPE');
  const cncBefore=plain(h.c.solidWoodState(itemId).applied[0].cnc);
  // Later user annotation requires whole commercial pieces; geometry and
  // fractional consumptions/days keep their separate decimal contracts.
  for(const [quantity,expectedPurchase,expectedMl] of [['2','8',4.88],['3','12',7.32]]){
    editPart(h,itemId,'quantity',quantity,'number');
    await h.event('focusout',{path:'items.'+index+'.quantity'});clock.flush();
    assert.equal(h.c.app.q.items[index].quantity,quantity);
    assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),[expectedPurchase,expectedPurchase]);
    assert.deepEqual(plain(h.c.solidWoodState(itemId).applied[0].cnc),cncBefore);
    assert.equal(h.c.recipeWoodResult(itemId,h.c.solidWoodState(itemId).applied[0]).automaticProcesses.find(row=>row.id==='cnc').articleMl,expectedMl);
    assert.equal(h.c.partDraftDirty(),false);
    assert.deepEqual(h.Q.snapshot('DEMO-RECIPE'),snapshot,'Header edits never replace the confirmed snapshot');
  }
});

test('annotated B header cannot bypass invalid capture or editing locks',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);
  const other=h.c.app.q.items.find(item=>item.id!==itemId),before=JSON.stringify(h.c.app.q);
  editPart(h,itemId,'quantity','invalid','number');
  await h.event('focusout',{path:'items.1.quantity'});clock.flush();
  await h.event('focusin',{headerOpen:other.id});
  assert.equal(h.c.app.openPartId,itemId,'Changing header does not abandon the invalid article');
  assert.ok(Object.keys(h.c.app.partDraft.raw).some(path=>path.endsWith('.quantity')));
  assert.equal(JSON.stringify(h.c.app.q),before,'Canonical article values remain intact');
  h.c.partDiscard();h.c.app.operation={id:'SYNTHETIC-UNKNOWN'};h.c.editor();
  assert.doesNotMatch(h.nodes.get('workspace').innerHTML,/data-header-open=|data-path="items\.\d+\.quantity"/,'Unknown-result mode offers no quantity editor');
  await h.event('focusin',{headerOpen:other.id});
  assert.equal(JSON.stringify(h.c.app.q),before,'Synthetic focus events cannot edit through the lock');
});

test('annotated B removes only the additional wood-material capture fold and preserves reference data',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const row=itemRow(h.c.app.partDraft.quote,itemId);
  row.materials.push({...plain(row.materials[0]),id:'SYN-EXISTING-WOOD-OTHER',section:'wood-other',name:'Material ya capturado'});
  const before=JSON.stringify(row.materials),reference=JSON.stringify(h.R.recipe('R-SYN-NUBE-C').documentary);
  h.c.editor();
  const html=h.nodes.get('workspace').innerHTML;
  assert.doesNotMatch(html,/data-fab-panel="wood-other"|Una sola fuente económica por componente/);
  assert.doesNotMatch(html,/recipe-economics-reference/,'Later annotation removes the duplicate historical table from the rendered view');
  assert.match(html,/Materiales de acabado|Otros · consumibles/,'The editable fields remain available below');
  assert.equal(JSON.stringify(itemRow(h.c.app.partDraft.quote,itemId).materials),before,'Removing a disclosure deletes no stored component');
  assert.equal(JSON.stringify(h.R.recipe('R-SYN-NUBE-C').documentary),reference);
});

test('annotated B shows only quote sections in the editor and retains the commercial navigation elsewhere',async()=>{
  const h=harness(),{J,action}=await h.initJourney();
  await action('open',{id:'DEMO-101'});
  assert.match(h.nodes.get('journey-root').innerHTML,/class="j-stages"/);
  await action('stage',{screen:'quote'});
  assert.equal(J.inspect().state.screen,'quote');
  assert.doesNotMatch(h.nodes.get('journey-root').innerHTML,/class="j-stages"/);
  assert.equal((h.nodes.get('workspace').innerHTML.match(/class="steps compact-steps"/g)||[]).length,1);
  assert.match(h.nodes.get('journey-footer').innerHTML,/data-action="stage"[^>]*data-screen="review"/,'The next commercial action is still available');
  await h.event('click',{action:'step',step:'0'});
  assert.equal(h.c.app.step,0,'The native Cliente tab changes the quote step');
  await h.bubbleToDocument('click');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(J.inspect().state.screen,'request');
  assert.match(h.nodes.get('journey-root').innerHTML,/class="j-stages"/);
  assert.match(h.nodes.get('journey-root').innerHTML,/data-screen="response"[^>]*disabled/,'Removing the duplicate bar does not grant access to later stages');
});

test('whole piece quantities reject decimals, increment from the right arrow and retain measured-unit decimals',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);h.c.editor();
  const index=h.c.app.q.items.findIndex(item=>item.id===itemId),html=h.nodes.get('workspace').innerHTML;
  assert.match(html,new RegExp('data-path="items\\.'+index+'\\.quantity"[^>]*step="1"[^>]*data-digits="0"'));
  assert.match(html,new RegExp('data-header-increment="'+itemId+'"'));
  const before=JSON.stringify(h.c.app.q);
  h.c.partInput(input({path:'items.'+index+'.quantity',digits:'0'},'1.5','number'),false);
  await h.event('focusout',{path:'items.'+index+'.quantity'});clock.flush();
  assert.equal(JSON.stringify(h.c.app.q),before,'A decimal piece quantity cannot replace the last valid article');
  assert.ok(h.c.app.partDraft.raw['items.'+index+'.quantity']);
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.rowAutoFlush(),true);
  await h.event('click',{headerIncrement:itemId});
  assert.equal(h.c.app.q.items[index].quantity,'2');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['8','8']);
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
  editPart(h,itemId,'unit','Metro','select-one');editPart(h,itemId,'quantity','1.5','number');
  assert.equal(h.c.rowAutoFlush(),true,'A length sold in metres retains its own decimal quantity contract');
  assert.equal(h.c.app.q.items[index].quantity,'1.5');
});

test('binary piece selectors expose only yes and no and wood editing has no action/status strip',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const piece=h.c.solidWoodState(itemId).applied[1];
  await h.event('click',{solidAction:'edit',articleId:itemId,id:piece.id});
  let html=woodCardMarkup(h.nodes.get('workspace').innerHTML,piece.id);
  for(const key of ['jointed','cnc.decision']){
    const select=html.match(new RegExp('<select[^>]*data-solid-field="'+key.replace('.','\\.')+'"[^>]*>([\\s\\S]*?)<\\/select>'));
    assert.ok(select,key+' selector exists');
    const selectable=[...select[1].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)].filter(match=>!/(?:disabled|hidden)/.test(match[1])).map(match=>match[2]);
    assert.deepEqual(selectable,['No','Sí']);assert.doesNotMatch(select[1],/Pendiente|Por definir/);
  }
  assert.equal(h.c.app.breakdownEditor.solidWoodF.jointed,'0','5 Nov explicitly confirms no jointing for Florencia legs');
  assert.doesNotMatch(html,/class="break-editor-actions"|data-break-action="cancel-editor"/);
  await h.event('click',{solidAction:'new',articleId:itemId});
  html=h.nodes.get('workspace').innerHTML;
  assert.doesNotMatch(html.match(/<select[^>]*data-solid-field="jointed"[^>]*>[\s\S]*?<\/select>/)?.[0]||'',/Pendiente/);
});

test('reference workshop replaces the duplicate source tables and uses live wood geometry without adding financial costs',async()=>{
  const h=harness(),clock=localCaptureClock(h);h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','1','number');assert.equal(h.c.partApply(),true);h.c.editor();
  const initial=h.c.workshopRead(itemId),costs=JSON.stringify(h.c.app.q.costs),source=JSON.stringify(h.R.recipe('R-SYN-NUBE-C'));
  assert.equal(initial.domino.quantity,'9.6');assert.equal(initial.labor.varnish.unitCents,'19008');assert.equal(initial.other.extras.unitCents,'3979');
  assert.equal(initial.financialConfirmed,false);
  const html=h.nodes.get('workspace').innerHTML;
  assert.doesNotMatch(html,/recipe-economics-reference|Costos de referencia/);
  const titles=['Dóminos × ML','Mano de obra','Mano de obra por días','Materiales de acabado','Otros · consumibles y CNC / Láser'];
  let at=-1;for(const title of titles){const next=html.indexOf(title,at+1);assert.ok(next>at,title+' follows the prior block');at=next;}
  assert.doesNotMatch(html,/Alcance de las referencias|recipe-reference-scope/);
  for(const name of ['Carpintería','Instalación','CNC / Láser','Acabados','Tejido','Integración'])assert.match(html,new RegExp('<strong>'+name+'(?:<|$)'));
  const top=h.c.solidWoodState(itemId).applied[0];
  await h.event('click',{solidAction:'edit',articleId:itemId,id:top.id});
  await h.event('input',{solidField:'length'},'80');clock.flush();
  const changed=h.c.workshopRead(itemId);
  assert.equal(changed.domino.ml,'3.2');assert.equal(changed.domino.quantity,'12.8');
  assert.equal(changed.geometry.areaM2,'0.648');assert.equal(changed.labor.varnish.unitCents,'23328');
  assert.equal(JSON.stringify(h.c.app.q.costs),costs,'Reference editing never creates another canonical charge');
  assert.equal(JSON.stringify(h.R.recipe('R-SYN-NUBE-C')),source);
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked','F/CNC save limits remain enforced');
});

test('reference workshop retains edits and malformed input per article and per expediente without mutating source data',async()=>{
  const h=harness();h.open('DEMO-WORK-A');const a=await h.select('SYN-NUBE-C');
  const set=async(key,value,options={})=>h.event('input',{workshopItem:h.c.app.openPartId,workshopField:key},value,options);
  await set('domino.extra','2');assert.equal(h.c.workshopRead(a.itemId).domino.quantity,'11.6');
  await set('other.glue.price','bad');assert.equal(h.c.workshopRead(a.itemId).other.glue.unitCents,null);
  assert.ok(h.c.workshopRead(a.itemId).errors.includes('other.glue.price'));
  const b=await h.select('SYN-NUBE-O');
  assert.equal(h.c.workshopValues(b.itemId)['domino.extra'],'');
  await set('finish.0.enabled','on',{type:'checkbox',checked:false});
  assert.equal(h.c.workshopRead(b.itemId).finish[0].status,'NOT_APPLICABLE');
  assert.equal(h.c.workshopValues(a.itemId)['domino.extra'],'2');
  assert.equal(h.c.workshopValues(a.itemId)['other.glue.price'],'bad');
  assert.equal(h.Q.leave('DEMO-WORK-A',{mode:'keep'}).ok,true);
  h.open('DEMO-WORK-B');const c=await h.select('SYN-NUBE-C');
  assert.equal(h.c.workshopValues(c.itemId)['other.glue.price'],'183');
  assert.equal(h.Q.open('DEMO-WORK-A'),true);h.c.openPartEditor(a.itemId);
  assert.equal(h.c.workshopValues(a.itemId)['domino.extra'],'2');
  assert.equal(h.c.workshopValues(a.itemId)['other.glue.price'],'bad');
  const before=JSON.stringify(h.c.workshopValues(a.itemId));h.c.app.operation={id:'SYNTHETIC-UNKNOWN'};
  await set('domino.extra','9');assert.equal(JSON.stringify(h.c.workshopValues(a.itemId)),before);
  assert.equal(h.Q.snapshot('DEMO-WORK-A'),null);
});

test('reference workshop does not generalize Florencia joint counts to other recipes',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-PRISMA-C');
  assert.equal(h.c.workshopValues(itemId)['domino.unions'],'');
  assert.equal(h.c.workshopRead(itemId).domino.unitCents,null);
  const historical=h.R.recipe('R-SYN-PRISMA-C').documentary.sections.flatMap(section=>section.rows).find(row=>row.kind==='DOMINO_CONSUMPTION');
  assert.equal(historical.quantity,'9.76');assert.equal(historical.totalSaved,'48.8');
  assert.match(h.c.recipeSourceCostsHtml(h.c.app.q.items.find(item=>item.id===itemId)),/9\.76/);
});

test('reference workshop escapes material labels and reset removes local settings',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const payload='\"><img src=x onerror=alert(1)>';
  await h.event('input',{workshopItem:itemId,workshopField:'finish.0.name'},payload);
  const html=h.c.workshopMarkup(itemId);
  assert.match(html,/value="&quot;&gt;&lt;img/);assert.doesNotMatch(html,/<img\b/);
  // A literal word inside an escaped quoted value is not an event handler.
  // Inspect attribute names while consuming complete quoted values instead.
  for(const tag of html.matchAll(/<[a-z][^>]*>/gi))for(const attribute of tag[0].matchAll(/\s([a-z][\w:-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi))assert.ok(!/^on/i.test(attribute[1]),'No inline handler attribute is created');
  const before=JSON.stringify(h.c.workshopValues(itemId));h.c.app.meta.current=false;
  await h.event('input',{workshopItem:itemId,workshopField:'other.extrasPct'},'50');
  assert.equal(JSON.stringify(h.c.workshopValues(itemId)),before,'Historical views cannot edit settings');
  h.Q.reset();assert.equal(h.c.app.solidWoodLocal,null);
});

test('reference workshop refresh keeps the active input and table in place while updating its calculated amount',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const attrs=new Map(),error={hidden:true};
  const control={id:'SYN-ACTIVE-PRICE',dataset:{workshopField:'other.glue.price'},value:'200',selectionStart:2,selectionEnd:2,
    setAttribute:(key,value)=>attrs.set(key,value),closest:()=>({querySelector:()=>error})};
  const amount={dataset:{workshopLive:'glue-amount'},innerHTML:'',setAttribute(){},removeAttribute(){}};
  const table={scrollLeft:230};
  const root={querySelectorAll(selector){if(selector==='[data-workshop-live]')return [amount];if(selector==='[data-workshop-field]')return [control];return [table];},
    set outerHTML(_){throw Error('Replacing the workshop would lose the active input and horizontal position');}};
  const originalQuery=h.host.querySelector.bind(h.host),originalCreate=h.sandbox.document.createElement;
  h.host.querySelector=selector=>selector.startsWith('[data-workshop-article=')?root:originalQuery(selector);
  h.sandbox.document.createElement=name=>{
    if(name!=='template')return originalCreate(name);
    const template={innerHTML:'',content:{querySelector:()=>({querySelector(selector){
      const key=/data-workshop-live="([^"]+)"/.exec(selector)?.[1];
      const match=key&&new RegExp('<output\\b[^>]*data-workshop-live="'+key+'"[^>]*>([\\s\\S]*?)<\\/output>').exec(template.innerHTML);
      return match?{innerHTML:match[1],getAttribute:()=>null}:null;
    }})}};
    return template;
  };
  h.sandbox.document.activeElement=control;
  await h.event('input',{workshopItem:itemId,workshopField:'other.glue.price'},'200');
  assert.equal(h.c.workshopRead(itemId).other.glue.unitCents,'4320');assert.match(amount.innerHTML,/\$ 43\.20/);
  assert.equal(h.sandbox.document.activeElement,control);assert.equal(control.value,'200');assert.equal(control.selectionStart,2);assert.equal(table.scrollLeft,230);
  assert.equal(attrs.get('aria-invalid'),'false');assert.equal(error.hidden,true);
  await h.event('input',{workshopItem:itemId,workshopField:'other.glue.price'},'bad');
  assert.match(amount.innerHTML,/Pendiente/);assert.equal(attrs.get('aria-invalid'),'true');assert.equal(error.hidden,false);
  assert.equal(h.sandbox.document.activeElement,control);assert.equal(table.scrollLeft,230);
});

test('wood capture uses requirement stars instead of a pending-details disclosure without changing saved recipe values',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const piece=h.c.solidWoodState(itemId).applied[1],before=JSON.stringify(h.c.solidWoodState(itemId).applied);
  await h.event('click',{solidAction:'edit',articleId:itemId,id:piece.id});
  const card=woodCardMarkup(h.nodes.get('workspace').innerHTML,piece.id);
  assert.doesNotMatch(card,/Datos pendientes de la pieza|rv-wood-pending|data-solid-live="referencePending"/);
  for(const key of ['name','quantityPerProduct','woodKind','thickness','width','length','lengthUnit','finishFaces','jointed','wasteRate','adjustment.price','cnc.decision']){
    assert.ok(card.includes('data-rv-required="'+key+'"'),key+' has an accessible requirement marker');
    assert.match(card,new RegExp('data-solid-field="'+key.replaceAll('.','\\.')+'"[^>]*aria-required="true"'));
  }
  assert.match(card,/data-rv-required="jointed" data-rv-missing="false"/);
  assert.match(card,/data-rv-required="width" data-rv-missing="false"/);
  assert.match(h.nodes.get('workspace').innerHTML,/Pieza<span class="rv-required-symbol" aria-hidden="true">\*<\/span>/);
  assert.equal(JSON.stringify(h.c.solidWoodState(itemId).applied),before);
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
});

test('a nameless new piece stays blocked with field markers and no repeated description alert',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const before=JSON.stringify(h.c.solidWoodState(itemId).applied);
  await h.event('click',{solidAction:'new',articleId:itemId});
  const id=h.c.app.breakdownEditor.solidWoodF.id;
  assert.equal(h.c.rowAutoFlush(),false);
  await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.app.breakdownEditor.error,'Escribe la descripción de la pieza.','The validation remains enforced internally');
  let html=h.nodes.get('workspace').innerHTML;
  assert.doesNotMatch(html,/Escribe la descripción de la pieza\.|Datos pendientes de la pieza/);
  assert.match(html,/data-rv-required="name" data-rv-missing="true"/);
  assert.match(html,/<input[^>]*data-solid-field="name"[^>]*aria-required="true" aria-invalid="true"/);
  assert.equal(JSON.stringify(h.c.solidWoodState(itemId).applied),before,'No unnamed piece replaces applied values');
  await h.event('input',{solidField:'name'},'Pieza por completar');
  await h.event('click',{breakAction:'wood-confirm'});
  assert.equal(h.c.app.breakdownEditor,null,'Explicit incomplete capture is allowed once the existing name rule is satisfied');
  assert.ok(h.c.solidWoodState(itemId).applied.some(piece=>piece.id===id&&piece.name==='Pieza por completar'));
  html=h.nodes.get('workspace').innerHTML;assert.match(html,/data-rv-required="width" data-rv-missing="true"/);
  assert.equal((await h.Q.save('DEMO-RECIPE')).state,'blocked','Field markers do not confirm F costs or a snapshot');
});

test('the single lower calculation view contains both entered and derived fields with unchanged reference arithmetic',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const before=JSON.stringify(h.c.workshopRead(itemId)),source=JSON.stringify(h.R.recipe('R-SYN-NUBE-C').documentary);
  h.c.editor();const html=h.nodes.get('workspace').innerHTML;
  assert.doesNotMatch(html,/recipe-economics-reference|Referencias históricas; no se suman|workshop-basis|workshop-domino-grid/);
  assert.equal((html.match(/class="recipe-workshop"/g)||[]).length,1);
  for(const key of ['domino.unions','labor.assembly.rate','days.0.quantity','finish.0.hands','other.glue.price','other.extrasPct']){
    assert.equal((html.match(new RegExp('data-workshop-field="'+key.replaceAll('.','\\.')+'"','g'))||[]).length,1,key+' has one capture control');
  }
  assert.match(html,/class="workshop-domino-table"/);assert.match(html,/class="workshop-other-table"/);
  assert.match(html,/data-workshop-live="glue-amount"/);assert.match(html,/data-workshop-live="extras-base"/);
  assert.equal(JSON.stringify(h.c.workshopRead(itemId)),before);
  assert.equal(JSON.stringify(h.R.recipe('R-SYN-NUBE-C').documentary),source,'Retiring a rendered table never deletes documentary data');
});

test('wood requirement decoration preserves literal replacement tokens in user-entered names',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C'),piece=h.c.solidWoodState(itemId).applied[0];
  await h.event('click',{solidAction:'edit',articleId:itemId,id:piece.id});
  await h.event('input',{solidField:'name'},'Pieza $& de ejemplo');h.c.editor();
  const html=woodCardMarkup(h.nodes.get('workspace').innerHTML,piece.id);
  assert.match(html,/value="Pieza \$&amp; de ejemplo"/);
  assert.equal(h.c.app.breakdownEditor.solidWoodF.name,'Pieza $& de ejemplo');
  assert.equal((html.match(/data-solid-field="name"/g)||[]).length,1);
});

test('the left quantity arrow reduces whole pieces once, stops at one and retains editing guards',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);h.c.editor();
  const html=h.nodes.get('workspace').innerHTML,index=h.c.app.q.items.findIndex(item=>item.id===itemId);
  const header=html.slice(html.indexOf('data-part-id="'+itemId+'"'),html.indexOf('id="part-detail-'+itemId+'"'));
  assert.ok(header.indexOf('data-header-decrement=')<header.indexOf('data-path="items.'+index+'.quantity"'));
  assert.ok(header.indexOf('data-header-increment=')>header.indexOf('data-path="items.'+index+'.quantity"'));
  await h.event('click',{headerDecrement:itemId});
  assert.equal(h.c.app.q.items[index].quantity,'1');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['4','4']);
  await h.event('click',{headerDecrement:itemId});assert.equal(h.c.app.q.items[index].quantity,'1');
  await h.event('click',{headerIncrement:itemId});assert.equal(h.c.app.q.items[index].quantity,'2');
  const other=h.c.app.q.items.find(item=>item.id!==itemId),before=JSON.stringify(h.c.app.q);
  editPart(h,itemId,'quantity','invalid','number');
  await h.event('click',{headerDecrement:other.id});assert.equal(JSON.stringify(h.c.app.q),before);assert.equal(h.c.app.openPartId,itemId);
  h.c.app.operation={id:'SYN-UNKNOWN'};await h.event('click',{headerDecrement:itemId});assert.equal(JSON.stringify(h.c.app.q),before);
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
});

test('installation exclusion follows the declared scope, protects capture and restores prior days when included',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  let result=h.c.workshopRead(itemId),values=h.c.workshopValues(itemId);
  assert.equal(result.days[1].unitCents,'0');assert.equal(result.days[1].excluded,true);
  assert.equal(values['days.1.quantity'],'');assert.equal(values['days.1.rate'],'1200');
  let html=h.c.workshopMarkup(itemId);assert.match(html,/data-workshop-field="days\.1\.quantity" disabled[^>]*value="0"/);
  await h.event('input',{workshopItem:itemId,workshopField:'days.1.quantity'},'4');assert.equal(h.c.workshopValues(itemId)['days.1.quantity'],'');
  const model=h.c.app.partDraft.quote.manufacturing;model.installation='yes';model.installationReason='';
  assert.equal(h.c.workshopRead(itemId).days[1].unitCents,null,'Undeclared days are not a free included service');
  await h.event('input',{workshopItem:itemId,workshopField:'days.1.quantity'},'0.5');
  assert.equal(h.c.workshopRead(itemId).days[1].unitCents,'60000');
  model.installation='no';model.installationReason='Entrega sin instalación.';assert.equal(h.c.workshopRead(itemId).days[1].unitCents,'0');
  assert.equal(h.c.workshopValues(itemId)['days.1.quantity'],'0.5','A scope change preserves the prior capture');
  h.c.scopeAction({dataset:{scopeAction:'select',scopeDirection:'include',scopeId:'SCOPE_INSTALLATION'}});
  assert.notEqual(h.c.workshopRead(itemId).days[1].excluded,true,'A contradictory inclusion cannot silently force an exclusion');
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
});

test('all workshop tariffs display currency and grouped edits preserve exact cents without rounding malformed input',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  let html=h.c.workshopMarkup(itemId),count=0;
  for(const input of html.matchAll(/<input\b[^>]*data-workshop-money[^>]*>/g)){
    count++;const value=input[0].match(/value="([^"]*)"/)?.[1];
    if(value)assert.match(value,/^\d{1,3}(?:,\d{3})*\.\d{2}$/);
  }
  assert.ok(count>=10);assert.match(html,/class="workshop-money"><span aria-hidden="true">\$<\/span>/);
  await h.event('input',{workshopItem:itemId,workshopField:'days.0.rate'},'1,200.50');
  assert.equal(h.c.workshopValues(itemId)['days.0.rate'],'1200.50');assert.equal(h.c.workshopRead(itemId).days[0].unitCents,'48020');
  const blurred=await h.event('focusout',{workshopItem:itemId,workshopField:'days.0.rate'},'1200.50',{type:'text'});assert.equal(blurred.value,'1,200.50');
  for(const value of ['12,34','1.234','-2']){
    await h.event('input',{workshopItem:itemId,workshopField:'days.0.rate'},value);
    assert.equal(h.c.workshopValues(itemId)['days.0.rate'],value);assert.equal(h.c.workshopRead(itemId).days[0].unitCents,null);
  }
  await h.event('input',{workshopItem:itemId,workshopField:'days.0.rate'},'0.00');assert.equal(h.c.workshopRead(itemId).days[0].unitCents,'0');
  await h.event('input',{workshopItem:itemId,workshopField:'days.0.rate'},'');assert.equal(h.c.workshopRead(itemId).days[0].unitCents,null);
  assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
});

test('domino cost follows its currency price in the same row and includes extras exactly once',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  await h.event('input',{workshopItem:itemId,workshopField:'domino.extra'},'2');
  const result=h.c.workshopRead(itemId),html=h.c.workshopMarkup(itemId),table=html.slice(html.indexOf('class="workshop-domino-table"'),html.indexOf('class="workshop-totals"'));
  assert.equal(result.domino.quantity,'11.6');assert.equal(result.domino.unitCents,'5800');
  assert.ok(table.indexOf('data-workshop-field="domino.price"')<table.indexOf('data-workshop-live="domino-row-amount"'));
  assert.match(table,/data-workshop-field="domino\.price"[^>]*value="5\.00"/);
  assert.match(table,/data-workshop-live="domino-row-amount"[^>]*><strong>\$ 58\.00<\/strong>/);
});

test('tariff help opens from its circle and closes with Escape without changing any captured values',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const panelId='workshop-help-'+itemId+'-labor',panel=h.host.querySelector('#'+panelId);panel.hidden=true;
  const attributes=new Map([['aria-expanded','false'],['aria-controls',panelId]]);
  const options={getAttribute:key=>attributes.get(key)??null,setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)};
  const dataset={workshopItem:itemId,workshopHelp:'tariff',workshopHelpGroup:'labor'},before=JSON.stringify(h.c.workshopValues(itemId));
  await h.event('click',dataset,undefined,options);assert.equal(panel.hidden,false);assert.match(panel.textContent,/precio de una unidad/);assert.equal(attributes.get('aria-expanded'),'true');
  assert.equal(attributes.get('aria-describedby'),panelId);
  await h.event('keydown',dataset,undefined,options,{key:'Escape'});assert.equal(panel.hidden,true);assert.equal(attributes.get('aria-expanded'),'false');
  assert.equal(JSON.stringify(h.c.workshopValues(itemId)),before);assert.equal(h.Q.snapshot('DEMO-RECIPE'),null);
});
