import {recipeClient} from '../src/recipe-client.mjs';

function once(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('Recipe extension anchor changed: '+from.slice(0,100));
  return source.replace(from, () => to);
}

function expandedCatalogReference(recipe) {
  const amounts = recipe.referenceTotals;
  if (!amounts) return '';
  const money = value => {
    if(value==null||value==='')return 'Pendiente';
    const [whole, fraction=''] = value.split('.');
    const digits = fraction.padEnd(3, '0');
    return QuotePdf.money(Number(BigInt(whole)*100n + BigInt(digits.slice(0,2)) + (digits[2] >= '5' ? 1n : 0n)));
  };
  const rows = amounts.rubros.map(row => '<div><dt>'+esc(row.label)+'</dt><dd>'+esc(money(row.amount))+'</dd></div>').join('');
  const remarks = (recipe.commercialNotes || []).map(note => '<li>'+esc(note)+'</li>').join('');
  const leather = recipe.hardware.filter(row => row.purchaseUnit && row.purchaseUnit!==row.unit).map(row =>
    '<p class="meta">'+esc(row.name)+' · '+esc(row.quantityPerProduct)+' '+esc(row.unit)+' de consumo. '+(row.purchaseNeedsMeasurement?'Cantidad de compra por medir ('+esc(row.purchaseUnit)+').':'Compra: '+esc(row.purchasePerProduct)+' '+esc(row.purchaseUnit)+'.')+'</p>').join('');
  return '<section class="recipe-documentary-summary"><h6>Referencia de la receta</h6><p class="meta">Importes históricos por una pieza. La cotización muestra por separado los costos calculados con su captura.</p>'+
    '<dl class="line-variant-summary">'+rows+'<div><dt>Subtotal global documentado</dt><dd>'+esc(money(amounts.amount))+'</dd></div></dl>'+
    leather+(remarks?'<ul class="meta">'+remarks+'</ul>':'')+'</section>';
}

/** Build-time extension only: the canonical D85 file is never rewritten. */
export function extendRecipes(source) {
  // The 3/8-inch solid profile measures exactly 0.9525 cm.
  source=once(source,"sideACm:'decimal:3',sideBCm:'decimal:3'","sideACm:'decimal:4',sideBCm:'decimal:4'");
  source=once(source,"/exchangeRate$/.test(field)?4", "/(?:exchangeRate|sideACm|sideBCm)$/.test(field)?4");
  const names=['lineStructuredBreakdown','partStartCreation','lineVariantSummary','lineResults','lineCatalogPanel','lineAction','filterLineCatalog','partInput','solidWoodOpen','solidWoodSet','solidWoodApply','solidWoodAction','solidWoodApplyCnc','breakdownSetField','breakdownSave','partPaint','partCandidate','partDraftDirty','partApply','partDiscard','recipeDirectoryHtml','breakdownDetailedSections'];
  for(const name of names)source=once(source,'function '+name+'(','function recipeBase'+name[0].toUpperCase()+name.slice(1)+'(');
  source=once(source,"row.mode='detailed';row.groups=breakdown.groups;row.materials=breakdown.materials;","row.mode='detailed';row.groups=breakdown.groups;row.materials=breakdown.materials;row.processes=breakdown.processes||row.processes;");
  source=once(source,'description:product.name,deliverables:variant.description','description:variant.articleLabel||product.name,deliverables:variant.description');
  source=once(source,'if(!summary.errors?.materials)item.materials=summary.materials;if(!summary.errors?.finishes)item.finishes=summary.finishes;',`
      const previous=(app.partDraft?.original || app.q)?.manufacturing?.items?.find(oldRow=>oldRow.itemId===row.itemId);
      const priorSummary=previous && previous!==row ? QuoteManufacturing_.commercialSummary(previous) : null;
      const origin=app.lineOrigins.get(item.id);
      const variant=origin?.type==='PRODUCTO_LINEA' ? DemoRecipeCatalog.variant(origin.productId,origin.variantId) : null;
      for(const field of ['materials','finishes']){
        if(summary.errors?.[field])continue;
        // Catalog and manually entered descriptions also apply to articles with no technical layers.
        const removedSummary=priorSummary?.[field] && priorSummary[field]===item[field];
        item[field]=summary[field] || (!removedSummary && item[field]) || variant?.[field] || '';
      }`);
  source=once(source,'adminWoodPricePreview:config.prices.find(price=>price.species===component.woodKind)','adminWoodPricePreview:recipeMaterialPrice(id,component)');
  source=once(source,"const faces=['1','2','4'].includes(String(c.finishFaces))", "const faces=['0','1','2','4'].includes(String(c.finishFaces))");
  source=source.replaceAll("values:[['','Pendiente'],'1','2','4']", "values:[['','Pendiente'],['0','Sin acabado'],'1','2','4']");
  source=source.replaceAll("options:[['','Pendiente'],['1','1'],['2','2'],['4','4']]", "options:[['','Pendiente'],['0','Sin acabado'],['1','1'],['2','2'],['4','4']]");
  let catalogClient=recipeClient.replace(/^\r?\n/,'');
  catalogClient=once(catalogClient,"if(component.woodKind==='Tzalam'){","const selectedRecipe=DemoRecipeCatalog.recipe(meta.recipeId); if(component.woodKind==='Tzalam'&&!selectedRecipe?.referenceTotals&&!selectedRecipe?.syntheticPricing){");
  catalogClient=once(catalogClient,'DemoRecipeCatalog.scaled(perProduct,quantity)', 'DemoRecipeCatalog.scaled(h.fixedPurchasePerProduct||perProduct,quantity)');
  catalogClient=once(catalogClient,'    const modes=recipeModes(id);',`    const modes=recipeModes(id);
    const selectedRecipe=DemoRecipeCatalog.recipe(meta.recipeId);
    if (selectedRecipe?.referenceTotals||selectedRecipe?.syntheticPricing) for (const process of row.processes) {
      if (process.section==='maquilas' && process.quantityScope==='product' && process.source?.kind==='manual' && process.detail?.unitPrice!=='') {
        process.source.netAmount=''; // The shared model derives quantity × rate for the new article quantity.
      }
    }`);
  catalogClient=once(catalogClient,"['SKU de muestra',variant.sku]", "[rec.referenceTotals?'Referencia interna':'SKU de muestra',variant.sku]");
  catalogClient=once(catalogClient,"    return recipeEntry(item.id)?'':recipeBaseRecipeDirectoryHtml(item);",
    `    const entry=recipeEntry(item.id);
    if(!entry)return recipeBaseRecipeDirectoryHtml(item);
    const recipe=DemoRecipeCatalog.recipe(entry.recipeId);
    if(!recipe?.referenceTotals)return '';
    return '<details class="recipe-economics-reference"><summary>Referencia de la receta</summary>'+
      expandedCatalogReference(recipe)+recipePresentation.recipeSourceCostsHtml(item)+'</details>';`);
  source=once(source,'  function items() {',expandedCatalogReference.toString()+'\n'+catalogClient+'\n  function items() {');
  source=once(source,'globalThis.__client = {','globalThis.__client = {lineAction,lineState,productStart,filterLineCatalog,lineResults,lineVariantSummary,lineCatalogPanel,breakdownSetField,breakdownSave,partInput,partPaint,partCandidate,recipeEntry,recipeDirectoryHtml,recipeSyncQuote,recipeMaterialPrice,recipeWoodResult:solidWoodResult,');
  source=once(source,"if(!editable()||!app.lineCatalog||!lineState().open)return;","if(!recipeCanEdit()||!app.lineCatalog||!lineState().open)return;");
  source=once(source,"refreshLineResults();focusLine('[data-line-variant=", "refreshRecipeCatalogChoice(product);focusLine('[data-line-variant=");
  source=once(source,"refreshLineResults();focusLine('[data-action=\"line-details-toggle\"]", "refreshRecipeCatalogChoice(product);focusLine('[data-action=\"line-details-toggle\"]");
  source=once(source,'if (!editable()) return;\n      beginCapture();','if (!recipeCanEdit()) return;\n      beginCapture();');
  source=once(source,'app.q.items.splice(i, 1);','app.q.items.splice(i, 1);\n        app.solidWoodLocal?.articles.delete(id);\n        if(app.syntheticRecipes?.articles)delete app.syntheticRecipes.articles[id];');
  // Per-article recipe metadata must never borrow the legacy singleton preview.
  source=once(source,"const source=app.recipePreview?.articleId===item.id&&app.recipePreview?.quoteId===app.q.id?", "const source=recipeEntry(item.id)?'<span>Receta de referencia · editable</span>':app.recipePreview?.articleId===item.id&&app.recipePreview?.quoteId===app.q.id?");
  return source;
}
