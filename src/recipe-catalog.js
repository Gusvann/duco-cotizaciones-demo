/* Selected local D91 recipes and historical references. No source files, cells, private identifiers or active tariffs. */
(function () {
  'use strict';
  const reference = globalThis.DemoRecipeReference;
  if (reference?.source !== 'LOCAL_REFERENCE_D91' || reference.recipes?.length !== 5 || typeof reference.recipe !== 'function') throw Error('Referencia local de recetas no disponible.');
  const SOURCE = reference.source;
  const UNIT = 'P1_WOOD_UNIT_PENDING_DUCO';
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  const specs = (length, width, height) => [['Largo', length], ['Ancho', width], ['Alto', height]].map(([type, value]) => ({type, value: String(value), unit: 'cm', na: false}));
  const definitions = [
    {id:'SYN-NUBE-C',family:'Mesas',productId:'SYN-NUBE',name:'Tzalam',label:'Mesa Florencia · Tzalam'},
    {id:'SYN-NUBE-O',family:'Mesas',productId:'SYN-NUBE',name:'Encino rojo',label:'Mesa Florencia · Encino rojo'},
    {id:'SYN-PRISMA-C',family:'Cubiertas',productId:'SYN-PRISMA',name:'Tzalam',label:'Cubierta de madera · Tzalam'},
    {id:'SYN-PRISMA-O',family:'Cubiertas',productId:'SYN-PRISMA',name:'Encino blanco',label:'Cubierta de madera · Encino blanco'},
    {id:'SYN-PRISMA-G',family:'Cubiertas',productId:'SYN-PRISMA',name:'Encino rojo',label:'Cubierta de madera · Encino rojo'}
  ].map(definition=>{
    const selected=reference.recipe(definition.id);
    if(!selected||!selected.wood.length||!selected.economics?.wood.length)throw Error('Receta local incompleta.');
    const price=selected.economics.wood[0].unitPrice;
    if(typeof price!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(price))throw Error('Precio histórico inválido.');
    return {...definition,reference:selected,size:['Largo','Ancho','Alto'].map(key=>selected.finishedSpecs[key]),species:selected.wood[0].woodKind,price,
      wood:selected.wood,hardware:selected.hardware.map(row=>({...row,quantity:row.quantityPerProduct}))};
  });
  const descriptions = {'SYN-NUBE':'Mesa redonda de madera maciza de 60 cm de diámetro y 50 cm de altura. Incluye niveladores de plástico negro.','SYN-PRISMA':'Cubierta circular de madera maciza de 76 cm de diámetro y 32 mm de espesor. Sin base ni patas.'};
  function image(definition) {
    const colors = {'Tzalam':'#735042','Encino rojo':'#bf8e60','Encino blanco':'#dcc5a3'};
    const color=colors[definition.species], legs=definition.productId==='SYN-NUBE' ? '<path d="M85 98v58h13v-56M214 98v58h13v-56" fill="'+color+'"/>' : '';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="#eeece7"/><ellipse cx="160" cy="167" rx="110" ry="10" fill="#ddd9d1"/>'+legs+'<ellipse cx="160" cy="90" rx="110" ry="35" fill="#6d5847"/><ellipse cx="160" cy="82" rx="110" ry="35" fill="'+color+'"/></svg>');
  }
  const images = {}, imageKinds = {};
  for (const definition of definitions) { const supplied=globalThis.DemoRecipeImages?.[definition.id]; images[definition.id]=typeof supplied==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(supplied)?supplied:image(definition); imageKinds[definition.id]=images[definition.id]===supplied?'IA':'SVG'; }
  const recipes=definitions.map(d=>{
    const source=d.reference,economics=source.economics;
    return {id:'R-'+d.id,variantId:d.id,productId:d.productId,source:SOURCE,accredited:false,quality:'LOCAL_REFERENCE_NOT_PRODUCTION_VALIDATED',
      description:source.description,finishDescription:source.finishDescription,finishedDimensions:d.size.join(' × ')+' cm',woodKind:d.species,
      previewUnitPrice:d.price,wasteRate:source.woodWastePercent,wood:d.wood,hardware:d.hardware,processes:[],observations:source.observations,
      documentary:{basis:'ONE_ARTICLE',currency:'UNVERIFIED',financialConfirmed:false,cncMinutesPerMeter:economics.parameters?.cncMinutesPerMeter?.value??null,
        sections:[{key:'hardware',title:'Insumos / herrajes',rows:economics.hardware},{key:'wood',title:'Madera · magnitud observada en Excel',rows:economics.wood},
          {key:'consumables',title:'Otros materiales · consumo, no cantidad de compra',rows:economics.consumables},
          {key:'processes',title:'Procesos y jornadas · sin activar tarifas',rows:[...economics.processes,...economics.dayLabor]}]},
      limits:'Referencia local D91; moneda, impuestos y vigencia de los importes históricos sin acreditar. Madera y CNC siguen pendientes. Primer y acabado final diferidos.'};
  });
  const products=[['SYN-NUBE','Mesa Florencia','Mesas'],['SYN-PRISMA','Cubierta redonda de madera','Cubiertas']].map(([id,name,family])=>({id,name,family,description:descriptions[id],unit:'Pieza',imageId:definitions.find(d=>d.productId===id).id,clientId:'SYNTHETIC_ANY_CLIENT',variants:definitions.filter(d=>d.productId===id).map(d=>({id:d.id,name:d.name,articleLabel:d.label,description:recipes.find(r=>r.variantId===d.id).description,unit:'Pieza',materials:d.species,finishes:recipes.find(r=>r.variantId===d.id).finishDescription,specs:specs(...d.size),recipeId:'R-'+d.id,imageId:d.id,sku:'DEMO-'+(id==='SYN-NUBE'?'FLORENCIA-':'CUBIERTA-')+d.name.toUpperCase().replace(/ /g,'-')}))}));
  function recipe(id) { return recipes.find(row=>row.id===id)||null; }
  function variant(productId,id) { return products.find(row=>row.id===productId)?.variants.find(row=>row.id===id)||null; }
  function scaled(quantity,multiplier) {
    const parse=value=>{if(typeof value!=='string'||!/^\d+(?:\.\d{1,3})?$/.test(value))throw Error('Cantidad sintética inválida.');const [a,b='']=value.split('.');return BigInt(a)*1000n+BigInt(b.padEnd(3,'0'));};
    const product=parse(quantity)*parse(multiplier);
    if(product%1000n)throw Error('La cantidad requerida excede tres decimales; revisa la cantidad del artículo.');
    const value=product/1000n;
    if(value>100000000000n)throw Error('Cantidad fuera de rango.');
    return (value/1000n).toString()+(value%1000n?'.'+(value%1000n).toString().padStart(3,'0').replace(/0+$/,''):'');
  }
  function instantiate(recipeId,uid,articleQuantity='1') {
    const rec=recipe(recipeId); if(!rec||typeof uid!=='function')throw Error('Receta local no disponible.');
    const groups=[],materials=[],hardwareMeta=[];
    if(rec.hardware.length){const groupId=uid('GRP');groups.push({id:groupId,type:'consumable',woodKind:'',unit:'pieza',lengthUnit:'',woodWasteRate:'',specification:'Herrajes'});
      for(const h of rec.hardware){const id=uid('MAT'),purchaseQuantity=scaled(h.quantity,articleQuantity);materials.push({id,groupId,type:'consumable',section:'supplies',category:'Herrajes',name:h.name,quantity:h.quantity,unit:h.unit,measureSource:'own',length:'',width:'',lengthUnit:'',thickness:'',woodKind:'',specification:h.specification,purchaseQuantity,purchaseUnit:h.unit,unitPrice:h.unitPrice,taxRate:'',economicReviewed:false,purchaseQuality:'pending',basis:'Precio histórico de referencia; moneda, impuestos y vigencia pendientes.',supplier:'',reference:'',detail:{}});hardwareMeta.push({id,quantityPerProduct:h.quantity,unit:h.unit,mode:'AUTO',lastAutoQuantity:purchaseQuantity});}
    }
    const wood=rec.wood.map(w=>({...clone(w),id:uid('F'),groupId:uid('FG'),woodKind:rec.woodKind,wasteRate:rec.wasteRate,recipeSource:SOURCE,cnc:{decision:'',length:'',unit:'cm',repetitions:''},adjustment:null,historical:null,adoptionConfirmed:false}));
    // Historical processes are shown in documentary tables; no active tariff is created.
    const processes=[];
    return {groups,materials,processes,wood,metadata:{source:SOURCE,recipeId:rec.id,productId:rec.productId,variantId:rec.variantId,woodIds:wood.map(w=>w.id),hardware:hardwareMeta}};
  }
  // Existing D87/D91 local Tzalam references; not a confirmed administrative tariff.
  const woodPriceReferences=[['1','78.00'],['1.5','80.00'],['2','88.00']].map(([thickness,price])=>({species:'Tzalam',thicknessIn:Number(thickness),price,unit:UNIT,source:'ADMIN_UAT',quality:'PREVIEW',referenceSource:'USER_PROVIDED_LOCAL_REFERENCE'}));
  const prices=[];
  for(const recipe of recipes){
    const existing=prices.find(row=>row.species===recipe.woodKind);
    if(existing&&existing.price!==recipe.previewUnitPrice)throw Error('Referencias de precio contradictorias.');
    if(!existing)prices.push({species:recipe.woodKind,price:recipe.previewUnitPrice,unit:UNIT,source:'ADMIN_UAT',quality:'PREVIEW',referenceSource:'HISTORICAL_REFERENCE_D91'});
  }

  function configure(app) {
    if(!app||!app.lineCatalog||!app.solidWoodUatConfig)throw Error('Estado del cotizador no disponible.');
    app.lineCatalog.products=products;app.lineImages=images;
    const existing=app.solidWoodUatConfig.prices||[];
    app.solidWoodUatConfig={...app.solidWoodUatConfig,recipes,prices:[...existing.filter(p=>!prices.some(s=>s.species===p.species)),...prices]};
    if(!app.syntheticRecipes)app.syntheticRecipes={articles:{}};
  }
  freeze(products);freeze(recipes);freeze(images);freeze(imageKinds);freeze(prices);freeze(woodPriceReferences);
  globalThis.DemoRecipeCatalog=Object.freeze({source:SOURCE,products,recipes,images,imageKinds,prices,woodPriceReferences,recipe,variant,instantiate,scaled,configure});
})();
