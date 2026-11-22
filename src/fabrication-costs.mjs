// Recipe inputs and results are per finished article. Currency is rounded only for display.
export function createFabricationCosts(math) {
  const {dec,mul,add,div,v}=math;
  const fields={
    boards:{assemblyRate:'Armado · $/m²',cncMinutesPerM:'CNC · min/m',cncRate:'CNC · $/min',
      integrationDays:'Integración · días',dayRate:'Integración · $/día',extrasPct:'Insumos extras · %',extraMaterials:'Materiales adicionales · $'},
    metal:{paintFactor:'Pintura · m por m de perfil',rollingQty:'Rolado · cantidad',rollingPrice:'Rolado · $/unidad'}
  };
  const rate=value=>dec(value,2,100000000);
  const toMeters=(length,unit)=>div(dec(length),({cm:v(100),mm:v(1000),m:v(1)})[unit]);
  function metalGeometry(material){
    const length=toMeters(material.length,material.lengthUnit),meters=mul(dec(material.quantity),length);
    const sheet=material.section==='metal-sheet';
    const measure=sheet?mul(meters,toMeters(material.width,material.lengthUnit)):meters;
    return {measure,kg:mul(measure,dec(material.detail?.[sheet?'kgPerM2':'kgPerMl']))};
  }
  function piece(material,basis,settings) {
    const quantity=dec(material.quantity),detail=material.detail||{};
    if(material.section==='boards'){
      const geometry=math.base(material,basis);
      const area=geometry.area,stock=/^hoja$/i.test(material.purchaseUnit)?geometry.amount:null;
      const travel=mul(mul(quantity,toMeters(detail.linearCentimeters,'cm')),dec(detail.laserCount));
      return [['Tablero',stock,'board-stock'],['Armado',mul(area,rate(settings.assemblyRate)),'board-labor'],
        ['CNC',mul(mul(travel,dec(settings.cncMinutesPerM)),rate(settings.cncRate)),'board-cnc'],
        ['Insumos extras',div(mul(stock,dec(settings.extrasPct)),v(100)),'board-other']];
    }
    const {measure:meters,kg}=metalGeometry(material);
    return [['Acero',mul(kg,material.purchaseUnit==='kg'?rate(material.unitPrice):null),'metal-tube'],['Mano de obra',mul(kg,rate(detail.laborPrice)),'metal-work'],
      ['Pintura RAL 7021',mul(mul(meters,dec(settings.paintFactor)),rate(detail.paintPrice)),'metal-finish']];
  }
  function overhead(family,s) {
    return family==='boards'?[['Integración',mul(dec(s.integrationDays),rate(s.dayRate)),'board-days'],['Materiales adicionales',rate(s.extraMaterials),'board-other']]
      :[['Rolado',mul(dec(s.rollingQty),rate(s.rollingPrice)),'metal-other']];
  }
  function sum(rows) {
    const values=rows.map(([,value])=>value),known=values.filter(value=>value!=null);
    return {amount:known.length?known.reduce(add,v(0)):null,partial:known.length!==values.length};
  }
  return {fields,piece,overhead,sum,metalGeometry};
}
