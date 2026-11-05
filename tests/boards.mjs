import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardCalculator} from '../src/board-calculator.mjs';
const calculate=createBoardCalculator().calculate;
const piece={quantity:'1',width:'71',length:'71',lengthUnit:'cm',unitPrice:'868.62'};
const basis={sheetAreaM2:'2.88',wasteRate:'15'};
test('board base uses exact area and sheet basis, scaling before rounding once',()=>{
  const one=calculate(piece,basis,'1');assert.equal(one.areaM2,'0.5041');assert.equal(one.unitCents,'17484');
  assert.equal(calculate(piece,basis,'2').totalCents,'34969');assert.equal(one.financialConfirmed,false);
  assert.equal(calculate({...piece,width:'710',length:'710',lengthUnit:'mm'},basis).unitCents,'17484');
});
test('missing, malformed and zero board inputs retain their distinct meaning',()=>{
  for(const change of [{unitPrice:''},{unitPrice:'8.6862'},{quantity:'-1'},{length:'abc'}])assert.equal(calculate({...piece,...change},basis).unitCents,null);
  assert.equal(calculate(piece,{...basis,sheetAreaM2:'0'}).unitCents,null);
  assert.equal(calculate(piece,{...basis,wasteRate:''}).unitCents,null);
  assert.equal(calculate({...piece,unitPrice:'0'},basis).unitCents,'0');
  assert.equal(calculate({...piece,quantity:''},basis).areaM2,null);
});
