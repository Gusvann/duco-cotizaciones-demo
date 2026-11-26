/* Read-only commercial line items, shared by the quote detail and Gestión. */
(() => {
  'use strict';
  function table(items, escape) {
    const rows=items.map(({description,quantity,unit}) =>
      '<tr><th scope="row">'+escape(description || 'Producto sin nombre')+'</th><td>'+
      escape(quantity === '' || quantity == null ? 'Por definir' : quantity)+'</td><td>'+
      escape(unit || 'Por definir')+'</td></tr>').join('');
    return '<table class="j-quote-products"><caption class="j-sr">Productos de la cotización</caption>'+
      '<thead><tr><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Unidad</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>';
  }
  globalThis.DucoQuoteProducts=Object.freeze({table});
})();
