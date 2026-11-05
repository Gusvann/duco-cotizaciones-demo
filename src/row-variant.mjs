/* Local alternate presentation. Existing editors and calculators remain authoritative. */
import {createBoardCalculator} from './board-calculator.mjs';
function installRowVariant(boardCalculator) {
  const nativeEditor = breakdownEditorHtml;
  const nativeWoodEditor = solidWoodEditorHtml;
  const nativeWoodCard = solidWoodRecipeCard;
  const nativeWoodRefresh = solidWoodRefresh;
  const nativeRefreshSubtotal = breakdownRefreshSubtotal;
  const nativeMaterialCard = articlePanelMaterialCard;
  const nativeProcessCard = articlePanelProcessCard;
  const nativeWoodFamily = solidWoodFamilyHtml;
  const nativeMaquilaSummaryText = breakdownMaquilaSummaryText;
  const nativeStudy = articleStudyHtml;
  const nativeBreakdownAction = breakdownAction;
  const requiredWoodKeys=new Set(['name','quantityPerProduct','woodKind','thickness','width','length','lengthUnit','finishFaces','jointed','wasteRate','adjustment.price','cnc.decision']);
  const requiredSymbol='<span class="rv-required-symbol" aria-hidden="true">*</span>';
  function woodRequirement(html,key) {
    if((!requiredWoodKeys.has(key)&&!(key==='adjustment.reason'&&app.breakdownEditor?.solidWoodF?.adjustment))||!html)return html;
    const control=html.match(/<(?:input|select)\b[^>]*>/)?.[0];if(!control)return html;
    const select=control.startsWith('<select'),options=select?[...html.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)]:[];
    const selected=options.find(option=>/\bselected\b/.test(option[1]))||options[0];
    const value=select?selected?.[1].match(/\bvalue="([^"]*)"/)?.[1]??selected?.[2]??'':control.match(/\bvalue="([^"]*)"/)?.[1]??'';
    let missing=!value.trim()||select&&['Seleccionar','—','Por revisar'].includes(value);
    if(!missing&&control.includes('data-solid-field')&&app.breakdownEditor?.solidWoodF){
      const draft=app.breakdownEditor,result=solidWoodResult(draft.itemId,draft.solidWoodF);
      const code={quantityPerProduct:'QUANTITY_PER_ARTICLE',width:'WIDTH',length:'LENGTH',thickness:'THICKNESS',finishFaces:'FINISH_FACES',jointed:'JOINTED',wasteRate:'WASTE_RATE'}[key];
      missing=result.pendingDecisions.includes(code);
    }
    let marked=control.replace(/\saria-required="[^"]*"|\saria-invalid="[^"]*"/g,'');
    marked=marked.slice(0,-1)+' aria-required="true" aria-invalid="'+(missing||/aria-invalid="true"/.test(control))+'">';
    return html.replace('<div class="field','<div data-rv-required="'+esc(key)+'" data-rv-missing="'+missing+'" class="field rv-required-field')
      .replace(control,()=>marked).replace('</label>',requiredSymbol+'</label>').replace(/<\/div>$/,'<span class="rv-missing-mark" aria-hidden="true">*</span></div>');
  }

  const cell = (className, body) => '<div class="rv-cell rv-' + className + '">' + body + '</div>';
  const grid = (concept, quantity, unit, price, amount) => '<div class="rv-grid">' + cell('concept', concept) + cell('quantity', quantity) + cell('unit', unit) + cell('price', price) + cell('amount', amount) + '</div>';
  const supplyGrid = (type, concept, sku, quantity, unit, price, amount) => '<div class="rv-grid rv-supply-grid">' + cell('type', type) + cell('concept', concept) + cell('sku', sku) + cell('quantity', quantity) + cell('unit', unit) + cell('price', price) + cell('amount', amount) + '</div>';
  const woodGrid = (concept, quantity, material, thickness, measurements, price, cnc, amount) => '<div class="rv-grid rv-wood-grid">' + cell('concept', concept) + cell('quantity', quantity) + cell('wood-material', material) + cell('thickness', thickness) + cell('wood-measures', measurements) + cell('price', price) + cell('wood-cnc', cnc) + cell('amount', amount) + '</div>';
  const tableHeading = kind => {
    const label = text => '<span>' + text + '</span>';
    const required=text=>label(text+requiredSymbol);
    const measures = '<span class="rv-measure-heading">Medidas y acabado</span><div class="rv-wood-measure-grid">'+['Ancho','Largo','Unidad','Caras','Entablado','Desperdicio %'].map(required).join('')+'</div>';
    const html = kind === 'wood' ? woodGrid(required('Pieza'),required('Cantidad'),required('Material'),required('Espesor · in'),measures,required('Precio del material'),required('CNC / láser'),label('Importe'))
      : kind === 'supply' ? supplyGrid(label('Tipo de insumo'),label('Concepto'),label('SKU'),label('Cantidad'),label('Unidad'),label('Precio unitario'),label('Importe'))
      : grid(label('Concepto'),label('Cantidad'),label('Unidad'),label('Precio unitario'),label('Importe'));
    return html.replace('class="rv-grid','aria-hidden="true" class="rv-table-heading rv-grid');
  };
  const amountHtml = (amount, id = '', wood = false, detail = '') => '<output class="rv-amount"' + (id ? wood ? ' data-row-wood-total="' + esc(id) + '"' : ' data-break-subtotal="' + esc(id) + '"' : '') + ' aria-live="polite"><span>Importe</span><strong>' + esc(amount) + '</strong>' + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</output>';
  const pending = label => '<div class="field"><label>' + esc(label) + '</label><span class="rv-pending">Pendiente</span></div>';
  const woodUnit = id => '<div class="field"><label for="rv-wood-unit-' + esc(id) + '">Unidad</label><select id="rv-wood-unit-' + esc(id) + '" aria-label="Unidad de la pieza"><option value="Pieza" selected>Pieza</option></select></div>';
  const laborUnit = (id, days) => '<div class="field"><label for="rv-labor-unit-'+esc(id)+'">Unidad</label><select id="rv-labor-unit-'+esc(id)+'" aria-label="Unidad del tiempo"><option selected>'+ (days?'Día':'Hora') +'</option></select></div>';

  // Read-only capture summaries. Purchases are grouped exactly as in the
  // manufacturing projection; an incomplete or ambiguous charge stays pending.
  function familyTotals(itemId) {
    const keys=['supplies','maquilas','wood','boards','metal','unclassified'];
    const totals=Object.fromEntries(keys.map(key=>[key,{cents:0,known:0,count:0,missing:0,provisional:false,preview:false,included:false}]));
    const unknown=()=>Object.fromEntries(keys.map(key=>[key,{text:'Sin evaluar',title:'No fue posible evaluar este rubro.'}]));
    try {
      const candidate=breakdownClone(partViewQuote()),item=candidate.items.find(value=>value.id===itemId),row=candidate.manufacturing?.items.find(value=>value.itemId===itemId);
      if(!item||!row||candidate.manufacturing.contract!==QuoteSchema.manufacturingContract)return unknown();
      const draft=app.breakdownEditor?.itemId===itemId?app.breakdownEditor:null;
      const replace=(list,value)=>{const at=list.findIndex(entry=>entry.id===value.id);if(at<0)list.push(value);else list[at]=value;};
      if(draft&&['component','purchase','process'].includes(draft.kind)){
        const value=breakdownClone(draft.value);
        if(Object.keys(draft.numericErrors||{}).length){
          if(draft.kind==='process'){value.quantity='';if(value.detail)value.detail.unitPrice='';if(value.source)value.source.netAmount='';}
          else value.unitPrice='';
        }
        if(['component','purchase'].includes(draft.kind)){
          if(draft.group)replace(row.groups,breakdownClone(draft.group));
          replace(row.materials,value);
        }else replace(row.processes,value);
      }else if(draft?.kind==='finish'){
        for(const original of draft.layers||[]){
          const value=breakdownClone(original);
          if(Object.keys(draft.numericErrors||{}).length){value.quantity='';if(value.source)value.source.netAmount='';}
          replace(row.processes,value);
        }
      }
      row.mode='detailed';
      const result=QuoteManufacturing_.evaluate(candidate),costs=new Map(result.costs.map(value=>[value.id,value]));
      const id=(prefix,value)=>'CST_MFG_'+D.sha256(itemId+'|'+prefix+'_'+value).slice(0,32);
      const conflictIds=new Set();
      for(const issue of result.issues||[]){
        if(issue.target?.parentId!==itemId||!issue.field?.endsWith('.purchaseGroup'))continue;
        const material=row.materials.find(value=>value.id===issue.target.id);
        if(material)conflictIds.add(material.purchaseGroup||material.id);
      }
      const add=(total,cents,provisional=false)=>{
        if(cents===null||!Number.isSafeInteger(cents)||cents<0||!Number.isSafeInteger(total.cents+cents)){total.missing++;return;}
        total.cents+=cents;total.known++;total.provisional ||= provisional;
      };
      const groups=new Map();
      for(const material of row.materials){
        const purchase=material.purchaseGroup||material.id;
        if(!groups.has(purchase))groups.set(purchase,[]);
        groups.get(purchase).push(material);
      }
      const wood=solidWoodEnabled()?solidWoodEntries(itemId,true):[];
      const overlap=wood.length>0&&row.materials.some(material=>material.section==='wood'||material.type==='wood');
      for(const [purchase,materials] of groups){
        const families=new Set(materials.map(material=>articleStudyFamily(material.section)));
        for(const family of families)totals[family].count++;
        if(families.size!==1||conflictIds.has(purchase)||(overlap&&families.has('wood'))){
          for(const family of families)totals[family].missing++;
          continue;
        }
        const family=[...families][0],cost=costs.get(id('M',purchase));
        if(family==='boards'&&materials.length===1){const value=boardResult(item,materials[0]);if(value.totalCents!==null){add(totals[family],Number(value.totalCents));totals[family].base=true;continue;}}
        add(totals[family],cost?.netAmount?D.decimal(cost.netAmount,2):null,family==='supplies'&&materials.every(hasPurchasePrice)?false:!cost||cost.status==='Pendiente');
      }
      for(const process of row.processes){
        const total=totals[articleStudyFamily(process.section)];total.count++;
        if(process.source?.kind==='included'){
          if(process.source.reviewed&&row.materials.some(material=>material.id===process.source.includedInMaterialId))total.included=true;
          else total.missing++;
          continue;
        }
        const cost=costs.get(id('P',process.id));
        const amount=process.source?.kind==='manual'?breakdownLineSubtotal(process,item,true):cost?.netAmount?D.decimal(cost.netAmount,2):null;
        add(total,amount,!cost||cost.status==='Pendiente');
      }
      if(draft?.kind==='group'){
        const affected=new Set(row.materials.filter(material=>material.groupId===draft.value?.id).map(material=>articleStudyFamily(material.section)));
        for(const family of affected)totals[family].missing++;
      }
      if(wood.length){
        const total=totals.wood;total.count+=wood.length;total.preview=true;
        if(overlap)total.missing++;
        else{
          const value=solidWoodSummary(itemId).articleCosts.woodCost;
          add(total,value===null?null:D.decimal(String(value),2),true);
        }
      }
      return Object.fromEntries(keys.map(key=>{
        const total=totals[key];
        if(!total.count&&!total.missing)return [key,{text:QuotePdf.money(0),title:'Sin conceptos capturados.'}];
        if(total.missing&&!total.known)return [key,{text:'Pendiente',title:'Hay conceptos sin importe o relaciones por resolver.'}];
        const suffix=total.missing||total.preview?' · parcial':total.base?' · base':total.provisional?' · por validar':total.included&&!total.known?' · incluido':'';
        const title=total.preview?'Vista parcial de madera; los procesos y tarifas pendientes no se incluyen ni quedan confirmados.':total.missing?'Importe parcial; hay conceptos o relaciones pendientes.':total.provisional?'Importe capturado, sujeto a validación.':total.included?'Los procesos incluidos no se suman otra vez.':'Importe capturado del rubro.';
        return [key,{text:QuotePdf.money(total.cents)+suffix,title}];
      }));
    }catch(_){return unknown();}
  }
  function familyOutput(itemId,key,value){
    return '<output data-rv-family-total="'+esc(key)+'" data-rv-article="'+esc(itemId)+'" aria-live="polite" title="'+esc(value.title)+'">'+esc(value.text)+'</output>';
  }
  function refreshFamilyTotals(){
    const cache=new Map();
    quoteRoot.querySelectorAll('[data-rv-family-total]').forEach(output=>{
      const id=output.dataset.rvArticle,key=output.dataset.rvFamilyTotal;
      if(!cache.has(id))cache.set(id,familyTotals(id));
      const value=cache.get(id)?.[key];if(!value)return;
      output.textContent=value.text;output.title=value.title;
    });
  }

  function takeField(state, attribute, key) {
    const marker = attribute + '="' + key + '"', at = state.html.indexOf(marker);
    if (at < 0) return '';
    if (state.html.indexOf(marker, at + marker.length) >= 0) throw Error('Duplicate row field: ' + key);
    const start = state.html.lastIndexOf('<div class="field', at);
    if (start < 0) throw Error('Row field wrapper missing: ' + key);
    const region = articleStudyElement(state.html, start, 'div');
    state.html = state.html.slice(0, start) + state.html.slice(region.end);
    return attribute==='data-solid-field'?woodRequirement(region.html,key):region.html;
  }
  function takeRegion(state, marker, tag) {
    const at = state.html.indexOf(marker); if (at < 0) return '';
    const start = state.html.lastIndexOf('<' + tag, at);
    if (start < 0) throw Error('Row region missing: ' + marker);
    const region = articleStudyElement(state.html, start, tag);
    state.html = state.html.slice(0, start) + state.html.slice(region.end);
    return region.html;
  }
  function details(itemId, id, content, wood, supply) {
    const panel = 'variant-row-detail-' + id, open = app.breakdownUi.panels?.[itemId + '|' + panel] === true;
    return '<details class="rv-details" data-fab-item="' + esc(itemId) + '" data-fab-panel="' + esc(panel) + '"' + (open ? ' open' : '') + '><summary>' + (wood ? 'Opciones: caras, CNC y entablerado' : supply ? 'Proveedor' : 'Proveedor / SKU y detalles') + '</summary>' + content + '</details>';
  }
  function renameLabel(html, next) { return html.replace(/(<label\b[^>]*>)[\s\S]*?(<\/label>)/, '$1' + esc(next) + '$2'); }
  function renameButton(html, next) { return html.replace(/(<button\b[^>]*>)[\s\S]*?(<\/button>)/, '$1' + esc(next) + '$2'); }
  function woodCncEditor(state,draft,attr) {
    const original=takeRegion(state,'<section class="solid-wood-minimal-cnc"','section');
    const fields=original?{html:original}:state;
    takeField(fields,attr,'cnc.decision');
    for(const field of ['cnc.length','cnc.repetitions','cnc.unit'])takeField(fields,attr,field);
    return '<div class="rv-cnc-capture">'+woodRequirement(solidWoodField('cnc.decision','CNC / láser','',{values:[['','—'],['no','No'],['yes','Sí']]}),'cnc.decision')+'</div>';
  }
  function supplyDetails(state,value) {
    const provider=takeRegion(state,'<section class="break-provider','section'),enabled=!!provider&&scopeEconomics('Fabricación'),linked=!!value.providerId;
    let field=breakdownField('supplier','Proveedor (opcional)',value.supplier,{max:200});
    if(!enabled||linked)field=field.replace('<input ','<input readonly aria-readonly="true" ');
    const change=enabled&&linked?'<button type="button" class="quiet" data-break-action="rv-change-linked-provider">Cambiar proveedor</button>':'';
    const notice=!enabled?'<small>La captura de proveedor está pendiente para esta responsabilidad.</small>':linked?'<small>El proveedor está vinculado a este componente.</small>':'';
    const additional=(linked?provider:'')+state.html;
    const hasControls=/data-(?:break-field|break-group-field|break-action|general-field|tech-field)=/.test(additional);
    return '<div class="rv-provider-line">'+field+change+notice+'</div>'+(hasControls?'<details class="rv-purchase-extra"><summary>Otros datos de compra</summary>'+additional+'</details>':'');
  }
  function rowEditor(original, wood) {
    const draft = app.breakdownEditor;
    if (!original || !draft || !draft.itemId || (wood && !draft.solidWoodF) || (!wood && !['component','purchase','process'].includes(draft.kind))) return original;
    if(!wood&&draft.value.section==='boards'&&draft.kind==='component')return boardEditor(draft);
    const value = wood ? draft.solidWoodF : draft.value, process = !wood && draft.kind === 'process', supply = !wood && !process && value.section === 'supplies';
    const state = {html:original}, attr = wood ? 'data-solid-field' : 'data-break-field';
    const historical=wood?takeRegion(state,'<aside class="note">','aside'):'';
    const conceptKey = wood ? 'name' : ((process && value.section === 'maquilas') || value.section === 'supplies') ? 'specification' : 'name';
    let concept = takeField(state, attr, conceptKey);
    let type = !wood ? takeField(state, attr, 'category') : '';
    const sku = supply ? takeField(state,attr,'sku') || pending('SKU') : '';
    if (!concept && type && !supply) { concept=type; type=''; }
    if (concept) concept=renameLabel(concept,wood?'Pieza':'Concepto');
    else concept='<div class="field"><label>Concepto</label><span class="rv-pending">'+esc(value.specification||value.name||'Sin definir')+'</span></div>';
    let quantity = takeField(state, attr, wood ? 'quantityPerProduct' : process ? 'quantity' : 'purchaseQuantity');
    const useDays=!wood && process && /-(labor|cnc)$/.test(value.section||'') && breakdownLaborByDays(value);
    const laborQuantity = !quantity && !wood && process ? takeField(state,attr,useDays?'detail.days':'hours') : '';
    quantity = quantity || laborQuantity || pending('Cantidad');
    const unit = wood ? woodUnit(value.id) : takeField(state,attr,process?'unit':'purchaseUnit') || (laborQuantity ? laborUnit(value.id,useDays) : pending('Unidad'));
    let price = takeField(state, attr, wood ? 'adjustment.price' : process ? 'detail.unitPrice' : 'unitPrice') || pending('Precio unitario');
    if (wood) price=renameLabel(price,'Precio del material');
    const width=wood ? takeField(state,attr,'width') || pending('Ancho') : '';
    const length=wood ? takeField(state,attr,'length') || pending('Largo') : '';
    const thickness=wood ? takeField(state,attr,'thickness') || pending('Espesor') : '';
    const species=wood ? takeField(state,attr,'woodKind') || pending('Material') : '';
    const measureUnit=wood ? takeField(state,attr,'lengthUnit') || pending('Unidad de medidas') : '';
    const faces=wood ? takeField(state,attr,'finishFaces') || pending('Caras de acabado') : '';
    const jointed=wood ? takeField(state,attr,'jointed') || pending('Entablerado') : '';
    const waste=wood ? takeField(state,attr,'wasteRate') || pending('Desperdicio') : '';
    const reason=wood ? takeField(state,attr,'adjustment.reason') : '';
    const reset=wood ? takeRegion(state,'data-solid-action="reset"','button') : '';
    const group=wood ? takeRegion(state,'data-solid-action="group-price"','button') : '';
    const cnc=wood ? woodCncEditor(state,draft,attr) : '';
    if(wood){takeRegion(state,'data-solid-live="referencePending"','div') || takeRegion(state,'data-solid-live="pending"','div');}
    let amount;
    if (wood) {
      const result=solidWoodResult(draft.itemId,value);
      amount=amountHtml(solidWoodMoney(result.articleCosts.woodCost),value.id,true,'Calculado con medidas');
    } else {
      const previous = takeRegion(state, 'data-break-subtotal="' + esc(value.id) + '"', 'output');
      const nonManual=process && value.source?.kind && value.source.kind!=='manual';
      const item=partViewQuote().items.find(row=>row.id===draft.itemId);
      const costs=nonManual && value.source.kind==='tariff' ? articlePanelCostProjection(item,breakdownRow(item.id)) : null;
      amount = nonManual ? amountHtml(displayAmount(value,item,true,costs)) : previous ? previous.replace(/<span>[^<]*<\/span>/,'<span>Importe</span>') : amountHtml(QuotePdf.money(breakdownDraftSubtotal()),value.id);
    }
    const footer=takeRegion(state,'<div class="break-editor-actions">','div');
    if (!footer) throw Error('Row editor actions missing');
    let error=wood ? takeRegion(state,'data-solid-error','p') : takeRegion(state,'<p class="error" role="alert">','p');
    if(wood&&draft.error==='Escribe la descripción de la pieza.')error='';
    const measures=wood?'<div class="rv-wood-measure-grid">'+width+length+measureUnit+faces+jointed+waste+'</div>':'';
    const priceOptions=wood?'<details class="rv-wood-price-options" data-solid-exceptions'+(value.adjustment?' open':'')+'><summary>Ajustar precio</summary>'+reason+'<div class="rv-wood-price-actions">'+(reset?renameButton(reset,'Restablecer'):'')+(group?renameButton(group,'Compartir precio'):'')+'</div></details>':'';
    const material=wood?species+(historical?historical.replace('class="note"','class="rv-wood-legacy"'):''):'';
    const row=wood ? woodGrid(concept,'<div class="rv-wood-quantity">'+quantity+unit+'</div>',material,thickness,measures,price+priceOptions,cnc,amount) : supply ? supplyGrid(type||pending('Tipo de insumo'),concept,sku,quantity,unit,price,amount) : grid(concept,quantity,unit,price,amount);
    const options=supply?supplyDetails(state,value):type+state.html;
    const actions=wood?'<div class="rv-wood-confirm"><button type="button" class="quiet" data-break-action="wood-confirm">Confirmar cambios</button><button type="button" class="quiet" data-break-action="wood-discard">Descartar</button></div>':footer;
    return '<div class="rv-edit" data-row-editor="' + esc(value.id) + '">' + row + (wood?'':details(draft.itemId,value.id,options,false,supply)) + error + actions + '</div>';
  }
  breakdownEditorHtml = function () { return rowEditor(nativeEditor(),false); };
  solidWoodEditorHtml = function () { return rowEditor(nativeWoodEditor(),true); };
  breakdownAction = async function(button) {
    if(button.dataset.breakAction==='duplicate-component'&&recipeCanEdit()&&app.partDraft){
      const itemId=app.openPartId,original=breakdownRow(itemId).materials.find(value=>value.id===button.dataset.id),context=partContext();
      if(original?.section==='boards'){
        const basis=breakdownClone(boardBasis(itemId,original.id)),result=await nativeBreakdownAction(button),draft=app.breakdownEditor;
        if(partSameContext(context)&&draft?.isNew&&draft.itemId===itemId&&draft.value.section==='boards'&&draft.value.id!==original.id){
          solidWoodState(itemId).boardSettings[draft.value.id]=basis;editor();
        }
        return result;
      }
    }
    if(button.dataset.breakAction!=='rv-change-linked-provider')return nativeBreakdownAction(button);
    const draft=app.breakdownEditor,value=draft?.value;
    if(!recipeCanEdit()||app.busy||app.operation||!draft||!['component','purchase'].includes(draft.kind)||value?.section!=='supplies'||!value.providerId||draft.itemId!==app.openPartId||draft.owner!==app.user?.email||draft.quoteId!==app.q.id||draft.versionId!==app.q.versionId||app.partDraft?.itemId!==draft.itemId||!partSameContext(app.partDraft.context))return false;
    if(!window.confirm('Cambiar el proveedor desvinculará el proveedor y su servicio de este componente. Los cambios se aplican sólo al confirmar el componente. ¿Continuar?'))return false;
    value.providerId='';value.serviceId='';value.serviceName='';
    editor();requestAnimationFrame(()=>quoteRoot.querySelector('[data-break-field="supplier"]')?.focus({preventScroll:true}));
    return true;
  };
  solidWoodRefresh = function () {
    nativeWoodRefresh();
    const draft=app.breakdownEditor;
    if(!draft?.solidWoodF || !partSameContext(draft.context))return;
    const result=solidWoodResult(draft.itemId,draft.solidWoodF),output=quoteRoot.querySelector('[data-row-wood-total="'+CSS.escape(draft.solidWoodF.id)+'"] strong');
    if(output)output.textContent=solidWoodMoney(result.articleCosts.woodCost);
    const issues={quantityPerProduct:'QUANTITY_PER_ARTICLE',width:'WIDTH',length:'LENGTH',thickness:'THICKNESS',finishFaces:'FINISH_FACES',jointed:'JOINTED',wasteRate:'WASTE_RATE'};
    quoteRoot.querySelector('[data-row-editor="'+CSS.escape(draft.solidWoodF.id)+'"]')?.querySelectorAll('[data-rv-required]').forEach(field=>{
      const key=field.dataset.rvRequired,input=field.querySelector('input,select,textarea');if(!input)return;
      const missing=!String(input.value??'').trim()||result.pendingDecisions.includes(issues[key]);
      field.dataset.rvMissing=String(missing);input.setAttribute('aria-invalid',String(missing));
    });
    const family=quoteRoot.querySelector('.solid-wood-f-total>span');
    if(family){const summary=solidWoodSummary(draft.itemId);family.textContent=solidWoodMoney(summary.articleCosts.woodCost)+' · '+(summary.quality==='PENDING'?'Pendiente':'Por validar');}
    refreshFamilyTotals();
  };
  breakdownRefreshSubtotal = function () {nativeRefreshSubtotal();refreshFamilyTotals();};
  breakdownMaquilaSummaryText = function(summary) {
    return summary.count===0&&summary.pending===0?QuotePdf.money(0):nativeMaquilaSummaryText(summary);
  };
  solidWoodFamilyHtml = function(item,row,fold) {
    let html=nativeWoodFamily(item,row,fold)
      .replace('<span class="fab-badge">Variante en evaluación</span>','')
      .replace('<p class="meta">UAT local · preview sin persistencia backend. Los precios DEMO no son tarifas de Duco.</p>','')
      .replace('<p class="note">UAT local · precios y procesos preview. No se guardan en el backend ni son costos financieros confirmados.</p>','')
      .replaceAll('Descartar preview F de este Artículo','Descartar captura de madera');
    const totalAt=html.indexOf('<output class="solid-wood-f-total">');
    if(totalAt>=0){
      const total=articleStudyElement(html,totalAt,'output');
      const readable=total.html.replace(/ · (?:PREVIEW|ESTIMATED)(?=<)/g,' · Por validar').replace(/ · PENDING(?=<)/g,' · Pendiente');
      html=html.slice(0,totalAt)+readable+html.slice(total.end);
    }
    const legacy=row.materials.some(material=>material.section==='wood'||material.type==='wood'||row.groups.some(group=>group.id===material.groupId&&group.type==='wood'));
    if(!solidWoodEnabled()||legacy||solidWoodEntries(item.id,true).length)return html;
    const at=html.indexOf('<output class="solid-wood-f-total">');if(at<0)return html;
    const region=articleStudyElement(html,at,'output'),updated=region.html.replace(/<span>[\s\S]*?<\/span>/,'<span>$ 0.00 <small>Sin piezas capturadas</small></span>');
    return html.slice(0,at)+updated+html.slice(region.end);
  };

  function readField(itemId, id, kind, key, label, value, select = false) {
    const attributes=' data-row-open="'+esc(kind)+'" data-row-item="'+esc(itemId)+'" data-row-id="'+esc(id)+'" data-row-field="'+esc(key)+'"';
    const name=label+' · '+String(value==null||value===''?'sin definir':value), disabled=!editable()||app.busy||app.operation, controlId='rv-'+kind+'-'+id+'-'+key.replaceAll('.','-');
    const control=select?'<select id="'+esc(controlId)+'"'+attributes+' aria-label="'+esc(name)+'"'+(disabled?' disabled':'')+'><option>'+esc(value||'Seleccionar')+'</option></select>'
      :'<input id="'+esc(controlId)+'" type="text"'+attributes+' aria-label="'+esc(name)+'" value="'+esc(value??'')+'" readonly'+(disabled?' disabled':'')+'>';
    const html='<div class="field"><label for="'+esc(controlId)+'">'+esc(label)+'</label>'+control+'</div>';
    return kind==='wood'?woodRequirement(html,key):html;
  }
  function displayAmount(value, item, process, costMap) {
    try {
      if(process && value.source?.kind==='included'){
        const linked=breakdownRow(item.id).materials.some(material=>material.id===value.source.includedInMaterialId);
        return value.source.reviewed&&linked?'Incluido':'Inclusión pendiente';
      }
      if(process && value.source?.kind==='tariff'){
        const id='CST_MFG_'+D.sha256(item.id+'|P_'+value.id).slice(0,32),entry=costMap?.get(id);
        return QuotePdf.money(entry?.netAmount?D.decimal(entry.netAmount,2):null);
      }
      return QuotePdf.money(breakdownLineSubtotal(value,item,process));
    } catch (_) { return 'Pendiente'; }
  }
  function referenceItem(itemId) {
    const entry=recipeEntry(itemId), recipe=entry && DemoRecipeCatalog.recipe(entry.recipeId), source=recipe?.documentary;
    return source?.basis==='ONE_ARTICLE' && source.currency==='UNVERIFIED' && source.financialConfirmed===false;
  }
  function hasPurchasePrice(value){try{return value.unitPrice!==''&&value.purchaseQuantity!==''&&D.decimal(value.unitPrice,2)>=0&&D.decimal(value.purchaseQuantity,3)>0;}catch(_){return false;}}
  const boardSubstrates=['MDF','Triplay','Sábana','MDP','Triplay flexible','MDF Flexible','Lisapol','MDF de color','Acrílico','Aglomerado','MDF melamínico','Superficie sólida','Otro'];
  const boardCoatings=['Encino rojo','Encino blanco','Tzalam','Nogal','Fresno','Rosa morada','Pino','Teca nacional','Teca Brasileña','Parota','Huanacaxtle','Cedro rojo','Tornillo','Laminado plástico','Vinil','Melamina','Otro'];
  function boardBasis(itemId,id){
    const local=solidWoodState(itemId),saved=recipeEntry(itemId)?.boards?.find(row=>row.id===id),settings=(local.boardSettings||=Object.create(null));
    return settings[id]||=saved?{sheetAreaM2:saved.sheetAreaM2,wasteRate:saved.wasteRate}:{sheetAreaM2:'',wasteRate:''};
  }
  function boardMaterial(item,value){
    if(value.measureSource!=='part')return value;
    const width=item.specs.find(spec=>spec.type==='Ancho'&&!spec.na),length=item.specs.find(spec=>spec.type==='Largo'&&!spec.na);
    return {...value,width:width?.value||'',length:length?.value||'',lengthUnit:width?.unit===length?.unit?width?.unit:''};
  }
  function boardResult(item,value){const draft=app.breakdownEditor,invalid=draft?.value.id===value.id&&Object.keys(draft.numericErrors||{}).length,perSheet=/^hoja$/i.test(value.purchaseUnit||'');return boardCalculator.calculate(boardMaterial(item,invalid||!perSheet?{...value,unitPrice:''}:value),boardBasis(item.id,value.id),String(item.quantity));}
  function boardMoney(cents){return cents===null?'Pendiente':QuotePdf.money(Number(cents));}
  const boardGrid=(...cells)=>'<div class="rv-board-grid">'+cells.map((body,i)=>'<div class="rv-board-cell rv-board-cell-'+i+'">'+body+'</div>').join('')+'</div>';
  function boardHeading(){
    return '<div class="rv-board-heading" aria-hidden="true">'+boardGrid('<span>Pieza</span>','<span>Composición de tablero</span>','<span>Cant.</span>',
      '<span>Medidas y superficie</span><div class="rv-board-three"><small>Ancho</small><small>Largo</small><small>Área m²</small></div>',
      '<span>Cantos</span><div class="rv-board-two"><small>Ancho</small><small>Largo</small></div>',
      '<span>Caras</span><div class="rv-board-two"><small>Pintura</small><small>Pegado</small></div>',
      '<span>CNC / Láser</span><div class="rv-board-two"><small>Recorrido cm</small><small>Repet.</small></div>','<span>Costo base</span>')+'</div>';
  }
  function boardRow(item,value,editing=false){
    const f=(key,label,v,options={})=>editing?breakdownField(key,label,v,options):readField(item.id,value.id,'material',key,label,v,!!options.values);
    const options=(list,value)=>[['','—'],...[...new Set([...list,...(value&&!list.includes(value)?[value]:[])])].map(row=>[row,row])];
    const d=value.detail||{},physical=boardMaterial(item,value),result=boardResult(item,value),inherited=value.measureSource==='part';
    const select=(key,label,v)=>f(key,label,v,{values:options(['0','1','2'],v)});
    const dim=(key,label)=>{let html=f(key,label,physical[key],{number:true});if(editing&&inherited)html=html.replace('<input ','<input readonly aria-readonly="true" ');return html;};
    const composition=f('substrate','Sustrato',value.substrate,{values:options(boardSubstrates,value.substrate)})+f('thickness','Espesor · mm',value.thickness,{values:options(['3','4.2','5','5.5','6','9','12','15','18','25','30','45'],value.thickness)})+'<small>'+esc(value.supplier||'')+'</small>';
    return boardGrid(f('name','Pieza',value.name),composition,f('quantity','Cantidad por artículo',value.quantity,{number:true}),
      '<div class="rv-board-three">'+dim('width','Ancho · '+(physical.lengthUnit||'unidad'))+dim('length','Largo · '+(physical.lengthUnit||'unidad'))+'<output data-board-area="'+esc(value.id)+'">'+esc(result.areaM2??'—')+'</output></div>',
      '<div class="rv-board-two">'+select('detail.edgeWidthCount','Cantos ancho',d.edgeWidthCount)+select('detail.edgeLengthCount','Cantos largo',d.edgeLengthCount)+'</div>',
      '<div class="rv-board-two">'+select('detail.paintFaces','Caras con pintura',d.paintFaces)+select('detail.gluedFaces','Caras pegadas',d.gluedFaces)+'</div>',
      '<div class="rv-board-two">'+f('detail.linearCentimeters','Recorrido CNC · cm',d.linearCentimeters,{number:true})+f('detail.laserCount','Repeticiones CNC',d.laserCount,{number:true})+'</div>',
      '<output data-board-base="'+esc(value.id)+'" aria-live="polite">'+esc(boardMoney(result.totalCents))+'</output>');
  }
  function boardEditor(draft){
    const value=draft.value,item=partViewQuote().items.find(item=>item.id===draft.itemId),basis=boardBasis(item.id,value.id);
    const setting=(key,label)=>'<div class="field"><label for="board-'+esc(value.id)+'-'+key+'">'+label+'</label><input id="board-'+esc(value.id)+'-'+key+'" data-board-setting="'+key+'" data-board-id="'+esc(value.id)+'" value="'+esc(basis[key])+'" inputmode="decimal" maxlength="40"></div>';
    return '<div class="rv-edit rv-board-edit" data-row-editor="'+esc(value.id)+'">'+boardRow(item,value,true)+
      '<details class="rv-board-options"><summary>Composición, precio y nota</summary><div class="rv-board-options-grid">'+
      breakdownField('coating','Recubrimiento',value.coating,{values:[['','—'],...boardCoatings.map(name=>[name,name])]})+
      breakdownField('detail.naturalFace','Caras del tablero',value.detail?.naturalFace,{values:[['','—'],['1/C','1 cara'],['2/C','2 caras'],['Natural','Natural']]})+
      breakdownField('measureSource','Medidas',value.measureSource,{values:[['own','De la pieza'],['part','Del artículo']]})+
      breakdownField('lengthUnit','Unidad de medidas',value.lengthUnit,{values:[['','—'],['cm','cm'],['mm','mm'],['m','m']]})+
      breakdownField('unitPrice','Precio por hoja',value.unitPrice,{number:true})+setting('sheetAreaM2','Área por hoja · m²')+setting('wasteRate','Desperdicio %')+
      breakdownField('purchaseUnit','Unidad de compra',value.purchaseUnit,{values:breakdownDetailChoices(detailUnits,value.purchaseUnit)})+breakdownField('purchaseQuantity','Cantidad de compra',value.purchaseQuantity,{number:true})+breakdownField('taxRate','IVA %',value.taxRate,{number:true})+
      breakdownField('supplier','Proveedor (opcional)',value.supplier,{max:200})+breakdownField('detail.notes','Nota',value.detail?.notes,{max:500})+
      '</div></details>'+(draft.error?'<p class="error" role="alert">'+esc(draft.error)+'</p>':'')+'<span class="rv-announcement" data-row-autosave-status role="status" aria-live="polite"></span></div>';
  }
  function refreshBoard(){
    const draft=app.breakdownEditor;if(draft?.value.section!=='boards'||draft.kind!=='component')return;
    const item=partViewQuote().items.find(item=>item.id===draft.itemId);if(!item)return;
    const result=boardResult(item,draft.value),root=quoteRoot.querySelector('[data-row-editor="'+CSS.escape(draft.value.id)+'"]');
    const area=root?.querySelector('[data-board-area]'),amount=root?.querySelector('[data-board-base]');
    if(area)area.textContent=result.areaM2??'—';if(amount)amount.textContent=boardMoney(result.totalCents);
  }
  for(const type of ['input','change'])quoteRoot.addEventListener(type,event=>{
    const node=event.target,draft=app.breakdownEditor,key=node?.dataset?.boardSetting;
    if(key&&['sheetAreaM2','wasteRate'].includes(key)&&draft?.kind==='component'&&draft.value.section==='boards'&&draft.value.id===node.dataset.boardId&&draft.itemId===app.openPartId&&recipeCanEdit()){
      boardBasis(draft.itemId,draft.value.id)[key]=String(node.value).slice(0,40);
    }
    if(draft?.value.section==='boards')refreshBoard();
  });
  function closedRow(item, value, kind, costMap) {
    if(kind==='material'&&value.section==='boards')return boardRow(item,value);
    const wood=kind==='wood', process=kind==='process', supply=!wood&&!process&&value.section==='supplies', f=(key,label,v,select=false)=>readField(item.id,value.id,kind,key,label,v,select);
    const namedBySpecification=!wood && ['supplies','maquilas'].includes(value.section);
    const name=wood?value.name:namedBySpecification?value.specification||value.name||value.category||'':value.name||value.category||value.specification||'';
    const labor=process && /-(labor|cnc)$/.test(value.section||''), conceptKey=wood?'name':((process&&value.section==='maquilas')||value.section==='supplies')?'specification':labor?'category':'name';
    const concept=f(conceptKey,wood?'Pieza':'Concepto',name,labor);
    const useDays=labor&&breakdownLaborByDays(value);
    const quantity=f(wood?'quantityPerProduct':process?(labor?(useDays?'detail.days':'hours'):'quantity'):'purchaseQuantity',wood?'Cantidad por artículo':labor?(useDays?'Días':'Horas estimadas'):'Cantidad',wood?value.quantityPerProduct:process?(labor?(useDays?value.detail?.days:value.hours):value.quantity):value.purchaseQuantity);
    const unit=wood?woodUnit(value.id):labor?laborUnit(value.id,useDays):f(process?'unit':'purchaseUnit','Unidad',process?value.unit:value.purchaseUnit,true);
    const result=wood?solidWoodResult(item.id,value):null,priceValue=wood?result.priceResolution.appliedPrice:process?value.detail?.unitPrice:value.unitPrice;
    const priceLabel=wood?'Precio del material':referenceItem(item.id)?'Precio de referencia':'Precio unitario';
    const price=labor?pending('Precio unitario'):f(wood?'adjustment.price':process?'detail.unitPrice':'unitPrice',priceLabel,priceValue==null?'':String(priceValue));
    const amount=wood?solidWoodMoney(result.articleCosts.woodCost):displayAmount(value,item,process,costMap);
    const jointLabel=value.jointed==null||value.jointed===''?'':String(value.jointed)==='1'?'Sí':String(value.jointed)==='0'?'No':'Por revisar';
    const measures=wood?'<div class="rv-wood-measure-grid">'+f('width','Ancho',value.width)+f('length','Largo',value.length)+f('lengthUnit','Unidad de medidas',value.lengthUnit,true)+f('finishFaces','Caras de acabado',value.finishFaces,true)+f('jointed','Entablerado',jointLabel,true)+f('wasteRate','Desperdicio (%)',value.wasteRate)+'</div>':'';
    const choice=wood?value.cnc?.decision==='yes'?'Sí':value.cnc?.decision==='no'?'No':'—':'';
    const cnc=wood?f('cnc.decision','CNC / láser',choice,true):'';
    const row=wood?woodGrid(concept,'<div class="rv-wood-quantity">'+quantity+unit+'</div>',f('woodKind','Material',value.woodKind,true),f('thickness','Espesor (in)',value.thickness),measures,price,cnc,amountHtml(amount,'',false,'Calculado con medidas')):supply?supplyGrid(f('category','Tipo de insumo',value.category,true),concept,f('sku','SKU',value.sku),quantity,unit,price,amountHtml(amount)):grid(concept,quantity,unit,price,amountHtml(amount));
    if(wood)return row;
    const detailLabel=supply?'Proveedor':process?'Proveedor / SKU y detalles':'Proveedor / SKU';
    const detailButton='<button type="button" class="quiet rv-detail-trigger" data-row-details="'+esc(kind)+'" data-row-item="'+esc(item.id)+'" data-row-id="'+esc(value.id)+'">'+detailLabel+'</button>';
    return row+detailButton;
  }
  function nativeStatus(html) {
    const start=html.indexOf('<span class="article-panel-cost-state"');
    return start<0?'':articleStudyElement(html,start,'span').html.replace('Costo preview','Costo por validar').replace('Preview local; no es costo financiero confirmado.','Costo pendiente de validar.');
  }
  function materialOrProcess(item, value, kind, costMap, nativeHtml, shared=false) {
    const draft=app.breakdownEditor, active=!!(draft && draft.itemId===item.id && draft.value?.id===value.id && (kind==='material'?['component','purchase'].includes(draft.kind):draft.kind==='process'));
    const edit='<button type="button" class="quiet '+(editable()?'rv-redundant-edit':'')+'" data-break-action="'+(kind==='material'?'edit-component':'edit-process')+'" data-id="'+esc(value.id)+'">'+(editable()?'Editar':'Consultar')+'</button>';
    const remove=articlePanelDeleteButton(kind,item,value.id,value.name||value.category);
    const body=active?breakdownEditorHtml():closedRow(item,value,kind,costMap);
    if(kind==='material'&&value.section==='boards')return '<article class="fab-detail-line article-panel-record rv-row rv-board-row" data-record-id="'+esc(value.id)+'" data-record-kind="material">'+body+'<div class="rv-board-actions"><button type="button" class="quiet" data-break-action="duplicate-component" data-id="'+esc(value.id)+'">Duplicar</button>'+remove+'</div></article>';
    const priced=kind==='material'&&value.section==='supplies'&&hasPurchasePrice(value);
    const status='<div class="rv-row-status">'+(priced?'':nativeStatus(nativeHtml))+(shared?'<small>Compra compartida: se suma una sola vez.</small>':'')+(!priced&&referenceItem(item.id)?'<small>Referencia pendiente de validar.</small>':'')+'</div>';
    return '<article class="fab-detail-line article-panel-record rv-row" data-record-id="'+esc(value.id)+'" data-record-kind="'+kind+'">'+body+status+'<div class="rv-row-actions">'+(active?'':edit)+remove+'</div></article>';
  }
  articlePanelMaterialCard = function (item, row, value, measurement) {
    const shared=!!value.purchaseGroup&&row.materials.filter(material=>material.purchaseGroup===value.purchaseGroup).length>1;
    return materialOrProcess(item,value,'material',null,nativeMaterialCard(item,row,value,measurement),shared);
  };
  articlePanelProcessCard = function (item, value, costMap) { return materialOrProcess(item,value,'process',costMap,nativeProcessCard(item,value,costMap)); };
  solidWoodRecipeCard = function (item, component) {
    const native=nativeWoodCard(item,component),draft=app.breakdownEditor;
    const active=!!(draft?.solidWoodF&&draft.itemId===item.id&&draft.solidWoodF.id===component.id&&partSameContext(draft.context));
    const id='wood-piece-editor-'+component.id, marker='id="'+esc(id)+'"', at=native.indexOf(marker), start=native.lastIndexOf('<div',at);
    if(at<0||start<0)throw Error('Wood row editor anchor missing');
    const panel=articleStudyElement(native,start,'div').html;
    const toggle='<button type="button" class="quiet" data-solid-action="edit" data-article-id="'+esc(item.id)+'" data-id="'+esc(component.id)+'" aria-controls="'+esc(id)+'" aria-expanded="'+active+'" aria-label="'+esc((active?'Cerrar edición de ':'Editar ')+(component.name||'pieza de madera'))+'">'+(active?'Cerrar edición':'Editar')+'</button>';
    const remove=articlePanelDeleteButton('wood',item,component.id,component.name);
    return '<article class="fab-detail-line article-panel-record rv-row" data-record-id="'+esc(component.id)+'" data-record-kind="wood">'+(active?panel:closedRow(item,component,'wood',null)+panel)+'<div class="rv-row-actions">'+(active?'':toggle+remove)+'</div></article>';
  };
  function tableWrap(html, marker, kind) {
    let offset=0;
    while(true){
      const at=html.indexOf(marker,offset);if(at<0)break;
      const region=articleStudyElement(html,at,'div');
      const body=kind==='supply'?region.html.replace(marker,'<div class="fab-detail-list rv-supply-list">'):region.html;
      const board=region.html.includes('data-board-area');
      const replacement='<div class="rv-table-scroll" role="region" tabindex="0" aria-label="'+(kind==='wood'?'Tabla de piezas de madera':board?'Tabla de tableros':'Tabla de conceptos')+'"><div class="rv-table-content'+(kind==='wood'?' rv-wood-table':kind==='supply'?' rv-supply-table':board?' rv-board-table':'')+'">'+(board?boardHeading():tableHeading(kind))+body+'</div></div>';
      html=html.slice(0,at)+replacement+html.slice(region.end);
      offset=at+replacement.length;
    }
    return html;
  }
  articleStudyHtml = function (item,index,fields,base) {
    let html=nativeStudy(item,index,fields,base);
    if(!html.includes('data-article-study="desglose"'))return html;
    const totals=familyTotals(item.id);
    for(const [key,value] of Object.entries(totals)){
      const placeholder='<output data-rv-family-total="'+esc(key)+'" data-rv-article="'+esc(item.id)+'" aria-live="polite">Sin evaluar</output>';
      html=html.replace(placeholder,familyOutput(item.id,key,value));
    }
    const supplyMarker='<section class="fab-detail-section" data-detail-section="supplies">',supplyAt=html.indexOf(supplyMarker);
    if(supplyAt>=0){
      const region=articleStudyElement(html,supplyAt,'section');
      html=html.slice(0,supplyAt)+tableWrap(region.html,'<div class="fab-detail-list">','supply')+html.slice(region.end);
    }
    html=tableWrap(html,'<div class="fab-detail-list rv-board-list">','board');
    html=tableWrap(html,'<div class="fab-detail-list">','general');
    html=tableWrap(html,'<div class="recipe-piece-list">','wood');
    const marker='<div class="wood-direct-pieces" aria-label="Piezas de madera">',at=html.indexOf(marker);
    if(at>=0){
      const region=articleStudyElement(html,at,'div'), key=item.id+'|row-wood-dimensions', stored=app.breakdownUi.panels||{};
      const open=Object.hasOwn(stored,key)?stored[key]:true;
      const body=region.html.slice(marker.length,-6);
      const folded=marker+'<details class="rv-wood-dimensions" data-fab-item="'+esc(item.id)+'" data-fab-panel="row-wood-dimensions"'+(open?' open':'')+'><summary><span class="rv-section-number">01</span>Dimensiones de materia prima</summary><div class="rv-wood-dimensions-body">'+body+'</div></details></div>';
      html=html.slice(0,at)+folded+html.slice(region.end);
    }
    return html;
  };
  quoteRoot.addEventListener('focusin', event => {
    const target=event.target, kind=target?.dataset?.rowOpen, itemId=target?.dataset?.rowItem, id=target?.dataset?.rowId, field=target?.dataset?.rowField;
    if(!kind||!id||itemId!==app.openPartId||!recipeCanEdit()||app.breakdownContinuation||app.partContinuation)return;
    if(kind==='wood')solidWoodOpen(itemId,id);
    else breakdownAction({dataset:{breakAction:kind==='material'?'edit-component':'edit-process',id}});
    requestAnimationFrame(()=>{
      const draft=app.breakdownEditor;
      if(app.breakdownContinuation||!draft||draft.itemId!==itemId||(draft.solidWoodF?.id||draft.value?.id)!==id)return;
      const attr=kind==='wood'?'data-solid-field':'data-break-field';
      const selector=kind==='wood'&&field==='cnc.decision'?'[data-solid-cnc-choice], [data-solid-field="cnc.decision"]':'['+attr+'="'+CSS.escape(field)+'"]';
      quoteRoot.querySelector(selector)?.focus({preventScroll:true});
    });
  },true);
  quoteRoot.addEventListener('click', event => {
    const button=event.target.closest?.('[data-row-details]'),kind=button?.dataset?.rowDetails,itemId=button?.dataset?.rowItem,id=button?.dataset?.rowId;
    if(!kind||!id||itemId!==app.openPartId||!recipeCanEdit()||app.breakdownContinuation||app.partContinuation)return;
    event.preventDefault();
    (app.breakdownUi.panels||=Object.create(null))[itemId+'|variant-row-detail-'+id]=true;
    if(kind==='wood')solidWoodOpen(itemId,id);
    else breakdownAction({dataset:{breakAction:kind==='material'?'edit-component':'edit-process',id}});
    requestAnimationFrame(()=>{
      const draft=app.breakdownEditor;
      if(app.breakdownContinuation||!draft||draft.itemId!==itemId||(draft.solidWoodF?.id||draft.value?.id)!==id)return;
      quoteRoot.querySelector('[data-fab-panel="variant-row-detail-'+CSS.escape(id)+'"] > summary')?.focus({preventScroll:true});
    });
  });
}

function once(source, before, after, label) {
  if (source.split(before).length !== 2) throw Error('Row variant anchor changed: ' + label);
  return source.replace(before,after);
}
export function extendRowVariant(source) {
  source=once(source,"(scopeEnabled()&&app.step===0?'':'<aside class=\"aside\" aria-label=\"Resumen financiero\">'+metrics()+'</aside>')","''",'remove financial side panel');
  source=once(source,'Vista previa · cambios sin aplicar','Cambios sin aplicar','draft status label');
  source=once(source,'El catálogo DEMO está vacío.','El catálogo está vacío.','empty catalog label');
  source=once(source,'Ilustración DEMO · ','Ilustración · ','catalog image label');
  source=once(source,'<h3 id=\"line-catalog-title\">Catálogo general de Duco · DEMO</h3><p>Explora productos sintéticos sin precios ni costos de catálogo.</p>','<h3 id=\"line-catalog-title\">Catálogo de productos</h3>','catalog heading');
  source=once(source,'Cliente existente · ID verificado','Cliente seleccionado','client selection label');
  source=once(source,"(app.lineCatalog?' en DEMO':'')","''",'client selection context');
  source=once(source,'Vista DEMO: no se escribirán clientes en el maestro.','Los cambios de esta sesión no modifican el catálogo de clientes.','client session notice');
  source=once(source,'Madera F vive sólo en memoria local: el backend aún no soporta su persistencia. No se envió un guardado parcial. Conserva el editor abierto o descarta explícitamente el preview F para guardar sólo los datos del contrato vigente.','La captura de madera aún no puede guardarse. Conserva el editor abierto o descarta la captura de madera para guardar el resto.','wood save notice');
  const inline = "const inlineEditor=key=>draft&&editorSection===key?'<div class=\"fab-inline-editor\" data-inline-editor-for=\"'+esc(key)+'\">'+breakdownEditorHtml()+'</div>':'';";
  const inRow = "const inlineEditor=key=>draft&&editorSection===key&&!((['component','purchase'].includes(draft.kind)&&row.materials.some(m=>m.id===draft.value.id))||(draft.kind==='process'&&row.processes.some(p=>p.id===draft.value.id)))?'<div class=\"fab-inline-editor\" data-inline-editor-for=\"'+esc(key)+'\">'+breakdownEditorHtml()+'</div>':'';";
  source=once(source,inline,inRow,'editor placement');
  source=once(source,"const editing=draft?.kind==='process'&&editorSection===key,visible=processes.filter(p=>!editing||p.id!==draft.value.id);","const editing=draft?.kind==='process'&&editorSection===key,visible=processes;",'maquila rows');
  source=once(source,"const visibleMaterials=materials.filter(m=>!draft||!['component','purchase'].includes(draft.kind)||draft.value.id!==m.id),visibleProcesses=processes.filter(p=>draft?.kind!=='process'||draft.value.id!==p.id);","const visibleMaterials=materials,visibleProcesses=processes;",'family rows');
  source=once(source,"const groupActions=groups.length?","const groupActions=key!=='supplies'&&groups.length?",'remove supply group button');
  source=once(source,"visible.length?visible.map(processCard).join(''):editing?'':'<p class=\"fab-detail-pending\">Despiece pendiente · no se crearon piezas ni costos.</p>'",
    "visible.length?visible.map(processCard).join(''):editing?'':'<p class=\"fab-detail-pending\">Sin maquilas.</p>'",'empty maquila description');
  source=once(source,"return '<section class=\"fab-detail-section\" data-detail-section=\"'+key+'\"><h5>'+label+'</h5><div class=\"fab-detail-list\">'+",
    "const supplyInline=key==='supplies'?inlineEditor(key):'';return '<section class=\"fab-detail-section\" data-detail-section=\"'+key+'\"><h5>'+label+'</h5><div class=\"fab-detail-list\">'+", 'supply editor preparation');
  source=once(source,"(materials.length||processes.length?materials.map(materialCard).join('')+processes.map(processCard).join(''):'<p class=\"fab-detail-pending\">Despiece pendiente · no se crearon piezas ni costos.</p>')+'</div>'+groupActions",
    "(materials.length||processes.length?materials.map(materialCard).join('')+processes.map(processCard).join(''):supplyInline?'':'<p class=\"fab-detail-pending\">Sin conceptos aplicados.</p>')+(supplyInline?'<div class=\"rv-new-row\">'+supplyInline+'</div>':'')+'</div>'+groupActions",'new supply in table');
  source=once(source,'Pendiente · aún no hay piezas aplicadas.','Sin piezas aplicadas.','empty piece description');
  source=once(source,"+otherMaterials+'</div>'+inlineEditor(key)+'</section>';",
    "+otherMaterials+'</div>'+(key==='supplies'?'':inlineEditor(key))+'</section>';",'supply editor placement');
  source=once(source,"activePanel==='board-piece-'+m.id?editing(activePanel):materialCard(m)","activePanel==='board-piece-'+m.id&&draft?.kind==='group'?editing(activePanel):materialCard(m)",'board rows');
  source=once(source,"const boardPieces=boardMaterials.map((m,index)=>fold('board-piece-'+m.id,'Pieza '+(index+1)+' · '+(m.name||'Sin nombre'),activePanel==='board-piece-'+m.id&&draft?.kind==='group'?editing(activePanel):materialCard(m),'Tablero')).join('')\n      +(newBoard?fold('board-piece-'+newBoard.id,'Nueva pieza de tablero',editing('board-piece-'+newBoard.id)):'');",
    "const boardPieces='<div class=\"fab-detail-list rv-board-list\">'+boardMaterials.map(materialCard).join('')+(newBoard?editing('board-piece-'+newBoard.id):'')+'</div>'+(draft?.kind==='group'&&draft.sectionKey==='boards'?editing(activePanel):'');",'flat board rows');
  source=once(source,"+fold('board-new','Añadir pieza de tablero',addMaterial('boards','Pieza / material'))","+addMaterial('boards','Pieza / material')",'board add action');
  source=once(source,"+fold('board-dimensions','Dimensiones de materia prima',dimensions(['boards'],true),'Medidas y área de cantos')","",'board dimensions in row');
  source=once(source,"const variant='panel'; // User-approved article architecture, independent of candidate interiors.","const variant='desglose'; // Local row variant: expandable families.",'article accordion');
  source=once(source,"folds:{general:true,supplies:true,wood:false}","folds:{general:false,supplies:true,wood:true}",'initial accordion state');
  source=once(source,"const summary=s=>'<span class=\"article-study-section-name\">'+esc(s.label)+'</span><small>'+esc(s.summary)+'</small>';",
    "const summary=s=>'<span class=\"article-study-section-name\">'+esc(s.label)+'</span>'+(s.key==='general'?'':'<span class=\"rv-family-meta\"><small class=\"rv-family-count\">'+esc(s.count)+' '+(s.count===1?'concepto':'conceptos')+'</small><output data-rv-family-total=\"'+esc(s.key)+'\" data-rv-article=\"'+safeId+'\" aria-live=\"polite\">Sin evaluar</output></span>');",'family counts and totals');
  source=once(source,"if(profile==='current')return output;","if(profile==='current'||!output.includes('data-article-study=\"panel\"'))return output;",'alternate profile');
  const marker='globalThis.__client = {';
  if(source.includes('/* ROW_VARIANT */')||source.split(marker).length!==2)throw Error('Row variant installation anchor changed');
  return source.replace(marker,()=> '/* ROW_VARIANT */\n('+installRowVariant.toString()+')(('+createBoardCalculator.toString()+')());\n'+marker);
}
