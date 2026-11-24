import {createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {mkdirSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {filterSuppliers} from './private-import.mjs';

export class LocalError extends Error {
  constructor(status,message,code) { super(message); this.status=status; this.code=code; }
}
const invalid = message => { throw new LocalError(422,message); };
const conflict = () => { throw new LocalError(409,'El expediente cambió. Recarga sus datos antes de continuar.'); };
const recordId = id => typeof id==='string' && /^DUCO-[a-f0-9]{32}$/.test(id);
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const installRoles = new Set(['account','direction']);
const encode = JSON.stringify;
const decode = JSON.parse;
const clientRequest = value => typeof value==='string' && /^REQ-[A-Za-z0-9-]{8,80}$/.test(value);
const clientKey = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').replace(/\s+/g,' ').trim();
function clientField(value,max){
  if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f]/.test(value)) invalid('Revisa los datos del cliente.');
  return value.trim();
}

export function openPrivateStore(directory, sourceRoot) {
  if(!path.isAbsolute(directory)) throw Error('Indica una carpeta privada absoluta.');
  const check = target => {
    const rel = path.relative(realpathSync(sourceRoot),target);
    if (!rel || !rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)) throw Error('La base privada debe quedar fuera del repositorio.');
  };
  check(path.resolve(directory));
  mkdirSync(directory,{recursive:true,mode:0o700});
  check(realpathSync(directory));
  return new PrivateStore(new DatabaseSync(path.join(directory,'cotizador.sqlite')));
}

export class PrivateStore {
  constructor(db) {
    this.db=db;
    db.exec(`
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, role TEXT NOT NULL, salt TEXT NOT NULL, verifier TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source_data (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, record TEXT NOT NULL, snapshot TEXT);
      CREATE TABLE IF NOT EXISTS clients_local (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, requested_by TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(requested_by,request_id)
      );
      CREATE TABLE IF NOT EXISTS line_approvals (
        id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id), item_id TEXT NOT NULL, version TEXT NOT NULL,
        revision INTEGER NOT NULL, hash TEXT NOT NULL, recipe TEXT NOT NULL, requested_by TEXT NOT NULL,
        approved_by TEXT, approved_at TEXT, UNIQUE(quote_id,item_id,version,revision)
      );
    `);
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {const result=work();this.db.exec('COMMIT');return result;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  setSource(key,data) {
    this.db.prepare('INSERT INTO source_data VALUES (?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json').run(key,encode(data));
  }
  source(key,fallback) {
    const row=this.db.prepare('SELECT json FROM source_data WHERE key=?').get(key);
    return row ? decode(row.json) : fallback;
  }
  importBundle({asana, suppliers, clients, asanaOrigins, recipeUpdates}) {
    this.transaction(()=>{
      if(asana)this.setSource('asana',asana);
      if(asanaOrigins)this.setSource('asanaOrigins',asanaOrigins);
      if(suppliers)this.setSource('suppliers',suppliers);
      if(recipeUpdates)this.setSource('recipeUpdates',recipeUpdates);
      if(clients)this.setSource('clients',clients);
    });
  }
  provision(username,role,password) {
    if(!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)||!installRoles.has(role)||typeof password!=='string'||password.length<14||password.length>160)
      invalid('Cuenta, rol o contraseña inválida.');
    if(this.db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) conflict();
    const salt=randomBytes(24).toString('hex');
    const verifier=scryptSync(password,salt,32).toString('hex');
    this.db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(username,role,salt,verifier);
  }
  authenticate(username,password) {
    if(typeof username!=='string'||typeof password!=='string'||username.length>64||password.length>160) return null;
    const row=this.db.prepare('SELECT * FROM users WHERE username=?').get(username);
    const candidate=scryptSync(password,row?.salt||'cotizador-local-verifier',32);
    if(!timingSafeEqual(candidate,Buffer.from(row?.verifier||'0'.repeat(64),'hex'))||!row) return null;
    return {username:row.username,role:row.role};
  }
  linkWindows(sid,username,password) {
    const user=this.authenticate(username,password);
    if(!user||user.role!=='account'||!/^S-1-\d+(?:-\d+)+$/.test(sid||''))throw new LocalError(403,'No se pudo vincular la cuenta de cotización a Windows.');
    this.setSource('windowsBinding',{sid,username:user.username});
  }
  windowsAccount(sid) {
    const binding=this.source('windowsBinding',null);
    if(!sid||binding?.sid!==sid)return null;
    return this.db.prepare("SELECT username,role FROM users WHERE username=? AND role='account'").get(binding.username)||null;
  }
  clientDirectory(records=this.source('asana',{records:[]}).records) {
    const clients=Object.assign(Object.create(null),this.source('clients',{}));
    for(const record of records) if (record.clientId && record.request.client && !Object.hasOwn(clients,record.clientId)) {
      clients[record.clientId]={name:record.request.client,firstSaleAt:null};
    }
    for(const row of this.db.prepare('SELECT id,payload FROM clients_local').all())clients[row.id]={name:decode(row.payload).name,firstSaleAt:null};
    return clients;
  }
  initial(user) {
    const {records,coverage}=this.source('asana',{records:[],coverage:null});
    const clients=this.clientDirectory(records);
    const drafts=this.db.prepare('SELECT revision,record,snapshot FROM quotes ORDER BY rowid').all().map(row=>({
      revision:row.revision,record:decode(row.record),snapshot:row.snapshot&&decode(row.snapshot)
    }));
    return {user,records,coverage,clients,drafts};
  }
  clients(query){
    const q=clientKey(query);
    if(!q)return {items:[],next:null,total:0};
    const matches=Object.entries(this.clientDirectory()).filter(([id,row])=>clientKey(row.name).includes(q)||clientKey(id).includes(q))
      .sort(([,left],[,right])=>left.name.localeCompare(right.name,'es-MX'));
    return {items:matches.slice(0,20).map(([id,row])=>({id,name:row.name,status:'Activo'})),next:null,total:matches.length};
  }
  clientContact(id){
    const row=this.db.prepare('SELECT payload FROM clients_local WHERE id=?').get(id);
    if(!row)return {clientId:id,contact:'',contactPhone:'',contactEmail:''};
    const {contact,contactPhone,contactEmail}=decode(row.payload);
    return {clientId:id,contact,contactPhone,contactEmail};
  }
  savedClient(row){
    if(!row)return {found:false};
    return {found:true,requestId:row.request_id,client:{id:row.id,status:'Activo',...decode(row.payload)}};
  }
  clientOperation(user,requestId){
    if(user.role!=='account')throw new LocalError(403,'La cuenta no puede registrar clientes.');
    if(!clientRequest(requestId))invalid('Identificador de alta inválido.');
    return this.db.prepare('SELECT * FROM clients_local WHERE requested_by=? AND request_id=?').get(user.username,requestId);
  }
  createClient(user,{requestId,name,contact='',contactPhone='',contactEmail=''}={},validateContactEmail){
    return this.transaction(()=>{
      const prior=this.clientOperation(user,requestId);
      const payload={name:clientField(name,240),contact:clientField(contact,240),contactPhone:clientField(contactPhone,60),contactEmail:clientField(contactEmail,254)};
      if(!payload.name)invalid('Indica el nombre del cliente.');
      if(payload.contactEmail){
        try {
          if(validateContactEmail)payload.contactEmail=validateContactEmail(payload.contactEmail);
          else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail))invalid('Correo del contacto inválido.');
        } catch {invalid('Correo del contacto inválido.');}
      }
      if(prior){
        if(prior.payload!==encode(payload))conflict();
        return this.savedClient(prior);
      }
      const normalized=clientKey(payload.name);
      if(Object.values(this.clientDirectory()).some(client=>clientKey(client.name)===normalized)){
        throw new LocalError(409,'Ya existe un cliente con el mismo nombre. Búscalo y selecciónalo para reutilizar su identidad.','DUPLICATE_CLIENT');
      }
      const id='CL-'+randomBytes(16).toString('hex');
      this.db.prepare('INSERT INTO clients_local VALUES (?,?,?,?,?,?)').run(id,requestId,user.username,normalized,encode(payload),new Date().toISOString());
      return this.savedClient({id,request_id:requestId,payload:encode(payload)});
    });
  }
  suppliers(query) { return filterSuppliers(this.source('suppliers',[]),query); }
  readQuote(id) {
    const row=this.db.prepare('SELECT revision,record,snapshot FROM quotes WHERE id=?').get(id);
    return row && {revision:row.revision,record:decode(row.record),snapshot:row.snapshot&&decode(row.snapshot)};
  }
  put(user,{record,snapshot,revision},checkQuote) {
    if(user.role!=='account') throw new LocalError(403,'La cuenta no puede modificar cotizaciones.');
    if(!recordId(record?.id)||record.asana||!Number.isSafeInteger(revision)||revision<0||!record.request||
       typeof record.request.title!=='string'||!Number.isSafeInteger(record.version)||record.version<1||
       !Array.isArray(record.versions)||!Array.isArray(record.history)) invalid('Expediente local inválido.');
    if(snapshot) {
      if(snapshot.quote?.id!==record.id||!Number.isSafeInteger(snapshot.summary?.savedRevision)||!snapshot.request)
        invalid('La captura no pertenece al expediente.');
      try { checkQuote(snapshot.quote); } catch { invalid('La captura contiene datos inválidos.'); }
    }
    return this.transaction(()=>{
      const prior=this.readQuote(record.id);
      if((prior?.revision||0)!==revision) {
        if(prior&&digest(prior.record)===digest(record)&&digest(prior.snapshot)===digest(snapshot||null)) return {revision:prior.revision};
        conflict();
      }
      if(prior?.record.project && digest(prior.record.project.baseline)!==digest(record.project?.baseline??null)) conflict();
      if(record.project && !prior?.record.project) {
        const accepted=prior?.record.sent;
        if(!accepted||accepted.response?.result!=='accepted'||accepted.response.version!==accepted.version||
          record.project.sourceId!==record.id||record.project.id!=='PR-'+record.id||record.project.version!==accepted.version||
          digest(record.project.baseline)!==digest(accepted.snapshot)||record.project.conversionKey!==record.id+':V'+accepted.version)
          invalid('La conversión requiere la versión aceptada y guardada.');
      }
      this.db.prepare('INSERT INTO quotes VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,record=excluded.record,snapshot=excluded.snapshot')
        .run(record.id,revision+1,encode(record),snapshot?encode(snapshot):null);
      return {revision:revision+1};
    });
  }
  toRequest(row) {
    if(!row)return null;
    return {id:row.id,status:row.approved_at?'approved':'pending',versionId:row.version,revision:row.revision,
      approvedBy:row.approved_by,approvedAt:row.approved_at};
  }
  lineStatus(user,quoteId,itemId) {
    const row=this.db.prepare('SELECT * FROM line_approvals WHERE quote_id=? AND item_id=? ORDER BY rowid DESC LIMIT 1').get(quoteId,itemId);
    return {request:this.toRequest(row),canApprove:user.role==='direction'};
  }
  lineForSent(user,quoteId){
    if(user.role!=='direction')throw new LocalError(403,'Solo Dirección puede consultar estas autorizaciones.');
    const entry=this.readQuote(quoteId),sent=entry?.record.sent?.snapshot,current=entry?.snapshot;
    if(!sent?.quote||sent.quote.versionId!==current?.quote.versionId||sent.summary?.savedRevision!==current.summary.savedRevision)
      return {requests:[]};
    const items=new Map(sent.quote.items.map(item=>[item.id,item.description]));
    const requests=this.db.prepare('SELECT id,item_id,revision FROM line_approvals WHERE quote_id=? AND version=? AND revision=? AND approved_at IS NULL')
      .all(quoteId,sent.quote.versionId,sent.summary.savedRevision);
    return {requests:requests.filter(row=>items.has(row.item_id)).map(row=>({
      id:row.id,revision:row.revision,item:items.get(row.item_id),version:entry.record.sent.version
    }))};
  }
  recipeAt(quoteId,itemId,versionId,revision) {
    const snapshot=this.readQuote(quoteId)?.snapshot;
    if(!snapshot||snapshot.quote.versionId!==versionId||snapshot.summary.savedRevision!==revision) conflict();
    const item=snapshot.quote.items.find(item=>item.id===itemId);
    if(!item||!item.description||!item.materials||!item.finishes||!Number(item.quantity)) invalid('Completa y guarda los datos del producto.');
    const row=snapshot.quote.manufacturing?.items.find(item=>item.itemId===itemId);
    const wood=snapshot.local?.wood?.find(([id])=>id===itemId)?.[1];
    if(!row?.materials.length&&!row?.processes.length&&!wood?.applied?.length) invalid('Agrega el despiece de la receta antes de solicitar el alta.');
    if(row?.materials.some(piece=>!piece.name||!piece.quantity||!piece.unit)||wood?.applied?.some(piece=>!piece.name||!piece.width||!piece.length||!piece.woodKind))
      invalid('Completa las piezas antes de solicitar el alta.');
    const localBreakdown={articleQuantity:item.quantity,groups:row?.groups||[],materials:row?.materials||[],processes:row?.processes||[],
      finishSystems:row?.finishSystems||[],wood:wood?.applied||[],workshop:wood?.workshop||null,
      boardSettings:wood?.boardSettings||{}};
    return {name:item.description,description:item.references||item.description,unit:item.unit,materials:item.materials,finishes:item.finishes,
      specs:item.specs.map(({id,...spec})=>spec),localBreakdown};
  }
  requestLine(user,{quoteId,itemId,versionId,revision}) {
    if(user.role!=='account') throw new LocalError(403,'La cuenta no puede solicitar altas.');
    return this.transaction(()=>{
      const recipe=this.recipeAt(quoteId,itemId,versionId,revision);
      const id='LINE-'+digest([quoteId,itemId,versionId,revision]).slice(0,28);
      this.db.prepare('INSERT OR IGNORE INTO line_approvals (id,quote_id,item_id,version,revision,hash,recipe,requested_by) VALUES (?,?,?,?,?,?,?,?)')
        .run(id,quoteId,itemId,versionId,revision,digest(recipe),encode(recipe),user.username);
      return this.lineStatus(user,quoteId,itemId);
    });
  }
  approveLine(user,{id,revision}) {
    if(user.role!=='direction') throw new LocalError(403,'Solo Dirección puede autorizar recetas.');
    return this.transaction(()=>{
      const row=this.db.prepare('SELECT * FROM line_approvals WHERE id=?').get(id);
      if(!row||row.revision!==revision) conflict();
      if(!row.approved_at){
        const recipe=this.recipeAt(row.quote_id,row.item_id,row.version,revision);
        if(row.hash!==digest(recipe)) conflict();
        this.db.prepare('UPDATE line_approvals SET approved_by=?, approved_at=? WHERE id=?').run(user.username,new Date().toISOString(),id);
      }
      return this.lineStatus(user,row.quote_id,row.item_id);
    });
  }
  catalog() {
    const rows=this.db.prepare('SELECT * FROM line_approvals WHERE approved_at IS NOT NULL ORDER BY approved_at,id').all();
    const latest=new Map(rows.map(row=>[row.quote_id+'|'+row.item_id,row]));
    return {products:[...latest.values()].map(row=>{
      const recipe=decode(row.recipe);
      const productId='LOCAL-'+digest([row.quote_id,row.item_id]).slice(0,24);
      return {id:productId,name:recipe.name,family:'Productos autorizados',description:recipe.description,unit:recipe.unit,
        variants:[{...recipe,id:row.id,articleLabel:recipe.name,name:'Receta autorizada'}]};
    })};
  }
}
