import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {createPrivateServer} from '../tools/private-server.mjs';
import {PrivateStore} from '../tools/private-store.mjs';
import {build} from '../tools/build.mjs';
import {prepareFurniture} from './browser/furniture-fixture.mjs';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}
catch{
  const modules=process.env.DEMO_NODE_MODULES||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');
  playwright=require(path.join(modules,'playwright'));
}
const probe=net.createServer();
await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const db=new DatabaseSync(':memory:');
const store=new PrivateStore(db);
const account='cuenta-prueba';
const password='contraseña-para-gestion-ficticia';
const sid='S-1-5-21-111-222-333-1111';
store.provision(account,'account',password);
store.linkWindows(sid,account,password);
const privateJs=await readFile(new URL('../src/private-client.js',import.meta.url),'utf8');
const server=createPrivateServer({
  store,port,publicHtml:build(),privateJs,identifyWindowsPeer:async()=>sid
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
const home='http://127.0.0.1:'+port;
const screenshots=fileURLToPath(new URL('../artifacts/gestion-duco/',import.meta.url));
const viewports=[{width:1460,height:960},{width:900,height:900},{width:390,height:844}];
const shellStyles={
  '.j-sidebar':['width','backgroundImage','visibility'],
  '.j-top':['left','height','backgroundImage','backgroundColor'],
  '.j-main':['paddingLeft','paddingRight'],
  '.j-split-heading':['fontFamily','fontSize','fontWeight'],
  '.j-heading-emphasis':['color','display'],
  '.j-switch [aria-pressed="true"]':['backgroundColor','borderRadius','fontSize'],
  '.j-toolbar input[type="search"]':['borderColor','borderRadius','minHeight']
};
const tableStyles={
  '.j-list-table':['borderColor','borderRadius','boxShadow'],
  '.j-list-table thead th':['backgroundColor','color','fontSize','textTransform']
};
const boardStyles={'.j-lane-head':['borderTopColor','borderTopWidth'],'.j-lane-head h2':['fontSize','color']};

async function appearance(page,selectors){
  return page.evaluate(async entries=>{
    await document.fonts.ready;
    return Object.fromEntries(Object.entries(entries).map(([selector,properties])=>{
      const element=document.querySelector('#journey-root '+selector);
      if(!element)throw new Error('Falta el componente '+selector);
      const style=getComputedStyle(element);
      return [selector,Object.fromEntries(properties.map(name=>[name,style[name]]))];
    }));
  },selectors);
}

async function heading(page){
  return page.locator('.j-split-heading span').allTextContents();
}

async function loadedFonts(page){
  return page.evaluate(async()=>{
    await document.fonts.ready;
    return Array.from(document.fonts).filter(font=>font.status==='loaded').map(font=>font.family).sort();
  });
}

async function checkKpiNavigation(page,viewport) {
  await page.setViewportSize(viewport);
  const mobile=viewport.width<=750;
  const menu=page.locator('.j-mobile-menu');
  const kpis=page.locator('#j-sidebar').getByRole('button',{name:'KPIs',exact:true});
  const origin=await page.evaluate(()=>performance.timeOrigin);
  const pageCount=page.context().pages().length;
  const probe=await page.evaluateHandle(()=>{
    const state={draws:0};
    const observer=new MutationObserver(changes=>{
      for(const change of changes) if([...change.addedNodes].some(node=>node.id==='j-main')) state.draws++;
    });
    observer.observe(document.querySelector('#journey-root'),{childList:true});
    return {state,stop:()=>observer.disconnect()};
  });
  try {
    if(mobile) await menu.click();
    await kpis.click();
    await page.locator('#journey-root[data-journey-screen="kpis"]').waitFor();
    assert.equal(await probe.evaluate(p=>p.state.draws),1,'Al abrir KPIs solo se pinta el panel de destino');
    await page.locator('#j-kpi-type').selectOption('line');
    await page.getByRole('tab',{name:'Ventas y clientes'}).click();
    const before=await probe.evaluate(p=>p.state.draws);
    const scroll=await page.evaluate(()=>{window.scrollTo(0,180);return window.scrollY;});
    if(mobile) await menu.click();
    await kpis.press('Enter');
    assert.equal(await probe.evaluate(p=>p.state.draws),before,'El panel abierto sobrevive al menú y a la segunda selección de KPIs');
    assert.equal(await page.evaluate(()=>window.scrollY),scroll);
    assert.equal(await page.locator('#j-kpi-type').inputValue(),'line');
    assert.equal(await page.getByRole('tab',{name:'Ventas y clientes'}).getAttribute('aria-selected'),'true');
    assert.equal(await (mobile?menu:kpis).evaluate(e=>e===document.activeElement),true);
    assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
    assert.equal(page.context().pages().length,pageCount);
  } finally {
    await probe.evaluate(p=>p.stop());
    await probe.dispose();
  }
  if(mobile) await menu.click();
  await page.locator('#j-sidebar [data-action="list"]').click();
}

let browser;
try{
  await mkdir(screenshots,{recursive:true});
  browser=await playwright.chromium.launch({headless:true,channel:process.env.DEMO_BROWSER_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:viewports[0],reducedMotion:'reduce'});
  const errors=[],network=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>network.push({url:request.url(),method:request.method()}));
  assert.equal((await page.request.get(home+'/src/gestion-preview-model.js')).status(),401);
  await page.goto(home);
  await page.locator('#journey-root[data-journey-screen="list"]').waitFor();
  assert.equal(await page.locator('#j-sidebar a[href*="gestion.html"]').count(),0);
  assert.doesNotMatch(await page.locator('#j-sidebar').textContent(),/Gestión DUCO/i);
  await checkKpiNavigation(page,viewports[0]);
  await checkKpiNavigation(page,viewports[2]);
  await page.setViewportSize(viewports[0]);
  const quoteHeading=await heading(page);
  assert.equal(quoteHeading.length,2);
  const referenceFonts=await loadedFonts(page);
  assert.ok(referenceFonts.length>0,'La referencia debe usar sus fuentes de marca');
  await page.locator('.j-sidebar [data-action="projects"]').click();
  const projectHeading=await heading(page);
  assert.equal(projectHeading.length,2);
  assert.notDeepEqual(projectHeading,quoteHeading);
  await page.locator('.j-sidebar [data-action="list"]').click();
  const reference=new Map();
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    await page.locator('[data-view="mesa"]').click();
    const table=await appearance(page,tableStyles);
    const shell=await appearance(page,shellStyles);
    await page.locator('[data-view="flujo"]').click();
    reference.set(viewport.width,{table,shell,board:await appearance(page,boardStyles)});
  }
  await page.setViewportSize(viewports[0]);
  await page.goto(home+'/gestion.html');
  assert.equal(await page.locator('[data-select]').count(),9);
  assert.deepEqual(await loadedFonts(page),referenceFonts,'Fuentes de marca cargadas en el navegador');
  const shot=filename=>page.screenshot({path:path.join(screenshots,filename)});
  await shot('a-mesa.png');
  const kind=type=>page.locator('[data-kind="'+type+'"]');
  const view=type=>page.locator('[data-view="'+type+'"]');
  const section=(p,step)=>p.locator('#quote-host .steps [data-step="'+step+'"]');
  const modal=page.locator('#gp-dialog');
  const detail=page.locator('#gp-detail');
  const lane=stage=>page.locator('.gp-board-lane[data-stage="'+stage+'"]');
  const namedCard=title=>page.locator('.gp-board-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  const laneCount=async stage=>Number(await lane(stage).locator('.j-lane-head span').textContent());
  async function dragCard(title,destination){
    // The folio is part of the card's draggable area. Leave the buttons and selector alone.
    await namedCard(title).locator('.j-sub').first().dragTo(lane(destination).locator('.j-lane-head'));
  }
  async function verifyMove(title,from,to){
    const beforeFrom=await laneCount(from), beforeTo=await laneCount(to);
    const activityCount=await detail.locator('.gp-activity li').count();
    await dragCard(title,to);
    await lane(to).getByRole('button',{name:title,exact:true}).waitFor();
    assert.equal(await laneCount(from),beforeFrom-1);
    assert.equal(await laneCount(to),beforeTo+1);
    assert.equal(await detail.getByLabel('Etapa').inputValue(),to);
    assert.equal(await detail.locator('.gp-activity li').count(),activityCount+1);
    await view('mesa').click();
    assert.equal(await page.getByRole('combobox',{name:'Etapa de '+title,exact:true}).inputValue(),to);
    await view('tablero').click();
  }
  assert.deepEqual(await heading(page),quoteHeading);
  for(const mode of ['mesa','tablero']){
    await view(mode).click();
    await page.getByRole('button',{name:'Mobiliario para sala de lectura',exact:true}).click();
    const products=detail.getByRole('table',{name:'Productos de la cotización'});
    assert.deepEqual(await products.locator('tbody tr').allTextContents(),['Mesa Florencia · Tzalam2Pieza','Banca de lectura4Pieza']);
    await page.getByRole('button',{name:'Señalética para recepción',exact:true}).click();
    assert.equal(await products.count(),0);
    assert.ok(await detail.getByText('Aún no se han agregado productos.').isVisible());
    await detail.getByRole('button',{name:'Cerrar ficha'}).click();
  }
  await view('tablero').click();
  await shot('b-tablero.png');
  await view('mesa').click();

  for(const mode of ['mesa','tablero']){
    await view(mode).click();
    const openPages=page.context().pages().length;
    await page.locator('#gp-new').click();
    await page.locator('#journey-root[data-journey-screen="request"]').waitFor();
    await page.locator('#quote-host .mainform [data-path="name"]').waitFor();
    assert.equal(page.context().pages().length,openPages);
    assert.equal(await page.locator('#gp-dialog[open]').count(),0);
    assert.equal(new URL(page.url()).hash,'');
    await section(page,1).click();
    await page.locator('#journey-root[data-journey-screen="quote"]').waitFor();
    assert.equal(await page.locator('#quote-host .part-accordion').count(),0);
    assert.equal(db.prepare('SELECT count(*) AS count FROM quotes').get().count,0);
    await page.goto(home+'/gestion.html');
    assert.equal(await page.locator('[data-select]').count(),9);
  }
  const title='Señalética para recepción';
  await page.getByRole('button',{name:title,exact:true}).click();
  await detail.getByRole('heading',{name:title,exact:true}).waitFor();
  async function openDraft(){
    const receiving=page.context().waitForEvent('page');
    await detail.getByRole('button',{name:'Abrir en Cotizador'}).click();
    const draft=await receiving;
    await draft.locator('#quote-host .mainform').waitFor();
    return draft;
  }
  const firstDraft=await openDraft();
  const quoteId=await firstDraft.evaluate(()=>window.DemoJourney.inspect().state.id);
  assert.equal(await firstDraft.locator('#quote-host [data-path="name"]').inputValue(),title);
  assert.equal(db.prepare('SELECT count(*) AS count FROM quotes').get().count,0,'Abrir la ficha no crea escrituras');
  await firstDraft.locator('#quote-host [data-path="name"]').fill('Mostrador con cambios de prueba');
  await firstDraft.setViewportSize(viewports[2]);
  await firstDraft.locator('.j-mobile-menu').click();
  await firstDraft.locator('#j-sidebar').getByRole('button',{name:'KPIs',exact:true}).click();
  const guard=firstDraft.getByRole('alertdialog');
  await guard.waitFor();
  assert.equal(await firstDraft.locator('.j-mobile-menu').getAttribute('aria-expanded'),'false');
  await guard.getByRole('button',{name:'Continuar editando'}).click();
  assert.equal(await firstDraft.locator('#quote-host [data-path="name"]').inputValue(),'Mostrador con cambios de prueba');
  assert.equal(db.prepare('SELECT count(*) AS count FROM quotes').get().count,0);
  await firstDraft.setViewportSize(viewports[0]);
  await section(firstDraft,1).click();
  const furniture=await prepareFurniture(firstDraft);
  const qty=firstDraft.locator('#quote-host .header-quantity-control input').nth(1);
  await qty.click();await qty.fill('6');await qty.press('Tab');
  await section(firstDraft,2).click();
  const orderNet=p=>p.locator('#quote-host [data-estimate-order]').innerText();
  assert.match(await orderNet(firstDraft),/1,040\.02/);
  await firstDraft.locator('#quote-host .panel-actions [data-action="save"]').click();
  await firstDraft.waitForFunction(id=>window.DemoQuote.snapshot(id)?.quote.name==='Mostrador con cambios de prueba',quoteId);
  const saved=await firstDraft.evaluate(id=>window.DemoQuote.snapshot(id),quoteId);
  assert.equal(saved.summary.costCents,104002);
  assert.deepEqual(saved.summary.estimatedCosts.items.map(x=>[x.itemId,x.directNet]),[[furniture[0],25000],[furniture[1],75000]]);
  await firstDraft.close();
  const continued=await openDraft();
  assert.equal(await continued.evaluate(()=>window.DemoJourney.inspect().state.id),quoteId);
  await section(continued,2).click();
  assert.match(await orderNet(continued),/1,040\.02/);
  const reopened=await continued.evaluate(id=>window.DemoQuote.snapshot(id),quoteId);
  assert.deepEqual(reopened.local.wood,saved.local.wood);
  assert.deepEqual(reopened.quote.items.map(item=>item.quantity),['1','6']);
  assert.equal(reopened.summary.costCents,104002);
  await section(continued,0).click();
  assert.equal(await continued.locator('#quote-host [data-path="name"]').inputValue(),'Mostrador con cambios de prueba');
  // Reproduce a legacy article with a manual estimate and an edited wood piece.
  await section(continued,1).click();
  await continued.evaluate(id=>{
    const c=window.__client;c.partDiscard();
    c.app.q.manufacturing.items.find(row=>row.itemId===id).mode='manual';
    c.app.q=QuoteManufacturing_.apply(c.app.q);c.restoreManufacturing();
    c.app.openPartId='';c.editor();
  },furniture[1]);
  await continued.locator('#quote-host .header-quantity-control input').nth(1).click();
  const article=continued.locator('#part-detail-'+furniture[1]);
  const wood=article.locator('[data-article-fold="wood"]');
  const dimensions=wood.locator('[data-fab-panel="workshop-dimensions"]');
  for(const panel of [wood,dimensions]){
    if(!await panel.evaluate(element=>element.open))await panel.locator(':scope > summary').click();
  }
  await wood.locator('[data-row-open="wood"][data-row-field="width"]').first().focus();
  const width=wood.locator('[data-solid-field="width"]');
  await width.fill('28');
  const useBreakdown=article.getByRole('button',{name:'Usar desglose calculado'}).first();
  let extraConfirms=0;
  continued.on('dialog',async dialog=>{extraConfirms++;await dialog.dismiss();});
  await useBreakdown.click();
  const choice=continued.locator('#breakdown-unsaved');
  await choice.getByRole('button',{name:'Continuar editando'}).click();
  assert.equal(await width.inputValue(),'28');
  await useBreakdown.click();
  await choice.getByRole('button',{name:'Incluir la pieza y usar el desglose'}).click();
  await continued.waitForFunction(id=>{
    const c=window.__client,edit=c.app.partDraft;
    return !c.app.breakdownEditor&&(edit?.quote??c.app.q).manufacturing.items.find(row=>row.itemId===id)?.mode==='detailed';
  },furniture[1]);
  assert.equal(extraConfirms,0,'La decisión de la pieza sustituye la segunda confirmación');
  await continued.close();
  await detail.getByLabel('Prioridad').selectOption('high');
  await detail.getByRole('button',{name:'Guardar cambios'}).click();
  await view('tablero').click();
  assert.equal(await page.locator('.gp-board-lane').count(),7);
  const card=namedCard(title);
  await page.getByLabel('Buscar').fill(title);
  assert.equal(await laneCount('draft'),0,'La columna vacía acepta tarjetas');
  await detail.getByLabel('Prioridad').selectOption('normal');
  await verifyMove(title,'request','draft');
  assert.equal(await detail.getByLabel('Prioridad').inputValue(),'normal','Arrastrar conserva lo que se está editando en la ficha');
  assert.ok(await card.getByText('Prioridad alta',{exact:true}).isVisible(),'La tarjeta conserva la última prioridad guardada');
  const quoteActivity=await detail.locator('.gp-activity li').count();
  for(const destination of ['draft','converted']){
    await dragCard(title,destination);
    assert.equal(await laneCount('draft'),1);
    assert.equal(await detail.locator('.gp-activity li').count(),quoteActivity);
    assert.equal(await detail.getByLabel('Etapa').inputValue(),'draft');
  }
  await card.getByRole('combobox').selectOption('accepted');
  assert.equal(await page.locator('[data-stage="accepted"]').getByText(title,{exact:true}).count(),1);
  await detail.getByRole('button',{name:'Convertir en proyecto'}).click();
  assert.equal(await kind('project').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await heading(page),projectHeading);
  assert.equal(await page.locator('.gp-board-card').filter({hasText:title}).count(),1);
  await verifyMove(title,'plan','supply');
  await detail.getByRole('button',{name:'Agregar tarea'}).click();
  await modal.getByLabel('Tarea').fill('Revisar plano de prueba');
  await modal.getByRole('button',{name:'Agregar tarea'}).click();
  await detail.getByRole('checkbox',{name:/Revisar plano de prueba/}).check();
  await detail.getByRole('button',{name:'Agregar nota'}).click();
  await modal.getByLabel('Nota').fill('Prueba de arranque');
  await modal.getByRole('button',{name:'Guardar nota'}).click();
  assert.ok(await detail.getByText('Prueba de arranque').isVisible());
  await view('mesa').click();
  assert.ok(await detail.getByRole('checkbox',{name:/Revisar plano de prueba/}).isChecked());
  await detail.getByRole('button',{name:/Consultar cotización/}).click();
  assert.equal(await kind('quote').getAttribute('aria-pressed'),'true');
  assert.equal(await detail.getByRole('button',{name:'Convertir en proyecto'}).count(),0);
  await page.getByLabel('Buscar').fill(title);
  await view('tablero').click();
  const convertedActivity=await detail.locator('.gp-activity li').count();
  await dragCard(title,'sent');
  assert.equal(await laneCount('converted'),1);
  assert.equal(await laneCount('sent'),0);
  assert.equal(await detail.locator('.gp-activity li').count(),convertedActivity);
  assert.equal(await detail.getByLabel('Etapa').inputValue(),'converted');
  await detail.getByRole('button',{name:'Cerrar ficha'}).click();
  await page.setViewportSize(viewports[2]);
  const mobileTitle='Mobiliario para sala de lectura';
  await page.getByLabel('Buscar').fill(mobileTitle);
  const stageSelector=namedCard(mobileTitle).getByRole('combobox');
  await stageSelector.focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await laneCount('draft'),1,'Se puede cambiar de etapa con teclado en móvil');
  assert.equal(await laneCount('request'),0);

  // Chromium sends real touch/pointer events. At tablet width both stages are on screen.
  await page.setViewportSize(viewports[1]);
  const grip=namedCard(mobileTitle).locator('.gp-board-grip');
  await grip.scrollIntoViewIfNeeded();
  const start=await grip.boundingBox();
  const end=await lane('review').locator('.j-lane-head').boundingBox();
  const pointer=await page.context().newCDPSession(page);
  try{
    await pointer.send('Emulation.setTouchEmulationEnabled',{enabled:true});
    const startX=start.x+start.width/2, startY=start.y+start.height/2;
    const endX=end.x+end.width/2, endY=end.y+end.height/2;
    const touch=(type,x,y)=>pointer.send('Input.dispatchTouchEvent',{type,touchPoints:[{x,y,id:1}]});
    await touch('touchStart',startX,startY);
    for(let step=1;step<=10;step++){
      await touch('touchMove',startX+(endX-startX)*step/10,startY+(endY-startY)*step/10);
    }
    await pointer.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await laneCount('review'),1,'El asa mueve la tarjeta mediante un gesto táctil');
    assert.equal(await laneCount('draft'),0);
  }finally{
    await pointer.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await pointer.detach();
  }
  await page.getByLabel('Buscar').fill(title);
  assert.equal(await page.locator('[data-select]').count(),1);

  await page.getByRole('button',{name:'Reiniciar prueba'}).click();
  await modal.getByRole('button',{name:'Reiniciar prueba'}).click();
  assert.equal(await page.locator('[data-select]').count(),9);
  for(const viewport of viewports){
    await page.setViewportSize(viewport);
    const expected=reference.get(viewport.width);
    for(const mode of ['mesa','tablero']){
      await view(mode).click();
      assert.deepEqual(await appearance(page,shellStyles),expected.shell,'Controles y navegación a '+viewport.width+' px en '+mode);
      const table=mode==='mesa';
      assert.deepEqual(await appearance(page,table?tableStyles:boardStyles),table?expected.table:expected.board,'Estilos de '+mode+' a '+viewport.width+' px');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Desborde de página en '+mode+' a '+viewport.width+' px');
      const outside=await page.locator('.j-top, .j-head h1, .j-switch button, .j-toolbar input, .j-toolbar select, #gp-results').evaluateAll(elements=>elements.filter(element=>{
        const {left,right,width}=element.getBoundingClientRect();
        return width<=0 || left < -1 || right > document.documentElement.clientWidth+1;
      }).map(element=>element.id||element.className));
      assert.deepEqual(outside,[],'Controles recortados en '+mode+' a '+viewport.width+' px');
    }
  }
  await shot('b-tablero-movil.png');
  const mobileMenu=page.locator('.j-mobile-menu');
  const sidebar=page.locator('.j-sidebar');
  for(const [type,title] of [['project',projectHeading],['quote',quoteHeading]]){
    await mobileMenu.click();
    assert.equal(await mobileMenu.getAttribute('aria-expanded'),'true');
    await sidebar.locator('[data-kind="'+type+'"]').click();
    assert.deepEqual(await heading(page),title);
    assert.equal(await mobileMenu.getAttribute('aria-expanded'),'false');
    assert.equal(await sidebar.isVisible(),false);
  }
  await mobileMenu.click();
  await page.keyboard.press('Escape');
  assert.equal(await mobileMenu.getAttribute('aria-expanded'),'false');
  await page.locator('[data-select]').first().click();
  const detailBox=await detail.boundingBox();
  assert.ok(detailBox && detailBox.width>0 && detailBox.x>=0 && detailBox.x+detailBox.width<=page.viewportSize().width,'Ficha móvil recortada');
  await detail.getByRole('button',{name:'Cerrar ficha'}).click();
  await mobileMenu.click();
  const kpiLink=sidebar.getByRole('link',{name:'KPIs',exact:true});
  assert.equal(await kpiLink.getAttribute('target'),null);
  assert.equal((await kpiLink.textContent()).trim(),'KPIs');
  const pageCount=page.context().pages().length;
  await kpiLink.press('Enter');
  await page.locator('#journey-root[data-journey-screen="kpis"]').waitFor();
  assert.equal(page.context().pages().length,pageCount);
  assert.equal(db.prepare('SELECT count(*) AS count FROM quotes').get().count,1,'Solo el guardado explícito del borrador escribe una cotización');
  assert.equal(store.readQuote(quoteId).snapshot.quote.name,'Mostrador con cambios de prueba');
  assert.deepEqual(network.filter(item=>!item.url.startsWith(home+'/')||item.method!=='GET'),[]);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',views:2,modules:2,session:'SQLite de prueba en memoria',widths:viewports.map(size=>size.width)}));
}finally{
  await browser?.close();
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  db.close();
}
