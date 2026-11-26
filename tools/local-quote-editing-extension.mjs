// Local quotation controls layered over the pinned cotizador. Monetary
// suggestions use the same cent rounding as the commercial line.
export function suggestPrototypePrice(domain, item, articleCostCents) {
  if(!item?.prototype)return null;
  return suggestMarginPrice(domain,item,articleCostCents,item.prototypeMargin??'40');
}

export function suggestMarginPrice(domain,item,articleCostCents,targetMargin) {
  if (!Number.isSafeInteger(articleCostCents) || articleCostCents < 0) return null;
  try {
    const margin = domain.decimal(targetMargin, 2, 99.99);
    const quantity = domain.decimal(item.quantity, 3, 100000);
    const discount = domain.decimal(item.discount, 2, 100);
    if (margin === null || !quantity || discount === null || discount === 10000) return null;
    const centsToText = cents => Math.floor(cents / 100) + '.' + String(cents % 100).padStart(2, '0');
    const reachesMargin = cents => {
      const actual = domain.line({...item, unitPrice:centsToText(cents), tax:'0'});
      return actual?.net > 0 &&
        BigInt(actual.net) * BigInt(10000 - margin) >= BigInt(articleCostCents) * 10000n;
    };
    let low = 1;
    let high = 1000000000; // The existing unitPrice limit is MXN 10,000,000.
    if (!reachesMargin(high)) return null;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (reachesMargin(middle)) high = middle;
      else low = middle + 1;
    }
    return {unitPrice:centsToText(low), unitPriceCents:low, costCents:articleCostCents};
  } catch {
    return null; // Invalid capture stays pending; no amount is supplied to the quote.
  }
}

function prototypePriceControl(item, index, totals) {
  const estimate = prototypeEstimate(item, totals);
  const marginField=item.prototype?'prototypeMargin':'targetMargin';
  const suggestion = suggestMarginPrice(D,item,estimate.complete?estimate.cents:null,item[marginField]);
  const cost = estimate.cents === null ? 'Pendiente' : QuotePdf.money(estimate.cents) + (estimate.complete ? '' : ' · parcial');
  return '<div class="prototype-price" aria-label="Precio estimado del artículo">'+
    (item.prototype?'<strong>Prototipo</strong>':'')+'<small>Costo asignado '+esc(cost)+'</small>'+
    field('items.'+index+'.'+marginField,'Margen objetivo %',{type:'number',max:99.99})+
    '<output>'+ (suggestion ? 'Precio unitario sugerido '+QuotePdf.money(suggestion.unitPriceCents)+' antes de IVA' : 'Precio sugerido pendiente')+'</output>'+
    (suggestion&&editable()?'<button type="button" class="quiet" data-apply-prototype-price="'+esc(item.id)+'">Usar precio sugerido</button>':'')+'</div>';
}

function prototypeEstimate(item, totals) {
  if(totals.estimate){
    const row=totals.estimate.items.find(entry=>entry.itemId===item.id);
    return {cents:row?.hasAmount?row.assignedNet:null,complete:!!row?.hasAmount&&!row.partial&&prototypeCostsReady(app.q,item.id,totals)};
  }
  const allocation = totals.allocation?.items?.find(row=>row.itemId===item.id);
  const captured = localRows.articleEstimate(item.id);
  const cents = allocation?.assignedNet;
  const resolved = prototypeCostsReady(app.q, item.id, totals);
  if (!Number.isSafeInteger(cents) || cents < 0) return {complete:false,cents:captured.cents};
  if (!captured.hasWork) return {complete:resolved && cents>0,cents:cents||null};
  // Local fabrication amounts can contain a material already accounted for by
  // the canonical projection. Do not add two totals for the same work.
  if (captured.extraWood === null || !resolved || !captured.complete) {
    return {complete:false,cents:captured.cents ?? (cents||null)};
  }
  const assigned = cents + captured.extraWood;
  return {complete:Number.isSafeInteger(assigned)&&(assigned>0||captured.cents===0),cents:Number.isSafeInteger(assigned)?assigned:null};
}

export function prototypeCostsReady(quote, itemId, totals) {
  if(totals.completeCosts===true)return true;
  const codes=['COST_INCOMPLETE','RESOURCE_INCOMPLETE','WORK_SOURCE','SCOPE_IMPACT','NEED_MISSING',
    'NEED_UNRESOLVED','COMPONENT_UNLINKED','MANUFACTURING_PENDING'];
  const unresolved=(totals.validationIssues||[]).filter(issue=>codes.includes(issue.code));
  if(!unresolved.length)return false;
  return unresolved.every(issue=>{
    const target=issue.target||{},rows=quote[target.entity];
    const owner=target.parentId || target.context?.itemId || (Array.isArray(rows)?rows.find(row=>row.id===target.entityId)?.itemId:'');
    // A general dependency may still change this article's assigned cost.
    return !!owner&&owner!==itemId;
  });
}

function supplierResultMarkup(rows, status, kind) {
  const action=kind==='general'?'data-general-action':'data-break-action';
  const text={loading:'Buscando proveedores…',empty:'Sin coincidencias.',error:'No se pudo consultar el maestro de proveedores.'}[status]||'';
  return '<p role="status" class="meta"'+(text?'':' hidden')+'>'+esc(text)+'</p>'+
    rows.map(row=>'<button type="button" class="quiet" '+action+'="choose-provider" data-id="'+esc(row.id)+'">'+esc(row.name)+'</button>').join('');
}

function supplierResultRegion(rows, draft, kind) {
  return '<div class="provider-matches" data-provider-matches="'+kind+'" aria-label="Proveedores encontrados">'+
    supplierResultMarkup(rows,draft?.providerSearch?.status,kind)+'</div>';
}

function supplierSearch(el, draft, kind, immediate=false) {
  if (!draft || !editable() || app.busy || app.operation) return;
  const holder=kind==='general'?draft.value:draft;
  const query=String(el.value||'').trim().slice(0,120);
  const context={quote:app.q,epoch:app.epoch,owner:app.user?.email};
  const region=el.closest?.('.break-provider')?.querySelector('[data-provider-matches]');
  const search={status:query?'loading':''};
  clearTimeout(draft.providerSearch?.timer);
  draft.providerSearch=search;
  holder.providerQuery=el.value;
  holder.providerOptions=[];
  if(region)region.innerHTML=supplierResultMarkup([],search.status,kind);
  if(!query)return;
  const isCurrent=()=>app.breakdownEditor===draft && draft.providerSearch===search && app.q===context.quote &&
    app.epoch===context.epoch && app.user?.email===context.owner && !app.operation && editable();
  const lookup=async()=>{
    if(!isCurrent())return;
    try {
      const result=await api('search',{kind:'suppliers',query,providerId:'',areaId:'',profileId:''});
      if(!isCurrent())return;
      holder.providerOptions=(Array.isArray(result?.items)?result.items:[])
        .filter(row=>typeof row?.id==='string'&&typeof row.name==='string').slice(0,15);
      search.status=holder.providerOptions.length?'':'empty';
    } catch {
      if(!isCurrent())return;
      search.status='error';
    }
    const current=quoteRoot.querySelector('[data-provider-matches="'+kind+'"]')||region;
    if(current)current.innerHTML=supplierResultMarkup(holder.providerOptions,search.status,kind);
  };
  if(immediate)return lookup();
  search.timer=setTimeout(lookup,240);
}

export function copyApprovedBreakdown(template, productId, variantId, uid, domain) {
  if (!template || !Array.isArray(template.materials) || !Array.isArray(template.groups) ||
      !Array.isArray(template.processes) || !Array.isArray(template.wood)) {
    throw Error('La receta aprobada no contiene un despiece válido.');
  }
  const originalQuantity = domain.decimal(template.articleQuantity, 3, 100000);
  if (!originalQuantity) throw Error('Falta la unidad de referencia de la receta aprobada.');
  const result = JSON.parse(JSON.stringify(template));
  const groups=new Map(), materials=new Map(), processes=new Map(), purchases=new Map(), woodIds=new Map();
  const assign=(rows,map,tag)=>{
    for(const row of rows){
      if(!row.id||map.has(row.id))throw Error('La receta aprobada repite un componente.');
      map.set(row.id,uid(tag));
    }
  };
  assign(result.groups,groups,'GRP');
  assign(result.materials,materials,'MAT');
  assign(result.processes,processes,'PRC');
  assign(result.wood,woodIds,'F');
  for(const entry of result.wood)if(entry.groupId&&!groups.has(entry.groupId))groups.set(entry.groupId,uid('FG'));
  const target=value=>{
    if(!value)return value;
    return {...value,groupId:groups.get(value.groupId)||'',componentIds:(value.componentIds||[]).map(id=>materials.get(id)).filter(Boolean)};
  };
  const hardware=[];
  for(const group of result.groups)group.id=groups.get(group.id);
  for(const material of result.materials){
    const originalId=material.id;
    if (material.purchaseGroup && !purchases.has(material.purchaseGroup))purchases.set(material.purchaseGroup,uid('BUY'));
    material.id=materials.get(originalId);
    material.groupId=groups.get(material.groupId)||'';
    material.purchaseGroup=purchases.get(material.purchaseGroup)||'';
    const originalPurchase=material.purchaseQuantity;
    const purchaseSource=originalPurchase?{quantity:originalPurchase,articleQuantity:template.articleQuantity}:null;
    if(purchaseSource&&material.purchaseUnit){
      material.purchaseQuantity=localRecipeRatio(domain,originalPurchase,template.articleQuantity,'1',3);
      hardware.push({id:material.id,unit:material.purchaseUnit,mode:'AUTO',localPurchase:purchaseSource,lastAutoQuantity:material.purchaseQuantity});
    }
  }
  const processRates=[];
  for(const process of result.processes){
    process.id=processes.get(process.id);
    process.target=target(process.target);
    process.materialId=materials.get(process.materialId)||'';
    if(process.source?.includedInMaterialId)process.source.includedInMaterialId=materials.get(process.source.includedInMaterialId)||'';
    const manualAmount=process.source?.kind==='manual'?process.source.netAmount:'';
    const wholeQuantity=process.quantityScope==='quote'?process.quantity:'';
    if(wholeQuantity)process.quantity=localRecipeRatio(domain,wholeQuantity,template.articleQuantity,'1',3);
    if(manualAmount)process.source.netAmount=localRecipeRatio(domain,manualAmount,template.articleQuantity,'1',2);
    if(wholeQuantity||manualAmount)processRates.push({id:process.id,wholeQuantity,manualAmount});
  }
  result.finishSystems=(result.finishSystems||[]).map(system=>({...system,id:uid('FNS'),target:target(system.target),
    layerIds:system.layerIds.map(id=>processes.get(id)).filter(Boolean)}));
  for(const piece of result.wood){
    piece.id=woodIds.get(piece.id);
    piece.groupId=groups.get(piece.groupId)||uid('FG');
    if(Array.isArray(piece.adjustment?.componentIds))piece.adjustment.componentIds=piece.adjustment.componentIds.map(id=>woodIds.get(id)).filter(Boolean);
  }
  if(result.workshop?.values?.['domino.componentId']){
    result.workshop.values['domino.componentId']=woodIds.get(result.workshop.values['domino.componentId'])||'';
  }
  result.boardSettings=Object.fromEntries(Object.entries(result.boardSettings||{}).filter(([id])=>materials.has(id))
    .map(([id,value])=>[materials.get(id),value]));
  result.metadata={source:'APPROVED_LOCAL_RECIPE',recipeId:variantId,variantId,productId,
    hardware,boards:[],woodIds:result.wood.map(piece=>piece.id),localProcessRates:processRates,sourceArticleQuantity:template.articleQuantity};
  return result;
}

function localRecipeRatio(domain, raw, sourceQuantity, nextQuantity, digits) {
  const amount=domain.decimal(raw,digits),source=domain.decimal(sourceQuantity,3,100000),next=domain.decimal(nextQuantity,3,100000);
  if(amount===null||!source||!next)return '';
  const result=(BigInt(amount)*BigInt(next)*2n+BigInt(source))/(2n*BigInt(source));
  if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('La cantidad de la receta excede el rango permitido.');
  const scale=10n**BigInt(digits),fraction=(result%scale).toString().padStart(digits,'0').replace(/0+$/,'');
  return (result/scale).toString()+(fraction?'.'+fraction:'');
}

async function refreshApprovedCatalog() {
  if(!globalThis.DucoPrivateApi?.catalog || !lineState().open)return;
  const quote=app.q,epoch=app.epoch;
  try{
    const {products}=await globalThis.DucoPrivateApi.catalog();
    if(app.q!==quote||app.epoch!==epoch||!lineState().open)return;
    approvedLocalProducts=(Array.isArray(products)?products:[]).filter(product=>
      typeof product?.id==='string'&&typeof product.name==='string'&&Array.isArray(product.variants));
    const search=$('#line-search'),active=document.activeElement===search,start=search?.selectionStart,end=search?.selectionEnd;
    refreshLineStart();
    if(active){const next=$('#line-search');next?.focus({preventScroll:true});if(start!=null)next?.setSelectionRange(start,end);}
  } catch {
    if(app.q===quote&&app.epoch===epoch&&lineState().open)message('No se pudo cargar el catálogo aprobado localmente.',true);
  }
}

function localRecipeControls(item, index) {
  const origin=app.lineOrigins.get(item.id);
  const newProduct=origin?.type==='NUEVO'||Object.hasOwn(item,'prototype');
  if(!newProduct)return '';
  const prototype=check('items.'+index+'.prototype','Es un prototipo');
  if(!globalThis.DucoPrivateApi?.lineStatus)return '<div class="quote-recipe-controls">'+prototype+'</div>';
  const state=localLineRequests.get(app.q.id+'|'+item.id),request=state?.request;
  const completed=request?.status==='approved';
  const savedRevision=window.DemoQuote.snapshot(app.q.id)?.summary?.savedRevision;
  const sameRevision=!!request&&request.revision===savedRevision&&request.versionId===app.q.versionId;
  const status=request?(completed?'Producto de línea aprobado':'Solicitud pendiente de Dirección')+(sameRevision?'':' · revisión anterior'):'';
  const explicitText=completed&&request.approvedBy?' · '+request.approvedBy+(request.approvedAt?' · '+request.approvedAt.slice(0,10):''):'';
  const action=(intent,label)=>'<button type="button" class="quiet" data-local-recipe-action="'+intent+'" data-item-id="'+esc(item.id)+'">'+label+'</button>';
  const submit=editable()&&!sameRevision?action('request','Solicitar alta como producto de línea'):'';
  const approval=state?.canApprove&&sameRevision&&request.status==='pending'&&!app.dirty&&!partDraftDirty()
    ?'<label class="check"><input type="checkbox" data-local-recipe-confirm> Autorizar como producto de línea</label>'+action('approve','Guardar autorización'):'';
  return '<div class="quote-recipe-controls">'+prototype+
    '<section aria-label="Alta como producto de línea">'+
    (status?'<p class="meta">'+esc(status+explicitText)+'</p>':'')+
    action('status',state?'Actualizar autorización':'Consultar autorización de Dirección')+submit+approval+
    '</section></div>';
}

async function handleLocalRecipeAction(button) {
  if(app.busy||app.operation)return;
  const privateApi=globalThis.DucoPrivateApi;
  const quoteId=app.q?.id,itemId=button.dataset.itemId,epoch=app.epoch,versionId=app.q?.versionId;
  const action=button.dataset.localRecipeAction;
  if(!privateApi||!app.q?.items.some(row=>row.id===itemId))return;
  const key=quoteId+'|'+itemId;
  const stillCurrent=()=>app.q?.id===quoteId&&app.q.versionId===versionId&&app.epoch===epoch;
  if(localLineActions.has(key))return;
  localLineActions.add(key);
  try{
    if(action==='request'){
      if(!editable())return;
      const saved=window.DemoQuote.snapshot(quoteId);
      const status=window.DemoQuote.summary(quoteId);
      if(!saved||status.dirty||status.hasPending||saved.quote.versionId!==versionId||!saved.quote.items.some(item=>item.id===itemId)){
        message('Guarda la receta de este artículo antes de solicitar el alta.',true);return;
      }
      await privateApi.requestLine({quoteId,itemId,versionId,revision:status.savedRevision});
    } else if(action==='approve') {
      const state=localLineRequests.get(key),request=state?.request;
      if(!state?.canApprove||request?.status!=='pending')return;
      const status=window.DemoQuote.summary(quoteId);
      if(status.dirty||status.hasPending||request.versionId!==versionId||request.revision!==status.savedRevision){
        message('Abre la revisión guardada de esta solicitud antes de autorizarla.',true);return;
      }
      if(!button.closest('section')?.querySelector('[data-local-recipe-confirm]')?.checked){
        message('Marca la autorización antes de guardarla.',true);return;
      }
      await privateApi.approveLine({id:request.id,revision:request.revision});
    } else if(action!=='status') return;
    const result=await privateApi.lineStatus({quoteId,itemId});
    if(stillCurrent()){localLineRequests.set(key,result);editor();}
  } catch(error) {
    if(stillCurrent())message([403,409,422].includes(error.status)?error.message:'No se confirmó la autorización. Consulta su estado antes de volver a intentar.',true);
  } finally {
    localLineActions.delete(key);
  }
}

function once(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Local quote editing anchor changed: '+before.slice(0,100));
  return source.replace(before,()=>after);
}

function privateClientAltaAllowed(){
  return app.localAuthenticatedRole==='account'&&typeof globalThis.DucoPrivateApi?.clientCreate==='function';
}

export function extendLocalQuoteEditing(source) {
  source=once(source,"const create=editable()&&['Account','Admin'].includes(app.user?.role)?",
    "const create=editable()&&(!globalThis.DucoPrivateApi||privateClientAltaAllowed())&&['Account','Admin'].includes(app.user?.role)?");
  source=once(source,"if(!editable()||app.busy||!['Account','Admin'].includes(app.user?.role))return;\n        if(!app.clientAlta)",
    "if(!editable()||app.busy||!['Account','Admin'].includes(app.user?.role)||(globalThis.DucoPrivateApi&&!privateClientAltaAllowed()))return;\n        if(!app.clientAlta)");
  source=once(source,"<p>El alta se registrará en el maestro como Pendiente de revisión. Podrás preparar un borrador; el envío esperará la validación administrativa.</p>'+",
    "'+(privateClientAltaAllowed()?'<p>El cliente quedará disponible en este espacio de trabajo.</p>':'<p>El alta se registrará en el maestro como Pendiente de revisión. Podrás preparar un borrador; el envío esperará la validación administrativa.</p>')+");
  source=once(source,"(app.lineCatalog?'<p class=\"warn\">Los cambios de esta sesión no modifican el catálogo de clientes.</p>':'')",
    "(app.lineCatalog&&!privateClientAltaAllowed()?'<p class=\"warn\">Los cambios de esta sesión no modifican el catálogo de clientes.</p>':'')");
  source=once(source,"(app.lineCatalog||state.sending?'disabled':'')+'>Crear en maestro</button>'",
    "((app.lineCatalog&&!privateClientAltaAllowed())||state.sending?'disabled':'')+'>'+(privateClientAltaAllowed()?'Crear cliente':'Crear en maestro')+'</button>'");
  source=once(source,"if(!state||result.requestId!==state.requestId)return;",
    `if(!state||result.requestId!==state.requestId)return;
    if(privateClientAltaAllowed()){
      const client=result.client;
      if(!client?.id||!client.name||client.status!=='Activo')throw Error('El alta local no devolvió un cliente confirmado.');
      app.clientAlta=null;
      app.clientAltaNotice='Cliente creado y seleccionado.';
      app.q.contact=client.contact||'';app.q.contactPhone=client.contactPhone||'';app.q.contactEmail=client.contactEmail||'';
      app.phoneDraft=null;
      applyClientChoice(client,'keep');return;
    }`);
  source=once(source,"if(!state||!state.open||state.sending||!editable()||!['Account','Admin'].includes(app.user?.role)||app.lineCatalog)return;",
    "if(!state||!state.open||state.sending||!editable()||!['Account','Admin'].includes(app.user?.role)||(app.lineCatalog&&!privateClientAltaAllowed()))return;");
  source=once(source,"if(!state?.uncertain||state.sending||!editable()||app.lineCatalog)return;",
    "if(!state?.uncertain||state.sending||!editable()||(app.lineCatalog&&!privateClientAltaAllowed()))return;");
  source=once(source,'      description: str(r.description, 1000),\n      quantity: num(r.quantity,',
    "      description: str(r.description, 1000),\n      ...(Object.hasOwn(r,'prototype') ? {prototype:bool(r.prototype),prototypeMargin:num(r.prototypeMargin??'40',2,99.99,`items.${i}.prototypeMargin`)} : {}),\n      quantity: num(r.quantity,");
  source=once(source,"const part=appendNormalItem(technical,origin,candidate);if(!part)return null;",
    "const part=appendNormalItem(technical,origin,candidate);if(!part)return null;\n    if(origin?.type==='NUEVO'){part.prototype=false;part.prototypeMargin='40';}");
  source=once(source,"row.processes=breakdown.processes||row.processes;",
    "row.processes=breakdown.processes||row.processes;row.finishSystems=breakdown.finishSystems||row.finishSystems;");
  source=once(source,"+guided+partPreviewHtml(r.id)+",
    "+localRecipeControls(r,i)+guided+partPreviewHtml(r.id)+");
  source=once(source,"+'</strong><em>'+status+'</em></span></td></tr>'",
    "+'</strong><em>'+status+'</em></span>'+prototypePriceControl(r,i,totals)+'</td></tr>'");
  source=once(source,"const refreshDerived = /^(items\\.\\d+\\.(quantity|unit|unitPrice|discount|tax)",
    "const refreshDerived = /^(items\\.\\d+\\.(quantity|unit|unitPrice|discount|tax|prototypeMargin|targetMargin)");
  source=once(source,'  async function handleClick(e) {', `  async function handleClick(e) {
    const recipeAction=e.target.closest('[data-local-recipe-action]');
    if(recipeAction){await handleLocalRecipeAction(recipeAction);return;}
    const applyPrice=e.target.closest('[data-apply-prototype-price]');
    if(applyPrice){
      if(!editable()||app.busy||app.operation||app.step!==3)return;
      const item=app.q.items.find(row=>row.id===applyPrice.dataset.applyPrototypePrice);
      if(!item)return;
      const estimate=prototypeEstimate(item,financialTotals());
      const suggestion=suggestMarginPrice(D,item,estimate.complete?estimate.cents:null,item.prototype?item.prototypeMargin:item.targetMargin);
      if(!suggestion)return;
      beginCapture();item.unitPrice=suggestion.unitPrice;
      const index=app.q.items.indexOf(item);
      app.inputErrors.delete(JSON.stringify(D.issue(app.q,'items.'+index+'.unitPrice','').target));
      dirty();editor();return;
    }`);
  source=once(source,"if(el.dataset.breakProviderQuery!==undefined&&app.breakdownEditor){app.breakdownEditor.providerQuery=el.value;return;}",
    "if(el.dataset.breakProviderQuery!==undefined&&app.breakdownEditor){supplierSearch(el,app.breakdownEditor,'breakdown');return;}\n    if(el.dataset.generalField==='providerQuery'&&app.breakdownEditor?.kind==='general'){supplierSearch(el,app.breakdownEditor,'general');return;}");
  const breakdownChoices="(draft.providerOptions||[]).map(p=>'<button type=\"button\" class=\"quiet\" data-break-action=\"choose-provider\" data-id=\"'+esc(p.id)+'\">'+esc(p.name)+(p.matchedService?' · '+esc(p.matchedService):'')+'</button>').join('')";
  if(source.split(breakdownChoices).length!==3)throw Error('No se encontraron los dos editores de proveedor.');
  source=source.replaceAll(breakdownChoices,"supplierResultRegion(draft.providerOptions||[],draft,'breakdown')");
  const generalChoices="(value.providerOptions||[]).map(provider=>'<button type=\"button\" class=\"quiet\" data-general-action=\"choose-provider\" data-id=\"'+esc(provider.id)+'\">'+esc(provider.name)+'</button>').join('')";
  source=once(source,generalChoices,"supplierResultRegion(value.providerOptions||[],draft,'general')");
  source=once(source,"if(action==='search-provider'&&draft){\n      const epoch=", "if(action==='search-provider'&&draft){\n      const search=quoteRoot.querySelector('[data-break-provider-query]');if(search)return supplierSearch(search,draft,'breakdown',true);\n      const epoch=");
  source=once(source,"if(action==='search-provider'){const epoch=app.epoch;try{const result=await api('search',{kind:'suppliers',query:draft.value.providerQuery",
    "if(action==='search-provider'){const search=quoteRoot.querySelector('[data-general-field=\"providerQuery\"]');if(search)return supplierSearch(search,draft,'general',true);const epoch=app.epoch;try{const result=await api('search',{kind:'suppliers',query:draft.value.providerQuery");
  source=once(source,"if(draft.kind==='component')draft.value.supplier=p.name;else draft.value.source.supplier=p.name;draft.providerOptions=[];",
    "if(['component','purchase'].includes(draft.kind))draft.value.supplier=p.name;else draft.value.source.supplier=p.name;draft.providerOptions=[];draft.providerQuery='';draft.providerSearch=null;if(globalThis.DucoPrivateApi?.suppliers)rowSessionAutosave.schedule();");
  source=once(source,"return app.lineCatalog?.products||[];",
    "const base=app.lineCatalog?.products||[],existing=new Set(base.map(product=>product.id));return [...base,...approvedLocalProducts.filter(product=>!existing.has(product.id))];");
  source=once(source,"app.lineState=state;editor();focusLine('#line-search');},intent);return;",
    "app.lineState=state;editor();focusLine('#line-search');refreshApprovedCatalog();},intent);return;");
  const functions=[privateClientAltaAllowed,suggestMarginPrice,suggestPrototypePrice,prototypeEstimate,prototypeCostsReady,prototypePriceControl,supplierResultMarkup,supplierResultRegion,supplierSearch,
    copyApprovedBreakdown,localRecipeRatio,refreshApprovedCatalog,localRecipeControls,handleLocalRecipeAction];
  return once(source,'globalThis.__client = {','const localLineRequests=new Map(),localLineActions=new Set();let approvedLocalProducts=[];\n'+functions.map(fn=>fn.toString()).join('\n')+'\nglobalThis.__client = {');
}
