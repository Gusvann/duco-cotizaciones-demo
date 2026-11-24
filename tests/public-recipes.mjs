import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
function load(overlays){
  const sandbox=vm.createContext({});
  vm.runInContext(read('public-product-catalog.js'),sandbox);
  if(overlays)sandbox.DucoPrivateRecipeUpdates=overlays(sandbox.DemoPublicRecipes);
  vm.runInContext(read('recipe-catalog.js'),sandbox);
  return {catalog:sandbox.DemoRecipeCatalog,publicData:sandbox.DemoPublicRecipes};
}
test('public projection has 135 illustrated and independently editable fictional recipes',()=>{
  const {catalog,publicData}=load();
  const sets=catalog.products.map(p=>p.variants.length).sort((a,b)=>a-b);
  assert.deepEqual([...sets],[1,1,2,3,3,6,6,8,18,18,24,45]);
  assert.equal(Object.keys(catalog.images).length,135);
  assert.equal(new Set(Object.values(catalog.images)).size,135);
  assert.equal(Object.values(catalog.images).filter(v=>/^assets\/catalogo\/v-[0-9a-f]{16}\.webp$/.test(v)).length,101);
  let sequence=0;
  for(const variant of catalog.products.flatMap(p=>p.variants)){
    const data=publicData.rows.find(row=>row.id===variant.id);
    assert.ok(data);
    assert.equal(data.syntheticPricing,true);
    assert.equal(data.referenceTotals,null);
    assert.equal(data.provenance,undefined);
    assert.equal(data.sourceSheet,undefined);
    assert.match(variant.sku,/^DEMO-/);
    assert.match(catalog.imageKinds[variant.id],/^IA$/);
    const single=catalog.instantiate(variant.recipeId,()=>String(++sequence));
    const twice=catalog.instantiate(variant.recipeId,()=>String(++sequence),'2');
    assert.notEqual(single.materials[0].id,twice.materials[0].id);
    assert.equal(Number(twice.materials[0].purchaseQuantity),Number(single.materials[0].purchaseQuantity)*2);
    assert.equal(twice.materials[0].unitPrice,single.materials[0].unitPrice);
    if(single.wood.length)assert.notEqual(single.wood[0].id,twice.wood[0].id);
  }
});
test('private revision of a publicly illustrated variant uses its native ID, image and private pricing',()=>{
  const {catalog,publicData}=load(publicData=>{
    const source=publicData.rows.find(row=>row.id.startsWith('v-'));
    return {products:[],rows:[{...source,id:'PRIVATE-TEST',publicVisualKey:source.id,
      syntheticPricing:false,description:'Receta de prueba privada',hardware:[{...source.hardware[0],unitPrice:'799.00'}]}]};
  });
  const source=publicData.rows.find(row=>row.id.startsWith('v-'));
  assert.equal(catalog.recipes.length,135);
  assert.equal(catalog.recipe('R-'+source.id),null);
  const updated=catalog.recipe('R-PRIVATE-TEST');
  assert.equal(updated.hardware[0].unitPrice,'799.00');
  assert.equal(updated.syntheticPricing,false);
  assert.equal(catalog.images['PRIVATE-TEST'],publicData.assets[source.id].url);
  assert.equal(catalog.thumbnails['PRIVATE-TEST'],publicData.assets[source.id].thumbnail);
});
