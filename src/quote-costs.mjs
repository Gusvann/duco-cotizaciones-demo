// Commercial estimates are net of VAT. The fiscal evaluation still describes
// the documented purchases. Calculated workshop costs never create purchases.
export function commercialCostEstimate(quote, evaluation, wood, manufacturing, domain) {
  if (!evaluation?.structuralValid || !wood.size) return null;
  const projected=manufacturing.evaluate(quote,{commercialWood:wood});
  const components=evaluation.eligibleComponents
    .filter(c=>c.type!=='Costo'||!manufacturing.generated(c.id))
    .map(c=>({itemId:c.itemId,amount:c.amount}));
  const detailId=id=>/^CST_MFG_[0-9a-f]{32}$/i.test(id);
  const pendingItems=new Set();
  const indirects=[];
  for(const row of quote.manufacturing.items){
    if(row.mode!=='detailed')continue;
    const result=manufacturing.captureFromResult(projected,row);
    if(result.pricedCount)components.push({itemId:row.itemId,amount:result.capturedNetCents});
    const local=wood.get(row.itemId);
    if(local?.cents!=null)components.push({itemId:row.itemId,amount:local.cents});
    if(result.pendingCount||local?.partial)pendingItems.add(row.itemId);
  }
  for(const cost of projected.costs){
    if(detailId(cost.id))continue;
    const cents=domain.decimal(cost.netAmount,2);
    if(cents!==null){
      const charge={itemId:cost.itemId,amount:cents};
      components.push(charge);
      if(cost.id.startsWith('CST_INDIRECT_'))indirects.push(charge);
    }
    if(cost.status==='Pendiente')pendingItems.add(cost.itemId);
  }
  const allocation=domain.allocateGeneral(quote.items,components);
  const known=new Set(components.map(c=>c.itemId));
  const indirectRows=domain.allocateGeneral(quote.items,indirects).items;
  const items=allocation.items.map((row,index)=>{
    const hasAmount=known.has(row.itemId)||known.has('');
    return {...row,hasAmount,indirectNet:indirectRows[index].assignedNet,partial:pendingItems.has('')||pendingItems.has(row.itemId)};
  });
  const cents=items.reduce((sum,row)=>sum+row.assignedNet,allocation.unallocatedGeneralNet);
  return {items,netCents:components.length?cents:null,complete:projected.complete&&!pendingItems.size&&evaluation.componentsComplete&&evaluation.coverageComplete};
}

function perUnitCents(total,quantity) {
  if(!/^\d+(?:\.\d{1,3})?$/.test(String(quantity))||Number(quantity)>100000)return null;
  const units=D.decimal(quantity,3,100000);
  if(!Number.isSafeInteger(total)||!units)return null;
  const scaled=BigInt(total)*1000n,den=BigInt(units);
  return Number((2n*scaled+den)/(2n*den));
}

function quoteEstimate(state,evaluation){
  if(!evaluation?.structuralValid)return null;
  const wood=localWorkshop.appliedCosts(state);
  if(!wood.size)return null;
  const projected=D.evaluate(state.q,{base:state.baseQuote,preview:true,commercialWood:wood});
  return commercialCostEstimate(state.q,projected,wood,QuoteManufacturing_,D);
}

function estimatedEvaluation(state,evaluation){
  const estimate=quoteEstimate(state,evaluation);
  if(!estimate)return evaluation;
  const t=evaluation.totals,complete=estimate.complete&&t.completePrices;
  const profit=complete?t.net-estimate.netCents:null;
  return {...evaluation,totals:{...t,estimate,cost:estimate.netCents,allocation:estimate,
    completeCosts:estimate.complete,complete,profit,margin:complete&&t.net>0?profit*100/t.net:null}};
}

function installCostViews() {
  const nativeCaptured=breakdownCapturedCostHtml,nativeRefresh=breakdownRefreshCapturedCost;
  const oldDialog=breakdownUnsavedDialog;
  breakdownUnsavedDialog=function(){
    const html=oldDialog();
    return app.breakdownContinuation?.switchesToBreakdown
      ?html.replace('Hay cambios en este editor','Usar el desglose calculado')
        .replace('Elige qué hacer antes de continuar.','El desglose sustituirá la estimación manual. Elige si incluyes la pieza que estás editando.')
        .replace('Aplicar y continuar','Incluir la pieza y usar el desglose')
        .replace('Descartar y continuar','Usar el desglose sin la edición')
      :html;
  };
  quoteRoot.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-mfg-mode]');
    if(!button||!app.breakdownEditor||!breakdownDraftDirty())return;
    event.stopImmediatePropagation();
    if(!editable()||app.busy||app.operation)return;
    const id=button.dataset.mfgMode;
    const next=()=>{
      if(!editable()||app.busy||app.operation||app.openPartId!==id)return;
      const candidate=breakdownClone(partViewQuote());
      candidate.manufacturing=breakdownModel(candidate);
      const row=candidate.manufacturing.items.find(r=>r.itemId===id);
      if(!row||row.mode==='detailed')return;
      row.mode='detailed';
      try{breakdownApply(candidate,'Modo de costo');}catch(error){report(error);}
    };
    next.switchesToBreakdown=true;
    if(breakdownGuard(next))next();
  },true);
  function label(item,estimate) {
    const unit=perUnitCents(estimate.cents,item.quantity);
    return (unit===null?'Pendiente':QuotePdf.money(unit))+' por unidad · '+(item.quantity||'—')+' en la cotización';
  }
  breakdownCapturedCostHtml=function(item){
    const estimate=localRows.articleEstimate(item.id);
    if(!estimate.hasWork)return nativeCaptured(item);
    const id=esc(item.id);
    const manual=breakdownRow(item.id)?.mode!=='detailed';
    return '<section class="part-estimate" aria-label="Costo acumulado del artículo"><h4>Costo estimado del artículo</h4>'+
      '<small data-estimate-unit="'+id+'">'+esc(label(item,estimate))+'</small>'+
      '<div class="part-estimate-total"><small>Subtotal de la cantidad cotizada · sin IVA</small><strong data-part-captured-net="'+id+'">'+QuotePdf.money(estimate.cents)+'</strong>'+
      '<span data-part-captured-status="'+id+'">'+(estimate.complete?'Desglose completo':'Subtotal parcial')+'</span></div>'+
      (manual?'<p class="meta">El pedido usa la estimación manual hasta aplicar este desglose.</p><button type="button" data-mfg-mode="'+id+'">Usar desglose calculado</button>':'')+'</section>';
  };
  const nativeStrip=articleHeaderStripEstimate;
  articleHeaderStripEstimate=function(item,markup){
    const html=nativeStrip(item,markup);
    if(!html.includes('data-article-study="desglose"')||html.includes('data-estimate-unit=')||
       !solidWoodEnabled()||!solidWoodEntries(item.id,true).length)return html;
    return html+breakdownCapturedCostHtml(item);
  };
  breakdownRefreshCapturedCost=function(){
    nativeRefresh();
    for(const node of quoteRoot.querySelectorAll('[data-estimate-unit]')){
      const id=node.dataset.estimateUnit,item=partViewQuote().items.find(row=>row.id===id);
      if(!item)continue;
      const estimate=localRows.articleEstimate(id),section=node.closest('.part-estimate');
      node.textContent=label(item,estimate);
      section.querySelector('[data-part-captured-net]').textContent=QuotePdf.money(estimate.cents);
      section.querySelector('[data-part-captured-status]').textContent=estimate.complete?'Desglose completo':'Subtotal parcial';
    }
  };
}

export function extendQuoteCosts(source) {
  function replace(before,after) {
    if(source.split(before).length!==2)throw Error('Cambió el punto de integración de costos: '+before.slice(0,80));
    source=source.replace(before,()=>after);
  }
  // Reuse the evaluator's purchase identities, partial values, and rounding.
  // Only the commercial projection supplies commercialWood to the evaluator.
  replace("SolidWoodAutoPreview.calculate({article,component,parameterPreview:config.parameters,adminWoodPricePreview:recipeMaterialPrice(id,component)",
    "SolidWoodAutoPreview.calculate({article,component:app.solidWoodLocal?.articles.get(id)?.workshop?.wasteRate!=null?{...component,wasteRate:app.solidWoodLocal.articles.get(id).workshop.wasteRate}:component,parameterPreview:config.parameters,adminWoodPricePreview:recipeMaterialPrice(id,component)");
  replace("if(!commercial||!row.materials.length&&!row.processes.length)issue(",
    "if(!commercial||!row.materials.length&&!row.processes.length&&!context.commercialWood?.has(item.id))issue(");
  replace("for(const system of row.finishSystems)if(!system.name||!system.layerIds.length)issue(",
    "const supplemental=context.commercialWood?.get(item.id);\n      if(supplemental?.partial)issue('manufacturing.items.wood','Completa el desglose de madera del artículo.',item.id);\n      for(const system of row.finishSystems)if(!system.name||!system.layerIds.length)issue(");
  replace('manufacturingNetCents:sum(eligible.map(c=>c.netCents)),manufacturingGrossCents:sum(eligible.map(c=>c.grossCents)),materials:materialResults',
    'manufacturingNetCents:sum([...eligible.map(c=>c.netCents),supplemental?.cents??0]),manufacturingGrossCents:sum(eligible.map(c=>c.grossCents)),materials:materialResults');
  replace("const eligible=costs.filter(c=>c.status!=='Pendiente'),base=sum([...eligible.map(c=>c.netCents),...additional]),baseReady=",
    "const eligible=costs.filter(c=>c.status!=='Pendiente'),base=sum([...eligible.map(c=>c.netCents),...additional,...Array.from(context.commercialWood?.values()||[],entry=>entry.cents??0)]),baseReady=");
  replace("const result=evaluate(q,context),conflicts=new Set();",
    "return captureFromResult(evaluate(q,context),row);\n  }\n  function captureFromResult(result,row){\n    const itemId=row.itemId,conflicts=new Set();");
  replace("const costs=result.costs.filter(c=>c.itemId===itemId&&/^CST_MFG_/.test(c.id)),amounts=[];",
    "const costs=result.costs.filter(c=>c.itemId===itemId&&/^CST_MFG_[0-9a-f]{32}$/i.test(c.id)),amounts=[];");
  replace('woodMeasurements,itemCostPreview,lineSubtotal','woodMeasurements,itemCostPreview,captureFromResult,lineSubtotal');
  replace("let candidate=QuotePartDraft.build(tx,app.q);\n    // Validate isolation",
    "const row=tx.quote.manufacturing?.items.find(r=>r.itemId===tx.itemId);\n    const manual=tx.quote.costs.find(c=>c.id==='CST_EST_'+tx.itemId);\n    if(row?.mode==='manual'&&!(manual?.netAmount||manual?.amount)&&solidWoodDirty(tx.itemId)&&solidWoodEntries(tx.itemId).length)row.mode='detailed';\n    let candidate=QuotePartDraft.build(tx,app.q);\n    // Validate isolation");
  replace("return D.evaluate(candidate,{base:app.baseQuote,preview:true,date:new Date().toISOString().slice(0,10)});",
    "const result=D.evaluate(candidate,{base:app.baseQuote,preview:true,date:new Date().toISOString().slice(0,10)});\n    return estimatedEvaluation(app,result);");
  replace("if(!app.dirty && app.storedEvaluation)return app.storedEvaluation;",
    "if(!app.dirty&&app.storedEvaluation){const saved=app.storedEvaluation;return app.meta?.current===false?saved:estimatedEvaluation(app,saved);}");
  replace("if(!app.dirty && app.storedTotals)return app.storedTotals;",
    "if(!app.dirty&&app.storedTotals&&app.meta?.current===false)return app.storedTotals;");
  replace("if(estimate){const entry=ensurePartEstimate(index);",
    "if(path==='items.'+index+'.quantity'&&!tx.raw[key]&&String(tx.quote.items[index].quantity)!==String(value)){for(const process of tx.quote.manufacturing?.items.find(row=>row.itemId===id)?.processes||[]){if(process.section==='maquilas'&&process.quantityScope==='product'&&process.source?.kind==='manual'&&process.detail?.unitPrice&&process.quantity)process.source.netAmount='';}}\n    if(estimate){const entry=ensurePartEstimate(index);");
  replace("const allocation=evaluation?.structuralValid===true?evaluation.allocations:null,byId=",
    "const estimate=evaluation?.totals?.estimate;const allocation=estimate||(evaluation?.structuralValid===true?evaluation.allocations:null),byId=");
  replace("money(row?.assignedNet)+'</strong><small>Directo '",
    "money(row?.hasAmount===false?null:row?.assignedNet)+(row?.partial?' · parcial':'')+'</strong><small>Directo '");
  replace("' · General '+money(row?.generalNet)+'</small></button>';",
    "(estimate?' · Común '+money(row.generalNet-row.indirectNet)+' · Indirectos '+money(row.indirectNet):' · General '+money(row?.generalNet))+'</small></button>';");
  replace("...(Object.hasOwn(r,'prototype') ?","...(Object.hasOwn(r,'targetMargin')?{targetMargin:num(r.targetMargin,2,99.99,'items.'+i+'.targetMargin')}:{}),\n      ...(Object.hasOwn(r,'prototype') ?");
  replace("const p = el.dataset.path;\n      const refreshDerived",
    "const p = el.dataset.path;\n      if(/^items\\.\\d+\\.(?:prototypeMargin|targetMargin)$/.test(p)&&!app.inputErrors.size){const item=app.q.items[Number(p.split('.')[1])];if(item&&!item.unitPrice){const estimate=prototypeEstimate(item,financialTotals()),suggestion=suggestMarginPrice(D,item,estimate.complete?estimate.cents:null,value);if(suggestion)item.unitPrice=suggestion.unitPrice;}}\n      const refreshDerived");
  replace("}).join('')+'</div>';\n  }\n  function costs()",
    "}).join('')+(estimate?'<div class=\"cost-overview-item\"><span>Costo estimado del pedido</span><strong data-estimate-order>'+money(estimate.netCents)+'</strong><small>'+(estimate.complete?'Sin IVA':'Importe conocido · parcial')+'</small></div>':'')+'</div>';\n  }\n  function costs()");
  replace("cost=assigned.get(r.id)?.assignedNet??null,margin=",
    "cost=totals.estimate?(totals.estimate.items.find(row=>row.itemId===r.id&&row.hasAmount)?.assignedNet??null):assigned.get(r.id)?.assignedNet??null,margin=");
  replace('globalThis.__client = {',
    commercialCostEstimate.toString()+'\n'+perUnitCents.toString()+'\n'+quoteEstimate.toString()+'\n'+estimatedEvaluation.toString()+'\n('+installCostViews.toString()+')();\nglobalThis.__client = {quoteEstimate,');
  return source;
}
