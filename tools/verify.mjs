import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {build} from './build.mjs';
import {validatePublicPortfolio} from './publish-portfolio.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(build()===html,'HTML must be reproducible from the reviewed local source only');
assert.match(html,/<title>Astil · Cotizador<\/title>/,'The selected interface is the official quotation frontend, without a variant label');
// Images ship as site assets. Verify each manifest entry against the actual file.
const imageDirectory=path.join(root,'src/assets/catalogo-sintetico');
const imageManifest=JSON.parse(fs.readFileSync(path.join(imageDirectory,'manifest.json'),'utf8'));
const publicText=html;
for(const asset of imageManifest.assets){
 assert.ok(html.includes('src/assets/catalogo-sintetico/'+asset.file));
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(imageDirectory,asset.file))).digest('hex'),asset.sha256);
 assert.equal(asset.thumbnail,'thumb/'+asset.id+'.webp');
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(imageDirectory,asset.thumbnail))).digest('hex'),asset.thumbnailSha256);
}
const photoDirectory=path.join(root,'assets/catalogo');
const photos=JSON.parse(fs.readFileSync(path.join(photoDirectory,'manifest.json'),'utf8')).assets;
assert.equal(photos.length,101);assert.equal(new Set(photos.map(photo=>photo.id)).size,101);
assert.equal(new Set(photos.map(photo=>photo.sha256)).size,101);
for(const photo of photos){
 assert.match(photo.id,/^v-[a-f0-9]{16}$/);
 assert.ok(html.includes(photo.id),'Each shipped photo has a public variant');
 assert.equal(photo.kind,'AI_GENERATED_SYNTHETIC_ILLUSTRATION');
 assert.equal(photo.file,photo.id+'.webp');assert.equal(photo.thumbnail,'thumb/'+photo.file);
 for(const [filename,hash] of [[photo.file,photo.sha256],[photo.thumbnail,photo.thumbnailSha256]]){
  const bytes=fs.readFileSync(path.join(photoDirectory,filename));
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
 }
}
assert.match(html,/connect-src 'none'/);assert.match(html,/frame-src 'none'/);assert.match(html,/form-action 'none'/);
const publicPortfolio=fs.readFileSync(path.join(root,'src/published-portfolio.js'),'utf8');
assert.match(html,/<script src="src\/published-portfolio\.js"><\/script>/);
const portfolioSandbox={};
vm.runInNewContext(publicPortfolio,portfolioSandbox);
const publishedPortfolio=validatePublicPortfolio(portfolioSandbox.DucoPublishedPortfolio,{requireTitles:true});
assert.ok(publishedPortfolio.projects.length&&publishedPortfolio.quotes.length,'Both approved lists must be present');
const catalogSource=fs.readFileSync(path.join(root,'src/public-product-catalog.js'),'utf8');
assert.ok(html.includes(catalogSource),'The gallery and the quote must use the same public catalogue');
const sandbox=vm.createContext({});
vm.runInContext(catalogSource,sandbox);
const catalog=sandbox.DemoPublicRecipes;
assert.equal(catalog.products.length,12);
assert.equal(catalog.rows.length,135);
const photoIds=new Set([...imageManifest.assets,...photos].map(asset=>asset.id));
assert.equal(photoIds.size,135);
for(const row of catalog.rows){
  assert.ok(photoIds.delete(row.id),'Each variant must have its own distinct verified photo');
  assert.equal(row.syntheticPricing,true);
  assert.ok(catalog.assets[row.id].url && catalog.assets[row.id].thumbnail);
}
assert.equal(photoIds.size,0);
const releasedSource=fs.readFileSync(path.join(root,'src/published-recipes.js'),'utf8');
const gallery=fs.readFileSync(path.join(root,'catalogo.html'),'utf8');
for(const page of [html,gallery])assert.match(page,/<script src="src\/published-recipes\.js"/);
assert.doesNotMatch(releasedSource,/https?:\/\/|[A-Z]:\\\\|@[\w.-]+\.[A-Za-z]{2}|\.xlsx|\.pdf|F0[34]-P\d+|AL[C]?SEA|STARBUCKS|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|"(?:commercialReference|commercialNotes|salePrice|originalWorkbookTotals|supplier|sha256|sku)"\s*:/i);
vm.runInContext(releasedSource,sandbox);
const released=sandbox.DucoPublishedRecipes;
assert.equal(released.rows.length,catalog.rows.length);
assert.equal(released.products.length,catalog.products.length);
assert.deepEqual([...released.rows.map(row=>row.publicVisualKey)].sort(),[...catalog.rows.map(row=>row.id)].sort());
sandbox.location={protocol:'https:'};
vm.runInContext(fs.readFileSync(path.join(root,'src/recipe-catalog.js'),'utf8'),sandbox);
const active=sandbox.DemoRecipeCatalog;
assert.equal(active.recipes.length,released.rows.length);
assert.equal(new Set(active.recipes.map(value=>value.id)).size,released.rows.length);
for(const row of released.rows){
 assert.ok(row.publicationSource.workbook&&row.publicationSource.sheet,'Each recipe has a manufacturing source');
 const recipe=active.recipe('R-'+row.id);
 assert.equal(recipe.referenceTotals.amount,row.referenceTotals.amount);
 assert.ok(active.recipe('R-'+row.publicVisualKey).syntheticPricing,'Older drafts still resolve their demonstration recipe');
 assert.ok(active.variant(row.productId,row.publicVisualKey),'Older draft line origins still resolve');
 for(const quantity of ['1','2']){
  let id=0;
  const article=active.instantiate(recipe.id,prefix=>prefix+'-'+(++id),quantity);
  assert.equal(article.wood.length,row.wood.length);
  assert.equal(article.materials.length,row.hardware.length+row.boards.length+row.metal.length);
  assert.equal(article.processes.length,row.maquilas.length);
 }
}
const demoStore=fs.readFileSync(path.join(root,'src/public-store.js'),'utf8');
assert.ok(html.includes(demoStore),'Browser persistence adapter is compiled');
assert.doesNotMatch(html.replace(demoStore,''),/\bindexedDB\b/);
assert.doesNotMatch(html,/<iframe\b|\b(?:sessionStorage|localStorage|XMLHttpRequest|WebSocket|sendBeacon|SpreadsheetApp|DriveApp|UrlFetchApp)\b|\bfetch\s*\(|google\.script|window\.google/);
// The standard SVG namespace identifies inline SVG; it is not a fetched resource.
// Exempt only this exact xmlns value. Every other HTTP(S) URL remains forbidden.
const resourceText=html.replaceAll('xmlns="http://www.w3.org/2000/svg"','xmlns="INLINE_SVG_NAMESPACE"');
assert.doesNotMatch(resourceText,/https?:\/\//i,'All fonts/images/scripts must be embedded');
assert.match(html,/globalThis\.DemoRecipeImages=Object\.freeze/,'Catalog photos must have a local registry');
const countrySandbox={};
vm.runInNewContext(fs.readFileSync(path.join(root,'src/country-codes.js'),'utf8'),countrySandbox);
const countries=countrySandbox.DemoCountries;
assert.equal(countries.length,245,'All geographic regions from the reviewed snapshot are included');
assert.equal(new Set(countries.map(country=>country.id)).size,245,'Each territory appears once');
assert.ok(countries.every(country=>/^[A-Z]{2}$/.test(country.id)&&country.name&&/^\+[1-9]\d{0,2}$/.test(country.dial)),'Each calling code is geographic and syntactically valid');
for(const [id,dial] of [['MX','+52'],['US','+1'],['CA','+1'],['BS','+1'],['ES','+34'],['FR','+33']])assert.equal(countries.find(country=>country.id===id)?.dial,dial,id+' calling code');
for(const license of ['licenses/libphonenumber-Apache-2.0.txt','licenses/unicode-cldr.txt'])assert.ok(fs.existsSync(path.join(root,license)),license+' required');
// Scan public text for private source locators, documentary fixtures and contacts.
// Authorization and the financial review of a release are separate from this check.
assert.ok(!/F0[34]-P\d+|DOCUMENTARY_RECIPE|26\.02\.11|Price List|Alsea|@(?:gmail|outlook|hotmail|tualo)\./i.test(publicText),'Public text must not contain private source identifiers, unselected documentary fixtures or contact addresses');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY|github_pat_|gh[pousr]_[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{24,}/.test(publicText),'Public text must not contain credentials');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const staticIds=[...html.slice(0,html.indexOf('<script')).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(staticIds).size,staticIds.length,'Static DOM IDs unique');
assert.ok(ids.includes('journey-root')&&ids.includes('quote-host'));
for(const file of ['cotizador-clasico/index.html','fabricacion/index.html'])assert.ok(fs.existsSync(path.join(root,file)),file+' preserved');
console.log(JSON.stringify({status:'PASS_LOCAL_STATIC',sha256:createHash('sha256').update(html).digest('hex'),checks:['deterministic','official quotation title','inline syntax','135 verified same-origin images','245 geographic calling codes and licenses','CSP','IndexedDB confined to demo store','no external API','no private source locators or credentials in the public bundle','legacy demos preserved']}));
