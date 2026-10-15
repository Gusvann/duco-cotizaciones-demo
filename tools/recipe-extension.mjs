import {recipeClient} from '../src/recipe-client.mjs';

function once(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('Recipe extension anchor changed: '+from.slice(0,100));
  return source.replace(from,to);
}
/** Build-time extension only: the canonical D85 file is never rewritten. */
export function extendRecipes(source) {
  const names=['lineStructuredBreakdown','partStartCreation','lineVariantSummary','lineResults','lineCatalogPanel','lineAction','filterLineCatalog','partInput','solidWoodOpen','solidWoodSet','solidWoodApply','solidWoodAction','solidWoodApplyCnc','breakdownSetField','breakdownSave','partPaint','partCandidate','partDraftDirty','partApply','partDiscard','recipeDirectoryHtml','breakdownDetailedSections'];
  for(const name of names)source=once(source,'function '+name+'(','function recipeBase'+name[0].toUpperCase()+name.slice(1)+'(');
  source=once(source,"row.mode='detailed';row.groups=breakdown.groups;row.materials=breakdown.materials;","row.mode='detailed';row.groups=breakdown.groups;row.materials=breakdown.materials;row.processes=breakdown.processes||row.processes;");
  source=once(source,'description:product.name,deliverables:variant.description','description:variant.articleLabel||product.name,deliverables:variant.description');
  source=once(source,'adminWoodPricePreview:config.prices.find(price=>price.species===component.woodKind)','adminWoodPricePreview:recipeMaterialPrice(id,component)');
  source=once(source,'  function items() {',recipeClient.replace(/^\r?\n/,'')+'\n  function items() {');
  source=once(source,'globalThis.__client = {','globalThis.__client = {lineAction,lineState,productStart,filterLineCatalog,lineResults,lineVariantSummary,lineCatalogPanel,breakdownSetField,breakdownSave,partInput,partPaint,partCandidate,recipeEntry,recipeDirectoryHtml,recipeSyncQuote,recipeMaterialPrice,recipeWoodResult:solidWoodResult,');
  source=once(source,"if(!editable()||!app.lineCatalog||!lineState().open)return;","if(!recipeCanEdit()||!app.lineCatalog||!lineState().open)return;");
  source=once(source,'if (!editable()) return;\n      beginCapture();','if (!recipeCanEdit()) return;\n      beginCapture();');
  source=once(source,'app.q.items.splice(i, 1);','app.q.items.splice(i, 1);\n        app.solidWoodLocal?.articles.delete(id);\n        if(app.syntheticRecipes?.articles)delete app.syntheticRecipes.articles[id];');
  // Per-article recipe metadata must never borrow the legacy singleton preview.
  source=once(source,"const source=app.recipePreview?.articleId===item.id&&app.recipePreview?.quoteId===app.q.id?", "const source=recipeEntry(item.id)?'<span>Receta de referencia · editable</span>':app.recipePreview?.articleId===item.id&&app.recipePreview?.quoteId===app.q.id?");
  return source;
}
