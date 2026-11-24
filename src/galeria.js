/* Recipe data and illustration paths are supplied separately. */
(() => {
  'use strict';
  const demo=globalThis.DemoPublicRecipes;
  const source=globalThis.DucoPrivateRecipeUpdates||globalThis.DucoPublishedRecipes||demo;
  const {rows}=source;
  const productIds=new Set(rows.map(row=>row.productId));
  const products=[...new Map([...demo.products,...source.products].map(product=>[product.id,product])).values()]
    .filter(product=>productIds.has(product.id));
  const assetFor=row=>demo.assets[row.publicVisualKey||row.id];
  const byId=id=>document.getElementById(id);
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const has=value=>value!==null&&value!==undefined&&value!=='';
  const text=value=>has(value)?String(value):'Pendiente';
  const units=new Map(Object.entries({
    PZA:'pieza',pza:'pieza',HOJA:'hoja',ML:'m lineal',DAY:'día',MINUTE:'min',
    P1_WOOD_UNIT_PENDING_DUCO:'unidad de madera por confirmar'
  }));
  const unit=value=>units.get(value)||value||'';
  const count=(value,measure)=>has(value)?[value,unit(measure)].filter(has).join(' '):'Pendiente';
  const rate=(value,measure)=>has(value)?[value,unit(String(measure||'').replace(/^SOURCE_MONEY_PER_/,''))].filter(has).join(' / '):'Pendiente';
  const dimensions=(width,length,measure)=>[width,length].filter(has).length?
    [width,length].filter(has).join(' × ')+' '+(measure||'cm'):'';
  const marked=(label,value,measure='')=>has(value)?label+' '+value+(measure?' '+measure:''):'';
  const compact=(...entries)=>entries.filter(has).join(' · ');
  const yesNo=value=>({0:'No',1:'Sí',no:'No',yes:'Sí'})[value]||'';
  function element(tag,value){
    const node=document.createElement(tag);
    if(has(value))node.textContent=value;
    return node;
  }
  function table(parent,key,title,labels,values){
    if(!values.length)return;
    const section=element('section');
    section.dataset.recipeGroup=key;
    const heading=element('h3',title);
    heading.id='recipe-group-'+key;
    section.setAttribute('aria-labelledby',heading.id);
    const wrap=element('div');
    wrap.className='recipe-table-wrap';
    wrap.tabIndex=0;
    wrap.setAttribute('role','region');
    wrap.setAttribute('aria-labelledby',heading.id);
    const grid=element('table'),head=grid.createTHead().insertRow(),body=grid.createTBody();
    for(const label of labels){
      const column=element('th',label);column.scope='col';head.append(column);
    }
    for(const data of values){
      const row=body.insertRow(),titleCell=element('th',text(data[0]));
      titleCell.scope='row';
      row.append(titleCell,...data.slice(1).map(value=>element('td',text(value))));
    }
    wrap.append(grid);
    section.append(heading,wrap);
    parent.append(section);
  }
  const supplyDetails=item=>compact(
    item.specification!==item.name?item.specification:'',
    item.purchaseNeedsMeasurement?'Compra en '+unit(item.purchaseUnit)+' con cantidad por medir':
      has(item.purchasePerProduct)?'Compra por artículo: '+count(item.purchasePerProduct,item.purchaseUnit):'',
    has(item.estimatedPricePerDm2)?'Estimación por dm²: '+item.estimatedPricePerDm2:'',item.notes,item.sourceCells
  );
  function renderComponents(parent,recipe){
    const wood=recipe.wood||[],woodRates=recipe.economics?.wood||[];
    table(parent,'wood','Madera maciza',['Pieza','Cantidad por artículo','Especificación','Tarifa'],wood.map(item=>{
      const geometry=compact(dimensions(item.width,item.length,item.lengthUnit),marked('Espesor',item.thickness,'in'));
      const cnc=item.cnc;
      const cutting=has(cnc?.length)?'CNC: '+count(cnc.length,cnc.unit)+
        (has(cnc.repetitions)?' × '+cnc.repetitions:''):marked('CNC:',yesNo(cnc?.decision));
      const historical=woodRates.find(row=>row.name===item.name);
      return [item.name,count(item.quantityPerProduct,'pieza'),
        compact(item.woodKind,geometry,marked('Caras',item.finishFaces),marked('Entablado:',yesNo(item.jointed)),cutting),
        rate(historical?.unitPrice,historical?.priceUnit)];
    }));
    table(parent,'boards','Tableros',['Pieza','Cantidad por artículo','Especificación','Tarifa'],(recipe.boards||[]).map(item=>{
      const d=item.detail||{};
      return [item.name,count(item.quantityPerProduct,'pieza'),compact(
        item.substrate,item.coating,dimensions(item.width,item.length,item.lengthUnit),marked('Espesor',item.thickness,'mm'),
        marked('Hoja',item.sheetAreaM2,'m²'),marked('Desperdicio',item.wasteRate,'%'),marked('Cara',d.naturalFace),
        marked('Cantos de ancho',d.edgeWidthCount),marked('Cantos de largo',d.edgeLengthCount),
        marked('Caras con pintura',d.paintFaces),marked('Caras con pegado',d.gluedFaces),
        marked('CNC',d.linearCentimeters,'cm'),marked('Repeticiones',d.laserCount),item.sourceCells
      ),rate(item.unitPrice,'hoja')];
    }));
    table(parent,'metal','Herrería',['Pieza','Cantidad por artículo','Especificación','Tarifa'],(recipe.metal||[]).map(item=>{
      const d=item.detail||{},sheet=item.section==='metal-sheet';
      return [item.name,count(item.quantity,'pieza'),compact(
        item.profile,item.dimension,marked('Calibre',item.gauge),dimensions(item.width,item.length,item.lengthUnit),
        marked('Compra por artículo:',item.purchaseQuantity,'kg'),marked('Peso específico',d.kgPerM2,'kg/m²'),
        marked('Peso lineal',d.kgPerMl,'kg/m'),marked('Lado A',d.sideACm,'cm'),marked('Lado B',d.sideBCm,'cm'),
        marked('Caras con pintura',d.paintFaces),marked('CNC',d.linearCentimeters,'cm'),marked('Repeticiones',d.laserCount),
        has(d.laborPrice)?'Mano de obra: '+rate(d.laborPrice,'kg'):'',
        has(d.paintPrice)?'Pintura: '+rate(d.paintPrice,sheet?'m²':'m'):'',item.sourceCells
      ),rate(item.unitPrice,'kg')];
    }));
    const supplies=recipe.hardware||[];
    const hardware=supplies.filter(item=>item.category==='Herrajes'),other=supplies.filter(item=>item.category!=='Herrajes');
    for(const [key,title,items] of [['hardware','Herrajes',hardware],['supplies','Insumos y consumibles',other]]){
      table(parent,key,title,['Concepto','Consumo por artículo','Especificación','Tarifa'],items.map(item=>[
        item.name,count(item.quantityPerProduct,item.unit),supplyDetails(item),
        rate(item.unitPrice,item.purchaseUnit||item.unit)
      ]));
    }
    table(parent,'external','Maquilas',['Operación','Cantidad por artículo','Tarifa','Referencia'],(recipe.maquilas||[]).map(item=>[
      item.name,count(item.quantity,item.unit),rate(item.unitPrice,item.unit),item.sourceCells
    ]));
  }
  const boardFields={
    assemblyRate:'Armado · tarifa/m²',cncMinutesPerM:'CNC · min/m',cncRate:'CNC · tarifa/min',
    integrationDays:'Integración · días',dayRate:'Integración · tarifa/día',extrasPct:'Insumos extras · %',
    extraMaterials:'Materiales adicionales · importe'
  };
  const metalFields={
    paintFactor:'Pintura · m por m de perfil',rollingQty:'Rolado · cantidad',rollingPrice:'Rolado · tarifa/unidad'
  };
  const woodFields={
    'domino.quantity':'Dóminos · cantidad de piezas','domino.lengthCm':'Dóminos · longitud por pieza en cm',
    'domino.unions':'Dóminos · uniones','domino.perMl':'Dóminos · consumo por m lineal',
    'domino.extra':'Dóminos · unidades adicionales','domino.price':'Dóminos · tarifa/pieza',
    'labor.assembly.rate':'Armado · tarifa/m²','labor.jointing.rate':'Entablerado · tarifa/m²',
    'labor.joinery.rate':'Ensambles · tarifa/dómino','labor.varnish.rate':'Barniz · tarifa/m²',
    'other.glue.price':'Pegamento · tarifa/L','other.cncMinutesPerMl':'CNC · min/m',
    'other.cnc.price':'CNC · tarifa/min','other.extrasPct':'Insumos extras · %',
    'days.0.quantity':'Carpintería · días','days.0.rate':'Carpintería · tarifa/día',
    'days.2.quantity':'CNC / Láser · días','days.2.rate':'CNC / Láser · tarifa/día',
    'days.3.quantity':'Acabados · días','days.3.rate':'Acabados · tarifa/día'
  };
  const pairs=(labels,values)=>Object.entries(labels).filter(([key])=>has(values?.[key])).map(([key,label])=>[label,values[key]]);
  function renderOperations(parent,recipe){
    const fabrication=recipe.fabrication||{};
    const operations=[...(fabrication.boards?.operations||[]),...(fabrication.metal?.operations||[])];
    table(parent,'operations','Operaciones de fabricación',['Operación','Cantidad por artículo','Tarifa','Referencia'],operations.map(item=>[
      item.name,count(item.quantity,item.unit),rate(item.rate,item.unit),item.sourceCells
    ]));
    const workshop=recipe.workshopDefaults?.values||{};
    table(parent,'wood-settings','Parámetros de madera',['Dato','Valor'],[
      ...(has(recipe.woodWastePercent)&&(recipe.wood||[]).length?[['Desperdicio de madera · %',recipe.woodWastePercent]]:[]),
      ...pairs({'value':'CNC · min/m'},recipe.economics?.parameters?.cncMinutesPerMeter),
      ...pairs(woodFields,workshop)
    ]);
    for(const [key,name,fields] of [['boards','Parámetros de tableros',boardFields],['metal','Parámetros de herrería',metalFields]]){
      table(parent,key+'-settings',name,['Dato','Valor'],pairs(fields,fabrication[key]));
    }
    const finish=Array.from({length:3},(_,index)=>{
      const prefix='finish.'+index+'.',name=workshop[prefix+'name'];
      if(!has(name))return null;
      return [name,workshop[prefix+'enabled']===false?'No aplica':text(workshop[prefix+'hands']),
        count(workshop[prefix+'yield'],'m²/L'),rate(workshop[prefix+'price'],'L')];
    }).filter(Boolean);
    table(parent,'finish','Materiales de acabado',['Producto','Manos','Rendimiento','Tarifa'],finish);
  }
  function renderEconomics(parent,recipe){
    const economic=recipe.economics||{};
    for(const [key,title] of [
      ['wood','Referencias de madera'],['hardware','Referencias de herrajes'],
      ['consumables','Referencias de consumibles'],['processes','Referencias de procesos'],
      ['dayLabor','Mano de obra por días'],['additional','Otras referencias de fabricación']
    ]){
      table(parent,'reference-'+key,title,['Concepto','Cantidad de referencia','Tarifa','Importe registrado'],(economic[key]||[]).map(item=>[
        item.name,count(item.quantity,item.quantityUnit),rate(item.unitPrice,item.priceUnit),item.totalSaved
      ]));
    }
    const totals=recipe.referenceTotals;
    if(totals){
      const records=(totals.rubros||[]).map(item=>[item.label,item.amount]);
      if(has(totals.amount))records.push(['Total de referencia',totals.amount]);
      table(parent,'totals','Totales de referencia',['Rubro','Importe registrado'],records);
    }
  }
  function renderOrigin(parent,recipe){
    const publication=recipe.publicationSource||{},original=recipe.provenance||{},reviewed=recipe.sourceProvenance||{};
    const workbook=publication.workbook||original.file||reviewed.workbook;
    const sheet=publication.sheet||recipe.sourceSheet||original.sheet||reviewed.worksheet;
    const headline=recipe.syntheticPricing?'Despiece y tarifas ficticias por artículo.':
      'Despiece por artículo. Tarifas e importes históricos de referencia.';
    const origin=compact(workbook?.split(/[\\/]/).at(-1),marked('Hoja',sheet),publication.revision);
    byId('recipe-source').textContent=origin?headline+' '+origin:headline;
    const cells=publication.cells||original.ranges;
    const details=Array.isArray(cells)?cells.map(value=>['Celdas de origen',value]):
      cells&&typeof cells==='object'?Object.entries(cells).map(([label,value])=>[label,Array.isArray(value)?value.join(', '):value]):
        has(cells)?[['Celdas de origen',cells]]:[];
    const pages=publication.correctionPages||original.corrections?.pages||reviewed.answerPage;
    if(has(pages)&&[pages].flat().length)details.push(['Páginas de corrección',[pages].flat().join(', ')]);
    table(parent,'source','Procedencia',['Dato','Referencia'],details);
    const notes=[...(recipe.observations||[]),...(recipe.sourceNotes||[])];
    if(!recipe.syntheticPricing)notes.push(...(recipe.commercialNotes||[]));
    if(notes.length){
      const section=element('section'),list=element('ul');
      for(const note of notes){
        const value=typeof note==='string'?note:compact(note.name,count(note.quantity,note.unit),note.status);
        if(value)list.append(element('li',value));
      }
      if(list.childElementCount){
        section.dataset.recipeGroup='notes';
        section.append(element('h3','Observaciones'),list);
        parent.append(section);
      }
    }
  }
  function renderRecipe(recipe){
    const section=byId('recipe-sections');
    section.replaceChildren();
    renderComponents(section,recipe);
    renderOperations(section,recipe);
    renderEconomics(section,recipe);
    renderOrigin(section,recipe);
    if(!section.childElementCount)section.append(element('p','Sin partidas registradas.'));
  }
  const list=byId('products'), selector=byId('variant');
  let currentProduct, currentVariant;
  for(const family of new Set(products.map(product=>product.family)))byId('family').add(new Option(family,family));
  function showVariant() {
    const row=rows.find(candidate=>candidate.id===selector.value);
    if(!row)return;
    currentVariant=row.id;
    const photo=byId('photo'),asset=assetFor(row);
    photo.parentElement.hidden=!asset;
    if(asset){photo.alt=row.description;photo.src=asset.url;}
    const tone=row.illustratedTone||demo.rows.find(candidate=>candidate.id===(row.publicVisualKey||row.id))?.illustratedTone;
    byId('caption').textContent='Imagen ilustrativa generada con IA'+(tone?' · Tono ilustrado: '+tone:'');
    byId('dimensions').textContent=['Largo','Ancho','Alto'].map(field=>text(row.finishedSpecs[field])).join(' × ')+' cm';
    byId('material').textContent=row.materialsLabel;
    byId('finish-line').hidden=!has(row.finishDescription);
    byId('finish').textContent=row.finishDescription||'';
    renderRecipe(row);
  }
  function selectProduct(product,variants) {
    currentProduct=product.id;
    for(const button of list.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.product===product.id));
    byId('detail').hidden=false; byId('name').textContent=product.name;
    selector.replaceChildren(...variants.map(row=>new Option(row.variant,row.id)));
    if(variants.some(row=>row.id===currentVariant))selector.value=currentVariant;
    showVariant();
  }
  function filter() {
    const query=normalize(byId('search').value),family=byId('family').value;
    const matches=[];
    for(const product of products) {
      if(family&&product.family!==family)continue;
      const variants=rows.filter(row=>row.productId===product.id&&normalize([product.name,product.family,row.variant,row.materialsLabel].join(' ')).includes(query));
      if(variants.length)matches.push({product,variants});
    }
    const buttons=matches.map(({product,variants})=>{
      const li=document.createElement('li'),button=document.createElement('button'),img=document.createElement('img');
      const words=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');
      const asset=assetFor(variants[0]);
      if(asset){img.alt='';img.loading='lazy';img.decoding='async';img.src=asset.thumbnail;}
      title.textContent=product.name; sub.textContent=product.family;
      button.type='button'; button.dataset.product=product.id; button.setAttribute('aria-controls','detail');
      words.append(title,sub);if(asset)button.append(img);button.append(words);li.append(button);
      button.addEventListener('click',()=>selectProduct(product,variants));
      return li;
    });
    list.replaceChildren(...buttons);
    byId('empty').hidden=matches.length>0; byId('detail').hidden=!matches.length;
    const selected=matches.find(match=>match.product.id===currentProduct)||matches[0];
    if(selected)selectProduct(selected.product,selected.variants);
  }
  byId('search').addEventListener('input',filter);
  byId('family').addEventListener('change',filter);
  selector.addEventListener('change',showVariant);
  document.querySelector('.recipe-jump').addEventListener('click',()=>{byId('recipe').open=true;});
  filter();
})();
