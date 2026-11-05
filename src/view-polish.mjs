// Local B presentation approved in the 4 November browser annotations.
// Quantity still uses the native item setter, validation and session capture.
function installViewPolish() {
  const nativePartPreview=partPreviewHtml;
  partPreviewHtml=function(id){return nativePartPreview(id).replace('<p class="error" role="alert">Escribe la descripción de la pieza.</p>','');};
  const discrete=item=>['Pieza','Juego'].includes(item.unit);
  function quantityField(item,index,open) {
    let html=open?field('items.'+index+'.quantity','Cantidad',{type:'number',digits:discrete(item)?0:3,positive:true,max:100000})
      : '<div class="field"><label for="header-quantity-'+esc(item.id)+'">Cantidad</label><input id="header-quantity-'+esc(item.id)+'" type="number" value="'+esc(item.quantity)+'" readonly data-header-open="'+esc(item.id)+'" aria-label="Cantidad de '+esc(D.articleName(item))+'; editar artículo"></div>';
    const input=html.match(/<input\b[^>]*>/)?.[0];
    if(input&&discrete(item))html=html.replace(input,()=>'<span class="header-quantity-control"><button type="button" data-header-decrement="'+esc(item.id)+'" aria-label="Reducir cantidad de '+esc(D.articleName(item))+'"'+(item.quantity===''||Number(item.quantity)<=1?' disabled':'')+'><span aria-hidden="true">‹</span></button>'+input+'<button type="button" data-header-increment="'+esc(item.id)+'" aria-label="Aumentar cantidad de '+esc(D.articleName(item))+'"'+(Number(item.quantity)>=100000?' disabled':'')+'><span aria-hidden="true">›</span></button></span>');
    return html;
  }
  const nativeSolidField=solidWoodField;
  solidWoodField=function(key,label,value,options={}) {
    if(['jointed','cnc.decision'].includes(key)){
      options={...options,values:key==='jointed'?[['','—'],['0','No'],['1','Sí']]:[['','—'],['no','No'],['yes','Sí']]};
    }
    let html=nativeSolidField(key,label,value,options);
    if(['jointed','cnc.decision'].includes(key))html=html.replace(/<option value=""( selected)?>[^<]*<\/option>/,'<option value="" disabled hidden$1>—</option>');
    return html;
  };
  articleHeaderMarkup = function (item, cost) {
    const id=esc(item.id), value=articleHeaderSingleValue(cost);
    const index=partViewQuote().items.findIndex(row=>row.id===item.id);
    const canEdit=editable()&&!app.operation&&!app.busy;
    const quantity=canEdit&&app.openPartId===item.id
      ? quantityField(item,index,true)
      : canEdit
        ? quantityField(item,index,false)
        : '<span data-article-header-quantity>Cantidad: '+esc(item.quantity||'—')+'</span>';
    return '<div class="part-header-facts" data-article-cost-head="'+id+'"><div class="part-header-quantity">'+quantity+'</div><span data-article-header-unit>Unidad: '+esc(item.unit||'—')+'</span><span class="article-header-cost-single '+(value.amount?'is-amount':'status-dot warn')+'" data-article-cost-status="'+id+'" aria-live="polite" aria-atomic="true" title="'+esc(cost.reason)+'" aria-label="'+esc(value.label)+'">'+esc(value.text)+'</span></div>';
  };
  quoteRoot.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-header-increment],[data-header-decrement]')||(event.target.dataset?.headerIncrement||event.target.dataset?.headerDecrement?event.target:null);
    const id=button?.dataset?.headerIncrement||button?.dataset?.headerDecrement,delta=button?.dataset?.headerDecrement?-1:1;
    if(!id||button.disabled||app.step!==1||!editable()||app.operation||app.busy||app.partContinuation||app.breakdownContinuation)return;
    const context=partContext();
    const changeQuantity=()=>{
      if(!partSameContext(context)||!editable()||app.operation||app.busy||!openPartEditor(id))return;
      const index=partViewQuote().items.findIndex(row=>row.id===id),item=partViewQuote().items[index];
      if(!discrete(item))return;
      const current=item.quantity;
      if(current===''&&delta<0||current!==''&&(!/^\d+$/.test(String(current))||Number(current)<1||Number(current)>100000||Number(current)+delta<1||Number(current)+delta>100000)){editor();return;}
      const input={id:'f-items-'+index+'-quantity',dataset:{path:'items.'+index+'.quantity',digits:'0'},value:String(current===''?1:Number(current)+delta),type:'number',tagName:'INPUT',max:'100000',validity:{badInput:false},selectionStart:null,selectionEnd:null,hasAttribute:()=>false,setAttribute(){},setCustomValidity(){}};
      partInput(input,false);rowSessionAutosave.flush();
    };
    if(app.openPartId===id)changeQuantity();else if(partGuard(changeQuantity))changeQuantity();
  });
  quoteRoot.addEventListener('focusin',event=>{
    const id=event.target?.dataset?.headerOpen;
    if(!id||app.step!==1||!editable()||app.operation||app.busy||app.partContinuation||app.breakdownContinuation)return;
    const context=partContext();
    const open=()=>{
      if(!partSameContext(context)||!editable()||app.operation||app.busy||!openPartEditor(id))return;
      editor();
      const index=partViewQuote().items.findIndex(row=>row.id===id);
      quoteRoot.querySelector('[data-path="items.'+index+'.quantity"]')?.focus({preventScroll:true});
    };
    // Opening a different header must resolve the previous article's invalid
    // input just like the native accordion trigger; a focus change is no bypass.
    if(partGuard(open))open();
    else quoteRoot.querySelector('[aria-invalid="true"]')?.focus({preventScroll:true});
  },true);
}

function once(source,before,after,label) {
  if(source.split(before).length!==2)throw Error('B view anchor changed: '+label);
  return source.replace(before,after);
}

export function extendViewPolish(source) {
  // Later user annotation: only discrete commercial units require integers.
  source=once(source,'quantity: num(r.quantity, 3, 100000, `items.${i}.quantity`, true),','quantity: num(r.quantity, [\'Pieza\',\'Juego\'].includes(r.unit)?0:3, 100000, `items.${i}.quantity`, true),','discrete commercial quantity');
  const statuses=source.match(/<p class="meta article-flow-status">[\s\S]*?<\/p>/g)||[];
  if(statuses.length!==2)throw Error('Expected both native article introduction blocks');
  source=source.replace(/<p class="meta article-flow-status">[\s\S]*?<\/p>/g,'');
  const contexts=source.match(/^      '<div class="editor-context">[^\n]+\n/gm)||[];
  if(contexts.length!==1)throw Error('Expected one duplicate editor context');
  source=source.replace(contexts[0],'');
  source=once(source,'<div class="part-dimensions-quantity">\'+field(`items.${i}.quantity`,\'Cantidad\',{type:\'number\',digits:3,positive:true})+\'</div>','','quantity body field');
  source=once(source,'<h3 class="part-accordion-heading"><button','<div class="part-accordion-heading"><h3 class="part-heading-title"><button','article heading structure');
  source=once(source,"</strong></span></span>'+articleHeaderMarkup(r,costHeader)+'</button></h3>'",
    "</strong></span></span></button></h3>'+articleHeaderMarkup(r,costHeader)+'</div>'",'quantity outside toggle');
  source=once(source,'aria-label="Etapas de la cotización"','aria-label="Secciones del cotizador"','quote section navigation');
  const numbers="'><span class=\"stepnum\">' +\n            (i + 1) +\n            '</span>' +";
  source=once(source,numbers,"'>' +",'un-numbered section tabs');
  return once(source,'globalThis.__client = {','('+installViewPolish.toString()+')();\nglobalThis.__client = {','view installation');
}
