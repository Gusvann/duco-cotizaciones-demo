import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import net from 'node:net';
import {PrivateStore} from '../tools/private-store.mjs';
import {createPrivateServer} from '../tools/private-server.mjs';
import {currentWindowsSid,windowsPeerSid} from '../tools/windows-session.mjs';

const password='contraseña-ficticia-para-pruebas';
const account='cuenta-prueba';
const sid='S-1-5-21-111-222-333-1111';
const navigate={'sec-fetch-mode':'navigate','sec-fetch-site':'none','sec-fetch-dest':'document'};
async function withBrowser(sid,identify,run) {
  const db=new DatabaseSync(':memory:');
  const store=new PrivateStore(db);
  store.provision(account,'account',password);
  store.linkWindows(sid,account,password);
  const probe=net.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const {port}=probe.address();
  await new Promise(resolve=>probe.close(resolve));
  const server=createPrivateServer({store,port,publicHtml:'<head></head>',privateJs:'',checkQuote:()=>true,identifyWindowsPeer:identify});
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  const get=(path,headers={})=>new Promise((resolve,reject)=>{
    http.get({host:'127.0.0.1',port,path,headers},res=>{
      let text='';
      res.setEncoding('utf8');
      res.on('data',part=>{text+=part;});
      res.on('end',()=>resolve({headers:res.headers,status:res.statusCode,text}));
    }).on('error',reject);
  });
  try {await run(get,store);}
  finally {await new Promise(resolve=>server.close(resolve));db.close();}
}

test('a matched local Windows profile enters only the quotation role on top-level navigation',async()=>{
  let peer=sid,checks=0;
  await withBrowser(sid,async()=>{checks++;return peer;},async(get,store)=>{
    store.provision('direccion-prueba','direction',password);
    assert.throws(()=>store.linkWindows(sid,'direccion-prueba',password),{status:403});
    assert.throws(()=>store.linkWindows(sid,account,'incorrecta'),{status:403});
    assert.equal((await get('/api/initial',navigate)).status,401);
    assert.equal((await get('/private-recipes.js',navigate)).status,401);
    assert.equal((await get('/catalogo.html',navigate)).status,401);
    assert.equal((await get('/src/assets/catalogo-sintetico/SYN-CATALOG-04.jpg')).status,401);
    assert.equal((await get('/')).headers['set-cookie'],undefined);
    assert.equal((await get('/acceso',navigate)).headers['set-cookie'],undefined);
    assert.equal((await get('/',{...navigate,'sec-fetch-site':'cross-site'})).status,403);
    assert.equal((await get('/',{...navigate,'sec-fetch-dest':'iframe'})).headers['set-cookie'],undefined);
    assert.equal(checks,0);
    for(peer of [null,'S-1-5-21-123']){
      assert.equal((await get('/',navigate)).headers['set-cookie'],undefined);
    }
    peer=sid;
    const login=await get('/',navigate);
    assert.equal(login.status,303);
    const cookie=login.headers['set-cookie'][0];
    assert.match(cookie,/HttpOnly; SameSite=Strict/);
    const me=await get('/api/initial',{cookie:cookie.split(';')[0]});
    assert.deepEqual(JSON.parse(me.text).user,{username:account,role:'account'});
    store.importBundle({recipeUpdates:{rows:[],products:[],note:'</script>'}});
    const src=await get('/private-recipes.js',{cookie:cookie.split(';')[0]});
    assert.equal(src.status,200);
    assert.equal(src.headers['cache-control'],'no-store');
    assert.ok(!src.text.includes('</script>'));
    const headers={cookie:cookie.split(';')[0]};
    const gallery=await get('/catalogo.html',headers);
    assert.equal(gallery.status,200);
    assert.match(gallery.text,/src="\/private-recipes\.js"/);
    assert.doesNotMatch(gallery.text,/published-recipes\.js/);
    assert.equal((await get('/src/published-recipes.js',headers)).status,404);
    const legacy=await get('/src/assets/catalogo-sintetico/SYN-CATALOG-04.jpg',headers);
    assert.equal(legacy.status,200);
    assert.equal(legacy.headers['content-type'],'image/jpeg');
    const thumbnail=await get('/src/assets/catalogo-sintetico/thumb/SYN-CATALOG-04.webp',headers);
    assert.equal(thumbnail.status,200);
    assert.equal(thumbnail.headers['content-type'],'image/webp');
    const photos=JSON.parse(await readFile(new URL('../assets/catalogo/manifest.json',import.meta.url),'utf8'));
    const photo=photos.assets[0];
    for(const file of [photo.file,photo.thumbnail]){
      const image=await get('/assets/catalogo/'+file,headers);
      assert.equal(image.status,200);
      assert.equal(image.headers['content-type'],'image/webp');
      assert.equal(image.text.slice(8,12),'WEBP');
    }
    assert.equal((await get('/assets/catalogo/manifest.json',headers)).status,404);
    assert.equal((await get('/src/recipe-reference.js',headers)).status,404);
  });
});

test('Windows resolves the owner of a live loopback browser connection',{skip:process.platform!=='win32'},async()=>{
  const owner=await currentWindowsSid();
  assert.ok(owner);
  await withBrowser(owner,windowsPeerSid,async(get)=>{
    const login=await get('/',navigate);
    assert.equal(login.status,303);
    const cookie=login.headers['set-cookie'][0].split(';')[0];
    const me=await get('/api/initial',{cookie});
    assert.equal(JSON.parse(me.text).user.username,account);
  });
});
