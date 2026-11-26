import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const browser={};
runInNewContext(readFileSync(new URL('../src/gestion-preview-model.js',import.meta.url),'utf8'),browser);
const date=new Date('2026-11-25T03:00:00Z');
const newStore=()=>browser.DucoGestionPreview.create(()=>date);

test('quote lines belong to the selected folio and remain isolated from list and detail consumers',()=>{
  const store=newStore();
  const lines=store.get('quote-1').items;
  assert.deepEqual(Array.from(lines,x=>[x.description,x.quantity,x.unit]),[
    ['Mesa Florencia · Tzalam',2,'Pieza'],['Banca de lectura',4,'Pieza']
  ]);
  lines[0].quantity=99;
  store.list('quote')[0].items.pop();
  assert.equal(store.get('quote-1').items[0].quantity,2);
  assert.equal(store.update('quote-1',{title:'Nombre actualizado'}).items.length,2);
  assert.equal(store.create('quote',{title:'Nombre actualizado'}).items.length,0);
});

test('both views can read the same sample records and track changes across forms',()=>{
  const store=newStore();
  const list=store.list('quote');
  assert.equal(list.length,9);
  assert.equal(list.find(record=>record.status==='request').dueDate,'2026-12-03');
  const quote=store.create('quote',{title:'Mesa de ejemplo',owner:'Comercial',priority:'high',dueDate:'2026-12-05'});
  assert.equal(quote.status,'request');
  assert.equal(quote.priority,'high');
  const next=store.update(quote.id,{owner:'Diseño',dueDate:'2026-12-06',status:'review'});
  assert.equal(next.owner,'Diseño');
  assert.equal(next.dueDate,'2026-12-06');
  assert.equal(next.status,'review');
  assert.match(next.activity[0].text,/Diseño.*En revisión/);
  assert.deepEqual(store.list('quote').find(item=>item.id===quote.id),next);

  next.title='Título fuera del modelo';
  next.activity[0].text='Nota fuera del modelo';
  assert.equal(store.get(quote.id).title,'Mesa de ejemplo');
  assert.match(store.get(quote.id).activity[0].text,/revisión/);
  const cleared=store.update(quote.id,{owner:'',dueDate:''});
  assert.equal(cleared.owner,'');
  assert.equal(cleared.dueDate,'');
  assert.equal(store.update(quote.id,{}).activity.length,cleared.activity.length);
});

test('task assignments and notes on the linked project leave the original request intact',()=>{
  const store=newStore();
  const quote=store.list('quote').find(record=>record.status==='accepted');
  const project=store.convert(quote.id);
  const withTask=store.addTask(project.id,{title:'Revisar medidas',owner:'Diseño',dueDate:'2026-11-26'});
  assert.equal(withTask.tasks[0].title,'Revisar medidas');
  assert.equal(withTask.tasks[0].done,false);
  assert.equal(withTask.tasks[0].dueDate,'2026-11-26');
  assert.equal(store.toggleTask(project.id,withTask.tasks[0].id).tasks[0].done,true);
  assert.equal(store.toggleTask(project.id,withTask.tasks[0].id).tasks[0].done,false);
  assert.equal(store.addNote(project.id,'Validación de ejemplo').activity[0].text,'Validación de ejemplo');
  assert.equal(store.get(quote.id).tasks.length,0);
  assert.throws(()=>store.toggleTask(quote.id,withTask.tasks[0].id),/no corresponde/);
});

test('converting an accepted quote creates one project and retains both links',()=>{
  const store=newStore();
  const other=store.list('quote').find(record=>record.status==='review');
  assert.throws(()=>store.convert(other.id),/debe estar aceptada/);
  assert.throws(()=>store.update(other.id,{status:'converted'}),/vinculada/);
  const quote=store.list('quote').find(record=>record.status==='accepted');
  const before=store.list('project').length;
  const project=store.convert(quote.id);
  assert.equal(project.quoteId,quote.id);
  assert.equal(project.owner,quote.owner);
  assert.equal(project.status,'plan');
  assert.equal(project.dueDate,quote.dueDate);
  assert.equal(store.list('project').length,before+1);
  assert.deepEqual(store.convert(quote.id),project);
  assert.equal(store.list('project').length,before+1);
  assert.equal(store.get(quote.id).projectId,project.id);
  assert.equal(store.get(quote.id).status,'converted');
  assert.throws(()=>store.update(quote.id,{status:'accepted'}),/vinculada/);
});

test('invalid dates, statuses and blank fields leave state intact and reset is isolated',()=>{
  const store=newStore();
  const other=newStore();
  const record=store.list('project')[0];
  assert.throws(()=>store.update(record.id,{owner:'Diseño',dueDate:'2026-02-30'}),/fecha válida/);
  assert.throws(()=>store.update(record.id,{status:'sent'}),/estado válido/);
  assert.throws(()=>store.create('quote',{title:'   '}),/Escribe el título/);
  assert.throws(()=>store.addTask(record.id,{title:' '}),/nombre de la tarea/);
  assert.throws(()=>store.update(record.id,{priority:'urgent'}),/prioridad válida/);
  assert.throws(()=>store.addNote(record.id,'\u0000'),/La nota/);
  assert.deepEqual(store.get(record.id),record);
  store.update(record.id,{title:'Prueba temporal'});
  assert.equal(other.get(record.id).title,record.title);
  store.reset();
  assert.deepEqual(store.list(),other.list());
});
