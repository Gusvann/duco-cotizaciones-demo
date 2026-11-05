import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Handler integration in a Node VM with the shipped domain, bridge and journey.
// DOM substitutes exercise state/markup only, never browser layout or focus behavior.
// No browser, server, network, services, persistent storage, or operational data.
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const template=read('cotizador.html');
// A test run uses one immutable source checkpoint, even if a collaborator edits later.
const scripts=['country-codes.js','demo-phone.js','recipe-reference.js','recipe-catalog.js','quote-bridge.js','portfolio-kpis.js','project-operations.js','project-views.js','journey.js'].map(name=>[name,read(name)]);
const domain=[...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1])
  .find(source=>source.includes('var QuoteSchema')&&source.includes('var QuoteManufacturing_'));
if(!domain) throw new Error('The shared public domain is required.');
const plain=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const escaped=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function detailControl(html,kind,key){
  return [...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0])
    .find(tag=>tag.includes('data-action="kpi-detail"')&&tag.includes('data-kind="'+escaped(kind)+'"')&&tag.includes('data-key="'+escaped(key)+'"'));
}
function detailIds(html){
  const start=html.indexOf('id="j-kpi-detail"');
  assert.ok(start>=0,'A selected chart or legend opens the detail panel');
  const detail=html.slice(start,html.indexOf('</section>',start));
  return [...detail.matchAll(/<button\b[^>]*data-action="kpi-open"[^>]*data-id="([^"]+)"/g)].map(match=>match[1]).sort();
}
const donutTotals=html=>[...html.matchAll(/<strong class="j-donut-total">([^<]*)<\/strong>/g)].map(match=>match[1]);
function portfolioRecord(id,netCents,clientId='a'){
  const request={title:'Render sintético '+id,client:'Cliente de ejemplo'};
  return {id,request,clientId,category:'horeca',commercialType:'line',version:1,acceptedVersion:1,requestedAt:'2026-10-01',firstSentAt:'2026-10-03',poAt:'2026-10-07',project:null,
    versions:[{version:1,quoteVersionId:'opaque-'+id,clientId,category:'horeca',commercialType:'line',sentAt:'2026-10-03',snapshot:{quote:{id,versionId:'opaque-'+id},request,summary:{priceCents:netCents}},response:{result:'accepted',version:1,at:'2026-10-06'}}]};
}

async function harness({mobile=false,portfolioFixtures=false}={}){
  const sandbox=vm.createContext({structuredClone,queueMicrotask});
  vm.runInContext(domain,sandbox,{filename:'public-domain.js'});
  vm.runInContext(`
    globalThis.window=globalThis;
    globalThis.__mobile=${mobile};
    globalThis.__events=new Map();
    globalThis.__nodes=new Map();
    function element(id=''){
      return {id,innerHTML:'',textContent:'',hidden:false,inert:false,dataset:{},disabled:false,
        listeners:new Map(),style:{},
        addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);},
        contains(target){return target===this||target?.container===this;},
        querySelector(){return null;},querySelectorAll(){return [];},
        focus(){document.activeElement=this;},scrollIntoView(){},replaceChildren(){this.innerHTML='';},
        remove(){},before(){},setAttribute(){},removeAttribute(){},getClientRects(){return [{}];}};
    }
    for(const id of ['journey-root','journey-footer','quote-host','workspace','j-main']) __nodes.set(id,element(id));
    globalThis.document={activeElement:null,
      getElementById(id){return __nodes.get(id)||null;},createElement(){return element();},
      addEventListener(type,fn){const list=__events.get(type)||[];list.push(fn);__events.set(type,list);}};
    globalThis.matchMedia=()=>({matches:__mobile});
    globalThis.__client={app:{epoch:0,inputErrors:new Map()},D:QuoteDomain,editor(){},
      partDraftDirty(){return Boolean(this.app.partDraft);},
      partApply(){this.app.partDraft=null;this.app.breakdownEditor=null;return true;},
      partDiscard(){this.app.partDraft=null;this.app.breakdownEditor=null;}};
    for(const key of ['fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','indexedDB'])
      Object.defineProperty(globalThis,key,{get(){throw new Error('Forbidden external/storage API: '+key);}});
  `,sandbox);
  for(const [name,source] of scripts){
    vm.runInContext(source,sandbox,{filename:name});
    if(name==='portfolio-kpis.js'&&portfolioFixtures){
      // Render edge states through the actual pure compute; only the dataset is injected.
      sandbox.__testPortfolioRecords=[];sandbox.__testPortfolioClients={};
      vm.runInContext(`(() => {const shipped=DemoPortfolio;globalThis.DemoPortfolio=Object.freeze({...shipped,
        compute(_records,filters){return shipped.compute(__testPortfolioRecords,filters,__testPortfolioClients);}});})();`,sandbox);
    }
  }
  assert.ok(sandbox.DemoJourney.ready&&typeof sandbox.DemoJourney.ready.then==='function','Journey exposes initial seeding completion');
  await sandbox.DemoJourney.ready;
  await settle();
  const root=sandbox.__nodes.get('journey-root');
  const footer=sandbox.__nodes.get('journey-footer');
  const dispatch=async(type,target,container=root)=>{
    for(const listener of container.listeners.get(type)||[]) listener({target,preventDefault(){}});
    await settle();
  };
  const click=async(action,data={},container=root)=>{
    const target={dataset:{action,...data},container,disabled:false,closest(){return this;}};
    await dispatch('click',target,container);
  };
  const field=async(id,value,{type='change',checked,container=root}={})=>
    dispatch(type,{id,value,checked,container,dataset:{}},container);
  const key=async(key,target={closest(){return null;}})=>{
    let prevented=false;
    for(const listeners of [root.listeners.get('keydown'),sandbox.__events.get('keydown')])
      for(const listener of listeners||[]) listener({key,target,preventDefault(){prevented=true;}});
    await settle();return prevented;
  };
  const inspect=()=>plain(sandbox.DemoJourney.inspect());
  const metrics=filters=>{const value=inspect();return plain(sandbox.DemoPortfolio.compute(value.records,filters||{},value.clients));};
  const setPortfolioFixtures=(records,clients={})=>{
    assert.ok(portfolioFixtures,'Projection fixture injection must be explicit');
    sandbox.__testPortfolioRecords=structuredClone(records);sandbox.__testPortfolioClients=structuredClone(clients);
  };
  return {sandbox,root,footer,click,field,key,inspect,metrics,setPortfolioFixtures,Q:sandbox.DemoQuote,app:sandbox.__client.app};
}

test('session presentation hides testing labels without hiding the session and recovery context',async()=>{
  const h=await harness();
  const text=()=>[h.root.innerHTML,h.footer.innerHTML].join(' ').replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  const check=()=>{
    assert.doesNotMatch(text(),/DEMO LOCAL|\b(?:UAT|PREVIEW|PENDING_CONFIG|PARAMETER_PENDING)\b|\bsimulaci[oó]n\b|\bsimulad[ao]s?\b|datos sint[eé]ticos/i);
    assert.match(text(),/SÓLO EN ESTA SESIÓN/);
    assert.match(text(),/Los cambios se conservan sólo durante esta sesión/);
  };
  check();await h.click('open',{id:'DEMO-101'});check();
  await h.click('stage',{screen:'quote'});check();
  await h.click('kpis');check();
});

test('quote omits the duplicate action strip but preserves native saving, status and unknown-result recovery',async()=>{
  const h=await harness();
  const clean=()=>{
    assert.doesNotMatch(h.root.innerHTML,/Clasificación comercial e hitos sintéticos|j-classification|data-kpi-field/);
    assert.doesNotMatch(h.root.innerHTML,/Cambios de borrador en memoria|Datos sintéticos, sólo en memoria\. La recarga reinicia la simulación\./);
  };
  await h.click('open',{id:'DEMO-101'});
  clean();
  assert.doesNotMatch(h.root.innerHTML,/j-save-strip|data-action="save"/,'Request omits the duplicate upper strip; the native form owns save');
  assert.match(h.root.innerHTML,/data-action="stage" data-screen="quote"/,'Request keeps access to the editor');
  assert.match(h.root.innerHTML,/<strong class="j-save-status" role="status" hidden><\/strong>/,'An unused status has no visible placeholder');
  await h.sandbox.DemoJourney.saveCurrent();
  clean();
  assert.match(h.root.innerHTML,/<strong class="j-save-status" role="status">Guardado durante esta sesión<\/strong>/);
  await h.click('stage',{screen:'quote'});
  clean();
  assert.doesNotMatch(h.root.innerHTML,/j-save-strip|data-action="save"/,'Quote has no duplicate upper action band');
  assert.match(h.footer.innerHTML,/data-action="stage" data-screen="review"/,'Review remains available in the footer with its existing guard');
  h.app.partDraft={synthetic:true};
  await h.click('toggle-menu');
  assert.match(h.root.innerHTML,/<strong class="j-save-status" role="status">Captura sin aplicar<\/strong>/);
  await h.click('discard-pending');
  h.app.q.items[0].unitPrice='4000';
  await h.field('j-save-outcome','unknown',{container:h.footer});
  // This is the same entry point used by the embedded native Save button.
  await h.sandbox.DemoJourney.saveCurrent();
  clean();
  assert.match(h.root.innerHTML,/<strong class="j-save-status" role="status">Resultado de guardado desconocido<\/strong>/);
  assert.doesNotMatch(h.root.innerHTML,/j-save-strip|id="j-resolve-save"/);
  assert.match(h.footer.innerHTML,/id="j-resolve-save"/,'Recovery remains reachable after removing the duplicate strip');
  await h.click('resolve-save',{},h.footer);
  assert.match(h.root.innerHTML,/<strong class="j-save-status" role="status">Guardado durante esta sesión<\/strong>/);
  assert.doesNotMatch(h.footer.innerHTML,/id="j-resolve-save"/,'Confirmed results remove the recovery action');
  assert.equal(h.metrics().totalCents,21000000,'Removing presentation does not alter accepted sales');
});

test('active steps reveal themselves horizontally without scrolling the form vertically',async()=>{
  const h=await harness();
  await h.click('open',{id:'DEMO-101'});
  await h.click('stage',{screen:'quote'});
  const scrollingNavigation=()=>{
    let target={left:350,right:490};
    const navigation={scrollLeft:0,scrollTop:75,
      getBoundingClientRect:()=>({left:0,right:320}),
      querySelector:()=>({
        getBoundingClientRect:()=>({left:target.left-navigation.scrollLeft,right:target.right-navigation.scrollLeft}),
        scrollIntoView(){throw Error('Navigation must not scroll the document vertically');}
      })};
    return {navigation,target:value=>{target=value;}};
  };
  const outer=scrollingNavigation(),inner=scrollingNavigation();
  h.root.querySelector=selector=>selector==='.j-stages'&&h.root.innerHTML.includes('class="j-stages"')?outer.navigation:null;
  h.sandbox.__nodes.get('quote-host').querySelector=selector=>selector==='.steps'?inner.navigation:null;
  await h.click('toggle-menu');
  assert.doesNotMatch(h.root.innerHTML,/class="j-stages"/,'The quote editor has one section bar');
  assert.equal(outer.navigation.scrollLeft,0,'The absent commercial menu does not scroll');
  for(const {navigation} of [inner]) {
    assert.equal(navigation.scrollLeft,170,'A later active step is revealed at the right edge');
    assert.equal(navigation.scrollTop,75,'Vertical position is preserved');
  }
  outer.target({left:20,right:100});inner.target({left:20,right:100});
  await h.click('toggle-menu');
  for(const {navigation} of [inner]) {
    assert.equal(navigation.scrollLeft,20,'Returning to an earlier step reveals its left edge');
    assert.equal(navigation.scrollTop,75,'Returning never moves the form vertically');
  }
});

test('request can continue without saving and unknown saves require explicit resolution',async()=>{
  const h=await harness();
  await h.click('open',{id:'DEMO-101'});
  assert.doesNotMatch(h.root.innerHTML,/j-save-strip/);
  h.app.q.name='Solicitud editada sin guardar';
  assert.equal(h.Q.snapshot('DEMO-101'),null);
  await h.click('stage',{screen:'quote'});
  assert.equal(h.inspect().state.screen,'quote');
  assert.equal(h.inspect().state.guard,null);
  assert.equal(h.Q.snapshot('DEMO-101'),null,'Continuing does not create a save');
  assert.equal(h.app.q.name,'Solicitud editada sin guardar');
  assert.equal(await h.sandbox.DemoJourney.saveCurrent(),true);
  const previous=h.Q.snapshot('DEMO-101');
  await h.click('stage',{screen:'request'});
  assert.equal(h.inspect().state.screen,'request');
  h.app.q.name='Cambio con resultado desconocido';
  await h.field('j-save-outcome','unknown',{container:h.footer});
  assert.equal(await h.sandbox.DemoJourney.saveCurrent(),false);
  assert.match(h.root.innerHTML,/id="j-resolve-save"/,'Recovery is visible outside the inert form');
  assert.equal(h.sandbox.__nodes.get('quote-host').inert,true);
  assert.equal(h.Q.snapshot('DEMO-101').quote.name,previous.quote.name);
  await h.click('stage',{screen:'quote'});
  assert.equal(h.inspect().state.guard,'unknown','The outer stage navigation cannot bypass an unknown outcome');
  assert.equal(h.inspect().state.screen,'request');
  await h.click('stay',{},h.footer);
  await h.click('resolve-save');
  assert.equal(h.Q.summary('DEMO-101').saveState,'success');
  assert.equal(h.Q.snapshot('DEMO-101').quote.name,'Cambio con resultado desconocido');
  assert.doesNotMatch(h.root.innerHTML,/id="j-resolve-save"/);
});

test('accepted synthetic version and project use the same phone without an extension',async()=>{
  const h=await harness();
  await h.click('open',{id:'DEMO-101'});
  h.app.q.contactPhone='+52 55 0000 0018 ext. 09';
  assert.equal(await h.sandbox.DemoJourney.saveCurrent(),true);
  const snapshot=h.Q.snapshot('DEMO-101');
  assert.equal(snapshot.quote.contactPhone,'+52 55 0000 0018');
  assert.equal(snapshot.request.contactPhone,'+52 55 0000 0018');
  assert.equal(snapshot.summary.priceCents,600000);
  await h.click('stage',{screen:'review'});
  await h.field('j-review-technical','',{checked:true});
  await h.field('j-review-commercial','',{checked:true});
  await h.click('validate');
  await h.click('stage',{screen:'offer'});await h.click('send');
  await h.click('stage',{screen:'response'});
  await h.field('j-evidence','Aceptación ficticia de esta versión.',{type:'input'});
  await h.field('j-exact-version','',{checked:true});
  await h.click('register-response');
  await h.click('stage',{screen:'project'});await h.click('convert');
  const record=h.inspect().records.find(row=>row.id==='DEMO-101');
  assert.equal(record.sent.snapshot.quote.contactPhone,'+52 55 0000 0018');
  assert.equal(record.versions[0].snapshot.request.contactPhone,'+52 55 0000 0018');
  assert.equal(record.project.baseline.quote.contactPhone,'+52 55 0000 0018');
  assert.equal(record.acceptedVersion,1);
  assert.equal(record.project.baseline.summary.priceCents,600000);
});

test('native synthetic fixtures have accepted V1 prices, complete category coverage and a pending historical amount',async()=>{
  const h=await harness();
  const {records}=h.inspect();
  assert.equal(records.length,12);
  assert.deepEqual([...new Set(records.map(row=>row.category))].sort(),['brands','horeca','lab','logistics','offices','residential','retail']);
  const result=h.metrics({period:'year'});
  assert.equal(result.totalCents,21000000);
  assert.equal(result.eligible.length,7);
  assert.equal(result.priced.length,6);
  assert.deepEqual(result.pending.map(row=>row.id),['DEMO-209']);
  const draft=records.find(row=>row.id==='DEMO-201');
  assert.equal(draft.version,2);
  assert.equal(draft.sent,null);
  assert.equal(result.eligible.find(row=>row.id===draft.id).netCents,1000000);
  assert.notEqual(h.Q.summary(draft.id).saveState,'success');
  assert.equal(result.activity.projects,4);
  assert.equal(result.segments.find(row=>row.key==='recurring').totalCents,5000000);
  assert.equal(result.segments.find(row=>row.key==='new').totalCents,10000000);
  assert.equal(result.segments.find(row=>row.key==='unknown').totalCents,6000000);
});

test('KPI navigation, tabs, category and calendar basis use the same projected records',async()=>{
  const h=await harness();
  await h.click('kpis');
  assert.equal(h.inspect().state.screen,'kpis');
  assert.match(h.root.innerHTML,/j-kpi-period/);
  assert.match(h.root.innerHTML,/Ventas del período/);
  assert.match(h.root.innerHTML,/Ticket promedio/);
  assert.match(h.root.innerHTML,/Preparación/);
  assert.match(h.root.innerHTML,/Cierre/);
  assert.match(h.root.innerHTML,/MXN sin IVA/);
  for(const key of ['sales-client','sales-category']) assert.ok(h.root.innerHTML.includes('data-kpi-chart="'+key+'"'));
  assert.match(h.root.innerHTML,/data-kpi-stacked="sales"/);
  await h.field('j-kpi-period','october');
  await h.field('j-kpi-category','retail');
  await h.field('j-kpi-basis','poAt');
  await h.click('kpi-tab',{tab:'sales'});
  const state=h.inspect().state;
  assert.deepEqual(state.kpis,{period:'october',category:'retail',basis:'poAt',tab:'sales',ranking:'client',detail:null});
  for(const key of ['received-client','accepted-client']) assert.ok(h.root.innerHTML.includes('data-kpi-chart="'+key+'"'));
  for(const key of ['all','horeca','offices','brands','lab','residential','retail','logistics']) assert.ok(h.root.innerHTML.includes('data-kpi-ticket="'+key+'"'));
  assert.match(h.root.innerHTML,/data-kpi-stacked="requests"/);
  for(const key of ['new','recurring']) assert.ok(h.root.innerHTML.includes('data-kpi-chart="segment-'+key+'"'));
  assert.doesNotMatch(h.root.innerHTML,/data-kpi-chart="segment-unknown"/,'No unknown-segment donut is invented when the selected sales cohort is empty');
  const result=h.metrics(state.kpis);
  assert.equal(result.totalCents,0);
  assert.equal(result.eligible.length,0);
  assert.equal(result.prepN,1,'Times use acceptance even when PO has no sale');
  assert.equal(result.prepDays,4);
  assert.equal(result.closeDays,5);
  await h.click('kpi-tab',{tab:'times'});
  for(const key of ['line','project']) assert.ok(h.root.innerHTML.includes('data-kpi-timing="'+key+'"'));
  assert.match(h.root.innerHTML,/Cierre · Producto de línea/);
  assert.match(h.root.innerHTML,/Cierre · Proyecto/);
});

test('detail opens the same expediente and return preserves tab, filters and detail',async()=>{
  const h=await harness();
  await h.click('kpis');
  await h.field('j-kpi-period','october');
  await h.click('kpi-tab',{tab:'sales'});
  assert.match(h.root.innerHTML,/data-kpi-chart="segment-unknown"/);
  await h.click('kpi-detail',{kind:'client',key:'CL-DEMO-F'});
  const selected=plain(h.inspect().state.kpis);
  assert.match(h.root.innerHTML,/DEMO-206/);
  await h.click('kpi-open',{id:'DEMO-206'});
  assert.equal(h.inspect().state.id,'DEMO-206');
  assert.equal(h.inspect().state.screen,'record');
  assert.match(h.root.innerHTML,/Ficha del mismo expediente/);
  assert.match(h.root.innerHTML,/60,000\.00/);
  await h.click('return-kpis');
  assert.equal(h.inspect().state.screen,'kpis');
  assert.deepEqual(h.inspect().state.kpis,selected);
  const requestSelection=JSON.stringify({month:'2026-10',client:'CL-DEMO-B'});
  assert.ok(detailControl(h.root.innerHTML,'request-month-client',requestSelection),'The request stack exposes an accessible month/client control');
  await h.click('kpi-detail',{kind:'request-month-client',key:requestSelection});
  assert.deepEqual(detailIds(h.root.innerHTML),['DEMO-102']);
  const requestState=plain(h.inspect().state.kpis);
  await h.click('kpi-open',{id:'DEMO-102'});
  await h.click('return-kpis');
  assert.deepEqual(h.inspect().state.kpis,requestState);
  await h.field('j-kpi-period','year');
  for(const [kind,key,expected] of [
    ['received-client','CL-DEMO-B',['DEMO-102','DEMO-202','DEMO-208']],
    ['accepted-client','CL-DEMO-B',['DEMO-202']],
    ['segment-client',JSON.stringify({segment:'new',client:'CL-DEMO-B'}),['DEMO-202']],
    ['segment-client',JSON.stringify({segment:'unknown',client:'CL-DEMO-F'}),['DEMO-206']]
  ]){
    assert.ok(detailControl(h.root.innerHTML,kind,key),'A native legend button exposes '+kind);
    await h.click('kpi-detail',{kind,key});
    assert.deepEqual(detailIds(h.root.innerHTML),expected);
  }
  await h.click('kpi-tab',{tab:'summary'});
  const saleSelection=JSON.stringify({month:'2026-10',client:'CL-DEMO-F'});
  assert.ok(detailControl(h.root.innerHTML,'month-client',saleSelection));
  await h.click('kpi-detail',{kind:'month-client',key:saleSelection});
  assert.deepEqual(detailIds(h.root.innerHTML),['DEMO-206']);
  assert.match(h.root.innerHTML,/<[^>]*role="button"[^>]*tabindex="0"[^>]*data-kpi-chart-action/,'Interactive chart marks expose a keyboard role and tab stop');
  for(const [key,kind,value,expected] of [['Enter','client','CL-DEMO-B',['DEMO-202']],[' ','category','brands',['DEMO-203','DEMO-209']]]){
    const target={container:h.root,dataset:{action:'kpi-detail',kind,key:value},closest(selector){return selector==='[data-kpi-chart-action]'?this:null;}};
    assert.equal(await h.key(key,target),true,'Chart activation consumes '+JSON.stringify(key));
    assert.deepEqual(detailIds(h.root.innerHTML),expected);
  }
});

test('chart legends escape text, keep stable IDs/colors, and distinguish empty, pending, zero, overflow and exact cents',async()=>{
  const h=await harness({portfolioFixtures:true});
  const label='Cliente <svg onload="x"> & "igual" \'prueba\'';
  const clients={a:{name:label,firstSaleAt:'2025-01-01'},b:{name:label,firstSaleAt:'2025-01-01'}};
  const values=[portfolioRecord('DEMO-LEGEND-A',10000,'a'),portfolioRecord('DEMO-LEGEND-B',30000,'b')];
  h.setPortfolioFixtures(values,clients);await h.click('kpis');
  assert.ok(h.root.innerHTML.includes(escaped(label)));
  assert.doesNotMatch(h.root.innerHTML,/<svg\s+onload=/i);
  for(const key of ['a','b']) assert.ok(detailControl(h.root.innerHTML,'client',key),'Identical labels retain separate accessible client controls');
  const colors=html=>Object.fromEntries(['a','b'].map(key=>{
    const pattern=new RegExp('<button\\b[^>]*data-kind="client"[^>]*data-key="'+key+'"[^>]*>([\\s\\S]*?)<\\/button>');
    const button=html.match(pattern)?.[1];
    assert.ok(button,'Client legend '+key+' is available without relying on the colored mark');
    const color=button.match(/--chart-color:(#[0-9a-f]+)/i)?.[1];
    assert.ok(color,'The client legend exposes its existing color token');
    return [key,color];
  }));
  const firstColors=colors(h.root.innerHTML);
  h.setPortfolioFixtures([...values].reverse(),clients);await h.click('kpis');
  assert.deepEqual(colors(h.root.innerHTML),firstColors,'Color follows the stable client ID rather than source order');
  h.setPortfolioFixtures([],clients);await h.click('kpis');
  assert.deepEqual(donutTotals(h.root.innerHTML),['Sin datos','Sin datos']);
  assert.match(h.root.innerHTML,/Sin observaciones/);
  assert.doesNotMatch(h.root.innerHTML,/\bdata-kpi-chart-action\b/,'Empty data cannot create an interactive proportional mark');
  h.setPortfolioFixtures([portfolioRecord('DEMO-RENDER-PENDING',null)],clients);await h.click('kpis');
  assert.deepEqual(donutTotals(h.root.innerHTML),['Pendiente','Pendiente']);
  assert.match(h.root.innerHTML,/Importes pendientes/);
  assert.doesNotMatch(h.root.innerHTML,/\bdata-kpi-chart-action\b/,'A missing price is not a zero-price share');
  h.setPortfolioFixtures([portfolioRecord('DEMO-RENDER-ZERO',0)],clients);await h.click('kpis');
  assert.deepEqual(donutTotals(h.root.innerHTML),['$0.00','$0.00']);
  assert.match(h.root.innerHTML,/no hay área proporcional/);
  assert.doesNotMatch(h.root.innerHTML,/\bdata-kpi-chart-action\b/);
  h.setPortfolioFixtures([portfolioRecord('DEMO-RENDER-OVERFLOW-A',Number.MAX_SAFE_INTEGER),portfolioRecord('DEMO-RENDER-OVERFLOW-B',1)],clients);await h.click('kpis');
  assert.deepEqual(donutTotals(h.root.innerHTML),['Fuera de rango','Fuera de rango']);
  assert.match(h.root.innerHTML,/excede el rango seguro/);
  assert.doesNotMatch(h.root.innerHTML,/\bdata-kpi-chart-action\b/,'Overflow cannot silently become a valid share');
  h.setPortfolioFixtures([portfolioRecord('DEMO-RENDER-MAX-SAFE',Number.MAX_SAFE_INTEGER)],clients);await h.click('kpis');
  assert.deepEqual(donutTotals(h.root.innerHTML),['$90,071,992,547,409.91','$90,071,992,547,409.91'],'The last cent must survive rendering at the safe-integer limit');
});

test('leaving a dirty quote for KPIs requires an explicit choice; Escape preserves it',async()=>{
  const h=await harness();
  await h.click('open',{id:'DEMO-101'});
  h.app.q.items[0].unitPrice='4000';
  await h.click('kpis');
  assert.equal(h.inspect().state.guard,'dirty');
  assert.equal(h.inspect().state.screen,'request');
  assert.equal(h.Q.summary('DEMO-101').priceCents,800000);
  assert.equal(await h.key('Escape'),true);
  assert.equal(h.inspect().state.guard,null);
  assert.equal(h.inspect().state.screen,'request');
  assert.equal(h.app.q.items[0].unitPrice,'4000');
  await h.click('kpis');
  await h.click('keep-and-leave');
  assert.equal(h.inspect().state.screen,'kpis');
  assert.equal(h.Q.summary('DEMO-101').priceCents,800000);
  assert.equal(h.metrics().totalCents,21000000,'An applied unsaved quote is not a sale');
});

test('mobile KPI navigation closes its drawer before showing a dirty-draft guard',async()=>{
  const h=await harness({mobile:true});
  await h.click('open',{id:'DEMO-101'});
  h.app.q.items[0].unitPrice='4000';
  await h.click('toggle-menu');
  assert.equal(h.inspect().state.menu,true);
  await h.click('kpis');
  assert.equal(h.inspect().state.menu,false);
  assert.equal(h.inspect().state.guard,'dirty');
  assert.doesNotMatch(h.root.innerHTML,/aria-modal="true"/,'The guarded journey and the mobile drawer cannot both be modal');
  assert.match(h.footer.innerHTML,/role="alertdialog"/);
  await h.click('stay');
  assert.equal(h.inspect().state.screen,'request');
  assert.equal(h.Q.summary('DEMO-101').priceCents,800000);
});

test('capture pending, failed and unknown saves retain distinct guards without creating a sale',async()=>{
  const h=await harness();
  await h.click('open',{id:'DEMO-101'});
  h.app.partDraft={synthetic:true};
  await h.click('kpis');
  assert.equal(h.inspect().state.guard,'pending');
  await h.click('discard-and-leave');
  assert.equal(h.inspect().state.guard,'dirty','Discarding capture does not silently discard the applied draft');
  await h.click('save-and-leave');
  assert.equal(h.inspect().state.screen,'kpis');
  await h.click('open',{id:'DEMO-101'});
  await h.field('j-save-outcome','fail',{container:h.footer});
  await h.sandbox.DemoJourney.saveCurrent();
  assert.equal(h.Q.summary('DEMO-101').saveState,'failed');
  assert.equal(h.metrics().totalCents,21000000);
  await h.field('j-save-outcome','unknown',{container:h.footer});
  await h.sandbox.DemoJourney.saveCurrent();
  assert.equal(h.Q.summary('DEMO-101').saveState,'unknown');
  await h.click('kpis');
  assert.equal(h.inspect().state.guard,'unknown');
  assert.equal(h.inspect().state.screen,'request');
  assert.equal(await h.key('Escape'),true);
  assert.equal(h.Q.summary('DEMO-101').saveState,'unknown');
  await h.click('kpis');
  await h.click('resolve-and-leave');
  assert.equal(h.inspect().state.screen,'kpis');
  assert.equal(h.Q.summary('DEMO-101').saveState,'success');
  assert.equal(h.metrics().totalCents,21000000);
});

test('historical partial references expose pending evidence and cannot review, send or convert',async()=>{
  const h=await harness();
  assert.match(h.root.innerHTML,/Consultar referencia parcial/);
  await h.click('open',{id:'DEMO-209'});
  assert.equal(h.inspect().state.id,'DEMO-209');
  assert.equal(h.inspect().state.screen,'record','A partial historical row is accessible from Mesa');
  await h.click('kpis');
  await h.click('kpi-open',{id:'DEMO-209'});
  assert.match(h.root.innerHTML,/histórica parcial/);
  assert.match(h.root.innerHTML,/data-action="stage"[^>]*data-screen="offer"/,'A real control opens the readable historical offer');
  assert.match(h.root.innerHTML,/<span>Precio aceptado sin IVA<\/span><strong>Pendiente<\/strong>/);
  for(const screen of ['review','project']){
    await h.click('stage',{screen});
    assert.notEqual(h.inspect().state.screen,screen);
  }
  await h.click('validate');
  await h.click('send');
  await h.click('convert');
  const value=h.inspect().records.find(row=>row.id==='DEMO-209');
  assert.equal(value.project,null);
  assert.equal(value.versions.length,1);
  assert.equal(value.versions[0].snapshot.summary.priceCents,null);
  assert.equal(h.metrics().totalCents,21000000);
  await h.click('stage',{screen:'offer'});
  assert.equal(h.inspect().state.screen,'offer','A historical offer remains readable as partial evidence');
  assert.match(h.root.innerHTML,/Pendiente/);
  await h.click('new-version');
  assert.equal(h.inspect().records.find(row=>row.id==='DEMO-209').version,1,'A partial reference cannot become a complete draft by cloning native defaults');
});

test('confirmed acceptance adds exactly the saved price once and conversion is idempotent',async()=>{
  const h=await harness();
  await h.click('open',{id:'DEMO-101'});
  await h.sandbox.DemoJourney.saveCurrent();
  await h.click('stage',{screen:'review'});
  await h.field('j-review-technical','',{checked:true});
  await h.field('j-review-commercial','',{checked:true});
  await h.click('validate');
  await h.click('stage',{screen:'offer'});
  await h.click('send');
  assert.equal(h.metrics().totalCents,21000000);
  await h.click('stage',{screen:'response'});
  await h.field('j-evidence','El contacto inventado acepta esta versión.',{type:'input'});
  await h.click('register-response');
  assert.equal(h.metrics().totalCents,21000000,'Evidence without exact-version confirmation is insufficient');
  await h.field('j-exact-version','',{checked:true});
  await h.click('register-response');
  const accepted=h.inspect().records.find(row=>row.id==='DEMO-101');
  assert.equal(accepted.acceptedVersion,1);
  assert.equal(h.metrics().totalCents,21600000);
  assert.equal(h.metrics({period:'october'}).totalCents,6600000);
  await h.click('stage',{screen:'project'});
  await h.click('convert');
  const project=h.inspect().records.find(row=>row.id==='DEMO-101').project;
  await h.click('convert');
  assert.deepEqual(h.inspect().records.find(row=>row.id==='DEMO-101').project,project);
  assert.equal(h.metrics().totalCents,21600000);
  assert.equal(h.metrics({period:'october'}).activity.projects,1);
});

test('reset can be cancelled with Escape and confirms deterministic fixtures and action clock',async()=>{
  const h=await harness({mobile:true});
  const initial=h.inspect().records;
  await h.click('new-request');
  const created=h.inspect().records.find(row=>row.id==='DEMO-103');
  assert.ok(created);
  await h.click('reset');
  assert.equal(h.inspect().state.guard,'reset');
  assert.equal(await h.key('Escape'),true);
  assert.equal(h.inspect().records.length,13);
  await h.click('reset');
  await h.click('confirm-reset');
  await h.sandbox.DemoJourney.ready;
  await settle();
  assert.deepEqual(h.inspect().records,initial);
  assert.deepEqual(h.inspect().state.kpis,{period:'year',category:'all',basis:'acceptedAt',tab:'summary',ranking:'client',detail:null});
  await h.click('new-request');
  assert.equal(h.inspect().records.find(row=>row.id==='DEMO-103').history[0].at,created.history[0].at);
});
