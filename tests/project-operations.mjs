import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Pure local demo operations only. These tests do not prove authentication,
// business policy, real services, browser behavior or production integration.
const source=readFileSync(new URL('../src/project-operations.js',import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function harness(){
  const sandbox=vm.createContext({});
  for(const key of ['document','fetch','XMLHttpRequest','WebSocket','localStorage','sessionStorage','indexedDB'])
    Object.defineProperty(sandbox,key,{get(){throw Error('Forbidden capability: '+key);}});
  vm.runInContext(source,sandbox,{filename:'project-operations.js'});
  return sandbox.DemoOperations;
}
const O=harness();
const project=(id='PR-DEMO-101',sourceId='DEMO-101')=>({id,sourceId,version:1,
  baseline:{quote:{id:sourceId,versionId:sourceId+'-V1',items:[{description:'Artículo ficticio',unitPrice:'3000'}]},
    request:{title:'Proyecto inventado'},summary:{complete:true,priceCents:600000,totalCents:696000,costCents:279741}}});
const at='2026-11-05T12:00:00.000Z';
const command=(state,type,payload={},extra={})=>({projectId:state.projectId,expectedRevision:state.revision,type,payload,at,actor:'Account de ejemplo',...extra});
function update(state,type,payload={},extra={}){
  const result=O.apply(state,command(state,type,payload,extra));
  assert.equal(result.ok,true,result.message);
  return result.state;
}
const task=(id='TASK-1',extra={})=>({id,title:'Tarea manual ficticia',stage:'production',owner:'Diseño de ejemplo',dueDate:'2026-11-12',...extra});
const receipt=(extra={})=>({date:'2026-11-12',recipient:'Contacto ficticio',evidence:'Recepción de ejemplo confirmada.',...extra});
function rejectUnchanged(state,type,payload={},extra={},code){
  const before=plain(state),result=O.apply(state,command(state,type,payload,extra));
  assert.equal(result.ok,false);
  if(code)assert.equal(result.code,code);
  assert.deepEqual(plain(state),before,'Rejected operations never mutate their input');
  assert.deepEqual(plain(result.state),before,'Rejected operations retain the previous state');
  return result;
}

test('new operations have explicit empty state, frozen catalogs and no copied financial or legacy data',()=>{
  const original=project(),before=plain(original),state=O.create(original);
  assert.deepEqual(plain(state),{projectId:'PR-DEMO-101',sourceId:'DEMO-101',version:1,revision:0,route:'undetermined',owner:'',dueDate:'',installation:'pending',tasks:[],delivery:null,closed:false,events:[]});
  assert.deepEqual(plain(original),before);
  assert.deepEqual(plain(O.stages).map(row=>row.id),['plan','supply','production','delivery']);
  assert.deepEqual(plain(O.routes),{new:'Producto nuevo',line:'Producto de línea',mixed:'Mixto',undetermined:'Por definir'});
  assert.ok(Object.isFrozen(O)&&Object.isFrozen(O.stages)&&O.stages.every(Object.isFrozen)&&Object.isFrozen(O.routes));
  assert.equal('baseline' in state,false);
  assert.equal(O.create({...original,title:'Producto de línea'}).route,'undetermined','Legacy text never determines routing');
  assert.equal(O.create(original,{route:'line'}).route,'line');
});

test('create rejects missing, partial or foreign quote identities and unsafe prices',()=>{
  const fixtures=[null,{}, {...project(),id:''},{...project(),sourceId:'OTHER'}, {...project(),version:0},
    {...project(),baseline:null}, {...project(),historicalPartial:true}];
  for(const bad of [null,-1,0.5,Number.MAX_SAFE_INTEGER+1,'600000']){
    const p=project();p.baseline.summary.priceCents=bad;fixtures.push(p);
  }
  for(const bad of [false,undefined]){const p=project();p.baseline.summary.complete=bad;fixtures.push(p);}
  const missingQuoteVersion=project();delete missingQuoteVersion.baseline.quote.versionId;fixtures.push(missingQuoteVersion);
  for(const fixture of fixtures)assert.throws(()=>O.create(fixture),{name:'TypeError'});
  assert.throws(()=>O.create(project(),{route:'invented'}),{name:'TypeError'});
  assert.throws(()=>O.create(project(),{route:'line',amount:1}),{name:'TypeError'});
  const zero=project();zero.baseline.summary.priceCents=0;assert.equal(O.create(zero).revision,0);
});

test('planning is validated, immutable and audited without touching the accepted baseline',()=>{
  const original=project(),baseline=plain(original.baseline),state=O.create(original),before=plain(state);
  const next=update(state,'plan',{owner:'Diseño de ejemplo',dueDate:'2026-11-12',route:'new',installation:'duco'});
  assert.deepEqual(plain(state),before);
  assert.deepEqual(plain(original.baseline),baseline);
  assert.equal(next.revision,1);assert.equal(next.owner,'Diseño de ejemplo');assert.equal(next.route,'new');
  assert.equal(next.events.length,1);assert.equal(next.events[0].actor,'Account de ejemplo');
  assert.equal(next.events[0].projectId,state.projectId);assert.equal(next.events[0].at,at);
  assert.equal(next.events[0].revision,1);assert.equal(next.events[0].type,'plan');
  next.events[0].actor='Changed copy';assert.equal(state.events.length,0);
  for(const installation of ['pending','no','client'])assert.equal(update(state,'plan',{owner:'Ejemplo',dueDate:'2026-11-12',route:'mixed',installation}).installation,installation);
});

test('planning rejects unknown fields, enum values, empty owner and impossible ISO dates',()=>{
  const state=O.create(project()),valid={owner:'Ejemplo',dueDate:'2026-11-12',route:'line',installation:'no'};
  for(const patch of [{owner:''},{owner:' '.repeat(3)},{owner:'x'.repeat(121)},{dueDate:'2026-02-29'},{dueDate:'2026-04-31'},{dueDate:'12/11/2026'},{route:'invented'},{installation:'yes'},{priceCents:1}])rejectUnchanged(state,'plan',{...valid,...patch});
  assert.equal(update(state,'plan',{...valid,dueDate:'2028-02-29'}).dueDate,'2028-02-29');
});

test('manual tasks advance independently within every explicit stage',()=>{
  let state=O.create(project());
  for(const [index,stage]of O.stages.entries())state=update(state,'task-add',task('TASK-'+index,{stage:stage.id}));
  assert.equal(state.tasks.length,4);assert.ok(state.tasks.every(row=>row.status==='pending'));
  state=update(state,'task-status',{id:'TASK-2',status:'doing'});
  assert.equal(state.tasks[2].status,'doing');assert.equal(state.tasks[0].status,'pending');
  state=update(state,'task-status',{id:'TASK-2',status:'done'});assert.equal(state.tasks[2].status,'done');
  assert.equal(state.events.at(-1).resourceId,'TASK-2');
});

test('task commands reject arbitrary financial data, invalid IDs, stages, dates and statuses',()=>{
  let state=O.create(project());
  for(const patch of [{id:'../TASK'},{id:'__proto__'},{title:''},{title:'x'.repeat(181)},{stage:'quote'},{dueDate:'2026-02-30'},{owner:3},{amount:100},{status:'done'}])rejectUnchanged(state,'task-add',task('TASK-1',patch));
  state=update(state,'task-add',task());
  rejectUnchanged(state,'task-status',{id:'FOREIGN-TASK',status:'done'},{},'TASK_NOT_FOUND');
  rejectUnchanged(state,'task-status',{id:'TASK-1',status:'complete'});
  rejectUnchanged(state,'task-status',{id:'TASK-1',status:'done',priceCents:10});
  rejectUnchanged(state,'task-add',task('TASK-1',{title:'A different task'}),{},'TASK_CONFLICT');
});

test('project identity and optimistic revision are enforced on every command',()=>{
  const state=update(O.create(project()),'task-add',task());
  for(const type of ['plan','task-add','task-status','delivery','close']){
    rejectUnchanged(state,type,{}, {projectId:'PR-OTHER'},'PROJECT_MISMATCH');
    rejectUnchanged(state,type,{}, {expectedRevision:0},'STALE_REVISION');
  }
  for(const revision of [-1,0.5,'1',null])rejectUnchanged(state,'close',{}, {expectedRevision:revision});
});

test('command envelope is closed and requires a real timestamp and illustrative actor',()=>{
  const state=O.create(project());
  for(const patch of [{at:'2026-02-30T12:00:00.000Z'},{at:'2026-11-05'},{actor:''},{actor:'x'.repeat(121)},{admin:true}])rejectUnchanged(state,'task-add',task(),patch);
  for(const invalid of [null,[],42]){
    const result=O.apply(state,invalid);assert.equal(result.ok,false);assert.deepEqual(plain(result.state),plain(state));
  }
  rejectUnchanged(state,'invented',{});
  rejectUnchanged(state,'task-add',null);
});

test('identical repeated operations are no-ops and never append a duplicate event',()=>{
  let state=O.create(project()),plan={owner:'Ejemplo',dueDate:'2026-11-12',route:'new',installation:'pending'};
  for(const [type,payload]of [['plan',plan],['task-add',task()],['task-status',{id:'TASK-1',status:'done'}],['delivery',receipt()]]){
    state=update(state,type,payload);const previous=plain(state),again=O.apply(state,command(state,type,payload));
    assert.equal(again.ok,true);assert.equal(again.code,'NO_CHANGE');assert.deepEqual(plain(again.state),previous);
  }
  const stale=O.apply(state,command(state,'delivery',receipt(),{expectedRevision:state.revision-1}));
  assert.equal(stale.ok,false);assert.equal(stale.code,'STALE_REVISION');assert.equal(stale.state.events.length,state.events.length);
});

test('delivery needs an exact project, real date, named recipient and short evidence',()=>{
  const state=O.create(project());
  for(const patch of [{date:'2026-02-29'},{date:''},{recipient:''},{recipient:'x'.repeat(121)},{evidence:''},{evidence:'x'.repeat(601)},{paid:true}])rejectUnchanged(state,'delivery',receipt(patch));
  const delivered=update(state,'delivery',receipt());
  assert.deepEqual(plain(delivered.delivery),receipt());
  rejectUnchanged(delivered,'delivery',receipt({recipient:'Another example'}),{},'DELIVERY_EXISTS');
  rejectUnchanged(delivered,'delivery',receipt({evidence:'Different evidence'}),{},'DELIVERY_EXISTS');
});

test('demo closure requires receipt and a nonempty set of finished tasks, then is read-only',()=>{
  let state=O.create(project());
  rejectUnchanged(state,'close',{}, {},'DELIVERY_REQUIRED');
  state=update(state,'delivery',receipt());rejectUnchanged(state,'close',{}, {},'TASKS_REQUIRED');
  state=update(state,'task-add',task());rejectUnchanged(state,'close',{}, {},'TASKS_PENDING');
  state=update(state,'task-status',{id:'TASK-1',status:'doing'});rejectUnchanged(state,'close',{}, {},'TASKS_PENDING');
  state=update(state,'task-status',{id:'TASK-1',status:'done'});state=update(state,'close');
  assert.equal(state.closed,true);assert.equal(state.events.at(-1).type,'close');
  for(const [type,payload]of [['plan',{}],['task-add',task('TASK-2')],['task-status',{id:'TASK-1',status:'pending'}],['delivery',receipt()],['close',{}]])rejectUnchanged(state,type,payload,{},'CLOSED');
});

test('summary reports empty and partial stages honestly without automatic completion',()=>{
  let state=O.create(project()),s=O.summary(state);
  assert.equal(s.phase,'Por planear');assert.equal(s.total,0);assert.equal(s.done,0);assert.equal(s.pending,0);
  for(const stage of O.stages)assert.deepEqual(plain(s.byStage[stage.id]),{label:stage.label,done:0,total:0,pending:0});
  state=update(state,'task-add',task('TASK-1',{stage:'production'}));state=update(state,'task-add',task('TASK-2',{stage:'plan'}));
  s=O.summary(state);assert.equal(s.phase,'Planeación');assert.equal(s.total,2);assert.equal(s.done,0);assert.equal(s.pending,2);
  state=update(state,'task-status',{id:'TASK-2',status:'done'});s=O.summary(state);
  assert.equal(s.phase,'Producción');assert.equal(s.done,1);assert.equal(s.pending,1);
  assert.deepEqual(plain(s.byStage.production),{label:'Producción',done:0,total:1,pending:1});
  state=update(state,'task-status',{id:'TASK-1',status:'done'});assert.equal(O.summary(state).phase,'Entrega pendiente');
  state=update(state,'delivery',receipt());assert.equal(O.summary(state).phase,'Entrega registrada');
  state=update(state,'close');assert.equal(O.summary(state).phase,'Cerrado');
});

test('text is preserved for context-aware UI escaping instead of changing valid intent',()=>{
  const text='  <img src=x onerror="alert(1)"> & $1  ',state=O.create(project());
  const next=update(state,'task-add',task('TASK-1',{title:text,owner:text}));
  assert.equal(next.tasks[0].title,text);assert.equal(next.tasks[0].owner,text);
  const delivered=update(next,'delivery',receipt({recipient:text,evidence:text}));
  assert.equal(delivered.delivery.evidence,text);
  const pollution=JSON.parse('{"id":"TASK-2","title":"Ejemplo","stage":"plan","owner":"","dueDate":"","__proto__":{"polluted":true}}');
  rejectUnchanged(next,'task-add',pollution);assert.equal({}.polluted,undefined);
});

test('projects and fresh session states share neither tasks nor receipts nor audit arrays',()=>{
  const p=project(),baseline=plain(p.baseline),first=O.create(p),second=O.create(project('PR-DEMO-202','DEMO-202'));
  let changed=update(first,'task-add',task());changed=update(changed,'task-status',{id:'TASK-1',status:'done'});changed=update(changed,'delivery',receipt());
  rejectUnchanged(second,'task-status',{id:'TASK-1',status:'done'},{},'TASK_NOT_FOUND');
  assert.equal(second.tasks.length,0);assert.equal(second.delivery,null);assert.equal(second.events.length,0);
  assert.deepEqual(plain(O.create(p)),plain(first),'Fresh state acts as an independent memory-only session reset');
  assert.deepEqual(plain(p.baseline),baseline);
  assert.doesNotMatch(JSON.stringify(changed),/priceCents|costCents|totalCents|unitPrice|baseline|payment|invoice/);
});

test('malformed state cannot skip closure guards or inject financial fields',()=>{
  const state=O.create(project());
  for(const bad of [{...state,revision:-1},{...state,closed:'yes'},{...state,priceCents:1},{...state,tasks:[{...task(),status:'done'},{...task(),status:'done'}]}]){
    const result=O.apply(bad,command(state,'close'));assert.equal(result.ok,false);assert.equal(result.code,'INVALID_STATE');
  }
});
