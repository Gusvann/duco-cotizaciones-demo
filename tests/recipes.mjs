import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {extendRecipes} from '../tools/recipe-extension.mjs';
import {extendRecipePresentation} from '../src/recipe-presentation.mjs';

// Commercial catalog identities and D91 recipe preview with unconfirmed historical economics. The actual transformed D85 client, domain and
// bridge execute in a Node VM with a DOM substitute. This is not browser QA.
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const native=read('src/cotizador.html');
const referenceSource=read('src/recipe-reference.js');
const catalogSource=read('src/recipe-catalog.js');
const bridgeSource=read('src/quote-bridge.js');
const portfolioSource=read('src/portfolio-kpis.js'),journeySource=read('src/journey.js');
const extended=extendRecipePresentation(extendRecipes(native));
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
  const event=async(type,dataset,value)=>{
    const target={container:host,dataset,value,type:type==='change'?'select-one':'button',tagName:type==='change'?'SELECT':'BUTTON',disabled:false,
      hasAttribute:()=>false,matches:()=>false,getAttribute:()=>null,
      closest(selector){for(const [field,key] of [['action','data-action'],['partAction','data-part-action'],['breakAction','data-break-action'],['solidAction','data-solid-action']])if(selector==='['+key+']'&&dataset[field]!=null)return this;return null;}};
    for(const listener of host.listeners.get(type)||[])await listener({target,preventDefault(){},stopPropagation(){}});
    await Promise.resolve();
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
    vm.runInContext(portfolioSource,sandbox,{filename:'portfolio-kpis.js'});vm.runInContext(journeySource,sandbox,{filename:'journey.js'});
    await sandbox.DemoJourney.ready;
    const action=async(action,extra={})=>{
      const root=nodes.get('journey-root'),target={container:root,dataset:{action,...extra},disabled:false,closest:()=>target};
      for(const listener of root.listeners.get('click')||[])listener({target,preventDefault(){}});
      await new Promise(resolve=>setImmediate(resolve));
    };
    return {J:sandbox.DemoJourney,action};
  };
  return {sandbox,c,Q,R,nodes,host,open,begin,select,event,initJourney,armOpenFault(at){assert.ok(partDraftFault);openCalls=0;faultAt=at;},openCalls:()=>openCalls};
}

test('the approved native D85 source stays unchanged; the extension is applied only to the generated client',()=>{
  assert.equal(createHash('sha256').update(native).digest('hex'),'3291618da77246df866be50ce53e3a74589435797e0b75975e35d69b71bb6a67');
  assert.notEqual(extended,native);
});

test('five D91 commercial variants have exact labels, materials, dimensions and unconfirmed reference recipes',()=>{
  const R=pureCatalog();
  assert.equal(R.products.length,2);
  assert.deepEqual(plain(R.products.map(product=>product.name).sort()),['Cubierta redonda de madera','Mesa Florencia']);
  const variants=R.products.flatMap(product=>product.variants);
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
  for(const product of R.products)for(const variant of product.variants){
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
  assert.deepEqual(plain(Object.keys(R.images).sort()),manifest.assets.map(asset=>asset.id).sort());
  for(const asset of manifest.assets){
    assert.equal(R.imageKinds[asset.id],'IA');assert.match(R.images[asset.id],/^data:image\/png;base64,/);
    assert.equal(createHash('sha256').update(Buffer.from(R.images[asset.id].split(',')[1],'base64')).digest('hex'),asset.sha256);
  }
});

test('the authored catalog and recipes are immutable and never infer a variant from its family',()=>{
  const R=pureCatalog();
  assert.equal(R.source,'LOCAL_REFERENCE_D91');
  assert.equal(Object.values(R.recipes).length,5);
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
  for(const variant of R.products.flatMap(product=>product.variants)){
    const recipe=R.recipe(variant.recipeId),created=R.instantiate(recipe.id,prefix=>prefix+'-REF-'+(++sequence),'2');
    const table=variant.id.startsWith('SYN-NUBE');
    assert.deepEqual(plain(created.wood.map(row=>row.name)),table?['CUBIERTA','PATAS','TRAVESAÑOS']:['CUBIERTA']);
    assert.deepEqual(plain(created.wood.map(row=>row.quantityPerProduct)),table?['1','4','2']:['1']);
    assert.deepEqual(plain(created.wood.map(row=>[row.width,row.length])),table?[['60','60'],['50','6'],['60','4']]:[['81','81']]);
    assert.ok(created.wood.every(row=>row.wasteRate==='30'&&row.woodKind===variant.materials));
    assert.ok(created.wood.every(row=>row.cnc.decision===''&&row.cnc.length===''),'A global documented CNC length must not assign a CNC decision to every piece');
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
    assert.equal(variants.length,5);
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
    assert.equal(h.c.app.lineCatalog.products.flatMap(product=>product.variants).length,5);
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
  h.c.solidWoodOpen(item.id,h.c.solidWoodState(item.id).applied[0].id);
  const woodHtml=h.nodes.get('workspace').innerHTML;
  for(const group of ['unit','price','result','exceptions','cnc'])assert.ok(woodHtml.includes('data-editor-group="'+group+'"'),'The real D91 wood presentation renders '+group);
  assert.match(woodHtml,/wood-editor-ordered wood-unit-pricing/);
  assert.match(woodHtml,/data-break-action="save-editor"[^>]*>Aplicar<\/button>/);
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
    const workspace=h.nodes.get('workspace').innerHTML,editorAt=workspace.indexOf('<section class="break-editor tech-entry is-open" aria-label="Editor de compra">');
    let purchase='',depth=0;
    const sections=/<\/?section\b[^>]*>/g;sections.lastIndex=editorAt;
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

test('D91 documentary subtotals render partial coverage without mutating costs or scaling one-article references',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  const item=h.c.app.q.items.find(row=>row.id===itemId),recipe=h.R.recipe(h.c.recipeEntry(itemId).recipeId);
  const before=JSON.stringify({quote:h.c.app.q,local:plain(h.c.solidWoodState(itemId).applied),metadata:h.c.recipeEntry(itemId)});
  const html=h.c.recipeSourceCostsHtml(item);
  assert.match(html,/Costos documentados de la receta/);
  assert.match(html,/Referencia de una unidad del Artículo/);
  assert.match(html,/no es una compra adicional/);
  assert.match(html,/1,083\.27/);assert.match(html,/243\.21/);assert.match(html,/659\.08/);assert.match(html,/22\.00/);
  assert.match(html,/data-reference-status="PARTIAL"/);assert.match(html,/8 renglón\(es\) pendiente\(s\)/);
  assert.match(html,/una celda vacía no significa costo cero/);
  assert.match(html,/CNC: 2\.44 m × 5 min\/m × 10\.00 por minuto/);
  assert.doesNotMatch(html,/C:[\\/]|file:\/\/|https?:\/\/|\.xlsx\b/i);
  for(const section of recipe.documentary.sections){
    assert.ok(html.includes('data-recipe-subtotal="'+section.title+'"'),'Every documentary section has its own subtotal');
  }
  assert.equal(JSON.stringify({quote:h.c.app.q,local:plain(h.c.solidWoodState(itemId).applied),metadata:h.c.recipeEntry(itemId)}),before,'Rendering the historical disclosure is read only');
  editPart(h,itemId,'quantity','2','number');assert.equal(h.c.partApply(),true);
  assert.equal(h.c.recipeSourceCostsHtml(h.c.app.q.items.find(row=>row.id===itemId)),html,'One-article historical reference is not an actual cost and does not scale with ordered quantity');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).materials.map(row=>row.purchaseQuantity)),['8','8'],'Actual editable purchases still scale once');
  assert.deepEqual(plain(itemRow(h.c.app.q,itemId).processes),[]);
  const summary=h.Q.summary('DEMO-RECIPE');assert.equal(summary.complete,false);assert.match(summary.blockers.join(' '),/Madera F/);
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
  assert.match(h.Q.summary('DEMO-RECIPE').blockers.join(' '),/Madera F/,'Only the remaining recipe still blocks financial completion');
  await remove(second.itemId);
  assert.equal(h.c.app.solidWoodLocal.articles.has(second.itemId),false);
  for(const [id,local] of h.c.app.solidWoodLocal.articles){assert.ok(h.c.app.q.items.some(item=>item.id===id));assert.equal(local.applied.length,0);}
  assert.deepEqual(plain(h.c.app.syntheticRecipes.articles),{});
  assert.doesNotMatch(h.Q.summary('DEMO-RECIPE').blockers.join(' '),/Madera F/);
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
  assert.equal(h.c.app.lineCatalog.products.length,2);assert.equal(h.R.recipes.length,5);
});

test('pending PartDraft, unknown saves and frozen snapshots cannot be bypassed by direct recipe actions',async()=>{
  const h=harness();h.open();const {itemId}=await h.select('SYN-NUBE-C');
  editPart(h,itemId,'description','Cambio pendiente');const count=h.c.app.q.items.length;
  h.c.lineAction('line-add',{dataset:{}});assert.equal(typeof h.c.app.partContinuation,'function');assert.equal(h.c.app.q.items.length,count);
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
  const summary=h.Q.summary('DEMO-101');assert.equal(summary.complete,false);assert.match(summary.blockers.join(' '),/Madera F/);
  assert.equal((await h.Q.save('DEMO-101')).state,'blocked');assert.equal(h.Q.snapshot('DEMO-101'),null);assert.equal(h.Q.freeze('DEMO-101'),null);
  await action('stage',{screen:'review'});assert.notEqual(J.inspect().state.screen,'review');await action('stay');
  await action('validate');await action('send');await action('convert');
  const record=J.inspect().records.find(row=>row.id==='DEMO-101');
  assert.equal(record.review,null);assert.equal(record.sent,null);assert.equal(record.project,null);assert.equal(record.versions.length,0);
  assert.equal(J.portfolio().totalCents,21000000,'A recipe preview must not enter the accepted-sales universe');
});
