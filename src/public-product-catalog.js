/* Public presentation data: variant identity, product name and finished dimensions in cm. */
(function () {
  'use strict';
  const catalogue = [
    ["SYN-NUBE","Mesa Florencia","Mesas", [
      ["SYN-NUBE-C","Tzalam","60","60","50","SYN-NUBE-C.png"],
      ["SYN-CATALOG-01","Encino blanco","60","60","50","SYN-CATALOG-01.jpg"],
      ["SYN-NUBE-O","Encino rojo","60","60","50","SYN-NUBE-O.png"],
    ]],
    ["SYN-BOLONIA","Bolonia","Mesas", [
      ["SYN-CATALOG-04","Tzalam","70.4","70.4","50","SYN-CATALOG-04.jpg"],
      ["v-b5c0a1375cb20a95","Encino blanco","70.4","70.4","50"],
      ["SYN-BOLONIA-R","Encino rojo","70.4","70.4","50","SYN-BOLONIA-R.png"],
    ]],
    ["SYN-BENT-LEGS","Bent Legs","Mesas", [
      ["SYN-CATALOG-02","Tzalam","45.9","45.9","48.4","SYN-CATALOG-02.jpg"],
      ["SYN-CATALOG-03","Encino blanco","45.9","45.9","48.4","SYN-CATALOG-03.jpg"],
      ["SYN-BENT-LEGS-R","Encino rojo","45.9","45.9","48.4","SYN-BENT-LEGS-R.png"],
      ["v-7ed5b6268b93b963","Corian Weathered Concrete","45","45","46"],
      ["v-07d2206cf3662a68","Corian Deep Night Sky","45","45","46"],
      ["v-7c50da7e9cc8a3be","Corian Carbon Concrete","45","45","46"],
    ]],
    ["SYN-PRISMA","Cubierta de madera","Cubiertas", [
      ["SYN-CATALOG-05","Redonda 60.96 cm · Clásica · Tzalam","60.96","60.96","3.2","SYN-CATALOG-05.jpg"],
      ["SYN-CATALOG-06","Redonda 60.96 cm · Clásica · Encino blanco","60.96","60.96","3.2","SYN-CATALOG-06.jpg"],
      ["SYN-CATALOG-08","Cuadrada 60.96 cm · Clásica · Tzalam","60.96","60.96","3.2","SYN-CATALOG-08.jpg"],
      ["SYN-CATALOG-09","Cuadrada 60.96 cm · Clásica · Encino blanco","60.96","60.96","3.2","SYN-CATALOG-09.jpg"],
      ["SYN-PRISMA-C","Redonda 76 cm · Clásica · Tzalam","76","76","3.2","SYN-PRISMA-C.png"],
      ["SYN-PRISMA-O","Redonda 76 cm · Clásica · Encino blanco","76","76","3.2","SYN-PRISMA-O.png"],
      ["v-417bccbecf5405eb","Redonda 60.96 cm · Con bisel · Tzalam","60.96","60.96","3.2"],
      ["v-69889b81e0ce070f","Redonda 60.96 cm · Con bisel · Encino blanco","60.96","60.96","3.2"],
      ["v-f00573016bbfbbcb","Cuadrada 60.96 cm · Con bisel · Tzalam","60.96","60.96","3.2"],
      ["v-e04895e927242bdf","Cuadrada 60.96 cm · Con bisel · Encino blanco","60.96","60.96","3.2"],
      ["v-9ca0f09c24e2d02f","Redonda 76 cm · Con bisel · Tzalam","76","76","3.2"],
      ["v-6f3ec881cb2b5d7d","Redonda 76 cm · Con bisel · Encino blanco","76","76","3.2"],
      ["SYN-CATALOG-07","Redonda 60.96 cm · Clásica · Encino rojo","60.96","60.96","3.2","SYN-CATALOG-07.jpg"],
      ["SYN-CATALOG-10","Cuadrada 60.96 cm · Clásica · Encino rojo","60.96","60.96","3.2","SYN-CATALOG-10.jpg"],
      ["SYN-PRISMA-G","Redonda 76 cm · Clásica · Encino rojo","76","76","3.2","SYN-PRISMA-G.png"],
      ["v-4aea2a73f8696844","Redonda 60.96 cm · Con bisel · Encino rojo","60.96","60.96","3.2"],
      ["v-a0c821e0ddabce7c","Cuadrada 60.96 cm · Con bisel · Encino rojo","60.96","60.96","3.2"],
      ["v-398d7f6b2d6ef488","Redonda 76 cm · Con bisel · Encino rojo","76","76","3.2"],
    ]],
    ["SYN-CORIAN","Cubierta de Corian","Cubiertas", [
      ["v-8c0f89985f9484ee","Redonda Ø61 cm · Bisel · Corian Weathered Concrete","61","61","3.2"],
      ["v-5f36f5ade743aa9d","Redonda Ø61 cm · Bisel · Corian Deep Night Sky","61","61","3.2"],
      ["v-589f2f001229cdef","Redonda Ø76 cm · Bisel · Corian Weathered Concrete","76","76","3.2"],
      ["v-d8fad28a529dddd8","Redonda Ø76 cm · Bisel · Corian Deep Night Sky","76","76","3.2"],
      ["v-4e6122c5906e7c66","Redonda Ø61 cm · Clásica · Corian Weathered Concrete","61","61","3.2"],
      ["v-07766ced424603b2","Redonda Ø61 cm · Clásica · Corian Deep Night Sky","61","61","3.2"],
      ["v-0fafce57227d5237","Redonda Ø76 cm · Clásica · Corian Weathered Concrete","76","76","3.2"],
      ["v-b1dd118d99209a66","Redonda Ø76 cm · Clásica · Corian Deep Night Sky","76","76","3.2"],
      ["v-73f310159c43a038","Cuadrada 61 × 61 cm · Bisel · Corian Weathered Concrete","61","61","3.2"],
      ["v-36253d43e716ca40","Cuadrada 61 × 61 cm · Bisel · Corian Deep Night Sky","61","61","3.2"],
      ["v-d202a7a963f80ad8","Cuadrada 61 × 61 cm · Clásica · Corian Weathered Concrete","61","61","3.2"],
      ["v-a6c79e966fbd0136","Cuadrada 61 × 61 cm · Clásica · Corian Deep Night Sky","61","61","3.2"],
      ["v-6305a87b38d74855","Redonda Ø61 cm · Bisel · Corian Carbon Concrete","61","61","3.2"],
      ["v-40631b63a5fdbd99","Redonda Ø76 cm · Bisel · Corian Carbon Concrete","76","76","3.2"],
      ["v-ef1b233ce786cdb5","Redonda Ø61 cm · Clásica · Corian Carbon Concrete","61","61","3.2"],
      ["v-86949cffe77ce052","Redonda Ø76 cm · Clásica · Corian Carbon Concrete","76","76","3.2"],
      ["v-6a395ef128d5add4","Cuadrada 61 × 61 cm · Bisel · Corian Carbon Concrete","61","61","3.2"],
      ["v-eb4bf9ab36ab0f4b","Cuadrada 61 × 61 cm · Clásica · Corian Carbon Concrete","61","61","3.2"],
    ]],
    ["SYN-X-BASE","Mesa X Base","Mesas", [
      ["v-fda7651c1f02d64d","Redonda Ø45.7 cm · Corian Weathered Concrete","45.7","45.7","43"],
      ["v-3f99c48e7350cf1f","Redonda Ø45.7 cm · Corian Deep Night Sky","45.7","45.7","43"],
      ["v-f3dc71b4e142a381","Cuadrada 45.7 × 45.7 cm · Corian Weathered Concrete","45.7","45.7","43"],
      ["v-91c97f07ba50918f","Cuadrada 45.7 × 45.7 cm · Corian Deep Night Sky","45.7","45.7","43"],
      ["v-b3332ecf2d94c6c5","Redonda Ø45.7 cm · Corian Carbon Concrete","45.7","45.7","43"],
      ["v-40f056c033edd7d0","Cuadrada 45.7 × 45.7 cm · Corian Carbon Concrete","45.7","45.7","43"],
    ]],
    ["SYN-PEDESTAL","Pedestal de acero","Pedestales", [
      ["SYN-CATALOG-11","High Bar 42 in · interior · base Ø55 cm · placa 25 × 25 cm","55","55","105","SYN-CATALOG-11.jpg"],
      ["SYN-CATALOG-12","High Bar 42 in · interior · base Ø45 cm · placa 15 × 15 cm","45","45","105","SYN-CATALOG-12.jpg"],
      ["SYN-CATALOG-13","Counter 34 in · interior · base Ø55 cm · placa 25 × 25 cm","55","55","85","SYN-CATALOG-13.jpg"],
      ["v-a661756b09f29547","Normal · 71 cm · Interior · Base Ø45 cm · Placa 15 × 15 cm","45","45","71"],
      ["v-6d035256d7fa408b","High Bar · 104 cm · Interior · Base Ø45 cm · Placa 15 × 15 cm","45","45","104"],
      ["SYN-CATALOG-14","Café 28 in · interior · base Ø45 cm · placa 15 × 15 cm","45","45","70","SYN-CATALOG-14.jpg"],
      ["SYN-CATALOG-15","Café 28 in · exterior · base Ø45 cm · placa 15 × 15 cm","45","45","70","SYN-CATALOG-15.jpg"],
      ["SYN-CATALOG-16","High Bar 42 in · exterior · base Ø55 cm · placa 25 × 25 cm","55","55","105","SYN-CATALOG-16.jpg"],
    ]],
    ["SYN-VERDE","Banquette Verde","Asientos", [
      ["SYN-CATALOG-17","Recto chico · Encino blanco · piel Dollaro","100","61","82","SYN-CATALOG-17.jpg"],
      ["v-45140239fec78c3d","Recto mediano · Encino blanco · piel Dollaro","165","61","82"],
      ["v-71826f3731e20773","Recto grande · Encino blanco · piel Dollaro","180","61","82"],
      ["v-dedb03ca22987dc9","Curvo · Encino blanco · piel Dollaro","71","71","82"],
      ["v-7bd7de047b30e30d","Esquina · Encino blanco · piel Dollaro","71","71","82"],
      ["SYN-CATALOG-18","Recto chico · Encino blanco · piel Amadeus","100","61","82","SYN-CATALOG-18.jpg"],
      ["v-55d2316fd85ddeea","Recto mediano · Encino blanco · piel Amadeus","165","61","82"],
      ["v-97d2751790d7d65e","Recto grande · Encino blanco · piel Amadeus","180","61","82"],
      ["v-a499dc8a4cd7496b","Curvo · Encino blanco · piel Amadeus","71","71","82"],
      ["v-b963b171797f41a9","Esquina · Encino blanco · piel Amadeus","71","71","82"],
      ["SYN-CATALOG-19","Recto chico · Encino blanco · piel Eureka","100","61","82","SYN-CATALOG-19.jpg"],
      ["v-423b3371d894af6f","Recto mediano · Encino blanco · piel Eureka","165","61","82"],
      ["v-f1db7a8c4c734305","Recto grande · Encino blanco · piel Eureka","180","61","82"],
      ["v-e209541fd4f9dc24","Curvo · Encino blanco · piel Eureka","71","71","82"],
      ["v-30008d9dc802188a","Esquina · Encino blanco · piel Eureka","71","71","82"],
      ["SYN-CATALOG-20","Recto chico · Encino rojo · piel Dollaro","100","61","82","SYN-CATALOG-20.jpg"],
      ["v-2ef24caa7cc15724","Recto mediano · Encino rojo · piel Dollaro","165","61","82"],
      ["v-91e4aa1fd932f994","Recto grande · Encino rojo · piel Dollaro","180","61","82"],
      ["v-a1f53c6cd8ad9c49","Curvo · Encino rojo · piel Dollaro","71","71","82"],
      ["v-88e5b7206af76446","Esquina · Encino rojo · piel Dollaro","71","71","82"],
      ["SYN-CATALOG-21","Recto chico · Encino rojo · piel Amadeus","100","61","82","SYN-CATALOG-21.jpg"],
      ["v-badf5ebff271c0bd","Recto mediano · Encino rojo · piel Amadeus","165","61","82"],
      ["v-32d4c55a83d126d8","Recto grande · Encino rojo · piel Amadeus","180","61","82"],
      ["v-033fc2610c813412","Curvo · Encino rojo · piel Amadeus","71","71","82"],
      ["v-0ae09cdc44aea21f","Esquina · Encino rojo · piel Amadeus","71","71","82"],
      ["SYN-CATALOG-22","Recto chico · Encino rojo · piel Eureka","100","61","82","SYN-CATALOG-22.jpg"],
      ["v-c889cc7697365c0f","Recto mediano · Encino rojo · piel Eureka","165","61","82"],
      ["v-b7b99d8a1b47a99e","Recto grande · Encino rojo · piel Eureka","180","61","82"],
      ["v-9a7853e5eec6761f","Curvo · Encino rojo · piel Eureka","71","71","82"],
      ["v-597a3f85a315f46c","Esquina · Encino rojo · piel Eureka","71","71","82"],
      ["SYN-CATALOG-23","Recto chico · Tzalam · piel Dollaro","100","61","82","SYN-CATALOG-23.jpg"],
      ["v-633098f8ee04e1e3","Recto mediano · Tzalam · piel Dollaro","165","61","82"],
      ["v-c82020860ec99114","Recto grande · Tzalam · piel Dollaro","180","61","82"],
      ["v-252959bbd4b0d862","Curvo · Tzalam · piel Dollaro","71","71","82"],
      ["v-2e2720b9a3fdc20a","Esquina · Tzalam · piel Dollaro","71","71","82"],
      ["SYN-CATALOG-24","Recto chico · Tzalam · piel Amadeus","100","61","82","SYN-CATALOG-24.jpg"],
      ["v-a7c676a06c131e5b","Recto mediano · Tzalam · piel Amadeus","165","61","82"],
      ["v-43618d9cb1eac841","Recto grande · Tzalam · piel Amadeus","180","61","82"],
      ["v-1db56c32ed193fc5","Curvo · Tzalam · piel Amadeus","71","71","82"],
      ["v-124f253e2f0a00e9","Esquina · Tzalam · piel Amadeus","71","71","82"],
      ["SYN-CATALOG-25","Recto chico · Tzalam · piel Eureka","100","61","82","SYN-CATALOG-25.jpg"],
      ["v-216b92baa2db572f","Recto mediano · Tzalam · piel Eureka","165","61","82"],
      ["v-c055f04e052ad245","Recto grande · Tzalam · piel Eureka","180","61","82"],
      ["v-8022e379ed26cdd2","Curvo · Tzalam · piel Eureka","71","71","82"],
      ["v-d2de4f879b54fc3f","Esquina · Tzalam · piel Eureka","71","71","82"],
    ]],
    ["SYN-ORIZABA","Banquette Orizaba","Asientos", [
      ["SYN-CATALOG-26","Grande · Vinil Maglia · 165 cm","165","58","86","SYN-CATALOG-26.jpg"],
      ["SYN-CATALOG-27","Chico · Vinil Maglia · 100 cm","100","58","86","SYN-CATALOG-27.jpg"],
    ]],
    ["SYN-SOFA-EUCLIDES","Sofá May · Euclides","Asientos", [
      ["v-aa9ce2689ec3ee2e","160 cm · Encino rojo · Piel Amadeus","160","75","67"],
      ["v-e60a3dde8a3aefb6","160 cm · Encino rojo · Piel Eureka","160","75","67"],
      ["v-c331973cb37f4ac1","160 cm · Encino rojo · Piel Dollaro","160","75","67"],
      ["v-54147b08e783d155","160 cm · Encino rojo · Vinil Valencia Heritage","160","75","67"],
      ["v-8fc16b348ddd13fc","160 cm · Tzalam · Piel Amadeus","160","75","67"],
      ["v-6898bb956ccc32ea","160 cm · Tzalam · Piel Eureka","160","75","67"],
      ["v-1f0552382ac6e0f2","160 cm · Tzalam · Piel Dollaro","160","75","67"],
      ["v-e4fdfc8682e62e82","160 cm · Tzalam · Vinil Valencia Heritage","160","75","67"],
      ["v-6a6c26ed9f4a5a5c","160 cm · Encino blanco · Piel Amadeus","160","75","67"],
      ["v-67a9bbc043ed3ac0","160 cm · Encino blanco · Piel Eureka","160","75","67"],
      ["v-2b174c32c3b9b09a","160 cm · Encino blanco · Piel Dollaro","160","75","67"],
      ["v-67977ec210c42587","160 cm · Encino blanco · Vinil Valencia Heritage","160","75","67"],
      ["v-b6319231a34ec94d","190 cm · Encino rojo · Piel Amadeus","190","75","63.5"],
      ["v-fe945b960c840952","190 cm · Encino rojo · Piel Eureka","190","75","63.5"],
      ["v-e8af961c668a373e","190 cm · Encino rojo · Piel Dollaro","190","75","63.5"],
      ["v-ce5aa7742e45dfba","190 cm · Encino rojo · Vinil Valencia Heritage","190","75","63.5"],
      ["v-230db32ffcb66611","190 cm · Tzalam · Piel Amadeus","190","75","63.5"],
      ["v-3a7abdde6080b91b","190 cm · Tzalam · Piel Eureka","190","75","63.5"],
      ["v-a599e14d85c9981c","190 cm · Tzalam · Piel Dollaro","190","75","63.5"],
      ["v-fbb78924ed5e6369","190 cm · Tzalam · Vinil Valencia Heritage","190","75","63.5"],
      ["v-88313b7c76a39128","190 cm · Encino blanco · Piel Amadeus","190","75","63.5"],
      ["v-995dea682b30767e","190 cm · Encino blanco · Piel Eureka","190","75","63.5"],
      ["v-37421f974b01a8ec","190 cm · Encino blanco · Piel Dollaro","190","75","63.5"],
      ["v-98b36790ba19c3d2","190 cm · Encino blanco · Vinil Valencia Heritage","190","75","63.5"],
    ]],
    ["SYN-OTOMANO","Otomano tejido","Asientos", [
      ["v-6e5ee96b27568de4","Redondo Ø50 × 45 cm · Piola PVC de 6 mm","50","50","45"],
    ]],
    ["SYN-LEAN-HERE","Lean Here","Asientos", [
      ["v-f19b9156aa9e3065","50 in · Vinil Valencia Heritage · RAL 7021","127","23","74"],
    ]],
  ];
  // Demonstration inputs are invented independently of procurement and manufacturing records.
  const products=[], rows=[], assets=Object.create(null);
  // These illustrations predate the new colour series; describe the tone visible in each photograph.
  const originalTones={
    'SYN-CATALOG-17':'beige','SYN-CATALOG-18':'topo','SYN-CATALOG-19':'gris piedra',
    'SYN-CATALOG-20':'beige','SYN-CATALOG-21':'topo','SYN-CATALOG-22':'gris piedra',
    'SYN-CATALOG-23':'beige','SYN-CATALOG-24':'topo','SYN-CATALOG-25':'gris piedra',
    'SYN-CATALOG-26':'café','SYN-CATALOG-27':'café'
  };
  const money = value => Number(value).toFixed(2);
  const metalSettings=()=>({paintFactor:'1',rollingQty:'2',rollingPrice:'15.00',
    operations:[{id:'cut',panel:'metal-cnc',name:'Corte láser 1/2',quantity:'1.501',unit:'m',rate:'12.33'}]});
  function plate(){
    return {name:'Placa de muestra',quantity:'1',width:'40',length:'50',lengthUnit:'cm',section:'metal-sheet',
      unitPrice:'40.00',gauge:'14',profile:'',dimension:'',detail:{kgPerM2:'10',paintFaces:'2',laborPrice:'5.00',paintPrice:'15.00',linearCentimeters:'0',laserCount:'0'}};
  }
  function tube(){
    return {name:'Perfil de muestra',quantity:'2',width:'',length:'50',lengthUnit:'cm',section:'metal-tube',
      unitPrice:'40.00',gauge:'14',profile:'Tubular',dimension:'1 × 1 in',detail:{kgPerMl:'2',sideACm:'2.54',sideBCm:'2.54',laborPrice:'5.00',paintPrice:'10.00',linearCentimeters:'0',laserCount:'0'}};
  }
  function board(){
    return {name:'Panel de muestra',quantityPerProduct:'1',lengthUnit:'cm',length:'50',width:'40',
      substrate:'Lisapol',coating:'',thickness:'9',unitPrice:'500.00',supplier:'',sheetAreaM2:'2.5',wasteRate:'0',
      detail:{naturalFace:'Natural',edgeWidthCount:'1',edgeLengthCount:'1',paintFaces:'1',gluedFaces:'1',linearCentimeters:'120',laserCount:'1'}};
  }
  const boardSettings=()=>({assemblyRate:'40.00',cncMinutesPerM:'2',cncRate:'5.00',integrationDays:'0',dayRate:'0',extrasPct:'0',extraMaterials:'0'});
  const woodWorkshop=()=>({values:{'domino.quantity':'1','domino.lengthCm':'40','domino.unions':'0','domino.extra':'0','domino.price':'2.00',
    'labor.assembly.rate':'0','labor.jointing.rate':'0','labor.joinery.rate':'0','labor.varnish.rate':'0',
    'other.glue.price':'0','other.cncMinutesPerMl':'2','other.cnc.price':'5.00','other.extrasPct':'0',
    'days.0.quantity':'0','days.0.rate':'0','days.2.quantity':'0','days.2.rate':'0','days.3.quantity':'0','days.3.rate':'0'}});
  function timber(species){
    return {name:'CUBIERTA',quantityPerProduct:'1',woodKind:species,width:'40',length:'50',thickness:'1',lengthUnit:'cm',
      finishFaces:'2',jointed:'0',cnc:{decision:'yes',length:'180',unit:'cm',repetitions:'1'}};
  }
  for (const [productId, name, family, options] of catalogue) {
    products.push({id:productId, name, family, description:name+' · '+family});
    for (const [id, variant, length, width, height, originalFile] of options) {
      const url=originalFile?'src/assets/catalogo-sintetico/'+originalFile:'assets/catalogo/'+id+'.webp';
      const thumbnail=(originalFile?'src/assets/catalogo-sintetico/thumb/':'assets/catalogo/thumb/')+id+'.webp';
      assets[id]=Object.freeze({url,thumbnail});
      const species=variant.match(/Encino (?:rojo|blanco)|Tzalam/i)?.[0];
      const surface=variant.match(/Corian (?:Weathered Concrete|Deep Night Sky|Carbon Concrete)/)?.[0];
      const fabric=variant.match(/(?:[Pp]iel |Vinil )(?:Dollaro|Amadeus|Eureka|Maglia|Valencia Heritage)/)?.[0];
      const materials=[species,surface,fabric].filter(Boolean);
      if(!materials.length)materials.push(productId==='SYN-OTOMANO'?'Piola tejida y acero':'Acero');
      const material=materials.join(' · ');
      const description=name+' · '+variant;
      const rate=family==='Mesas'?325:family==='Asientos'?440:family==='Pedestales'?190:210;
      const supply={name:material, specification:'Material de muestra para '+name,quantityPerProduct:'1',unit:'PZA',
        purchaseUnit:'PZA',purchasePerProduct:'1',unitPrice:money(rate),category:'Insumos'};
      if (/piel/i.test(fabric||''))Object.assign(supply,{name:fabric,category:'Textiles',quantityPerProduct:'250',unit:'dm²',purchaseUnit:'Lienzo'});
      if (/vinil/i.test(fabric||''))Object.assign(supply,{name:fabric,category:'Textiles',quantityPerProduct:'1.5',unit:'ML',purchasePerProduct:'1.5',purchaseUnit:'ML'});
      const fitting=family==='Mesas'?'TUERCA INSERTO':'Juego de montaje';
      const hardware=[supply,{name:fitting,specification:fitting,quantityPerProduct:'1',unit:'PZA',
        purchaseUnit:'PZA',purchasePerProduct:'1',unitPrice:'28.00',category:'Herrajes'}];
      const maquilas=[{name:'Preparación y ensamble',quantity:'1',unit:'PZA',unitPrice:'160.00',category:'Otros'}];
      const finish=surface?surface: fabric|| (species?'Acabado de madera':'Acabado en acero');
      const tone=originalTones[id]||(variant.includes('Dollaro')?'gris oscuro':variant.includes('Eureka')?'olivo':variant.includes('Amadeus')?'Smoke, topo cálido':variant.includes('Valencia Heritage')?'neutro cálido':null);
      const wood=species?[timber(species)]:[];
      if(wood.length&&productId==='SYN-VERDE')wood.push({...timber('Pino'),name:'Travesaño de muestra',width:'4',length:'45',finishFaces:'0',cnc:{decision:'no',length:'',unit:'cm',repetitions:''}});
      const boards=surface||['SYN-BOLONIA','SYN-VERDE','SYN-SOFA-EUCLIDES'].includes(productId)?[board()]:[];
      const metal=productId==='SYN-NUBE'||productId==='SYN-PRISMA'||productId==='SYN-CORIAN'?[]:[plate(),tube()];
      const fabrication=boards.length||metal.length?{boards:boardSettings(),metal:metalSettings()}:null;
      rows.push({id,productId,variant,description,finishDescription:finish,materialsLabel:material,illustratedTone:tone,
        finishedSpecs:{Largo:length,Ancho:width,Alto:height},sku:'DEMO-'+id,syntheticPricing:true,woodWastePercent:'0',
        wood,boards,metal,hardware,maquilas,fabrication,workshopDefaults:wood.length?woodWorkshop():null,
        economics:{wood:wood.map(piece=>({name:piece.name,kind:'WOOD',quantity:'',quantityUnit:'P1_WOOD_UNIT_PENDING_DUCO',unitPrice:'68.00',priceUnit:'SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO',totalSaved:null})),hardware:[],consumables:[],processes:[],dayLabor:[]},
        commercialNotes:['Receta y tarifas ficticias para probar la cotización.'],
        referenceTotals:null});
    }
  }
  globalThis.DemoPublicRecipes=Object.freeze({products,rows,assets:Object.freeze(assets)});
})();
