import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Pure projection only: no browser, network, services, DOM, or company data.
const source=readFileSync(new URL('../src/portfolio-kpis.js',import.meta.url),'utf8');
const sandbox=vm.createContext({structuredClone});
vm.runInContext(source,sandbox,{filename:'portfolio-kpis.js'});
const api=sandbox.DemoPortfolio;
const plain=value=>JSON.parse(JSON.stringify(value));
const metrics=(records,filters={},clients=CLIENTS)=>plain(api.compute(records,filters,clients));
const ids=rows=>rows.map(row=>row.id).sort();
const group=(rows,key)=>rows.find(row=>row.key===key);
const CLIENTS={a:{name:'Cliente ficticio Alfa',firstSaleAt:'2025-05-01'},b:{name:'Cliente ficticio Beta',firstSaleAt:'2026-10-01'},c:{name:'Cliente ficticio Gamma',firstSaleAt:null}};
function record(id,{netCents=10000,acceptedAt='2026-10-06',requestedAt='2026-10-01',firstSentAt='2026-10-03',poAt='2026-10-07',clientId='a',category='horeca',commercialType='line',...rest}={}){
  const request={title:'Caso sintético '+id,client:CLIENTS[clientId]?.name||'Cliente sin historial',need:'Necesidad inventada'};
  const versions=acceptedAt===null?[]:[{version:1,quoteVersionId:id+'-V1',clientId,category,commercialType,sentAt:firstSentAt,snapshot:{quote:{id,versionId:id+'-V1',revision:1},request:structuredClone(request),summary:{priceCents:netCents,taxCents:1600,totalCents:11600,costCents:4000}},response:{result:'accepted',version:1,at:acceptedAt}}];
  return {id,request,version:1,clientId,category,commercialType,requestedAt,firstSentAt,poAt,acceptedVersion:acceptedAt===null?null:1,versions,project:null,...rest};
}

test('seven approved families, seven categories, and fixed inclusive periods',()=>{
  assert.deepEqual(plain(api.FAMILIES),['Ventas','Tickets','Preparación','Cierre','Cotizaciones por cliente','Cotizaciones por mes','Nuevos y recurrentes']);
  assert.deepEqual(Object.keys(api.CATEGORIES),['horeca','offices','brands','lab','residential','retail','logistics']);
  assert.equal(api.CATEGORIES.logistics,'Logística y envíos');
  assert.equal(api.CUTOFF,'2026-10-15');
  assert.deepEqual(plain(api.PERIODS),{year:['2026-01-01','2026-10-15'],q3:['2026-07-01','2026-09-30'],october:['2026-10-01','2026-10-15']});
});

test('seven category fixtures use independent amounts, tickets, activity, and clocks',()=>{
  const categories=['horeca','offices','brands','lab','residential','retail','logistics'];
  const records=categories.map((category,i)=>record('DEMO-'+(i+1),{category,netCents:(i+1)*10000,clientId:i%2?'b':'a',commercialType:i%2?'project':'line'}));
  const before=structuredClone(records);
  const result=metrics(records,{period:'october'});
  assert.equal(result.totalCents,280000);
  assert.equal(result.ticketCents,40000);
  assert.equal(result.eligible.length,7);
  assert.equal(result.priced.length,7);
  assert.equal(result.pending.length,0);
  assert.equal(result.byCategory.length,7);
  for(let i=0;i<categories.length;i++){
    const value=group(result.byCategory,categories[i]);
    assert.equal(value.count,1);
    assert.equal(value.totalCents,(i+1)*10000);
    assert.equal(value.ticketCents,(i+1)*10000);
  }
  assert.deepEqual(result.activity,{received:7,sent:7,accepted:7,projects:0});
  assert.equal(group(result.monthlySales,'2026-10').totalCents,280000);
  assert.equal(group(result.monthlyRequests,'2026-10').count,7);
  assert.equal(result.prepDays,2);
  assert.equal(result.closeDays,3);
  assert.equal(result.prepN,7);
  assert.equal(result.closeN,7);
  assert.equal(group(result.byType,'line').n,4);
  assert.equal(group(result.byType,'project').n,3);
  assert.equal(group(result.byClient,'a').totalCents,160000);
  assert.equal(group(result.byClient,'b').totalCents,120000);
  assert.equal(group(result.byClient,'a').received,4);
  assert.equal(group(result.byClient,'a').accepted,4);
  assert.equal(group(result.segments,'recurring').totalCents,160000);
  assert.equal(group(result.segments,'new').totalCents,120000);
  assert.deepEqual(records,before,'Pure projections must not update source records');
});

test('accepted V1 remains the sale while V2 is a draft and the project is counted once',()=>{
  const value=record('DEMO-VERSIONS',{netCents:10000});
  value.version=2;
  value.sent=null;
  value.clientId='b';value.category='retail';value.commercialType='project';
  value.request={...value.request,title:'Nuevo borrador no aceptado',client:'Cliente ficticio Beta'};
  value.versions.push({version:2,snapshot:{summary:{priceCents:9000000}},response:null});
  value.project={id:'PR-DEMO-VERSIONS',sourceId:value.id,version:1,createdAt:'2026-10-08T12:00:00.000Z',baseline:{quote:structuredClone(value.versions[0].snapshot.quote),summary:{priceCents:8000000}}};
  const result=metrics([value],{period:'october'});
  assert.equal(result.totalCents,10000);
  assert.equal(result.eligible.length,1);
  assert.equal(result.eligible[0].version,1);
  assert.equal(result.eligible[0].currentVersion,2);
  assert.equal(result.eligible[0].clientId,'a');
  assert.equal(result.eligible[0].category,'horeca');
  assert.equal(result.eligible[0].type,'line');
  assert.equal(group(result.byClient,'a').totalCents,10000);
  assert.equal(result.activity.projects,1);
  assert.equal(result.activity.accepted,1);
  assert.equal(result.activity.received,1);
  assert.equal(result.totalCents,10000,'Tax, project baseline, cost and newer draft must not become sales');
});

test('failed, unknown, rejected and sent drafts have no sale without an accepted version',()=>{
  const values=['failed','unknown','draft','sent','rejected'].map((state,i)=>record('DEMO-NO-SALE-'+i,{acceptedAt:null,saveState:state,summary:{priceCents:1000000,saveState:state},sent:state==='rejected'?{response:{result:'rejected',at:'2026-10-06'}}:null}));
  const result=metrics(values,{period:'october'});
  assert.equal(result.eligible.length,0);
  assert.equal(result.totalCents,0);
  assert.equal(result.ticketCents,null);
  assert.equal(result.times.length,0);
  assert.equal(result.prepDays,null);
  assert.equal(result.closeDays,null);
  assert.equal(result.activity.received,5);
  assert.equal(result.activity.accepted,0);
});

test('zero is a valid price while missing, malformed and unsafe prices remain pending',()=>{
  const prices=[0,null,-1,0.5,'100',Number.MAX_SAFE_INTEGER+1];
  const result=metrics(prices.map((netCents,i)=>record('DEMO-PRICE-'+i,{netCents})),{period:'october'});
  assert.equal(result.eligible.length,6);
  assert.equal(result.priced.length,1);
  assert.equal(result.priced[0].netCents,0);
  assert.equal(result.pending.length,5);
  assert.equal(result.ticketCents,0);
  assert.equal(result.totalCents,0);
  const unavailable=metrics([record('DEMO-MISSING',{netCents:null})]);
  assert.equal(unavailable.ticketCents,null);
  assert.equal(unavailable.priced.length,0);
  assert.equal(unavailable.pending.length,1);
  assert.ok(unavailable.quality.issues.some(issue=>/importe/.test(issue.message)));
});

test('cent averages do not lose a cent near the accepted safe-integer boundary',()=>{
  const result=metrics([3002399751580330,3002399751580330,3002399751580331].map((netCents,i)=>record('DEMO-BOUND-'+i,{netCents})));
  assert.equal(result.totalCents,9007199254740991);
  // Exact mean is 3002399751580330 + 1/3; the rounded cent is independent of JS division.
  assert.equal(result.ticketCents,3002399751580330);
  assert.equal(group(result.byCategory,'horeca').ticketCents,3002399751580330);
});

test('aggregate overflow is explicit rather than an unsafe number or zero',()=>{
  const result=metrics([record('DEMO-OVER-1',{netCents:Number.MAX_SAFE_INTEGER}),record('DEMO-OVER-2',{netCents:1})]);
  assert.equal(result.totalCents,null);
  assert.equal(result.ticketCents,null);
  assert.equal(result.quality.overflow,true);
  assert.equal(group(result.byCategory,'horeca').totalCents,null);
});

test('acceptance and anticipo/PO bases use different sale cohorts but the same acceptance clocks',()=>{
  const values=[record('DEMO-A',{netCents:10000,acceptedAt:'2026-10-03',poAt:'2026-10-04'}),record('DEMO-B',{netCents:20000,requestedAt:'2026-09-20',firstSentAt:'2026-09-22',acceptedAt:'2026-09-25',poAt:'2026-10-05'}),record('DEMO-C',{netCents:30000,poAt:null}),record('DEMO-D',{netCents:40000,acceptedAt:'2026-10-07',poAt:'2026-10-20'}),record('DEMO-E',{acceptedAt:null,poAt:'2026-10-02'})];
  const accepted=metrics(values,{period:'october',basis:'acceptedAt'});
  const po=metrics(values,{period:'october',basis:'poAt'});
  assert.deepEqual(ids(accepted.eligible),['DEMO-A','DEMO-C','DEMO-D']);
  assert.equal(accepted.totalCents,80000);
  assert.deepEqual(ids(po.eligible),['DEMO-A','DEMO-B']);
  assert.equal(po.totalCents,30000);
  assert.deepEqual(ids(po.times),ids(accepted.times));
  assert.deepEqual(ids(po.noPo),['DEMO-C']);
  assert.equal(group(accepted.monthlyRequests,'2026-10').count,4);
  assert.equal(group(po.monthlyRequests,'2026-10').count,4);
});

test('each clock uses its own valid denominator and reports each exclusion',()=>{
  const values=[record('DEMO-T1',{requestedAt:'2026-10-01',firstSentAt:'2026-10-03',acceptedAt:'2026-10-06'}),record('DEMO-T2',{requestedAt:'2026-10-04',firstSentAt:'2026-10-02',acceptedAt:'2026-10-08',commercialType:'project'}),record('DEMO-T3',{requestedAt:'2026-10-01',firstSentAt:'2026-10-09',acceptedAt:'2026-10-07'}),record('DEMO-T4',{requestedAt:null,firstSentAt:'2026-10-10',acceptedAt:'2026-10-12',commercialType:'project'}),record('DEMO-T5',{acceptedAt:null}),record('DEMO-T6',{requestedAt:'2026-09-01',firstSentAt:'2026-09-02',acceptedAt:'2026-09-04',poAt:'2026-09-05'})];
  const result=metrics(values,{period:'october'});
  assert.equal(result.times.length,4);
  assert.equal(result.prepN,2);
  assert.equal(result.prepDays,5); // valid preparation intervals are 2 and 8 days.
  assert.equal(result.closeN,3);
  assert.equal(result.closeDays,11/3); // valid closing intervals are 3, 6 and 2 days.
  assert.deepEqual(result.timeExclusions,{withoutAcceptance:1,outsidePeriod:1,invalidPrep:2,invalidClose:1});
  assert.equal(group(result.byType,'line').n,1);
  assert.equal(group(result.byType,'line').closeDays,3);
  assert.equal(group(result.byType,'project').n,2);
  assert.equal(group(result.byType,'project').closeDays,4);
});

test('calendar dates, leap years, same-day zero and negative intervals are distinct',()=>{
  assert.equal(api.days('2024-02-28','2024-03-01'),2);
  assert.equal(api.days('2026-10-01','2026-10-01'),0);
  assert.equal(api.days('2026-10-02','2026-10-01'),null);
  for(const missing of ['',null,undefined,'2026-02-30','2026-13-01','2026-04-31']) assert.equal(api.days(missing,'2026-10-15'),null);
  const values=[record('DEMO-CUT-1',{acceptedAt:'2026-10-15T23:59:59.999Z'}),record('DEMO-CUT-2',{acceptedAt:'2026-10-16T00:00:00.000Z'}),record('DEMO-CUT-3',{acceptedAt:'2026-02-30'}),record('DEMO-CUT-4',{requestedAt:'2026-10-16',acceptedAt:null}),record('DEMO-CUT-5',{requestedAt:'2026-02-30',acceptedAt:null})];
  const result=metrics(values,{period:'october'});
  assert.deepEqual(ids(result.eligible),['DEMO-CUT-1']);
  assert.deepEqual(ids(result.cohort),['DEMO-CUT-1','DEMO-CUT-2','DEMO-CUT-3']);
  assert.equal(result.activity.accepted,1);
  const earlier=metrics(values,{period:'october',cutoff:'2026-10-14'});
  assert.equal(earlier.eligible.length,0);
});

test('Q3 includes its endpoints and ignores acceptance outside that period',()=>{
  const values=[record('DEMO-Q1',{requestedAt:'2026-06-30',acceptedAt:'2026-07-01'}),record('DEMO-Q2',{requestedAt:'2026-09-30',acceptedAt:'2026-09-30'}),record('DEMO-Q3',{requestedAt:'2026-10-01',acceptedAt:'2026-10-01'})];
  const result=metrics(values,{period:'q3'});
  assert.deepEqual(ids(result.eligible),['DEMO-Q1','DEMO-Q2']);
  assert.deepEqual(ids(result.cohort),['DEMO-Q2']);
  assert.deepEqual(result.monthlyRequests.map(value=>value.key),['2026-07','2026-08','2026-09']);
});

test('unknown clients and identical labels never merge independent client identities',()=>{
  const clients={a:{name:'Mismo nombre ficticio',firstSaleAt:'2025-01-01'},b:{name:'Mismo nombre ficticio',firstSaleAt:'2026-10-01'}};
  const values=[record('DEMO-ID-A',{clientId:'a'}),record('DEMO-ID-B',{clientId:'b'}),record('DEMO-ID-X',{clientId:null}),record('DEMO-ID-Y',{clientId:'missing'})];
  const result=metrics(values,{period:'october'},clients);
  assert.deepEqual(result.byClient.map(row=>row.key).sort(),['a','b','unknown:DEMO-ID-X','unknown:DEMO-ID-Y']);
  assert.equal(group(result.segments,'recurring').count,1);
  assert.equal(group(result.segments,'new').count,1);
  assert.equal(group(result.segments,'unknown').count,2);
  assert.equal(result.unknown.length,2);
});

test('missing category or commercial type stays unclassified without inventing a category',()=>{
  const result=metrics([record('DEMO-UNCLASSIFIED',{category:null,commercialType:null})]);
  assert.equal(result.totalCents,10000);
  assert.equal(result.times.length,1);
  assert.equal(group(result.byCategory,'unknown').count,1);
  assert.equal(group(result.byType,'line').count,0);
  assert.equal(group(result.byType,'project').count,0);
  assert.ok(result.quality.issues.some(issue=>/Categoría/.test(issue.message)));
  assert.ok(result.quality.issues.some(issue=>/Tipo comercial/.test(issue.message)));
});

test('ambiguous version references do not become sales while receipt activity remains',()=>{
  const multiple=record('DEMO-MULTIPLE');
  multiple.acceptedVersion=null;
  multiple.versions.push({...structuredClone(multiple.versions[0]),version:2,response:{result:'accepted',version:2,at:'2026-10-08'}});
  const invalid=record('DEMO-INVALID-POINTER');invalid.acceptedVersion=2;
  const mismatch=record('DEMO-MISMATCH');mismatch.versions[0].response.version=99;
  const result=metrics([multiple,invalid,mismatch]);
  assert.equal(result.eligible.length,0);
  assert.equal(result.times.length,0);
  assert.equal(result.activity.received,3);
  assert.equal(result.activity.accepted,0);
  assert.ok(result.quality.issues.some(issue=>/versión|aceptación/.test(issue.message)));
  const resolved=record('DEMO-RESOLVED');resolved.acceptedVersion=null;
  assert.equal(metrics([resolved]).totalCents,10000,'A single unambiguous historical acceptance is supported');
});

test('duplicate expediente IDs exclude both copies rather than double-counting or picking one',()=>{
  const a=record('DEMO-DUP',{netCents:10000}),b=record('DEMO-DUP',{netCents:20000});
  const result=metrics([a,b]);
  assert.equal(result.rows.length,2);
  assert.equal(result.quality.ambiguous.length,2);
  assert.equal(result.eligible.length,0);
  assert.equal(result.activity.received,0);
  assert.equal(result.totalCents,0);
});

test('client received and accepted counts use the request cohort rather than the sales cohort',()=>{
  const result=metrics([record('DEMO-OUTSIDE-REQUEST',{requestedAt:'2026-09-01'}),record('DEMO-IN',{requestedAt:'2026-10-01'}),record('DEMO-UNWON',{requestedAt:'2026-10-02',acceptedAt:null})],{period:'october'});
  assert.equal(result.eligible.length,2);
  assert.equal(group(result.byClient,'a').received,2);
  assert.equal(group(result.byClient,'a').accepted,1);
  assert.equal(group(result.byClient,'a').count,2);
  assert.equal(group(result.monthlyRequests,'2026-10').count,2);
});

function projectFrom(value,id='PR-'+value.id){
  return {id,sourceId:value.id,version:1,createdAt:'2026-10-08T12:00:00.000Z',baseline:structuredClone(value.versions[0].snapshot)};
}

test('an accepted snapshot belonging to another quote cannot create a sale or acceptance',()=>{
  const value=record('DEMO-ACCEPTED-SOURCE');
  value.versions[0].snapshot.quote.id='DEMO-OTHER-SOURCE';
  value.project=projectFrom(value);
  const result=metrics([value],{period:'october'});
  assert.equal(result.eligible.length,0);
  assert.equal(result.totalCents,0);
  assert.equal(result.times.length,0);
  assert.equal(result.activity.received,1,'The legitimate request still exists');
  assert.equal(result.activity.accepted,0);
  assert.equal(result.activity.projects,0);
  assert.ok(result.quality.issues.some(issue=>issue.id===value.id),'The inconsistent native quote identity is reported');
});

test('invalid project source, version or native baseline identity excludes conversion and preserves each legitimate sale',()=>{
  const values=['SOURCE','VERSION','BASELINE-QUOTE','BASELINE-VERSION'].map((suffix,index)=>{
    const value=record('DEMO-PROJECT-'+suffix,{netCents:(index+1)*10000});
    value.project=projectFrom(value);
    return value;
  });
  values[0].project.sourceId='DEMO-UNRELATED';
  values[1].project.version=99;
  values[2].project.baseline.quote.id='DEMO-UNRELATED';
  values[3].project.baseline.quote.versionId='another-opaque-version';
  const result=metrics(values,{period:'october'});
  assert.equal(result.eligible.length,4);
  assert.equal(result.totalCents,100000);
  assert.equal(result.activity.accepted,4);
  assert.equal(result.times.length,4);
  assert.equal(result.activity.projects,0);
  for(const value of values) assert.ok(result.quality.issues.some(issue=>issue.id===value.id),value.id+' has a reported project-chain discrepancy');
});

test('one project ID attached to two distinct requests excludes both conversion counts without erasing sales',()=>{
  const first=record('DEMO-PROJECT-FIRST',{netCents:10000});
  const second=record('DEMO-PROJECT-SECOND',{netCents:20000});
  first.project=projectFrom(first,'PR-SYNTHETIC-SHARED');
  second.project=projectFrom(second,'PR-SYNTHETIC-SHARED');
  const result=metrics([first,second],{period:'october'});
  assert.equal(result.eligible.length,2);
  assert.equal(result.totalCents,30000);
  assert.equal(result.activity.received,2);
  assert.equal(result.activity.accepted,2);
  assert.equal(result.activity.projects,0);
  for(const value of [first,second]) assert.ok(result.quality.issues.some(issue=>issue.id===value.id),value.id+' has a reported duplicated project identity');
});

test('native version identifiers are compared as opaque identities rather than parsed as a new format',()=>{
  const value=record('DEMO-OPAQUE-IDENTITY');
  value.versions[0].snapshot.quote.versionId='opaque/native:version-one';
  value.versions[0].quoteVersionId='opaque/native:version-one';
  value.project=projectFrom(value);
  const result=metrics([value],{period:'october'});
  assert.equal(result.eligible.length,1);
  assert.equal(result.totalCents,10000);
  assert.equal(result.activity.projects,1);
  assert.equal(result.quality.issues.length,0);
});

test('a contradictory native version anchor invalidates acceptance instead of selecting an unrelated snapshot',()=>{
  const value=record('DEMO-CONTRADICTORY-ANCHOR');
  value.versions[0].quoteVersionId='another-opaque-native-version';
  const result=metrics([value],{period:'october'});
  assert.equal(result.eligible.length,0);
  assert.equal(result.totalCents,0);
  assert.equal(result.activity.accepted,0);
  assert.equal(result.times.length,0);
  assert.ok(result.quality.issues.some(issue=>issue.id===value.id));
});

test('a historical acceptance without a native version anchor retains its sale but cannot prove a conversion',()=>{
  const value=record('DEMO-HISTORICAL-NO-ANCHOR');
  delete value.versions[0].quoteVersionId;
  value.project=projectFrom(value);
  const result=metrics([value],{period:'october'});
  assert.equal(result.eligible.length,1);
  assert.equal(result.totalCents,10000);
  assert.equal(result.activity.accepted,1);
  assert.equal(result.activity.projects,0);
  assert.ok(result.quality.issues.some(issue=>issue.id===value.id),'Partial identity evidence must remain visible');
});

test('monthly client stacks and period segments reconcile with independent totals and stable identities',()=>{
  const clients={a:{name:'Mismo cliente de ejemplo',firstSaleAt:'2025-01-01'},b:{name:'Mismo cliente de ejemplo',firstSaleAt:'2025-01-01'}};
  const values=[['JAN-A','2026-01','a',10000,'horeca'],['JAN-B','2026-01','b',30000,'retail'],['MAR-A','2026-03','a',20000,'retail'],['MAR-B','2026-03','b',40000,'horeca']]
    .map(([id,month,clientId,netCents,category])=>record('DEMO-STACK-'+id,{clientId,netCents,category,requestedAt:month+'-01',firstSentAt:month+'-03',acceptedAt:month+'-06',poAt:month+'-07'}));
  const result=metrics(values,{period:'year'},clients);
  assert.equal(result.totalCents,100000);
  assert.equal(group(result.monthlySales,'2026-01').totalCents,40000);
  assert.equal(group(result.monthlySales,'2026-03').totalCents,60000);
  assert.equal(group(group(result.monthlySales,'2026-01').clients,'a').totalCents,10000);
  assert.equal(group(group(result.monthlySales,'2026-01').clients,'b').totalCents,30000);
  assert.equal(group(group(result.monthlySales,'2026-03').clients,'a').totalCents,20000);
  assert.equal(group(group(result.monthlySales,'2026-03').clients,'b').totalCents,40000);
  for(const month of result.monthlySales){
    assert.equal(month.clients.reduce((sum,client)=>sum+client.totalCents,0),month.totalCents);
    assert.equal(month.clients.reduce((sum,client)=>sum+client.count,0),month.count);
    assert.deepEqual(month.clients.map(client=>client.key),month.clients.map(client=>client.key).sort());
  }
  assert.equal(result.monthlySales.reduce((sum,month)=>sum+month.totalCents,0),100000);
  const recurring=group(result.segments,'recurring');
  assert.deepEqual(recurring.clients.map(client=>client.key),['a','b'],'Equal labels must not merge stable client IDs');
  assert.equal(group(recurring.clients,'a').totalCents,30000);
  assert.equal(group(recurring.clients,'a').ticketCents,15000);
  assert.equal(group(recurring.clients,'b').totalCents,70000);
  assert.equal(group(recurring.clients,'b').ticketCents,35000);
  assert.equal(recurring.clients.reduce((sum,client)=>sum+client.totalCents,0),recurring.totalCents);
  const filtered=metrics(values,{period:'year',category:'horeca'},clients);
  assert.equal(filtered.totalCents,50000);
  assert.deepEqual(group(filtered.monthlySales,'2026-01').clients.map(client=>client.key),['a']);
  assert.deepEqual(group(filtered.monthlySales,'2026-03').clients.map(client=>client.key),['b']);
});

test('request stacks use the request cohort independently of acceptance or PO sales basis',()=>{
  const values=[
    record('DEMO-STACK-OLD-REQUEST',{clientId:'a',netCents:10000,requestedAt:'2026-09-20',firstSentAt:'2026-09-25',acceptedAt:'2026-10-06',poAt:'2026-10-07'}),
    record('DEMO-STACK-NEW-ACCEPTED',{clientId:'b',netCents:20000,acceptedAt:'2026-10-05',poAt:null}),
    record('DEMO-STACK-OPEN',{clientId:'a',requestedAt:'2026-10-02',acceptedAt:null}),
    record('DEMO-STACK-WITH-PO',{clientId:'a',netCents:30000,requestedAt:'2026-10-04',acceptedAt:'2026-10-08',poAt:'2026-10-10'})
  ];
  const accepted=metrics(values,{period:'october',basis:'acceptedAt'});
  const po=metrics(values,{period:'october',basis:'poAt'});
  assert.equal(accepted.totalCents,60000);
  assert.equal(po.totalCents,40000);
  assert.deepEqual(po.monthlyRequests,accepted.monthlyRequests,'Changing the sales date never changes received activity');
  const month=group(accepted.monthlyRequests,'2026-10');
  assert.equal(month.count,3);
  assert.deepEqual(month.clients.map(client=>client.key),['a','b']);
  assert.equal(group(month.clients,'a').count,2);
  assert.equal(group(month.clients,'b').count,1);
  assert.deepEqual(ids(group(month.clients,'a').rows),['DEMO-STACK-OPEN','DEMO-STACK-WITH-PO']);
  assert.equal(group(month.clients,'a').rows.filter(row=>row.accepted).length,1);
  assert.equal(group(month.clients,'b').rows.filter(row=>row.accepted).length,1);
  assert.equal(month.clients.reduce((sum,client)=>sum+client.count,0),3);
  assert.equal(accepted.activity.accepted,2);
});

test('segment client series preserve accepted V1, unknown history, missing amounts and valid zero',()=>{
  const draft=record('DEMO-SEGMENT-V1',{clientId:'b',netCents:10000});
  draft.version=2;draft.clientId='a';draft.sent=null;
  draft.versions.push({version:2,quoteVersionId:'opaque-v2',snapshot:{quote:{id:draft.id,versionId:'opaque-v2'},summary:{priceCents:9000000}},response:null});
  const values=[draft,record('DEMO-SEGMENT-RECURRING',{clientId:'a',netCents:20000}),record('DEMO-SEGMENT-UNKNOWN',{clientId:'c',netCents:30000}),record('DEMO-SEGMENT-ZERO',{clientId:'b',netCents:0}),record('DEMO-SEGMENT-MISSING',{clientId:'c',netCents:null}),record('DEMO-SEGMENT-NO-CLIENT',{clientId:null,netCents:40000})];
  const result=metrics(values,{period:'october'});
  const fresh=group(result.segments,'new'),recurring=group(result.segments,'recurring'),unknown=group(result.segments,'unknown');
  assert.equal(result.totalCents,100000);
  assert.equal(fresh.totalCents,10000);
  assert.equal(fresh.count,2);
  assert.equal(fresh.ticketCents,5000);
  assert.equal(group(fresh.clients,'b').count,2);
  assert.equal(group(fresh.clients,'b').pricedCount,2);
  assert.equal(group(fresh.clients,'b').rows.find(row=>row.id===draft.id).version,1);
  assert.equal(recurring.totalCents,20000);
  assert.deepEqual(recurring.clients.map(client=>client.key),['a']);
  assert.equal(unknown.totalCents,70000);
  assert.equal(unknown.count,3);
  assert.equal(unknown.pendingCount,1);
  assert.deepEqual(unknown.clients.map(client=>client.key),['c','unknown:DEMO-SEGMENT-NO-CLIENT']);
  assert.equal(group(unknown.clients,'c').totalCents,30000);
  assert.equal(group(unknown.clients,'c').pendingCount,1);
  assert.equal(group(unknown.clients,'unknown:DEMO-SEGMENT-NO-CLIENT').totalCents,40000);
  for(const segment of result.segments) assert.equal(segment.clients.reduce((sum,client)=>sum+client.totalCents,0),segment.totalCents);
});

test('empty months, missing-only client series and a confirmed zero remain different states',()=>{
  const values=[record('DEMO-GAP-ZERO',{clientId:'a',netCents:0,requestedAt:'2026-07-01',firstSentAt:'2026-07-03',acceptedAt:'2026-07-06',poAt:'2026-07-07'}),record('DEMO-GAP-MISSING',{clientId:'b',netCents:null,requestedAt:'2026-09-01',firstSentAt:'2026-09-03',acceptedAt:'2026-09-06',poAt:'2026-09-07'})];
  const result=metrics(values,{period:'q3'});
  assert.deepEqual(result.monthlySales.map(month=>month.key),['2026-07','2026-08','2026-09']);
  const july=group(result.monthlySales,'2026-07'),august=group(result.monthlySales,'2026-08'),september=group(result.monthlySales,'2026-09');
  assert.equal(july.totalCents,0);assert.equal(july.pricedCount,1);assert.equal(july.ticketCents,0);
  assert.equal(group(july.clients,'a').pricedCount,1);assert.equal(group(july.clients,'a').ticketCents,0);
  assert.equal(august.count,0);assert.equal(august.ticketCents,null);assert.deepEqual(august.clients,[]);
  assert.equal(september.totalCents,0);assert.equal(september.pricedCount,0);assert.equal(september.pendingCount,1);assert.equal(september.ticketCents,null);
  assert.equal(group(september.clients,'b').pendingCount,1);assert.equal(group(september.clients,'b').ticketCents,null);
  assert.deepEqual(group(result.monthlyRequests,'2026-08').clients,[]);
  assert.deepEqual(group(result.segments,'new').clients,[]);
});

test('unknown client stacks never merge requests solely because their visible names match',()=>{
  const first=record('DEMO-STACK-UNKNOWN-ONE',{clientId:null,netCents:10000});
  const second=record('DEMO-STACK-UNKNOWN-TWO',{clientId:'not-in-catalog',netCents:20000});
  const result=metrics([first,second],{period:'october'});
  const keys=['unknown:DEMO-STACK-UNKNOWN-ONE','unknown:DEMO-STACK-UNKNOWN-TWO'];
  assert.deepEqual(group(result.monthlySales,'2026-10').clients.map(client=>client.key),keys);
  assert.deepEqual(group(result.monthlyRequests,'2026-10').clients.map(client=>client.key),keys);
  assert.deepEqual(group(result.segments,'unknown').clients.map(client=>client.key),keys);
  assert.equal(group(result.monthlySales,'2026-10').totalCents,30000);
});

test('stack overflow stays explicit at the total and client levels without erasing a valid zero series',()=>{
  const values=[record('DEMO-STACK-OVERFLOW-A',{clientId:'a',netCents:Number.MAX_SAFE_INTEGER}),record('DEMO-STACK-OVERFLOW-B',{clientId:'a',netCents:1}),record('DEMO-STACK-OVERFLOW-ZERO',{clientId:'b',netCents:0})];
  const result=metrics(values,{period:'year'}),month=group(result.monthlySales,'2026-10');
  assert.equal(result.totalCents,null);assert.equal(result.quality.overflow,true);
  assert.equal(month.totalCents,null);assert.equal(month.ticketCents,null);
  assert.equal(group(month.clients,'a').count,2);assert.equal(group(month.clients,'a').totalCents,null);assert.equal(group(month.clients,'a').ticketCents,null);
  assert.equal(group(month.clients,'b').totalCents,0);assert.equal(group(month.clients,'b').pricedCount,1);assert.equal(group(month.clients,'b').ticketCents,0);
  const fresh=group(result.segments,'new'),recurring=group(result.segments,'recurring');
  assert.equal(recurring.totalCents,null);assert.equal(group(recurring.clients,'a').totalCents,null);
  assert.equal(fresh.totalCents,0);assert.equal(group(fresh.clients,'b').pricedCount,1);
});
