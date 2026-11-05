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
  const scope = () => '<p class="op-scope j-muted">Sólo durante esta sesión. Sin compras, pagos ni movimientos reales.</p>';
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

  function list(records, screen = 'projects') {
    const mode = ['projects','production','deliveries'].includes(screen) ? screen : 'projects';
    const tab = {projects:'plan',production:'production',deliveries:'delivery'}[mode];
    const projects = records.filter(record => record.project && !record.historicalPartial);
    const titles = {projects:'Proyectos',production:'Producción',deliveries:'Entregas'};
    const captions = {
      projects:'Organiza responsables, fechas y tareas de los proyectos convertidos.',
      production:'Consulta las tareas y los pendientes de fabricación de cada proyecto.',
      deliveries:'Consulta la preparación, el recibo y el cierre de cada entrega.'
    };
    const heading = `<div class="op-page-head"><div><h2>${titles[mode]}</h2><p class="j-muted">${captions[mode]}</p></div><span class="j-muted">${projects.length} proyecto${projects.length === 1 ? '' : 's'}</span></div>${scope()}`;
    if (!projects.length) return `${heading}<section class="j-panel op-empty"><h3>Aún no hay proyectos</h3><p class="j-muted">Los expedientes aparecen aquí después de convertir una oferta aceptada.</p></section>`;
    const rows = projects.map(record => {
      const project = record.project;
      const ops = project.operations;
      const summary = ops ? operations.summary(ops) : null;
      const stage = mode === 'production' ? summary?.byStage.production : mode === 'deliveries' ? summary?.byStage.delivery : null;
      const progress = summary ? `${stage ? stage.done : summary.done} de ${stage ? stage.total : summary.total} terminadas` : 'Sin plan';
      const title = project.title || project.baseline?.request?.title || record.request?.title || 'Proyecto';
      const client = project.baseline?.request?.client || record.request?.client || 'Cliente por definir';
      const note = !summary || summary.total === 0 ? 'Sin tareas registradas' : `${summary.pending} tarea${summary.pending === 1 ? '' : 's'} pendiente${summary.pending === 1 ? '' : 's'}`;
      const extra = mode === 'deliveries' ? ops?.delivery ? `Recibo: ${date(ops.delivery.date)}` : 'Recibo pendiente' : routes[ops?.route] || 'Ruta por definir';
      return `<tr><td><button type="button" class="j-btn op-open" data-action="project-open" data-id="${escape(record.id)}" data-project="${escape(project.id)}" data-revision="${escape(ops?.revision ?? '')}" data-tab="${tab}">${escape(title)}</button><div class="j-sub">${escape(project.id)} · ${escape(client)}</div></td><td>${escape(ops?.owner || 'Sin asignar')}<div class="j-sub">${escape(extra)}</div></td><td>${escape(date(ops?.dueDate))}</td><td><span class="op-phase${ops?.closed ? ' op-phase-closed' : ''}">${escape(summary?.phase || 'Sin plan')}</span><div class="j-sub">${escape(note)}</div></td><td>${escape(progress)}</td></tr>`;
    }).join('');
    return `${heading}<div class="j-table-wrap op-list-wrap"><table class="j-table op-list"><caption class="op-caption">${titles[mode]} de esta sesión</caption><thead><tr><th scope="col">Proyecto / cliente</th><th scope="col">Responsable / ${mode === 'deliveries' ? 'recibo' : 'ruta'}</th><th scope="col">Fecha objetivo</th><th scope="col">Estado</th><th scope="col">${mode === 'projects' ? 'Tareas' : titles[mode]}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
    return `<section class="j-panel op-section"><h3>Recibo de entrega</h3><p class="j-muted op-context">Se conserva una referencia escrita durante esta sesión; no se suben archivos ni se registra un cobro.</p>${receipt}${form}<div class="op-closure"><p class="j-muted">${escape(closureNote)}</p>${!ops.closed ? button(record,ops,'Cerrar proyecto','op-close',`${!delivery || summary.pending || !summary.total ? 'disabled' : ''}`) : '<span class="op-phase op-phase-closed">Cerrado</span>'}</div></section>`;
  }

  function detail(record, tab = 'plan', draft = {}) {
    if (!record?.project || record.historicalPartial) return '<section class="j-panel op-empty"><h2>Proyecto no disponible</h2><p class="j-muted">Selecciona un proyecto convertido para consultar su seguimiento.</p></section>';
    const project = record.project;
    const ops = project.operations;
    if (!ops) return '<section class="j-panel op-empty"><h2>Plan pendiente</h2><p class="j-muted">No se pudo leer el seguimiento de este proyecto.</p></section>';
    const active = stages.some(stage => stage.id === tab) ? tab : 'plan';
    const summary = operations.summary(ops);
    const title = project.title || project.baseline?.request?.title || record.request?.title || 'Proyecto';
    // Each tab remains a native button; counts are readable beside its label.
    const navigation = stages.map(stage => {
      const counts = summary.byStage[stage.id];
      return `<button type="button" class="j-btn op-tab" data-action="op-tab" ${attributes(record,ops)} data-tab="${stage.id}" aria-pressed="${active === stage.id}">${escape(stage.label)}<span class="op-tab-count">${escape(counts.done)}/${escape(counts.total)}</span></button>`;
    }).join('');
    const metadata = `<dl class="op-facts">${row('Solicitud',record.id)}${row('Oferta aceptada',`V${project.version}`)}${row('Cliente',project.baseline?.request?.client || record.request?.client || 'Por definir')}${row('Ruta',routes[ops.route] || 'Por definir')}${row('Instalación',installations[ops.installation] || 'Por definir')}</dl>`;
    return `<div class="op-detail"><section class="j-panel"><div class="op-detail-head"><div><p class="j-eyebrow">${escape(project.id)}</p><h2>${escape(title)}</h2></div><span class="op-phase${ops.closed ? ' op-phase-closed' : ''}">${escape(summary.phase)}</span></div>${metadata}<div class="op-stats">${stat('Responsable',ops.owner || 'Sin asignar')}${stat('Fecha objetivo',date(ops.dueDate))}${stat('Tareas terminadas',`${summary.done} de ${summary.total}`)}${stat('Pendientes',summary.total ? summary.pending : 'Sin tareas')}</div>${scope()}${ops.closed ? '<p class="op-closed-note j-muted">Proyecto cerrado. Los datos se conservan en consulta durante esta sesión.</p>' : ''}</section><nav class="op-tabs" aria-label="Seguimiento del proyecto">${navigation}</nav>${active === 'plan' ? planMarkup(record,ops,draft) : ''}${taskMarkup(record,ops,active,draft)}${active === 'delivery' ? deliveryMarkup(record,ops,draft) : ''}</div>`;
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
        ['Costeo del artículo','Completa costos generales y precio; conserva los faltantes y la calidad de cada costo.'],...common
      ]],
      ['Producto de línea',[
        ['Llegada y solicitud','Account registra el encargo y las cantidades solicitadas.'],
        ['Producto y variante','Elige una variante del catálogo y crea una copia independiente de su receta.'],
        ['Adaptación y costeo','Revisa medidas, cantidades, cambios, vigencia de referencias, costos generales y precio.'],...common
      ]]
    ];
    return `<div class="op-workflow"><div class="op-page-head"><div><h2>Del encargo a la entrega</h2><p class="j-muted">Dos puntos de partida que convergen en la misma revisión comercial y el seguimiento del proyecto.</p></div></div>${scope()}<div class="op-workflow-grid">${maps.map(([title,steps]) => `<section class="j-panel op-map"><h3>${title}</h3><ol class="op-steps">${steps.map(([label,description]) => `<li><strong>${label}</strong><p class="j-muted">${description}</p></li>`).join('')}</ol></section>`).join('')}</div><p class="j-muted op-map-note">Consultar el catálogo no agrega artículos. Cambiar una receta afecta su copia. Las referencias históricas y los costos pendientes requieren revisión; ni la aceptación ni la conversión registran pagos.</p></div>`;
  }

  globalThis.DemoProjectViews = Object.freeze({list,detail,workflow});
})();
