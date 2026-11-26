(() => {
  'use strict';

  const domain=window.DucoGestionPreview;
  const model=domain.create();
  const $=id=>document.getElementById(id);
  const escape=input=>String(input??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const searchText=input=>String(input??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es-MX');
  const types={
    quote:{singular:'cotización',create:'Nueva cotización',eyebrow:'Portafolio comercial',
      heading:'Tus cotizaciones.',emphasis:'De la solicitud al proyecto.',
      intro:'Una solicitud, su cotización y el proyecto que resulta de ella.',
      search:'Buscar solicitudes',owner:'Responsable de cotización',statuses:domain.quoteStatuses},
    project:{singular:'proyecto',create:'Nuevo proyecto',eyebrow:'Seguimiento operativo',
      heading:'Tus proyectos.',emphasis:'Del plan a la entrega.',intro:'',
      search:'Buscar proyectos',owner:'Responsable del proyecto',statuses:domain.projectStatuses}
  };
  const views={
    mesa:window.GestionPreviewTable,
    tablero:window.GestionPreviewBoard
  };
  const people=domain.owners.map(label=>({id:label,label}));
  const personLabel=owner=>owner||'Sin asignar';
  const currentDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'});
  const calendar=new Intl.DateTimeFormat('es-MX',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
  const activityDate=new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'});
  const dateLabel=value=>value?calendar.format(new Date(value+'T12:00:00Z')):'Por definir';
  const finalStatuses=new Set(['converted','rejected','closed']);
  const dialog=$('gp-dialog');
  const state={kind:'quote',view:'mesa',query:'',status:'',owner:'',selectedId:null};
  let dialogAction=null;
  const officialPages=location.protocol==='https:' && location.host==='gusvann.github.io' &&
    location.pathname==='/duco-cotizaciones-demo/gestion.html';
  const editorAvailable=(officialPages||['localhost','127.0.0.1','[::1]'].includes(location.hostname)) &&
    typeof BroadcastChannel==='function';
  const editorLinks=new Map();
  function openQuote(record){
    if(!editorAvailable||record?.kind!=='quote'||!['request','draft'].includes(record.status))return;
    let link=editorLinks.get(record.id);
    if(!link){
      const key=crypto.randomUUID(),channel=new BroadcastChannel('duco-gestion-'+key);
      channel.onmessage=({data})=>{
        const current=model.get(record.id);
        if(data==='request'&&current?.kind==='quote'&&['request','draft'].includes(current.status))
          channel.postMessage({title:current.title,dueDate:current.dueDate,items:current.items});
      };
      link={key,channel};editorLinks.set(record.id,link);
    }
    const url=new URL('./',location.href);url.hash='gestion-'+link.key;
    window.open(url.href,'_blank','noopener');
  }

  function options(entries,current){
    return entries.map(({id,label})=>'<option value="'+escape(id)+'"'+(id===current?' selected':'')+'>'+escape(label)+'</option>').join('');
  }

  function ownerOptions(current,placeholder='Sin asignar'){
    const entries=[{id:'',label:placeholder},...people];
    if(current&&!domain.owners.includes(current))entries.push({id:current,label:current});
    return options(entries,current);
  }

  function statusOptions(record){
    const choices=types[record.kind].statuses;
    return record.status==='converted'?choices.filter(status=>status.id==='converted'):choices.filter(status=>status.id!=='converted');
  }

  function feedback(message,tone='info'){
    const output=$('gp-feedback');
    output.dataset.tone=tone;
    output.textContent=message;
  }

  function renderSummary(records,today){
    const open=records.filter(record=>!finalStatuses.has(record.status));
    const end=new Date(today+'T12:00:00Z');
    end.setUTCDate(end.getUTCDate()+7);
    const through=end.toISOString().slice(0,10);
    const overdue=open.filter(record=>record.dueDate&&record.dueDate<today).length;
    const soon=open.filter(record=>record.dueDate>=today&&record.dueDate<=through).length;
    $('gp-metrics').innerHTML=[
      ['En seguimiento',open.length,''],
      [soon===1?'Vence en 7 días':'Vencen en 7 días',soon,''],
      [overdue===1?'Vencido':'Vencidos',overdue,'gp-attention']
    ].map(([label,value,style])=>'<div class="'+style+'"><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('');
  }

  function renderResults(){
    const results=$('gp-results');
    const tableScroll=results.querySelector('.j-table-wrap')?.scrollLeft??0;
    const all=model.list(state.kind);
    const today=currentDay.format(new Date());
    const query=searchText(state.query.trim());
    const records=all.filter(record=>
      (!state.status||record.status===state.status) &&
      (!state.owner||(state.owner==='unassigned'?!record.owner:record.owner===state.owner)) &&
      (!query||searchText(record.title+' '+record.folio).includes(query))
    );
    $('gp-count').textContent=records.length+' de '+all.length+' expedientes';
    renderSummary(all,today);
    results.innerHTML=views[state.view].render({
      records,selectedId:state.selectedId,kind:state.kind, statuses:types[state.kind].statuses,
      escape,personLabel,dateLabel,today,statusOptions
    });
    const table=results.querySelector('.j-table-wrap');
    if(table&&tableScroll)table.scrollLeft=tableScroll;
  }

  function fields(record){
    return '<div class="gp-fields"><label class="j-field j-wide">Nombre<input class="j-input" name="title" maxlength="160" required value="'+escape(record?.title)+'"></label>'+
      (record?'<label class="j-field">Etapa<select class="j-input" name="status">'+options(statusOptions(record),record.status)+'</select></label>':'')+
      '<label class="j-field">Responsable<select class="j-input" name="owner">'+ownerOptions(record?.owner||'')+'</select></label>'+
      '<label class="j-field">Prioridad<select class="j-input" name="priority">'+options(domain.priorities,record?.priority||'normal')+'</select></label>'+
      '<label class="j-field">Vencimiento<input class="j-input" name="dueDate" type="date" value="'+escape(record?.dueDate)+'"></label></div>';
  }

  function taskSection(record){
    const list=record.tasks.map(task=>{
      const taskId='gp-task-'+escape(task.id);
      return '<li data-done="'+task.done+'"><input type="checkbox" id="'+taskId+'" data-task="'+escape(task.id)+'"'+(task.done?' checked':'')+'>'+
        '<label for="'+taskId+'"><span>'+escape(task.title)+'</span><small>'+escape(personLabel(task.owner))+' · '+escape(dateLabel(task.dueDate))+'</small></label></li>';
    }).join('');
    return '<section class="gp-detail-section"><header><h3>Tareas</h3><button type="button" class="gp-text-button" data-action="task">Agregar tarea</button></header>'+
      (list?'<ul class="gp-task-list">'+list+'</ul>':'<p class="j-muted">Aún no hay tareas.</p>')+'</section>';
  }

  function renderDetail(pendingFields){
    const detail=$('gp-detail');
    const record=model.get(state.selectedId);
    detail.hidden=!record;
    if(!record){detail.replaceChildren();return;}
    const related=model.get(record.kind==='quote'?record.projectId:record.quoteId);
    const link=related?'<button type="button" class="gp-text-button" data-related="'+escape(related.id)+'">'+
      escape(record.kind==='quote'?'Abrir proyecto '+related.folio:'Consultar cotización '+related.folio)+'</button>':'';
    const activity=record.activity.map(event=>'<li>'+escape(event.text)+'<small>'+escape(activityDate.format(new Date(event.at)))+'</small></li>').join('');
    detail.innerHTML='<header class="gp-detail-head"><div><p class="j-eyebrow">'+escape(record.folio)+'</p>'+
      '<h2 id="gp-detail-title" tabindex="-1">'+escape(record.title)+'</h2></div>'+
      '<button type="button" class="j-btn gp-close" aria-label="Cerrar ficha" data-action="close">×</button></header>'+
      (editorAvailable&&record.kind==='quote'&&['request','draft'].includes(record.status)?'<div class="gp-actions"><button type="button" class="j-btn j-primary" data-action="open-quote">Abrir en Cotizador</button></div>':'')+
      (record.kind==='quote' ? '<section class="gp-quote-products"><h3>Productos de la cotización</h3>'+
        (record.items.length ? window.DucoQuoteProducts.table(record.items,escape) : '<p class="j-muted">Aún no se han agregado productos.</p>')+'</section>' : '')+
      '<form id="gp-record-form">'+fields({...record,...pendingFields,status:record.status})+'<div class="gp-actions"><button type="submit" class="j-btn">Guardar cambios</button></div></form>'+
      (record.status==='accepted'?'<div class="gp-actions"><button type="button" class="j-btn j-primary" data-action="convert">Convertir en proyecto</button></div>':'')+
      (link?'<div class="gp-detail-section">'+link+'</div>':'')+(record.kind==='project'?taskSection(record):'')+
      '<section class="gp-detail-section"><header><h3>Actividad</h3><button type="button" class="gp-text-button" data-action="note">Agregar nota</button></header>'+
      '<ol class="gp-activity">'+activity+'</ol></section>';
  }

  function selectRecord(id,focus=true){
    const record=model.get(id);
    if(!record)return;
    if(state.kind!==record.kind){
      state.kind=record.kind;
      state.query=state.status=state.owner='';
      renderControls();
    }
    state.selectedId=id;
    renderDetail();
    renderResults();
    if(focus)$('gp-detail-title')?.focus();
  }

  function renderControls(){
    const type=types[state.kind];
    $('gp-eyebrow').textContent=type.eyebrow;
    $('gp-heading').textContent=type.heading;
    $('gp-emphasis').textContent=type.emphasis;
    $('gp-intro').textContent=type.intro;
    $('gp-intro').hidden=!type.intro;
    $('gp-search-label').textContent=type.search;
    $('gp-owner-label').textContent=type.owner;
    $('gp-new').textContent=type.create;
    window.GestionChrome.setKind(state.kind);
    for(const control of document.querySelectorAll('[data-view]')){
      control.setAttribute('aria-pressed',String(control.dataset.view===state.view));
    }
    $('gp-query').value=state.query;
    $('gp-status').innerHTML=options([{id:'',label:'Todas las etapas'},...type.statuses],state.status);
    $('gp-owner').innerHTML=options([{id:'',label:'Todos'},{id:'unassigned',label:'Sin asignar'},...people],state.owner);
  }

  function openDialog(action){
    const configurations={
      new:[types[state.kind].create,fields(),'Crear '+types[state.kind].singular],
      task:['Agregar tarea','<div class="gp-fields"><label class="j-field j-wide">Tarea<input class="j-input" name="title" required maxlength="160"></label>'+
        '<label class="j-field">Responsable<select class="j-input" name="owner">'+ownerOptions('')+'</select></label><label class="j-field">Vencimiento<input class="j-input" name="dueDate" type="date"></label></div>','Agregar tarea'],
      note:['Agregar nota','<div class="gp-fields"><label class="j-field j-wide">Nota<textarea class="j-input" name="note" required maxlength="600" rows="3"></textarea></label></div>','Guardar nota'],
      reset:['Reiniciar prueba','<p>Se recuperarán las cotizaciones y los proyectos de ejemplo.</p>','Reiniciar prueba']
    };
    const [title,body,submit]=configurations[action];
    dialogAction=action;
    $('gp-dialog-title').textContent=title;
    $('gp-dialog-body').innerHTML=body;
    $('gp-dialog-submit').textContent=submit;
    $('gp-dialog-error').hidden=true;
    dialog.showModal();
  }

  function perform(operation,message){
    try {
      const result=operation();
      if(message)feedback(message);
      return result;
    } catch(error){feedback(error.message,'error');return null;}
  }

  document.addEventListener('click',event=>{
    const control=event.target.closest('button');
    if(!control)return;
    const {kind,view,select,related,action}=control.dataset;
    if(kind&&types[kind]&&kind!==state.kind){
      state.kind=kind;
      state.selectedId=null;
      state.query=state.status=state.owner='';
      renderControls();renderDetail();renderResults();feedback('');
    }else if(view&&views[view]&&view!==state.view){
      state.view=view;
      renderControls();renderResults();
    }else if(select||related)selectRecord(select||related);
    else if(action==='open-quote')openQuote(model.get(state.selectedId));
    else if(['new','task','note','reset'].includes(action))openDialog(action);
    else if(action==='cancel')dialog.close();
    else if(action==='close'){
      const previous=state.selectedId;
      state.selectedId=null;renderDetail();renderResults();
      ($('gp-results').querySelector('[data-select="'+CSS.escape(previous)+'"]')||$('gp-new')).focus();
    }else if(action==='convert'){
      const created=perform(()=>model.convert(state.selectedId),'Proyecto creado y vinculado con la cotización.');
      if(created)selectRecord(created.id);
    }
  });

  $('gp-query').addEventListener('input',event=>{state.query=event.target.value;renderResults();});
  $('gp-status').addEventListener('change',event=>{state.status=event.target.value;renderResults();});
  $('gp-owner').addEventListener('change',event=>{state.owner=event.target.value;renderResults();});
  function moveRecord(id,status,preserveScroll=false){
    const updated=perform(()=>model.update(id,{status}),'Etapa actualizada.');
    if(updated?.id===state.selectedId){
      const pendingFields=Object.fromEntries(new FormData($('gp-record-form')));
      renderDetail(pendingFields);
    }
    renderResults();
    ($('gp-results').querySelector('[data-move="'+CSS.escape(id)+'"]')||$('gp-status')).focus({preventScroll:preserveScroll});
  }
  views.tablero.bindDrag($('gp-results'),(id,status)=>moveRecord(id,status,true));
  $('gp-app').addEventListener('change',event=>{
    const {move,task}=event.target.dataset;
    if(move){
      moveRecord(move,event.target.value);
    }else if(task){
      const updated=perform(()=>model.toggleTask(state.selectedId,task),'Tarea actualizada.');
      if(updated){renderResults();renderDetail();$('gp-task-'+task)?.focus();}
    }
  });

  $('gp-app').addEventListener('submit',event=>{
    if(event.target.id!=='gp-record-form')return;
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.target));
    const saved=perform(()=>model.update(state.selectedId,data),'Cambios guardados en esta prueba.');
    if(saved){renderDetail();renderResults();$('gp-detail-title')?.focus();}
  });

  $('gp-dialog-form').addEventListener('submit',event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(event.target));
    try{
      const operation=dialogAction;
      let id=state.selectedId;
      if(operation==='new')id=model.create(state.kind,data).id;
      else if(operation==='task')model.addTask(id,data);
      else if(operation==='note')model.addNote(id,data.note);
      else if(operation==='reset'){
        for(const link of editorLinks.values())link.channel.close();
        editorLinks.clear();
        model.reset();
        state.selectedId=null;state.query=state.status=state.owner='';
        renderControls();renderDetail();renderResults();
      }
      dialog.close();
      if(operation!=='reset'&&id)selectRecord(id);
      const notices={new:'Expediente creado.',task:'Tarea agregada.',note:'Nota guardada.',reset:'Se restauraron los datos de ejemplo.'};
      feedback(notices[operation]);
    }catch(error){
      const output=$('gp-dialog-error');
      output.textContent=error.message;
      output.hidden=false;
    }
  });
  dialog.addEventListener('close',()=>{dialogAction=null;});
  renderControls();
  renderResults();
})();
