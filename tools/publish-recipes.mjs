import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {validateRecipeUpdates} from './private-recipes.mjs';

const fields=(source,names)=>Object.fromEntries(
  names.split(' ').filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]])
);
const projectRows=(rows,names)=>rows.map(row=>fields(row,names));
const prices='name kind quantity quantityUnit unitPrice priceUnit totalSaved';
const woodFields='name quantityPerProduct width length lengthUnit woodKind thickness finishFaces jointed';
const hardwareFields='name specification quantityPerProduct unit unitPrice category estimatedPricePerDm2 purchaseUnit purchasePerProduct purchaseNeedsMeasurement';
const boardFields='name quantityPerProduct length width lengthUnit thickness substrate coating sheetAreaM2 wasteRate unitPrice';
const metalFields='name section profile gauge dimension length width lengthUnit purchaseQuantity quantity unitPrice';
const operationFields='id name panel quantity unit rate extraEligible';
const cell=/^(?:[A-Z]{1,3}[1-9]\d{0,5})(?::[A-Z]{1,3}[1-9]\d{0,5})?$/;
const sheet=/^[A-Za-z0-9áéíóúñÁÉÍÓÚÑ ._-]{1,45}$/;
const targets=['wood','hardware','consumables','processes','dayLabor','additional'];

function componentFields(row,names,details){
  const selected=fields(row,names);
  if(row.detail && details)selected.detail=fields(row.detail,details);
  const references=Array.isArray(row.sourceCells)?row.sourceCells:[row.sourceCells];
  const cells=references.flatMap(reference=>typeof reference==='string'?reference.split(/[\s,;]+/):[])
    .map(reference=>reference.replace(/^P\d{1,3}!/, ''))
    .filter(reference=>cell.test(reference));
  if(cells.length) {
    selected.sourceCells=[...new Set(cells)];
  }
  return selected;
}

function fabrication(source) {
  const result={};
  for (const [key,columns] of [
    ['boards','assemblyRate cncMinutesPerM cncRate dayRate extraMaterials extrasPct integrationDays'],
    ['metal','paintFactor rollingPrice rollingQty']
  ]) {
    if (!source[key])continue;
    result[key]=fields(source[key],columns);
    if (source[key].operations)result[key].operations=source[key].operations.map(row=>componentFields(row,operationFields));
  }
  return result;
}

function economicData(source) {
  const result=Object.fromEntries(targets.filter(key=>source[key]).map(key=>[key,projectRows(source[key],prices)]));
  if(source.parameters?.cncMinutesPerMeter)result.parameters={
    cncMinutesPerMeter:fields(source.parameters.cncMinutesPerMeter,'value')
  };
  return result;
}

const workshopField=/^(?:domino\.(?:extra|lengthCm|quantity|unions|price|perMeter)|finish\.[0-2]\.(?:enabled|hands|name|price|yield)|other\.extrasPct)$/;
const documentOf=row=>row.sourceProvenance?.workbook||row.provenance?.file;
const reviewDate='2026-11-24';

export function projectForPublication(input,catalog){
  const {rows}=validateRecipeUpdates(input);
  const artwork=new Set(Object.keys(catalog.assets));
  const workbooks=[...new Set(rows.map(documentOf))].sort();
  const products=new Map(catalog.products.map(p=>[p.id,fields(p,'id name family description')]));
  for(const p of input.products)products.set(p.id,fields(p,'id name family description'));
  const published=rows.map(row=>{
    const key=artwork.has(row.id)?row.id:'v-'+createHash('sha256').update(row.id).digest('hex').slice(0,16);
    if(!artwork.delete(key)||!products.has(row.productId))throw Error('Una receta no coincide con su ficha o ilustración.');
    const referenceSheet=row.sourceProvenance?.worksheet||row.provenance?.sheet||row.sourceSheet;
    const confirmedSheet=typeof referenceSheet==='string'&&sheet.test(referenceSheet)?referenceSheet:null;
    const cells=(row.provenance?.ranges||[]).filter(value=>typeof value==='string'&&cell.test(value));
    const pages=[row.provenance?.corrections?.pages,row.sourceProvenance?.answerPage].flat();
    const correctionPages=[...new Set(pages)]
      .filter(page=>Number.isInteger(page)&&page>=1&&page<=500);
    const publicationSource={
      workbook:'Libro de fabricación '+String(workbooks.indexOf(documentOf(row))+1).padStart(2,'0'),
      sheet:confirmedSheet,cells,revision:reviewDate,correctionPages
    };
    const selected=fields(row,'productId variant description finishDescription materialsLabel woodWastePercent');
    return {
      ...selected,id:'PUB-'+key.toUpperCase(),publicVisualKey:key,publicationSource,
      finishedSpecs:fields(row.finishedSpecs,'Largo Ancho Alto'),
      wood:row.wood.map(piece=>({...fields(piece,woodFields),...(piece.cnc?{cnc:fields(piece.cnc,'decision length unit repetitions')}:{})})),
      hardware:row.hardware.map(part=>componentFields(part,hardwareFields)),
      boards:row.boards.map(part=>componentFields(part,boardFields,'edgeLengthCount edgeWidthCount gluedFaces laserCount linearCentimeters naturalFace paintFaces')),
      metal:row.metal.map(part=>componentFields(part,metalFields,'kgPerM2 kgPerMl laborPrice laserCount linearCentimeters paintFaces paintPrice sideACm sideBCm')),
      maquilas:row.maquilas.map(part=>componentFields(part,'name category quantity unit unitPrice')),
      economics:economicData(row.economics),
      referenceTotals:{amount:row.referenceTotals.amount,rubros:projectRows(row.referenceTotals.rubros,'label amount')},
      ...(row.fabrication?{fabrication:fabrication(row.fabrication)}:{}),
      ...(row.workshopDefaults?.values?{workshopDefaults:{values:Object.fromEntries(
        Object.entries(row.workshopDefaults.values).filter(([key])=>workshopField.test(key))
      )}}:{})
    };
  });
  if(artwork.size||published.length!==catalog.rows.length||published.some(row=>/00$/.test(row.publicationSource.workbook))) {
    throw Error('El catálogo queda incompleto o incluye recetas sin un libro de procedencia.');
  }
  const bundle={revision:reviewDate,products:[...products.values()],rows:published};
  if (/(?:[@][A-Za-z0-9-]+\.[A-Za-z]|(?:https?|file):\/\/|[A-Z]:[\\/]|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|github_pat_)/i.test(JSON.stringify(bundle))) {
    throw Error('La proyección contiene contacto, origen no permitido o credenciales.');
  }
  return bundle;
}

export function publishedScript(bundle) {
  return '/* Recipe data approved for public consultation. Generated by tools/publish-recipes.mjs. */\n'+
    'globalThis.DucoPublishedRecipes='+JSON.stringify(bundle).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029')+';\n';
}

if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const [source]=process.argv.slice(2);
  if(!source)throw Error('Indica la extracción de fabricación aprobada para publicación.');
  const context={};
  runInNewContext(readFileSync(new URL('../src/public-product-catalog.js',import.meta.url),'utf8'),context);
  const input=JSON.parse(readFileSync(source,'utf8').replace(/^\uFEFF/,''));
  const bundle=projectForPublication(input,context.DemoPublicRecipes);
  writeFileSync(new URL('../src/published-recipes.js',import.meta.url),publishedScript(bundle));
  console.log(JSON.stringify({products:bundle.products.length,recipes:bundle.rows.length,revision:bundle.revision}));
}
