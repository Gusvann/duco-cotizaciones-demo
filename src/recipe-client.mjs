/* Injected into the native client closure; original functions remain fallbacks. */
export const recipeClient = String.raw`
  function recipeCanEdit(){return !!globalThis.DemoQuote?.canEdit(app.q?.id)&&editable()&&!app.busy&&!app.operation;}
  function recipeEntry(id){return partSameContext(app.syntheticRecipes?.context)&&app.q?.items.some(item=>item.id===id)?app.syntheticRecipes.articles?.[id]||null:null;}
  function recipeModes(id){return app.partDraft?.itemId===id&&partSameContext(app.partDraft.context)?app.partDraft.syntheticRecipeModes||{}:{};}
  function recipeMaterialPrice(id,component){
    const config=app.solidWoodUatConfig,meta=recipeEntry(id);
    if(!meta)return config.prices.find(price=>price.species===component.woodKind)||null;
    const thickness=SolidWoodAutoPreview.calculate({component:{thickness:component.thickness}}).thicknessIn;
    if(component.woodKind==='Tzalam'){
      const matches=DemoRecipeCatalog.woodPriceReferences.filter(price=>price.species==='Tzalam'&&price.thicknessIn===thickness);
      if(matches.length!==1)return null;
      const price=matches[0];
      return price.referenceSource==='USER_PROVIDED_LOCAL_REFERENCE'&&price.unit===SolidWoodAutoPreview.unit&&price.quality==='PREVIEW'?price:null;
    }
    const recipe=DemoRecipeCatalog.recipe(meta.recipeId),index=meta.woodIds.indexOf(component.id),original=recipe?.wood[index];
    if(!original)return config.prices.find(price=>price.species===component.woodKind&&price.referenceSource!=='HISTORICAL_REFERENCE_D91')||null;
    const row=recipe.documentary.sections.find(section=>section.key==='wood')?.rows[index];
    if(component.woodKind!==original.woodKind||thickness!==Number(original.thickness)||row?.unitPrice==null||row.priceUnit!=='SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO')return null;
    return {species:component.woodKind,price:row.unitPrice,unit:SolidWoodAutoPreview.unit,source:'ADMIN_UAT',quality:'PREVIEW',referenceSource:'HISTORICAL_REFERENCE_D91'};
  }
  function recipeSyncQuote(quote,id){
    const meta=recipeEntry(id),item=quote?.items.find(row=>row.id===id),row=quote?.manufacturing?.items.find(row=>row.itemId===id);if(!meta||!item||!row)return;
    const modes=recipeModes(id);
    const tx=app.partDraft?.itemId===id?app.partDraft:null;if(tx){if(tx.error===tx.syntheticRecipeError)tx.error='';tx.syntheticRecipeError='';}
    for(const h of meta.hardware){const material=row.materials.find(m=>m.id===h.id);if(!material)continue;const mode=modes[h.id]||h.mode;if(mode==='AUTO'&&material.purchaseUnit===h.unit){const quantity=String(item.quantity??''),perProduct=String(material.quantity??'');if(!/^\d+(?:\.\d{1,3})?$/.test(quantity)||!/^\d+(?:\.\d{1,3})?$/.test(perProduct)){material.purchaseQuantity='';continue;}try{material.purchaseQuantity=DemoRecipeCatalog.scaled(perProduct,quantity);}catch(error){material.purchaseQuantity='';if(tx)tx.error=tx.syntheticRecipeError=error.message;}material.economicReviewed=false;material.purchaseQuality='pending';const sub=app.breakdownEditor;if(sub?.itemId===id&&sub.value?.id===h.id&&!sub.syntheticRecipeManual)sub.value.purchaseQuantity=material.purchaseQuantity;}}
  }
  function lineStructuredBreakdown(variant){
    if(!variant?.recipeId)return recipeBaseLineStructuredBreakdown(variant);
    if(!recipeCanEdit())throw Error('Este borrador no admite cambios.');
    return DemoRecipeCatalog.instantiate(variant.recipeId,uid,'1');
  }
  function partStartCreation(technical,origin,breakdown=null){
    if(!recipeCanEdit())return null;
    if(!breakdown?.metadata)return recipeBasePartStartCreation(technical,origin,breakdown);
    if(app.partDraft&&partDraftDirty())return null;
    const rec=DemoRecipeCatalog.recipe(breakdown.metadata.recipeId);
    if(!rec||origin?.productId!==rec.productId||origin?.variantId!==rec.variantId)return null;
    const previous={q:app.q,solidWoodLocal:app.solidWoodLocal?{context:app.solidWoodLocal.context,articles:new Map(app.solidWoodLocal.articles)}:null,syntheticRecipes:app.syntheticRecipes?{...app.syntheticRecipes,articles:{...app.syntheticRecipes.articles}}:null,lineOrigins:new Map(app.lineOrigins),technicalDrafts:new Map(app.technicalDrafts),deferredPartIds:new Set(app.deferredPartIds),openPartId:app.openPartId,partDraft:app.partDraft,breakdownEditor:app.breakdownEditor,dirty:app.dirty};
    try{
      const part=recipeBasePartStartCreation(technical,origin,breakdown);if(!part)return null;
      app.syntheticRecipes=app.syntheticRecipes||{articles:{}};
      app.syntheticRecipes.articles[part.id]=breakdownClone(breakdown.metadata);
      const local=solidWoodState(part.id);local.applied=breakdownClone(breakdown.wood);local.draft=null;
      // Manufacturing canonical rows never receive the F wood preview a second time.
      app.partDraft=QuotePartDraft.open(app.q,part.id,partContext());
      return part;
    }catch(error){Object.assign(app,previous);editor();message('No se pudo preparar la receta; no se agregó el artículo.',true);return null;}
  }
  function lineAction(action,button){if(!recipeCanEdit())return;return recipeBaseLineAction(action,button);}
  function filterLineCatalog(key,value){if(!recipeCanEdit()||!['query','family'].includes(key))return;return recipeBaseFilterLineCatalog(key,value);}
  function partInput(el,repaint){if(!recipeCanEdit())return true;return recipeBasePartInput(el,repaint);}
  function solidWoodOpen(id,componentId='',historicalId=''){if(!recipeCanEdit())return false;return recipeBaseSolidWoodOpen(id,componentId,historicalId);}
  function solidWoodSet(key,value){if(!recipeCanEdit())return false;return recipeBaseSolidWoodSet(key,value);}
  function solidWoodApply(){if(!recipeCanEdit())return false;return recipeBaseSolidWoodApply();}
  function solidWoodAction(action,id=app.openPartId,componentId=''){if(!recipeCanEdit())return false;return recipeBaseSolidWoodAction(action,id,componentId);}
  function solidWoodApplyCnc(itemId,componentId){if(!recipeCanEdit())return false;return recipeBaseSolidWoodApplyCnc(itemId,componentId);}
  function recipeImage(product,variant){const imageId=variant?.imageId||product.imageId;return '<figure class="recipe-product-figure"><img class="line-product-image" src="'+esc(DemoRecipeCatalog.images[imageId]||'')+'" alt="'+esc((variant?.articleLabel||product.name)+' · imagen ilustrativa sintética')+'" width="240" height="160"><figcaption>'+ (DemoRecipeCatalog.imageKinds[imageId]==='IA'?'Imagen ilustrativa generada con IA':'Ilustración geométrica sintética')+'</figcaption></figure>';}
  function lineVariantSummary(product){
    const variant=lineState().productId===product.id&&product.variants.find(v=>v.id===lineState().variantId);
    if(!variant)return '<p class="meta">Selecciona una variante para consultar su imagen, medidas y receta.</p>';
    if(!variant.recipeId)return recipeBaseLineVariantSummary(product);
    const rec=DemoRecipeCatalog.recipe(variant.recipeId),fields=[['Artículo',variant.articleLabel],['SKU de muestra',variant.sku],['Descripción',variant.description],['Medidas terminadas',rec.finishedDimensions],['Material',variant.materials],['Acabados',variant.finishes],['Receta',rec.wood.length+' componentes de madera · '+rec.hardware.length+' herrajes']];
    return '<dl class="line-variant-summary">'+fields.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl><p class="recipe-preview-note">Receta de la referencia local. Madera y CNC siguen pendientes de validación; los importes históricos no confirman costos vigentes.</p>';
  }
  function lineResults(){
    const state=lineState(),normalize=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
    const matches=lineProducts().filter(product=>(!state.family||product.family===state.family)&&normalize(product.name+' '+product.family+' '+product.variants.map(v=>v.name+' '+v.materials).join(' ')).includes(normalize(state.query.trim())));
    if(!matches.length)return '<p class="line-empty" role="status">Sin coincidencias. Prueba otro nombre o familia.</p>';
    return '<div class="line-explore"><h4>'+(!state.query&&!state.family?'Explorar catálogo':'Resultados')+'</h4><p>Elige una variante antes de agregar el producto.</p></div><div class="line-products recipe-catalog-products">'+matches.map(product=>{const selected=state.productId===product.id&&product.variants.find(v=>v.id===state.variantId),expanded=state.detailsProductId===product.id;return '<article class="line-product recipe-catalog-card '+(selected?'is-selected':'')+'" data-line-product="'+esc(product.id)+'">'+recipeImage(product,selected)+'<div class="recipe-product-content"><div class="line-product-copy"><small>'+esc(product.family)+'</small><h4>'+esc(product.name)+'</h4><p>'+esc(selected?.description||product.description)+'</p></div><div class="line-variant-choice">'+lineVariantSelect(product)+'</div><div class="line-card-actions"><button type="button" class="line-details-toggle" data-action="line-details-toggle" data-product="'+esc(product.id)+'" aria-controls="line-detail-'+esc(product.id)+'" aria-expanded="'+expanded+'">'+(expanded?'Ocultar datos técnicos':'Ver datos técnicos')+'</button>'+lineUseButton(product)+'</div><div class="line-product-detail" id="line-detail-'+esc(product.id)+'" '+(expanded?'':'hidden')+'>'+lineVariantSummary(product)+'</div></div></article>';}).join('')+'</div>';
  }
  function lineCatalogPanel(){
    const state=lineState(),families=[...new Set(lineProducts().map(p=>p.family))];
    return '<section class="line-catalog recipe-catalog" aria-labelledby="line-catalog-title"><div class="line-catalog-head"><div><h3 id="line-catalog-title">Catálogo de productos · simulación</h3><p>Productos y recetas de la referencia local; importes históricos pendientes de validación.</p></div><button type="button" class="quiet" data-action="line-cancel" aria-label="Cerrar catálogo">Cerrar</button></div><div class="line-search"><div class="field"><label for="line-search">Buscar producto</label><input type="search" id="line-search" maxlength="120" placeholder="Nombre, familia o material" value="'+esc(state.query)+'"></div><div class="field"><label for="line-family">Familia</label><select id="line-family"><option value="">Todas las familias</option>'+families.map(f=>'<option value="'+esc(f)+'" '+(state.family===f?'selected':'')+'>'+esc(f)+'</option>').join('')+'</select></div></div><div id="line-results" aria-live="polite">'+lineResults()+'</div></section>';
  }
  function recipeDirectoryHtml(item){
    const meta=recipeEntry(item.id);if(!meta)return recipeBaseRecipeDirectoryHtml(item);
    const rec=DemoRecipeCatalog.recipe(meta.recipeId);if(!rec)return '';
    const observations=(rec.observations||[]).map(row=>'<li>'+esc(row.name)+': '+esc(row.quantity??'Pendiente')+' '+esc(row.unit)+'<small>'+esc(row.status)+'</small></li>').join('');
    return '<details class="article-study-source synthetic-recipe-source"><summary>Receta de referencia · consulta técnica y pendientes</summary><p>'+esc(rec.description)+'</p><p>'+esc(rec.finishedDimensions)+' · Cantidades por producto; la cantidad comercial se aplica una sola vez.</p><ul>'+rec.wood.map(w=>'<li>'+esc(w.name)+' · '+esc(w.quantityPerProduct)+' pieza(s)/producto · '+esc(w.width)+' × '+esc(w.length)+' cm · '+esc(w.thickness)+' pulgadas</li>').join('')+rec.hardware.map(h=>'<li>'+esc(h.name)+' · '+esc(h.quantity)+' '+esc(h.unit)+'/producto</li>').join('')+'</ul><ul>'+observations+'</ul><p>'+esc(rec.limits)+'</p></details>';
  }
  function breakdownDetailedSections(item,row){if(!recipeEntry(item.id))return recipeBaseBreakdownDetailedSections(item,row);return recipeDirectoryHtml(item)+recipeOriginalDetailedSections(item,row);}
  function breakdownSetField(el,repaint=false){
    if(!recipeCanEdit())return;
    recipeBaseBreakdownSetField(el,repaint);
    const draft=app.breakdownEditor,meta=recipeEntry(draft?.itemId);
    const field=el.dataset.breakField,entry=meta?.hardware.find(h=>h.id===draft?.value?.id);
    if(draft&&entry&&['purchaseQuantity','purchaseUnit','unit'].includes(field)&&!Object.keys(draft.numericErrors||{}).length){if((recipeModes(draft.itemId)[entry.id]||entry.mode)!=='MANUAL')draft.forceDirty=true;draft.syntheticRecipeManual=true;draft.value.economicReviewed=false;draft.value.purchaseQuality='pending';if(['purchaseUnit','unit'].includes(field)&&draft.value.purchaseUnit!==entry.unit){draft.value.unitPrice='';draft.value.purchaseQuantity='';}}
  }
  function breakdownSave(){
    if(!recipeCanEdit())return false;
    const draft=app.breakdownEditor,id=draft?.itemId,materialId=draft?.value?.id,manual=draft?.syntheticRecipeManual;
    const result=recipeBaseBreakdownSave();
    if(result&&app.partDraft?.itemId===id){if(manual)app.partDraft.syntheticRecipeModes={...recipeModes(id),[materialId]:'MANUAL'};recipeSyncQuote(app.partDraft.quote,id);}
    return result;
  }
  function partPaint(){const tx=app.partDraft;if(tx&&recipeCanEdit()&&partSameContext(tx.context))recipeSyncQuote(tx.quote,tx.itemId);return recipeBasePartPaint();}
  function partCandidate(){const tx=app.partDraft;if(tx&&recipeCanEdit()&&partSameContext(tx.context)){recipeSyncQuote(tx.quote,tx.itemId);if(tx.syntheticRecipeError)throw Error(tx.syntheticRecipeError);}return recipeBasePartCandidate();}
  function partDraftDirty(){const tx=app.partDraft,meta=recipeEntry(tx?.itemId);return recipeBasePartDraftDirty()||!!(meta&&tx&&Object.entries(tx.syntheticRecipeModes||{}).some(([id,mode])=>meta.hardware.find(h=>h.id===id)?.mode!==mode));}
  function partApply(){
    if(!recipeCanEdit())return false;
    const tx=app.partDraft,id=tx?.itemId,result=recipeBasePartApply();
    if(result){const modes=tx?.syntheticRecipeModes||{},meta=recipeEntry(id);if(meta){for(const h of meta.hardware){if(modes[h.id])h.mode=modes[h.id];const m=app.q.manufacturing?.items.find(r=>r.itemId===id)?.materials.find(m=>m.id===h.id);if(h.mode==='AUTO'&&m)h.lastAutoQuantity=m.purchaseQuantity;}}}
    return result;
  }
  function partDiscard(){return recipeBasePartDiscard();}
`;
