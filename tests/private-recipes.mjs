import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateRecipeUpdates} from '../tools/private-recipes.mjs';

const read=file=>fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
function startCatalog(){
  const context=vm.createContext({});
  for(const name of ['recipe-reference.js','public-product-catalog.js','recipe-expansion.js'])vm.runInContext(read(name),context);
  return context;
}
test('private recipe revisions keep stable IDs and leave variable-size purchases unmeasured',()=>{
  const context=startCatalog();
  const updated=JSON.parse(JSON.stringify(context.DemoRecipeExpansion[0]));
  updated.description='Ficha ficticia actualizada';
  const added={...updated,id:'TEST-VARIANT',productId:'TEST-PRODUCT',hardware:[
    {name:'Tela ficticia',quantityPerProduct:'125',unit:'dm²',purchaseUnit:'Lienzo',unitPrice:'',purchaseNeedsMeasurement:true}
  ]};
  const product={id:added.productId,name:'Producto ficticio',family:'Bancas',description:'Producto de prueba'};
  const data={products:[product],rows:[updated,added]};
  assert.throws(()=>validateRecipeUpdates({...data,rows:[added,added]}));
  assert.throws(()=>validateRecipeUpdates({...data,products:[]}));
  context.DucoPrivateRecipeUpdates=validateRecipeUpdates(data);
  vm.runInContext(read('recipe-catalog.js'),context);
  const catalog=context.DemoRecipeCatalog;
  assert.equal(catalog.recipes.length,35);
  assert.equal(catalog.recipe('R-'+updated.id).description,updated.description);
  assert.equal(catalog.images[added.id],undefined);
  let index=0;
  const piece=catalog.instantiate('R-'+added.id,()=>String(++index),'2');
  assert.equal(piece.materials[0].quantity,'125');
  assert.equal(piece.materials[0].purchaseQuantity,'');
  assert.equal(piece.metadata.hardware[0].mode,'MANUAL');
});
