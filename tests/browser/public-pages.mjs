// Browser acceptance for the public portfolio. The local host exposes only public assets.
// PAGES_TEST_URL optionally exercises the identical build on the official GitHub Pages URL.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require('playwright');}
catch {playwright=require(path.join(process.env.DEMO_NODE_MODULES||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules'),'playwright'));}
const prefix='/duco-cotizaciones-demo/';
const official='https://gusvann.github.io'+prefix;
const publicURL=process.env.PAGES_TEST_URL;
if(publicURL && publicURL!==official)throw Error('PAGES_TEST_URL must be the official public demo.');
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const expectedHash=digest(await fs.readFile(path.join(root,'index.html')));
const allowedFile=relative=>/^(?:index|catalogo)\.html$/.test(relative) ||
  /^src\/(?:(?:public-product-catalog|published-recipes|published-portfolio)\.js|galeria\.(?:js|css))$/.test(relative) ||
  /^(?:assets\/catalogo|src\/assets\/catalogo-sintetico)\/(?:thumb\/)?[A-Za-z0-9_.-]+\.(?:webp|jpg|jpeg|png|json)$/.test(relative);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=publicURL?null:createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const relative=pathname.slice(prefix.length)||'index.html';
  if(req.method!=='GET'||!pathname.startsWith(prefix)||!allowedFile(relative)){res.writeHead(404).end();return;}
  try {const content=await fs.readFile(path.join(root,relative));res.writeHead(200,{'Content-Type':mime[path.extname(relative)]}).end(content);}
  catch {res.writeHead(404).end();}
});
if(server)await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base=publicURL||'http://127.0.0.1:'+server.address().port+prefix;
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'duco-pages-edge-'));
const failures=[],external=[],results=[];
let context;
async function start(profile='tester'){
  context=await playwright.chromium.launchPersistentContext(path.join(scratch,profile),{
    channel:process.env.DEMO_BROWSER_CHANNEL||'msedge',headless:true,viewport:{width:1400,height:980},
    reducedMotion:'reduce',serviceWorkers:'block'
  });
  context.setDefaultTimeout(15000);
  context.on('page',page=>{
    page.on('pageerror',error=>failures.push(error.message));
    page.on('response',res=>{if(res.status()>=400)failures.push(res.status()+' '+new URL(res.url()).pathname);});
  });
  await context.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(base)||/^(?:data|blob|about):/.test(url)){await route.continue();return;}
    external.push(url);await route.abort();
  });
  const page=await context.newPage();
  const response=await page.goto(base);
  assert.equal(response.status(),200);
  assert.equal(digest(await response.body()),expectedHash,'The browser must receive the expected release build');
  await ready(page);
  return page;
}
async function ready(page){
  await page.waitForFunction(()=>window.DemoJourney?.ready);
  await page.evaluate(()=>window.DemoJourney.ready);
  await page.waitForFunction(()=>!window.DemoJourney.inspect().state.busy);
}
async function restart(profile){await context.close();return start(profile);}
const action=(p,name,suffix='')=>p.locator('#journey-root [data-action="'+name+'"]'+suffix+', #journey-footer [data-action="'+name+'"]'+suffix).filter({visible:true}).first();
const quote=(p,selector)=>p.locator('#quote-host').locator(selector);
const currentId=p=>p.evaluate(()=>window.DemoJourney.inspect().state.id);
const record=(p,id)=>p.evaluate(id=>window.DemoJourney.inspect().records.find(r=>r.id===id),id);
async function open(p,id){
  const browserSource=action(p,'quote-source','[data-source="browser"]');
  if(await browserSource.isVisible()&&await browserSource.getAttribute('aria-pressed')!=='true')await browserSource.click();
  await action(p,'open','[data-id="'+id+'"]').click();
}
const title=(p,value)=>quote(p,'[data-path="name"]').fill(value);
async function stage(p,name){
  const button=action(p,'stage','[data-screen="'+name+'"]');
  if(name==='quote'&&!await button.count())await quote(p,'.steps [data-step="1"]').click();
  else await button.click();
  if(await action(p,'keep-and-leave').isVisible())await action(p,'keep-and-leave').click();
}
async function save(p){
  await quote(p,'.panel-actions [data-action="save"]').click();
  await p.getByText(/guardado en este navegador/i).first().waitFor({state:'visible'});
}
async function caseTest(name,fn){
  try {await fn();results.push({name,passed:true});console.log('PASS '+name);}
  catch(error){results.push({name,passed:false,error:String(error.message).slice(0,1200)});throw error;}
}
let madeId,productItem,confirmed;
try{
  let p=await start();
  await caseTest('El corte de Asana muestra solo folios, estados y fechas en ambas listas',async()=>{
    const quotes=p.locator('[data-published-quote]');
    assert.equal(await quotes.count(),165);
    assert.equal(await quotes.filter({hasText:'Sin folio registrado'}).count(),10);
    assert.equal(await quotes.locator('a, button').count(),0);
    const folio=await p.evaluate(()=>window.DucoPublishedPortfolio.quotes.find(row=>row.folio!==null).folio);
    const matching=await p.evaluate(value=>window.DucoPublishedPortfolio.quotes.filter(row=>row.folio===value).length,folio);
    await p.locator('#j-search').fill(folio);
    assert.equal(await quotes.count(),matching);
    await action(p,'view','[data-view="flujo"]').click();
    assert.equal(await quotes.count(),matching);
    await p.locator('#j-search').fill('');
    assert.equal(await quotes.count(),165);
    await action(p,'view','[data-view="mesa"]').click();

    await action(p,'projects').click();
    const projects=p.locator('[data-public-project-row]');
    assert.equal(await projects.count(),36);
    assert.equal(await projects.locator('a, button').count(),0);
    const projectFolio=await projects.first().getByRole('rowheader').innerText();
    assert.match(projectFolio,/^\d{6,8}$/);
    const search=p.locator('#j-project-search');
    await search.fill(projectFolio);
    const matched=await projects.count();
    assert.ok(matched>0 && matched<36);
    await search.fill(projectFolio.slice(0,4)+'-'+projectFolio.slice(4));
    assert.equal(await projects.count(),matched);
    await p.setViewportSize({width:390,height:844});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await p.setViewportSize({width:1400,height:980});
    await p.goto(base);await ready(p);
  });
  await caseTest('Nueva cotización con madera se recupera después de cerrar Edge',async()=>{
    await action(p,'new-request').click();
    madeId=await currentId(p);
    await title(p,'Mobiliario ficticio de prueba de guardado');
    await stage(p,'quote');
    await quote(p,'[data-action="line-open"]').click();
    await quote(p,'[data-action="line-select-product"][data-product="SYN-NUBE"]').click();
    await quote(p,'[data-line-variant="SYN-NUBE"]').selectOption('PUB-SYN-NUBE-C');
    await quote(p,'[data-action="line-use"][data-product="SYN-NUBE"]').click();
    const quantity=quote(p,'.header-quantity-control input');
    await quantity.fill('2');await quantity.press('Tab');
    await save(p);
    const saved=await p.evaluate(id=>window.DemoQuote.snapshot(id),madeId);
    productItem=saved.quote.items[0].id;
    assert.equal(saved.quote.items[0].quantity,'2');
    const wood=saved.local.wood.find(([id])=>id===productItem)?.[1];
    assert.ok(wood?.applied?.length,'A saved wood recipe contains its applied pieces');
    assert.ok(saved.local.recipeArticles[productItem]);
    p=await restart();
    assert.equal((await record(p,madeId)).request.title,'Mobiliario ficticio de prueba de guardado');
    await open(p,madeId);await stage(p,'quote');
    assert.match(await quote(p,'.part-accordion').first().innerText(),/Florencia/i);
    const reopened=await p.evaluate(id=>window.DemoQuote.snapshot(id),madeId);
    assert.deepEqual(reopened.quote.items,saved.quote.items);
    assert.deepEqual(reopened.local.wood,saved.local.wood);
    assert.deepEqual(reopened.local.recipeArticles[productItem],saved.local.recipeArticles[productItem]);
  });
  await caseTest('Dos pestañas conservan la primera escritura y la segunda captura',async()=>{
    const a=await context.newPage(),b=await context.newPage();
    for(const page of [a,b]){await page.goto(base);await ready(page);await open(page,madeId);}
    await title(a,'Edición de prueba, pestaña uno');
    await title(b,'Edición de prueba, pestaña dos');
    await save(a);
    await quote(b,'.panel-actions [data-action="save"]').click();
    await b.locator('#j-feedback').filter({hasText:/conflicto|pestaña|cambi[oó]|recarga|actualiz/i}).waitFor();
    assert.equal(await quote(b,'[data-path="name"]').inputValue(),'Edición de prueba, pestaña dos');
    await a.reload();await ready(a);
    assert.equal((await record(a,madeId)).request.title,'Edición de prueba, pestaña uno');
    await a.close();await b.close();
  });
  await caseTest('Una cotización guardada y aceptada conserva su proyecto tras cerrar Edge',async()=>{
    await p.goto(base);await ready(p);
    await open(p,madeId);await stage(p,'quote');
    await quote(p,'.steps [data-step="3"]').click();
    // This offer is two demonstration tables at $2,000 each plus 16 % IVA.
    for(const [field,value] of [['unitPrice','2000'],['tax','16']]){
      const input=quote(p,'[data-path="items.0.'+field+'"]');await input.fill(value);await input.press('Tab');
    }
    const review=()=>quote(p,'.steps [data-step="4"]').click();
    const issue=expression=>quote(p,'[data-action="goto-issue"]').filter({hasText:expression});
    const purchaseTax=/^Completa el IVA|IVA de compra de/i;
    await review();
    const taxFields=await issue(purchaseTax).count();
    assert.ok(taxFields>0);
    for(let index=0;index<taxFields;index++){
      await issue(purchaseTax).first().click();
      const tax=quote(p,'[data-row-editor] input:focus');await tax.fill('0');await tax.press('Tab');
      await review();
    }
    assert.equal(await issue(purchaseTax).count(),0);
    // The production sources already carry the line costs. Explicitly exclude these four extras.
    for(const topic of ['Materiales','Servicios externos','Acabados','Personal']){
      await review();await issue(new RegExp('Define quién cubre '+topic,'i')).click();
      const selector=quote(p,'select:focus'),field=await selector.getAttribute('data-path');
      await selector.selectOption('No requerida');
      const reason=quote(p,'[data-path="'+field.replace(/\.resolution$/,'.reason')+'"]');
      await reason.fill('Sin costo adicional fuera de la receta de muestra.');await reason.press('Tab');
    }
    await review();await save(p);await stage(p,'review');
    await p.locator('#j-review-technical').check();await p.locator('#j-review-commercial').check();
    await action(p,'validate').click();await stage(p,'offer');await action(p,'send').click();
    await p.waitForFunction(id=>window.DemoJourney.inspect().records.find(r=>r.id===id).sent,madeId);
    await stage(p,'response');
    await p.locator('#j-response-choice').selectOption('accepted');
    await p.locator('#j-evidence').fill('Aceptación ficticia de la versión de prueba.');
    await p.locator('#j-exact-version').check();await action(p,'register-response').click();
    await stage(p,'project');await action(p,'convert').dblclick();
    await p.waitForFunction(id=>window.DemoJourney.inspect().records.find(r=>r.id===id).project,madeId);
    confirmed=(await record(p,madeId)).project;
    assert.equal(confirmed.baseline.request.title,'Edición de prueba, pestaña uno');
    assert.equal(confirmed.baseline.summary.totalCents,464000);
    p=await restart();
    const recovered=await record(p,madeId);
    assert.equal(recovered.acceptedVersion,confirmed.version);
    assert.equal(recovered.project.id,confirmed.id);
    assert.deepEqual(recovered.project.baseline,recovered.sent.snapshot);
    await action(p,'projects').click();
    const row=action(p,'project-open','[data-id="'+madeId+'"]');
    assert.equal(await p.locator('[data-action="project-open"][data-id="'+madeId+'"]').count(),1);
    await row.click();
    assert.equal(await currentId(p),madeId);
    const rejected=await record(p,'DEMO-208');
    assert.equal(rejected.sent.response.result,'rejected');
    assert.equal(rejected.project,null);
  });
  await caseTest('Los datos de prueba pertenecen a cada perfil del navegador',async()=>{
    p=await restart('second-test-profile');
    assert.equal(await record(p,madeId),undefined);
    assert.equal((await record(p,'DEMO-101')).project,null);
    assert.ok((await record(p,'DEMO-206')).sent.response.result==='accepted');
  });
  await caseTest('Un fallo de escritura conserva la captura y permite volver a guardar',async()=>{
    await action(p,'new-request').click();
    const id=await currentId(p);
    await title(p,'Guardado después de recuperar el espacio de prueba');
    // Fail just the next write on this document. All reads, the retry and reread use real IndexedDB.
    await p.evaluate(()=>{
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...args){
        if(this.name!=='quotes')return original.apply(this,args);
        IDBObjectStore.prototype.put=original;
        throw new DOMException('Test storage limit','QuotaExceededError');
      };
    });
    await quote(p,'.panel-actions [data-action="save"]').click();
    await p.locator('#j-feedback').filter({hasText:/almacenamiento|espacio|no se confirm/i}).waitFor();
    const reader=await context.newPage();await reader.goto(base);await ready(reader);
    assert.equal(await record(reader,id),undefined);
    await save(p);
    await reader.reload();await ready(reader);
    assert.equal((await record(reader,id)).request.title,'Guardado después de recuperar el espacio de prueba');
    await reader.close();
    await p.goto(base);await ready(p);
  });
  await caseTest('Las 135 variantes tienen imagen en el catálogo y ficha adaptable',async()=>{
    await action(p,'new-request').click();await stage(p,'quote');
    await quote(p,'[data-action="line-open"]').click();
    const rows=quote(p,'.recipe-catalog-row');
    assert.equal(await rows.count(),12);
    const variants=new Set(),photos=new Set();
    for(const row of await rows.all()){
      await row.click();
      const card=quote(p,'.recipe-catalog-card');
      const choices=await card.locator('select option:not([value=""])').evaluateAll(opts=>opts.map(o=>o.value));
      for(const id of choices){
        assert.ok(!variants.has(id));variants.add(id);
        await card.locator('select').selectOption(id);
        const pic=card.locator('img');
        const src=await pic.evaluate(async img=>{await img.decode();if(img.naturalWidth<500)throw Error('Imagen de ficha demasiado pequeña');return img.currentSrc;});
        assert.ok(!photos.has(src),'Each variant has its own full-size picture');photos.add(src);
        assert.match(await card.locator('figcaption').innerText(),/IA|inteligencia artificial/i);
      }
    }
    assert.equal(variants.size,135);
    await p.setViewportSize({width:390,height:844});
    await rows.last().click();
    assert.equal(await quote(p,'.recipe-catalog-card img').isVisible(),true);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  });
  await caseTest('La galería abre desde el cotizador, filtra y muestra cada variante en escritorio y móvil',async()=>{
    await p.setViewportSize({width:1400,height:980});
    const [gallery]=await Promise.all([context.waitForEvent('page'),quote(p,'a[href="catalogo.html"]').click()]);
    await gallery.waitForURL(base+'catalogo.html');
    const rows=gallery.locator('#products button'),select=gallery.locator('#variant');
    assert.equal(await rows.count(),12);
    const fullSize=new Set();
    for(const row of await rows.all()){
      await row.click();
      const choices=await select.locator('option').evaluateAll(list=>list.map(o=>o.value));
      for(const id of choices){
        await select.selectOption(id);
        const url=await gallery.locator('#photo').evaluate(async img=>{await img.decode();if(!img.alt||img.naturalWidth<500)throw Error('Ficha sin foto o descripción');return img.currentSrc;});
        assert.ok(!fullSize.has(url));fullSize.add(url);
      }
    }
    assert.equal(fullSize.size,135);
    assert.match(await gallery.locator('#caption').innerText(),/generada con IA/i);
    await gallery.setViewportSize({width:390,height:844});
    await gallery.locator('#search').fill('florencia');
    assert.equal(await rows.count(),1);
    await select.selectOption('PUB-SYN-NUBE-C');
    assert.match(await gallery.locator('#name').innerText(),/Florencia/i);
    assert.ok(await gallery.locator('#recipe [data-recipe-group="wood"]').isVisible());
    await gallery.locator('#photo').evaluate(img=>img.decode());
    assert.ok(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await gallery.getByRole('link',{name:'Volver al cotizador'}).click();await ready(gallery);
    await gallery.close();
  });
  assert.deepEqual(external,[],'The public demo must not call other origins');
  assert.deepEqual(failures,[],'The public demo must load all its resources without errors');
} finally{
  await context?.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  if(path.dirname(scratch)===os.tmpdir() && path.basename(scratch).startsWith('duco-pages-edge-'))await fs.rm(scratch,{recursive:true,force:true});
  const artifacts=path.join(root,'artifacts');
  await fs.mkdir(artifacts,{recursive:true});
  const destination=publicURL?'published':'loopback';
  await fs.writeFile(path.join(artifacts,'pages-'+destination+'-'+expectedHash.slice(0,12)+'.json'),JSON.stringify({destination,sourceHash:expectedHash,results,resourceErrors:failures,external},null,2)+'\n');
}
