import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedIds = ['DEMO-101', 'DEMO-102', ...Array.from({ length: 10 }, (_, index) => `DEMO-${201 + index}`)];
const seedProjectIds = ['DEMO-202', 'DEMO-203', 'DEMO-204', 'DEMO-205', 'DEMO-207'];
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  const modules = process.env.DEMO_NODE_MODULES || path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
  playwright = require(path.join(modules, 'playwright'));
}
const { chromium } = playwright;
const artifacts = path.join(root, 'artifacts');
const sourceHash = createHash('sha256').update(await fs.readFile(path.join(root, 'index.html'))).digest('hex');
await fs.mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.DEMO_BROWSER_CHANNEL ? { channel: process.env.DEMO_BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const externalRequests = [];
const browserErrors = [];
const persistentWrites = [];
await context.route('**/*', async route => {
  const url = route.request().url();
  if (/^(file|data|blob|about):/i.test(url)) await route.continue();
  else { externalRequests.push(url); await route.abort('blockedbyclient'); }
});
await context.addInitScript(() => {
  window.__demoAudit = { writes: [] };
  const record = (kind, detail = '') => window.__demoAudit.writes.push({ kind, detail: String(detail).slice(0, 120) });
  for (const method of ['setItem', 'removeItem', 'clear']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (...args) { record(`Storage.${method}`, args[0]); return original.apply(this, args); };
  }
  if (window.indexedDB) for (const method of ['open', 'deleteDatabase']) {
    const original = IDBFactory.prototype[method];
    IDBFactory.prototype[method] = function (...args) { record(`indexedDB.${method}`, args[0]); return original.apply(this, args); };
  }
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookie?.set) Object.defineProperty(Document.prototype, 'cookie', { ...cookie, set(value) { record('cookie', value); return cookie.set.call(this, value); } });
  if (window.CacheStorage) {
    const original = CacheStorage.prototype.open;
    CacheStorage.prototype.open = function (...args) { record('caches.open', args[0]); return original.apply(this, args); };
  }
  if (window.ServiceWorkerContainer) {
    const original = ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register = function (...args) { record('serviceWorker.register', args[0]); return original.apply(this, args); };
  }
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
async function capture(options){
  if(options.fullPage) await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,left:0,behavior:'instant'});});
  return page.screenshot(options);
}
// A component capture excludes the fixed shell and transient session notice.
const captureFamily=(element,name)=>element.screenshot({path:path.join(artifacts,name),
  style:'#journey-root .j-top, #journey-root .j-skip, #quote-host #notice {visibility:hidden !important}'});
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
page.on('dialog', dialog => dialog.accept());
const action = (name, suffix = '') => page.locator(`#journey-root [data-action="${name}"]${suffix}, #journey-footer [data-action="${name}"]${suffix}`);
const requestedField = key => quote(`[data-path="${({title:'name'})[key] || key}"]`);
const catalogRow = product => quote(`[data-action="line-select-product"][data-product="${product}"]`);
async function fillRequest(key, value) {
  if (['quoteDue','deliveryDate'].includes(key) && !await requestedField(key).isVisible()) await quote('[data-action="toggle-responsibles"]').click();
  await requestedField(key).fill(value);
}
const stageControl = name => action('stage', `[data-screen="${name}"]`).first();
async function stage(name) {
  const control = stageControl(name);
  if(name==='request'&&!await control.count())await quote('.steps [data-action="step"][data-step="0"]').click();
  else if(name==='quote'&&!await control.count())await quote('.panel-actions [data-action="step"][data-step="1"]').click();
  else await control.click();
  if (await action('keep-and-leave').isVisible()) await action('keep-and-leave').click();
}
async function list() {
  await action('list').filter({visible:true}).first().click();
  if (await action('keep-and-leave').isVisible()) await action('keep-and-leave').click();
}
const inspect = () => page.evaluate(() => window.DemoJourney.inspect());
const quoteSummary = id => page.evaluate(id => window.DemoQuote.summary(id), id);
const quote = selector => page.locator('#quote-host').locator(selector);
async function openDetails(details) {
  if (!await details.evaluate(element => element.open)) await details.locator(':scope > summary').click();
}
async function openFirstArticle(section) {
  const article = quote('.part-accordion').first();
  const trigger = article.locator('[data-action="toggle-part"]');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  if (section) await openDetails(article.locator(`[data-article-fold="${section}"]`));
  return article;
}
const record = async id => (await inspect()).records.find(value => value.id === id);
async function save(outcome = 'success') {
  if (!await page.locator('.j-demo-tools').evaluate(element => element.open)) await page.locator('.j-demo-tools > summary').click();
  await page.locator('#j-save-outcome').selectOption(outcome);
  // The upper duplicate strip was removed; Request and Quote share the native save.
  await quote('.panel-actions [data-action="save"]').click();
}
async function approveAndSend() {
  await stage('review');
  await page.locator('#j-review-technical').check();
  await page.locator('#j-review-commercial').check();
  await action('validate').click();
  await stage('offer');
  await action('send').click();
}
async function exactVersion(value) {
  const control = page.locator('#j-exact-version');
  const kind = await control.evaluate(element => element.tagName === 'SELECT' ? 'select' : element.type);
  if (kind === 'select') await control.selectOption(String(value));
  else if (kind === 'checkbox') await control.setChecked(Boolean(value));
  else await control.fill(String(value));
}
async function respond(choice, evidence, version) {
  await stage('response');
  await page.locator('#j-response-choice').selectOption(choice);
  await page.locator('#j-evidence').fill(evidence);
  if (version !== undefined) await exactVersion(version);
  await action('register-response').click();
}
const collectWrites = async () => persistentWrites.push(...await page.evaluate(() => window.__demoAudit?.writes || []));
async function waitForDemoReady() {
  await page.waitForFunction(() => window.DemoJourney?.ready && window.DemoQuote);
  await page.evaluate(async () => { await window.DemoJourney.ready; });
  // Reset reseeds asynchronously after the original startup promise has settled.
  await page.waitForFunction(() => !window.DemoJourney.inspect().state.busy && window.DemoJourney.inspect().records.length === 12);
}
const fresh = async () => {
  assert.equal(createHash('sha256').update(await fs.readFile(path.join(root, 'index.html'))).digest('hex'), sourceHash, 'Build changed during the acceptance run; restart against one fixed artifact');
  if (page.url() !== 'about:blank') await collectWrites();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await waitForDemoReady();
};
async function open(id) {
  const selector = `[data-id="${id}"]`;
  const next = action('open', selector).first();
  if (!await next.count()) await action('quote-detail', selector).click();
  await next.click();
}
const results = [];
async function test(name, run) {
  if (process.env.DEMO_TEST_FILTER && !new RegExp(process.env.DEMO_TEST_FILTER, 'i').test(name)) return;
  try { await fresh(); await run(); results.push({ name, ok: true }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) {
    results.push({ name, ok: false, error: error.stack || String(error) });
    process.stdout.write(`FAIL ${name}: ${error.message}\n`);
    await page.screenshot({ path: path.join(artifacts, `failure-${results.length}.png`), fullPage: true }).catch(() => {});
  }
}

try {
  await test('Avisos por etapa llevan al precio del producto correcto sin adelantar impuestos ni duplicar pagos',async()=>{
    await open('DEMO-101');
    await stage('quote');
    await quote('[data-action="line-add"]').click();
    await quote('[data-action="line-open"]').click();
    await catalogRow('SYN-BOLONIA').click();
    const product=quote('[data-line-product="SYN-BOLONIA"]');
    await product.locator('select').selectOption('SYN-BOLONIA-R');
    await product.locator('[data-action="line-use"]').click();
    const article=quote('.part-accordion').filter({hasText:'Bolonia'}).last();
    await article.getByRole('button',{name:/Aumentar cantidad/}).click();
    assert.equal(await page.locator('#j-blockers').count(),0);
    assert.doesNotMatch(await quote('#workspace').innerText(),/completa el impuesto|revisa la calidad|confirma la cobertura|pagos deben sumar/i);
    await quote('.steps [data-step="4"]').click();
    const warnings=quote('.pending-list button[data-action="goto-issue"]');
    const tax=warnings.filter({hasText:/impuesto/i}).filter({hasText:/Bolonia/i});
    assert.equal(await tax.count(),1);
    assert.doesNotMatch((await warnings.allTextContents()).join(' '),/deben sumar exactamente|revisa la calidad|confirma la cobertura/i);
    await tax.click();
    assert.equal(await quote('.steps [data-step="3"]').getAttribute('aria-current'),'step');
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.path),'items.1.tax');
  });
  await test('Guardar y continuar conserva un borrador con precio de venta pendiente',async()=>{
    await open('DEMO-101');
    await stage('quote');
    await quote('.steps [data-step="3"]').click();
    const price=quote('[data-path="items.0.unitPrice"]');
    await price.fill('');
    await price.press('Tab');
    await action('list').filter({visible:true}).first().click();
    assert.equal(await action('save-and-leave').isEnabled(),true);
    await action('save-and-leave').click();
    await page.waitForFunction(()=>window.DemoJourney.inspect().state.screen==='list');
    const saved=await page.evaluate(()=>window.DemoQuote.snapshot('DEMO-101'));
    assert.equal(saved.quote.items[0].unitPrice,'');
    assert.equal(saved.summary.complete,false);
    assert.equal(saved.summary.priceCents,null);
  });
  await test('Revisión abre el IVA del herraje exacto y el porcentaje del empaque del pedido', async()=>{
    await action('new-request').click();
    await quote('.panel-actions [data-action="step"][data-step="1"]').click();
    await quote('[data-action="line-open"]').click();
    await catalogRow('SYN-BENT-LEGS').click();
    const product=quote('[data-line-product="SYN-BENT-LEGS"]');
    await product.locator('select').selectOption('SYN-BENT-LEGS-R');
    await product.locator('[data-action="line-use"]').click();
    await quote('[data-header-increment]').click();
    await quote('.steps [data-step="4"]').click();
    const hardware=quote('[data-action="goto-issue"]').filter({hasText:/IVA de compra de TUERCA INSERTO/i});
    await hardware.click();
    let selected=quote('[data-row-editor] [data-break-field="taxRate"]:focus');
    assert.equal(await selected.count(),1);
    assert.equal(await selected.locator('xpath=ancestor::*[@data-row-editor]').locator('[data-break-field="specification"]').inputValue(),'TUERCA INSERTO');
    await selected.fill('0');
    await selected.press('Tab');
    await quote('.steps [data-step="4"]').click();
    assert.equal(await hardware.count(),0);
    await quote('.steps [data-step="2"]').click();
    await quote('[data-general-action="edit"][data-topic="Empaque"]').first().click();
    await quote('[data-general-field="rate"]').fill('');
    await quote('.general-editor [data-break-action="save-editor"]').click();
    await quote('.steps [data-step="4"]').click();
    await quote('[data-action="goto-issue"]').filter({hasText:/porcentaje de empaque/i}).click();
    selected=quote('.general-editor [data-general-field="rate"]:focus');
    assert.equal(await selected.count(),1);
    assert.equal(await selected.inputValue(),'');
  });
  await test('Bent Legs tiene imagen, receta editable y totales precisos para una y dos mesas',async()=>{
    await action('new-request').click();
    await quote('.panel-actions [data-action="step"][data-step="1"]').click();
    await quote('[data-action="line-open"]').click();
    await catalogRow('SYN-BENT-LEGS').click();
    const product=quote('[data-line-product="SYN-BENT-LEGS"]');
    await product.locator('select').selectOption('SYN-BENT-LEGS-R');
    await product.locator('img').evaluate(img=>img.decode());
    assert.ok(await product.locator('img').evaluate(img=>img.complete&&img.naturalWidth>500&&new URL(img.src).pathname.endsWith('/src/assets/catalogo-sintetico/SYN-BENT-LEGS-R.png')));
    await product.screenshot({path:path.join(artifacts,'bent-legs-catalogo.png')});
    await product.locator('[data-action="line-use"]').click();
    const qty=quote('.header-quantity-control input'),total=quote('[data-article-cost-status]');
    if(await qty.inputValue()!=='1')await quote('[data-header-increment]').click();
    // Synthetic unit: wood 178.86 + CNC 18 + metal 244.50733 + supplies 353 + assembly 160.
    assert.match(await total.innerText(),/954\.37/);
    await quote('[data-header-increment]').click();
    assert.equal(await qty.inputValue(),'2');assert.match(await total.innerText(),/1,908\.74/);
    const metal=quote('.article-study-fold').filter({has:page.locator('[data-fab-cost-field="rollingQty"]')});
    if(!await metal.evaluate(el=>el.open))await metal.locator(':scope > summary').click();
    const rolling=metal.locator('[data-fab-panel="metal-other"]');
    if(!await rolling.evaluate(el=>el.open))await rolling.locator(':scope > summary').click();
    const bends=metal.locator('[data-fab-cost-field="rollingQty"]');
    await page.setViewportSize({width:390,height:760});
    await bends.fill('0');assert.match(await total.innerText(),/1,848\.74/);
    await bends.fill('2');await bends.press('Tab');assert.match(await total.innerText(),/1,908\.74/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
    await quote('[data-header-decrement]').click();await total.scrollIntoViewIfNeeded();
    assert.match(await total.innerText(),/954\.37/);
    await capture({path:path.join(artifacts,'bent-legs-movil.png')});
  });
  await test('Tableros y herrería muestran el despiece de prueba en escritorio y móvil',async()=>{
    await action('new-request').click();
    await quote('.panel-actions [data-action="step"][data-step="1"]').click();
    await quote('[data-action="line-open"]').click();
    await catalogRow('SYN-BOLONIA').click();
    const product=quote('[data-line-product="SYN-BOLONIA"]');
    await product.locator('select').selectOption('SYN-BOLONIA-R');
    await product.locator('[data-action="line-use"]').click();
    if(await quote('.header-quantity-control input').inputValue()!=='1')await quote('[data-header-increment]').click();
    const fold=key=>quote('[data-article-fold="'+key+'"]');
    // The public exercise uses a 0.20 m² board and an independently priced steel assembly.
    for(const [family,expected] of [['boards','60.00'],['metal','244.51']]){
      const panel=fold(family);
      if(!await panel.evaluate(el=>el.open))await panel.locator(':scope > summary').click();
      assert.ok((await panel.locator(':scope > summary').innerText()).includes(expected));
      const summaries=panel.locator('.fabrication-block > summary');
      assert.equal(await summaries.count(),family==='boards'?6:7);
      await captureFamily(panel,'vista-'+family+'-bent-legs.png');
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
      assert.ok(await panel.locator('.fabrication-workshop').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      await captureFamily(panel,'vista-'+family+'-movil.png');
      await page.setViewportSize({width:1440,height:1000});
    }
    await quote('[data-fab-panel="board-cnc"] > summary').click();
    await quote('[data-fab-cost-field="cncRate"]').fill('0');
    assert.match(await quote('[data-capture-subtotal="board-cnc"]').innerText(),/0\.00/);
    assert.match(await fold('boards').locator(':scope > summary').innerText(),/48\.00/);
  });
  await test('Bolonia permite editar calibre y peso de lámina junto al despiece de perfiles',async()=>{
    await action('new-request').click();
    await quote('.panel-actions [data-action="step"][data-step="1"]').click();
    await quote('[data-action="line-open"]').click();
    await catalogRow('SYN-BOLONIA').click();
    const product=quote('[data-line-product]').filter({has:page.locator('option[value="SYN-BOLONIA-R"]')});
    await product.locator('[data-line-variant]').selectOption('SYN-BOLONIA-R');
    await product.locator('img').evaluate(img=>img.decode());
    assert.ok(await product.locator('img').evaluate(img=>img.naturalWidth>500&&new URL(img.src).pathname.endsWith('/src/assets/catalogo-sintetico/SYN-BOLONIA-R.png')));
    assert.match(await product.locator('figcaption').innerText(),/IA/);
    await captureFamily(product,'bolonia-catalogo.png');
    await product.locator('[data-action="line-use"]').click();
    if(await quote('.header-quantity-control input').inputValue()!=='1')await quote('[data-header-increment]').click();
    const metal=quote('[data-article-fold="metal"]');
    if(!await metal.evaluate(el=>el.open))await metal.locator(':scope > summary').click();
    const sheet=metal.locator('[data-fab-panel="metal-sheet"]');
    assert.match(await sheet.innerText(),/Área · m²\s+0\.2\b/);
    assert.match(await sheet.innerText(),/Peso · kg\s+2\b/);
    await captureFamily(metal,'vista-herreria-bolonia.png');
    await sheet.locator('[data-row-field="gauge"]').click();
    const editor=sheet.locator('[data-row-editor]');
    assert.equal(await editor.locator('[data-break-field="gauge"]').inputValue(),'14');
    assert.equal(await editor.locator('[data-break-field="detail.kgPerM2"]').inputValue(),'10');
    await editor.locator('[data-break-field="width"]').fill('70');
    await editor.locator('[data-break-field="width"]').press('Tab');
    await sheet.locator('summary').first().click();
    if(!await sheet.evaluate(el=>el.open))await sheet.locator(':scope > summary').click();
    const width=sheet.locator('[data-break-field="width"],[data-row-field="width"]').first();
    assert.equal(await width.inputValue(),'70');
  });
  await test('Florencia móvil mantiene la captura y el desplazamiento dentro de la tabla',async()=>{
    await action('new-request').click();
    await quote('.panel-actions [data-action="step"][data-step="1"]').click();
    await quote('[data-action="line-open"]').click();
    await quote('[data-line-variant="SYN-NUBE"]').selectOption('SYN-NUBE-C');
    await quote('[data-action="line-use"][data-product="SYN-NUBE"]').click();
    await quote('[data-header-increment]').click();
    const wood=quote('[data-article-fold="wood"]');
    const labor=wood.locator('[data-fab-panel="workshop-labor"]'),table=labor.locator('.workshop-table-scroll');
    const tariff=table.locator('[data-workshop-field="labor.assembly.rate"]');
    await openDetails(wood);
    const consumables=wood.locator('[data-fab-panel="workshop-other"]');
    await openDetails(consumables);
    // The public Florencia exercise carries one cut of 180 cm per article.
    assert.equal(await consumables.locator('[data-workshop-live="cnc-length"]').innerText(),'1.8 m');
    const cncRate=consumables.locator('[data-workshop-field="other.cnc.price"]');
    const recipeRate=await cncRate.inputValue();
    await cncRate.fill('');
    assert.equal(await consumables.locator('[data-workshop-live="cnc-length"]').innerText(),'1.8 m');
    assert.equal(await consumables.locator('[data-workshop-live="cnc-amount"] strong').innerText(),'Pendiente');
    await cncRate.fill(recipeRate);
    async function expand(fold,open){
      if(await fold.evaluate(el=>el.open)!==open)await fold.locator(':scope > summary').click();
    }
    async function fits(width){
      const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,x:window.scrollX}));
      assert.ok(size.page<=size.viewport+1,`At ${width}px the document is ${size.page}px for a ${size.viewport}px viewport`);
      assert.equal(size.x,0);
    }
    for(const width of [360,390,468]){
      await page.setViewportSize({width,height:760});
      await expand(wood,false);await fits(width);
      await expand(wood,true);await expand(labor,false);await fits(width);
      await expand(labor,true);await fits(width);
      await table.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
      const last=table.locator('.workshop-table-row').first().locator('output');
      assert.equal(await last.evaluate(el=>{
        const cell=el.getBoundingClientRect(),view=el.closest('[role="region"]').getBoundingClientRect();
        return cell.left>=view.left-1&&cell.right<=view.right+1;
      }),true,'The last amount is reachable inside its table');
      await tariff.fill('0');await tariff.press('End');
      const before=await page.evaluate(()=>({x:scrollX,y:scrollY}));
      await tariff.pressSequentially('.00');
      assert.equal(await tariff.inputValue(),'0.00');
      assert.equal(await tariff.evaluate(el=>el===document.activeElement),true);
      assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY})),before);
      await tariff.press('Tab');await fits(width);
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Cómo se calcula MO Entablerado');
    }
  });
  await test('Exterior Astil conserva identidad, navegación y menú móvil',async()=>{
    const phase=process.env.DEMO_CAPTURE_PHASE||'after';
    const measurements=[];
    for(const width of [1440,390]){
      await fresh();
      await page.setViewportSize({width,height:1000});
      await capture({path:path.join(artifacts,`astil-shell-${phase}-mesa-${width}.png`),fullPage:true});
      await action('view','[data-view="flujo"]').click();
      await capture({path:path.join(artifacts,`astil-shell-${phase}-flujo-${width}.png`),fullPage:true});
      await open('DEMO-101');
      const measure=()=>page.evaluate(()=>{const h=document.querySelector('.j-top').getBoundingClientRect(),t=document.querySelector('.j-case-head h1').getBoundingClientRect();return {width:innerWidth,scrollY,header:{top:h.top,bottom:h.bottom,height:h.height},title:{top:t.top,bottom:t.bottom,height:t.height},focused:document.activeElement?.className||document.activeElement?.tagName};});
      const afterOpen=await measure();
      await page.screenshot({path:path.join(artifacts,`astil-shell-request-open-viewport-${width}.png`)});
      await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,left:0,behavior:'instant'});});
      const atTop=await measure();
      await page.screenshot({path:path.join(artifacts,`astil-shell-request-neutral-viewport-${width}.png`)});
      await capture({path:path.join(artifacts,`astil-shell-${phase}-request-${width}.png`),fullPage:true});
      measurements.push({afterOpen,atTop});
    }
    await fs.writeFile(path.join(artifacts,`astil-shell-header-bounds-${sourceHash.slice(0,12)}.json`),JSON.stringify({sourceHash,measurements},null,2)+'\n');
    for(const {afterOpen} of measurements) assert.ok(afterOpen.title.top>=afterOpen.header.bottom,`Title is obscured after opening at ${afterOpen.width}px: ${JSON.stringify(afterOpen)}`);
    await fresh();
    assert.equal(await page.locator('#j-sidebar.j-sidebar').count(),1,'Astil desktop shell requires its sidebar');
    const logo=page.locator('#j-sidebar svg.j-sidebar-logo');
    assert.equal(await logo.count(),1,'The sidebar must use the real SVG wordmark');
    assert.equal(await logo.getAttribute('viewBox'),'0 0 272 100');
    assert.deepEqual(await logo.locator('path').evaluateAll(paths=>paths.map(path=>path.getAttribute('d'))),[
      'M4 92 37 12h16L27 92Z','m42 12 15-1 34 81H68Z','M156 32h-34c-8 0-13 4-13 9s5 8 13 8h17c15 0 24 8 24 21s-10 22-27 22H98V77h38c7 0 11-3 11-8s-4-7-11-7h-17c-16 0-25-8-25-22 0-13 11-22 28-22h34Z','m169 24 16-16v24h14v14h-14v22c0 7 4 10 11 10h5v14h-8c-16 0-24-8-24-23Z','M211 32h16v60h-16Z','m237 24 16-16v60c0 7 4 10 11 10h3v14h-7c-15 0-23-8-23-23Z','m35 92 11-27 12 27z'
    ],'Wordmark geometry must match the established Astil brand');
    const brandTransforms=[null,null,'translate(128.5 92) scale(0.8108108108108109) translate(-128.5 -92)',null,null,null,null];
    for(const instance of [logo,page.locator('.j-mobile-brand svg.j-sidebar-logo')])
      assert.deepEqual(await instance.locator('path').evaluateAll(paths=>paths.map(path=>path.getAttribute('transform'))),brandTransforms,'Only the lowercase s is scaled uniformly; desktop and mobile share the canonical drawing');
    assert.equal(await logo.locator('rect[x="211"][y="8"][width="16"][height="16"]').count(),1);
    assert.equal(await page.locator('#j-main h1').count(),1);
    const heading=page.locator('#j-main h1.j-split-heading');
    assert.equal(await heading.count(),1);
    assert.match(await heading.locator('.j-heading-lead').innerText(),/\S/);
    assert.match(await heading.locator('.j-heading-emphasis').innerText(),/\S/);
    assert.equal(await heading.locator('.j-heading-lead').evaluate(element=>getComputedStyle(element).color),'rgb(19, 41, 61)');
    assert.equal(await heading.locator('.j-heading-emphasis').evaluate(element=>getComputedStyle(element).color),'rgb(15, 116, 217)');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(246, 250, 255)');
    for(const width of [1440,768,390]){
      await page.setViewportSize({width,height:1000});
      const topbar=await page.locator('.j-top').evaluate(element=>({color:getComputedStyle(element).backgroundColor,image:getComputedStyle(element).backgroundImage}));
      if(width>750){
        assert.equal(Math.round((await page.locator('#j-sidebar').boundingBox()).width),width<=1100?205:237);
        assert.match(topbar.color,/^rgba?\(255, 255, 255(?:, (?:0\.[89]\d*|1))?\)$/);
        assert.equal(topbar.image,'none');
      }else{
        assert.match(topbar.image,/linear-gradient/);
        assert.match(topbar.image,/rgb\(7, 59, 114\)/);
        assert.match(topbar.image,/rgb\(15, 116, 217\)/);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Astil shell overflow at ${width}px`);
      await action('view','[data-view="flujo"]').click();
      assert.equal(await action('view','[data-view="flujo"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-record-id]').count(),seedIds.length);
      await action('view','[data-view="mesa"]').click();
      assert.equal(await action('view','[data-view="mesa"]').getAttribute('aria-pressed'),'true');
    }
    const toggle=page.locator('.j-mobile-menu[data-action="toggle-menu"][aria-controls="j-sidebar"]');
    assert.equal(await toggle.isVisible(),true);
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#j-sidebar').isVisible(),false,'The closed mobile navigation must not remain visible or keyboard reachable');
    assert.match(await toggle.getAttribute('aria-label')||await toggle.innerText(),/menú|navegación/i);
    await toggle.focus();await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('.j-sidebar-backdrop[data-action="close-menu"]').isVisible(),true);
    const navSummary=page.locator('#j-sidebar [data-nav-group="portfolio"] > summary');
    const operationSummary=page.locator('#j-sidebar [data-nav-group="operations"] > summary');
    const navProjects=page.locator('#j-sidebar [data-action="projects"]');
    const navKpis=page.locator('#j-sidebar [data-action="kpis"]');
    assert.equal(await navSummary.evaluate(element=>element===document.activeElement),true);
    await page.keyboard.press('Tab');
    assert.equal(await navKpis.evaluate(element=>element===document.activeElement),true,'KPIs precedes Cotizador within Portafolio');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await navSummary.evaluate(element=>element===document.activeElement),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await operationSummary.evaluate(element=>element===document.activeElement),true,'The closed section still has a reachable heading');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await navProjects.evaluate(element=>element===document.activeElement),true,'Backward focus wraps to the last visible entry');
    await page.keyboard.press('Tab');
    assert.equal(await operationSummary.evaluate(element=>element===document.activeElement),true,'Forward focus wraps within the open navigation');
    await capture({path:path.join(artifacts,'astil-shell-after-menu-390.png'),fullPage:true});
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await toggle.evaluate(element=>element===document.activeElement),true,'Escape must restore menu-button focus');
    await toggle.click();
    await page.locator('.j-sidebar-backdrop[data-action="close-menu"]').click({position:{x:380,y:500}});
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await toggle.click();
    const disabledModules=page.locator('#j-sidebar button:disabled,#j-sidebar [aria-disabled="true"]');
    assert.ok(await disabledModules.count()>0,'Out-of-scope modules must remain disabled');
    const cotizadorNav=page.locator('#j-sidebar [data-action="list"]');
    assert.match(await cotizadorNav.innerText(),/Cotizador/i);
    await cotizadorNav.focus();
    await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal((await inspect()).state.screen,'list');
    assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,'src','cotizador.html'))).digest('hex'),'3291618da77246df866be50ce53e3a74589435797e0b75975e35d69b71bb6a67','Shell alignment must preserve the native D85 source');
  });

  await test('Las pantallas aprovechan el ancho y Proyectos recupera el título resaltado',async()=>{
    const main=page.locator('#j-main');
    const projectHeading=main.locator('.j-head .j-section-statement');
    const nav=section=>page.locator('#j-sidebar [data-action="'+section+'"]');
    const group=section=>page.locator('#j-sidebar [data-nav-group="'+section+'"] > summary');
    async function verifyWidth(selector, embedded=false) {
      for(const width of [2560,1920,1440,768,390]){
        await page.setViewportSize({width,height:950});
        const geometry=await page.locator(selector).evaluate((el,showForm)=>{
          const main=document.getElementById('j-main'), sidebar=document.getElementById('j-sidebar');
          const leftInset=el.getBoundingClientRect().left-(getComputedStyle(sidebar).visibility==='hidden'?0:sidebar.getBoundingClientRect().right);
          const width=document.documentElement.clientWidth;
          const rightInset=width-el.getBoundingClientRect().right;
          const form=showForm?document.querySelector('#quote-host .mainform').getBoundingClientRect():null;
          return {leftInset,rightInset,width,overflow:document.documentElement.scrollWidth-width,formInset:form?Math.abs(form.left-el.getBoundingClientRect().left):null,
            topInset:parseFloat(getComputedStyle(main).paddingTop)};
        },embedded);
        assert.ok(geometry.leftInset>=15&&geometry.leftInset<=27&&geometry.rightInset>=15&&geometry.rightInset<=27,selector+' '+JSON.stringify(geometry));
        assert.ok(geometry.overflow<=1&&geometry.topInset<=23,selector+' '+JSON.stringify(geometry));
        if(embedded)assert.ok(geometry.formInset<=1,'El formulario comparte el borde del encabezado');
      }
      await page.setViewportSize({width:1920,height:950});
    }
    await verifyWidth('#j-main .j-table-wrap');
    const offset=await main.evaluate(el=>el.querySelector('.j-table-wrap').getBoundingClientRect().top-el.getBoundingClientRect().top);
    assert.ok(offset<320,'Los filtros y el encabezado dejan visible la lista antes');
    await page.screenshot({path:path.join(artifacts,'mesa-espaciado-1920.png')});
    await action('view','[data-view="flujo"]').click();
    await verifyWidth('#j-main .j-board');
    await nav('projects').click();
    await verifyWidth('#j-main .j-table-wrap');
    assert.equal(await projectHeading.locator('.j-eyebrow').textContent(),'Seguimiento operativo');
    assert.equal(await projectHeading.locator('.j-heading-emphasis').textContent(),'Del plan a la entrega.');
    for(const width of [1920,390]){
      await page.setViewportSize({width,height:950});
      const heading=await projectHeading.evaluate(el=>{
        const lead=el.querySelector('.j-heading-lead');
        const emphasis=el.querySelector('.j-heading-emphasis');
        const main=el.closest('main').getBoundingClientRect();
        const table=el.closest('main').querySelector('.j-table-wrap').getBoundingClientRect();
        return {color:getComputedStyle(emphasis).color,
          onNewLine:emphasis.getBoundingClientRect().top>=lead.getBoundingClientRect().bottom-1,
          tableOffset:table.top-main.top};
      });
      assert.equal(heading.color,'rgb(15, 116, 217)');
      assert.equal(heading.onNewLine,true,'The highlighted phrase starts on a second line at '+width+' px');
      assert.ok(heading.tableOffset<240,'The heading keeps the first row close at '+width+' px');
      await page.screenshot({path:path.join(artifacts,`proyectos-del-plan-a-la-entrega-${width}.png`)});
    }
    await page.setViewportSize({width:1920,height:950});
    await nav('kpis').click();
    await verifyWidth('#j-main .j-kpi-toolbar');
    await group('operations').click();
    for(const screen of ['production','deliveries']){
      await nav(screen).click();
      await verifyWidth('#j-main .j-table-wrap');
    }
    await group('portfolio').click();
    await nav('list').click();
    await open('DEMO-101');
    await verifyWidth('#j-main .j-case-head',true);
    await stage('quote');
    await verifyWidth('#j-main .j-case-head',true);
  });

  await test('Líneas limpias se aplica a Mesa y Proyectos en escritorio y móvil',async()=>{
    const list=page.locator('#j-main .j-list-table');
    const nav=section=>page.locator('#j-sidebar [data-action="'+section+'"]');
    const verifyList=async columns=>{
      assert.equal(await list.locator('th').count(),columns);
      assert.equal(await list.locator('th').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(240, 246, 252)');
      assert.equal(await list.evaluate(el=>getComputedStyle(el).boxShadow),'none');
      await page.setViewportSize({width:390,height:800});
      const size=await list.evaluate(el=>({documentWidth:document.documentElement.scrollWidth,width:el.clientWidth,content:el.scrollWidth}));
      assert.ok(size.documentWidth<=391&&size.content>size.width,'Only the table scrolls horizontally on mobile');
      await page.setViewportSize({width:1440,height:1000});
    };
    await verifyList(6);
    assert.equal(await list.locator('th.j-money').evaluate(el=>getComputedStyle(el).textAlign),'right');
    await page.locator('#j-search').fill('sin-resultado');
    assert.match(await list.locator('.j-empty').innerText(),/No hay expedientes/);
    await page.locator('#j-search').fill('');
    await page.screenshot({path:path.join(artifacts,'lineas-limpias-cotizador.png')});
    await nav('projects').click();
    await verifyList(5);
    await page.screenshot({path:path.join(artifacts,'lineas-limpias-proyectos.png')});
    await list.locator('[data-action="project-open"]').first().click();
    assert.equal((await inspect()).state.screen,'project');
    await page.locator('#j-sidebar [data-nav-group="operations"] > summary').click();
    await nav('production').click();
    assert.equal(await list.count(),0);
    await page.locator('#j-sidebar [data-nav-group="portfolio"] > summary').click();
    await nav('list').click();
    await action('view','[data-view="flujo"]').click();
    assert.equal(await list.count(),0);
  });

  await test('Acordeón lateral conserva su estado y admite teclado en escritorio y móvil',async()=>{
    const section=key=>page.locator('#j-sidebar [data-nav-group="'+key+'"]');
    const heading=key=>section(key).locator(':scope > summary');
    const expanded=()=>page.locator('#j-sidebar [data-nav-group][open]').evaluateAll(groups=>groups.map(group=>group.dataset.navGroup));
    assert.deepEqual(await expanded(),['portfolio']);
    await heading('operations').click();
    assert.deepEqual(await expanded(),['operations']);
    assert.equal(await section('portfolio').locator('[data-action="list"]').isVisible(),false);
    await page.locator('#j-search').fill('mesa');
    assert.deepEqual(await expanded(),['operations'],'Filtering preserves the disclosure choice');
    await heading('operations').press('Space');
    assert.deepEqual(await expanded(),[]);
    await page.locator('#j-search').fill('');
    assert.deepEqual(await expanded(),[],'Both sections can stay collapsed');
    await heading('operations').press('Enter');
    await section('operations').locator('[data-action="production"]').click();
    assert.deepEqual(await expanded(),['operations']);
    assert.equal(await section('operations').locator('[data-action="production"]').getAttribute('aria-current'),'page');
    await page.setViewportSize({width:390,height:760});
    const menu=page.locator('.j-mobile-menu');
    await menu.press('Enter');
    assert.equal(await heading('operations').evaluate(element=>element===document.activeElement),true);
    await heading('portfolio').press('Enter');
    assert.deepEqual(await expanded(),['portfolio']);
    await page.keyboard.press('Escape');
    assert.equal(await menu.evaluate(element=>element===document.activeElement),true);
    await menu.click();
    assert.deepEqual(await expanded(),['portfolio'],'Reopening the drawer preserves the choice');
    await section('portfolio').locator('[data-action="projects"]').click();
    assert.equal((await inspect()).state.screen,'projects');
    assert.equal(await menu.getAttribute('aria-expanded'),'false');
    await menu.click();
    assert.deepEqual(await expanded(),['portfolio']);
    assert.equal(await section('portfolio').locator('[data-action="projects"]').getAttribute('aria-current'),'page');
  });

  await test('Solicitud usa el formulario nativo D85 sin captura duplicada', async () => {
    await open('DEMO-101');
    assert.equal(await page.locator('#j-main .j-case-head p.j-muted, #j-main .j-stages').count(),0);
    assert.equal(await page.locator('#j-main .j-case-head .j-eyebrow').textContent(),'DEMO-101 · Versión 1');
    assert.equal(await quote('#request-scope-title').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(240, 246, 252)');
    const phase = process.env.DEMO_CAPTURE_PHASE || 'after';
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await capture({path:path.join(artifacts,`request-${phase}-${width}.png`),fullPage:true});
    }
    await page.setViewportSize({width:1440,height:1000});
    assert.equal(await page.locator('#quote-host').isVisible(),true,'Solicitud must show the current native cotizador form');
    assert.equal(await page.locator('[data-request]').count(),0,'No parallel request form is permitted');
    assert.equal(await page.getByRole('heading',{name:'Solicitud y alcance',exact:true}).count(),1);
    assert.equal(await quote('[data-path="need"]').count(),1);
    assert.equal(await quote('[data-path="need"]').getAttribute('maxlength'),'1800');
    assert.equal(await page.locator('#j-main .j-save-strip').count(),0,'Request omits the duplicate upper strip');
    assert.equal(await quote('.panel-actions [data-action="save"]').isVisible(),true);
    assert.match(await quote('.panel-actions [data-action="step"][data-step="1"]').innerText(),/Continuar sin guardar/);
    assert.equal(await quote('label[for="f-need"]').innerText(),'Descripción del encargo');
    assert.equal(await page.locator('#f-need-help').innerText(),'Describe la solicitud general. Usa Incluye y No incluye para delimitar la oferta; los detalles del producto se capturan en Artículos');
    assert.match(await quote('[data-path="need"]').getAttribute('aria-describedby'),/f-need-help/);
    for(const selector of ['[data-path="name"]','[data-path="location"]','[data-path="contact"]','[data-path="contactEmail"]','#contact-phone-group']) assert.equal(await quote(selector).isVisible(),true,selector);
    assert.equal(await quote('[data-scope-section]').isVisible(),true);
    for(const [id,direction] of [['SCOPE_FABRICATION','include'],['SCOPE_PACKAGING','include'],['SCOPE_CIVIL_WORK','exclude']]) assert.equal(await quote(`[data-scope-chip][data-scope-id="${id}"][data-scope-direction="${direction}"]`).count(),1);
    const toggle=quote('[data-action="toggle-responsibles"]');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await toggle.innerText(),'Editar');
    await toggle.click();
    assert.equal(await quote('#client-assignment-editor').isVisible(),true);
    assert.equal(await requestedField('quoteDue').isVisible(),true);
    assert.equal(await requestedField('deliveryDate').isVisible(),true);
    await toggle.click();
    assert.equal(await quote('#client-assignment-editor').isVisible(),false);
    const original=await page.evaluate(()=>{const q=window.__client.app.q;return {id:q.id,included:q.included,excluded:q.excluded,need:q.need,client:q.client.id};});
    await fillRequest('title','Solicitud nativa compartida');
    await fillRequest('location','Ubicación ficticia preservada');
    await fillRequest('contactEmail','ejemplo@example.test');
    assert.equal(await quote('[data-phone-part="country"]').inputValue(),'MX');
    assert.equal(await quote('[data-phone-part="country"] option[value="MX"]').innerText(),'México (+52)');
    assert.equal(await quote('[data-phone-part="country"] option[value]').count(),247,'245 territories plus placeholder and manual code');
    assert.equal(await quote('[data-phone-part="extension"], [data-phone-part="extensionEnabled"]').count(),0);
    await quote('[data-phone-part="country"]').selectOption('MX');
    await quote('[data-phone-part="number"]').fill('5550102030');
    await quote('.panel-actions [data-action="step"][data-step="1"]').click();
    if (await action('keep-and-leave').isVisible()) await action('keep-and-leave').click();
    await page.waitForFunction(()=>window.DemoJourney.inspect().state.screen==='quote',null,{timeout:2000});
    assert.equal((await inspect()).state.screen,'quote','Native Continue to Artículos must enter the cotizador stage');
    assert.equal(await page.locator('#quote-host').isVisible(),true);
    await stage('request');
    assert.equal(await requestedField('title').inputValue(),'Solicitud nativa compartida');
    assert.equal(await requestedField('location').inputValue(),'Ubicación ficticia preservada');
    assert.equal(await requestedField('contactEmail').inputValue(),'ejemplo@example.test');
    assert.equal(await quote('[data-phone-part="country"]').inputValue(),'MX');
    assert.equal(await quote('[data-phone-part="number"]').inputValue(),'5550102030');
    assert.deepEqual(await page.evaluate(()=>{const q=window.__client.app.q;return {id:q.id,included:q.included,excluded:q.excluded,need:q.need,client:q.client.id};}),original);
  });

  await test('Menú móvil cierra antes del guard y conserva el borrador al continuar editando',async()=>{
    await open('DEMO-101');
    await stage('quote');
    await save();
    const savedSnapshot=await page.evaluate(()=>window.DemoQuote.snapshot('DEMO-101'));
    await stage('request');
    await page.setViewportSize({width:390,height:1000});
    await fillRequest('title','Borrador sintético conservado tras cerrar el menú');
    assert.equal((await quoteSummary('DEMO-101')).dirty,true);
    const toggle=page.locator('.j-mobile-menu');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    const cotizador=page.locator('#j-sidebar [data-action="list"]');
    await cotizador.focus();await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#j-sidebar').isVisible(),false);
    const dialog=page.locator('#journey-footer .j-dialog');
    assert.equal(await dialog.isVisible(),true,'Unsaved draft must still require a decision after closing the drawer');
    assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('.j-dialog'))),true,'Decision dialog owns focus after the navigation drawer closes');
    assert.equal(await action('keep-and-leave').isVisible(),true,'Applied changes must use the unsaved-draft decision');
    await action('stay').click();
    assert.equal((await inspect()).state.screen,'request');
    assert.equal(await page.locator('#journey-footer .j-dialog').count(),0);
    assert.equal(await requestedField('title').inputValue(),'Borrador sintético conservado tras cerrar el menú');
    assert.deepEqual(await page.evaluate(()=>window.DemoQuote.snapshot('DEMO-101')),savedSnapshot,'Continuing to edit must not save or overwrite the confirmed snapshot');
    await requestedField('title').focus();
    await page.keyboard.press('End');await page.keyboard.type(' · editable');
    assert.match(await requestedField('title').inputValue(),/editable$/);
    await capture({path:path.join(artifacts,'astil-shell-after-drawer-stay-390.png'),fullPage:true});
  });

  await test('Solicitud conserva alcance opaco literal sin inferir chips',async()=>{
    await open('DEMO-101');
    const request={...(await record('DEMO-101')).request,included:'Fabricación literal de ejemplo\nEmpaque <sin interpretar IDs>',excluded:'Texto opaco: "Obra civil" se conserva literalmente.'};
    await page.evaluate(request=>{window.DemoQuote.create('DEMO-LEGACY','complete',request);window.DemoQuote.open('DEMO-LEGACY');window.DemoQuote.showStep(0);document.getElementById('quote-host').hidden=false;},request);
    assert.equal(await quote('[data-scope-chip]').count(),0);
    const texts=quote('[data-scope-section] textarea');
    assert.equal(await texts.count(),2);
    assert.equal(await texts.nth(0).inputValue(),request.included);
    assert.equal(await texts.nth(1).inputValue(),request.excluded);
    for(const textarea of await texts.all()) assert.equal(await textarea.getAttribute('readonly'),'');
    const before=await quoteSummary('DEMO-LEGACY');
    await quote('[data-scope-action="replace"]').click();
    assert.equal(await quote('[data-scope-action="confirm-replace"]').isVisible(),true);
    await quote('[data-scope-action="cancel-replace"]').click();
    assert.equal(await texts.nth(0).inputValue(),request.included);
    assert.equal(await texts.nth(1).inputValue(),request.excluded);
    assert.equal(await quote('[data-scope-chip]').count(),0);
    assert.equal((await quoteSummary('DEMO-LEGACY')).costCents,before.costCents);
    assert.equal((await quoteSummary('DEMO-LEGACY')).totalCents,before.totalCents);
  });
  await test('Mesa y Flujo comparten expedientes, búsqueda y filtros', async () => {
    const records = (await inspect()).records;
    assert.deepEqual(records.map(value => value.id).sort(), [...seedIds].sort());
    for (const value of records) assert.equal(await page.locator(`[data-record-id="${value.id}"]`).count(), 1);
    await page.locator('#j-search').fill(records[0].request.title);
    assert.equal(await page.locator('[data-record-id="DEMO-101"]').count(), 1);
    assert.equal(await page.locator('[data-record-id="DEMO-102"]').count(), 0);
    await action('view', '[data-view="flujo"]').click();
    assert.equal(await page.locator('#j-search').inputValue(), records[0].request.title);
    assert.equal(await action('quote-detail', '[data-id="DEMO-101"]').count(), 1);
    assert.equal(await action('quote-detail', '[data-id="DEMO-102"]').count(), 0);
    await page.locator('#j-search').fill('NO-EXISTE-SINTETICO-928');
    assert.equal(await action('quote-detail').count(), 0);
    await page.locator('#j-search').fill('');
    await page.locator('#j-status-filter').selectOption('project');
    assert.equal(await action('quote-detail').count(), seedProjectIds.length);
    for (const id of seedProjectIds) assert.equal(await action('quote-detail', `[data-id="${id}"]`).count(), 1);
    await page.locator('#j-status-filter').selectOption('all');
    assert.equal(await action('quote-detail').count(), seedIds.length);
  });

  await test('Guardar distingue fallo, resultado desconocido y confirmación', async () => {
    await open('DEMO-101');
    await fillRequest('title','Solicitud sintética modificada');
    await stage('quote');
    await save('fail');
    assert.match(await page.locator('#j-feedback').innerText(), /fall|rechaz|no se guard|no se confirm/i);
    assert.equal((await quoteSummary('DEMO-101')).saveState, 'failed');
    assert.equal((await record('DEMO-101')).review, null);
    await save('unknown');
    assert.match(await page.locator('#j-feedback').innerText(), /desconoc|sin confirm|pendiente/i);
    assert.equal((await quoteSummary('DEMO-101')).saveState, 'unknown');
    assert.equal(await page.locator('#quote-host').evaluate(element => element.inert), true);
    assert.equal(await stageControl('review').isEnabled(), false);
    await action('resolve-save').click();
    assert.match(await page.locator('#j-feedback').innerText(), /confirm|guardad/i);
    await stage('review');
    assert.equal(await page.locator('#j-review-technical').isEnabled(), true);
  });

  await test('Recorrido completo conserva snapshot y convierte una sola vez', async () => {
    await open('DEMO-101');
    await quote('#j-commercial-type').selectOption('line');
    await fillRequest('title','Mostrador modular inventado');
    await fillRequest('quoteDue','2026-11-03');
    assert.equal(await quote('#j-commercial-type').inputValue(),'line');
    await stage('quote');
    await save();
    assert.match(await page.locator('#j-feedback').innerText(), /guardado durante esta sesión/i);
    await stage('review');
    await capture({path:path.join(artifacts,'review-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:1000});
    await capture({path:path.join(artifacts,'review-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await approveAndSend();
    const sent = await record('DEMO-101');
    assert.equal(sent.versions.length, 1);
    assert.equal(sent.versions[0].commercialType,'line');
    const frozen = structuredClone(sent.versions[0].snapshot);
    const offer = await page.locator('#j-commercial-offer').innerText();
    assert.doesNotMatch(offer, /costo|margen|utilidad|indirecto|merma/i);
    assert.match(offer, /Mostrador modular inventado/);
    const offerLogo=page.locator('#j-commercial-offer svg.j-sidebar-logo');
    assert.equal(await offerLogo.getAttribute('viewBox'),'0 0 272 100');
    assert.deepEqual(await offerLogo.locator('path').evaluateAll(paths=>paths.map(path=>path.getAttribute('d'))),await page.locator('#j-sidebar svg.j-sidebar-logo path').evaluateAll(paths=>paths.map(path=>path.getAttribute('d'))),'Commercial offer must reuse the established Astil wordmark');
    assert.deepEqual(await offerLogo.locator('path').evaluateAll(paths=>paths.map(path=>path.getAttribute('transform'))),await page.locator('#j-sidebar svg.j-sidebar-logo path').evaluateAll(paths=>paths.map(path=>path.getAttribute('transform'))),'Commercial offer must retain the corrected lowercase s');
    await capture({path:path.join(artifacts,'offer-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Commercial offer must fit the mobile shell');
    await capture({path:path.join(artifacts,'offer-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await respond('accepted', 'Correo ficticio: versión aceptada para este ejercicio.', sent.version);
    await stage('project');
    await action('convert').dblclick();
    const converted = await record('DEMO-101');
    assert.ok(converted.project, 'Project must be created');
    assert.equal(converted.project.baseline.summary.totalCents, 696000);
    assert.equal(converted.project.baseline.summary.costCents, 279741);
    assert.equal(converted.project.baseline.request.quoteDue, '2026-11-03');
    const projectId = converted.project.id;
    if (await action('convert').count() && await action('convert').isEnabled()) await action('convert').click();
    assert.equal((await record('DEMO-101')).project.id, projectId);
    assert.deepEqual((await record('DEMO-101')).versions[0].snapshot, frozen);
    await capture({ path: path.join(artifacts, 'project-desktop.png'), fullPage: true });
    await page.setViewportSize({width:390,height:1000});
    await capture({path:path.join(artifacts,'project-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
  });

  await test('Aceptación requiere evidencia y referencia a la versión enviada', async () => {
    await open('DEMO-101');
    await stage('quote');
    await save();
    await approveAndSend();
    await respond('accepted', '', undefined);
    assert.equal((await record('DEMO-101')).sent.response, null);
    assert.match(await page.locator('#j-feedback').innerText(), /evidencia|versión|confirm/i);
    await page.locator('#j-evidence').fill('Evidencia inventada sin confirmar versión.');
    await action('register-response').click();
    assert.equal((await record('DEMO-101')).sent.response, null);
    await exactVersion((await record('DEMO-101')).version);
    await action('register-response').click();
    await stage('project');
    assert.equal(await action('convert').isEnabled(), true);
  });

  await test('Solicitar cambios genera otra versión y preserva la anterior', async () => {
    await open('DEMO-101');
    await stage('quote');
    await save();
    await approveAndSend();
    const before = await record('DEMO-101');
    await respond('changes', 'Solicita ampliar alcance: mensaje ficticio.', before.version);
    const afterResponse = structuredClone((await record('DEMO-101')).versions[0]);
    assert.equal((await record('DEMO-101')).version, before.version + 1);
    await stage('request');
    await fillRequest('title','Alcance ampliado en una nueva versión');
    await stage('quote');
    await save();
    await stage('review');
    assert.equal(await page.locator('#j-review-technical').isChecked(), false);
    assert.equal(await page.locator('#j-review-commercial').isChecked(), false);
    await approveAndSend();
    const after = await record('DEMO-101');
    assert.equal(after.versions.length, 2);
    assert.deepEqual(after.versions[0], afterResponse);
    assert.equal(after.versions[1].version, before.version + 1);
  });

  await test('Rechazo conserva la versión enviada e impide convertirla', async () => {
    await open('DEMO-101');
    await stage('quote');
    await save();
    await approveAndSend();
    const sent = await record('DEMO-101');
    await respond('rejected', 'El contacto ficticio rechaza esta versión para el ejercicio.', sent.version);
    const rejected = await record('DEMO-101');
    assert.equal(rejected.sent.response.result, 'rejected');
    assert.equal(rejected.sent.response.version, sent.version);
    assert.equal(rejected.project, null);
    assert.equal(await stageControl('project').isEnabled(), false);
    assert.deepEqual(rejected.versions[0].snapshot, sent.versions[0].snapshot);
  });

  await test('Fechas editadas son coherentes y el cambio de entrega conserva la revisión de alcance', async () => {
    await open('DEMO-101');
    await fillRequest('quoteDue','2026-11-03');
    await fillRequest('deliveryDate','2026-12-09');
    await stage('quote');
    await save();
    const changed = await record('DEMO-101');
    assert.equal(changed.request.quoteDue, '2026-11-03');
    assert.equal(changed.request.deliveryDate, '2026-12-09');
    assert.equal(await page.evaluate(() => window.__client.app.q.deliveryDate), '2026-12-09');
    assert.equal(await stageControl('review').isEnabled(), false, 'Delivery is part of canonical scope; stale coverage approvals must remain invalid');
    assert.ok((await quoteSummary('DEMO-101')).workflowIssues.some(issue =>
      issue.code === 'SCOPE_IMPACT' || (issue.code === 'NEED_UNRESOLVED' && issue.target.field === 'confirm')),
      'Changed delivery must identify the affected scope decision');
    await list();
    const mesa = await page.locator('[data-record-id="DEMO-101"]').innerText();
    assert.match(mesa, /3 nov 2026/);
    assert.match(mesa, /9 dic 2026/);
    await action('view', '[data-view="flujo"]').click();
    const flow = await page.locator('[data-record-id="DEMO-101"]').innerText();
    assert.match(flow, /3 nov 2026/);
    assert.match(flow, /9 dic 2026/);
  });

  await test('Texto de solicitud se presenta literalmente sin ejecutar HTML', async () => {
    await open('DEMO-101');
    const payload = '<img src=x onerror="window.__xssRan=1">';
    await fillRequest('title',payload);
    await fillRequest('contact','<svg onload="window.__xssRan=2">');
    await stage('quote');
    await save();
    await stage('request');
    assert.equal(await requestedField('title').inputValue(), payload);
    assert.equal(await page.evaluate(() => window.__xssRan || 0), 0);
    assert.equal(await page.locator('img[src="x"], svg[onload]').count(), 0);
  });

  await test('Cálculos canónicos conservan importes exactos y evitan doble conteo', async () => {
    await open('DEMO-101');
    await stage('quote');
    const initial = await quoteSummary('DEMO-101');
    assert.equal(initial.complete, true, JSON.stringify(initial.blockers));
    // Independent fixture: 2 × $1000 + $500 provider + round($50/1.16)
    // packaging net + 10% of the $2543.10 base; all amounts are cents.
    assert.equal(initial.costCents, 279741);
    assert.equal(initial.priceCents, 600000);
    assert.equal(initial.taxCents, 96000);
    assert.equal(initial.totalCents, 696000);
    const article = await openFirstArticle();
    const quantity = article.locator('.part-header-quantity input');
    assert.equal(await quantity.inputValue(), '2');
    await article.getByRole('button', { name: /^Aumentar cantidad de / }).click();
    assert.equal(await quantity.inputValue(), '3');
    const applied = await quoteSummary('DEMO-101');
    assert.equal(applied.hasPending, false);
    assert.equal(applied.priceCents, 900000);
    assert.equal(applied.taxCents, 144000);
    assert.equal(applied.totalCents, 1044000);
    assert.equal(applied.costCents, 279741, 'Declared total purchases and provider total must not be multiplied again');
    assert.equal(applied.savedRevision, 0, 'The header retains the capture without saving a snapshot');
    assert.equal(await page.evaluate(() => window.DemoQuote.snapshot('DEMO-101')), null);
    await save();
    assert.equal((await quoteSummary('DEMO-101')).saveState, 'success');
    assert.equal(await page.evaluate(() => window.DemoQuote.snapshot('DEMO-101').summary.totalCents), 1044000);
    await list();
    assert.match(await page.locator('[data-record-id="DEMO-101"]').innerText(), /10,440\.00/);
    await action('view', '[data-view="flujo"]').click();
    assert.match(await page.locator('[data-record-id="DEMO-101"]').innerText(), /10,440\.00/);
  });

  await test('Captura automática, corrección y cambio de expediente mantienen buffers aislados', async () => {
    await open('DEMO-101');
    await stage('quote');
    const article = await openFirstArticle('general');
    const quantity = article.locator('.part-header-quantity input');
    const description = article.getByRole('textbox', { name: 'Nombre del artículo', exact: true });
    const originalName = await description.inputValue();
    const originalQuantity = await quantity.inputValue();
    const originalPrice = (await quoteSummary('DEMO-101')).priceCents;
    const editedName = 'Artículo aplicado de prueba';
    const invalidQuantity = '100001';
    const back = page.locator('#journey-footer').getByRole('button', { name: 'Volver a cotizaciones', exact: true });

    await quantity.fill('1.2345');
    assert.equal(await quantity.inputValue(), originalQuantity, 'The piece quantity field rejects fractional input');
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false);
    // Whole numbers can be typed beyond the limit and must stay pending until corrected.
    await quantity.fill(invalidQuantity);
    assert.equal(await quantity.getAttribute('aria-invalid'), 'true');
    const pending = await quoteSummary('DEMO-101');
    assert.equal(pending.hasPending, true);
    assert.equal(pending.priceCents, originalPrice, 'An invalid quantity cannot change the applied price');
    await article.getByRole('button', { name: 'Descartar captura pendiente', exact: true }).click();
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false);
    assert.equal(await quantity.inputValue(), originalQuantity);
    assert.equal(await description.inputValue(), originalName);

    await description.fill(editedName);
    await stage('request');
    assert.equal((await inspect()).state.screen, 'request');
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false, 'Valid capture is retained automatically before navigation');
    assert.equal(await action('apply-and-leave').count(), 0);
    await stage('quote');
    await openFirstArticle('general');
    assert.equal(await description.inputValue(), editedName);
    await quantity.fill(invalidQuantity);
    await back.click();
    assert.equal(await action('discard-and-leave').isVisible(), true, 'Invalid numeric input requires correction or explicit discard');
    assert.equal((await inspect()).state.screen, 'quote');
    assert.equal(await action('apply-and-leave').count(), 0);
    await page.setViewportSize({ width: 390, height: 900 });
    const dialog = page.getByRole('alertdialog', { name: 'Hay datos por corregir' });
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 901, 'Pending-capture dialog must remain inside the mobile viewport');
    const dialogButtons = dialog.locator('button:not(:disabled)');
    await dialogButtons.last().focus();
    await page.keyboard.press('Tab');
    assert.equal(await dialogButtons.first().evaluate(element => element === document.activeElement), true, 'Keyboard focus stays inside the active decision dialog');
    await capture({ path: path.join(artifacts, 'pending-dialog-mobile.png'), fullPage: true });
    await action('stay').click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal((await quoteSummary('DEMO-101')).hasPending, true);
    assert.equal(await quantity.inputValue(), invalidQuantity, 'Continuing to edit retains the value that needs correction');
    await quantity.fill(originalQuantity);
    await back.click();
    assert.equal(await action('keep-and-leave').isVisible(), true, 'A corrected draft can be retained without saving');
    assert.equal(await action('apply-and-leave').count(), 0);
    await action('keep-and-leave').click();
    assert.equal((await inspect()).state.screen, 'list');
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false);
    assert.equal(await page.evaluate(() => window.DemoQuote.snapshot('DEMO-101')), null);
    await open('DEMO-102');
    await stage('quote');
    await openFirstArticle('general');
    assert.equal(await description.inputValue(), 'Objeto de muestra con madera pendiente');
    await list();
    await open('DEMO-101');
    await stage('quote');
    await openFirstArticle('general');
    assert.equal(await description.inputValue(), editedName);
    assert.equal(await quantity.inputValue(), originalQuantity);
    assert.equal((await quoteSummary('DEMO-101')).dirty, true, 'Automatic local capture is not a confirmed quote snapshot');
    await save();
    assert.equal(await page.evaluate(() => window.DemoQuote.snapshot('DEMO-101')?.quote.items[0].description), editedName);
  });

  await test('Madera maciza confirma o descarta la pieza y mantiene el costo de CNC pendiente', async () => {
    await open('DEMO-102');
    await stage('quote');
    const before = await quoteSummary('DEMO-102');
    assert.equal(before.complete, false);
    assert.match(before.saveBlockers.join(' '), /captura de madera.*guardar/i);
    await save();
    assert.notEqual((await quoteSummary('DEMO-102')).saveState, 'success');
    const article = await openFirstArticle('wood');
    const wood = article.locator('[data-article-fold="wood"]');
    await openDetails(wood.locator('[data-fab-panel="workshop-dimensions"]'));
    const table = wood.getByRole('region', { name: 'Tabla de piezas de madera' });
    const piece = table.locator('article[data-record-kind="wood"]');
    const edit = piece.getByRole('button', { name: 'Editar Pieza inventada', exact: true });
    const editor = piece.locator('[data-row-editor]');
    const decision = editor.locator('[data-solid-field="cnc.decision"]');
    const width = editor.locator('[data-solid-field="width"]');
    const confirm = editor.getByRole('button', { name: 'Confirmar cambios', exact: true });
    const discard = editor.getByRole('button', { name: 'Descartar', exact: true });
    const consumables = wood.locator('[data-fab-panel="workshop-other"]');
    await openDetails(consumables);
    const cncLength = consumables.locator('[data-workshop-live="cnc-length"]');
    const cncAmount = consumables.locator('[data-workshop-live="cnc-amount"] strong');
    assert.equal(await cncLength.innerText(), 'Pendiente');
    assert.equal(await cncAmount.innerText(), 'Pendiente');
    assert.equal(await consumables.locator('[data-workshop-field="other.cnc.price"]').inputValue(), '');
    assert.ok(await edit.evaluate(button => {
      const actions = button.closest('.rv-row-actions');
      if (!actions) return false;
      const row = button.closest('article').getBoundingClientRect(), bounds = actions.getBoundingClientRect();
      return getComputedStyle(actions).position !== 'fixed' && bounds.left >= row.left - 1 && bounds.right <= row.right + 1 &&
        bounds.top >= row.top - 1 && bounds.bottom <= row.bottom + 1;
    }), 'The edit controls stay inside their own piece row');

    await edit.click();
    assert.equal(await editor.locator('[data-solid-field="woodKind"]').inputValue(), 'Pino');
    assert.equal(await width.inputValue(), '36');
    assert.equal(await decision.inputValue(), 'yes');
    assert.equal(await editor.locator('[data-solid-field="cnc.length"], [data-solid-field="cnc.repetitions"], [data-solid-action="apply-cnc"]').count(), 0);
    await width.fill('40');
    await decision.selectOption('no');
    assert.equal(await cncLength.innerText(), '0 m', 'The local preview reflects the explicit choice No');
    assert.equal(await cncAmount.innerText(), 'Pendiente', 'A zero cutting length does not confirm a zero cost');
    assert.equal((await quoteSummary('DEMO-102')).hasPending, true, 'A wood choice requires piece confirmation');

    await page.setViewportSize({ width: 390, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Wood editor must fit mobile width');
    for (const control of [confirm, discard]) {
      await control.scrollIntoViewIfNeeded();
      assert.ok(await control.evaluate(button => {
        const scroller = button.closest('.rv-table-scroll').getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        const label = document.createRange();
        label.selectNodeContents(button);
        return bounds.left >= scroller.left - 1 && bounds.right <= scroller.right + 1 && label.getClientRects().length === 1;
      }), 'Each wood action is reachable and fits on a single line in the mobile table');
    }
    await capture({ path: path.join(artifacts, 'wood-editor-mobile.png'), fullPage: true });
    await discard.click();
    assert.equal(await piece.locator('[data-row-field="width"]').inputValue(), '36');
    assert.equal(await cncLength.innerText(), 'Pendiente', 'Discard restores the earlier CNC decision and missing cutting data');
    assert.equal((await quoteSummary('DEMO-102')).hasPending, false);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await edit.click();
    assert.equal(await decision.inputValue(), 'yes');
    await width.fill('40');
    await decision.selectOption('no');
    await confirm.click();
    assert.equal(await piece.locator('[data-row-field="width"]').inputValue(), '40');
    assert.equal(await piece.locator('[data-row-field="cnc.decision"]').inputValue(), 'No');
    assert.equal(await cncLength.innerText(), '0 m', 'Confirm retains the choice after closing the piece editor');
    await edit.click();
    await decision.selectOption('yes');
    await confirm.click();
    assert.equal(await piece.locator('[data-row-field="cnc.decision"]').inputValue(), 'Sí');
    assert.equal(await cncLength.innerText(), 'Pendiente');
    assert.equal(await cncAmount.innerText(), 'Pendiente');

    const after = await quoteSummary('DEMO-102');
    assert.equal(after.hasPending, false);
    assert.equal(after.complete, false);
    assert.equal(after.costCents, before.costCents, 'CNC without tariff must not change confirmed cost');
    await save();
    assert.notEqual((await quoteSummary('DEMO-102')).saveState, 'success');
    assert.equal(await page.evaluate(() => window.DemoQuote.snapshot('DEMO-102')), null);
    assert.equal(await stageControl('review').isEnabled(), false);
    await capture({ path: path.join(artifacts, 'wood-pending.png'), fullPage: true });
  });

  await test('Reiniciar y recargar restauran los escenarios inventados', async () => {
    const original = await record('DEMO-101');
    await open('DEMO-101');
    await fillRequest('title','Cambio descartable al reiniciar');
    await stage('quote');
    await save();
    await action('reset').click();
    await action('confirm-reset').click();
    await waitForDemoReady();
    assert.equal((await record('DEMO-101')).request.title, original.request.title);
    await open('DEMO-101');
    await fillRequest('title','Otro cambio descartable al recargar');
    await stage('quote');
    await save();
    await collectWrites();
    await page.reload();
    await waitForDemoReady();
    assert.equal((await record('DEMO-101')).request.title, original.request.title);
    assert.equal((await record('DEMO-101')).project, null);
  });

  await test('Las pestañas del cotizador quedan estables al navegar', async () => {
    await open('DEMO-101');
    const navigation=quote('.steps');
    const tab=index=>navigation.locator(`button[data-step="${index}"]`);
    const measure=()=>navigation.evaluate(element=>{
      const position=target=>{
        const {x,y,width,height}=target.getBoundingClientRect();
        return [x,y,width,height].map(Math.round);
      };
      return {
        document:[scrollX,scrollY],
        maxScroll:Math.max(0,document.scrollingElement.scrollHeight-innerHeight),
        menu:position(element),
        tabs:[...element.children].map(position)
      };
    });
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:720});
      assert.deepEqual(await navigation.locator('button').allTextContents(),['Cliente','Artículos','Costos generales','Precio','Revisión']);
      assert.equal(await page.locator('#j-main .j-stages').count(),0);
      let preservedScroll=false;
      for (const index of [1,2,3,4,0]) {
        await page.evaluate(()=>scrollTo(0,40));
        const before=await measure();
        await tab(index).click();
        assert.equal(await tab(index).getAttribute('aria-current'),'step');
        assert.equal(await tab(index).evaluate(element=>element===document.activeElement),true);
        const after=await measure();
        const targetScroll=Math.min(before.document[1],after.maxScroll);
        assert.deepEqual(after.document,[0,targetScroll],`Page scroll moves to step ${index} at ${width}px`);
        const aligned=([x,y,w,h])=>[x,y+before.document[1]-targetScroll,w,h];
        assert.deepEqual(after.menu,aligned(before.menu),`Menu moves to step ${index} at ${width}px`);
        assert.deepEqual(after.tabs,before.tabs.map(aligned),`Tabs move to step ${index} at ${width}px`);
        preservedScroll ||= targetScroll>0 && targetScroll===before.document[1];
      }
      assert.ok(preservedScroll,`Exercise a transition with a nonzero scroll position at ${width}px`);
      const origin=await measure();
      const field=await quote('[data-path="need"]').elementHandle();
      await tab(0).press('Enter');
      assert.ok(await field.evaluate(element=>element.isConnected),'Reactivating the current tab preserves the form');
      assert.deepEqual(await measure(),origin);
    }
    await page.setViewportSize({width:1440,height:1000});
  });

  await test('Agregar producto integra ambos caminos al diseño de líneas limpias',async()=>{
    await open('DEMO-101');
    await stage('quote');
    await quote('[data-action="line-add"]').click();
    const selector=quote('#product-path-selector');
    const paths=selector.locator('.product-path');
    assert.deepEqual(await paths.locator('strong').allTextContents(),['Producto de línea','Producto nuevo']);
    assert.equal(await paths.first().evaluate(el=>getComputedStyle(el).borderRadius),'8px');
    await captureFamily(selector,'agregar-producto.png');
    await paths.first().press('Enter');
    assert.equal(await quote('#line-catalog-panel').isVisible(),true);
    await quote('[data-action="line-cancel"]').click();
    await paths.last().press('Enter');
    assert.equal(await quote('.part-accordion').count(),2);
  });

  await test('Catálogo con lista y ficha lateral conserva filtros, foco y variante explícita',async()=>{
    await action('new-request').click();
    await quote('.steps [data-step="1"]').click();
    await quote('[data-action="line-open"]').click();
    const catalog=quote('.recipe-catalog');
    const rows=catalog.locator('.recipe-catalog-row');
    const detail=catalog.locator('.recipe-catalog-card');
    const use=detail.locator('[data-action="line-use"]');
    const bolonia=catalogRow('SYN-BOLONIA');
    assert.equal(await rows.count(),12);
    const familyVariants={Mesas:18,Cubiertas:36,Pedestales:8,Asientos:73};
    let variants=0;
    for (const [family,expected] of Object.entries(familyVariants)) {
      await catalog.locator('#line-family').selectOption(family);
      let count=0;
      for (const row of await rows.all()) {
        await row.click();
        count+=await detail.locator('select option:not([value=""])').count();
      }
      assert.equal(count,expected,`Variantes de ${family}`);
      variants+=count;
    }
    assert.equal(variants,135);
    await catalog.locator('#line-family').selectOption('');
    const desktopRow=await rows.first().elementHandle();
    await bolonia.press('Enter');
    assert.ok(await desktopRow.evaluate(el=>el.isConnected),'Selecting a product keeps the list in place');
    assert.equal(await bolonia.getAttribute('aria-pressed'),'true');
    assert.equal(await bolonia.evaluate(el=>el===document.activeElement),true);
    assert.equal(await detail.getAttribute('data-line-product'),'SYN-BOLONIA');
    assert.equal(await detail.locator('select').inputValue(),'');
    assert.equal(await use.isEnabled(),false);
    await detail.locator('select').selectOption('SYN-BOLONIA-R');
    assert.equal(await use.isEnabled(),true);
    assert.equal(await quote('.part-accordion').count(),0,'Browsing the catalog must leave the quotation intact');
    await detail.locator('[data-action="line-details-toggle"]').click();
    assert.match(await detail.locator('.line-product-detail').innerText(),/Medidas terminadas/);
    await detail.locator('[data-action="line-details-toggle"]').click();
    const layout=()=>catalog.evaluate(el=>{
      const results=el.querySelector('.recipe-catalog-products').getBoundingClientRect();
      const product=el.querySelector('.recipe-catalog-card').getBoundingClientRect();
      return {
        beside:results.right<product.left&&Math.abs(results.top-product.top)<1,
        stacked:results.bottom<product.top,
        fits:document.documentElement.scrollWidth<=innerWidth+1
      };
    });
    assert.deepEqual(await layout(),{beside:true,stacked:false,fits:true});
    const controls=await detail.locator('.line-card-actions').evaluate(el=>{
      const variant=el.querySelector('select').getBoundingClientRect();
      const use=el.querySelector('[data-action="line-use"]').getBoundingClientRect();
      return { sideBySide:use.left>variant.right, aligned:Math.abs(use.bottom-variant.bottom)<2 };
    });
    assert.deepEqual(controls,{sideBySide:true,aligned:true});
    await catalog.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    await captureFamily(catalog,'catalogo-lista-ficha-escritorio.png');
    await page.setViewportSize({width:1000,height:850});
    assert.deepEqual(await layout(),{beside:true,stacked:false,fits:true});
    await page.setViewportSize({width:390,height:850});
    assert.deepEqual(await layout(),{beside:false,stacked:true,fits:true});
    await bolonia.press('Enter');
    assert.equal(await detail.locator('h4').evaluate(el=>el===document.activeElement),true);
    assert.equal(await detail.locator('select').inputValue(),'SYN-BOLONIA-R','Revisiting the active row keeps its variant');
    await captureFamily(catalog,'catalogo-lista-ficha-movil.png');
    await detail.locator('[data-action="line-back-results"]').press('Enter');
    assert.equal(await bolonia.evaluate(el=>el===document.activeElement),true);
    const search=catalog.locator('#line-search');
    await search.fill('FLORÉNCIA');
    assert.equal(await rows.count(),1);
    assert.equal(await detail.getAttribute('data-line-product'),'SYN-NUBE');
    assert.equal(await use.isEnabled(),false);
    await search.fill('sin coincidencias 199');
    assert.match(await catalog.locator('[role="status"]').innerText(),/Sin coincidencias/);
    assert.equal(await detail.count(),0);
    await search.clear();
    await catalog.locator('#line-family').selectOption('Cubiertas');
    assert.equal(await rows.count(),2);
    assert.equal(await detail.getAttribute('data-line-product'),'SYN-PRISMA');
    assert.equal(await use.isEnabled(),false);
    await search.press('Escape');
    assert.equal(await catalog.count(),0);
    assert.equal(await quote('[data-action="line-open"]').evaluate(el=>el===document.activeElement),true);
    await page.setViewportSize({width:1440,height:1000});
  });

  await test('Mesa, Flujo y cotizador se usan en móvil y por teclado', async () => {
    for (const width of [390, 538, 768, 783, 1100, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await action('view', '[data-view="mesa"]').click();
      const flow = action('view', '[data-view="flujo"]');
      await flow.focus();
      await page.keyboard.press('Enter');
      assert.equal(await action('quote-detail').count(), seedIds.length);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Overflow in board at ${width}px`);
      await open('DEMO-101');
      await stage('quote');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Overflow in quote at ${width}px`);
      assert.equal(await page.locator('#j-main .j-save-strip').count(),0,'Quote does not render the duplicate action strip');
      assert.equal(await page.locator('#j-main .j-stages').count(),0,'Quote has no duplicate commercial stage bar');
      assert.equal(await quote('.editor-context').count(),0,'The editor does not repeat the record heading');
      for (const navigation of ['#quote-host .steps']) {
        const bounds = await page.locator(navigation).evaluate(element=>({
          rect:element.getBoundingClientRect().toJSON(),
          buttons:[...element.querySelectorAll('button')].map(button=>button.getBoundingClientRect().toJSON())
        }));
        assert.ok(bounds.rect.width<=width,`Navigation remains within the viewport at ${width}px`);
        for (const [i,button] of bounds.buttons.entries()) {
          assert.ok(button.left>=bounds.rect.left-1&&button.right<=bounds.rect.right+1,`Tab is fully visible at ${width}px`);
          const previous=bounds.buttons[i-1];
          if(previous)assert.ok(button.left>=previous.right-1||button.top>=previous.bottom-1,`Tab targets do not overlap at ${width}px`);
        }
      }
      if(width<=1150) {
        const sizes=await quote('.shell').evaluate(element=>({shell:element.clientWidth,form:element.querySelector('.mainform').clientWidth}));
        assert.ok(sizes.form>=sizes.shell-1,`Form uses the available width rather than an empty second column at ${width}px`);
      }
      // Compare the same resting state after layout changes move buttons under the pointer.
      await page.mouse.move(0,0);
      const buttonStyles=await quote('.panel-actions [data-action="save"]').evaluate(button=>{
        const embedded=getComputedStyle(button),footer=getComputedStyle(document.querySelector('#journey-footer [data-action="list"]'));
        return ['borderRadius','fontFamily','fontSize','padding','backgroundColor','borderColor'].map(key=>[key,embedded[key],footer[key]]);
      });
      for(const [key,embedded,footer] of buttonStyles)assert.equal(embedded,footer,`Astil ${key} matches in editor and footer at ${width}px`);
      await capture({ path: path.join(artifacts, `quote-${width}.png`), fullPage: true });
      for (const next of [2,3,4]) await quote(`.panel-actions [data-action="step"][data-step="${next}"]`).click();
      const activeStep=await quote('.steps').evaluate(navigation=>({
        viewport:navigation.getBoundingClientRect().toJSON(),active:navigation.querySelector('.current').getBoundingClientRect().toJSON()
      }));
      assert.ok(activeStep.active.left>=activeStep.viewport.left-1&&activeStep.active.right<=activeStep.viewport.right+1,`Next keeps the active step visible at ${width}px`);
      await fresh();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await test('Referencias anteriores abren el archivo local correcto sin perder la simulación', async () => {
    await open('DEMO-101');
    await fillRequest('title','Sesión sintética conservada al consultar referencias');
    await stage('quote');
    await save();
    const before = await inspect();
    for (const relative of ['cotizador-clasico/index.html', 'fabricacion/index.html']) {
      const link = page.locator(`#journey-footer a[href="${relative}"]`);
      assert.match(await link.innerText(), /versión anterior/i);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.ok((await link.getAttribute('rel') || '').split(/\s+/).includes('noopener'));
      const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
      await popup.waitForLoadState('domcontentloaded');
      assert.equal(popup.url(), pathToFileURL(path.join(root, relative)).href);
      assert.equal(await popup.evaluate(() => window.opener === null), true);
      const banner = popup.locator('.public-demo-banner');
      assert.equal(await banner.isVisible(), true);
      assert.match(await banner.innerText(), /DEMO pública.*Datos ficticios/i);
      await popup.screenshot({ path: path.join(artifacts, relative.startsWith('fabricacion') ? 'reference-fabricacion.png' : 'reference-clasico.png'), fullPage: true });
      await popup.close();
      assert.deepEqual(await inspect(), before, 'Consulting an archived reference must preserve the current simulation');
    }
  });
} finally {
  await collectWrites().catch(() => {});
  await browser.close();
}
for (const [name, entries] of [['Sin solicitudes externas', externalRequests], ['Sin almacenamiento persistente', persistentWrites], ['Sin errores de consola o navegador', browserErrors]]) {
  const ok = entries.length === 0;
  results.push({ name, ok, ...(ok ? {} : { error: JSON.stringify(entries) }) });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`);
}
const failed = results.filter(result => !result.ok);
const report = { environment: 'Chromium headless, file://, synthetic fixtures, no server', browserChannel: process.env.DEMO_BROWSER_CHANNEL || 'bundled-chromium', sourceHash, ...(process.env.DEMO_TEST_FILTER ? {filter:process.env.DEMO_TEST_FILTER} : {}), passed: results.length - failed.length, failed: failed.length, externalRequests: externalRequests.length, persistentWrites: persistentWrites.length, browserErrors: browserErrors.length, results };
await fs.writeFile(path.join(artifacts, 'acceptance-report.json'), JSON.stringify(report, null, 2) + '\n');
await fs.writeFile(path.join(artifacts, `acceptance-${process.env.DEMO_CAPTURE_PHASE || 'after'}-${sourceHash.slice(0,12)}-${process.env.DEMO_TEST_FILTER ? 'focused' : 'full'}.json`), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (failed.length) process.exitCode = 1;
