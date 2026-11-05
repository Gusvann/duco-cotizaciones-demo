/* Recorrido sintético. Toda la información vive únicamente en memoria. */
(() => {
  'use strict';
  const root = document.getElementById('journey-root');
  const footer = document.getElementById('journey-footer');
  const host = document.getElementById('quote-host');
  const api = window.DemoQuote;
  const portfolio = window.DemoPortfolio;
  const phone = window.DemoPhone;
  const operations = window.DemoOperations;
  const projectViews = window.DemoProjectViews;
  if (!root || !footer || !host || !api || !portfolio || !phone || !operations || !projectViews) throw new Error('No se pudo iniciar la simulación integrada.');

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = cents => {
    if (!Number.isSafeInteger(cents)) return 'Pendiente';
    const exact=BigInt(cents),negative=exact<0n,absolute=negative?-exact:exact,whole=absolute/100n,fraction=String(absolute%100n).padStart(2,'0');
    const signed=negative?(whole===0n?-0:-whole):whole;
    return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).formatToParts(signed).map(part=>part.type==='fraction'?fraction:part.value).join('');
  };
  const date = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Por definir';
    const parsed = new Date(value + 'T12:00:00');
    return Number.isNaN(parsed.valueOf()) ? 'Por definir' : new Intl.DateTimeFormat('es-MX', {day:'numeric', month:'short', year:'numeric'}).format(parsed);
  };
  let clockTick = 0;
  const stamp = () => new Date(Date.UTC(2026,9,15,12,0,clockTick++)).toISOString();
  const clients = {
    'CL-DEMO-A':{name:'Cliente ficticio Alba',firstSaleAt:'2024-05-18'},'CL-DEMO-B':{name:'Cliente ficticio Bruma',firstSaleAt:'2026-02-15'},
    'CL-DEMO-C':{name:'Cliente ficticio Cobre',firstSaleAt:'2026-03-20'},'CL-DEMO-D':{name:'Cliente ficticio Duna',firstSaleAt:'2025-08-12'},
    'CL-DEMO-E':{name:'Cliente ficticio Ébano',firstSaleAt:'2026-08-05'},'CL-DEMO-F':{name:'Cliente ficticio Faro',firstSaleAt:null},'CL-DEMO-G':{name:'Cliente ficticio Greda',firstSaleAt:null}
  };
  const initialClientIds = new Set(Object.keys(clients));
  const stages = [{key:'request', label:'Solicitud'}, {key:'quote', label:'Cotizador'}, {key:'review', label:'Revisión'}, {key:'offer', label:'Envío'}, {key:'response', label:'Respuesta'}, {key:'project', label:'Proyecto'}];
  const statuses = {request:'Solicitud', draft:'Borrador', review:'Revisada', sent:'Enviada', accepted:'Aceptada', changes:'Cambios solicitados', rejected:'Rechazada', project:'Convertida'};
  const profiles = {account:'Account de ejemplo',designer:'Diseño de ejemplo'};
  const state = {view:'mesa', screen:'list', id:null, search:'', filter:'all', profile:'account', saveOutcome:'success', busy:false, feedback:'', tone:'info', guard:null, menu:false,returnToKpis:false,kpis:{period:'year',category:'all',basis:'acceptedAt',tab:'summary',ranking:'client',detail:null}};
  let records = [];
  let suppressChanges = false;
  let sequence = 102;
  let pendingTransition = null;
  const globalScreens = new Set(['list','kpis','projects','production','deliveries','workflow']);
  const operationDrafts = new Map();
  let taskSequence = 0;

  function projectOperations(record) {
    if (!record?.project || record.historicalPartial) return null;
    const project=record.project;
    if (!project.operations) {
      // Explicit authored examples, not inference from a name, price or commercial category.
      const fixtureRoutes={'DEMO-202':'new','DEMO-203':'line'};
      project.operations=operations.create(project,{route:Object.hasOwn(fixtureRoutes,record.id)?fixtureRoutes[record.id]:'undetermined'});
    }
    if (project.operations.projectId!==project.id || project.operations.sourceId!==record.id || project.operations.version!==project.version) throw new Error('El seguimiento no corresponde a la versión de este proyecto.');
    return project.operations;
  }

  function projectDraft(record) {
    const op=projectOperations(record);if(!op)return null;
    if(!operationDrafts.has(op.projectId))operationDrafts.set(op.projectId,{
      plan:{owner:op.owner,dueDate:op.dueDate,route:op.route,installation:op.installation},
      task:{title:'',stage:'plan',owner:'',dueDate:''},
      delivery:op.delivery?clone(op.delivery):{date:'',recipient:'',evidence:''}
    });
    return operationDrafts.get(op.projectId);
  }

  function projectAction(target,type,payload) {
    const record=current();
    if(state.busy||state.guard||state.screen!=='project'||!record?.project||target.dataset.id!==record.id||target.dataset.project!==record.project.id){notify('Abre el proyecto correspondiente antes de cambiar su seguimiento.','error');return false;}
    const op=projectOperations(record),revision=target.dataset.revision;
    if(!/^(0|[1-9]\d*)$/.test(revision||'')||!Number.isSafeInteger(Number(revision))||Number(revision)!==op.revision){notify('El proyecto cambió. Consulta su estado actual antes de reintentar.','error');return false;}
    const at=new Date(Date.UTC(2026,9,15,12,0,clockTick)).toISOString();
    const result=operations.apply(op,{projectId:op.projectId,expectedRevision:Number(revision),type,payload,at,actor:profiles[state.profile]});
    if(!result.ok){notify(result.message,'error');return false;}
    record.project.operations=result.state;
    if(result.code==='APPLIED')clockTick++;
    if(type==='plan')projectDraft(record).plan={owner:result.state.owner,dueDate:result.state.dueDate,route:result.state.route,installation:result.state.installation};
    if(type==='task-add')projectDraft(record).task={title:'',stage:state.opTab||'plan',owner:'',dueDate:''};
    if(type==='delivery')projectDraft(record).delivery=clone(result.state.delivery);
    render();notify(result.message,'success');return true;
  }

  const current = () => records.find(record => record.id === state.id);
  const summary = record => api.summary(record.id);
  const snapshot = record => api.snapshot(record.id);
  const requestComplete = record => ['title','client','need','account','designer','quoteDue','deliveryDate'].every(key => String(record.request[key] || '').trim());
  const saved = record => {
    const s = summary(record);
    return Boolean(s && snapshot(record) && s.savedRevision === s.revision && !s.dirty && !s.hasPending && !record.requestDirty && !['unknown','pending','saving','failed','failure'].includes(s.saveState));
  };
  const complete = record => Boolean(summary(record)?.complete && requestComplete(record));
  const reviewCurrent = record => Boolean(record.review && saved(record) && complete(record) && record.review.revision === summary(record).revision && record.review.requestRevision === record.requestRevision);
  const accepted = record => Boolean(record.sent && record.sent.response?.result === 'accepted' && record.sent.response.version === record.sent.version);
  const locked = record => Boolean(record.sent || record.project);
  const status = record => record.project ? 'project' : record.sent?.response?.result === 'accepted' ? 'accepted' : record.sent?.response?.result === 'rejected' ? 'rejected' : record.sent ? 'sent' : reviewCurrent(record) ? 'review' : record.lastResponse === 'changes' ? 'changes' : record.started ? 'draft' : 'request';
  const displayedSummary = record => record.project?.baseline?.summary || record.sent?.snapshot?.summary || summary(record);
  const button = (label, action, attrs = '', primary = false) => `<button type="button" class="j-btn${primary ? ' j-primary' : ''}" data-action="${action}" ${attrs}>${escape(label)}</button>`;
  const pill = (label, tone = '') => `<span class="j-pill ${tone}">${escape(label)}</span>`;
  const row = (label, value) => `<div class="j-row"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;

  // Vector wordmark from AstilBrand, including the uniform lowercase s correction.
  function brandMarkup(className = '') {
    return `<span class="j-brand ${className}" aria-label="Astil"><svg class="j-sidebar-logo" viewBox="0 0 272 100" aria-hidden="true" focusable="false"><g class="j-wordmark-ink"><path d="M4 92 37 12h16L27 92Z"/><path d="m42 12 15-1 34 81H68Z"/><path d="M156 32h-34c-8 0-13 4-13 9s5 8 13 8h17c15 0 24 8 24 21s-10 22-27 22H98V77h38c7 0 11-3 11-8s-4-7-11-7h-17c-16 0-25-8-25-22 0-13 11-22 28-22h34Z" transform="translate(128.5 92) scale(0.8108108108108109) translate(-128.5 -92)"/><path d="m169 24 16-16v24h14v14h-14v22c0 7 4 10 11 10h5v14h-8c-16 0-24-8-24-23Z"/><path d="M211 32h16v60h-16Z"/><path d="m237 24 16-16v60c0 7 4 10 11 10h3v14h-7c-15 0-23-8-23-23Z"/></g><path class="j-wordmark-accent" d="m35 92 11-27 12 27z"/><rect class="j-wordmark-accent" x="211" y="8" width="16" height="16"/></svg></span>`;
  }

  function navIcon(name) {
    const paths = {
      panorama:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      finance:'<path d="M4 20V4m0 16h16M8 15l4-5 4 3 5-8"/>',
      inventory:'<path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',
      portfolio:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3"/>',
      treasury:'<path d="m3 9 9-6 9 6H3zm2 3v7m7-7v7m7-7v7M3 22h18"/>',
      menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
      chevron:'<path d="m6 9 6 6 6-6"/>'
    };
    return `<svg class="j-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || ''}</svg>`;
  }

  function sidebarMarkup() {
    const inactive = (name, label) => `<div class="j-module j-nav-disabled" aria-disabled="true" title="No disponible">${navIcon(name)}<span>${label}</span></div>`;
    const modal = state.menu && window.matchMedia('(max-width:750px)').matches ? ' role="dialog" aria-modal="true"' : '';
    const navEntry = (label,action,active) => `<button type="button" class="${active ? 'j-nav-current' : 'j-nav-link'}" data-action="${action}" ${active ? 'aria-current="page"' : ''}>${label}${active ? '<span class="j-active-dot" aria-hidden="true"></span>' : ''}</button>`;
    return `<aside id="j-sidebar" class="j-sidebar${state.menu ? ' j-sidebar-open' : ''}" aria-label="Navegación de Astil"${modal}>${brandMarkup()}<p class="j-sidebar-subtitle">GESTIÓN EMPRESARIAL</p><nav aria-label="Módulos">${inactive('panorama','Panorama')}${inactive('finance','Finanzas')}${inactive('inventory','Inventario')}<details class="j-nav-group" open><summary class="j-module">${navIcon('portfolio')}<span>Operación</span>${navIcon('chevron')}</summary><div class="j-nav-submenu">${navEntry('Producción','production',state.screen === 'production')}${navEntry('Entregas','deliveries',state.screen === 'deliveries')}</div></details><details class="j-nav-group" open><summary class="j-module">${navIcon('portfolio')}<span>Portafolio</span>${navIcon('chevron')}</summary><div class="j-nav-submenu">${navEntry('KPIs','kpis',state.screen === 'kpis')}${navEntry('Cotizador','list',state.screen === 'list'||!globalScreens.has(state.screen)&&state.screen !== 'project')}${navEntry('Proyectos','projects',['projects','project'].includes(state.screen))}</div></details>${inactive('treasury','Tesorería')}<p class="j-nav-scope">Cotizaciones, proyectos y entrega.</p></nav><div class="j-sidebar-bottom"><span class="j-avatar" aria-hidden="true">D</span><span><strong>${escape(profiles[state.profile])}</strong><small>Sin sesión iniciada</small></span></div></aside>${state.menu ? '<button type="button" class="j-sidebar-backdrop" data-action="close-menu" aria-label="Cerrar menú"></button>' : ''}`;
  }

  function closeMenu() {
    state.menu = false;
    render();
    root.querySelector('.j-mobile-menu')?.focus();
  }

  function makeRecord(id, scenario, request) {
    return {id, scenario, request:phone.cleanHolder(request), clientId:'CL-DEMO-G',category:'retail',commercialType:'project',requestedAt:portfolio.CUTOFF,firstSentAt:null,acceptedAt:null,poAt:null,acceptedVersion:null,source:'SYNTHETIC_DEMO',version:1, requestRevision:0, requestDirty:false, quoteStep:1, started:false, review:null, sent:null, versions:[], lastResponse:null, project:null, history:[{at:stamp(), text:'Solicitud abierta.'}], reviewChecks:{technical:false, commercial:false}, responseDraft:{choice:'accepted', evidence:'', exact:false, channel:'Correo de ejemplo'}};
  }

  async function seed() {
    records = [
      makeRecord('DEMO-101', 'complete', {title:'Consola modular de muestra', client:'Cliente ficticio Alba', contact:'Contacto de ejemplo A', need:'Dos módulos de recepción para explorar el recorrido comercial.', included:'Fabricación; Empaque', excluded:'Obra civil', account:'Account de ejemplo', designer:'Diseño de ejemplo', quoteDue:'2026-10-21', deliveryDate:'2026-11-12'}),
      makeRecord('DEMO-102', 'wood', {title:'Mesa de práctica · madera y CNC', client:'Cliente ficticio Bruma', contact:'Contacto de ejemplo B', need:'Dos mesas inventadas para revisar la captura de madera y condiciones de CNC.', included:'Fabricación; Empaque', excluded:'Obra civil', account:'Account de ejemplo', designer:'Diseño de ejemplo', quoteDue:'2026-10-23', deliveryDate:'2026-11-19'})
    ];
    Object.assign(records[0],{clientId:'CL-DEMO-A',category:'offices'});
    Object.assign(records[1],{clientId:'CL-DEMO-B',category:'horeca'});
    suppressChanges = true;
    try {
      for (const record of records) api.create(record.id, record.scenario, clone(record.request), {scopePreset:'fabrication-packaging',clientId:record.clientId});
      const fixtures = [
        ['201','Recepción de ejemplo','A','horeca','project','2026-01-01','2026-01-05','2026-01-10','2026-01-20',1000000,'draft'],
        ['202','Mobiliario','B','offices','project','2026-02-01','2026-02-10','2026-02-15','2026-03-01',2000000,'project'],
        ['203','Lote de piezas de muestra','C','brands','line','2026-03-01','2026-03-08','2026-03-20','2026-03-25',3000000,'project'],
        ['204','Prototipo inventado','D','lab','project','2026-04-20','2026-04-25','2026-05-10','2026-05-15',4000000,'project'],
        ['205','Comedor de demostración','E','residential','project','2026-07-10','2026-07-20','2026-08-05','2026-08-10',5000000,'project'],
        ['206','Exhibidor ficticio','F','retail','line','2026-10-01','2026-10-05','2026-10-10',null,6000000,'accepted'],
        ['207','Lote ficticio del año anterior','A','horeca','line','2025-12-01','2025-12-10','2025-12-20','2026-01-05',7000000,'project'],
        ['208','Propuesta ficticia rechazada','B','offices','project','2026-09-01','2026-09-05',null,null,1800000,'rejected'],
        ['209','Referencia histórica parcial','C','brands','line','2026-09-01','2026-09-07','2026-09-10','2026-09-15',null,'partial'],
        ['210','Logística de práctica','G','logistics','line','2026-10-12',null,null,null,2400000,'open']
      ];
      for (const [suffix,title,clientKey,category,type,requestedAt,firstSentAt,acceptedAt,poAt,netCents,stage] of fixtures) {
        const clientId = 'CL-DEMO-'+clientKey;
        const request = {title,client:clients[clientId].name,contact:'Contacto inventado '+clientKey,need:'Alcance de mobiliario para el proyecto.',included:'Fabricación; Empaque',excluded:'Obra civil',account:'Account de ejemplo',designer:'Diseño de ejemplo',quoteDue:requestedAt,deliveryDate:'2026-11-30'};
        const record = makeRecord('DEMO-'+suffix,'complete',request);
        Object.assign(record,{clientId,category,commercialType:type,requestedAt,firstSentAt,acceptedAt,poAt,started:stage !== 'open'});
        api.create(record.id,'complete',clone(request),{scopePreset:'fabrication-packaging',clientId,...(netCents !== null ? {unitPriceCents:netCents/2} : {})});
        records.push(record);
        if (stage === 'open') continue;
        if (stage === 'partial') {
          record.historicalPartial = true;
          record.source = 'SYNTHETIC_PARTIAL_REFERENCE';
          record.sent = {version:1,sentAt:firstSentAt+'T12:00:00.000Z',clientId,category,commercialType:type,source:record.source,snapshot:{quote:null,request:clone(request),summary:{costCents:null,priceCents:null,taxCents:null,totalCents:null,complete:false},source:record.source},response:{result:'accepted',version:1,at:acceptedAt+'T12:00:00.000Z',evidence:'Aceptación inventada de referencia incompleta; importe no disponible.'}};
        } else {
          const result = await api.save(record.id,'success');
          if (!result.ok) throw new Error('No se pudo construir un escenario sintético completo.');
          const frozen = api.freeze(record.id);
          if (!frozen) throw new Error('No se pudo congelar el ejemplo sintético.');
          record.sent = {version:1,quoteVersionId:frozen.quote.versionId,sentAt:firstSentAt+'T12:00:00.000Z',clientId,category,commercialType:type,source:'SYNTHETIC_NATIVE_SNAPSHOT',snapshot:clone(frozen),response:{result:stage === 'rejected' ? 'rejected' : 'accepted',version:1,at:(acceptedAt || firstSentAt)+'T12:00:00.000Z',evidence:'Respuesta inventada del escenario de demostración.'}};
        }
        record.versions.push(record.sent);
        record.acceptedVersion = acceptedAt ? 1 : null;
        if (stage === 'project') record.project = {id:'PR-'+record.id,title,version:1,sourceId:record.id,conversionKey:record.id+':V1',createdAt:acceptedAt+'T12:00:00.000Z',baseline:clone(record.sent.snapshot)};
        if (stage === 'draft') { api.revise(record.id); record.version=2; record.sent=null; record.requestDirty=true; }
      }
      api.hide();
      // User approved removing explicit extensions even from synthetic history.
      records = records.map(phone.cleanRecord);
    }
    finally { suppressChanges = false; }
  }

  function notify(message, tone = 'info') {
    state.feedback = message;
    state.tone = tone;
    renderFooter();
  }

  function log(record, text) { record.history.unshift({at:stamp(), text}); }

  function filteredRecords() {
    const query = state.search.trim().toLocaleLowerCase('es-MX');
    return records.filter(record => (state.filter === 'all' || status(record) === state.filter) && (!query || [record.id, record.request.title, record.request.client, record.request.account, record.request.designer].some(value => String(value).toLocaleLowerCase('es-MX').includes(query))));
  }

  function nextLabel(record) {
    if (record.historicalPartial) return 'Consultar referencia parcial';
    const key = status(record);
    return ({project:'Consultar proyecto', accepted:'Convertir en proyecto', rejected:'Consultar respuesta', sent:'Registrar respuesta', review:'Preparar envío', changes:'Trabajar nueva versión', draft:'Continuar cotización', request:'Abrir solicitud'})[key];
  }

  function listMarkup() {
    const visible = filteredRecords();
    const switcher = `<div class="j-switch" role="group" aria-label="Vista de cotizaciones">${button('Mesa de cotizaciones','view',`data-view="mesa" aria-pressed="${state.view === 'mesa'}"`)}${button('Flujo de oportunidades','view',`data-view="flujo" aria-pressed="${state.view === 'flujo'}"`)}</div>`;
    const options = `<option value="all">Todos los estados</option>` + Object.entries(statuses).map(([key,label]) => `<option value="${key}" ${state.filter === key ? 'selected' : ''}>${label}</option>`).join('');
    const controls = `<div class="j-toolbar"><label class="j-field j-search"><span>Buscar solicitudes</span><input id="j-search" class="j-input" type="search" placeholder="Nombre, cliente o folio" value="${escape(state.search)}"></label><label class="j-field"><span>Estado</span><select id="j-status-filter" class="j-input">${options}</select></label><p class="j-muted j-record-count" role="status">${visible.length} de ${records.length} expedientes</p></div>`;
    let body;
    if (state.view === 'mesa') {
      body = `<div class="j-table-wrap"><table class="j-table"><caption class="j-sr">Solicitudes de cotización</caption><thead><tr><th scope="col">Solicitud</th><th scope="col">Estado</th><th scope="col">Responsables</th><th scope="col">Cotización / entrega</th><th scope="col">Total de oferta</th><th scope="col">Siguiente paso</th></tr></thead><tbody>${visible.map(record => `<tr data-record-id="${record.id}"><td>${button(record.request.title,'open',`data-id="${record.id}"`)}<div class="j-sub">${record.id} · ${escape(record.request.client)}</div></td><td>${pill(statuses[status(record)], status(record) === 'project' || accepted(record) ? 'good' : record.scenario === 'wood' ? 'warn' : '')}<div class="j-sub">Versión ${record.version}</div></td><td>${escape(record.request.account)}<div class="j-sub">${escape(record.request.designer)}</div></td><td>${date(record.request.quoteDue)}<div class="j-sub">Entrega: ${date(record.request.deliveryDate)}</div></td><td class="j-money">${money(displayedSummary(record)?.totalCents)}${!complete(record) ? '<div class="j-sub">Estimación incompleta</div>' : ''}</td><td>${button(nextLabel(record),'open',`data-id="${record.id}"`)}</td></tr>`).join('') || '<tr><td colspan="6" class="j-empty">No hay expedientes que coincidan con los filtros.</td></tr>'}</tbody></table></div>`;
    } else {
      const columns = [{label:'Por cotizar', keys:['request']}, {label:'En preparación', keys:['draft','review','changes']}, {label:'Con el cliente', keys:['sent','rejected']}, {label:'Aceptadas', keys:['accepted']}, {label:'Convertidas', keys:['project']}];
      body = `<div class="j-board">${columns.map(column => { const items = visible.filter(record => column.keys.includes(status(record))); return `<section class="j-lane" aria-label="${column.label}"><div class="j-lane-head"><h2>${column.label}</h2><span>${items.length}</span></div>${items.map(record => `<article class="j-card" data-record-id="${record.id}"><span class="j-sub">${record.id} · V${record.version}</span><h3>${button(record.request.title,'open',`data-id="${record.id}"`)}</h3><p class="j-muted">${escape(record.request.client)}</p><p class="j-card-amount">${money(displayedSummary(record)?.totalCents)}</p><p class="j-sub">Cotizar: ${date(record.request.quoteDue)}<br>Entrega: ${date(record.request.deliveryDate)}</p>${pill(statuses[status(record)], accepted(record) ? 'good' : '')}<p class="j-next">${escape(nextLabel(record))}</p></article>`).join('') || '<p class="j-empty">Sin expedientes</p>'}</section>`; }).join('')}</div>`;
    }
    return `<div class="j-head"><div class="j-section-statement"><p class="j-eyebrow">Portafolio comercial</p><h1 class="j-split-heading"><span class="j-heading-lead">Tus cotizaciones.</span> <span class="j-heading-emphasis">De la solicitud al proyecto.</span></h1><p class="j-muted">Una solicitud, su cotización y el proyecto que resulta de ella.</p></div>${button('Nueva solicitud','new-request','',true)}</div><div class="j-list-switch">${switcher}<span class="j-muted">Dos vistas · los mismos expedientes</span></div>${controls}${body}`;
  }

  const decimal = value => value === null ? '—' : new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(value);
  const kpiMetrics = () => portfolio.compute(records,state.kpis,clients);
  const kpiLink = (label,kind,key = '') => button(label,'kpi-detail',`data-kind="${escape(kind)}" data-key="${escape(key)}"`);
  const groupTotal = group => group.count && !group.pricedCount ? 'Pendiente' : money(group.totalCents);
  const kpiDate = value => value ? date(value) : 'Sin registrar';
  function kpiRows(rows,timing = false) {
    return rows.map(item => `<tr><td>${button(item.id+' · '+item.title,'kpi-open',`data-id="${escape(item.id)}"`)}<span class="j-sub">${escape(item.clientName)} · ${escape(portfolio.CATEGORIES[item.category] || 'Sin categoría')}</span><details class="j-kpi-record-dates"><summary>Ver fechas y versión</summary><span>Solicitud: ${kpiDate(item.requestedAt)}</span><span>Primer envío: ${kpiDate(item.firstSentAt)}</span><span>Aceptación: ${kpiDate(item.acceptedAt)}</span><span>Anticipo / PO: ${kpiDate(item.poAt)}</span><span>Versión aceptada: ${item.version ? 'V'+item.version : 'Sin aceptación'}</span>${item.currentVersion > item.version && item.version ? `<span>La versión actual V${item.currentVersion} no reemplaza el importe aceptado V${item.version}.</span>` : ''}</details></td><td>${timing ? decimal(portfolio.days(item.requestedAt,item.firstSentAt))+' días' : item.accepted ? pill('V'+item.version+' aceptada','good') : pill(item.rejected ? 'Rechazada' : item.firstSentAt ? 'Enviada' : 'Borrador')}</td><td>${timing ? decimal(portfolio.days(item.firstSentAt,item.acceptedAt))+' días' : portfolio.hasPrice(item) ? money(item.netCents) : 'Pendiente'}</td></tr>`).join('') || '<tr><td colspan="3" class="j-empty">Sin expedientes para esta selección.</td></tr>';
  }
  function kpiTable(rows,timing = false) {
    return `<div class="j-table-wrap j-kpi-table"><table class="j-table"><thead><tr><th scope="col">Expediente y cliente</th><th scope="col">${timing ? 'Preparación' : 'Estado / versión'}</th><th scope="col">${timing ? 'Cierre' : 'Precio sin IVA'}</th></tr></thead><tbody>${kpiRows(rows,timing)}</tbody></table></div>`;
  }
  const chartPalette = ['#0f74d9','#073b72','#16818a','#4365a8','#245278','#087363','#805c28','#745a9b'];
  const chartColor = key => {let hash=0;for(const char of String(key))hash=(Math.imul(hash,31)+char.charCodeAt(0))|0;return chartPalette[(hash>>>0)%chartPalette.length];};
  const chartKey = value => JSON.stringify(value);
  const chartData = (kind,key) => 'data-action="kpi-detail" data-kind="'+escape(kind)+'" data-key="'+escape(key)+'"';
  const ticketValue = group => !group.count ? '—' : !group.pricedCount ? 'Pendiente' : group.ticketCents === null ? 'Fuera de rango' : money(group.ticketCents);
  const amountValue = group => !group.count ? 'Sin datos' : !group.pricedCount ? 'Pendiente' : group.totalCents === null ? 'Fuera de rango' : money(group.totalCents);
  function kpiDonut({id,title,caption,groups,total,count,pricedCount=0,pendingCount=0,kind,amount=true,totalKind='sales',totalKey='',keyFor=group=>group.key,colorFor=group=>group.key}) {
    const present=groups.filter(group=>group.count>0),numeric=Number.isSafeInteger(total)&&total>=0;
    const valueOf=group=>amount?group.totalCents:group.count;
    const chartable=numeric&&total>0;
    let offset=0;
    const arcs=chartable?present.filter(group=>Number.isSafeInteger(valueOf(group))&&valueOf(group)>0).map(group=>{
      const share=100*valueOf(group)/total,key=keyFor(group),color=chartColor(colorFor(group));
      const label=group.label+' · '+group.key+': '+(amount?amountValue(group):group.count+' cotizaciones');
      const arc='<circle cx="70" cy="70" r="51" pathLength="100" fill="none" stroke="'+color+'" stroke-width="18" stroke-dasharray="'+share+' '+(100-share)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 70 70)" role="button" tabindex="0" focusable="true" data-kpi-chart-action '+chartData(kind,key)+' aria-label="'+escape(label)+'"><title>'+escape(label)+'</title></circle>';
      offset+=share;return arc;
    }).join(''):'';
    const display=amount?amountValue({count,pricedCount,pendingCount,totalCents:total}):count?String(total):'Sin datos';
    const empty=!count?'Sin observaciones para estos filtros.':!numeric?'El total excede el rango seguro; no se dibujan proporciones.':amount&&!pricedCount?'Importes pendientes: no se dibujan como cero.':total===0?'Importes conocidos en cero; no hay área proporcional.':'';
    const repeatedLabel=group=>present.filter(other=>other.label===group.label).length>1;
    return '<section class="j-panel j-donut-panel" data-kpi-chart="'+id+'"><div class="j-panel-head"><div><h2>'+escape(title)+'</h2><p class="j-muted">'+escape(caption)+'</p></div>'+kpiLink('Ver expedientes',totalKind,totalKey)+'</div><div class="j-donut-layout"><div class="j-donut-figure"><svg class="j-donut-svg" viewBox="0 0 140 140" role="group" aria-label="'+escape(title)+'"><circle class="j-donut-empty-ring" cx="70" cy="70" r="51" fill="none" stroke-width="18"/>'+arcs+'<text x="70" y="68" text-anchor="middle" aria-hidden="true">'+count+'</text><text class="j-donut-center-label" x="70" y="83" text-anchor="middle" aria-hidden="true">'+(amount?'ventas':'cotizaciones')+'</text></svg><strong class="j-donut-total">'+escape(display)+'</strong><span class="j-sub">'+(amount?pricedCount+' de '+count+' con importe · '+pendingCount+' pendientes':'Expedientes únicos de la cohorte')+'</span></div><ul class="j-chart-legend">'+present.map(group=>'<li><button type="button" '+chartData(kind,keyFor(group))+' aria-label="'+escape(group.label+' · '+group.key+': '+(amount?amountValue(group):String(group.count)))+'"><span class="j-chart-swatch" style="--chart-color:'+chartColor(colorFor(group))+'" aria-hidden="true"></span><span class="j-chart-legend-name">'+escape(group.label)+(repeatedLabel(group)?'<small>'+escape(group.key)+'</small>':'')+'</span><strong>'+escape(amount?amountValue(group):String(group.count))+'</strong>'+(amount?'<small class="j-chart-legend-coverage">'+group.pricedCount+' con importe · '+group.pendingCount+' pendientes</small>':'')+'</button></li>').join('')+'</ul></div>'+(empty?'<p class="j-chart-empty">'+escape(empty)+'</p>':'')+'<p class="j-sub j-chart-hint">Selecciona un segmento o su leyenda para consultar los expedientes.'+(amount&&pendingCount?' Proporciones sobre importes conocidos.':'')+'</p></section>';
  }
  function kpiMonthly(metrics,activity=false) {
    const groups=activity?metrics.monthlyRequests:metrics.monthlySales,labels=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const max=Math.max(1,...groups.map(group=>activity?group.count:group.totalCents??0));
    const allClients=metrics.byClient.filter(group=>activity?group.received>0:group.count>0);
    const repeatedLabel=group=>allClients.filter(other=>other.label===group.label).length>1;
    return '<section class="j-panel j-stacked-panel" data-kpi-stacked="'+(activity?'requests':'sales')+'"><div class="j-panel-head"><div><h2>'+(activity?'Cotizaciones por mes y cliente':'Ventas por mes y cliente')+'</h2><p class="j-muted">'+(activity?'Fecha de solicitud · expedientes únicos':(state.kpis.basis==='acceptedAt'?'Fecha de aceptación':'Fecha de anticipo / PO')+' · MXN sin IVA')+'</p></div>'+kpiLink('Ver expedientes',activity?'requests':'sales')+'</div><div class="j-stacked-chart">'+groups.map(group=>{
      const value=activity?group.count:group.totalCents,hasNumber=Number.isSafeInteger(value)&&value>=0,draw=hasNumber&&value>0;
      const contents=draw?(group.clients||[]).filter(client=>Number.isSafeInteger(activity?client.count:client.totalCents)&&(activity?client.count:client.totalCents)>0).map(client=>{
        const measure=activity?client.count:client.totalCents,key=chartKey({month:group.key,client:client.key});
        const label=labels[Number(group.key.slice(5))-1]+' · '+client.label+' · '+client.key+': '+(activity?client.count+' cotizaciones':amountValue(client));
        return '<button type="button" class="j-stacked-segment" style="--chart-color:'+chartColor(client.key)+';width:'+100*measure/value+'%" '+chartData(activity?'request-month-client':'month-client',key)+' aria-label="'+escape(label)+'"><span class="j-sr">'+escape(label)+'</span></button>';
      }).join(''):'';
      const label=activity?(group.count?String(group.count):'—'):group.count?amountValue(group):'—';
      return '<div class="j-stacked-row"><span class="j-stacked-month">'+labels[Number(group.key.slice(5))-1]+'</span><div class="j-stacked-track"><div class="j-stacked-bar" style="width:'+(draw?100*value/max:0)+'%">'+contents+'</div></div><button type="button" class="j-stacked-total" '+chartData(activity?'request-month':'month',group.key)+' '+(group.count?'':'disabled')+' aria-label="'+escape(group.key+': '+label)+'">'+escape(label)+'</button>'+(activity?'':group.pendingCount?'<span class="j-stacked-note">'+group.pendingCount+' pendientes de importe</span>':!group.count?'<span class="j-stacked-note">Sin ventas en este mes</span>':!hasNumber?'<span class="j-stacked-note">Total fuera de rango</span>':value===0?'<span class="j-stacked-note">Importe conocido en cero</span>':'')+'</div>';
    }).join('')+'</div><ul class="j-chart-legend j-chart-legend-inline">'+allClients.map(group=>'<li><button type="button" '+chartData(activity?'received-client':'client',group.key)+' aria-label="'+escape(group.label+' · '+group.key+' · total del período')+'"><span class="j-chart-swatch" style="--chart-color:'+chartColor(group.key)+'" aria-hidden="true"></span><span>'+escape(group.label)+(repeatedLabel(group)?'<small>'+escape(group.key)+'</small>':'')+'</span></button></li>').join('')+'</ul><p class="j-sub">'+(activity?metrics.cohort.length+' solicitudes únicas del período':metrics.priced.length+' importes válidos · '+metrics.pending.length+' pendientes')+'. Cada tramo abre el cliente y mes exactos; la leyenda abre su total del período. Los meses vacíos se muestran como —.</p></section>';
  }
  function kpiRanking(metrics) {
    return kpiDonut({id:'sales-client',title:'Ventas por cliente',caption:'Versión aceptada · MXN sin IVA',groups:metrics.byClient,total:metrics.totalCents,count:metrics.eligible.length,pricedCount:metrics.priced.length,pendingCount:metrics.pending.length,kind:'client'});
  }
  function kpiCategoryDonut(metrics) {
    return kpiDonut({id:'sales-category',title:'Ventas por categoría',caption:'Misma fecha comercial y universo de ventas',groups:metrics.byCategory,total:metrics.totalCents,count:metrics.eligible.length,pricedCount:metrics.priced.length,pendingCount:metrics.pending.length,kind:'category',colorFor:group=>'category:'+group.key});
  }
  function kpiTicketCards(metrics) {
    const groups=[{key:'all',label:'Ticket general',count:metrics.eligible.length,pricedCount:metrics.priced.length,pendingCount:metrics.pending.length,ticketCents:metrics.ticketCents},...metrics.byCategory];
    return '<section class="j-panel j-spaced"><div class="j-panel-head"><div><h2>Ticket promedio</h2><p class="j-muted">General y siete categorías · MXN sin IVA. Cada tarjeta conserva su denominador.</p></div></div><div class="j-ticket-grid">'+groups.map(group=>'<button type="button" class="j-ticket-card" data-kpi-ticket="'+escape(group.key)+'" '+chartData(group.key==='all'?'ticket':'category-ticket',group.key==='all'?'':group.key)+'><span>'+escape(group.label)+'</span><strong>'+escape(ticketValue(group))+'</strong><small>n='+group.pricedCount+' de '+group.count+' · '+group.pendingCount+' pendientes</small></button>').join('')+'</div></section>';
  }
  function kpiSalesPanels(metrics) {
    const activityGroups=acceptedOnly=>metrics.byClient.map(group=>({key:group.key,label:group.label,rows:acceptedOnly?group.activity.filter(item=>item.accepted):group.activity,count:acceptedOnly?group.accepted:group.received}));
    const activity='<div class="j-kpi-panels">'+kpiDonut({id:'received-client',title:'Cotizaciones recibidas por cliente',caption:'Cohorte por fecha de solicitud',groups:activityGroups(false),total:metrics.activity.received,count:metrics.activity.received,kind:'received-client',amount:false,totalKind:'requests'})+kpiDonut({id:'accepted-client',title:'Cotizaciones aceptadas por cliente',caption:'Aceptadas de la misma cohorte de solicitudes',groups:activityGroups(true),total:metrics.activity.accepted,count:metrics.activity.accepted,kind:'accepted-client',amount:false,totalKind:'won'})+'</div>';
    const recurrence=metrics.segments.filter(group=>group.key!=='unknown'||group.count>0).map(group=>kpiDonut({id:'segment-'+group.key,title:({new:'Ventas de clientes nuevos',recurring:'Ventas de clientes recurrentes',unknown:'Ventas sin historial clasificado'})[group.key],caption:'Por cliente · primera venta frente al período',groups:group.clients||[],total:group.totalCents,count:group.count,pricedCount:group.pricedCount,pendingCount:group.pendingCount,kind:'segment-client',totalKind:'segment',totalKey:group.key,keyFor:client=>chartKey({segment:group.key,client:client.key})})).join('');
    const unknown=metrics.segments.find(group=>group.key==='unknown');
    return activity+kpiTicketCards(metrics)+'<section class="j-kpi-recurrence j-spaced"><div class="j-panel-head"><div><h2>Nuevos y recurrentes por cliente</h2><p class="j-muted">Historial de primera venta; sin historial permanece sin clasificar.</p></div>'+kpiLink('Ver clientes sin clasificar','segment','unknown')+'</div><div class="j-kpi-panels">'+recurrence+'</div>'+(!unknown?.count?'<p class="j-sub j-spaced">Sin ventas con historial desconocido en este corte; no se ha dibujado una dona sin observaciones.</p>':'')+'</section><div class="j-spaced">'+kpiMonthly(metrics,true)+'</div>';
  }
  function kpiTimingPanels(metrics) {
    const cards='<div class="j-type-timing-cards">'+metrics.byType.map(group=>'<button type="button" class="j-panel j-type-timing-card" data-kpi-timing="'+group.key+'" '+chartData('type',group.key)+'><span>Cierre · '+escape(group.label)+'</span><strong>'+decimal(group.closeDays)+(group.n?' días':'')+'</strong><small>Primer envío → aceptación · n='+group.n+' de '+group.count+' · días naturales</small></button>').join('')+'</div>';
    return cards+'<div class="j-kpi-panels j-spaced"><section class="j-panel"><h2>Relojes del recorrido</h2><p class="j-muted">Preparación: solicitud → primer envío. Cierre: primer envío → aceptación.</p>'+row('Preparación general',decimal(metrics.prepDays)+(metrics.prepN?' días':' · sin datos'))+row('Intervalos válidos de preparación',metrics.prepN+' de '+metrics.times.length)+row('Cierre general',decimal(metrics.closeDays)+(metrics.closeN?' días':' · sin datos'))+row('Intervalos válidos de cierre',metrics.closeN+' de '+metrics.times.length)+'<p class="j-sub j-spaced">Los tipos sin clasificar permanecen en el promedio general; no se asignan a línea o proyecto.</p></section><section class="j-panel"><h2>Cobertura de tiempos</h2><p class="j-muted">Cohorte por aceptación; el selector PO no cambia estos relojes.</p>'+row('Aceptadas en el período',metrics.times.length)+row('Preparación con fechas válidas',metrics.prepN+' de '+metrics.times.length)+row('Cierre con fechas válidas',metrics.closeN+' de '+metrics.times.length)+row('Sin aceptación al corte',metrics.timeExclusions.withoutAcceptance)+row('Aceptación fuera del período',metrics.timeExclusions.outsidePeriod)+row('Preparación sin intervalo válido',metrics.timeExclusions.invalidPrep)+row('Cierre sin intervalo válido',metrics.timeExclusions.invalidClose)+'<p class="j-notice">Equivalencia con los relojes históricos de Asana: no acreditada.</p>'+kpiLink('Ver definiciones y pendientes','definitions')+'</section></div>';
  }
  function kpiDetailMarkup(metrics) {
    if (!state.kpis.detail) return '';
    const {kind,key} = state.kpis.detail;
    let rows = metrics.eligible, title = 'Ventas del período', definition = 'Versión aceptada · fecha elegida · MXN sin IVA', timing = false;
    if (kind === 'definitions') return `<section class="j-panel j-kpi-detail" id="j-kpi-detail" tabindex="-1"><div class="j-panel-head"><h2>Definiciones y decisiones pendientes</h2>${button('Cerrar detalle','kpi-close')}</div><div class="j-table-wrap j-kpi-table"><table class="j-table"><thead><tr><th>Familia</th><th>Criterio</th></tr></thead><tbody><tr><td>Ventas</td><td>Total, cliente, categoría y mes. Precio sin IVA de la versión aceptada; aceptación por defecto. PO es un hito comparativo, nunca un cobro.</td></tr><tr><td>Tickets</td><td>General y por categoría: importe conocido / número de ventas con importe. Las ausencias no valen cero. Se conservan seis categorías históricas y se añade Logística.</td></tr><tr><td>Preparación</td><td>Solicitud → primer envío, días naturales. Cohorte aceptada del período; denominador propio de intervalos válidos.</td></tr><tr><td>Cierre</td><td>Primer envío → aceptación, general / línea / proyecto, días naturales. No se modelan pausas.</td></tr><tr><td>Cotizaciones por cliente</td><td>Recibidas y aceptadas de la misma cohorte por fecha de solicitud. Un expediente agrupa sus versiones.</td></tr><tr><td>Cotizaciones por mes</td><td>Expedientes únicos por mes de solicitud.</td></tr><tr><td>Nuevos / recurrentes</td><td>Primera venta dentro / antes del período. Historial desconocido conserva su propio grupo.</td></tr></tbody></table></div><p class="j-notice">Pendientes productivos: validación de la fecha comercial, clasificación histórica y reglas de anticipo/PO; equivalencia de los tiempos con Asana no acreditada. Estos KPIs no aprueban roles, cobros, tarifas ni cambios en Astil o el cotizador operativo.</p><p class="j-muted">Corte y reloj deterministas: 15 oct 2026. Moneda: MXN, centavos enteros. Las relaciones ambiguas se reportan y no se sustituyen por el borrador más reciente.</p></section>`;
    if (kind === 'quality') return `<section class="j-panel j-kpi-detail" id="j-kpi-detail" tabindex="-1"><div class="j-panel-head"><h2>Cobertura de datos</h2>${button('Cerrar detalle','kpi-close')}</div>${row('Ventas con importe válido',metrics.priced.length+' de '+metrics.eligible.length)}${row('Importes pendientes de las ventas elegibles',metrics.pending.length)}${row('Aceptadas del período sin anticipo / PO',metrics.noPo.length)}${row('Ventas con cliente sin historial',metrics.unknown.length)}${row('Expedientes ambiguos excluidos del universo',metrics.quality.ambiguous.length)}<h3 class="j-spaced">Observaciones del universo completo</h3><ul class="j-kpi-quality-list">${metrics.quality.issues.map(issue => `<li>${button(issue.id,'kpi-open',`data-id="${escape(issue.id)}"`)} ${escape(issue.message)}</li>`).join('') || '<li>Sin observaciones en los controles ejecutados sobre estos datos.</li>'}</ul>${metrics.pending.length ? kpiTable(metrics.pending) : ''}</section>`;
    if (kind === 'ticket') {title='Ticket promedio';definition='Suma de importes válidos / número de ventas con importe; n='+metrics.priced.length+'. Pendientes: '+metrics.pending.length+'.';}
    if (kind === 'prep' || kind === 'close') { rows=metrics.times;timing=true;title=kind === 'prep' ? 'Tiempo de preparación' : 'Tiempo de cierre';definition='Aceptadas del período · días naturales · n='+ (kind === 'prep' ? metrics.prepN : metrics.closeN)+' de '+metrics.times.length+'. Los intervalos ausentes o negativos quedan excluidos.'; }
    if (kind === 'month') {rows=metrics.eligible.filter(item => item[state.kpis.basis]?.startsWith(key));title='Ventas · '+key;}
    if (kind === 'client' || kind === 'category') {const group=(kind === 'client' ? metrics.byClient : metrics.byCategory).find(group => group.key === key);rows=group?.rows || [];title=group?.label || 'Sin clasificar';}
    if (kind === 'segment') {rows=metrics.segments.find(group => group.key === key)?.rows || [];title=({new:'Clientes nuevos',recurring:'Clientes recurrentes',unknown:'Clientes sin clasificar'})[key];}
    if (kind === 'type') {rows=metrics.byType.find(group => group.key === key)?.rows || [];title='Cierre · '+(key === 'line' ? 'Producto de línea' : 'Proyecto');timing=true;definition='Aceptación en el período · primer envío → aceptación · denominador de intervalos válidos.';}
    if (['requests','sent','won','projects','request-month'].includes(kind)) {rows=metrics.cohort.filter(item => kind === 'sent' ? item.firstSentAt && item.firstSentAt <= portfolio.CUTOFF : kind === 'won' ? item.accepted : kind === 'projects' ? item.projectId && item.projectAt && item.projectAt <= portfolio.CUTOFF : kind === 'request-month' ? item.requestedAt?.startsWith(key) : true);title=({requests:'Solicitudes recibidas',sent:'Solicitudes con envío',won:'Solicitudes aceptadas',projects:'Solicitudes convertidas','request-month':'Solicitudes · '+key})[kind];definition='Cohorte por fecha de solicitud · estado al corte · un expediente por solicitud.';}
    if (kind === 'client-history') {rows=metrics.byClient.find(group => group.key === key)?.activity || [];title='Cotizaciones por cliente';definition='Recibidas y aceptadas de la misma cohorte de solicitudes.';}
    if (kind === 'received-client' || kind === 'accepted-client') {const group=metrics.byClient.find(group=>group.key===key);rows=group?.activity || [];if(kind==='accepted-client')rows=rows.filter(item=>item.accepted);title=(kind==='received-client'?'Cotizaciones recibidas · ':'Cotizaciones aceptadas de la cohorte · ')+(group?.label || 'Sin cliente identificado');definition='Identidad: '+key+' · cohorte por fecha de solicitud · un expediente por solicitud.';}
    if (kind === 'category-ticket') {const group=metrics.byCategory.find(group=>group.key===key);rows=group?.rows || [];title='Ticket · '+(group?.label || 'Sin categoría');definition='Promedio '+(group?ticketValue(group):'—')+' · n='+(group?.pricedCount || 0)+' importes válidos de '+(group?.count || 0)+' ventas; '+(group?.pendingCount || 0)+' pendientes. MXN sin IVA.';}
    if (kind === 'month-client' || kind === 'request-month-client' || kind === 'segment-client') {
      let selection=null;try{const parsed=JSON.parse(key);const valid=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&typeof parsed.client==='string'&&parsed.client.length>0&&(kind==='segment-client'?['new','recurring','unknown'].includes(parsed.segment):typeof parsed.month==='string'&&/^\d{4}-\d{2}$/.test(parsed.month));if(valid)selection=parsed;}catch{/* Invalid keys never fall back to the sales universe. */}
      const groups=kind==='segment-client'?metrics.segments:kind==='month-client'?metrics.monthlySales:metrics.monthlyRequests;
      const outer=selection?groups.find(group=>group.key===(selection.segment || selection.month)):null;
      const client=outer?.clients?.find(group=>group.key===selection.client);rows=client?.rows || [];
      title=selection?(kind==='segment-client'?({new:'Clientes nuevos',recurring:'Clientes recurrentes',unknown:'Sin historial clasificado'})[selection.segment]:selection.month)+' · '+(client?.label || selection.client):'Detalle sin selección válida';
      definition=!selection?'La clave de detalle es inválida. No se ha consultado otro conjunto de expedientes.':'Identidad: '+selection.client+' · '+(kind==='request-month-client'?'Solicitudes del mes recibido; expedientes únicos.':kind==='segment-client'?'Ventas de este cliente y segmento; misma fecha comercial seleccionada.':'Ventas de este cliente y mes; misma fecha comercial seleccionada.')+(client&&kind!=='request-month-client'?' '+client.pricedCount+' importes válidos · '+client.pendingCount+' pendientes.':!client?' Sin observaciones con los filtros actuales.':'');
    }
    return `<section class="j-panel j-kpi-detail" id="j-kpi-detail" tabindex="-1"><div class="j-panel-head"><div><h2>${escape(title)}</h2><p class="j-muted">${rows.length} expedientes</p></div>${button('Cerrar detalle','kpi-close')}</div><p class="j-muted">${escape(definition)}</p>${kpiTable(rows,timing)}<p class="j-sub">Abre una ficha para consultar el mismo expediente. Al regresar se conservan pestaña, filtros y detalle.</p></section>`;
  }
  function kpisMarkup() {
    const metrics = kpiMetrics();
    const stat = (kind,label,value,context) => `<button type="button" class="j-kpi-stat" data-action="kpi-detail" data-kind="${kind}"><span>${label}</span><strong>${value}</strong><small>${context}</small></button>`;
    const currentTotal = amountValue({count:metrics.eligible.length,pricedCount:metrics.priced.length,totalCents:metrics.totalCents});
    return `<header class="j-head"><div class="j-section-statement"><p class="j-eyebrow">Pulso comercial</p><h1 class="j-split-heading"><span class="j-heading-lead">Tu portafolio.</span> <span class="j-heading-emphasis">El pulso de tus ventas.</span></h1><p class="j-muted">Cotizaciones, clientes y tiempos en una misma vista.</p></div></header><div class="j-kpi-toolbar"><label class="j-field"><span>Período</span><select id="j-kpi-period" class="j-input"><option value="year" ${state.kpis.period === 'year' ? 'selected' : ''}>2026 · al 15 de octubre</option><option value="q3" ${state.kpis.period === 'q3' ? 'selected' : ''}>Julio – septiembre 2026</option><option value="october" ${state.kpis.period === 'october' ? 'selected' : ''}>Octubre · al día 15</option></select></label><label class="j-field"><span>Categoría</span><select id="j-kpi-category" class="j-input"><option value="all">Todas las categorías</option>${Object.entries(portfolio.CATEGORIES).map(([key,label]) => `<option value="${key}" ${state.kpis.category === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="j-field"><span>Fecha de ventas</span><select id="j-kpi-basis" class="j-input"><option value="acceptedAt" ${state.kpis.basis === 'acceptedAt' ? 'selected' : ''}>Aceptación</option><option value="poAt" ${state.kpis.basis === 'poAt' ? 'selected' : ''}>Anticipo / PO · sólo hito</option></select></label></div><p class="j-muted j-kpi-filter-scope">Ventas y tickets: fecha elegida · Actividad: solicitud · Tiempos: aceptación. MXN sin IVA.</p><div class="j-kpi-tabs" role="tablist" aria-label="Análisis de Portafolio">${[['summary','Resumen'],['sales','Ventas y clientes'],['times','Tiempos']].map(([key,label]) => `<button type="button" id="j-kpi-tab-${key}" role="tab" aria-selected="${state.kpis.tab === key}" aria-controls="j-kpi-tab-panel" tabindex="${state.kpis.tab === key ? 0 : -1}" data-action="kpi-tab" data-tab="${key}">${label}</button>`).join('')}</div><div class="j-kpi-stats">${stat('sales','Ventas del período',currentTotal,metrics.priced.length+' con importe · '+metrics.pending.length+' pendientes')}${stat('ticket','Ticket promedio',ticketValue({count:metrics.eligible.length,pricedCount:metrics.priced.length,ticketCents:metrics.ticketCents}),'Suma de ventas válidas / n='+metrics.priced.length)}${stat('prep','Preparación',decimal(metrics.prepDays)+(metrics.prepN ? ' días' : ''),'Solicitud → primer envío · n='+metrics.prepN+' de '+metrics.times.length)}${stat('close','Cierre',decimal(metrics.closeDays)+(metrics.closeN ? ' días' : ''),'Primer envío → aceptación · n='+metrics.closeN+' de '+metrics.times.length)}</div><div class="j-kpi-activity">${[['requests','Recibidas',metrics.activity.received],['sent','Con envío',metrics.activity.sent],['won','Aceptadas',metrics.activity.accepted],['projects','A proyecto',metrics.activity.projects]].map(([kind,label,value]) => `<button type="button" data-action="kpi-detail" data-kind="${kind}"><strong>${value}</strong><span>${label}</span></button>`).join('')}</div><div class="j-kpi-coverage"><span role="status">${metrics.eligible.length} ventas elegibles · ${metrics.priced.length} con importe · corte: 15 oct 2026</span>${kpiLink('Cobertura de datos','quality')}${kpiLink('Definiciones y pendientes','definitions')}</div>${kpiDetailMarkup(metrics)}<section id="j-kpi-tab-panel" role="tabpanel" aria-labelledby="j-kpi-tab-${state.kpis.tab}">${state.kpis.tab === 'summary' ? `<div class="j-kpi-panels">${kpiRanking(metrics)}${kpiCategoryDonut(metrics)}</div><div class="j-spaced">${kpiMonthly(metrics)}</div>` : state.kpis.tab === 'sales' ? kpiSalesPanels(metrics) : kpiTimingPanels(metrics)}</section><p class="j-sub j-spaced">Los indicadores muestran los expedientes de esta sesión; la equivalencia histórica con Asana no está acreditada.</p>`;
  }
  function recordMarkup(record) {
    const projected = portfolio.project([record],clients)[0];
    return `<section class="j-panel"><p class="j-eyebrow">Ficha del mismo expediente</p><h2>${escape(projected.title)}</h2>${record.historicalPartial ? '<p class="j-notice">Referencia histórica parcial. No tiene un guardado confirmado. No permite revisar, enviar ni convertir hasta reconstruir una nueva versión completa por el flujo correspondiente.</p>' : ''}<div class="j-grid"><div>${row('Cliente / identidad',projected.clientName+' · '+(projected.clientId || 'Sin identidad'))}${row('Categoría',portfolio.CATEGORIES[projected.category] || 'Sin clasificar')}${row('Tipo comercial',projected.type === 'line' ? 'Producto de línea' : projected.type === 'project' ? 'Proyecto' : 'Sin clasificar')}${row('Versión aceptada',projected.version ? 'V'+projected.version : 'Sin aceptación')}${row('Precio aceptado sin IVA',portfolio.hasPrice(projected) ? money(projected.netCents) : 'Pendiente')}</div><div>${row('Solicitud',kpiDate(projected.requestedAt))}${row('Primer envío',kpiDate(projected.firstSentAt))}${row('Aceptación',kpiDate(projected.acceptedAt))}${row('Anticipo / PO · hito',kpiDate(projected.poAt))}${row('Primera venta del cliente',kpiDate(projected.firstSaleAt))}</div></div><p class="j-sub j-spaced">Versión actual: V${record.version}. El borrador actual no reemplaza la versión aceptada.</p><div class="j-actions j-spaced">${!record.historicalPartial ? button('Abrir recorrido de este expediente','stage','data-screen="request"',true) : button('Consultar referencia histórica','stage','data-screen="offer"')}${button('Regresar a KPIs','return-kpis')}</div>${versionsMarkup(record)}</section>`;
  }
  function canStage(record, key) {
    if (key === 'record') return true;
    if (record.historicalPartial) return key === 'offer';
    if (key === 'request' || key === 'quote') return true;
    if (key === 'review') return saved(record) && complete(record);
    if (key === 'offer') return reviewCurrent(record) || Boolean(record.sent);
    if (key === 'response') return Boolean(record.sent);
    if (key === 'project') return accepted(record) || Boolean(record.project);
    return false;
  }

  function caseMarkup(record) {
    const s = summary(record);
    const crumbs = `<div class="j-case-head"><div><p class="j-eyebrow">${record.id} · Versión ${record.version}</p><h1>${escape(record.request.title)}</h1><p class="j-muted">${escape(record.request.client)} · ${escape(record.request.account)} · ${escape(record.request.designer)}</p></div><div id="j-status">${pill(statuses[status(record)], accepted(record) || record.project ? 'good' : '')}</div></div>`;
    const back = state.returnToKpis ? `<div class="j-kpi-return">${button('Regresar a KPIs','return-kpis')}<span class="j-muted">Se conservarán los filtros y el detalle.</span></div>` : '';
    const phoneNotice = phone.recordNeedsAttention(record) ? '<p class="j-notice" role="status">Un teléfono de este expediente requiere revisión para retirar una posible extensión.</p>' : '';
    if (state.screen === 'record') return crumbs+back+phoneNotice+recordMarkup(record);
    const nav = state.screen === 'quote' ? '' : `<nav class="j-stages" aria-label="Etapas del expediente">${stages.map(stage => button(stage.label,'stage',`data-screen="${stage.key}" aria-pressed="${state.screen === stage.key}" ${canStage(record,stage.key) ? '' : 'disabled'}`)).join('')}</nav>`;
    let body = '';
    if (state.screen === 'request' || state.screen === 'quote') body = nativeFormMarkup(record);
    if (state.screen === 'review') body = reviewMarkup(record);
    if (state.screen === 'offer') body = offerMarkup(record);
    if (state.screen === 'response') body = responseMarkup(record);
    if (state.screen === 'project') body = projectMarkup(record);
    return `${crumbs}${back}${nav}${phoneNotice}${body}`;
  }

  function saveStatus(record) {
    const s = summary(record);
    return saved(record) ? 'Guardado durante esta sesión' : s.hasPending ? 'Captura sin aplicar' : s.saveState === 'unknown' ? 'Resultado de guardado desconocido' : '';
  }

  function nativeFormMarkup(record) {
    const s = summary(record), text = saveStatus(record);
    const notice = locked(record) ? '<p class="j-confirm">Versión enviada en consulta. Los cambios requieren una nueva versión.</p>' : '';
    const status = '<strong class="j-save-status" role="status"'+(text ? '' : ' hidden')+'>'+escape(text)+'</strong>';
    // The native form owns save/continue. Unknown-result recovery must stay outside its inert host.
    const recovery = state.screen === 'request' && s.saveState === 'unknown' ? button('Consultar resultado del guardado','resolve-save','id="j-resolve-save"',true) : '';
    return notice+status+recovery;
  }

  function internalTotals(s) {
    return row('Costo interno',money(s?.costCents)) + row('Precio antes de IVA',money(s?.priceCents)) + row('IVA',money(s?.taxCents)) + row('Total de oferta',money(s?.totalCents));
  }

  function reviewMarkup(record) {
    const s = snapshot(record)?.summary;
    return `<div class="j-two-columns"><section class="j-panel"><p class="j-eyebrow">Revisión</p><h2>Revisión interna de V${record.version}</h2><p class="j-muted">La revisión se conserva durante esta sesión.</p><label class="j-check"><input id="j-review-technical" type="checkbox" ${record.reviewChecks.technical ? 'checked' : ''} ${locked(record) ? 'disabled' : ''}><span>Revisión técnica: artículos, medidas, procesos y alcance.</span></label><label class="j-check"><input id="j-review-commercial" type="checkbox" ${record.reviewChecks.commercial ? 'checked' : ''} ${locked(record) ? 'disabled' : ''}><span>Revisión comercial: precio, fechas y condiciones del borrador guardado.</span></label><p class="j-notice">Primer y acabado final permanecen diferidos. Madera o CNC sin tarifa confirmada no pueden aprobarse como costo completo.</p><div class="j-actions">${button(reviewCurrent(record) ? 'Revisión confirmada' : 'Confirmar revisión','validate',`${locked(record) || !record.reviewChecks.technical || !record.reviewChecks.commercial || !saved(record) || !complete(record) ? 'disabled' : ''}`,true)}${button('Preparar oferta','stage',`data-screen="offer" ${canStage(record,'offer') ? '' : 'disabled'}`)}</div></section><aside class="j-panel"><h2>Resumen interno</h2>${internalTotals(s)}<p class="j-sub">Cálculos de la versión guardada · V${record.version}. El cliente verá precio y condiciones.</p></aside></div>`;
  }

  function termsMarkup(quote) {
    const terms = quote?.terms || {};
    const payments = Array.isArray(quote?.payments) ? quote.payments : [];
    const paymentText = payments.map(payment => {
      const portion = /^\d+(?:\.\d+)?$/.test(String(payment.percent ?? '')) ? `${payment.percent}%` : '';
      return [payment.name,portion,payment.event,typeof payment.days === 'number' && payment.days > 0 ? `${payment.days} días` : ''].filter(Boolean).join(' · ');
    });
    return `<dl class="j-terms"><div><dt>Vigencia</dt><dd>${/^\d+$/.test(String(terms.validDays ?? '')) ? `${escape(terms.validDays)} días ${escape(terms.validType || '')}` : 'Según condiciones del escenario'}${terms.validEvent ? ` · ${escape(terms.validEvent)}` : ''}</dd></div><div><dt>Plazo estimado</dt><dd>${/^\d+$/.test(String(terms.leadDays ?? '')) ? `${escape(terms.leadDays)} días ${escape(terms.leadType || '')}` : 'Por definir'}${terms.leadEvent ? ` · ${escape(terms.leadEvent)}` : ''}</dd></div><div><dt>Pagos del ejemplo</dt><dd>${paymentText.length ? paymentText.map(escape).join('<br>') : 'Por definir en el cotizador'}</dd></div>${terms.notes ? `<div><dt>Notas</dt><dd>${escape(terms.notes)}</dd></div>` : ''}</dl>`;
  }

  function offerMarkup(record) {
    const frozen = record.sent?.snapshot || snapshot(record);
    const r = frozen?.request || record.request;
    const s = frozen?.summary;
    return `<div class="j-offer-toolbar"><div><h2>Oferta comercial · V${record.sent?.version || record.version}</h2><p class="j-muted">${record.historicalPartial ? 'Referencia histórica parcial: importes y condiciones sin acreditar.' : record.sent ? 'Copia de la versión registrada en esta sesión.' : 'Vista del borrador guardado y revisado.'}</p></div><div class="j-actions">${record.historicalPartial ? pill('Referencia parcial · sólo consulta','warn') : record.sent ? button('Registrar respuesta','stage','data-screen="response"',true) : button('Registrar envío','send',`${reviewCurrent(record) && !state.busy ? '' : 'disabled'}`,true)}${record.sent && !record.project && !record.historicalPartial ? button('Abrir nueva versión','new-version') : ''}</div></div><article id="j-commercial-offer" class="j-offer"><header class="j-offer-head"><div class="j-wordmark">${brandMarkup()}<span>· DUCO</span></div><div><p>OFERTA</p><strong>${record.id} · V${record.sent?.version || record.version}</strong></div></header><p class="j-eyebrow">Para ${escape(r.client)}</p><h2>${escape(r.title)}</h2><p>${escape(r.need)}</p><div class="j-offer-scope"><div><h3>Incluye</h3><p>${escape(r.included || 'Según descripción de los artículos.')}</p></div><div><h3>Excluye</h3><p>${escape(r.excluded || 'Sin exclusiones adicionales.')}</p></div></div>${row('Fecha de cotización',date(r.quoteDue))}${row('Entrega estimada',date(r.deliveryDate))}${row('Precio antes de IVA',money(s?.priceCents))}${row('IVA',money(s?.taxCents))}${row('Total',money(s?.totalCents))}<h3 class="j-spaced">Condiciones</h3>${termsMarkup(frozen?.quote)}<p class="j-offer-disclaimer">Este documento no se envía al cliente ni constituye una oferta real. ${record.historicalPartial ? 'Esta referencia no acredita un guardado del motor.' : 'Las condiciones proceden del cotizador de este expediente.'}</p></article>${record.historicalPartial ? '<p class="j-notice">Referencia incompleta de ejemplo: no permite revisión, envío ni conversión.</p>' : record.sent ? `<p class="j-confirm">Envío registrado en esta sesión para V${record.sent.version}. La copia permanece congelada aunque se abra otra versión.</p>` : '<p class="j-muted j-spaced">Registrar envío conserva una copia inmutable; no genera correos ni llamadas externas.</p>'}`;
  }

  function versionsMarkup(record) {
    if (!record.versions.length) return '';
    return `<details class="j-panel j-spaced"><summary>Versiones enviadas (${record.versions.length})</summary><ol class="j-version-list">${record.versions.map(version => `<li data-version="${version.version}"><strong>V${version.version} · ${money(version.snapshot?.summary?.totalCents)}</strong><span>${version.response ? ({accepted:'Aceptada', changes:'Cambios solicitados', rejected:'Rechazada'})[version.response.result] : 'Sin respuesta registrada'}</span><p class="j-muted">${escape(version.snapshot?.request?.title)} · ${escape(version.snapshot?.request?.client)}</p>${version.response?.evidence ? `<p class="j-sub">Evidencia ficticia: ${escape(version.response.evidence)}</p>` : ''}</li>`).join('')}</ol></details>`;
  }

  function responseMarkup(record) {
    const sent = record.sent;
    if (!sent) return '<p class="j-notice">Primero registra un envío.</p>';
    const existing = sent.response;
    const draft = record.responseDraft;
    return `<div class="j-two-columns"><section class="j-panel"><h2>Respuesta a la versión ${sent.version}</h2><p class="j-muted">La respuesta identifica exactamente la oferta registrada y conserva su evidencia.</p>${existing ? `<p class="j-confirm">Respuesta registrada: ${({accepted:'Aceptada', changes:'Cambios solicitados', rejected:'Rechazada'})[existing.result]} · V${existing.version}</p><p>${escape(existing.evidence)}</p><div class="j-actions j-spaced">${existing.result === 'accepted' ? button(record.project ? 'Consultar proyecto' : 'Preparar conversión','stage','data-screen="project"',true) : ''}${!record.project ? button('Abrir nueva versión','new-version') : ''}</div>` : `<div class="j-grid j-spaced"><label class="j-field"><span>Respuesta</span><select id="j-response-choice" class="j-input"><option value="accepted" ${draft.choice === 'accepted' ? 'selected' : ''}>Aceptada</option><option value="changes" ${draft.choice === 'changes' ? 'selected' : ''}>Solicita cambios</option><option value="rejected" ${draft.choice === 'rejected' ? 'selected' : ''}>Rechazada</option></select></label><label class="j-field"><span>Canal del ejemplo</span><select id="j-response-channel" class="j-input"><option>Correo de ejemplo</option><option>Reunión de ejemplo</option><option>Mensaje de ejemplo</option></select></label><label class="j-field j-wide"><span>Evidencia de la respuesta</span><textarea id="j-evidence" class="j-input" rows="3" placeholder="Ejemplo: El contacto ficticio acepta la oferta V${sent.version}.">${escape(draft.evidence)}</textarea></label></div><label class="j-check"><input id="j-exact-version" type="checkbox" ${draft.exact ? 'checked' : ''}><span>La respuesta corresponde a <strong>${record.id} · V${sent.version}</strong>, total ${money(sent.snapshot?.summary?.totalCents)}.</span></label>${button('Registrar respuesta','register-response','',true)}`}</section><aside class="j-panel"><p class="j-eyebrow">Versión enviada</p><h2>${escape(sent.snapshot?.request?.title)}</h2>${row('Versión',`V${sent.version}`)}${row('Total enviado',money(sent.snapshot?.summary?.totalCents))}${row('Entrega',date(sent.snapshot?.request?.deliveryDate))}${button('Consultar oferta enviada','stage','data-screen="offer"')}<p class="j-sub j-spaced">La evidencia se conserva en memoria. No se carga un archivo ni se comunica con un servicio.</p></aside></div>${versionsMarkup(record)}`;
  }

  function projectMarkup(record) {
    const project = record.project;
    if (project) {
      projectOperations(record);
      return `<section class="j-panel j-project"><p class="j-eyebrow">Proyecto</p><h2>${escape(project.title)}</h2><p class="j-confirm">Conversión registrada en esta sesión · ${project.id}</p><div class="j-grid"><div>${row('Solicitud de origen',record.id)}${row('Versión aceptada',`V${project.version}`)}${row('Cliente',project.baseline.request.client)}${row('Account',project.baseline.request.account)}</div><div>${row('Presupuesto base interno',money(project.baseline.summary.costCents))}${row('Total comercial aceptado',money(project.baseline.summary.totalCents))}${row('Entrega estimada',date(project.baseline.request.deliveryDate))}${row('Responsable de diseño',project.baseline.request.designer)}</div></div><p class="j-muted j-spaced">Proyecto único vinculado con la versión aceptada. El seguimiento no modifica esta base ni crea cobros, cuentas por cobrar o compras reales.</p><div class="j-actions j-spaced">${button('Consultar versión aceptada','stage','data-screen="offer"')}${button('Todos los proyectos','projects')}</div></section>${projectViews.detail(record,state.opTab||'plan',projectDraft(record))}${versionsMarkup(record)}`;
    }
    return `<section class="j-panel"><p class="j-eyebrow">Conversión ilustrativa</p><h2>De cotización aceptada a proyecto</h2><p>Se conservarán la solicitud, la versión aceptada, su alcance y el presupuesto base.</p><div class="j-grid j-spaced"><div>${row('Solicitud',record.id)}${row('Versión aceptada',`V${record.sent?.version}`)}${row('Cliente',record.sent?.snapshot?.request?.client || record.request.client)}</div><div>${row('Total aceptado',money(record.sent?.snapshot?.summary?.totalCents))}${row('Entrega',date(record.sent?.snapshot?.request?.deliveryDate))}</div></div><p class="j-notice">No se registra ningún anticipo. Las condiciones de pagos y permisos siguen pendientes.</p>${button('Convertir en proyecto','convert',`${accepted(record) && !state.busy ? '' : 'disabled'}`,true)}</section>`;
  }

  function revealActiveSteps() {
    // Reveal only horizontally: editing deep in the form must not jump the page.
    for (const [container,selector,currentSelector] of [[root,'.j-stages','[aria-pressed="true"]'],[host,'.steps','.current']]) {
      const navigation = container.querySelector(selector);
      const currentStep = navigation?.querySelector(currentSelector);
      if (!currentStep) continue;
      const viewport = navigation.getBoundingClientRect(), target = currentStep.getBoundingClientRect();
      if (target.left < viewport.left) navigation.scrollLeft -= viewport.left-target.left;
      else if (target.right > viewport.right) navigation.scrollLeft += target.right-viewport.right;
    }
  }

  function render() {
    const active = current();
    const atKpis = state.screen === 'kpis';
    const atOperations = globalScreens.has(state.screen)&&!['list','kpis'].includes(state.screen);
    const atList = !atKpis && !atOperations && (state.screen === 'list' || !active);
    if(atOperations)for(const record of records)if(record.project)projectOperations(record);
    const operationsTitle={projects:'Proyectos',production:'Producción',deliveries:'Entregas',workflow:'Mapa del proceso'}[state.screen];
    const operationsBody=atOperations?(state.screen==='workflow'?projectViews.workflow():projectViews.list(records,state.screen)):'';
    const activeElement = document.activeElement;
    const restoreSearch = activeElement?.id === 'j-search';
    const selection = restoreSearch ? activeElement.selectionStart : null;
    root.innerHTML = `<a class="j-skip" href="#j-main">Saltar al contenido</a>${sidebarMarkup()}<header class="j-top"><div class="j-top-identity"><button type="button" class="j-mobile-menu" data-action="toggle-menu" aria-label="Abrir menú" aria-expanded="${state.menu}" aria-controls="j-sidebar">${navIcon('menu')}</button>${brandMarkup('j-mobile-brand')}<span class="j-top-name">DUCO</span><span class="j-top-divider">/</span><span class="j-top-caption">Espacio de trabajo</span></div><div class="j-top-actions"><span class="j-demo">SÓLO EN ESTA SESIÓN</span>${button('Reiniciar sesión','reset')}</div></header><nav class="j-breadcrumb" aria-label="Ubicación">Portafolio <span aria-hidden="true">›</span>${atOperations ? `<span>${operationsTitle}</span>` : atKpis ? '<span>KPIs</span>' : atList ? '<span>Cotizaciones</span>' : `${button('Cotizaciones','list')}<span aria-hidden="true">›</span><span>${escape(active.id)}</span>`}</nav><main id="j-main" class="j-main" tabindex="-1">${atOperations ? operationsBody : atKpis ? kpisMarkup() : atList ? listMarkup() : caseMarkup(active)}</main>`;
    host.hidden = atOperations || atList || atKpis || !['request','quote'].includes(state.screen);
    host.dataset.journeyScreen = state.screen;
    revealActiveSteps();
    if (restoreSearch) { const input = document.getElementById('j-search'); input?.focus(); if (selection != null) input?.setSelectionRange(selection,selection); }
    renderFooter();
  }

  function guardMarkup() {
    if (!state.guard) return '';
    const type = state.guard;
    const heading = type === 'reset' ? '¿Reiniciar esta sesión?' : type === 'pending' ? (api.automaticCapture?'Hay datos por corregir':'Hay captura sin aplicar') : type === 'unknown' ? 'Falta confirmar el guardado' : 'El borrador tiene cambios sin guardar';
    const copy = type === 'reset' ? 'Se eliminarán los expedientes, versiones y proyectos de esta sesión. Se restaurarán los datos iniciales.' : type === 'pending' ? (api.automaticCapture?'Corrige o descarta los datos pendientes antes de continuar. Los cambios válidos de la sesión se conservan.':'Antes de cambiar de etapa o expediente, aplica o descarta únicamente la captura pendiente. El borrador aplicado se conserva en memoria.') : type === 'unknown' ? 'Consulta el resultado de la operación antes de continuar. No se puede tratar un resultado desconocido como éxito.' : 'Puedes guardarlo o conservarlo en memoria para seguir después. Recargar la página elimina los cambios de la sesión.';
    const controls = type === 'reset' ? button('Sí, reiniciar','confirm-reset','',true) + button('Conservar la sesión','stay') : type === 'pending' ? (api.automaticCapture?'':button('Aplicar y continuar','apply-and-leave','',true)) + button('Descartar captura y continuar','discard-and-leave') + button('Continuar editando','stay') : type === 'unknown' ? button('Consultar resultado y continuar','resolve-and-leave','',true) + button('Volver al expediente','stay') : button('Guardar y continuar','save-and-leave',complete(current()) ? '' : 'disabled',true) + button('Conservar borrador y continuar','keep-and-leave') + button('Continuar editando','stay');
    return `<div class="j-modal-backdrop"><section class="j-dialog" role="alertdialog" aria-modal="true" aria-labelledby="j-guard-title" aria-describedby="j-guard-copy"><h2 id="j-guard-title">${heading}</h2><p id="j-guard-copy">${copy}</p><div class="j-actions j-spaced">${controls}</div></section></div>`;
  }

  function renderFooter() {
    const active = current();
    const s = active ? summary(active) : null;
    const quoteControls = active && state.screen === 'quote' ? `<div class="j-quote-footer"><div class="j-actions">${api.automaticCapture?'':button('Aplicar captura pendiente','apply-pending',!s?.hasPending || locked(active) ? 'disabled' : '')}${button('Descartar captura pendiente','discard-pending',!s?.hasPending || locked(active) ? 'disabled' : '')}</div><div class="j-actions">${s?.saveState === 'unknown' ? button('Consultar resultado del guardado','resolve-save','id="j-resolve-save"',true) : ''}${button('Volver a cotizaciones','list')}${button('Ir a revisión','stage',`data-screen="review" ${canStage(active,'review') ? '' : 'disabled'}`,true)}</div></div>` : '';
    footer.innerHTML = `<div class="j-footer-inner">${quoteControls}${state.feedback ? `<p id="j-feedback" class="j-feedback ${state.tone}" role="${state.tone === 'error' ? 'alert' : 'status'}">${escape(state.feedback)}</p>` : '<p id="j-feedback" class="j-sr" role="status"></p>'}${active && state.screen === 'quote' && s?.blockers?.length ? `<div class="j-notice" id="j-blockers"><strong>Faltantes del cotizador</strong><ul>${s.blockers.map(blocker => `<li>${escape(blocker)}</li>`).join('')}</ul></div>` : ''}<details class="j-demo-tools"><summary>Opciones de sesión</summary><div class="j-tools-grid"><label class="j-field"><span>Resultado del próximo guardado</span><select id="j-save-outcome" class="j-input"><option value="success" ${state.saveOutcome === 'success' ? 'selected' : ''}>Éxito confirmado</option><option value="fail" ${state.saveOutcome === 'fail' ? 'selected' : ''}>Fallo confirmado</option><option value="unknown" ${state.saveOutcome === 'unknown' ? 'selected' : ''}>Resultado desconocido</option></select></label><label class="j-field"><span>Perfil de trabajo</span><select id="j-profile" class="j-input">${Object.entries(profiles).map(([value,label]) => `<option value="${value}" ${state.profile === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p class="j-muted">Sin inicio de sesión; los datos desaparecen al recargar.</p></div></details><div class="j-reference-links"><span>Referencias anteriores:</span><a href="cotizador-clasico/index.html" target="_blank" rel="noopener">Cotizador clásico · versión anterior</a><a href="fabricacion/index.html" target="_blank" rel="noopener">Fabricación · versión anterior</a><span>Los cambios se conservan sólo durante esta sesión.</span></div></div>${guardMarkup()}`;
    if (state.guard) footer.querySelector('.j-dialog button')?.focus();
  }

  function refreshQuoteChrome(record) {
    revealActiveSteps();
    const s = summary(record);
    const heading = root.querySelector('.j-case-head h1');
    if (heading) heading.textContent = record.request.title;
    const statusElement = root.querySelector('#j-status');
    if (statusElement) statusElement.innerHTML = pill(statuses[status(record)],accepted(record) || record.project ? 'good' : '');
    const saveText = root.querySelector('.j-save-status');
    if (saveText) { saveText.textContent = saveStatus(record); saveText.hidden = !saveText.textContent; }
    for (const container of [root,footer]) for (const stageButton of container.querySelectorAll('[data-action="stage"][data-screen]')) stageButton.disabled = !canStage(record,stageButton.dataset.screen);
    for (const actionButton of footer.querySelectorAll('[data-action="apply-pending"], [data-action="discard-pending"]')) actionButton.disabled = !s.hasPending || locked(record);
    let blockers = footer.querySelector('#j-blockers');
    if (state.screen === 'quote' && s.blockers?.length) {
      if (!blockers) { blockers = document.createElement('div'); blockers.id = 'j-blockers'; blockers.className = 'j-notice'; footer.querySelector('.j-demo-tools')?.before(blockers); }
      blockers.innerHTML = `<strong>Faltantes del cotizador</strong><ul>${s.blockers.map(blocker => `<li>${escape(blocker)}</li>`).join('')}</ul>`;
    } else blockers?.remove();
  }

  function transition(screen, id = state.id, bypass = false) {
    const record = current();
    if (!bypass && record && !globalScreens.has(state.screen) && state.screen!=='record' && (screen !== state.screen || id !== state.id)) {
      const leaving = api.leave(record.id);
      const s = summary(record);
      const continuingQuote = (screen === 'quote' || api.automaticCapture && screen === 'request') && id === state.id;
      const type = s?.saveState === 'unknown' ? 'unknown' : leaving?.ok === false || s?.hasPending ? 'pending' : !continuingQuote && !locked(record) && (s?.dirty || record.requestDirty) ? 'dirty' : null;
      if (type) { pendingTransition = {screen,id}; state.guard = type; renderFooter(); return; }
    }
    if (!globalScreens.has(screen)) {
      const nextRecord = records.find(item => item.id === id);
      if (!nextRecord) return;
      if (!canStage(nextRecord,screen)) { notify('Completa y guarda el borrador requerido antes de abrir esta etapa.','error'); return; }
      suppressChanges = true;
      try { if (screen === 'record') api.hide(); else { if (!api.open(nextRecord.id,clone(nextRecord.request))) { notify('Hay una captura pendiente en el expediente abierto.','error'); return; } if (screen === 'request' || screen === 'quote') api.showStep(screen === 'request' ? 0 : nextRecord.quoteStep || 1); else api.hide(); } }
      finally { suppressChanges = false; }
      if (screen === 'quote') nextRecord.started = true;
    } else api.hide();
    state.id = id;
    state.screen = screen;
    if(screen==='project')state.opTab='plan';
    state.menu = false;
    state.guard = null;
    state.feedback = '';
    pendingTransition = null;
    render();
    document.getElementById('j-main')?.scrollIntoView({block:'start',behavior:'auto'});
  }

  function continueTransition() {
    const target = pendingTransition;
    if (!target) return;
    state.guard = null;
    transition(target.screen,target.id);
  }

  async function saveRecord(record, resolve = false) {
    if (!record || locked(record) || state.busy) return false;
    state.busy = true;
    notify(resolve ? 'Consultando el resultado del guardado…' : 'Guardando durante esta sesión…');
    try {
      const result = await (resolve ? api.resolveSave(record.id) : api.save(record.id,state.saveOutcome));
      if (result?.ok) {
        record.requestDirty = false;
        record.review = null;
        record.reviewChecks = {technical:false,commercial:false};
        log(record,'Borrador guardado y confirmado en memoria.');
        notify('Guardado durante esta sesión.','success');
      } else if (result?.state === 'unknown' || summary(record)?.saveState === 'unknown') notify('Resultado de guardado desconocido. Consulta el resultado antes de continuar.','error');
      else notify('El guardado no se confirmó. Revisa los faltantes antes de intentarlo de nuevo.','error');
      return Boolean(result?.ok);
    } catch {
      notify('No fue posible confirmar el guardado. El borrador se conserva durante esta sesión.','error');
      return false;
    } finally { state.busy = false; render(); }
  }

  function startNewVersion(record) {
    if (record.historicalPartial) {notify('Esta referencia histórica es parcial y de sólo consulta. Reconstruirla requiere un nuevo recorrido completo; no se convierte en un guardado del motor.','error');return;}
    if (record.project) { notify('El proyecto conserva su versión aceptada; este escenario no modifica proyectos convertidos.','error'); return; }
    if (!record.sent) return;
    const oldVersion = record.sent.version;
    if (!api.revise(record.id)) { notify('Confirma el guardado y resuelve la captura pendiente antes de abrir una nueva versión.','error'); return; }
    record.version = oldVersion + 1;
    record.sent = null;
    record.review = null;
    record.reviewChecks = {technical:false,commercial:false};
    record.requestDirty = true;
    record.responseDraft = {choice:'accepted',evidence:'',exact:false,channel:'Correo de ejemplo'};
    record.started = true;
    log(record,`Nueva versión V${record.version}; se conserva el envío V${oldVersion}.`);
    transition('quote',record.id,true);
    notify(`Versión ${record.version} abierta. Debes guardar y revisar nuevamente antes de enviarla.`);
  }

  async function reset() {
    suppressChanges = true;
    try { api.reset(); }
    finally { suppressChanges = false; }
    Object.assign(state,{view:'mesa',screen:'list',id:null,search:'',filter:'all',profile:'account',saveOutcome:'success',busy:true,feedback:'',tone:'info',guard:null,menu:false,returnToKpis:false,kpis:{period:'year',category:'all',basis:'acceptedAt',tab:'summary',ranking:'client',detail:null}});
    sequence = 102;
    clockTick = 0;
    for (const id of Object.keys(clients)) if (!initialClientIds.has(id)) delete clients[id];
    pendingTransition = null;
    operationDrafts.clear();taskSequence=0;state.opTab='plan';
    await seed();
    state.busy = false;
    render();
    notify('Se restauraron los datos iniciales de la sesión.','success');
  }

  async function handleAction(target) {
    const action = target.dataset.action;
    const record = current();
    if (target.disabled || state.busy && !['stay'].includes(action)) return;
    if (action === 'toggle-menu') {
      if (state.menu) closeMenu();
      else { state.menu = true; render(); root.querySelector('.j-nav-group > summary')?.focus(); }
    }
    else if (action === 'close-menu') closeMenu();
    else if (action === 'view') { state.view = target.dataset.view; render(); }
    else if (action === 'open') { const item = records.find(entry => entry.id === target.dataset.id); transition(item?.historicalPartial ? 'record' : item?.project ? 'project' : 'request',target.dataset.id); }
    else if (action === 'list') { if (state.menu) closeMenu(); state.returnToKpis=false; transition('list'); }
    else if (['projects','production','deliveries','workflow'].includes(action)) { if(state.menu)closeMenu();state.returnToKpis=false;transition(action); }
    else if (action === 'project-open') {
      const item=records.find(entry=>entry.id===target.dataset.id&&entry.project&&!entry.historicalPartial);
      if(!item)return;
      transition('project',item.id);
      if(!state.guard&&state.screen==='project'&&state.id===item.id){
        state.opTab=operations.stages.some(stage=>stage.id===target.dataset.tab)?target.dataset.tab:'plan';
        if(!projectDraft(item).task.title)projectDraft(item).task.stage=state.opTab;
        render();
      }
    }
    else if (action === 'op-tab') {
      if(state.guard||state.screen!=='project'||!record?.project||target.dataset.id!==record.id||target.dataset.project!==record.project.id||!operations.stages.some(stage=>stage.id===target.dataset.tab))return;
      state.opTab=target.dataset.tab;
      if(!projectDraft(record).task.title)projectDraft(record).task.stage=state.opTab;
      render();root.querySelector('[data-action="op-tab"][data-tab="'+state.opTab+'"]')?.focus();
    }
    else if (action === 'op-plan-save') { if(record?.project)projectAction(target,'plan',{...projectDraft(record).plan}); }
    else if (action === 'op-task-add') { if(record?.project)projectAction(target,'task-add',{id:'OP-'+record.project.id+'-'+(++taskSequence),...projectDraft(record).task}); }
    else if (action === 'op-delivery-save') { if(record?.project)projectAction(target,'delivery',{...projectDraft(record).delivery}); }
    else if (action === 'op-close') { if(record?.project)projectAction(target,'close',{}); }
    else if (action === 'kpis' || action === 'return-kpis') {if(state.menu) closeMenu();transition('kpis');}
    else if (action === 'kpi-tab') { if (!['summary','sales','times'].includes(target.dataset.tab)) return; state.kpis.tab=target.dataset.tab;state.kpis.detail=null;render();root.querySelector('#j-kpi-tab-'+state.kpis.tab)?.focus(); }
    else if (action === 'kpi-ranking') { if (!['client','category'].includes(target.dataset.ranking)) return;state.kpis.ranking=target.dataset.ranking;render(); }
    else if (action === 'kpi-detail') {state.kpis.detail={kind:target.dataset.kind,key:target.dataset.key || ''};render();const panel=root.querySelector('#j-kpi-detail');panel?.focus();panel?.scrollIntoView({block:'nearest',behavior:'auto'});}
    else if (action === 'kpi-close') {const previous=state.kpis.detail;state.kpis.detail=null;render();Array.from(root.querySelectorAll('[data-action="kpi-detail"]')).find(control=>control.dataset.kind===previous?.kind&&(control.dataset.key || '')===(previous?.key || ''))?.focus();}
    else if (action === 'kpi-open') {state.returnToKpis=true;transition('record',target.dataset.id);}
    else if (action === 'stage') transition(target.dataset.screen);
    else if (action === 'save') await saveRecord(record);
    else if (action === 'resolve-save') await saveRecord(record,true);
    else if (action === 'apply-pending') { const ok = api.applyPending(record.id); render(); notify(ok ? 'Captura aplicada al borrador. Guarda para conservarla durante esta sesión.' : 'Revisa los campos pendientes antes de aplicar.',ok ? 'success' : 'error'); }
    else if (action === 'discard-pending') { api.discardPending(record.id); render(); notify('Se descartó la captura sin aplicar; el borrador aplicado se conserva.'); }
    else if (action === 'validate') {
      if (!saved(record) || !complete(record) || !record.reviewChecks.technical || !record.reviewChecks.commercial) { notify('Falta un borrador completo, guardado y revisado.','error'); return; }
      record.review = {revision:summary(record).revision,requestRevision:record.requestRevision,at:stamp(),profile:state.profile};
      log(record,`Revisión ilustrativa confirmada para V${record.version}.`);
      render(); notify('Revisión confirmada. Puedes preparar la oferta.','success');
    } else if (action === 'send') {
      if (record.sent || !reviewCurrent(record)) { notify('El envío requiere la versión actual guardada y revisada.','error'); return; }
      const frozen = api.freeze(record.id);
      if (!frozen?.summary || !frozen?.quote) { notify('No se pudo congelar una versión guardada.','error'); return; }
      record.sent = {version:record.version,quoteVersionId:frozen.quote.versionId,snapshot:clone(frozen),sentAt:stamp(),clientId:record.clientId,category:record.category,commercialType:record.commercialType,source:'SYNTHETIC_NATIVE_SNAPSHOT',response:null};
      if (!record.firstSentAt) record.firstSentAt=portfolio.calendarDate(record.sent.sentAt);
      record.versions.push(record.sent);
      log(record,`Envío registrado en esta sesión V${record.version}; copia congelada.`);
      render(); notify(`Envío registrado en esta sesión para V${record.version}. No se envió ningún mensaje.`, 'success');
    } else if (action === 'register-response') {
      const draft = record.responseDraft;
      if (!record.sent || record.sent.response) { notify('Esta versión no admite otra respuesta.','error'); return; }
      if (!draft.exact || draft.evidence.trim().length < 8) { notify('Confirma la versión exacta y escribe una evidencia de al menos ocho caracteres.','error'); return; }
      record.sent.response = {result:draft.choice,version:record.sent.version,evidence:draft.evidence.trim(),channel:draft.channel,at:stamp(),profile:state.profile};
      if (draft.choice === 'accepted') {record.acceptedVersion=record.sent.version;record.acceptedAt=portfolio.calendarDate(record.sent.response.at);}
      record.lastResponse = draft.choice;
      log(record,`Respuesta ${draft.choice === 'accepted' ? 'aceptada' : draft.choice === 'changes' ? 'con cambios' : 'rechazada'} para V${record.sent.version}.`);
      if (draft.choice === 'changes') startNewVersion(record);
      else { render(); notify('Respuesta registrada para la versión enviada.','success'); }
    } else if (action === 'new-version') startNewVersion(record);
    else if (action === 'convert') {
      if (record.project) { render(); return; }
      if (!accepted(record) || record.historicalPartial || !portfolio.hasPrice({netCents:record.sent?.snapshot?.summary?.priceCents})) { notify('La conversión requiere aceptación de la versión enviada exacta y un guardado completo.','error'); return; }
      record.project = {id:`PR-${record.id}`,title:record.sent.snapshot.request.title,version:record.sent.version,baseline:clone(record.sent.snapshot),sourceId:record.id,conversionKey:`${record.id}:V${record.sent.version}`,createdAt:stamp()};
      projectOperations(record);
      log(record,`Proyecto registrado en esta sesión ${record.project.id} creado desde V${record.project.version}.`);
      state.screen = 'project'; render(); notify('Conversión confirmada en memoria. Un reintento conserva el mismo proyecto.','success');
    } else if (action === 'new-request') {
      let id;
      do {id=`DEMO-${++sequence}`;} while (records.some(item => item.id === id));
      const item = makeRecord(id,'complete',{title:'Nueva solicitud de ejemplo',client:'Cliente ficticio nuevo',contact:'Contacto inventado',need:'Describe aquí la necesidad del cliente.',included:'Fabricación; Empaque',excluded:'Obra civil',account:'Account de ejemplo',designer:'Diseño de ejemplo',quoteDue:'2026-10-28',deliveryDate:'2026-11-26'});
      item.clientId='CL-'+id;
      clients[item.clientId]={name:item.request.client,firstSaleAt:null};
      suppressChanges = true;
      try { api.create(id,'complete',clone(item.request),{scopePreset:'fabrication-packaging',clientId:item.clientId,emptyArticles:true}); }
      finally { suppressChanges = false; }
      records.push(item); transition('request',id,true);
    } else if (action === 'reset') { state.guard = 'reset'; renderFooter(); }
    else if (action === 'confirm-reset') await reset();
    else if (action === 'stay') { state.guard = null; pendingTransition = null; renderFooter(); }
    else if (action === 'apply-and-leave') { api.applyPending(record.id); continueTransition(); }
    else if (action === 'discard-and-leave') { api.discardPending(record.id); continueTransition(); }
    else if (action === 'keep-and-leave') { const targetScreen = pendingTransition; state.guard = null; if (targetScreen) transition(targetScreen.screen,targetScreen.id,true); }
    else if (action === 'save-and-leave' || action === 'resolve-and-leave') { const targetScreen = pendingTransition; if (await saveRecord(record,action === 'resolve-and-leave')) { state.guard = null; if (targetScreen) transition(targetScreen.screen,targetScreen.id,true); } }
  }

  for (const container of [root,footer]) container.addEventListener('click',event => {
    const target = event.target.closest('[data-action]');
    if (!target || !container.contains(target)) return;
    handleAction(target).catch(() => notify('No se completó la acción. El expediente se conserva durante esta sesión.','error'));
  });

  root.addEventListener('input',event => {
    if(captureOperationField(event.target))return;
    if (event.target.id === 'j-search') { state.search = event.target.value; render(); }
    if (event.target.id === 'j-evidence') current().responseDraft.evidence = event.target.value;
  });

  root.addEventListener('change',event => {
    const target = event.target;
    const record = current();
    if(target.dataset?.opTask){
      if(!record?.project)return;
      projectAction({dataset:{id:record.id,project:target.dataset.opProject,revision:target.dataset.opRevision}},'task-status',{id:target.dataset.opTask,status:target.value});return;
    }
    if(captureOperationField(target))return;
    const filterKey = {'j-kpi-period':'period','j-kpi-category':'category','j-kpi-basis':'basis'}[target.id];
    if (filterKey) {state.kpis[filterKey]=target.value;render();return;}
    if (target.id === 'j-status-filter') { state.filter = target.value; render(); return; }
    if (!record) return;
    if (target.id === 'j-review-technical') { record.reviewChecks.technical = target.checked; render(); }
    if (target.id === 'j-review-commercial') { record.reviewChecks.commercial = target.checked; render(); }
    if (target.id === 'j-response-choice') record.responseDraft.choice = target.value;
    if (target.id === 'j-response-channel') record.responseDraft.channel = target.value;
    if (target.id === 'j-exact-version') record.responseDraft.exact = target.checked;
  });

  function captureOperationField(target) {
    const form=target.dataset?.opForm;
    if(!form)return false;
    const record=current();
    if(state.busy||state.guard||state.screen!=='project'||!record?.project||target.dataset.opProject!==record.project.id||projectOperations(record).closed||target.isConnected===false)return true;
    const allowed={plan:['owner','dueDate','route','installation'],task:['title','stage','owner','dueDate'],delivery:['date','recipient','evidence']};
    if(Object.hasOwn(allowed,form)&&allowed[form].includes(target.dataset.opField))projectDraft(record)[form][target.dataset.opField]=target.value;
    return true;
  }

  footer.addEventListener('change',event => {
    if (event.target.id === 'j-save-outcome') state.saveOutcome = event.target.value;
    if (event.target.id === 'j-profile') { const nextProfile = event.target.value; if (api.setProfile(nextProfile)) { state.profile = nextProfile; const profileLabel = root.querySelector('.j-sidebar-bottom strong'); if (profileLabel) profileLabel.textContent = profiles[state.profile]; notify(`Perfil seleccionado: ${profiles[state.profile]}. Sin sesión iniciada.`); } else { renderFooter(); notify('Aplica o descarta la captura pendiente y confirma el guardado antes de cambiar de perfil.','error'); } }
  });

  document.addEventListener('keydown',event => {
    const chartTarget=event.target.closest?.('[data-kpi-chart-action]');
    if (chartTarget&&root.contains(chartTarget)&&['Enter',' '].includes(event.key)) {event.preventDefault();handleAction(chartTarget).catch(()=>notify('No se pudo abrir el detalle seleccionado.','error'));return;}
    if (state.screen === 'kpis' && event.target.closest?.('[role="tablist"]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();const keys=['summary','sales','times'],position=keys.indexOf(state.kpis.tab);state.kpis.tab=event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1) : keys[(position+(event.key === 'ArrowRight' ? 1 : 2))%3];state.kpis.detail=null;render();root.querySelector('#j-kpi-tab-'+state.kpis.tab)?.focus();return;
    }
    if (!state.guard && state.menu && window.matchMedia('(max-width:750px)').matches) {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
      if (event.key === 'Tab') {
        const controls = Array.from(root.querySelectorAll('.j-sidebar summary, .j-sidebar button:not(:disabled)')).filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (!root.querySelector('.j-sidebar').contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (!state.guard) return;
    if (event.key === 'Escape') { event.preventDefault(); state.guard = null; pendingTransition = null; renderFooter(); }
    if (event.key === 'Tab') {
      const controls = Array.from(footer.querySelectorAll('.j-dialog button:not(:disabled)'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });

  api.onChange(({id, request, step, clientId} = {}) => {
    if (suppressChanges) return;
    const record = records.find(item => item.id === id);
    if (record && clientId && !locked(record)) record.clientId=clientId;
    if (record && request && !locked(record) && JSON.stringify(record.request) !== JSON.stringify(request)) { record.request = clone(request); record.requestRevision++; record.requestDirty = true; }
    if (record && !locked(record) && record.review && !reviewCurrent(record)) { record.review = null; record.reviewChecks = {technical:false,commercial:false}; }
    if (!state.busy) {
      // Native input blur precedes a click on the journey navigation. Updating
      // stable controls avoids removing the clicked button before dispatch.
      if (record && ['request','quote'].includes(state.screen) && state.id === id) {
        const screen = step === 0 ? 'request' : 'quote';
        if (step > 0) { record.quoteStep = step; record.started = true; }
        if (screen !== state.screen) { state.screen = screen; render(); }
        else refreshQuoteChrome(record);
      }
      else render();
    }
  });
  const ready=(async()=>{state.busy=true;await seed();state.busy=false;render();})();
  window.DemoJourney = Object.freeze({ready,inspect:() => clone({state,records,clients,clockTick}),portfolio:() => clone(kpiMetrics()),saveCurrent:() => saveRecord(current()),openReview:() => transition('review')});
})();
