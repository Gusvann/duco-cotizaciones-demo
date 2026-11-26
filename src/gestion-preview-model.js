/* Modelo en memoria con expedientes ficticios para la vista previa de Gestión DUCO. */
(() => {
  'use strict';

  const options = entries => Object.freeze(entries.map(([id, label]) => Object.freeze({id, label})));
  const quoteStatuses = options([
    ['request', 'Solicitud'],
    ['draft', 'En cotización'],
    ['review', 'En revisión'],
    ['sent', 'Enviada'],
    ['accepted', 'Aceptada'],
    ['rejected', 'Rechazada'],
    ['converted', 'Proyecto']
  ]);
  const projectStatuses = options([
    ['plan', 'Planeación'],
    ['supply', 'Abastecimiento'],
    ['production', 'Producción'],
    ['delivery', 'Entrega'],
    ['closed', 'Cerrado']
  ]);
  const priorities = options([
    ['low', 'Baja'],
    ['normal', 'Normal'],
    ['high', 'Alta']
  ]);
  const owners = Object.freeze(['Comercial', 'Diseño', 'Producción', 'Operaciones']);
  const types = new Map([
    ['quote', {statuses:quoteStatuses, prefix:'COT'}],
    ['project', {statuses:projectStatuses, prefix:'PR'}]
  ]);
  const mexicoDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'});

  const exampleQuotes = [
    ['Mobiliario para sala de lectura', 'request', 'Comercial', 9, 'normal', [
      ['Mesa Florencia · Tzalam', 2], ['Banca de lectura', 4]
    ]],
    ['Señalética para recepción', 'request', '', 3, 'low'],
    ['Mesa de trabajo modular', 'draft', 'Diseño', -2, 'high', [['Mesa de trabajo modular', 3]]],
    ['Bancas para vestíbulo', 'draft', 'Comercial', 4, 'normal', [['Banca recta', 2], ['Banca esquinera', 1]]],
    ['Gabinetes para estudio creativo', 'review', 'Diseño', 1, 'high', [['Gabinete bajo', 4]]],
    ['Mostrador para tienda temporal', 'sent', 'Comercial', 7, 'normal', [['Mostrador de recepción', 1]]],
    ['Cubiertas para cafetería', 'accepted', 'Comercial', 14, 'normal', [['Cubierta redonda Ø61 cm · Tzalam', 6], ['Cubierta cuadrada 61 × 61 cm · Encino rojo', 2]]],
    ['Exhibidor modular', 'rejected', 'Comercial', null, 'low', [['Exhibidor modular', 1]]],
    ['Estaciones de trabajo para biblioteca', 'accepted', 'Operaciones', 21, 'normal', [['Estación de trabajo doble', 3]]]
  ];
  const exampleProjects = [
    ['Biblioteca de muestras', 'plan', 'Diseño', 12, 'normal', [
      ['Validar planos con el equipo', 'Diseño', 3, false],
      ['Confirmar alcance y fechas', 'Operaciones', 1, true]
    ]],
    ['Barras para sala común', 'supply', 'Operaciones', 20, 'normal', [
      ['Confirmar existencias de madera', 'Operaciones', 4, false]
    ]],
    ['Paneles para sala de juntas', 'production', 'Producción', -1, 'high', [
      ['Cortar componentes', 'Producción', -5, true],
      ['Revisar acabado antes de empacar', 'Producción', -2, false]
    ]],
    ['Estanterías de archivo', 'delivery', 'Operaciones', 2, 'high', [
      ['Preparar despacho', 'Operaciones', 0, false]
    ]],
    ['Mesas auxiliares de exposición', 'closed', 'Producción', -7, 'low', [
      ['Registrar recepción de piezas', 'Operaciones', -7, true]
    ]]
  ];

  const copy = record => ({
    ...record,
    ...(record.kind==='quote'?{items:record.items.map(item=>({...item}))}:{}),
    tasks:record.tasks.map(task => ({...task})),
    activity:record.activity.map(event => ({...event}))
  });
  function typeOf(kind) {
    const type = types.get(kind);
    if (!type) throw new Error('Elige cotización o proyecto.');
    return type;
  }

  function text(value, label, max, required=false) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw new Error(label+' debe tener hasta '+max+' caracteres.');
    }
    const result=value.trim();
    if (required&&!result) throw new Error('Escribe '+label.toLocaleLowerCase('es-MX')+'.');
    return result;
  }

  function date(value) {
    if (value==='' || value==null) return '';
    if (typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed=new Date(value+'T00:00:00Z');
      if (Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===value)return value;
    }
    throw new Error('Selecciona una fecha válida.');
  }

  function labelOf(values, id, message) {
    const item=values.find(value => value.id===id);
    if (!item) throw new Error(message);
    return item.label;
  }

  function recordFields(fields, existing={title:'',owner:'',dueDate:'',priority:'normal'}) {
    const result={
      title:text(fields.title??existing.title,'El título',160,true),
      owner:text(fields.owner??existing.owner,'El responsable',80),
      dueDate:date(fields.dueDate??existing.dueDate),
      priority:fields.priority??existing.priority
    };
    labelOf(priorities,result.priority,'Selecciona una prioridad válida.');
    return result;
  }

  function create(now=()=>new Date()) {
    const records=new Map();
    const sequence={quote:0,project:0};
    let taskSequence=0,eventSequence=0;

    function recordFor(id) {
      const record=records.get(id);
      if(!record)throw new Error('El expediente de prueba ya no está disponible.');
      return record;
    }

    function activity(record, message) {
      record.activity.unshift({id:'EV-'+(++eventSequence),text:message,at:now().toISOString()});
    }

    function addRecord(kind, fields, status=typeOf(kind).statuses[0].id) {
      const {prefix}=typeOf(kind);
      const parsed=recordFields(fields);
      const index=++sequence[kind];
      const record={id:kind+'-'+index,kind,folio:prefix+'-'+String(index).padStart(3,'0'),...parsed,
        status,tasks:[],activity:[],projectId:null,quoteId:null};
      if(kind==='quote')record.items=[];
      activity(record,kind==='quote'?'Se creó la cotización.':'Se creó el proyecto.');
      records.set(record.id,record);
      return record;
    }

    function addTaskTo(record, fields, done=false) {
      const title=text(fields.title??'','El nombre de la tarea',160,true);
      const owner=text(fields.owner??'','El responsable',80);
      const dueDate=date(fields.dueDate);
      record.tasks.push({id:'T-'+(++taskSequence),title,owner,dueDate,done});
      activity(record,'Se agregó la tarea «'+title+'».');
    }

    function update(id, fields={}) {
      const record=recordFor(id);
      const next=recordFields(fields,record);
      const status=fields.status??record.status;
      const statusLabel=labelOf(typeOf(record.kind).statuses,status,'Selecciona un estado válido para este expediente.');
      if (status!==record.status&&[status,record.status].includes('converted')) {
        throw new Error('El estado Proyecto corresponde a una cotización vinculada con su proyecto.');
      }
      const changes=[];
      if(next.title!==record.title)changes.push('se actualizó el título');
      if(next.owner!==record.owner)changes.push(next.owner?'se asignó a '+next.owner:'se dejó sin responsable');
      if(next.dueDate!==record.dueDate)changes.push(next.dueDate?'vencimiento '+next.dueDate:'se retiró el vencimiento');
      if(next.priority!==record.priority)changes.push('prioridad '+labelOf(priorities,next.priority,'').toLocaleLowerCase('es-MX'));
      if(status!==record.status)changes.push('estado «'+statusLabel+'»');
      if(changes.length){
        Object.assign(record,next,{status});
        activity(record,changes[0].charAt(0).toUpperCase()+changes[0].slice(1)+
          (changes.length>1?' · '+changes.slice(1).join(' · '):'')+'.');
      }
      return copy(record);
    }

    function convert(id) {
      const quote=recordFor(id);
      if(quote.kind!=='quote')throw new Error('Selecciona una cotización para crear su proyecto.');
      if(quote.projectId)return copy(recordFor(quote.projectId));
      if(quote.status!=='accepted')throw new Error('La cotización debe estar aceptada para crear un proyecto.');
      const project=addRecord('project',quote);
      project.quoteId=quote.id;
      quote.projectId=project.id;
      quote.status='converted';
      activity(project,'Se creó desde la cotización '+quote.folio+'.');
      activity(quote,'Se vinculó el proyecto '+project.folio+'.');
      return copy(project);
    }

    function reset() {
      records.clear();
      sequence.quote=0;
      sequence.project=0;
      taskSequence=0;
      eventSequence=0;
      const today=mexicoDay.format(now());
      const relative=offset=>{
        if(offset===null)return '';
        const when=new Date(today+'T12:00:00Z');
        when.setUTCDate(when.getUTCDate()+offset);
        return when.toISOString().slice(0,10);
      };
      for(const [title,status,owner,offset,priority,items=[]] of exampleQuotes){
        const quote=addRecord('quote',{title,owner,priority,dueDate:relative(offset)},status);
        quote.items=items.map(([description,quantity])=>({description,quantity,unit:'Pieza'}));
      }
      for(const [title,status,owner,offset,priority,tasks] of exampleProjects){
        const project=addRecord('project',{title,owner,priority,dueDate:relative(offset)},status);
        for(const [title,owner,offset,done] of tasks)addTaskTo(project,{title,owner,dueDate:relative(offset)},done);
      }
      const project=convert('quote-9');
      addTaskTo(recordFor(project.id),{title:'Preparar reunión de arranque',owner:'Operaciones',dueDate:relative(5)});
    }

    reset();
    return Object.freeze({
      list(kind){
        if(kind!==undefined)typeOf(kind);
        return Array.from(records.values()).filter(record=>kind===undefined||record.kind===kind).map(copy);
      },
      get(id){const record=records.get(id);return record?copy(record):null;},
      create(kind,fields={}){return copy(addRecord(kind,fields));},
      update,
      addTask(id,fields={}){
        const record=recordFor(id);
        addTaskTo(record,fields);
        return copy(record);
      },
      toggleTask(id,taskId){
        const record=recordFor(id);
        const task=record.tasks.find(item=>item.id===taskId);
        if(!task)throw new Error('La tarea seleccionada no corresponde a este expediente.');
        task.done=!task.done;
        activity(record,(task.done?'Se completó':'Se reabrió')+' la tarea «'+task.title+'».');
        return copy(record);
      },
      addNote(id,value){
        const record=recordFor(id);
        activity(record,text(value??'','La nota',600,true));
        return copy(record);
      },
      convert,
      reset
    });
  }

  globalThis.DucoGestionPreview=Object.freeze({create,quoteStatuses,projectStatuses,priorities,owners});
})();
