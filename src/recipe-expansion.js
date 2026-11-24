// Synthetic fixtures for compatibility tests of the older 27-row import format.
// The public page loads public-product-catalog.js directly.
(() => {
  const publicCatalog=globalThis.DemoPublicRecipes;
  if(!publicCatalog)throw Error('Carga primero el catálogo de prueba.');
  const rows=publicCatalog.rows.filter(row=>/^SYN-CATALOG-\d\d$/.test(row.id));
  globalThis.DemoRecipeExpansion=rows.map(row=>({...row,
    referenceTotals:{amount:'500.00',rubros:[{label:'Estimación de prueba',amount:'500.00'}]},
    commercialNotes:['Importe documental ficticio para comprobar compatibilidad.']}));
  delete globalThis.DemoPublicRecipes;
})();
