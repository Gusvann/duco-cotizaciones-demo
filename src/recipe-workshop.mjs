// Local calculation references. Geometry is supplied by the existing wood
// calculator; these amounts never create quote costs or confirm a tariff.
export function createWorkshopCalculator() {
  const r=(n,d=1n)=>({n:BigInt(n),d:BigInt(d)});
  const add=(a,b)=>a&&b?r(a.n*b.d+b.n*a.d,a.d*b.d):null;
  const mul=(a,b)=>a&&b?r(a.n*b.n,a.d*b.d):null;
  const div=(a,b)=>a&&b&&b.n>0n?r(a.n*b.d,a.d*b.n):null;
  function decimal(value,digits=6,max=1000000) {
    if(typeof value!=='string'||value.length>40||!new RegExp('^\\d+(?:\\.\\d{1,'+digits+'})?$').test(value))return null;
    const [whole,fraction='']=value.split('.'),parsed=r(whole+fraction,10n**BigInt(fraction.length));
    return parsed.n<=BigInt(max)*parsed.d?parsed:null;
  }
  function integer(value,max=1000000){return typeof value==='string'&&/^\d{1,12}$/.test(value)&&BigInt(value)<=BigInt(max)?r(value):null;}
  const optional=(value,parse=decimal)=>value===''?r(0):parse(value);
  const rate=value=>decimal(value,2,100000000);
  function exact(value) {
    if(!value||!/^\d{1,160}$/.test(value.numerator)||!/^\d{1,160}$/.test(value.denominator)||BigInt(value.denominator)===0n)return null;
    return r(value.numerator,value.denominator);
  }
  function text(value,digits=6) {
    if(!value)return null;
    const scale=10n**BigInt(digits),rounded=(value.n*scale*2n+value.d)/(2n*value.d);
    const fraction=String(rounded%scale).padStart(digits,'0').replace(/0+$/,'');
    return String(rounded/scale)+(fraction?'.'+fraction:'');
  }
  function cents(value) {
    if(!value||value.n>100000000n*value.d)return null;
    return String((value.n*200n+value.d)/(2n*value.d));
  }
  function known(values) {
    const present=values.filter(value=>value!==null);
    return {value:present.length?present.reduce(add,r(0)):null,partial:present.length!==values.length};
  }
  function valid(path,value) {
    if(/^finish\.[0-2]\.enabled$/.test(path))return typeof value==='boolean';
    if(/^finish\.[0-2]\.name$/.test(path))return typeof value==='string'&&value.length<=200;
    if(path==='domino.componentId')return typeof value==='string'&&value.length<=120;
    if(typeof value!=='string')return false;
    if(value==='')return true; // Incomplete is distinct from malformed and from zero.
    if(path==='domino.unions'||/^finish\.[0-2]\.hands$/.test(path))return integer(value)!==null;
    if(path.endsWith('.price')||path.endsWith('.rate'))return rate(value)!==null;
    if(/^finish\.[0-2]\.yield$/.test(path)){const parsed=decimal(value);return !!parsed&&parsed.n>0n;}
    if(['domino.quantity','domino.lengthCm','domino.perMl','domino.extra','other.gluePerM2','other.cncMinutesPerMl','other.extrasPct'].includes(path)||/^days\.[0-5]\.quantity$/.test(path))return decimal(value)!==null;
    return false;
  }
  function calculate({values={},pieces=[],articleQuantity='',installationExcluded=false}={}) {
    const v=path=>Object.hasOwn(values,path)?values[path]:'',aq=decimal(articleQuantity,3,100000);
    const measure=value=>value===null||value===undefined?null:decimal(typeof value==='number'&&Number.isFinite(value)?value.toFixed(6):String(value));
    const area=known(pieces.map(piece=>measure(piece.areaM2))),paint=known(pieces.map(piece=>measure(piece.paintM2))),jointed=known(pieces.map(piece=>measure(piece.jointedM2)));
    const wood=known(pieces.map(piece=>exact(piece.woodCostExact)));
    const cnc=known(pieces.map(piece=>measure(piece.cncMl)));
    const errors=Object.entries(values).filter(([key,value])=>!(installationExcluded&&/^days\.1\./.test(key))&&!valid(key,value)).map(([key])=>key);
    const pack=(quantity,price,partial=false,applicable=true)=>{
      const amount=applicable?mul(quantity,price):r(0),usable=partial&&amount?.n===0n?null:amount,unitCents=cents(usable),totalCents=cents(mul(usable,aq));
      return {quantity:text(quantity),unitCents,totalCents,partial:!!partial,applicable,
        status:!applicable?'NOT_APPLICABLE':unitCents===null?'PENDING':partial?'PARTIAL':'CALCULATED'};
    };
    const selected=pieces.find(piece=>piece.id===v('domino.componentId'));
    const dominoQuantity=v('domino.quantity')===''?measure(selected?.quantityPerProduct):decimal(v('domino.quantity'));
    const dominoLength=v('domino.lengthCm')===''?measure(selected?.lengthCm):decimal(v('domino.lengthCm'));
    const ml=div(mul(mul(dominoQuantity,dominoLength),integer(v('domino.unions'))),r(100));
    const dominoCount=add(mul(ml,decimal(v('domino.perMl'))),optional(v('domino.extra')));
    const dominoRate=rate(v('domino.price')),domino=pack(dominoCount,dominoRate);
    Object.assign(domino,{ml:text(ml),baseQuantity:text(dominoQuantity),lengthCm:text(dominoLength)});
    const labor={assembly:pack(area.value,rate(v('labor.assembly.rate')),area.partial),jointing:pack(jointed.value,rate(v('labor.jointing.rate')),jointed.partial),
      joinery:pack(dominoCount,rate(v('labor.joinery.rate'))),varnish:pack(paint.value,rate(v('labor.varnish.rate')),paint.partial)};
    const days=Array.from({length:6},(_,i)=>i===1&&installationExcluded
      ? {quantity:'0',unitCents:'0',totalCents:'0',partial:false,applicable:false,status:'EXCLUDED',excluded:true}
      : pack(decimal(v('days.'+i+'.quantity')),rate(v('days.'+i+'.rate'))));
    const finishAmounts=[];
    const finish=Array.from({length:3},(_,i)=>{
      const choice=v('finish.'+i+'.enabled'),enabled=choice===true,applicable=choice!==false,hands=integer(v('finish.'+i+'.hands')),yieldRate=decimal(v('finish.'+i+'.yield'));
      const liters=enabled?div(mul(paint.value,hands),yieldRate):choice===false?r(0):null,price=rate(v('finish.'+i+'.price'));
      finishAmounts.push(applicable?mul(liters,price):r(0));
      return pack(liters,price,enabled&&paint.partial,applicable);
    });
    const glueQuantity=mul(jointed.value,decimal(v('other.gluePerM2'))),glueRate=rate(v('other.glue.price'));
    const glue=pack(glueQuantity,glueRate,jointed.partial),cncMinutes=mul(cnc.value,decimal(v('other.cncMinutesPerMl')));
    const cncAmount=pack(cncMinutes,rate(v('other.cnc.price')),cnc.partial);
    Object.assign(cncAmount,{ml:text(cnc.value),minutes:text(cncMinutes)});
    // Explicit user decision, 4 Nov: exclude hardware, all labor and CNC.
    // Keep precision until each displayed amount, including the percentage.
    const base=known([wood.value,...finishAmounts,mul(dominoCount,dominoRate),mul(glueQuantity,glueRate)]);
    const extrasQuantity=div(mul(base.value,decimal(v('other.extrasPct'))),r(100));
    const extras=pack(extrasQuantity,r(1),base.partial||wood.partial||jointed.partial||paint.partial);
    return {basis:'ONE_ARTICLE',financialConfirmed:false,errors,articleQuantity,domino,labor,days,finish,
      other:{glue,cnc:cncAmount,extras,baseCents:cents(base.partial&&base.value?.n===0n?null:base.value)},geometry:{areaM2:text(area.value),paintM2:text(paint.value),jointedM2:text(jointed.value)}};
  }
  return Object.freeze({calculate,valid});
}

function installWorkshop(calculator) {
  const previousFamily=solidWoodFamilyHtml,previousRefresh=solidWoodRefresh;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const monetaryKey=key=>/\.(?:price|rate)$/.test(key);
  function currencyNumber(value) {
    if(value==='')return '';
    const text=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(text))return text;
    const [whole,fraction='']=text.split('.');return formatMoneyDisplay(whole+'.'+fraction.padEnd(2,'0'));
  }
  function installationExcluded() {
    const model=partViewQuote()?.manufacturing,stage=scopeStageFor('Instalación');
    return model?.installation==='no'&&!!model.installationReason?.trim()&&!scopeIncluded(stage);
  }
  const helpTexts={
    base:'La base se calcula por artículo a partir de las medidas y cantidades de sus piezas. La superficie de acabado también considera las caras seleccionadas.',
    tariff:'La tarifa es el precio de una unidad de trabajo: por m² o por dómino, según el proceso. Se captura el precio; el importe resulta de multiplicarlo por la base.',
    amount:'Importe por artículo = base de trabajo × tarifa unitaria. Un dato vacío queda pendiente; un cero capturado es distinto.',
    assembly:'Armado: área de las piezas por artículo, en m², × tarifa por m².',
    jointing:'Entablerado: área de las piezas marcadas Sí, en m², × tarifa por m². Una respuesta vacía mantiene el cálculo parcial.',
    joinery:'Ensambles: consumo de dóminos por artículo × tarifa por dómino. El consumo puede ser fraccionario; no es un conteo de montaje.',
    varnish:'Barniz: superficie de las piezas × caras de acabado × tarifa por m² de acabado.',
    daily:'Importe por artículo = días de trabajo × tarifa por día. Sin instalación declarada, Instalación vale cero; las demás jornadas vacías permanecen pendientes.',
    domino:'Consumo = longitud de uniones × dóminos por ML + extras. Costo = consumo de dóminos × precio por dómino.'
  };
  function help(itemId,group,key,label) {
    return '<button type="button" class="workshop-help" data-workshop-help="'+esc(key)+'" data-workshop-help-group="'+esc(group)+'" data-workshop-item="'+esc(itemId)+'" aria-label="'+esc(label)+'" aria-expanded="false" aria-controls="workshop-help-'+esc(itemId)+'-'+esc(group)+'"><span aria-hidden="true">i</span></button>';
  }
  const helpPanel=(itemId,group)=>'<p class="workshop-help-copy" id="workshop-help-'+esc(itemId)+'-'+esc(group)+'" role="note" hidden></p>';
  const money=value=>{
    if(value===null||value===undefined)return 'Pendiente';
    const amount=BigInt(value);return '$ '+String(amount/100n).replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+String(amount%100n).padStart(2,'0');
  };
  function defaults(itemId) {
    const entry=recipeEntry(itemId),recipe=entry&&DemoRecipeCatalog.recipe(entry.recipeId),doc=recipe?.documentary;
    const rows=(doc?.sections||[]).flatMap(section=>section.rows),find=kind=>rows.find(row=>row.kind===kind);
    const source=key=>find(key)?.unitPrice??'',pieces=solidWoodEntries(itemId,true);
    const first=entry?.woodIds?.[0],cover=pieces.find(piece=>piece.id===first&&piece.name==='CUBIERTA');
    const florencia=cover&&['SYN-NUBE-C','SYN-NUBE-O'].includes(entry.variantId);
    const values={'domino.componentId':cover?.id||'','domino.quantity':'','domino.lengthCm':'','domino.unions':florencia?'4':'','domino.perMl':'4','domino.extra':'','domino.price':source('DOMINO_CONSUMPTION'),
      'labor.assembly.rate':source('ASSEMBLY'),'labor.jointing.rate':source('JOINTING'),'labor.joinery.rate':source('JOINERY'),'labor.varnish.rate':source('VARNISH_LABOR'),
      'other.gluePerM2':'0.6','other.glue.price':source('GLUE'),'other.cncMinutesPerMl':doc?.cncMinutesPerMeter??'','other.cnc.price':source('CNC'),'other.extrasPct':'3'};
    if(recipe?.workshopDefaults?.domino)for(const key of ['quantity','lengthCm','unions'])values['domino.'+key]=recipe.workshopDefaults.domino[key];
    const dayRows=rows.filter(row=>row.kind==='LABOR_DAYS');
    const names=['Carpintería','Instalación','CNC / Láser','Acabados','Tejido','Integración'];
    names.forEach((name,i)=>{values['days.'+i+'.quantity']=dayRows[i]?.quantity??'';values['days.'+i+'.rate']=dayRows[i]?.unitPrice??'';});
    const materials=[find('FINISH'),find('FINISH_PRIMER'),null];
    materials.forEach((row,i)=>{
      values['finish.'+i+'.name']=row?.name||(i===2?'Acabado especial':i===0?'Acabado':'Fondo');
      values['finish.'+i+'.enabled']=!!row;values['finish.'+i+'.hands']=row?(i===0?'2':'1'):'';
      values['finish.'+i+'.yield']=row?'7':i===2?'15':'';values['finish.'+i+'.price']=row?.unitPrice??'';
    });
    return {version:1,values,dayNames:names};
  }
  function state(itemId) {
    const local=solidWoodState(itemId);if(!local)return null;
    if(!local.workshop)local.workshop=defaults(itemId);
    return local.workshop;
  }
  function geometry(itemId) {
    return solidWoodEntries(itemId,true).map(piece=>{
      const result=solidWoodResult(itemId,piece),cnc=result.automaticProcesses.find(process=>process.id==='cnc');
      const length=Number(piece.length),factor={cm:1,mm:.1,m:100}[piece.lengthUnit];
      return {id:piece.id,name:piece.name,quantityPerProduct:piece.quantityPerProduct,lengthCm:piece.length!==''&&Number.isFinite(length)&&factor?length*factor:null,
        ...result.unitMeasurements,woodCostExact:result._exact.unitCost,cncMl:cnc?.unitMl??null};
    });
  }
  function read(itemId) {
    const stored=state(itemId),item=partViewQuote().items.find(row=>row.id===itemId);
    return stored&&item?calculator.calculate({values:stored.values,pieces:geometry(itemId),articleQuantity:item.quantity,installationExcluded:installationExcluded()}):null;
  }
  const number=(value,unit='')=>value===null||value===undefined?'Pendiente':esc(value)+(unit?' '+esc(unit):'');
  function field(itemId,key,label,value,options={}) {
    const id='workshop-'+itemId+'-'+key.replaceAll('.','-'),invalid=!options.excluded&&!calculator.valid(key,value),disabled=options.disabled||!recipeCanEdit()||app.busy||app.operation,isMoney=monetaryKey(key);
    const attrs=' id="'+esc(id)+'" data-workshop-item="'+esc(itemId)+'" data-workshop-field="'+esc(key)+'"'+(isMoney?' data-workshop-money':'')+(disabled?' disabled':'')+' aria-invalid="'+invalid+'"';
    const error='<small class="workshop-error" role="alert"'+(invalid?'':' hidden')+'>Revisa este valor.</small>';
    const rawDisplay=options.display!==undefined?options.display:value===''&&options.derived!==undefined?options.derived:value,display=isMoney&&calculator.valid(key,rawDisplay)?currencyNumber(rawDisplay):rawDisplay;
    let input=options.choices?'<select'+attrs+'>'+options.choices.map(([v,text])=>'<option value="'+esc(v)+'"'+(value===v?' selected':'')+'>'+esc(text)+'</option>').join('')+'</select>'
      : '<input'+attrs+' type="text"'+(options.text?'':' inputmode="decimal"')+' maxlength="'+(options.text?200:40)+'" value="'+esc(display)+'"'+(options.placeholder?' placeholder="'+esc(options.placeholder)+'"':'')+'>';
    if(isMoney)input='<span class="workshop-money"><span aria-hidden="true">$</span>'+input+'</span>';
    return '<div class="field workshop-field"><label for="'+esc(id)+'">'+esc(label)+'</label>'+input+error+'</div>';
  }
  function output(row,key='') {
    const value=row.status==='NOT_APPLICABLE'?'No aplica':money(row.unitCents);
    return '<output class="workshop-amount"'+(key?' data-workshop-live="'+esc(key)+'"':'')+(row.partial?' title="Hay piezas o parámetros por completar"':'')+'><strong>'+value+'</strong>'+(row.partial?'<small>Parcial</small>':'')+'</output>';
  }
  function tableHead(labels,helps={},itemId='',group='labor'){return '<div class="workshop-table-head">'+labels.map((label,index)=>'<span>'+esc(label)+(helps[index]?help(itemId,group,helps[index],'Ayuda de '+label):'')+'</span>').join('')+'</div>';}
  function section(itemId,key,index,title,body,tip='') {
    const panels=app.breakdownUi.panels||{},open=Object.hasOwn(panels,itemId+'|workshop-'+key)?panels[itemId+'|workshop-'+key]:true;
    return '<details class="workshop-block" data-fab-item="'+esc(itemId)+'" data-fab-panel="workshop-'+esc(key)+'"'+(open?' open':'')+'><summary><span class="workshop-number">'+esc(index)+'</span><span>'+esc(title)+'</span>'+(tip?'<span class="workshop-info" tabindex="0" aria-label="'+esc(tip)+'" title="'+esc(tip)+'">i</span>':'')+'<small class="workshop-grain">Por artículo</small></summary><div class="workshop-block-body">'+body+'</div></details>';
  }
  function markup(itemId) {
    const stored=state(itemId),result=read(itemId);if(!stored||!result)return '';
    const v=stored.values,f=(key,label,options={})=>field(itemId,key,label,v[key],options),pieces=geometry(itemId);
    const amountNote=row=>result.articleQuantity&&result.articleQuantity!=='1'?'<span class="workshop-article-total">Total '+esc(result.articleQuantity)+' artículos: <strong>'+money(row.totalCents)+'</strong></span>':'';
    const dominos=helpPanel(itemId,'domino')+'<div class="workshop-table-scroll" role="region" tabindex="0" aria-label="Dóminos por metro lineal"><div class="workshop-domino-table">'+tableHead(['Pieza','Cantidad','Longitud · cm','Uniones','Dóminos / ML','Extras','Precio / dómino','Costo'],{7:'domino'},itemId,'domino')+'<div class="workshop-table-row">'+f('domino.componentId','Pieza',{choices:[['','Seleccionar'],...pieces.map(piece=>[piece.id,piece.name||'Pieza'])]})+
      f('domino.quantity','Cantidad',{derived:result.domino.baseQuantity??''})+f('domino.lengthCm','Longitud · cm',{derived:result.domino.lengthCm??''})+f('domino.unions','Uniones')+
      f('domino.perMl','Dóminos / ML')+f('domino.extra','Extras',{placeholder:'Opcional'})+f('domino.price','Precio / dómino')+output(result.domino,'domino-row-amount')+'</div></div></div><div class="workshop-totals" data-workshop-live="domino-totals"><span>Longitud de uniones <strong>'+number(result.domino.ml,'ML')+'</strong></span><span>Consumo <strong>'+number(result.domino.quantity,'dóminos')+'</strong></span>'+amountNote(result.domino)+'</div>';
    const laborLabels=[['assembly','MO Armado','m²'],['jointing','MO Entablerado','m²'],['joinery','MO Ensambles','dóminos'],['varnish','MO Barniz','m²']];
    const labor=helpPanel(itemId,'labor')+'<div class="workshop-table-scroll" role="region" tabindex="0" aria-label="Mano de obra por proceso"><div class="workshop-labor-table">'+tableHead(['Proceso','Base por artículo','Tarifa','Importe'],{1:'base',2:'tariff',3:'amount'},itemId)+laborLabels.map(([key,label,unit])=>'<div class="workshop-table-row"><strong>'+label+help(itemId,'labor',key,'Cómo se calcula '+label)+'</strong><span data-workshop-live="labor-'+key+'-base">'+number(result.labor[key].quantity,unit)+'</span>'+f('labor.'+key+'.rate','Tarifa de '+label,{placeholder:'Por definir'})+output(result.labor[key],'labor-'+key+'-amount')+'</div>').join('')+'</div></div>';
    const days=helpPanel(itemId,'days')+'<div class="workshop-table-scroll" role="region" tabindex="0" aria-label="Mano de obra por días"><div class="workshop-days-table">'+tableHead(['Especialidad','Días por artículo','Tarifa / día','Importe'],{2:'daily'},itemId,'days')+stored.dayNames.map((name,i)=>'<div class="workshop-table-row"><strong>'+esc(name)+(result.days[i].excluded?'<small class="workshop-excluded-note">Sin instalación</small>':'')+'</strong>'+f('days.'+i+'.quantity','Días de '+name,{disabled:result.days[i].excluded,excluded:result.days[i].excluded,display:result.days[i].excluded?'0':undefined})+f('days.'+i+'.rate','Tarifa diaria de '+name,{disabled:result.days[i].excluded,excluded:result.days[i].excluded})+output(result.days[i],'day-'+i+'-amount')+'</div>').join('')+'</div></div>';
    const finishes='<div class="workshop-table-scroll" role="region" tabindex="0" aria-label="Materiales de acabado"><div class="workshop-finish-table">'+tableHead(['Producto','Manos','Rendimiento m²/L','Precio / L','Litros','Importe'])+[0,1,2].map(i=>{
      const key='finish.'+i+'.enabled',id='finish-enabled-'+itemId+'-'+i;
      const checkbox='<input id="'+esc(id)+'" type="checkbox" data-workshop-item="'+esc(itemId)+'" data-workshop-field="'+key+'"'+(v[key]?' checked':'')+(!recipeCanEdit()||app.busy||app.operation?' disabled':'')+' aria-label="Incluir '+esc(v['finish.'+i+'.name'])+'">';
      return '<div class="workshop-table-row"><div class="workshop-finish-name">'+checkbox+f('finish.'+i+'.name','Producto',{text:true})+'</div>'+f('finish.'+i+'.hands','Manos')+f('finish.'+i+'.yield','Rendimiento m²/L')+f('finish.'+i+'.price','Precio por litro')+'<span class="workshop-number-value" data-workshop-live="finish-'+i+'-quantity">'+(v[key]?number(result.finish[i].quantity):'No aplica')+'</span>'+output(result.finish[i],'finish-'+i+'-amount')+'</div>';
    }).join('')+'</div></div>';
    const others='<div class="workshop-table-scroll" role="region" tabindex="0" aria-label="Consumibles y CNC"><div class="workshop-other-table">'+tableHead(['Concepto','Base','Factor','Precio unitario','Importe'])+
      '<div class="workshop-table-row"><strong>Pegamento entablerado</strong><div class="workshop-base"><span data-workshop-live="glue-base">'+number(result.geometry.jointedM2,'m²')+'</span><small data-workshop-live="glue-quantity">Consumo '+number(result.other.glue.quantity,'L')+'</small></div>'+f('other.gluePerM2','Litros / m²')+f('other.glue.price','Precio / L')+output(result.other.glue,'glue-amount')+'</div>'+
      '<div class="workshop-table-row"><strong>CNC / Láser</strong><span data-workshop-live="cnc-length">'+number(result.other.cnc.ml,'m')+'</span>'+f('other.cncMinutesPerMl','Minutos / m')+f('other.cnc.price','Precio / min')+output(result.other.cnc,'cnc-amount')+'</div>'+
      '<div class="workshop-table-row"><strong>Insumos extras</strong><span data-workshop-live="extras-base" title="Madera + acabados + dóminos + pegamento">'+money(result.other.baseCents)+'</span>'+f('other.extrasPct','Porcentaje (%)')+'<span aria-label="No usa precio unitario">—</span>'+output(result.other.extras,'extras-amount')+'</div></div></div>';
    return '<section class="recipe-workshop" data-workshop-article="'+esc(itemId)+'" aria-label="Cálculos por artículo">'+
      section(itemId,'dominos','02','Dóminos × ML',dominos,'Cantidad × longitud en cm × uniones / 100. El consumo calculado no es un conteo entero de montaje.')+
      section(itemId,'labor','03','Mano de obra',labor)+section(itemId,'days','04','Mano de obra por días',days)+
      section(itemId,'finish','05','Materiales de acabado',finishes)+section(itemId,'other','06','Otros · consumibles y CNC / Láser',others)+'</section>';
  }
  solidWoodFamilyHtml=function(item,row,fold) {
    let html=previousFamily(item,row,fold);const marker='<details class="recipe-economics-reference">',at=html.indexOf(marker);
    if(at>=0){const redundant=articleStudyElement(html,at,'details');html=html.slice(0,at)+html.slice(redundant.end);}
    const place=at>=0?at:html.indexOf('<output class="solid-wood-f-total"');
    if(place<0)return html;
    return html.slice(0,place)+markup(item.id)+html.slice(place);
  };
  function refresh(itemId) {
    const node=quoteRoot.querySelector('[data-workshop-article="'+CSS.escape(itemId)+'"]');
    if(!node)return;
    // Update only calculated output. Keeping input nodes in place preserves
    // rapid typing, the caret, focus, and each table's horizontal position.
    const template=document.createElement('template');template.innerHTML=markup(itemId);
    const next=template.content?.querySelector('[data-workshop-article]');if(!next)return;
    node.querySelectorAll('[data-workshop-live]').forEach(target=>{
      const replacement=next.querySelector('[data-workshop-live="'+CSS.escape(target.dataset.workshopLive)+'"]');
      if(replacement){target.innerHTML=replacement.innerHTML;const title=replacement.getAttribute('title');if(title)target.setAttribute('title',title);else target.removeAttribute('title');}
    });
    const values=state(itemId).values,result=read(itemId);
    node.querySelectorAll('[data-workshop-field]').forEach(input=>{
      const key=input.dataset.workshopField,excluded=!!result.days[1].excluded&&/^days\.1\./.test(key),invalid=!excluded&&!calculator.valid(key,values[key]);
      input.setAttribute('aria-invalid',String(invalid));
      const error=input.closest('.workshop-field')?.querySelector('.workshop-error');if(error)error.hidden=!invalid;
      if(input!==document.activeElement&&values[key]===''&&['domino.quantity','domino.lengthCm'].includes(key))input.value=(key==='domino.quantity'?result.domino.baseQuantity:result.domino.lengthCm)??'';
      if(/^days\.1\./.test(key)){
        input.disabled=excluded||!recipeCanEdit()||!!app.busy||!!app.operation;
        if(input!==document.activeElement)input.value=excluded&&key==='days.1.quantity'?'0':monetaryKey(key)&&calculator.valid(key,values[key])?currencyNumber(values[key]):values[key];
      }
      const enabled=/^finish\.([0-2])\.enabled$/.exec(key);if(enabled)input.setAttribute('aria-label','Incluir '+values['finish.'+enabled[1]+'.name']);
    });
  }
  solidWoodRefresh=function(){const result=previousRefresh();if(app.openPartId)refresh(app.openPartId);return result;};
  function change(event) {
    const target=event.target,key=target?.dataset?.workshopField,itemId=target?.dataset?.workshopItem;
    if(!key||itemId!==app.openPartId||!recipeCanEdit()||app.busy||app.operation)return;
    const stored=state(itemId);if(!stored||!Object.hasOwn(stored.values,key))return;
    if(installationExcluded()&&/^days\.1\./.test(key))return;
    let value=target.type==='checkbox'?target.checked:target.value;
    if(monetaryKey(key)){try{value=moneyInputValue(value);}catch(_){/* Invalid grouping stays visible for correction. */}}
    if(key==='domino.componentId'&&value&&!solidWoodEntries(itemId,true).some(piece=>piece.id===value))return;
    stored.values[key]=value;
    // Keep invalid raw values in their own article; never coerce them to zero.
    target.setAttribute?.('aria-invalid',String(!calculator.valid(key,value)));
    refresh(itemId);
  }
  quoteRoot.addEventListener('input',change);quoteRoot.addEventListener('change',change);
  quoteRoot.addEventListener('focusout',event=>{
    const input=event.target,key=input?.dataset?.workshopField,itemId=input?.dataset?.workshopItem;
    if(!key||!monetaryKey(key)||itemId!==app.openPartId||!recipeCanEdit()||app.busy||app.operation)return;
    const value=state(itemId)?.values[key];if(calculator.valid(key,value))input.value=currencyNumber(value);
  });
  function helpControl(target){return target.closest?.('[data-workshop-help]')||(target.dataset?.workshopHelp?target:null);}
  quoteRoot.addEventListener('click',event=>{
    const button=helpControl(event.target),key=button?.dataset?.workshopHelp,group=button?.dataset?.workshopHelpGroup,itemId=button?.dataset?.workshopItem;
    if(itemId!==app.openPartId||!Object.hasOwn(helpTexts,key)||!['labor','days','domino'].includes(group))return;
    const id='workshop-help-'+itemId+'-'+group,panel=quoteRoot.querySelector('#'+CSS.escape(id));if(!panel)return;
    const close=button.getAttribute('aria-expanded')==='true'&&!panel.hidden;
    quoteRoot.querySelectorAll('[data-workshop-help-group="'+group+'"][data-workshop-item="'+CSS.escape(itemId)+'"]').forEach(control=>{control.setAttribute('aria-expanded','false');control.removeAttribute('aria-describedby');});
    panel.textContent=helpTexts[key];panel.hidden=close;button.setAttribute('aria-expanded',String(!close));
    if(!close)button.setAttribute('aria-describedby',id);else button.removeAttribute('aria-describedby');
  });
  quoteRoot.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;const button=helpControl(event.target);if(!button||button.getAttribute('aria-expanded')!=='true')return;
    const id=button.getAttribute('aria-controls'),panel=id&&quoteRoot.querySelector('#'+CSS.escape(id));if(!panel)return;
    panel.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-describedby');event.preventDefault();event.stopPropagation();
  });
  return {read,markup,values:itemId=>clone(state(itemId)?.values||{})};
}

export function extendRecipeWorkshop(source) {
  const marker='globalThis.__client = {';
  if(source.split(marker).length!==2)throw Error('Recipe workshop installation anchor changed');
  const installer='const localWorkshop=('+installWorkshop.toString()+')(('+createWorkshopCalculator.toString()+')());\n';
  return source.replace(marker,()=>installer+marker+'workshopRead:localWorkshop.read,workshopMarkup:localWorkshop.markup,workshopValues:localWorkshop.values,');
}
