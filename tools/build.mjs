import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {extendRecipes} from './recipe-extension.mjs';
import {extendRecipePresentation} from '../src/recipe-presentation.mjs';
import {extendPhone} from './phone-extension.mjs';
import {extendWoodPieces} from './wood-pieces-extension.mjs';
import {extendArticleMeasures} from './article-measure-extension.mjs';
import {extendRowVariant} from '../src/row-variant.mjs';
import {extendSessionAutosave} from '../src/session-autosave.mjs';
import {extendViewPolish} from '../src/view-polish.mjs';
import {extendRecipeWorkshop} from '../src/recipe-workshop.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function recipeImages(){
 const directory=path.join(root,'src/assets/catalogo-sintetico');
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 const expected=['SYN-NUBE-C','SYN-NUBE-O','SYN-PRISMA-C','SYN-PRISMA-O','SYN-PRISMA-G'];
 if(manifest.assets?.length!==expected.length||new Set(manifest.assets.map(asset=>asset.id)).size!==expected.length)throw Error('RECIPE_IMAGES_INCOMPLETE');
 return Object.fromEntries(expected.map(id=>{
  const asset=manifest.assets.find(row=>row.id===id);
  if(asset?.file!==id+'.png'||asset.kind!=='AI_GENERATED_SYNTHETIC_ILLUSTRATION')throw Error('RECIPE_IMAGE_INVALID');
  const bytes=fs.readFileSync(path.join(directory,asset.file));
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('RECIPE_IMAGE_CHANGED');
  return [id,'data:image/png;base64,'+bytes.toString('base64')];
 }));
}
export function build(){
 const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
 const native=read('cotizador.html');
 if(createHash('sha256').update(native).digest('hex')!=='3291618da77246df866be50ce53e3a74589435797e0b75975e35d69b71bb6a67')throw Error('NATIVE_D85_CHANGED');
 const quote=extendRecipeWorkshop(extendViewPolish(extendSessionAutosave(extendRowVariant(extendArticleMeasures(extendPhone(extendWoodPieces(extendRecipePresentation(extendRecipes(native)))))))));
 const [styles,remainder]=quote.split('<!-- QUOTE_BODY -->');
 if(!remainder)throw Error('QUOTE_BODY_MISSING');
 const [body,scripts]=remainder.split('<!-- QUOTE_SCRIPTS -->');
 if(!scripts)throw Error('QUOTE_SCRIPTS_MISSING');
 const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'";
 const output=`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Astil · Cotizador</title>
${styles.replace('Public synthetic derivative:','Local derivative:').replace('No documentary fixture or server modules.','Selected D91 reference recipes; no source workbooks or server modules.')}
<style>${read('journey.css')}
${read('integration.css')}
${read('recipe.css')}
${read('recipe-presentation.css')}
${read('row-variant.css')}
${read('view-polish.css')}
${read('recipe-workshop.css')}
${read('project-operations.css')}
</style></head><body>
<div id="journey-root"></div><section id="quote-host" hidden aria-label="Cotizador de la simulación">${body}</section><div id="journey-footer"></div>
<script>${read('country-codes.js')}</script>
<script>${read('demo-phone.js')}</script>
<script>globalThis.DemoRecipeImages=Object.freeze(${JSON.stringify(recipeImages())});</script>
<script>${read('recipe-reference.js')}</script>
<script>${read('recipe-catalog.js')}</script>
${scripts}
<script>${read('quote-bridge.js')}</script>
<script>${read('portfolio-kpis.js')}</script>
<script>${read('project-operations.js')}</script>
<script>${read('project-views.js')}</script>
<script>${read('journey.js')}</script>
</body></html>\n`;
 [...output.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].forEach((m,i)=>new vm.Script(m[1],{filename:'inline-'+i}));
 return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const first=build(),second=build();if(first!==second)throw Error('NON_DETERMINISTIC_BUILD');
 const output=path.join(root,'index.html');
 if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==first)throw Error('GENERATED_HTML_STALE');}
 else fs.writeFileSync(output,first);
 console.log(JSON.stringify({status:'PASS_LOCAL_BUILD',bytes:Buffer.byteLength(first),sha256:createHash('sha256').update(first).digest('hex'),standalone:true}));
}
