/* Operaciones manuales de demostración. Estado local puro, sin permisos reales.
 * Cerrar exige recepción y tareas terminadas sólo para este recorrido DEMO;
 * no define una política empresarial ni acredita pagos, costos o aceptación real.
 */
(function(global) {
  'use strict';
  const stages=Object.freeze([
    Object.freeze({id:'plan',label:'Planeación'}),
    Object.freeze({id:'supply',label:'Abastecimiento'}),
    Object.freeze({id:'production',label:'Producción'}),
    Object.freeze({id:'delivery',label:'Entrega'})
  ]);
  const routes=Object.freeze({new:'Producto nuevo',line:'Producto de línea',mixed:'Mixto',undetermined:'Por definir'});
  const installations=['pending','no','duco','client'];
  const statuses=['pending','doing','done'];
  const types=['plan','task-add','task-status','delivery','close'];
  const stateKeys=['projectId','sourceId','version','revision','route','owner','dueDate','installation','tasks','delivery','closed','events'];
  const taskKeys=['id','title','stage','owner','dueDate','status'];
  const eventKeys=['revision','type','projectId','resourceId','at','actor','message'];
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const keys=(value,allowed,required=allowed)=>object(value)&&Object.getOwnPropertySymbols(value).length===0&&
    Object.keys(value).every(key=>allowed.includes(key))&&required.every(key=>Object.hasOwn(value,key));
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
  const text=(value,max,{empty=false,multiline=false}={})=>typeof value==='string'&&value.length<=max&&
    (empty&&value===''||value.trim().length>0)&&!(multiline?/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/:/[\u0000-\u001f\u007f]/).test(value);
  const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
  function date(value,empty=false) {
    if(empty&&value==='')return true;
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.slice(0,4)==='0000')return false;
    const parsed=new Date(value+'T00:00:00.000Z');
    return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;
  }
  function timestamp(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!date(value.slice(0,10)))return false;
    const parsed=new Date(value),normalized=value.includes('.')?value:value.replace('Z','.000Z');
    return Number.isFinite(parsed.valueOf())&&parsed.toISOString()===normalized;
  }
  const route=value=>typeof value==='string'&&Object.hasOwn(routes,value);
  const stage=value=>stages.some(row=>row.id===value);
  const validTask=value=>keys(value,taskKeys)&&id(value.id)&&text(value.title,180)&&stage(value.stage)&&
    text(value.owner,120,{empty:true})&&date(value.dueDate,true)&&statuses.includes(value.status);
  const validDelivery=value=>keys(value,['date','recipient','evidence'])&&date(value.date)&&
    text(value.recipient,120)&&text(value.evidence,600,{multiline:true});
  function validState(value) {
    if(!keys(value,stateKeys)||!id(value.projectId)||!id(value.sourceId)||!integer(value.version,1)||
      !integer(value.revision)||!route(value.route)||!text(value.owner,120,{empty:true})||!date(value.dueDate,true)||
      !installations.includes(value.installation)||typeof value.closed!=='boolean'||!Array.isArray(value.tasks)||
      !value.tasks.every(validTask)||new Set(value.tasks.map(task=>task.id)).size!==value.tasks.length||
      value.delivery!==null&&!validDelivery(value.delivery)||!Array.isArray(value.events)||value.revision!==value.events.length)return false;
    if(value.closed&&(!value.delivery||!value.tasks.length||value.tasks.some(task=>task.status!=='done')))return false;
    return value.events.every((event,index)=>keys(event,eventKeys)&&event.revision===index+1&&types.includes(event.type)&&
      event.projectId===value.projectId&&id(event.resourceId)&&timestamp(event.at)&&text(event.actor,120)&&text(event.message,240)&&
      (event.type.startsWith('task-')?value.tasks.some(task=>task.id===event.resourceId):event.resourceId===value.projectId));
  }
  function copy(value) {
    return {...value,tasks:value.tasks.map(task=>({...task})),delivery:value.delivery?{...value.delivery}:null,events:value.events.map(event=>({...event}))};
  }
  function create(project,options={}) {
    if(!object(project)||!id(project.id)||!id(project.sourceId)||!integer(project.version,1)||project.historicalPartial===true||
      !object(project.baseline)||!object(project.baseline.quote)||project.baseline.quote.id!==project.sourceId||
      !id(project.baseline.quote.versionId)||!object(project.baseline.summary)||project.baseline.summary.complete!==true||
      !integer(project.baseline.summary.priceCents)||!keys(options,['route'],[])||Object.hasOwn(options,'route')&&!route(options.route))
      throw new TypeError('Se requiere un proyecto con identidad y presupuesto base completos para crear operaciones de demostración.');
    return {projectId:project.id,sourceId:project.sourceId,version:project.version,revision:0,route:options.route??'undetermined',
      owner:'',dueDate:'',installation:'pending',tasks:[],delivery:null,closed:false,events:[]};
  }
  function apply(state,command) {
    if(!validState(state))return {ok:false,code:'INVALID_STATE',message:'El estado de operaciones no es válido.',state};
    const next=copy(state);
    const result=(ok,code,message)=>({ok,code,message,state:next});
    const fail=(code,message)=>result(false,code,message);
    if(!keys(command,['projectId','expectedRevision','type','payload','at','actor']))return fail('INVALID_COMMAND','La acción no tiene el contrato esperado.');
    if(command.projectId!==state.projectId)return fail('PROJECT_MISMATCH','La acción no corresponde a este proyecto.');
    if(!integer(command.expectedRevision)||command.expectedRevision!==state.revision)return fail('STALE_REVISION','El proyecto cambió; consulta su estado actual antes de reintentar.');
    if(!types.includes(command.type)||!timestamp(command.at)||!text(command.actor,120))return fail('INVALID_COMMAND','Revisa el tipo de acción, la fecha y el perfil ilustrativo.');
    if(state.closed)return fail('CLOSED','Este proyecto de demostración está cerrado y permanece en consulta.');
    if(state.revision===Number.MAX_SAFE_INTEGER)return fail('REVISION_LIMIT','La revisión no admite otra operación.');
    const payload=command.payload;
    const noChange=()=>result(true,'NO_CHANGE','La misma operación ya está registrada.');
    let resourceId=state.projectId,message='';
    if(command.type==='plan') {
      if(!keys(payload,['owner','dueDate','route','installation'])||!text(payload.owner,120)||!date(payload.dueDate)||
        !route(payload.route)||!installations.includes(payload.installation))return fail('INVALID_INPUT','Completa responsable, fecha válida, ruta e instalación.');
      if(['owner','dueDate','route','installation'].every(key=>state[key]===payload[key]))return noChange();
      for(const key of ['owner','dueDate','route','installation'])next[key]=payload[key];
      message='Planeación actualizada en esta sesión.';
    } else if(command.type==='task-add') {
      if(!keys(payload,['id','title','stage','owner','dueDate'],['id','title','stage'])||!id(payload.id)||!text(payload.title,180)||
        !stage(payload.stage)||Object.hasOwn(payload,'owner')&&!text(payload.owner,120,{empty:true})||
        Object.hasOwn(payload,'dueDate')&&!date(payload.dueDate,true))return fail('INVALID_INPUT','Revisa identificador, nombre, etapa, responsable y fecha de la tarea.');
      const task={id:payload.id,title:payload.title,stage:payload.stage,owner:payload.owner??'',dueDate:payload.dueDate??'',status:'pending'};
      const existing=state.tasks.find(row=>row.id===task.id);
      if(existing)return ['id','title','stage','owner','dueDate'].every(key=>existing[key]===task[key])?noChange():fail('TASK_CONFLICT','Ese identificador ya corresponde a otra tarea del proyecto.');
      next.tasks.push(task);resourceId=task.id;message='Tarea manual agregada en esta sesión.';
    } else if(command.type==='task-status') {
      if(!keys(payload,['id','status'])||!id(payload.id)||!statuses.includes(payload.status))return fail('INVALID_INPUT','Revisa la identidad y el estado de la tarea.');
      const task=next.tasks.find(row=>row.id===payload.id);
      if(!task)return fail('TASK_NOT_FOUND','La tarea no pertenece a este proyecto.');
      if(task.status===payload.status)return noChange();
      task.status=payload.status;resourceId=task.id;message='Estado de la tarea actualizado en esta sesión.';
    } else if(command.type==='delivery') {
      if(!validDelivery(payload))return fail('INVALID_INPUT','Indica una fecha real, receptor y evidencia breve de la recepción.');
      if(state.delivery)return ['date','recipient','evidence'].every(key=>state.delivery[key]===payload[key])?noChange():fail('DELIVERY_EXISTS','Ya existe una recepción; no se reemplaza su evidencia.');
      next.delivery={date:payload.date,recipient:payload.recipient,evidence:payload.evidence};message='Recepción registrada en esta sesión.';
    } else {
      if(!keys(payload,[]))return fail('INVALID_INPUT','El cierre no admite datos adicionales.');
      if(!state.delivery)return fail('DELIVERY_REQUIRED','Registra la recepción antes de cerrar el ejemplo.');
      if(!state.tasks.length)return fail('TASKS_REQUIRED','El cierre de este ejemplo requiere tareas manuales registradas.');
      if(state.tasks.some(task=>task.status!=='done'))return fail('TASKS_PENDING','Termina las tareas del ejemplo antes de cerrar.');
      next.closed=true;message='Proyecto de demostración cerrado en esta sesión.';
    }
    next.revision++;
    next.events.push({revision:next.revision,type:command.type,projectId:state.projectId,resourceId,at:command.at,actor:command.actor,message});
    return result(true,'APPLIED',message);
  }
  function summary(state) {
    if(!validState(state))throw new TypeError('El estado de operaciones no es válido.');
    const byStage={};
    for(const item of stages) {
      const tasks=state.tasks.filter(task=>task.stage===item.id),done=tasks.filter(task=>task.status==='done').length;
      byStage[item.id]={label:item.label,done,total:tasks.length,pending:tasks.length-done};
    }
    const total=state.tasks.length,done=state.tasks.filter(task=>task.status==='done').length;
    const active=stages.find(item=>byStage[item.id].pending>0);
    const phase=state.closed?'Cerrado':active?active.label:state.delivery?'Entrega registrada':total?'Entrega pendiente':state.owner?'Planeación':'Por planear';
    return {phase,done,total,pending:total-done,byStage};
  }
  global.DemoOperations=Object.freeze({create,apply,summary,stages,routes});
})(globalThis);
