// Import boundary for the separately distributed, local recipe workbook extract.
const baseProducts=new Set(['SYN-NUBE','SYN-PRISMA','SYN-BOLONIA','SYN-BENT-LEGS','SYN-PEDESTAL','SYN-VERDE','SYN-ORIZABA']);
const identifier=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_-]{1,99}$/.test(value);
const label=value=>typeof value==='string'&&value.trim().length>0;
const amount=value=>typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value);

export function validateRecipeUpdates(bundle) {
  const reject=()=>{throw Error('El catálogo de recetas tiene datos incompletos o identificadores duplicados.');};
  if(!Array.isArray(bundle?.rows)||!bundle.rows.length||bundle.rows.length>2000||!Array.isArray(bundle.products))reject();
  const products=new Set(),ids=new Set();
  for(const p of bundle.products){
    if(!identifier(p?.id)||products.has(p.id)||![p.name,p.family,p.description].every(label))reject();
    products.add(p.id);
  }
  for(const row of bundle.rows){
    if(!identifier(row?.id)||ids.has(row.id)||!products.has(row.productId)&&!baseProducts.has(row.productId)||
      ![row.variant,row.description].every(label)||!row.finishedSpecs||
      !['wood','hardware','boards','metal','maquilas','commercialNotes'].every(key=>Array.isArray(row[key]))||
      !['wood','hardware','consumables','processes','dayLabor'].every(key=>Array.isArray(row.economics?.[key]))||
      !Array.isArray(row.referenceTotals?.rubros))reject();
    for(const group of [row.hardware,row.wood,row.boards]){
      if(group.some(item=>!label(item?.name)||!amount(item.quantityPerProduct)))reject();
    }
    if(row.hardware.some(item=>!label(item.unit)||!item.purchaseNeedsMeasurement&&item.purchasePerProduct!=null&&!amount(item.purchasePerProduct)))reject();
    const historic=[row.referenceTotals.amount,...row.referenceTotals.rubros.map(entry=>entry.amount)];
    if(historic.some(value=>value!=null&&value!==''&&!amount(value)))reject();
    ids.add(row.id);
  }
  for(const id of products)if(!bundle.rows.some(row=>row.productId===id))reject();
  return {rows:bundle.rows,products:bundle.products};
}
