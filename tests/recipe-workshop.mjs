import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkshopCalculator} from '../src/recipe-workshop.mjs';

const C=createWorkshopCalculator();
function fixture() {
  const values={'domino.componentId':'TOP','domino.quantity':'','domino.lengthCm':'','domino.unions':'4','domino.perMl':'4','domino.extra':'','domino.price':'5',
    'labor.assembly.rate':'','labor.jointing.rate':'','labor.joinery.rate':'','labor.varnish.rate':'180',
    'other.gluePerM2':'0.6','other.glue.price':'183','other.cncMinutesPerMl':'5','other.cnc.price':'10','other.extrasPct':'3'};
  for(let i=0;i<6;i++){values['days.'+i+'.quantity']=i===0?'0.4':'';values['days.'+i+'.rate']=['867.5','1200','507.5','697.5','840','502.5'][i];}
  for(let i=0;i<3;i++)Object.assign(values,{['finish.'+i+'.enabled']:i<2,['finish.'+i+'.name']:'Material '+i,
    ['finish.'+i+'.hands']:['2','1',''][i],['finish.'+i+'.yield']:i<2?'7':'15',['finish.'+i+'.price']:['403','226',''][i]});
  const piece=(id,quantity,length,area,paint,jointed,cost,cnc)=>({id,quantityPerProduct:quantity,lengthCm:length,areaM2:area,paintM2:paint,jointedM2:jointed,woodCostExact:{numerator:cost,denominator:'100000000'},cncMl:cnc});
  return {values,articleQuantity:'1',pieces:[piece('TOP','1',60,.36,.72,.36,'73859056810',2.44),piece('LEGS','4',6,.12,.24,0,'24619685600',0),piece('RAILS','2',4,.048,.096,0,'9847874241',0)]};
}

test('reference workshop reproduces the image with independent exact arithmetic and the approved extras base',()=>{
  const input=fixture(),before=JSON.stringify(input),result=C.calculate(input);
  assert.equal(result.domino.ml,'2.4');assert.equal(result.domino.quantity,'9.6');assert.equal(result.domino.unitCents,'4800');
  assert.equal(result.labor.assembly.quantity,'0.528');assert.equal(result.labor.assembly.unitCents,null);
  assert.equal(result.labor.jointing.quantity,'0.36');assert.equal(result.labor.joinery.quantity,'9.6');
  assert.equal(result.labor.varnish.quantity,'1.056');assert.equal(result.labor.varnish.unitCents,'19008');
  assert.equal(result.days[0].unitCents,'34700');assert.equal(result.days[1].unitCents,null);
  assert.equal(result.finish[0].quantity,'0.301714');assert.equal(result.finish[0].unitCents,'12159');
  assert.equal(result.finish[1].quantity,'0.150857');assert.equal(result.finish[1].unitCents,'3409');
  assert.equal(result.finish[2].status,'NOT_APPLICABLE');
  assert.equal(result.other.glue.quantity,'0.216');assert.equal(result.other.glue.unitCents,'3953');
  assert.equal(result.other.cnc.ml,'2.44');assert.equal(result.other.cnc.minutes,'12.2');assert.equal(result.other.cnc.unitCents,'12200');
  assert.equal(result.other.baseCents,'132648');assert.equal(result.other.extras.unitCents,'3979');
  assert.deepEqual(result.errors,[]);assert.equal(result.financialConfirmed,false);
  assert.equal(JSON.stringify(input),before,'Calculation never rewrites recipe inputs');
});

test('reference workshop scales article totals exactly once and rounds after the full calculation',()=>{
  const input=fixture();input.articleQuantity='2';const result=C.calculate(input);
  assert.equal(result.domino.unitCents,'4800');assert.equal(result.domino.totalCents,'9600');
  assert.equal(result.labor.varnish.totalCents,'38016');assert.equal(result.days[0].totalCents,'69400');
  assert.equal(result.finish[0].totalCents,'24318');assert.equal(result.other.glue.totalCents,'7906');
  assert.equal(result.other.cnc.totalCents,'24400');assert.equal(result.other.extras.totalCents,'7959');
  assert.equal(result.geometry.areaM2,'0.528','Geometry remains per article instead of already scaled data');
});

test('reference workshop uses the selected piece for joins and retains explicit overrides and extras',()=>{
  const input=fixture();input.values['domino.componentId']='LEGS';input.values['domino.extra']='2';
  let result=C.calculate(input);assert.equal(result.domino.ml,'0.96');assert.equal(result.domino.quantity,'5.84');assert.equal(result.domino.unitCents,'2920');
  input.values['domino.quantity']='1';input.values['domino.lengthCm']='100';result=C.calculate(input);
  assert.equal(result.domino.ml,'4');assert.equal(result.domino.quantity,'18');
  input.values['domino.componentId']='missing';input.values['domino.quantity']='';
  result=C.calculate(input);assert.equal(result.domino.unitCents,null,'A removed source piece cannot leave stale automatic geometry');
});

test('reference workshop distinguishes missing, invalid, explicit zero and disabled finishes',()=>{
  const input=fixture();input.values['labor.assembly.rate']='0';input.values['other.glue.price']='bad';input.values['finish.2.enabled']=true;
  let result=C.calculate(input);assert.equal(result.labor.assembly.unitCents,'0');assert.equal(result.other.glue.unitCents,null);
  assert.ok(result.errors.includes('other.glue.price'));assert.equal(result.finish[2].unitCents,null);
  input.values['other.glue.price']='';result=C.calculate(input);assert.equal(result.errors.includes('other.glue.price'),false);assert.equal(result.other.glue.unitCents,null);
  input.values['finish.2.enabled']=false;result=C.calculate(input);assert.equal(result.finish[2].status,'NOT_APPLICABLE');
  input.values['finish.2.enabled']='invalid';result=C.calculate(input);assert.equal(result.finish[2].status,'PENDING','Malformed choice is not an explicit exclusion');
  assert.equal(C.valid('finish.0.yield','0'),false);assert.equal(C.valid('domino.unions','1.5'),false);
  assert.equal(C.valid('other.glue.price','1e3'),false);assert.equal(C.valid('other.glue.price','-2'),false);
});

test('reference workshop marks unknown piece choices and invalid geometry as partial instead of confirming zero',()=>{
  const input=fixture();input.pieces[1].jointedM2=null;input.pieces[2].cncMl=null;
  let result=C.calculate(input);assert.equal(result.other.glue.unitCents,'3953');assert.equal(result.other.glue.partial,true);
  assert.equal(result.other.cnc.unitCents,'12200');assert.equal(result.other.cnc.partial,true);assert.equal(result.other.extras.partial,true);
  for(const piece of input.pieces){piece.jointedM2=null;piece.cncMl=null;}
  result=C.calculate(input);assert.equal(result.other.glue.unitCents,null);assert.equal(result.other.cnc.unitCents,null);
});

test('reference workshop reports monetary overflow and keeps unknown totals distinct from a free reference',()=>{
  const input=fixture();input.values['labor.varnish.rate']='100000000';let result=C.calculate(input);
  assert.equal(result.labor.varnish.unitCents,null,'Above the existing reference money limit');
  input.articleQuantity='';input.values['labor.varnish.rate']='180';result=C.calculate(input);
  assert.equal(result.labor.varnish.unitCents,'19008');assert.equal(result.labor.varnish.totalCents,null);
  const empty=C.calculate({values:{'other.extrasPct':'3','finish.0.enabled':false,'finish.1.enabled':false,'finish.2.enabled':false},pieces:[],articleQuantity:'1'});
  assert.equal(empty.other.baseCents,null,'Inactive materials alone do not establish a zero material base');
  assert.equal(empty.other.extras.unitCents,null);
});

test('an explicit installation exclusion yields zero without rewriting captured days or the reference tariff',()=>{
  const input=fixture();input.values['days.1.quantity']='0.5';const before=JSON.stringify(input.values);
  let result=C.calculate({...input,installationExcluded:true});
  assert.equal(result.days[1].quantity,'0');assert.equal(result.days[1].unitCents,'0');assert.equal(result.days[1].totalCents,'0');assert.equal(result.days[1].excluded,true);
  assert.equal(JSON.stringify(input.values),before);
  result=C.calculate({...input,installationExcluded:false});assert.equal(result.days[1].unitCents,'60000');
  input.values['days.1.quantity']='';result=C.calculate(input);assert.equal(result.days[1].unitCents,null,'Unknown inclusion never becomes an invented zero');
});
