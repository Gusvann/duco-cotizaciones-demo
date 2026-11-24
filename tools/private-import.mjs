import {createHash} from 'node:crypto';

export const coverageStart = '2026-10-01';
export const coverageEnd = '2026-11-30';
const zone = 'America/Mexico_City';
const localDate = new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit'});
const value = input => typeof input === 'string' ? input.trim() : '';
const normalized = input => value(input).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function calendarDay(input) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input || '')) {
    const day = new Date(input+'T00:00:00Z');
    return Number.isFinite(+day) && day.toISOString().slice(0,10) === input ? input : '';
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(input || '')) return '';
  const instant = new Date(input);
  if (!Number.isFinite(+instant)) return '';
  const parts = Object.fromEntries(localDate.formatToParts(instant).map(part => [part.type,part.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
}

export function parseCsv(source) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const finish = () => { row.push(field); field = ''; closed = false; };
  for (let i = source.charCodeAt(0) === 0xfeff ? 1 : 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === ',') finish();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && source[i+1] === '\n') i++;
      finish();
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('CSV con comillas inválidas.');
    else field += c;
  }
  if (quoted) throw new Error('CSV con campo sin cerrar.');
  if (row.length || field || closed) { finish(); rows.push(row); }
  const headers = rows.shift()?.map(value);
  if (!headers || headers.some(header=>!header) || new Set(headers).size !== headers.length)
    throw new Error('Encabezados inválidos en CSV.');
  if (rows.some(row => row.length !== headers.length)) throw new Error('CSV con filas de ancho distinto.');
  return {headers, rows:rows.map(row=>Object.fromEntries(headers.map((header,i)=>[header,row[i]])))};
}

function evidenceLink(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
const idOK = id => /^\d{5,24}$/.test(id);
const reference = (project,id) => 'https://app.asana.com/0/'+project+'/'+id;
const strip = text => value(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const safeId = raw => createHash('sha256').update(raw).digest('hex').slice(0,24);

function labelOf(row,...labels) {
  const keys = new Map(Object.keys(row).map(key=>[normalized(key),key]));
  return labels.map(label=>value(row[keys.get(normalized(label))])).find(Boolean)||'';
}
function statusKey(label) {
  const keys=normalized(label).split(',').map(value);
  const mapping={
    'solicitud':'request','solicitada':'request','nueva':'request','pendiente':'request',
    'borrador':'draft','en cotizacion':'draft','en proceso':'draft','en revision':'review','revisada':'review',
    'enviada':'sent','enviado':'sent','en espera de aprobacion':'waiting','pausada por cliente':'paused',
    'aceptada':'accepted','aceptado':'accepted',
    'cambios solicitados':'changes','solicitud de cambios':'changes','rechazada':'rejected','rechazado':'rejected',
    'no aprobada':'rejected','cancelada':'rejected','proyecto':'project','convertida':'project','venta - proyecto':'project'
  };
  const states=keys.map(key=>mapping[key]).filter(Boolean);
  return ['project','rejected','accepted','changes','paused','waiting','sent','review','draft','request'].find(key=>states.includes(key))||'';
}
const categories = new Map(Object.entries({'horeca':'horeca','oficinas':'offices','marcas de diseno':'brands',
  'laboratorio de diseno':'lab','residencial':'residential','retail':'retail','logistica y envios':'logistics','arquitectonico':'architecture'}));
const baseHeaders = new Set(['Task ID','Created At','Last Modified','Name','Section/Column','Assignee','Assignee Email',
  'Notes','Projects','Parent task','Task URL']);
function fields(row) {
  return Object.fromEntries(Object.entries(row).filter(([key,cell])=>!baseHeaders.has(key)&&value(cell)).map(([key,cell])=>[key,strip(cell)]));
}
const explicitDay = (row, ...labels) => calendarDay(labelOf(row,...labels)) || null;
function netCents(row) {
  const candidate = labelOf(row,'Importe aceptado sin IVA MXN','Precio aceptado sin IVA MXN','Importe aceptado sin IVA');
  const currency = labelOf(row,'Moneda','Divisa');
  if (!labelOf(row,'Importe aceptado sin IVA MXN','Precio aceptado sin IVA MXN') && normalized(currency)!=='mxn') return null;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(candidate)) return null;
  const [whole,decimal=''] = candidate.replaceAll(',','').split('.');
  const cents = BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'));
  return cents<=BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

export function asanaList(source, {kind, projectId, from=coverageStart, through=coverageEnd}) {
  const {headers,rows} = parseCsv(source);
  if (!['project','quote'].includes(kind) || !idOK(projectId) || !calendarDay(from) || !calendarDay(through) || from>through ||
      !['Task ID','Created At','Name','Parent task'].every(header=>headers.includes(header)))
    throw new Error('La exportación de Asana no corresponde al esquema esperado.');
  const all = new Map();
  for(const row of rows) {
    if(!idOK(row['Task ID']) || all.has(row['Task ID'])) throw new Error('Tarea de Asana con identificador inválido o repetido.');
    all.set(row['Task ID'],row);
  }
  const children = new Map();
  const nameCounts = new Map();
  for(const row of rows) nameCounts.set(row.Name,(nameCounts.get(row.Name)||0)+1);
  const byName = new Map(rows.filter(row=>nameCounts.get(row.Name)===1).map(row=>[row.Name,row['Task ID']]));
  for(const row of rows) {
    const parent = value(row['Parent task']);
    const parentId = all.has(parent) ? parent : byName.get(parent);
    if (!parentId || parentId===row['Task ID']) continue;
    if (!children.has(parentId)) children.set(parentId,[]);
    children.get(parentId).push({id:row['Task ID'],name:strip(row.Name),responsible:value(row.Assignee),
      createdAt:calendarDay(row['Created At']),notes:strip(row.Notes),url:reference(projectId,row['Task ID']),fields:fields(row)});
  }
  const records = [];
  let undated = 0;
  for(const row of rows) {
    if (value(row['Parent task'])) continue;
    const day = calendarDay(row['Created At']);
    if (!day) { undated++; continue; }
    if (day<from || day>through) continue;
    const id = row['Task ID'];
    const title = strip(row.Name);
    const nameFolio = /^(?:\(\$\)\s*)?((?:\d{2}(?:0[1-9]|1[0-2]))-?\d{2,4})(?!\d)/.exec(title)?.[1] || '';
    const folio = labelOf(row,kind==='project'?'FOLIO PROYECTO':'FOLIO COTIZACIÓN') || nameFolio || labelOf(row,'FOLIO SIN GUION');
    const statusLabel = labelOf(row,'ESTATUS COTIZACION','STATUS','Estado','Estatus');
    const client = labelOf(row,'CLIENTE');
    const clientIdentity = labelOf(row,'Cliente_ID','ID Cliente');
    const ownerEmail = labelOf(row, 'Assignee Email');
    const responsible = labelOf(row,'Responsable de cotización','Assignee');
    // The exported CLIENTE field is a filter label within Asana. A source-scoped
    // identity keeps it searchable without joining it to a separate sales ledger.
    const clientId = clientIdentity && /^[A-Za-z0-9_-]{1,120}$/.test(clientIdentity) ? clientIdentity :
      client ? 'AS-CLIENT-'+safeId(client.normalize('NFC')) : '';
    const category=categories.get(normalized(labelOf(row,'CATEGORÍAS','Categoría'))) || null;
    const type = normalized(labelOf(row,'Tipo comercial','Tipo de cotización'));
    const commercialType = type==='producto de linea' ? 'line' : ['proyecto','proyecto nuevo'].includes(type) ? 'project' : null;
    const dependency = labelOf(row,kind==='quote'?'URL Proyecto':'URL Cotización',kind==='quote'?'Proyecto relacionado':'Cotización relacionada');
    const linkId = /(?:asana\.com\/[^\s?#]*\/)(\d+)(?:[/?#]|$)/.exec(dependency)?.[1] || '';
    const links = [...new Set([dependency,...(row.Notes||'').match(/https:\/\/[^\s<>"']+/g)||[]].map(evidenceLink).filter(Boolean))];
    const request = {title,client,account:responsible,designer:'',need:strip(row.Notes),quoteDue:calendarDay(row['Due Date']),deliveryDate:explicitDay(row,'FECHA COMPROMISO/ REAL','Fecha real de entrega')};
    const asana = {id,kind,createdAt:row['Created At'],url:evidenceLink(row['Task URL']) || reference(projectId,id),
      section:value(row['Section/Column']),fields:fields(row),subtasks:children.get(id)||[],links,declaredLinks:links,description:request.need,
      statusLabel,linkId,projectFolio:kind==='quote'?labelOf(row,'FOLIO PROYECTO'):'',commercial:{requestedAt:explicitDay(row,'Fecha Solicitud'),firstSentAt:explicitDay(row,'Fecha primer envío','Fecha Envío'),
        acceptedAt:explicitDay(row,'Fecha Aceptación'),poAt:explicitDay(row,'Fecha Anticipo','Fecha PO'),netCents:netCents(row)}};
    const localId = 'ASANA-'+kind.toUpperCase()+'-'+id;
    records.push({id:localId,folio,request,clientId,category,commercialType,requestedAt:asana.commercial.requestedAt,
      responsibleId:ownerEmail ? 'AS-OWNER-'+safeId(normalized(ownerEmail)) : '',importedStatus:statusKey(statusLabel),statusEnteredAt:explicitDay(row,'Fecha entrada al estado','Fecha cambio de estado'),
      source:'ASANA_IMPORT',history:[],versions:[],asana,
      ...(kind==='project'?{project:{id:localId,title,folio,sourceId:localId,createdAt:day,asana}}:{})});
  }
  return {records,undated};
}

export function connectAsana(records) {
  // Rebuild relationships from origin evidence every time either list is imported.
  // A relation computed in an earlier cut can disappear or change in the new one.
  records=records.map(record=>{
    const {related,...origin}=record.asana;
    const {linkedProjectId,projectAt,...commercial}=origin.commercial;
    const links=origin.declaredLinks||origin.links.filter(link=>link!==related?.url);
    const asana={...origin,links,commercial};
    return {...record,asana,importedStatus:statusKey(asana.statusLabel),
      ...(record.project?{project:{...record.project,asana}}:{})};
  });
  const projects = new Map(records.filter(row=>row.asana.kind==='project').map(row=>[row.asana.id,row]));
  const quotes = records.filter(row=>row.asana.kind==='quote');
  const reverseLinks = new Map();
  const folio = text => value(text).replace(/^(\d{2}(?:0[1-9]|1[0-2]))-(\d{2,4})$/,'$1$2');
  const projectsByFolio=new Map();
  for(const project of projects.values()){
    const key=folio(project.folio);
    if(key)projectsByFolio.set(key,projectsByFolio.has(key)?null:project);
  }
  for (const project of projects.values()) {
    const quoteId=project.asana.linkId;
    if(quoteId)reverseLinks.set(quoteId,reverseLinks.has(quoteId)?null:project);
  }
  for (const quote of quotes) {
    const project = quote.asana.linkId ? projects.get(quote.asana.linkId) :
      reverseLinks.get(quote.asana.id)||projectsByFolio.get(folio(quote.asana.projectFolio));
    if (!project || project.asana.linkId && project.asana.linkId!==quote.asana.id) continue;
    quote.asana.commercial.linkedProjectId = project.id;
    quote.asana.commercial.projectAt = calendarDay(project.asana.createdAt);
    quote.asana.links = [...new Set([...quote.asana.links,project.asana.url])];
    quote.asana.related={id:project.id,url:project.asana.url,label:'Ver proyecto en Asana'};
    if(!project.asana.related)project.asana.related={id:quote.id,url:quote.asana.url,label:'Ver cotización en Asana'};
    quote.importedStatus='project';
  }
  return records;
}

export function importSuppliers(source) {
  const {headers,rows} = parseCsv(source);
  if (!['Proveedor_ID','Proveedor','Alias','Estado_Proveedor'].every(header=>headers.includes(header))) throw new Error('Faltan encabezados del maestro de proveedores.');
  const map = new Map();
  for(const row of rows) {
    const id = value(row.Proveedor_ID), name = value(row.Proveedor), status = value(row.Estado_Proveedor);
    if (!id && !name && !status) continue;
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || !name || map.has(id)) throw new Error('Registro de proveedor inválido o repetido.');
    map.set(id,{id,name,aliases:value(row.Alias),status});
  }
  return [...map.values()];
}

export function filterSuppliers(suppliers, query) {
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return {items:[],next:null,total:0};
  const matches = suppliers.filter(item=>normalized(item.status)==='activo' && terms.every(term=>normalized(item.name+' '+item.aliases).includes(term)));
  matches.sort((a,b)=>a.name.localeCompare(b.name,'es-MX')||a.id.localeCompare(b.id));
  return {items:matches.slice(0,20).map(({id,name,status})=>({id,name,status})),next:null,total:matches.length};
}
