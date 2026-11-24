import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require('playwright');}
catch {
  const modules=process.env.DEMO_NODE_MODULES||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');
  playwright=require(path.join(modules,'playwright'));
}
const publishedURL=process.env.PAGES_TEST_URL;
if(publishedURL&&publishedURL!=='https://gusvann.github.io/duco-cotizaciones-demo/')
  throw Error('PAGES_TEST_URL debe ser la URL oficial del cotizador.');
const priorRelease=publishedURL?null:execFileSync('git',['show','748c3ac:index.html'],{cwd:root,maxBuffer:10*1024*1024});
const currentRelease=await readFile(path.join(root,'index.html'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const mount='/duco-cotizaciones-demo/';
let upgrade=false;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const allowed=/^(?:(?:index|catalogo)\.html|src\/(?:public-product-catalog|published-recipes|galeria)\.(?:js|css)|(?:assets\/catalogo|src\/assets\/catalogo-sintetico)\/(?:thumb\/)?[-a-z\d]+\.(?:jpg|png|webp))$/i;
const server=publishedURL?null:createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const file=pathname.slice(mount.length)||'index.html';
  if(req.method!=='GET'||!pathname.startsWith(mount)||!allowed.test(file)){res.writeHead(404).end();return;}
  try{
    const bytes=file==='index.html'?(upgrade?currentRelease:priorRelease):await readFile(path.join(root,file));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=publishedURL||'http://127.0.0.1:'+server.address().port+mount;
const variant={previous:'SYN-NUBE-C',published:'PUB-SYN-NUBE-C',product:'SYN-NUBE'};
const assertions=[];
const requests=[];
const pageErrors=[];
let browser;

const action=(page,name,selector='')=>page.locator('#journey-root [data-action="'+name+'"]'+selector+', #journey-footer [data-action="'+name+'"]'+selector).filter({visible:true}).first();
const quote=(page,selector)=>page.locator('#quote-host').locator(selector);
const quantity=page=>quote(page,'.header-quantity-control input');
async function openHome(page,release){
  const response=await page.goto(base);
  assert.equal(response.status(),200);
  assert.equal(hash(await response.body()),hash(release));
  await page.waitForFunction(()=>window.DemoJourney?.ready);
  await page.evaluate(()=>window.DemoJourney.ready);
  await page.waitForFunction(()=>!window.DemoJourney.inspect().state.busy);
}
async function addProduct(page,variantId,title){
  await action(page,'new-request').click();
  const id=await page.evaluate(()=>window.DemoJourney.inspect().state.id);
  await quote(page,'[data-path="name"]').fill(title);
  await quote(page,'.steps [data-step="1"]').click();
  await quote(page,'[data-action="line-open"]').click();
  await quote(page,'[data-action="line-select-product"][data-product="'+variant.product+'"]').click();
  const select=quote(page,'[data-line-variant="'+variant.product+'"]');
  await select.selectOption(variantId);
  if(variantId===variant.published)assert.equal(await select.locator('option[value="'+variant.previous+'"]').count(),0);
  await quote(page,'[data-action="line-use"][data-product="'+variant.product+'"]').click();
  return id;
}
async function save(page,id){
  await quote(page,'.panel-actions [data-action="save"]').click();
  await page.getByText(/guardado en este navegador/i).first().waitFor({state:'visible'});
  return page.evaluate(id=>window.DemoQuote.snapshot(id),id);
}
async function liveCosts(page,itemId){
  return page.evaluate(itemId=>{
    const client=window.__client;
    const pieces=client.app.solidWoodLocal.articles.get(itemId).applied;
    const wood=pieces.map(piece=>{
      const result=client.recipeWoodResult(itemId,piece);
      return [piece.id,result.priceResolution.appliedPrice,result.articleCosts.woodCost];
    });
    const workshop=client.workshopRead(itemId);
    const amounts={wood,domino:workshop.domino.unitCents,glue:workshop.glue?.unitCents??null};
    return JSON.parse(JSON.stringify(amounts,(_,value)=>typeof value==='bigint'?value.toString():value));
  },itemId);
}
const same=(current,previous,message)=>assert.ok(JSON.stringify(current)===JSON.stringify(previous),message);

try{
  browser=await playwright.chromium.launch({channel:process.env.DEMO_BROWSER_CHANNEL||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1360,height:900},serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(base)||/^(data|blob|about):/.test(url))await route.continue();
    else {requests.push(url);await route.abort();}
  });
  context.on('page',page=>page.on('pageerror',error=>pageErrors.push(error.message)));
  let page=await context.newPage();

  if(server){
    await openHome(page,priorRelease);
    const oldId=await addProduct(page,variant.previous,'Borrador de prueba previo a las recetas publicadas');
    await quantity(page).fill('2');
    await quantity(page).press('Tab');
    const before=await save(page,oldId);
    const itemId=before.quote.items[0].id;
    assert.equal(before.quote.items[0].quantity,'2');
    assert.equal(before.local.recipeArticles[itemId].recipeId,'R-'+variant.previous);
    assert.ok(before.local.wood[0][1].applied.length);
    const costs=await liveCosts(page,itemId);
    assert.ok(Number(costs.wood[0][2])>0,'El oráculo captura un costo material real en la interfaz de pruebas.');
    await page.close();

    upgrade=true;
    page=await context.newPage();
    await openHome(page,currentRelease);
    assert.equal(await page.evaluate(()=>window.DemoRecipeCatalog.products.flatMap(product=>product.variants).length),135);
    await action(page,'open','[data-id="'+oldId+'"]').click();
    await quote(page,'.steps [data-step="1"]').click();
    await quantity(page).waitFor();
    assert.equal(await quantity(page).inputValue(),'2');
    const reopened=await page.evaluate(id=>window.DemoQuote.snapshot(id),oldId);
    same(reopened,before,'El catálogo nuevo debe dejar intacto el guardado anterior.');
    same(await liveCosts(page,itemId),costs,'El cálculo visible debe conservar sus tarifas y costos anteriores.');
    await quote(page,'.header-quantity-control [data-header-increment]').click();
    const savedAgain=await save(page,oldId);
    assert.equal(savedAgain.quote.items[0].quantity,'3');
    assert.equal(savedAgain.local.recipeArticles[itemId].recipeId,'R-'+variant.previous);
    const scaled=await liveCosts(page,itemId);
    assert.equal(scaled.wood[0][1],costs.wood[0][1]);
    const scaledCents=Math.round(Number(scaled.wood[0][2])*100);
    const expectedCents=Math.round(Number(costs.wood[0][2])*150);
    assert.ok(Math.abs(scaledCents-expectedCents)<=1,'El costo escala una vez, con un centavo de tolerancia por redondeo.');
    assertions.push('Compatibilidad de borrador guardado en 748c3ac, con tarifas, piezas y cantidad editable');
  }

  await openHome(page,currentRelease);
  const id=await addProduct(page,variant.published,'Cotización de prueba con receta del catálogo');
  const current=await save(page,id);
  const currentItem=current.quote.items[0].id;
  assert.equal(current.local.recipeArticles[currentItem].recipeId,'R-'+variant.published);
  const expected=await page.evaluate(({id,itemId,variantId})=>{
    const recipe=window.DucoPublishedRecipes.rows.find(row=>row.id===variantId);
    const saved=window.DemoQuote.snapshot(id);
    const stored=saved.local.wood.find(([key])=>key===itemId)[1].applied;
    const hardware=saved.quote.manufacturing.items.find(row=>row.itemId===itemId).materials;
    const dimensions=value=>[value.name,value.quantityPerProduct,value.width,value.length,value.woodKind];
    return {
      expectedWood:recipe.wood.map(dimensions),capturedWood:stored.map(dimensions),
      expectedSupplies:recipe.hardware.map(value=>[value.name,Number(value.unitPrice)]),
      capturedSupplies:hardware.filter(value=>value.section==='supplies').map(value=>[value.name,Number(value.unitPrice)]),
      referenceTotal:recipe.referenceTotals.amount,
      publication:recipe.publicationSource
    };
  },{id,itemId:currentItem,variantId:variant.published});
  assert.ok(expected.expectedWood.length&&expected.expectedSupplies.length);
  same(expected.capturedWood,expected.expectedWood,'El cotizador debe instanciar el despiece del catálogo publicado.');
  same(expected.capturedSupplies,expected.expectedSupplies,'El cotizador debe precargar las tarifas de referencia de la receta publicada.');
  assertions.push('Receta real cargada por los controles del cotizador con despiece y tarifas de referencia');

  const gallery=await context.newPage();
  await gallery.setViewportSize({width:390,height:844});
  await gallery.goto(base+'catalogo.html');
  await gallery.locator('#products button[data-product="'+variant.product+'"]').click();
  await gallery.locator('#variant').selectOption(variant.published);
  const wood=gallery.locator('[data-recipe-group="wood"] tbody tr');
  assert.equal(await wood.count(),expected.expectedWood.length);
  const names=await wood.locator('th').allTextContents();
  same(names,expected.expectedWood.map(row=>row[0]),'La ficha muestra las mismas piezas de la receta.');
  await gallery.locator('#recipe-source').waitFor({state:'visible'});
  const origin=await gallery.locator('#recipe-source').innerText();
  assert.ok(origin.includes(expected.publication.workbook)&&origin.includes(expected.publication.revision),'La ficha identifica la procedencia publicada.');
  const totals=gallery.locator('[data-recipe-group="totals"] tbody tr').filter({hasText:'Total de referencia'});
  assert.ok((await totals.innerText()).includes(expected.referenceTotal),'La ficha muestra el importe histórico del catálogo.');
  assert.ok(await gallery.locator('#photo').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}));
  assert.ok(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assertions.push('Consulta de receta y foto en la galería en una vista móvil');
  assert.deepEqual(pageErrors,[]);
  assert.deepEqual(requests,[]);
  console.log(JSON.stringify({status:'PASS',environment:publishedURL?'GitHub Pages':'HTTP local',checks:assertions}));
}finally{
  await browser?.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
