import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {openPrivateStore, LocalError} from './private-store.mjs';
import {currentWindowsSid,windowsPeerSid} from './windows-session.mjs';
import {validateRecipeUpdates} from './private-recipes.mjs';
import {asanaList, calendarDay, connectAsana, coverageStart, coverageEnd, importSuppliers, parseCsv} from './private-import.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const originalImageIds=new Set(JSON.parse(fs.readFileSync(path.join(root,'src/assets/catalogo-sintetico/manifest.json'),'utf8')).assets.map(asset=>asset.id));
const sessionAge = 8*60*60*1000;
const contentLimit = 8*1024*1024;
const now = () => Date.now();
const secureHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};

function same(a,b) {
  const x=Buffer.from(a||''), y=Buffer.from(b||'');
  return x.length===y.length&&timingSafeEqual(x,y);
}
function respond(res,status,type,data,headers={}) {
  res.writeHead(status,{'Content-Type':type,...secureHeaders,...headers});
  res.end(data);
}
const json = (res,status,value,headers) => respond(res,status,'application/json; charset=utf-8',JSON.stringify(value),headers);
async function readBody(req) {
  const chunks=[];
  let bytes=0;
  for await (const chunk of req) {
    bytes+=chunk.length;
    if(bytes>contentLimit) throw new LocalError(413,'La solicitud local excede el tamaño permitido.');
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf-8'));}
  catch {throw new LocalError(400,'La solicitud contiene JSON inválido.');}
}
const signIn = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Astil · Acceso local</title><style>body{background:#f1f7fc;color:#102b41;font:16px system-ui;display:grid;min-height:95vh;place-items:center}form{background:white;border:1px solid #cbdff0;border-radius:14px;padding:30px;width:min(340px,85vw)}label{display:grid;gap:.4rem;margin:14px 0}input,button{font:inherit;border:1px solid #aac8e0;border-radius:6px;padding:10px}button{width:100%;background:#0759ae;color:white}p{color:#8c302b}</style>
<form id="login"><h1>Acceso local</h1><label>Usuario<input name="username" autocomplete="username" required></label>
<label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
<button type="submit">Entrar</button><p role="alert" id="feedback"></p></form><script src="/login.js" defer></script></html>`;
const signInScript = `document.getElementById('login').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget),feedback=document.getElementById('feedback');
  try {
    const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))});
    if(!response.ok){feedback.textContent=(await response.json()).message;return;}
    location.replace('/');
  } catch {feedback.textContent='El servidor local no respondió.';}
});`;

function validateQuote(html) {
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
  const domain=scripts.find(script=>script.includes('var QuoteSchema')&&script.includes('var QuoteManufacturing_'));
  if(!domain) throw Error('La compilación local no contiene el cálculo de cotizaciones.');
  const sandbox=vm.createContext({});
  vm.runInContext(domain,sandbox,{filename:'cotizador-dominio.js'});
  return Object.assign(quote=>sandbox.QuoteDomain.sanitize(quote),{contactEmail:value=>sandbox.QuoteDomain.contactEmail(value)});
}

export function createPrivateServer({store,port,publicHtml,privateJs,checkQuote=validateQuote(publicHtml),identifyWindowsPeer=windowsPeerSid}) {
  const origin='http://127.0.0.1:'+port;
  const sessions=new Map();
  let nextLoginAt=0;
  let peerChecks=0;
  function sessionCookie(user,previous) {
    if(previous)sessions.delete(previous);
    for(const [key,value] of sessions)if(value.expires<=now())sessions.delete(key);
    const id=randomBytes(32).toString('hex');
    sessions.set(id,{user,csrf:randomBytes(32).toString('hex'),expires:now()+sessionAge});
    return {'Set-Cookie':'duco_local='+id+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+sessionAge/1000};
  }
  const html=publicHtml.replace("connect-src 'none'","connect-src 'self'")
    .replace('</head>','<script src="/private-recipes.js"></script><script src="/private-client.js"></script></head>');
  return createServer(async (req,res)=>{
    try {
      if(req.headers.host!=='127.0.0.1:'+port || req.headers['sec-fetch-site']==='cross-site') throw new LocalError(403,'Origen local inválido.');
      const url=new URL(req.url,origin);
      if(url.origin!==origin) throw new LocalError(403,'Origen local inválido.');
      const requestPath=url.pathname;
      const write=req.method==='POST';
      if(req.method!=='GET'&&!write) throw new LocalError(405,'Método no disponible.');
      const token=/\bduco_local=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
      const auth=sessions.get(token);
      const active=auth&&auth.expires>now();
      if(!active&&token)sessions.delete(token);
      if(write&&(req.headers.origin!==origin||req.headers['content-type']!=='application/json')) throw new LocalError(403,'Origen de escritura inválido.');
      if(requestPath==='/login.js'&&!write) return respond(res,200,'text/javascript; charset=utf-8',signInScript);
      if(requestPath==='/api/login'&&write) {
        if(now()<nextLoginAt) throw new LocalError(429,'Espera un momento antes de volver a intentar.');
        nextLoginAt=now()+700;
        const credentials=await readBody(req);
        const user=store.authenticate(credentials.username,credentials.password);
        if(!user) throw new LocalError(401,'Usuario o contraseña incorrectos.');
        return json(res,200,{ok:true},sessionCookie(user,token));
      }
      const documentNavigation=req.headers['sec-fetch-mode']==='navigate'&&req.headers['sec-fetch-dest']==='document'&&
        ['none','same-origin'].includes(req.headers['sec-fetch-site']);
      if(requestPath==='/'&&!write&&!active&&documentNavigation&&peerChecks<3&&store.source('windowsBinding',null)){
        peerChecks++;
        let sid;
        try {sid=await identifyWindowsPeer(req.socket);}
        catch {sid=null;} // If Windows cannot identify the connection, require manual sign-in.
        finally {peerChecks--;}
        const user=store.windowsAccount(sid);
        if(user)return respond(res,303,'text/plain','',{Location:'/',...sessionCookie(user,token)});
      }
      if(requestPath==='/acceso'&&!write)return signInPage(res);
      if(!active) {
        if(requestPath==='/'&&!write) return signInPage(res);
        throw new LocalError(401,'Inicia sesión para continuar.');
      }
      if(write&&!same(req.headers['x-duco-csrf'],auth.csrf)) throw new LocalError(403,'La sesión no autorizó la escritura.');
      const {user}=auth;
      if(!write&&requestPath==='/') return respond(res,200,'text/html; charset=utf-8',
        html.replace("script-src 'unsafe-inline'","script-src 'unsafe-inline' 'self'"));
      if(!write&&requestPath==='/private-client.js')return respond(res,200,'text/javascript; charset=utf-8',privateJs);
      if(!write&&requestPath==='/private-recipes.js'){
        const data=store.source('recipeUpdates',{rows:[],products:[]});
        const rows=data.rows.map(row=>({...row,publicVisualKey:originalImageIds.has(row.id)?row.id:'v-'+createHash('sha256').update(row.id).digest('hex').slice(0,16)}));
        const serialized=JSON.stringify({...data,rows}).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
        return respond(res,200,'text/javascript; charset=utf-8','globalThis.DucoPrivateRecipeUpdates='+serialized+';');
      }
      const catalogueWebp=/^\/assets\/catalogo\/(?:thumb\/)?v-[a-f0-9]{16}\.webp$/.test(requestPath)
        || /^\/src\/assets\/catalogo-sintetico\/thumb\/SYN-[A-Z0-9-]+\.webp$/.test(requestPath);
      if(!write&&catalogueWebp){
        const file=path.join(root,requestPath.slice(1));
        if(!fs.existsSync(file))throw new LocalError(404,'Imagen no disponible.');
        return respond(res,200,'image/webp',await fs.promises.readFile(file));
      }
      if(!write&&/^\/src\/assets\/catalogo-sintetico\/SYN-[A-Z0-9-]+\.(?:png|jpg)$/.test(requestPath)){
        const file=path.join(root,requestPath.slice(1));
        if(!fs.existsSync(file))throw new LocalError(404,'Imagen no disponible.');
        return respond(res,200,file.endsWith('.jpg')?'image/jpeg':'image/png',await fs.promises.readFile(file));
      }
      if(!write&&requestPath==='/api/initial')return json(res,200,{...store.initial(user),csrf:auth.csrf});
      if(!write&&requestPath==='/api/catalog')return json(res,200,store.catalog());
      if(!write&&requestPath==='/api/suppliers')return json(res,200,store.suppliers((url.searchParams.get('q')||'').slice(0,180)));
      if(!write&&requestPath==='/api/clients')return json(res,200,store.clients((url.searchParams.get('q')||'').slice(0,180)));
      if(!write&&requestPath==='/api/client/contact')return json(res,200,store.clientContact(url.searchParams.get('id')));
      if(!write&&requestPath==='/api/client/status')return json(res,200,store.savedClient(store.clientOperation(user,url.searchParams.get('requestId'))));
      if(write&&requestPath==='/api/client')return json(res,200,store.createClient(user,await readBody(req),checkQuote.contactEmail));
      if(!write&&requestPath==='/api/line')return json(res,200,store.lineStatus(user,url.searchParams.get('quoteId'),url.searchParams.get('itemId')));
      if(!write&&requestPath==='/api/line/sent')return json(res,200,store.lineForSent(user,url.searchParams.get('quoteId')));
      if(!write&&requestPath==='/api/quote')return json(res,200,{entry:store.readQuote(url.searchParams.get('id'))||null});
      if(write&&requestPath==='/api/quote')return json(res,200,store.put(user,await readBody(req),checkQuote));
      if(write&&requestPath==='/api/line/request')return json(res,200,store.requestLine(user,await readBody(req)));
      if(write&&requestPath==='/api/line/approve')return json(res,200,store.approveLine(user,await readBody(req)));
      if(write&&requestPath==='/api/logout'){
        sessions.delete(token);
        return json(res,200,{ok:true},{'Set-Cookie':'duco_local=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});
      }
      if(!write&&['/cotizador-clasico/index.html','/fabricacion/index.html'].includes(requestPath))
        return respond(res,200,'text/html; charset=utf-8',fs.readFileSync(path.join(root,requestPath.slice(1))));
      throw new LocalError(404,'Ruta local no disponible.');
    }catch(error){
      if(!res.headersSent)json(res,error instanceof LocalError?error.status:500,{message:error instanceof LocalError?error.message:'El servicio local no completó la operación.',
        code:error instanceof LocalError?(error.code||({403:'FORBIDDEN',409:'CONFLICT',422:'VALIDATION'}[error.status])):undefined});
      else res.end();
    }
  });
}

function signInPage(res) {
  return respond(res,200,'text/html; charset=utf-8',signIn,{'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'"});
}

function readClients(file) {
  const {headers,rows}=parseCsv(fs.readFileSync(file,'utf8'));
  if(!['Cliente_ID','Cliente','Fecha primera venta'].every(key=>headers.includes(key)))throw Error('Encabezados de clientes inválidos.');
  const clients=Object.create(null);
  for(const row of rows){
    const id=row.Cliente_ID.trim();
    const firstSaleAt=row['Fecha primera venta'].trim();
    if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id)||!row.Cliente.trim()||clients[id]||firstSaleAt&&!calendarDay(firstSaleAt))
      throw Error('Primera venta con identidad o fecha inválida.');
    clients[id]={name:row.Cliente.trim(),firstSaleAt:calendarDay(firstSaleAt)||null};
  }
  return clients;
}
async function main() {
  const [action='serve',...args]=process.argv.slice(2);
  const flags=new Map();
  for(let i=0;i<args.length;i+=2){
    if(!args[i].startsWith('--')||args[i+1]==null)throw Error('Argumentos inválidos.');
    flags.set(args[i].slice(2),args[i+1]);
  }
  const directory=flags.get('data-dir')||process.env.DUCO_PRIVATE_DIR||(process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'DucoCotizador'));
  if(!directory)throw Error('Define DUCO_PRIVATE_DIR o usa --data-dir.');
  const store=openPrivateStore(directory,root);
  if(action==='provision'){
    const password=String(fs.readFileSync(0,'utf8')).replace(/\r?\n$/,'');
    store.provision(flags.get('user'),flags.get('role'),password);
    console.log('Cuenta privada aprovisionada.');
  } else if(action==='link-windows'){
    const password=String(fs.readFileSync(0,'utf8')).replace(/\r?\n$/,'');
    store.linkWindows(await currentWindowsSid(),flags.get('user'),password);
    console.log('Cuenta de cotización vinculada al perfil de Windows.');
  } else if(action==='import'){
    const bundle={};
    const projectFile=flags.get('projects'),quoteFile=flags.get('quotes');
    const origins=store.source('asanaOrigins',{});
    for(const kind of ['project','quote']){
      if(!flags.has(kind+'-list-id'))continue;
      const id=flags.get(kind+'-list-id');
      if(!/^\d{5,24}$/.test(id))throw Error('Identificador de lista de Asana inválido.');
      origins[kind]=id;
      bundle.asanaOrigins=origins;
    }
    if(projectFile||quoteFile){
      const through=flags.get('through')||calendarDay(new Date().toISOString());
      if(through<coverageStart||!calendarDay(through))throw Error('Fecha de extracción inválida.');
      const limit=through<coverageEnd?through:coverageEnd;
      const prior=store.source('asana',{records:[],coverage:null});
      const groups=new Map([['project',projectFile],['quote',quoteFile]].filter(([,file])=>file).map(([kind,file])=>{
        if(!origins[kind])throw Error('Indica el identificador de la lista de Asana con --'+kind+'-list-id.');
        return [kind,asanaList(fs.readFileSync(file,'utf8'),{kind,projectId:origins[kind],through:limit})];
      }));
      const records=connectAsana([...prior.records.filter(record=>!groups.has(record.asana.kind)),...[...groups.values()].flatMap(group=>group.records)]);
      const listCoverage={...prior.coverage?.lists,...Object.fromEntries([...groups.keys()].map(kind=>[kind,limit]))};
      bundle.asana={records,coverage:{from:coverageStart,through:limit,lists:listCoverage}};
      console.log(JSON.stringify({projects:records.filter(record=>record.asana.kind==='project').length,
        quotes:records.filter(record=>record.asana.kind==='quote').length,lists:Object.keys(listCoverage),
        withoutDate:[...groups.values()].reduce((sum,group)=>sum+group.undated,0),through:limit}));
    }
    if(flags.has('suppliers'))bundle.suppliers=importSuppliers(fs.readFileSync(flags.get('suppliers'),'utf8'));
    if(flags.has('clients'))bundle.clients=readClients(flags.get('clients'));
    if(flags.has('recipes'))bundle.recipeUpdates=validateRecipeUpdates(JSON.parse(fs.readFileSync(flags.get('recipes'),'utf8')));
    if(!Object.keys(bundle).length)throw Error('Indica exportaciones para importar.');
    store.importBundle(bundle);
    console.log(JSON.stringify({imported:true,...(bundle.suppliers?{suppliers:bundle.suppliers.length}:{})}));
  } else if(action==='serve'){
    const port=Number(flags.get('port')||61046);
    if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Puerto inválido.');
    const server=createPrivateServer({store,port,publicHtml:fs.readFileSync(path.join(root,'index.html'),'utf8'),
      privateJs:fs.readFileSync(path.join(root,'src/private-client.js'),'utf8')});
    server.listen(port,'127.0.0.1',()=>console.log('Cotizador privado en http://127.0.0.1:'+port));
  } else throw Error('Acción inválida. Usa serve, provision o import.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
