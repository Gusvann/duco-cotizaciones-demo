import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/public-store.js',import.meta.url),'utf8');
const record={id:'DEMO-QA',source:'SYNTHETIC_DEMO',version:1,history:[],versions:[],request:{title:'Prueba'}};
const snapshot={quote:{id:record.id,versionId:'DEMO-QA-V1'},summary:{savedRevision:2},request:record.request};
function browser(protocol,privateService){
  const window={location:{protocol},DucoPrivateApi:privateService};
  Object.defineProperty(window,'indexedDB',{get(){throw Error('storage disabled');}});
  vm.runInNewContext(source,{window});
  return window.DemoBrowserStore;
}

test('public browser storage is unavailable to the private service and offline preview',()=>{
  assert.equal(browser('http:',{}),undefined);
  assert.equal(browser('file:'),undefined);
});

test('browser refusal does not acknowledge a successful save',async()=>{
  const store=browser('https:');
  await assert.rejects(store.initial(),{status:507});
  await assert.rejects(store.put(record,snapshot,0),{status:507});
});

test('public storage rejects imported records, mismatched versions and unaccepted conversions before writing',async()=>{
  const store=browser('https:');
  await assert.rejects(store.put({...record,asana:{}},snapshot,0),{status:422});
  await assert.rejects(store.put({...record,version:2},snapshot,0),{status:422});
  await assert.rejects(store.put({...record,project:{id:'PR-DEMO-QA'}},snapshot,0,'convert'),{status:422});
});
