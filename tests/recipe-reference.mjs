import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {recipeSourceSubtotal} from '../src/recipe-presentation.mjs';

// Source-reference and arithmetic checks only. These references do not prove
// current tariffs, currency/tax treatment, an enabled process, or a saved quote.
const source=readFileSync(new URL('../src/recipe-reference.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source,context,{filename:'recipe-reference.js'});
const R=context.DemoRecipeReference;
const plain=value=>JSON.parse(JSON.stringify(value));

test('the curated D91 reference has five immutable variants and excludes private source locators',()=>{
  assert.equal(R.source,'LOCAL_REFERENCE_D91');
  assert.equal(R.recipes.length,5);
  assert.deepEqual(plain(R.recipes.map(row=>row.id)),['SYN-NUBE-C','SYN-NUBE-O','SYN-PRISMA-C','SYN-PRISMA-O','SYN-PRISMA-G']);
  assert.equal(Object.isFrozen(R),true);
  for(const recipe of R.recipes){
    assert.equal(R.recipe(recipe.id),recipe);assert.equal(Object.isFrozen(recipe),true);
    assert.equal(Object.isFrozen(recipe.wood),true);assert.equal(Object.isFrozen(recipe.economics),true);
    assert.equal(recipe.woodWastePercent,'30');
  }
  const payload=JSON.stringify(R.recipes);
  assert.doesNotMatch(payload,/(?:[A-Z]:[\\/]|file:\/\/|https?:\/\/|docs\.google|onedrive|\.xlsx\b|\.gsheet\b)/i);
  assert.doesNotMatch(payload,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  assert.doesNotMatch(payload,/"(?:spreadsheetId|sheetId|sourceCell|sourceRange|workbookPath|customerId|supplierId)"/);
  assert.doesNotMatch(payload,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test('D91 technical preload preserves reference component measures independently from finished dimensions',()=>{
  for(const id of ['SYN-NUBE-C','SYN-NUBE-O']){
    const recipe=R.recipe(id);
    assert.deepEqual(plain(recipe.finishedSpecs),{Largo:'60',Ancho:'60',Alto:'50',unit:'cm'});
    assert.deepEqual(plain(recipe.wood.map(row=>[row.name,row.quantityPerProduct,row.width,row.length,row.thickness,row.finishFaces,row.jointed])),[
      ['CUBIERTA','1','60','60','1.5','2','1'],['PATAS','4','50','6','1.5','2',''],['TRAVESAÑOS','2','60','4','1.5','2',''],
    ]);
    assert.deepEqual(plain(recipe.hardware.map(row=>[row.name,row.quantityPerProduct,row.unit,row.unitPrice])),[
      ['NIVELADORES ASTRIADO','4','PZA','5'],['TUERCA INSERTO','4','PZA','0.5'],
    ]);
  }
  for(const id of ['SYN-PRISMA-C','SYN-PRISMA-O','SYN-PRISMA-G']){
    const recipe=R.recipe(id);
    assert.deepEqual(plain(recipe.finishedSpecs),{Largo:'76',Ancho:'76',Alto:'3.2',unit:'cm'});
    assert.deepEqual(plain(recipe.wood.map(row=>[row.name,row.quantityPerProduct,row.width,row.length])),[['CUBIERTA','1','81','81']]);
    assert.deepEqual(plain(recipe.hardware),[],'A standalone top must not inherit a table hardware recipe');
  }
});

test('D91 section subtotals match independently checked saved amounts and keep incomplete process coverage visible',()=>{
  // Independently summed using decimal saved amounts at full source precision,
  // then rounded once to cents. They are not outputs copied from the helper.
  const expected={
    'SYN-NUBE-C':{hardware:['2200',2,0],wood:['108327',3,0],consumables:['24321',4,0],processes:['65908',3,8]},
    'SYN-NUBE-O':{hardware:['2200',2,0],wood:['104264',3,0],consumables:['24321',4,0],processes:['112708',6,5]},
    'SYN-PRISMA-C':{hardware:[null,0,0],wood:['134608',1,0],consumables:['31430',4,0],processes:['64270',3,8]},
    'SYN-PRISMA-O':{hardware:[null,0,0],wood:['278908',1,0],consumables:['31430',4,0],processes:['64270',3,8]},
    'SYN-PRISMA-G':{hardware:[null,0,0],wood:['129560',1,0],consumables:['31430',4,0],processes:['64270',3,8]},
  };
  for(const recipe of R.recipes){
    const sections={hardware:recipe.economics.hardware,wood:recipe.economics.wood,consumables:recipe.economics.consumables,processes:[...recipe.economics.processes,...recipe.economics.dayLabor]};
    for(const [key,rows] of Object.entries(sections)){
      const subtotal=recipeSourceSubtotal(rows),[cents,known,pending]=expected[recipe.id][key];
      assert.equal(subtotal.cents,cents,recipe.id+' '+key);
      assert.equal(subtotal.knownCount,known,recipe.id+' '+key+' known');assert.equal(subtotal.pendingCount,pending,recipe.id+' '+key+' pending');
      assert.equal(subtotal.financialConfirmed,false);assert.equal(subtotal.quality,'HISTORICAL_SOURCE_REFERENCE');
      assert.equal(subtotal.status,rows.length===0?'NO_ROWS':pending?'PARTIAL':'COMPLETE_REFERENCE');
    }
  }
});

test('documentary subtotal rounds once and never interprets an absent or invalid source value as zero',()=>{
  const row=(quantity,unitPrice,totalSaved)=>({quantity,unitPrice,totalSaved});
  const rounded=recipeSourceSubtotal([row('1','1','0.004'),row('1','1','0.004'),row('1','1','0.004')]);
  assert.equal(rounded.cents,'1','Three source amounts round to one cent together, not zero per row');
  const zero=recipeSourceSubtotal([row('0','50','0')]);
  assert.equal(zero.cents,'0');assert.equal(zero.status,'COMPLETE_REFERENCE');assert.equal(zero.knownCount,1);
  const absent=recipeSourceSubtotal([row(null,'50','0'),row('1','','0'),row('1','50',null)]);
  assert.equal(absent.cents,null);assert.equal(absent.knownCount,0);assert.equal(absent.missingCount,3);assert.equal(absent.status,'PARTIAL');
  const invalid=recipeSourceSubtotal([row('1','50','-1'),row('NaN','50','0'),row('1','Infinity','0'),row('1','1','1e101'),row('1','1','1'.repeat(129))]);
  assert.equal(invalid.cents,null);assert.equal(invalid.invalidCount,5);assert.equal(invalid.status,'PARTIAL');
  const mixed=recipeSourceSubtotal([row('1','1','1e-2'),row(null,'50','0'),row('1','50','bad')]);
  assert.equal(mixed.cents,'1');assert.equal(mixed.knownCount,1);assert.equal(mixed.pendingCount,2);assert.equal(mixed.status,'PARTIAL');
  assert.equal(recipeSourceSubtotal([]).cents,null);assert.equal(recipeSourceSubtotal([]).status,'NO_ROWS');
});

test('CNC minutes and historic labor zeros retain their independent magnitudes and missing coverage',()=>{
  const recipe=R.recipe('SYN-NUBE-C'),cnc=recipe.economics.processes.find(row=>row.kind==='CNC');
  assert.equal(recipe.economics.parameters.cncMinutesPerMeter.value,'5');
  assert.equal(recipe.economics.parameters.cncMinutesPerMeter.unit,'min/m');
  assert.equal(cnc.quantity,'2.44');assert.equal(cnc.quantityUnit,'ML');assert.equal(cnc.priceUnit,'SOURCE_MONEY_PER_MINUTE');
  assert.equal(cnc.unitPrice,'10');assert.equal(cnc.totalSaved,'122');
  const noRate=recipe.economics.processes.find(row=>row.name==='MO ARMADO');
  assert.equal(noRate.quantity,'0.528');assert.equal(noRate.unitPrice,null);assert.equal(noRate.totalSaved,'0');
  assert.equal(recipeSourceSubtotal([noRate]).cents,null,'Historical zero with no rate remains pending');
  const noQuantity=recipe.economics.dayLabor.find(row=>row.name==='MO Instalación');
  assert.equal(noQuantity.quantity,null);assert.equal(noQuantity.totalSaved,'0');assert.equal(recipeSourceSubtotal([noQuantity]).cents,null);
});
