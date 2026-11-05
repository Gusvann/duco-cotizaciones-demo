import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

// Real shipped domain, bridge and journey handlers; minimal DOM checks state and
// markup only. No browser layout, backend, authentication or real services.
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
const template=read('cotizador.html');
const scripts=['country-codes.js','demo-phone.js','recipe-reference.js','recipe-catalog.js','quote-bridge.js','portfolio-kpis.js','project-operations.js','project-views.js','journey.js'].map(name=>[name,read(name)]);
const hash=source=>createHash('sha256').update(source).digest('hex');
const sourceCheckpoint={native:hash(template),scripts:Object.fromEntries(scripts.map(([name,source])=>[name,hash(source)])),test:hash(readFileSync(new URL(import.meta.url),'utf8'))};
const domain=[...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1])
  .find(source=>source.includes('var QuoteSchema')&&source.includes('var QuoteManufacturing_'));
if(!domain)throw Error('The shipped quote domain is required.');
const plain=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(){
  const sandbox=vm.createContext({structuredClone,queueMicrotask});
  vm.runInContext(domain,sandbox,{filename:'public-domain.js'});
  vm.runInContext(`
    globalThis.window=globalThis;globalThis.__events=new Map();globalThis.__nodes=new Map();
    function element(id=''){
      return {id,innerHTML:'',textContent:'',hidden:false,inert:false,dataset:{},disabled:false,style:{},listeners:new Map(),
        addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);},
        contains(target){return target===this||target?.container===this;},querySelector(){return null;},querySelectorAll(){return [];},
        focus(){document.activeElement=this;},scrollIntoView(){},replaceChildren(){this.innerHTML='';},remove(){},before(){},
        setAttribute(){},removeAttribute(){},getClientRects(){return [{}];}};
    }
    for(const id of ['journey-root','journey-footer','quote-host','workspace','j-main'])__nodes.set(id,element(id));
    globalThis.document={activeElement:null,getElementById(id){return __nodes.get(id)||null;},createElement(){return element();},
      addEventListener(type,fn){const list=__events.get(type)||[];list.push(fn);__events.set(type,list);}};
    globalThis.matchMedia=()=>({matches:false});
    globalThis.__client={app:{epoch:0,inputErrors:new Map()},D:QuoteDomain,editor(){},
      partDraftDirty(){return Boolean(this.app.partDraft);},
      partApply(){this.app.partDraft=null;this.app.breakdownEditor=null;return true;},
      partDiscard(){this.app.partDraft=null;this.app.breakdownEditor=null;}};
    for(const key of ['fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','indexedDB'])
      Object.defineProperty(globalThis,key,{get(){throw Error('Forbidden capability: '+key);}});
  `,sandbox);
  for(const [name,source]of scripts)vm.runInContext(source,sandbox,{filename:name});
  await sandbox.DemoJourney.ready;await settle();
  const root=sandbox.__nodes.get('journey-root'),footer=sandbox.__nodes.get('journey-footer');
  const dispatch=async(type,target,container=root)=>{
    for(const listener of container.listeners.get(type)||[])listener({target,preventDefault(){}});
    await settle();
  };
  const click=async(action,dataset={},container=root)=>{
    const target={dataset:{action,...dataset},container,disabled:false,closest(){return this;}};
    await dispatch('click',target,container);
  };
  const field=async(id,value,{type='change',checked,container=root,dataset={}}={})=>dispatch(type,{id,value,checked,container,dataset},container);
  const inspect=()=>plain(sandbox.DemoJourney.inspect());
  const record=id=>inspect().records.find(item=>item.id===id);
  const metrics=()=>{const snapshot=inspect();return plain(sandbox.DemoPortfolio.compute(snapshot.records,{},snapshot.clients));};
  return {sandbox,root,footer,dispatch,click,field,inspect,record,metrics,Q:sandbox.DemoQuote,app:sandbox.__client.app};
}

test('Projects is a usable global navigation entry before a quote is opened',async context=>{
  context.diagnostic('Loaded immutable source checkpoint: '+JSON.stringify(sourceCheckpoint));
  const h=await harness();
  assert.ok(/<button\b[^>]*data-action="projects"[^>]*>/.test(h.root.innerHTML),'Projects must have an enabled navigation button, not a disabled label');
  await h.click('projects');
  assert.equal(h.inspect().state.screen,'projects');
  assert.equal(h.inspect().state.id,null);
  assert.equal(h.sandbox.__nodes.get('quote-host').hidden,true);
});

// Owner correction, 2026-11-05: the process map must not be offered in navigation.
test('navigation omits the process map on desktop and in the mobile menu',async()=>{
  const h=await harness();
  for(const mobile of [false,true]){
    h.sandbox.matchMedia=()=>({matches:mobile});
    if(mobile)await h.click('toggle-menu');
    const sidebar=h.root.innerHTML.match(/<aside\b[\s\S]*?<\/aside>/)?.[0];
    assert.ok(sidebar);
    assert.doesNotMatch(sidebar,/Mapa del proceso|data-action="workflow"/);
    for(const action of ['kpis','list','projects'])assert.ok(sidebar.includes(`data-action="${action}"`));
    if(mobile)assert.match(sidebar,/role="dialog"/);
  }
});

const opIdentity=(h,id)=>{
  const record=h.record(id);
  return {id,project:record.project.id,revision:String(record.project.operations.revision)};
};
const opField=async(h,id,form,field,value,type='input')=>h.field('',value,{type,dataset:{opForm:form,opField:field,opProject:h.record(id).project.id}});
const opSave=async(h,id,action)=>h.click(action,opIdentity(h,id));
const taskStatus=async(h,id,taskId,value,extra={})=>h.field('',value,{dataset:{opTask:taskId,opProject:h.record(id).project.id,opRevision:String(h.record(id).project.operations.revision),...extra}});
async function convert(h,id='DEMO-101'){
  await h.click('open',{id});
  assert.equal(await h.sandbox.DemoJourney.saveCurrent(),true);
  await h.click('stage',{screen:'review'});
  await h.field('j-review-technical','',{checked:true});await h.field('j-review-commercial','',{checked:true});
  await h.click('validate');await h.click('stage',{screen:'offer'});await h.click('send');
  await h.click('stage',{screen:'response'});
  await h.field('j-evidence','El contacto ficticio acepta la versión exacta.',{type:'input'});
  await h.field('j-exact-version','',{checked:true});await h.click('register-response');
  const accepted=plain(h.record(id).sent.snapshot);
  await h.click('stage',{screen:'project'});await h.click('convert');
  return accepted;
}
async function fillPlan(h,id,overrides={}){
  const values={owner:'Responsable ficticio',dueDate:'2026-11-12',route:'new',installation:'no',...overrides};
  for(const [field,value]of Object.entries(values))await opField(h,id,'plan',field,value,['route','installation'].includes(field)?'change':'input');
  await opSave(h,id,'op-plan-save');
}
async function addTask(h,id,overrides={}){
  const values={title:'Verificar artículo ficticio',stage:'production',owner:'Taller de ejemplo',dueDate:'2026-11-11',...overrides};
  for(const [field,value]of Object.entries(values))await opField(h,id,'task',field,value,field==='stage'?'change':'input');
  await opSave(h,id,'op-task-add');
}
async function delivery(h,id,overrides={}){
  for(const [field,value]of Object.entries({date:'2026-11-12',recipient:'Contacto ficticio',evidence:'Recibido conforme al ejercicio local.',...overrides}))await opField(h,id,'delivery',field,value);
  await opSave(h,id,'op-delivery-save');
}

test('Projects, Production, Deliveries and workflow navigate globally without opening a quote',async()=>{
  const h=await harness();let opened=0;const original=h.Q.open;
  h.Q.open=(...args)=>{opened++;return original(...args);};
  for(const [screen,label]of [['projects','Proyectos'],['production','Producción'],['deliveries','Entregas'],['workflow','Producto nuevo']]){
    await h.click(screen);assert.equal(h.inspect().state.screen,screen);assert.equal(h.inspect().state.id,null);
    assert.ok(h.root.innerHTML.includes(label));assert.equal(h.sandbox.__nodes.get('quote-host').hidden,true);
  }
  assert.equal(opened,0,'Global navigation never opens or replaces quote capture');
  assert.match(h.root.innerHTML,/Producto de línea/);assert.match(h.root.innerHTML,/Entrega y cierre/);
});

test('conversion initializes empty operations once and preserves the exact accepted snapshot',async()=>{
  const h=await harness(),accepted=await convert(h),record=h.record('DEMO-101');
  assert.ok(record.project.operations);assert.equal(record.project.operations.projectId,record.project.id);
  assert.equal(record.project.operations.sourceId,record.id);assert.equal(record.project.operations.version,1);
  assert.equal(record.project.operations.route,'undetermined');assert.equal(record.project.operations.tasks.length,0);
  assert.deepEqual(record.project.baseline,accepted);assert.deepEqual(plain(h.Q.snapshot(record.id)),accepted);
  await h.click('projects');await h.click('project-open',{id:record.id,tab:'plan'});
  assert.equal(h.inspect().state.id,record.id);assert.match(h.root.innerHTML,/Plan del proyecto/);
  const before=plain(h.record(record.id).project);await h.click('convert');assert.deepEqual(h.record(record.id).project,before);
  assert.equal(h.record('DEMO-209').project,null,'The partial historical reference never acquires operations');
});

test('real handlers plan, add and finish tasks, receive and close without changing finances or KPIs',async()=>{
  const h=await harness(),initial=h.inspect().records,accepted=await convert(h),id='DEMO-101';
  const kpis=h.metrics(),saved=plain(h.Q.snapshot(id));
  await h.click('projects');await h.click('project-open',{id,tab:'plan'});await fillPlan(h,id);
  assert.equal(h.record(id).project.operations.owner,'Responsable ficticio');assert.equal(h.record(id).project.operations.route,'new');
  await h.click('op-tab',{...opIdentity(h,id),tab:'production'});await addTask(h,id);
  let operations=h.record(id).project.operations;assert.equal(operations.tasks.length,1);assert.equal(operations.tasks[0].status,'pending');
  await taskStatus(h,id,operations.tasks[0].id,'doing');assert.equal(h.record(id).project.operations.tasks[0].status,'doing');
  await taskStatus(h,id,operations.tasks[0].id,'done');assert.equal(h.record(id).project.operations.tasks[0].status,'done');
  await h.click('op-tab',{...opIdentity(h,id),tab:'delivery'});await delivery(h,id);
  operations=h.record(id).project.operations;assert.equal(operations.delivery.recipient,'Contacto ficticio');
  const receiptRevision=operations.revision,receiptEvents=operations.events.length;
  await opSave(h,id,'op-delivery-save');assert.equal(h.record(id).project.operations.revision,receiptRevision);assert.equal(h.record(id).project.operations.events.length,receiptEvents);
  await opSave(h,id,'op-close');assert.equal(h.record(id).project.operations.closed,true);
  const closed=plain(h.record(id).project.operations);await addTask(h,id,{title:'Intento después del cierre'});assert.deepEqual(h.record(id).project.operations,closed);
  assert.deepEqual(h.record(id).project.baseline,accepted);assert.deepEqual(plain(h.Q.snapshot(id)),saved);
  assert.deepEqual(h.record(id).sent.snapshot,accepted);assert.deepEqual(h.metrics(),kpis,'Operational status does not alter commercial KPI projections');
  await h.click('reset');await h.click('confirm-reset');
  assert.deepEqual(h.inspect().records,initial,'Reset restores the original synthetic projects and independent operation states');
});

test('foreign projects, task IDs and stale buttons cannot mutate either project',async()=>{
  const h=await harness();await convert(h);const id='DEMO-101';
  await h.click('projects');
  await h.click('project-open',{id,tab:'plan'});const stale=opIdentity(h,id);
  await fillPlan(h,id);const before=plain(h.record(id).project.operations),other=plain(h.record('DEMO-202').project.operations);
  await opField(h,id,'plan','owner','Stale attempt would overwrite this owner');
  await h.click('op-plan-save',{...stale});assert.deepEqual(h.record(id).project.operations,before);
  await opField(h,id,'plan','owner','Foreign identity attempt would overwrite this owner');
  await h.click('op-plan-save',{...opIdentity(h,id),project:h.record('DEMO-202').project.id});
  assert.deepEqual(h.record(id).project.operations,before);assert.deepEqual(h.record('DEMO-202').project.operations,other);
  await taskStatus(h,id,'TASK-FROM-ANOTHER-PROJECT','done');assert.deepEqual(h.record(id).project.operations,before);
  await opField(h,id,'plan','owner','Attempted cross-project draft');
  await h.click('project-open',{id:'DEMO-202',tab:'plan'});
  await h.click('op-plan-save',{...opIdentity(h,id)});
  assert.deepEqual(h.record(id).project.operations,before);assert.deepEqual(h.record('DEMO-202').project.operations,other);
  await h.click('project-open',{id:'DEMO-209',tab:'plan'});assert.equal(h.record('DEMO-209').project,null);
});

test('invalid inputs remain drafts, different receipts do not overwrite and foreign draft fields are ignored',async()=>{
  const h=await harness();await convert(h);const id='DEMO-101';
  await h.click('project-open',{id,tab:'plan'});await fillPlan(h,id,{dueDate:'2026-02-30'});
  assert.equal(h.record(id).project.operations.revision,0);
  await fillPlan(h,id);const before=plain(h.record(id).project.operations);
  await h.field('','Hacked owner',{type:'input',dataset:{opForm:'plan',opField:'owner',opProject:h.record('DEMO-202').project.id}});
  await opSave(h,id,'op-plan-save');assert.deepEqual(h.record(id).project.operations,before);
  await h.click('op-tab',{...opIdentity(h,id),tab:'production'});await addTask(h,id,{title:''});assert.equal(h.record(id).project.operations.tasks.length,0);
  await h.click('op-tab',{...opIdentity(h,id),tab:'delivery'});await delivery(h,id);
  const delivered=plain(h.record(id).project.operations);await delivery(h,id,{evidence:'Otra evidencia que no sustituye el recibo.'});
  assert.deepEqual(h.record(id).project.operations,delivered);
  await opSave(h,id,'op-close');assert.equal(h.record(id).project.operations.closed,false,'No tasks is not all tasks complete');
});

test('task and receipt strings retain intent and are escaped in rendered HTML',async()=>{
  const h=await harness();await convert(h);const id='DEMO-101',value='<img src=x onerror="alert(1)"> & ejemplo';
  await h.click('project-open',{id,tab:'plan'});await fillPlan(h,id,{owner:value});
  assert.equal(h.record(id).project.operations.owner,value);assert.doesNotMatch(h.root.innerHTML,/<img src=x onerror=/);
  assert.match(h.root.innerHTML,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; ejemplo/);
  await h.click('op-tab',{...opIdentity(h,id),tab:'production'});await addTask(h,id,{title:value,owner:value});
  assert.equal(h.record(id).project.operations.tasks[0].title,value);assert.doesNotMatch(h.root.innerHTML,/<img src=x onerror=/);
  await h.click('op-tab',{...opIdentity(h,id),tab:'delivery'});await delivery(h,id,{recipient:value,evidence:value});
  assert.equal(h.record(id).project.operations.delivery.evidence,value);assert.doesNotMatch(h.root.innerHTML,/<img src=x onerror=/);
  assert.match(h.root.innerHTML,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; ejemplo/);
});

test('unknown quote save still blocks navigation to Projects until explicit resolution',async()=>{
  const h=await harness();await h.click('open',{id:'DEMO-101'});assert.equal(await h.sandbox.DemoJourney.saveCurrent(),true);
  await h.click('stage',{screen:'quote'});h.app.q.name='Cambio ficticio pendiente de confirmar';
  await h.field('j-save-outcome','unknown',{container:h.footer});assert.equal(await h.sandbox.DemoJourney.saveCurrent(),false);
  const previous=plain(h.Q.snapshot('DEMO-101'));await h.click('projects');
  assert.equal(h.inspect().state.screen,'quote');assert.equal(h.inspect().state.guard,'unknown');
  assert.equal(h.sandbox.__nodes.get('quote-host').inert,true);assert.deepEqual(plain(h.Q.snapshot('DEMO-101')),previous);
  await h.click('resolve-and-leave',{},h.footer);assert.equal(h.inspect().state.screen,'projects');assert.equal(h.inspect().state.guard,null);
  assert.equal(h.Q.summary('DEMO-101').saveState,'success');assert.equal(h.Q.snapshot('DEMO-101').quote.name,'Cambio ficticio pendiente de confirmar');
});

test('opening operational lists defaults a new title-only task to the selected stage',async context=>{
  const h=await harness();
  for(const [screen,tab,id]of [['production','production','DEMO-202'],['deliveries','delivery','DEMO-203']]){
    await context.test(screen,async()=>{
      await h.click(screen);await h.click('project-open',{id,tab});
      await opField(h,id,'task','title','Tarea ficticia desde '+screen);
      await opSave(h,id,'op-task-add');
      const tasks=h.record(id).project.operations.tasks;
      assert.equal(tasks.length,1,'The title-only form creates one manual task');
      assert.equal(tasks[0].stage,tab,'The new task belongs to the stage opened from its operational list');
    });
  }
});

test('fixture routes use only the two explicitly approved examples without inference',async()=>{
  const h=await harness();await h.click('projects');
  const routes=Object.fromEntries(h.inspect().records.filter(record=>record.project).map(record=>[record.id,record.project.operations.route]));
  assert.deepEqual(routes,{'DEMO-202':'new','DEMO-203':'line','DEMO-204':'undetermined','DEMO-205':'undetermined','DEMO-207':'undetermined'});
});
