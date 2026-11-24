import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {calendarDay} from './private-import.mjs';

const projectFolio=/^(\d{2}(?:0[1-9]|1[0-2]))-?(\d{2,4})$/;
const quoteFolio=/^(?:\d{3}|\d{2}(?:0[1-9]|1[0-2])-?\d{2,4})$/;
const quoteStatuses=new Set(['request','draft','review','sent','waiting','paused','accepted','changes','rejected','project','unknown']);
const projectStatuses=new Map([
  ['en proceso','in-progress'],['en progreso','in-progress'],['activo','in-progress'],
  ['completado','completed'],['terminado','completed'],['entregado','completed'],
  ['pendiente','pending'],['pausado','paused'],['cancelado','cancelled']
]);
const normalize=value=>String(value||'').trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const date=value=>calendarDay(value)||null;
const iso=value=>typeof value==='string'&&value===date(value);
const optionalDate=value=>value===null||iso(value);

function compact(value){
  const match=projectFolio.exec(value||'');
  return match?match[1]+match[2]:null;
}

function quoteReference(record,fromTitle){
  const explicit=(record.folio||'').trim();
  if(quoteFolio.test(explicit))return explicit;
  return fromTitle && !explicit ? /^(\d{3})\s+\S/u.exec((record.request?.title||'').trim())?.[1]||null : null;
}

export function projectPublicPortfolio(source,{quoteFolioFromTitle=false}={}){
  const coverage=source?.coverage;
  const {from,through}=coverage||{};
  const lists={project:coverage?.lists?.project,quote:coverage?.lists?.quote};
  if(![from,through,lists.project,lists.quote].every(iso)||from>through||
     Object.values(lists).some(day=>day<from||day>through)||!Array.isArray(source?.records)){
    throw Error('El corte debe incluir la cobertura verificada de ambas listas.');
  }

  const projects=[],quotes=[],seen=new Set();
  for(const record of source.records){
    const origin=record.asana,createdAt=date(origin?.createdAt);
    if(record.source!=='ASANA_IMPORT'||!['project','quote'].includes(origin?.kind)||
      typeof origin.id!=='string'||!/^\d{5,24}$/.test(origin.id)||seen.has(origin.kind+':'+origin.id)||
      !createdAt||createdAt<from||createdAt>lists[origin.kind]){
      throw Error('La extracción contiene un registro duplicado, incompleto o fuera de su corte.');
    }
    seen.add(origin.kind+':'+origin.id);
    const deliveryDate=date(record.request?.deliveryDate);
    if(origin.kind==='project'){
      projects.push({
        folio:compact((record.folio||'').trim()),
        status:projectStatuses.get(normalize(origin.statusLabel))||'unknown',
        createdAt,startDate:date(origin.fields?.['Start Date']),
        dueDate:date(record.request?.quoteDue),deliveryDate
      });
    }else{
      quotes.push({
        folio:quoteReference(record,quoteFolioFromTitle),
        status:quoteStatuses.has(record.importedStatus)?record.importedStatus:'unknown',
        createdAt,quoteDue:date(record.request?.quoteDue),deliveryDate
      });
    }
  }
  const recentFirst=(a,b)=>b.createdAt.localeCompare(a.createdAt)||(a.folio||'').localeCompare(b.folio||'');
  return {revision:through,coverage:{from,through,lists},quotes:quotes.sort(recentFirst),projects:projects.sort(recentFirst)};
}

export function validatePublicPortfolio(bundle){
  const keys=(object,expected)=>object&&Object.keys(object).sort().join(' ')===expected.split(' ').sort().join(' ');
  const {revision,coverage,quotes,projects}=bundle;
  const projectStates=new Set([...projectStatuses.values(),'unknown']);
  const common=(row,kind)=>row.createdAt>=coverage.from&&row.createdAt<=coverage.lists[kind]&&iso(row.createdAt)&&optionalDate(row.deliveryDate);
  if(!keys(bundle,'revision coverage quotes projects')||!keys(coverage,'from through lists')||
    !keys(coverage.lists,'project quote')||revision!==coverage.through||
    ![revision,coverage.from,coverage.lists.quote,coverage.lists.project].every(iso)||
    !Object.values(coverage.lists).every(day=>day>=coverage.from&&day<=revision)||
    !Array.isArray(quotes)||!Array.isArray(projects)||
    !quotes.every(row=>keys(row,'folio status createdAt quoteDue deliveryDate')&&common(row,'quote')&&
      (row.folio===null||typeof row.folio==='string'&&quoteFolio.test(row.folio))&&quoteStatuses.has(row.status)&&optionalDate(row.quoteDue))||
    !projects.every(row=>keys(row,'folio status createdAt startDate dueDate deliveryDate')&&common(row,'project')&&
      (row.folio===null||typeof row.folio==='string'&&compact(row.folio)===row.folio)&&projectStates.has(row.status)&&
      optionalDate(row.startDate)&&optionalDate(row.dueDate))){
    throw Error('El paquete de consulta contiene campos o valores ajenos a la publicación.');
  }
  return bundle;
}

export function portfolioScript(bundle){
  validatePublicPortfolio(bundle);
  const table=rows=>'[\n'+rows.map(row=>'  '+JSON.stringify(row)).join(',\n')+'\n]';
  return '/* Listados públicos de Asana. Generado por tools/publish-portfolio.mjs. */\n'+
    'globalThis.DucoPublishedPortfolio={revision:'+JSON.stringify(bundle.revision)+
    ',coverage:'+JSON.stringify(bundle.coverage)+',quotes:'+table(bundle.quotes)+',projects:'+table(bundle.projects)+'};\n';
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const [database,mode,...rest]=process.argv.slice(2);
  if(!database||mode&&mode!=='--quote-title-folio'||rest.length)throw Error('Indica la ruta SQLite y, si se autorizó, --quote-title-folio.');
  const db=new DatabaseSync(database,{readOnly:true});
  let bundle;
  try{
    const row=db.prepare('SELECT json FROM source_data WHERE key=?').get('asana');
    if(!row)throw Error('La base local no contiene un corte de Asana.');
    bundle=projectPublicPortfolio(JSON.parse(row.json),{quoteFolioFromTitle:mode==='--quote-title-folio'});
  }finally{db.close();}
  writeFileSync(new URL('../src/published-portfolio.js',import.meta.url),portfolioScript(bundle));
  console.log(JSON.stringify({coverage:bundle.coverage,projects:bundle.projects.length,quotes:bundle.quotes.length,
    quoteFolios:bundle.quotes.filter(row=>row.folio!==null).length}));
}
