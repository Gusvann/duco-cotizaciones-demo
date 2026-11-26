// Prices and dimensions here are synthetic test inputs; the expected totals are independent.
export async function prepareFurniture(p){
  const quote=(page,selector)=>page.locator('#quote-host').locator(selector);
  for(let i=0;i<2;i++){
    if(i)await quote(p,'[data-action="line-add"]').click();
    await quote(p,'[data-action="line-open"]').click();
    await quote(p,'[data-action="line-select-product"][data-product="SYN-NUBE"]').click();
    const choices=quote(p,'[data-line-variant="SYN-NUBE"]');
    const variant=await choices.locator('option').evaluateAll(options=>
      options.find(entry=>/^(?:PUB-)?SYN-NUBE-C$/.test(entry.value))?.value);
    if(!variant)throw Error('Falta la variante de prueba para preparar el caso de mobiliario');
    await choices.selectOption(variant);
    await quote(p,'[data-action="line-use"][data-product="SYN-NUBE"]').click();
  }
  // Two catalog lines supply valid, independent identities. Replace the recipe
  // inputs with measured synthetic pieces. Expected amounts below are by hand.
  return p.evaluate(()=>{
    const c=window.__client,q=c.app.q;
    c.partDiscard();
    const ids=q.items.map(item=>item.id);
    q.manufacturing.packaging={method:'fixed',netAmount:'40.02',taxRate:'0',quality:'confirmed',basis:'Una caja para todo el pedido',manualAntecedents:[]};
    q.manufacturing.indirectMethod='none';
    q.items.forEach((item,index)=>{
      const chair=index===1,row=q.manufacturing.items.find(r=>r.itemId===item.id);
      item.description=chair?'Silla de control':'Mesa de control';item.quantity='1';
      const hardware=row.materials[0],meta=c.app.syntheticRecipes.articles[item.id];
      Object.assign(hardware,{name:'Herraje de control',quantity:'1',purchaseQuantity:'1',unitPrice:chair?'8':'26',taxRate:'0',economicReviewed:true,purchaseQuality:'confirmed',basis:'Compra unitaria de prueba',validUntil:''});
      row.materials=[hardware];meta.hardware=meta.hardware.filter(h=>h.id===hardware.id);
      row.processes=chair?[{id:'PRC-CONTROL',section:'maquilas',type:'maquila',category:'',name:'Servicio por silla',execution:'external',quantity:'1',quantityScope:'product',detail:{unitPrice:'5'},target:{kind:'product',groupId:'',componentIds:[]},
        source:{kind:'manual',reviewed:true,netAmount:'5.00',taxRate:'0',quality:'confirmed',basis:'Por silla',includedInMaterialId:''}}]:[];
      row.finishSystems=[];row.mode='detailed';
      const local=c.solidWoodState(item.id),piece=local.applied[0];
      Object.assign(piece,{name:'Listón de control',quantityPerProduct:'1',width:chair?'27.94':'55.88',length:'30.48',lengthUnit:'cm',thickness:'1',woodKind:'Pino',wasteRate:'0',finishFaces:'1',jointed:'0',cnc:{decision:'no'},
        adjustment:{articleId:item.id,componentIds:[piece.id],species:'Pino',price:'100',unit:'P1_WOOD_UNIT_PENDING_DUCO',reason:'Referencia controlada',actor:'Pruebas'}});
      local.applied=[piece];local.draft=null;
      const values=c.workshopValues(item.id);
      Object.assign(values,{'domino.componentId':piece.id,'domino.quantity':'1','domino.lengthCm':'30.48','domino.unions':'0','domino.price':'0','other.extrasPct':'0','other.glue.price':'0','other.cnc.price':'0','labor.assembly.rate':''});
      for(const key of ['jointing','joinery','varnish'])values['labor.'+key+'.rate']='0';
      for(let i=0;i<6;i++)values['days.'+i+'.quantity']='0';
      for(let i=0;i<3;i++)values['finish.'+i+'.enabled']=false;
      local.workshop={version:1,values,dayNames:['Carpintería','Instalación','CNC / Láser','Acabados','Tejido','Integración']};
    });
    c.app.q=QuoteManufacturing_.apply(q);c.restoreManufacturing();
    c.app.openPartId='';c.app.dirty=true;c.editor();
    return ids;
  });
}
