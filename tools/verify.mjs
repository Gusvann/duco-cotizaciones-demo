import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {build} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(build()===html,'HTML must be reproducible from the reviewed local source only');
assert.match(html,/<title>Astil · Cotizador<\/title>/,'The selected interface is the official quotation frontend, without a variant label');
// Scan executable/readable text, excluding only the exact five synthetic PNGs
// whose bytes and hashes the build validates. Random base64 is not business text.
const imageDirectory=path.join(root,'src/assets/catalogo-sintetico');
const imageManifest=JSON.parse(fs.readFileSync(path.join(imageDirectory,'manifest.json'),'utf8'));
let publicText=html;
for(const asset of imageManifest.assets){
 const embedded='data:image/png;base64,'+fs.readFileSync(path.join(imageDirectory,asset.file)).toString('base64');
 assert.equal(publicText.split(embedded).length,2,'Each verified synthetic image must occur exactly once');
 publicText=publicText.replace(embedded,'VERIFIED_SYNTHETIC_PNG');
}
assert.match(html,/connect-src 'none'/);assert.match(html,/frame-src 'none'/);assert.match(html,/form-action 'none'/);
assert.doesNotMatch(html,/<iframe\b|\b(?:sessionStorage|localStorage|indexedDB|XMLHttpRequest|WebSocket|sendBeacon|SpreadsheetApp|DriveApp|UrlFetchApp)\b|\bfetch\s*\(|google\.script|window\.google/);
// The standard SVG namespace identifies inline SVG; it is not a fetched resource.
// Exempt only this exact xmlns value. Every other HTTP(S) URL remains forbidden.
const resourceText=html.replaceAll('xmlns="http://www.w3.org/2000/svg"','xmlns="INLINE_SVG_NAMESPACE"');
assert.doesNotMatch(resourceText,/https?:\/\//i,'All fonts/images/scripts must be embedded');
assert.match(html,/globalThis\.DemoRecipeImages=Object\.freeze/,'Synthetic catalog images must be embedded');
const countrySandbox={};
vm.runInNewContext(fs.readFileSync(path.join(root,'src/country-codes.js'),'utf8'),countrySandbox);
const countries=countrySandbox.DemoCountries;
assert.equal(countries.length,245,'All geographic regions from the reviewed snapshot are included');
assert.equal(new Set(countries.map(country=>country.id)).size,245,'Each territory appears once');
assert.ok(countries.every(country=>/^[A-Z]{2}$/.test(country.id)&&country.name&&/^\+[1-9]\d{0,2}$/.test(country.dial)),'Each calling code is geographic and syntactically valid');
for(const [id,dial] of [['MX','+52'],['US','+1'],['CA','+1'],['BS','+1'],['ES','+34'],['FR','+33']])assert.equal(countries.find(country=>country.id===id)?.dial,dial,id+' calling code');
for(const license of ['licenses/libphonenumber-Apache-2.0.txt','licenses/unicode-cldr.txt'])assert.ok(fs.existsSync(path.join(root,license)),license+' required');
// Publication of the selected interface and its six normalized references was
// authorized by the owner on 2026-11-05. Private source locators, unselected documentary fixtures and
// business contacts remain excluded; this is not a blanket anonymization proof.
assert.ok(!/F0[34]-P\d+|DOCUMENTARY_RECIPE|26\.02\.11|Price List|Alsea|@(?:gmail|outlook|hotmail|tualo)\./i.test(publicText),'Public text must not contain private source identifiers, unselected documentary fixtures or contact addresses');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY|github_pat_|gh[pousr]_[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{24,}/.test(publicText),'Public text must not contain credentials');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const staticIds=[...html.slice(0,html.indexOf('<script')).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(staticIds).size,staticIds.length,'Static DOM IDs unique');
assert.ok(ids.includes('journey-root')&&ids.includes('quote-host'));
for(const file of ['cotizador-clasico/index.html','fabricacion/index.html'])assert.ok(fs.existsSync(path.join(root,file)),file+' preserved');
console.log(JSON.stringify({status:'PASS_LOCAL_STATIC',sha256:createHash('sha256').update(html).digest('hex'),checks:['deterministic','official quotation title','inline syntax','standalone assets','245 geographic calling codes and licenses','CSP','no storage/network/server API','six selected references without private source locators or credentials','legacy demos preserved'],limits:['Static checks; browser acceptance separate','No backend or production validation','Publication authorized for the selected frontend and six reference recipes; financial validation remains pending']}));
