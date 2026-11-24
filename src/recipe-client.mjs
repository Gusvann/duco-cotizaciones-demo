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
    for(const h of meta.hardware){
      const material=row.materials.find(m=>m.id===h.id);
      if(!material||(modes[h.id]||h.mode)!=='AUTO'||material.purchaseUnit!==h.unit)continue;
      const quantity=String(item.quantity??''),perProduct=String(material.quantity??'');
      if(!/^\d+(?:\.\d{1,3})?$/.test(quantity)||!/^\d+(?:\.\d{1,3})?$/.test(perProduct)){material.purchaseQuantity='';continue;}
      try{material.purchaseQuantity=h.localPurchase
        ?localRecipeRatio(D,h.localPurchase.quantity,h.localPurchase.articleQuantity,quantity,3)
        :DemoRecipeCatalog.scaled(perProduct,quantity);}
      catch(error){material.purchaseQuantity='';if(tx)tx.error=tx.syntheticRecipeError=error.message;}
      const sub=app.breakdownEditor;
      if(sub?.itemId===id&&sub.value?.id===h.id&&!sub.syntheticRecipeManual)sub.value.purchaseQuantity=material.purchaseQuantity;
    }
    for(const source of meta.localProcessRates||[]){
      const process=row.processes.find(value=>value.id===source.id);
      if(!process||(modes[source.id]||source.mode)==='MANUAL')continue;
      try{
        if(source.wholeQuantity)process.quantity=localRecipeRatio(D,source.wholeQuantity,meta.sourceArticleQuantity,item.quantity,3);
        if(source.manualAmount)process.source.netAmount=localRecipeRatio(D,source.manualAmount,meta.sourceArticleQuantity,item.quantity,2);
      }catch(error){if(tx)tx.error=tx.syntheticRecipeError=error.message;}
    }
  }
  function lineStructuredBreakdown(variant){
    if(variant?.localBreakdown){
      if(!recipeCanEdit())throw Error('Este borrador no admite cambios.');
      return copyApprovedBreakdown(variant.localBreakdown,lineState().productId,variant.id,uid,D);
    }
    if(!variant?.recipeId)return recipeBaseLineStructuredBreakdown(variant);
    if(!recipeCanEdit())throw Error('Este borrador no admite cambios.');
    return DemoRecipeCatalog.instantiate(variant.recipeId,uid,'1');
  }
  function partStartCreation(technical,origin,breakdown=null){
    if(!recipeCanEdit())return null;
    if(!breakdown?.metadata)return recipeBasePartStartCreation(technical,origin,breakdown);
    if(app.partDraft&&partDraftDirty())return null;
    const approved=breakdown.metadata.source==='APPROVED_LOCAL_RECIPE';
    const rec=approved?breakdown.metadata:DemoRecipeCatalog.recipe(breakdown.metadata.recipeId);
    if(!rec||origin?.productId!==rec.productId||origin?.variantId!==rec.variantId)return null;
    const previous={q:app.q,solidWoodLocal:app.solidWoodLocal?{context:app.solidWoodLocal.context,articles:new Map(app.solidWoodLocal.articles)}:null,syntheticRecipes:app.syntheticRecipes?{...app.syntheticRecipes,articles:{...app.syntheticRecipes.articles}}:null,lineOrigins:new Map(app.lineOrigins),technicalDrafts:new Map(app.technicalDrafts),deferredPartIds:new Set(app.deferredPartIds),openPartId:app.openPartId,partDraft:app.partDraft,breakdownEditor:app.breakdownEditor,dirty:app.dirty};
    try{
      const part=recipeBasePartStartCreation(technical,origin,breakdown);if(!part)return null;
      app.syntheticRecipes=app.syntheticRecipes||{articles:{}};
      app.syntheticRecipes.articles[part.id]=breakdownClone(breakdown.metadata);
      const local=solidWoodState(part.id);local.applied=breakdownClone(breakdown.wood);local.draft=null;
      if(approved&&breakdown.workshop)local.workshop=breakdownClone(breakdown.workshop);
      if(approved&&breakdown.boardSettings)local.boardSettings=breakdownClone(breakdown.boardSettings);
      // Manufacturing canonical rows never receive the F wood preview a second time.
      app.partDraft=QuotePartDraft.open(app.q,part.id,partContext());
      return part;
    }catch(error){Object.assign(app,previous);editor();message('No se pudo preparar la receta; no se agregó el artículo.',true);return null;}
  }
  function lineAction(action,button){
    if(!recipeCanEdit())return;
    if(action==='line-back-results'){
      if(lineState().open)focusLine('[data-action="line-select-product"][aria-pressed="true"]');
      return;
    }
    if(action!=='line-select-product')return recipeBaseLineAction(action,button);
    const state=lineState();
    if(!state.open||app.step!==1||app.partContinuation||app.breakdownContinuation)return;
    const product=lineProducts().find(row=>row.id===button.dataset.product);
    if(!product)return;
    if(state.productId!==product.id){
      state.productId=product.id;
      state.variantId='';
      state.detailsProductId='';
      refreshRecipeCatalogChoice(product);
    }
    requestAnimationFrame(()=>{
      const detail=$('#line-catalog-detail'),results=$('#line-catalog-products');
      if(results?.getBoundingClientRect&&detail?.getBoundingClientRect&&
          results.getBoundingClientRect().bottom<=detail.getBoundingClientRect().top){
        $('#line-catalog-product-title')?.focus({preventScroll:true});
        detail.querySelector('.recipe-catalog-card')?.scrollIntoView({block:'start'});
      }
    });
  }
  function filterLineCatalog(key,value){if(!recipeCanEdit()||!['query','family'].includes(key))return;return recipeBaseFilterLineCatalog(key,value);}
  function partInput(el,repaint){if(!recipeCanEdit())return true;return recipeBasePartInput(el,repaint);}
  function solidWoodOpen(id,componentId='',historicalId=''){if(!recipeCanEdit())return false;return recipeBaseSolidWoodOpen(id,componentId,historicalId);}
  function solidWoodSet(key,value){if(!recipeCanEdit())return false;return recipeBaseSolidWoodSet(key,value);}
  function solidWoodApply(){if(!recipeCanEdit())return false;return recipeBaseSolidWoodApply();}
  function solidWoodAction(action,id=app.openPartId,componentId=''){if(!recipeCanEdit())return false;return recipeBaseSolidWoodAction(action,id,componentId);}
  function solidWoodApplyCnc(itemId,componentId){if(!recipeCanEdit())return false;return recipeBaseSolidWoodApplyCnc(itemId,componentId);}
  function recipeImage(product,variant){
    const imageId=variant?.imageId||product.imageId,image=DemoRecipeCatalog.images[imageId];
    if(!image)return '<p class="recipe-preview-note">Imagen pendiente.</p>';
    const tone=variant&&DemoRecipeCatalog.recipe(variant.recipeId)?.illustratedTone;
    const caption=DemoRecipeCatalog.imageKinds[imageId]==='IA'?'Imagen ilustrativa generada con IA':'Ilustración geométrica sintética';
    return '<figure class="recipe-product-figure"><img class="line-product-image" src="'+esc(image)+'" alt="'+esc(variant?.articleLabel||product.name)+'" width="240" height="160" decoding="async"><figcaption>'+caption+(tone?' · Tono ilustrado: '+esc(tone):'')+'</figcaption></figure>';
  }
  function lineVariantSummary(product){
    const variant=lineState().productId===product.id&&product.variants.find(v=>v.id===lineState().variantId);
    if(!variant)return '<p class="meta">Selecciona una variante para consultar su imagen, medidas y receta.</p>';
    if(!variant.recipeId)return recipeBaseLineVariantSummary(product);
    const rec=DemoRecipeCatalog.recipe(variant.recipeId),fields=[['Artículo',variant.articleLabel],['SKU de muestra',variant.sku],['Descripción',variant.description],['Medidas terminadas',rec.finishedDimensions],['Material',variant.materials],['Acabados',variant.finishes],['Receta',rec.wood.length+' componente'+(rec.wood.length===1?'':'s')+' de madera · '+rec.hardware.length+' herrajes'+(rec.fabrication?' · Tableros ('+rec.boards.length+') · Herrería ('+rec.metal.length+')':'')]];
    const note=rec.syntheticPricing?'Despiece y tarifas ficticias para probar la cotización.':'Despiece de fabricación con tarifas históricas editables. Verifica su vigencia antes de cerrar una cotización.';
    return '<dl class="line-variant-summary">'+fields.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl><p class="recipe-preview-note">'+note+'</p>'+expandedCatalogReference(rec);
  }
  function lineResults(){
    const state=lineState(),normalize=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
    const query=normalize(state.query.trim());
    const matches=lineProducts().filter(product=>(!state.family||product.family===state.family)&&
      normalize(product.name+' '+product.family+' '+product.variants.map(v=>v.name+' '+v.materials).join(' ')).includes(query));
    if(!matches.length)return '<p class="line-empty" role="status">Sin coincidencias. Prueba otro nombre o familia.</p>';
    const current=matches.find(product=>product.id===state.productId)||matches[0];
    const rows=matches.map(product=>'<li><button type="button" class="recipe-catalog-row" data-action="line-select-product" data-product="'+
      esc(product.id)+'" aria-controls="line-catalog-detail" aria-pressed="'+(current.id===product.id)+'">'+
      (DemoRecipeCatalog.images[product.imageId]?'<img class="recipe-catalog-thumb" src="'+esc(DemoRecipeCatalog.thumbnails[product.imageId]||DemoRecipeCatalog.images[product.imageId])+'" alt="" width="56" height="56" decoding="async" loading="lazy">':'')+
      '<span><strong>'+esc(product.name)+'</strong><small>'+esc(product.family)+'</small></span></button></li>').join('');
    return '<div class="recipe-catalog-layout"><ul id="line-catalog-products" class="recipe-catalog-products" aria-label="Resultados del catálogo">'+rows+
      '</ul><div id="line-catalog-detail">'+recipeCatalogDetail(current,state)+'</div></div>';
  }
  function recipeCatalogDetail(product,state){
    const id=esc(product.id);
    const variant=state.productId===product.id?product.variants.find(row=>row.id===state.variantId):null;
    const expanded=state.detailsProductId===product.id;
    return '<article class="recipe-catalog-card" data-line-product="'+id+'" aria-labelledby="line-catalog-product-title">'+
      '<button type="button" class="quiet recipe-catalog-back" data-action="line-back-results">← Volver a resultados</button>'+
      recipeImage(product,variant)+
      '<div class="recipe-product-content"><div class="line-product-copy"><small>'+esc(product.family)+'</small>'+
      '<h4 id="line-catalog-product-title" tabindex="-1">'+esc(product.name)+'</h4><p>'+esc(variant?.description||product.description)+'</p></div>'+
      '<div class="line-card-actions"><div class="field line-variant-choice">'+lineVariantSelect(product)+'</div>'+lineUseButton(product)+'</div>'+
      '<button type="button" class="line-details-toggle" data-action="line-details-toggle" data-product="'+id+
      '" aria-controls="line-detail-'+id+'" aria-expanded="'+expanded+'">'+(expanded?'Ocultar datos técnicos':'Ver datos técnicos')+'</button>'+
      '<div class="line-product-detail" id="line-detail-'+id+'" '+(expanded?'':'hidden')+'>'+(expanded?lineVariantSummary(product):'')+'</div></div></article>';
  }
  function refreshRecipeCatalogChoice(product){
    const detail=$('#line-catalog-detail');
    if(!detail)return;
    detail.innerHTML=recipeCatalogDetail(product,lineState());
    quoteRoot.querySelectorAll('[data-action="line-select-product"]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.product===product.id));
    });
  }
  function lineCatalogPanel(){
    const state=lineState(),families=[...new Set(lineProducts().map(p=>p.family))];
    const gallery=globalThis.DemoPublicRecipes?'<a class="quiet" href="catalogo.html" target="_blank" rel="noopener">Ver galería</a>':'';
    return '<section class="line-catalog recipe-catalog" aria-labelledby="line-catalog-title">'+
      '<div class="line-catalog-head"><h3 id="line-catalog-title">Catálogo de productos</h3>'+gallery+
      '<button type="button" class="quiet" data-action="line-cancel" aria-label="Cerrar catálogo">Cerrar</button></div>'+
      '<div class="line-search"><div class="field"><label for="line-search">Buscar producto</label>'+
      '<input type="search" id="line-search" maxlength="120" placeholder="Nombre, familia o material" value="'+esc(state.query)+'"></div>'+
      '<div class="field"><label for="line-family">Familia</label><select id="line-family"><option value="">Todas las familias</option>'+
      families.map(f=>'<option value="'+esc(f)+'" '+(state.family===f?'selected':'')+'>'+esc(f)+'</option>').join('')+
      '</select></div></div><div id="line-results">'+lineResults()+'</div></section>';
  }
  function recipeDirectoryHtml(item){
    return recipeEntry(item.id)?'':recipeBaseRecipeDirectoryHtml(item);
  }
  function breakdownDetailedSections(item,row){if(!recipeEntry(item.id))return recipeBaseBreakdownDetailedSections(item,row);return recipeDirectoryHtml(item)+recipeOriginalDetailedSections(item,row);}
  function breakdownSetField(el,repaint=false){
    if(!recipeCanEdit())return;
    const oldPurchaseUnit=app.breakdownEditor?.value?.purchaseUnit;
    recipeBaseBreakdownSetField(el,repaint);
    const draft=app.breakdownEditor,meta=recipeEntry(draft?.itemId);
    const field=el.dataset.breakField,entry=meta?.hardware.find(h=>h.id===draft?.value?.id);
    if(draft&&meta?.localProcessRates?.some(value=>value.id===draft.value?.id)&&['quantity','quantityScope','source.netAmount','detail.unitPrice'].includes(field)&&!Object.keys(draft.numericErrors||{}).length){
      draft.forceDirty=true;draft.syntheticRecipeManualProcess=true;
    }
    if(draft&&entry&&['purchaseQuantity','purchaseUnit','unit'].includes(field)&&!Object.keys(draft.numericErrors||{}).length){
      if((recipeModes(draft.itemId)[entry.id]||entry.mode)!=='MANUAL')draft.forceDirty=true;
      draft.syntheticRecipeManual=true;
      if(['purchaseUnit','unit'].includes(field)&&draft.value.purchaseUnit!==oldPurchaseUnit){
        draft.value.unitPrice='';draft.value.purchaseQuantity='';draft.value.economicReviewed=false;draft.value.purchaseQuality='pending';
      }
    }
  }
  function breakdownSave(){
    if(!recipeCanEdit())return false;
    const draft=app.breakdownEditor,id=draft?.itemId,materialId=draft?.value?.id,manual=draft?.syntheticRecipeManual||draft?.syntheticRecipeManualProcess;
    const result=recipeBaseBreakdownSave();
    if(result&&app.partDraft?.itemId===id){if(manual)app.partDraft.syntheticRecipeModes={...recipeModes(id),[materialId]:'MANUAL'};recipeSyncQuote(app.partDraft.quote,id);}
    return result;
  }
  function partPaint(){const tx=app.partDraft;if(tx&&recipeCanEdit()&&partSameContext(tx.context))recipeSyncQuote(tx.quote,tx.itemId);return recipeBasePartPaint();}
  function partCandidate(){const tx=app.partDraft;if(tx&&recipeCanEdit()&&partSameContext(tx.context)){recipeSyncQuote(tx.quote,tx.itemId);if(tx.syntheticRecipeError)throw Error(tx.syntheticRecipeError);}return recipeBasePartCandidate();}
  function partDraftDirty(){const tx=app.partDraft,meta=recipeEntry(tx?.itemId);return recipeBasePartDraftDirty()||!!(meta&&tx&&Object.entries(tx.syntheticRecipeModes||{}).some(([id,mode])=>[...meta.hardware,...(meta.localProcessRates||[])].find(h=>h.id===id)?.mode!==mode));}
  function partApply(){
    if(!recipeCanEdit())return false;
    const tx=app.partDraft,id=tx?.itemId,result=recipeBasePartApply();
    if(result){const modes=tx?.syntheticRecipeModes||{},meta=recipeEntry(id);if(meta){for(const h of meta.hardware){if(modes[h.id])h.mode=modes[h.id];const m=app.q.manufacturing?.items.find(r=>r.itemId===id)?.materials.find(m=>m.id===h.id);if(h.mode==='AUTO'&&m)h.lastAutoQuantity=m.purchaseQuantity;}for(const source of meta.localProcessRates||[])if(modes[source.id])source.mode=modes[source.id];}}
    return result;
  }
  function partDiscard(){return recipeBasePartDiscard();}
`;
