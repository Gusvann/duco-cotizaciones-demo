/* Presentación del seguimiento local. El estado y sus cambios pertenecen a DemoOperations. */
(() => {
  'use strict';

  const operations = globalThis.DemoOperations;
  if (!operations) throw new Error('No se pudo iniciar el seguimiento de proyectos.');

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const stages = operations.stages;
  const routes = operations.routes;
  const installations = {pending:'Por definir',no:'No se requiere',duco:'A cargo de Duco',client:'A cargo del cliente'};
  const taskStatuses = {pending:'Pendiente',doing:'En curso',done:'Terminada'};
  const scope = () => `<p class="op-scope j-muted">${globalThis.DucoPrivateApi ? 'Seguimiento guardado en el equipo.' : 'Sólo durante esta sesión.'}</p>`;
  const attributes = (record, ops) => `data-id="${escape(record.id)}" data-project="${escape(record.project.id)}" data-revision="${escape(ops.revision)}"`;
  const button = (record, ops, label, action, extra = '', primary = false) => `<button type="button" class="j-btn${primary ? ' j-primary' : ''}" data-action="${action}" ${attributes(record, ops)} ${extra}>${escape(label)}</button>`;
  const options = (values, selected) => Object.entries(values).map(([value,label]) => `<option value="${escape(value)}"${selected === value ? ' selected' : ''}>${escape(label)}</option>`).join('');
  const date = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Por definir';
    const parsed = new Date(value + 'T12:00:00Z');
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return 'Por definir';
    return new Intl.DateTimeFormat('es-MX', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(parsed);
  };
  const fieldAttributes = (record, ops, form, field, locked) => `data-op-form="${form}" data-op-field="${field}" data-op-project="${escape(record.project.id)}" ${attributes(record, ops)}${locked ? ' disabled' : ''}`;
  const input = (record, ops, form, field, label, value, settings = {}) => `<label class="j-field${settings.wide ? ' op-wide' : ''}"><span>${escape(label)}</span><input class="j-input" type="${settings.type || 'text'}" ${fieldAttributes(record, ops, form, field, ops.closed)} value="${escape(value)}"${settings.maxLength ? ` maxlength="${settings.maxLength}"` : ''}${settings.placeholder ? ` placeholder="${escape(settings.placeholder)}"` : ''}></label>`;
  const select = (record, ops, form, field, label, value, values) => `<label class="j-field"><span>${escape(label)}</span><select class="j-input" ${fieldAttributes(record, ops, form, field, ops.closed)}>${options(values, value)}</select></label>`;
  const stat = (label, value) => `<div class="op-stat"><span class="j-muted">${escape(label)}</span><strong>${escape(value)}</strong></div>`;
  const row = (label, value) => `<div class="op-fact"><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;
  const portfolio = globalThis.DemoPortfolio;
  const shownFolio = project => portfolio.compactFolio(portfolio.projectFolio(project));
  const publicStatuses = new Map([['pending','Pendiente'],['in-progress','En proceso'],['completed','Concluido'],['paused','Pausado'],['cancelled','Cancelado']]);
  const publishedProjectStatus = project => publicStatuses.get(project.status) || 'Estado sin confirmar';
  const shownTitle = (project, record) => portfolio.projectTitle({
    ...project, title:project.title || project.baseline?.request?.title || record.request?.title || 'Proyecto'
  });
  function projectRows(records) {
    const projects = new Map();
    for (const record of records) {
      if (!record.project || record.historicalPartial && !record.asana) continue;
      if (!projects.has(record.project.id) || record.asana?.kind === 'project') projects.set(record.project.id,record);
    }
    return [...projects.values()];
  }
  function sourceLink(url, label) {
    try {
      const link = new URL(url);
      return link.protocol === 'https:' && !link.username && !link.password
        ? `<a href="${escape(link.href)}" rel="noopener noreferrer" target="_blank">${escape(label)}</a>` : '';
    } catch { return ''; }
  }
  const displayField = value => value == null || value === '' ? 'Pendiente' : typeof value === 'object' ? (Array.isArray(value) ? value.map(displayField).join(', ') : displayField(value.name ?? value.text ?? value.value)) : String(value);
  function sourceFields(fields) {
    const pairs = Array.isArray(fields) ? fields.map(field => [field?.name || field?.label,field?.value ?? field?.displayValue]) : Object.entries(fields || {});
    return pairs.filter(([label])=>label).map(([label,value])=>row(label,displayField(value))).join('');
  }
  function sourceDetail(source, request, options={}) {
    const sourceFolio = options.folio || source.folio || '';
    const created = portfolio.localDate(source.createdAt);
    const related = source.related || options.related;
    const links = [sourceLink(source.url,'Abrir en Asana'), sourceLink(related?.url,related?.label || 'Ver registro relacionado'),
      ...(source.links || []).map(link=>sourceLink(link?.url || link?.href || link,link?.name || link?.label || link?.title || 'Documento de origen'))].filter(Boolean);
    const subtasks = (source.subtasks || []).map(task=>{
      const title=task.name || task.title;
      if (!title) return '';
      const due=portfolio.localDate(task.dueOn || task.dueDate || task.due);
      const owner=task.assignee || task.responsible;
      const taskFacts=sourceFields(task.fields);
      const extra=task.notes || taskFacts ? `<details><summary>Detalles</summary>${task.notes ? `<p class="op-evidence">${escape(task.notes)}</p>` : ''}${taskFacts ? `<dl class="op-facts">${taskFacts}</dl>` : ''}</details>` : '';
      return `<li>${sourceLink(task.url,title) || escape(title)}<span class="j-sub"> · ${escape(task.status || (task.completed === true ? 'Terminada' : task.completed === false ? 'Pendiente' : 'Estado sin confirmar'))}${owner ? ' · '+escape(displayField(owner)) : ''}${due ? ' · '+escape(date(due)) : ''}</span>${extra}</li>`;
    }).filter(Boolean);
    const description = source.description || request.need;
    return `<section class="j-panel"><div class="j-panel-head"><div><h2>${escape(options.heading || 'Detalles de Asana')}</h2><p class="j-muted">Copia de consulta</p></div></div><dl class="op-facts">${options.displayFolio ? row('Folio',options.displayFolio) : ''}${sourceFolio ? row('Folio de origen',sourceFolio) : ''}${row('Cliente',request.client || 'Por definir')}${row('Responsable',displayField(source.assignee || request.account))}${row('Estado en Asana',displayField(source.statusLabel || source.status || options.status))}${source.section ? row('Sección',source.section) : ''}${row('Fecha de creación',date(created))}${request.quoteDue ? row('Fecha de cotización',date(request.quoteDue)) : ''}${request.deliveryDate ? row('Fecha de entrega',date(request.deliveryDate)) : ''}${sourceFields(source.fields)}</dl>${description ? `<h3 class="j-spaced">Descripción</h3><p class="op-evidence">${escape(description)}</p>` : ''}${subtasks.length ? `<h3 class="j-spaced">Subtareas</h3><ul>${subtasks.join('')}</ul>` : ''}${links.length ? `<h3 class="j-spaced">Enlaces de origen</h3><ul>${links.map(link=>'<li>'+link+'</li>').join('')}</ul>` : ''}</section>`;
  }

  function publishedProjectsMarkup(publication, query) {
    const projects = publication.projects;
    const visible = projects.map((project,index)=>({project,index}))
      .filter(({project})=>!query || portfolio.projectMatches(project,query));
    const {from,through,lists} = publication.coverage || {};
    const projectThrough = typeof lists?.project === 'string' ? lists.project : lists?.project?.through || through;
    const start = portfolio.calendarDate(from);
    const end = portfolio.calendarDate(projectThrough);
    const coverage = start && end ? 'Registros creados del '+date(start)+' al '+date(end)+'.' : '';
    const count = visible.length === projects.length
      ? visible.length+(visible.length === 1 ? ' proyecto' : ' proyectos')
      : visible.length+' de '+projects.length+' proyectos';
    const rows = visible.map(({project,index}) => {
      const status = publishedProjectStatus(project);
      const folio = portfolio.compactFolio(project.folio) || 'Sin folio registrado';
      const title = project.title || folio;
      const shownReference = title === folio ? '' : '<div class="j-sub" data-public-folio>'+escape(folio)+'</div>';
      return `<tr data-public-project-row><th scope="row"><a class="j-published-title" data-public-title href="#asana-project-${escape(publication.revision)}-${index}">${escape(title)}</a>${shownReference}</th><td><span class="op-phase">${status}</span></td><td>${escape(date(project.createdAt))}</td><td>${escape(date(project.startDate))}</td><td>${escape(date(project.dueDate))}</td><td>${escape(date(project.deliveryDate))}</td></tr>`;
    }).join('');
    const content = rows
      ? `<div class="j-table-wrap op-list-wrap j-list-table" role="region" tabindex="0" aria-labelledby="public-project-title"><table class="j-table op-list"><caption class="op-caption">Proyectos de Asana</caption><thead><tr><th scope="col">Proyecto</th><th scope="col">Estado</th><th scope="col">Creación</th><th scope="col">Inicio</th><th scope="col">Vencimiento en Asana</th><th scope="col">Entrega registrada</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="j-muted">${query ? 'Sin coincidencias para el nombre o folio.' : 'No hay proyectos publicados en este corte.'}</p>`;
    return `<section class="op-projects-source" data-public-project-list aria-labelledby="public-project-title"><header class="op-section-head"><div><h2 id="public-project-title">Proyectos de Asana</h2>${coverage ? '<p class="j-muted">'+escape(coverage)+'</p>' : ''}</div><span class="j-muted" role="status">${escape(count)}</span></header>${content}</section>`;
  }

  function list(records, screen = 'projects', search = '', {published,hasStoredRecord=()=>false} = {}) {
    const mode = ['projects','production','deliveries'].includes(screen) ? screen : 'projects';
    const tab = {projects:'plan',production:'production',deliveries:'delivery'}[mode];
    const hasPublication = Array.isArray(published?.projects);
    const browserRecords = hasPublication
      ? records.filter(record => !record.asana && !record.project?.asana && (!/^DEMO-\d+$/.test(record.id) || hasStoredRecord(record.id)))
      : records;
    const allProjects = projectRows(browserRecords);
    const query = search.trim().toLocaleLowerCase('es-MX');
    const projects = mode === 'projects' && query ? allProjects.filter(record=>portfolio.projectMatches(record.project,query,record.request?.client)) : allProjects;
    const titles = {projects:'Proyectos',production:'Producción',deliveries:'Entregas'};
    const captions = {
      production:'Consulta las tareas y los pendientes de fabricación de cada proyecto.',
      deliveries:'Consulta la preparación, el recibo y el cierre de cada entrega.'
    };
    const count = `<span class="j-muted" role="status">${projects.length} proyecto${projects.length === 1 ? '' : 's'}</span>`;
    const publishedList = mode === 'projects' && hasPublication;
    const placeholder = publishedList && !allProjects.length ? 'Nombre o folio' : 'Nombre, cliente o folio';
    const filter = `<label class="j-field j-search"><span>Buscar proyectos</span><input id="j-project-search" class="j-input" type="search" placeholder="${placeholder}" value="${escape(search)}"></label>`;
    const heading = mode === 'projects'
      ? `<header class="j-head op-projects-head"><div class="j-section-statement"><p class="j-eyebrow">Seguimiento operativo</p><h1 class="j-split-heading"><span class="j-heading-lead">${publishedList ? 'Proyectos.' : 'Tus proyectos.'}</span> <span class="j-heading-emphasis">Del plan a la entrega.</span></h1></div><div class="op-projects-list-meta">${filter}${publishedList ? '' : count}</div></header>`
      : `<header class="op-page-head"><div><h2>${titles[mode]}</h2><p class="j-muted">${captions[mode]}</p></div>${count}</header>${scope()}`;
    const publishedMarkup = publishedList ? publishedProjectsMarkup(published,query) : '';
    if (publishedList && !projects.length) return heading+publishedMarkup;
    if (!projects.length) return `${heading}<section class="j-panel op-empty"><h3>${query && allProjects.length ? 'Sin coincidencias' : 'Aún no hay proyectos'}</h3></section>`;
    const rows = projects.map(record => {
      const project = record.project;
      const ops = project.operations;
      const summary = ops ? operations.summary(ops) : null;
      const stage = mode === 'production' ? summary?.byStage.production : mode === 'deliveries' ? summary?.byStage.delivery : null;
      const progress = summary ? `${stage ? stage.done : summary.done} de ${stage ? stage.total : summary.total} terminadas` : 'Sin plan';
      const title = shownTitle(project,record);
      const client = project.baseline?.request?.client || record.request?.client || 'Cliente por definir';
      const note = !summary || summary.total === 0 ? 'Sin tareas registradas' : `${summary.pending} tarea${summary.pending === 1 ? '' : 's'} pendiente${summary.pending === 1 ? '' : 's'}`;
      const extra = mode === 'deliveries' ? ops?.delivery ? `Recibo: ${date(ops.delivery.date)}` : 'Recibo pendiente' : routes[ops?.route] || 'Ruta por definir';
      const source = project.asana || (record.asana?.kind === 'project' ? record.asana : null);
      const owner = source ? displayField(source.assignee || record.request?.account) : ops?.owner || 'Sin asignar';
      const due = source ? portfolio.localDate(source.dueOn || source.dueDate || record.request?.deliveryDate) : ops?.dueDate;
      const tasks = source?.subtasks || [];
      const open = `<button type="button" class="j-btn op-open" data-action="project-open" data-id="${escape(record.id)}" data-project="${escape(project.id)}" data-revision="${escape(ops?.revision ?? '')}" data-tab="${tab}">${escape(title)}</button>`;
      return `<tr><td>${open}<div class="j-sub">${escape(shownFolio(project))} · ${escape(client)}</div></td><td>${escape(owner)}<div class="j-sub">${escape(source ? 'Asana' : extra)}</div></td><td>${escape(date(due))}</td><td><span class="op-phase${ops?.closed ? ' op-phase-closed' : ''}">${escape(source ? source.statusLabel || source.status || source.section || 'En consulta' : summary?.phase || 'Sin plan')}</span><div class="j-sub">${escape(source ? 'Copia de consulta' : note)}</div></td><td>${escape(source ? tasks.length+' subtareas' : progress)}</td></tr>`;
    }).join('');
    const table = `<div class="j-table-wrap op-list-wrap${mode === 'projects' ? ' j-list-table' : ''}"><table class="j-table op-list"><caption class="op-caption">${publishedList ? 'Proyectos de este navegador' : titles[mode]+' de esta sesión'}</caption><thead><tr><th scope="col">Proyecto / cliente</th><th scope="col">Responsable / ${mode === 'deliveries' ? 'recibo' : 'ruta'}</th><th scope="col">Fecha objetivo</th><th scope="col">Estado</th><th scope="col">${mode === 'projects' ? 'Tareas' : titles[mode]}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    return heading+publishedMarkup+(publishedList ? `<section class="op-projects-browser" aria-labelledby="browser-project-title"><header class="op-section-head"><h2 id="browser-project-title">Proyectos de este navegador</h2>${count}</header>${table}</section>` : table);
  }

  function planMarkup(record, ops, draft) {
    const values = {...ops,...draft.plan};
    return `<section class="j-panel op-section"><h3>Plan del proyecto</h3><p class="j-muted">Plan interno: no sustituye el alcance ni las fechas de la oferta aceptada. La ruta no confirma costos; cambiar la instalación aquí tampoco cambia lo contratado.</p><div class="op-form-grid">${input(record,ops,'plan','owner','Responsable del proyecto',values.owner,{maxLength:120})}${input(record,ops,'plan','dueDate','Fecha objetivo interna',values.dueDate,{type:'date'})}${select(record,ops,'plan','route','Ruta del producto',values.route,routes)}${select(record,ops,'plan','installation','Seguimiento de instalación',values.installation,installations)}</div>${!ops.closed ? `<div class="op-actions">${button(record,ops,'Guardar plan','op-plan-save','',true)}</div>` : ''}</section>`;
  }

  function taskMarkup(record, ops, tab, draft) {
    const tasks = ops.tasks.filter(task => task.stage === tab);
    const stage = stages.find(candidate => candidate.id === tab);
    const stageOptions = Object.fromEntries(stages.map(candidate => [candidate.id,candidate.label]));
    const values = {title:'',stage:tab,owner:'',dueDate:'',...draft.task};
    const rows = tasks.map(task => `<tr><td><strong>${escape(task.title)}</strong><div class="j-sub">${escape(task.id)}</div></td><td>${escape(task.owner || 'Sin asignar')}</td><td>${escape(date(task.dueDate))}</td><td><label class="op-task-status"><span class="op-sr">Estado de ${escape(task.title)}</span><select class="j-input" data-op-task="${escape(task.id)}" data-op-project="${escape(record.project.id)}" data-op-revision="${escape(ops.revision)}" ${attributes(record,ops)}${ops.closed ? ' disabled' : ''}>${options(taskStatuses,task.status)}</select></label></td></tr>`).join('');
    const table = tasks.length ? `<div class="op-task-wrap"><table class="j-table op-tasks"><caption class="op-caption">Tareas de ${escape(stage.label.toLocaleLowerCase('es-MX'))}</caption><thead><tr><th scope="col">Tarea</th><th scope="col">Responsable</th><th scope="col">Fecha objetivo</th><th scope="col">Estado</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="op-empty j-muted">No hay tareas de ${escape(stage.label.toLocaleLowerCase('es-MX'))}. Agregarlas no crea órdenes ni gastos.</p>`;
    const form = ops.closed ? '' : `<div class="op-task-create"><h3>Agregar tarea</h3><div class="op-form-grid">${input(record,ops,'task','title','Descripción de la tarea',values.title,{wide:true,maxLength:180})}${select(record,ops,'task','stage','Etapa',values.stage,stageOptions)}${input(record,ops,'task','owner','Responsable',values.owner,{maxLength:120})}${input(record,ops,'task','dueDate','Fecha objetivo',values.dueDate,{type:'date'})}</div><div class="op-actions">${button(record,ops,'Agregar tarea','op-task-add','',true)}</div></div>`;
    return `<section class="j-panel op-section"><div class="op-section-head"><h3>Tareas · ${escape(stage.label)}</h3><span class="j-muted">${tasks.length} registrada${tasks.length === 1 ? '' : 's'}</span></div>${tab === 'supply' ? '<p class="j-muted op-context">Registra necesidades y seguimiento de materiales o servicios; las tareas no generan compras.</p>' : ''}${table}${form}</section>`;
  }

  function deliveryMarkup(record, ops, draft) {
    const delivery = ops.delivery;
    const values = {date:'',recipient:'',evidence:'',...delivery,...draft.delivery};
    const receipt = delivery ? `<section class="op-receipt" aria-label="Recibo de entrega"><h3>Entrega registrada</h3><dl class="op-facts">${row('Fecha',date(delivery.date))}${row('Recibió',delivery.recipient)}</dl><p class="j-muted op-receipt-label">Referencia de entrega</p><p class="op-evidence">${escape(delivery.evidence)}</p></section>` : '<p class="j-muted">Aún no hay un recibo de entrega.</p>';
    const form = ops.closed || delivery ? '' : `<div class="op-form-grid">${input(record,ops,'delivery','date','Fecha de entrega',values.date,{type:'date'})}${input(record,ops,'delivery','recipient','Quién recibe',values.recipient,{maxLength:120})}<label class="j-field op-wide"><span>Referencia o constancia de entrega</span><textarea class="j-input" rows="3" maxlength="600" ${fieldAttributes(record,ops,'delivery','evidence',false)} placeholder="Describe la constancia ficticia de este ejercicio.">${escape(values.evidence)}</textarea></label></div><div class="op-actions">${button(record,ops,'Registrar entrega','op-delivery-save','',true)}</div>`;
    const summary = operations.summary(ops);
    const closureNote = ops.closed ? 'El proyecto está cerrado; su seguimiento queda en consulta.' : !delivery ? 'Registra la entrega y termina las tareas antes de cerrar el proyecto.' : summary.pending ? `Quedan ${summary.pending} tareas pendientes antes del cierre.` : 'La entrega y las tareas están listas para revisar el cierre.';
    return `<section class="j-panel op-section"><h3>Recibo de entrega</h3><p class="j-muted op-context">${globalThis.DucoPrivateApi ? 'La constancia escrita se guarda en el equipo.' : 'La constancia escrita se conserva durante esta sesión.'}</p>${receipt}${form}<div class="op-closure"><p class="j-muted">${escape(closureNote)}</p>${!ops.closed ? button(record,ops,'Cerrar proyecto','op-close',`${!delivery || summary.pending || !summary.total ? 'disabled' : ''}`) : '<span class="op-phase op-phase-closed">Cerrado</span>'}</div></section>`;
  }

  function detail(record, tab = 'plan', draft = {}) {
    if (!record?.project || record.historicalPartial && !record.asana) return '<section class="j-panel op-empty"><h2>Proyecto no disponible</h2><p class="j-muted">Selecciona un proyecto para consultar su seguimiento.</p></section>';
    const project = record.project;
    const source = project.asana || (record.asana?.kind === 'project' ? record.asana : null);
    if (source) return sourceDetail(source,record.request || {},{
      heading:'Detalles del proyecto',folio:portfolio.projectFolio(project),displayFolio:shownFolio(project),related:record.asana?.kind === 'quote' ? {url:record.asana.url,label:'Ver cotización de origen'} : null
    });
    const ops = project.operations;
    if (!ops) return '<section class="j-panel op-empty"><h2>Plan pendiente</h2><p class="j-muted">No se pudo leer el seguimiento de este proyecto.</p></section>';
    const active = stages.some(stage => stage.id === tab) ? tab : 'plan';
    const summary = operations.summary(ops);
    const title = shownTitle(project,record);
    // Each tab remains a native button; counts are readable beside its label.
    const navigation = stages.map(stage => {
      const counts = summary.byStage[stage.id];
      return `<button type="button" class="j-btn op-tab" data-action="op-tab" ${attributes(record,ops)} data-tab="${stage.id}" aria-pressed="${active === stage.id}">${escape(stage.label)}<span class="op-tab-count">${escape(counts.done)}/${escape(counts.total)}</span></button>`;
    }).join('');
    const metadata = `<dl class="op-facts">${row('Solicitud',record.id)}${row('Oferta aceptada',`V${project.version}`)}${row('Cliente',project.baseline?.request?.client || record.request?.client || 'Por definir')}${row('Ruta',routes[ops.route] || 'Por definir')}${row('Instalación',installations[ops.installation] || 'Por definir')}</dl>`;
    return `<div class="op-detail"><section class="j-panel"><div class="op-detail-head"><div><p class="j-eyebrow">${escape(shownFolio(project))}</p><h2>${escape(title)}</h2></div><span class="op-phase${ops.closed ? ' op-phase-closed' : ''}">${escape(summary.phase)}</span></div>${metadata}<div class="op-stats">${stat('Responsable',ops.owner || 'Sin asignar')}${stat('Fecha objetivo',date(ops.dueDate))}${stat('Tareas terminadas',`${summary.done} de ${summary.total}`)}${stat('Pendientes',summary.total ? summary.pending : 'Sin tareas')}</div>${scope()}${ops.closed ? '<p class="op-closed-note j-muted">Proyecto cerrado. Los datos se conservan en consulta durante esta sesión.</p>' : ''}</section><nav class="op-tabs" aria-label="Seguimiento del proyecto">${navigation}</nav>${active === 'plan' ? planMarkup(record,ops,draft) : ''}${taskMarkup(record,ops,active,draft)}${active === 'delivery' ? deliveryMarkup(record,ops,draft) : ''}</div>`;
  }

  function workflow() {
    const common = [
      ['Revisión y oferta','Revisa alcance, costos, precio y fechas. Conserva la versión exacta enviada.'],
      ['Respuesta y proyecto','Registra aceptación o cambios sobre esa oferta. La aceptación permite preparar la conversión única.'],
      ['Plan y abastecimiento','Asigna responsable, fecha y tareas; da seguimiento a materiales y servicios.'],
      ['Producción e instalación','Sigue fabricación y pendientes. Incluye instalación sólo cuando corresponda al alcance.'],
      ['Entrega y cierre','Registra quién recibe, fecha y referencia de entrega. Revisa tareas y cierra el proyecto.']
    ];
    const maps = [
      ['Producto nuevo',[
        ['Llegada y solicitud','Account registra el brief, cliente, responsables y fechas.'],
        ['Definición técnica','Diseño desarrolla el artículo, medidas, materiales, procesos y despiece.'],
        ['Costeo del artículo','Revisa los importes pendientes del artículo y continúa con Costos generales y Precio.'],...common
      ]],
      ['Producto de línea',[
        ['Llegada y solicitud','Account registra el encargo y las cantidades solicitadas.'],
        ['Producto y variante','Elige una variante del catálogo y crea una copia independiente de su receta.'],
        ['Adaptación y costeo','Revisa medidas, cantidades, cambios, vigencia de referencias, costos generales y precio.'],...common
      ]]
    ];
    return `<div class="op-workflow"><div class="op-page-head"><div><h2>Del encargo a la entrega</h2><p class="j-muted">Dos puntos de partida que convergen en la misma revisión comercial y el seguimiento del proyecto.</p></div></div>${scope()}<div class="op-workflow-grid">${maps.map(([title,steps]) => `<section class="j-panel op-map"><h3>${title}</h3><ol class="op-steps">${steps.map(([label,description]) => `<li><strong>${label}</strong><p class="j-muted">${description}</p></li>`).join('')}</ol></section>`).join('')}</div><p class="j-muted op-map-note">Consultar el catálogo no agrega artículos. Cambiar una receta afecta su copia. Las referencias históricas y los costos pendientes requieren revisión; ni la aceptación ni la conversión registran pagos.</p></div>`;
  }

  globalThis.DemoProjectViews = Object.freeze({list,detail,sourceDetail,workflow,publishedProjectStatus});
})();
