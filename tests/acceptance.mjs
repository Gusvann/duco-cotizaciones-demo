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
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
page.on('dialog', dialog => dialog.accept());
const action = (name, suffix = '') => page.locator(`#journey-root [data-action="${name}"]${suffix}, #journey-footer [data-action="${name}"]${suffix}`);
const requestedField = key => quote(`[data-path="${({title:'name'})[key] || key}"]`);
async function fillRequest(key, value) {
  if (['quoteDue','deliveryDate'].includes(key) && !await requestedField(key).isVisible()) await quote('[data-action="toggle-responsibles"]').click();
  await requestedField(key).fill(value);
}
const stageControl = name => action('stage', `[data-screen="${name}"]`).first();
async function stage(name) {
  // Inside the editor, Cliente is the remaining route to Solicitud; there is
  // deliberately no second commercial stage bar above the section tabs.
  if(name==='request'&&!await stageControl(name).count())await quote('.steps [data-action="step"][data-step="0"]').click();
  else await stageControl(name).click();
  if (await action('keep-and-leave').isVisible()) await action('keep-and-leave').click();
}
async function list() {
  await action('list').filter({visible:true}).first().click();
  if (await action('keep-and-leave').isVisible()) await action('keep-and-leave').click();
}
const inspect = () => page.evaluate(() => window.DemoJourney.inspect());
const quoteSummary = id => page.evaluate(id => window.DemoQuote.summary(id), id);
const quote = selector => page.locator('#quote-host').locator(selector);
async function article(section = 'general') {
  await quote('[data-action="step"][data-step="1"]').first().click();
  const trigger = quote('[data-action="toggle-part"]').first();
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await quote(`[data-article-section="${section}"]`).click();
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
const open = id => action('open', `[data-id="${id}"]`).first().click();
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
    const navSummary=page.locator('#j-sidebar .j-nav-group > summary');
    const navCotizador=page.locator('#j-sidebar [data-action="list"]');
    const navKpis=page.locator('#j-sidebar [data-action="kpis"]');
    assert.equal(await navSummary.evaluate(element=>element===document.activeElement),true);
    await page.keyboard.press('Tab');
    assert.equal(await navKpis.evaluate(element=>element===document.activeElement),true,'KPIs precedes Cotizador within Portafolio');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await navSummary.evaluate(element=>element===document.activeElement),true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await navCotizador.evaluate(element=>element===document.activeElement),true,'Backward focus wraps to Cotizador, the last entry within the open navigation');
    await page.keyboard.press('Tab');
    assert.equal(await navSummary.evaluate(element=>element===document.activeElement),true,'Forward focus wraps within the open navigation');
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

  await test('Solicitud usa el formulario nativo D85 sin captura duplicada', async () => {
    await open('DEMO-101');
    const phase = process.env.DEMO_CAPTURE_PHASE || 'after';
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
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
    assert.equal(await action('open', '[data-id="DEMO-101"]').count(), 1);
    assert.equal(await action('open', '[data-id="DEMO-102"]').count(), 0);
    await page.locator('#j-search').fill('NO-EXISTE-SINTETICO-928');
    assert.equal(await action('open').count(), 0);
    await page.locator('#j-search').fill('');
    await page.locator('#j-status-filter').selectOption('project');
    assert.equal(await action('open').count(), seedProjectIds.length);
    for (const id of seedProjectIds) assert.equal(await action('open', `[data-id="${id}"]`).count(), 1);
    await page.locator('#j-status-filter').selectOption('all');
    assert.equal(await action('open').count(), seedIds.length);
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
    await fillRequest('title','Mostrador modular inventado');
    await fillRequest('quoteDue','2026-11-03');
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
    assert.match((await quoteSummary('DEMO-101')).blockers.join(' '), /confirma la cobertura/i);
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
    await article();
    await quote('[data-path="items.0.quantity"]').fill('3');
    assert.equal((await quoteSummary('DEMO-101')).hasPending, true);
    assert.equal((await quoteSummary('DEMO-101')).priceCents, 600000, 'Applied quote must remain unchanged while buffer is pending');
    await quote('[data-action="part-apply"]').click();
    const applied = await quoteSummary('DEMO-101');
    assert.equal(applied.hasPending, false);
    assert.equal(applied.priceCents, 900000);
    assert.equal(applied.taxCents, 144000);
    assert.equal(applied.totalCents, 1044000);
    assert.equal(applied.costCents, 279741, 'Declared total purchases and provider total must not be multiplied again');
    assert.equal(applied.savedRevision, 0, 'Apply must not save');
    await save();
    assert.equal((await quoteSummary('DEMO-101')).saveState, 'success');
    await list();
    assert.match(await page.locator('[data-record-id="DEMO-101"]').innerText(), /10,440\.00/);
    await action('view', '[data-view="flujo"]').click();
    assert.match(await page.locator('[data-record-id="DEMO-101"]').innerText(), /10,440\.00/);
  });

  await test('Captura automática, corrección y cambio de expediente mantienen buffers aislados', async () => {
    await open('DEMO-101');
    await stage('quote');
    const originalName = await page.evaluate(() => window.__client.app.q.items[0].description);
    await article();
    await quote('[data-path="items.0.quantity"]').fill('1.2345');
    assert.equal((await quoteSummary('DEMO-101')).hasPending, true);
    await quote('[data-action="part-discard"]').click();
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false);
    assert.equal(await page.evaluate(() => window.__client.app.q.items[0].description), originalName);
    await article();
    await quote('[data-path="items.0.description"]').fill('Artículo aplicado de prueba');
    await stage('request');
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false, 'Valid capture is retained automatically before navigation');
    assert.equal(await action('apply-and-leave').count(), 0);
    await stage('quote');
    await quote('[data-path="items.0.quantity"]').fill('1.2345');
    await stage('request');
    assert.equal(await action('discard-and-leave').isVisible(), true, 'Invalid numeric input requires correction or explicit discard');
    await page.setViewportSize({ width: 390, height: 900 });
    const dialog = page.locator('#journey-footer .j-dialog');
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
    await quote('[data-path="items.0.quantity"]').fill('2');
    await stage('request');
    assert.equal(await action('apply-and-leave').count(), 0);
    if (await action('keep-and-leave').isVisible()) await action('keep-and-leave').click();
    assert.equal((await quoteSummary('DEMO-101')).hasPending, false);
    await stage('quote');
    assert.equal(await page.evaluate(() => window.__client.app.q.items[0].description), 'Artículo aplicado de prueba');
    assert.equal((await quoteSummary('DEMO-101')).dirty, true, 'Automatic local capture is not a confirmed quote snapshot');
    await save();
    await stage('request');
    await list();
    await open('DEMO-102');
    await stage('quote');
    assert.notEqual(await page.evaluate(() => window.__client.app.q.items[0].description), 'Artículo aplicado de prueba');
    await stage('request');
    await list();
    await open('DEMO-101');
    await stage('quote');
    assert.equal(await page.evaluate(() => window.__client.app.q.items[0].description), 'Artículo aplicado de prueba');
  });

  await test('Madera F y CNC conservan preview, subeditor y bloqueo sin inventar costo cero', async () => {
    await open('DEMO-102');
    await stage('quote');
    const before = await quoteSummary('DEMO-102');
    assert.equal(before.complete, false);
    assert.match(before.blockers.join(' '), /Madera:.*pendientes/);
    await save();
    assert.notEqual((await quoteSummary('DEMO-102')).saveState, 'success');
    await article('wood');
    const footerLayout = await quote('[data-solid-action="edit"]').first().evaluate(button => {
      const article = button.closest('article');
      const footer = button.closest('footer');
      if (!article || !footer) return null;
      const a = article.getBoundingClientRect(), f = footer.getBoundingClientRect();
      return { article: {x:a.x,y:a.y,right:a.right,bottom:a.bottom}, footer: {x:f.x,y:f.y,right:f.right,bottom:f.bottom}, position: getComputedStyle(footer).position };
    });
    assert.ok(footerLayout, 'Wood action footer must belong to its article');
    assert.equal(footerLayout.position, 'static', 'Inert PDF CSS must not position the component action footer');
    assert.ok(footerLayout.footer.x >= footerLayout.article.x - 1 && footerLayout.footer.right <= footerLayout.article.right + 1 && footerLayout.footer.y >= footerLayout.article.y - 1 && footerLayout.footer.bottom <= footerLayout.article.bottom + 1, 'Component action footer must stay inside its article');
    await quote('[data-solid-action="edit"]').first().click();
    assert.equal(await quote('[data-solid-field="woodKind"]').inputValue(), await page.evaluate(() => window.__client.app.breakdownEditor.solidWoodF.woodKind), 'The displayed wood selection must match the priced preview input');
    await quote('[data-solid-field="cnc.length"]').fill('101');
    await quote('[data-solid-field="cnc.repetitions"]').fill('3');
    assert.match(await quote('[data-solid-live="cncApplication"]').innerText(), /sin aplicar/i);
    await quote('[data-break-action="cancel-editor"]').click();
    await quote('[data-solid-action="edit"]').first().click();
    assert.equal(await quote('[data-solid-field="cnc.length"]').inputValue(), '');
    await quote('[data-solid-field="cnc.length"]').fill('101');
    await quote('[data-solid-field="cnc.repetitions"]').fill('3');
    await quote('[data-solid-action="apply-cnc"]').click();
    const cnc = await quote('[data-solid-live="cncApplication"]').innerText();
    assert.match(cnc, /6[.,]06 m lineales/);
    assert.match(cnc, /costo pendiente/i);
    assert.doesNotMatch(cnc, /\$\s*0(?:[.,]00)?/);
    await page.setViewportSize({ width: 390, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Wood editor must fit mobile width');
    for (const selector of ['[data-solid-action="apply-cnc"]', '[data-break-action="cancel-editor"]']) {
      const box = await quote(selector).boundingBox();
      assert.ok(box && box.width >= 90, `Mobile action ${selector} must remain legible instead of stacking one character per line`);
    }
    await capture({ path: path.join(artifacts, 'wood-editor-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await quote('[data-break-action="save-editor"]').click();
    await quote('[data-action="part-apply"]').click();
    const after = await quoteSummary('DEMO-102');
    assert.equal(after.hasPending, false);
    assert.equal(after.complete, false);
    assert.equal(after.costCents, before.costCents, 'CNC without tariff must not change confirmed cost');
    await save();
    assert.notEqual((await quoteSummary('DEMO-102')).saveState, 'success');
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

  await test('Mesa, Flujo y cotizador se usan en móvil y por teclado', async () => {
    for (const width of [390, 538, 768, 783, 1100, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await action('view', '[data-view="mesa"]').click();
      const flow = action('view', '[data-view="flujo"]');
      await flow.focus();
      await page.keyboard.press('Enter');
      assert.equal(await action('open').count(), seedIds.length);
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
        for (let i=1;i<bounds.buttons.length;i++) {
          assert.ok(bounds.buttons[i].left>=bounds.buttons[i-1].right-1,`Adjacent menu targets do not overlap at ${width}px`);
          assert.ok(Math.abs(bounds.buttons[i].top-bounds.buttons[0].top)<1,`Steps stay in one scrollable row at ${width}px`);
        }
      }
      if(width<=1150) {
        const sizes=await quote('.shell').evaluate(element=>({shell:element.clientWidth,form:element.querySelector('.mainform').clientWidth}));
        assert.ok(sizes.form>=sizes.shell-1,`Form uses the available width rather than an empty second column at ${width}px`);
      }
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
