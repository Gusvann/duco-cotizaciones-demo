/* Build-time UI extension. The D85 source and its financial rules stay intact. */
function installWoodPieceCatalog() {
  const nativeField = solidWoodField;
  const catalog = [
    'Cubierta', 'Pata', 'Travesaño', 'Faldón', 'Larguero', 'Riostra',
    'Soporte', 'Base', 'Asiento', 'Respaldo', 'Brazo', 'Entrepaño',
    'Costado', 'Puerta', 'Frente de cajón', 'Fondo', 'Tapa',
  ];

  // A datalist keeps historical and custom descriptions editable and changes
  // only the existing name field. Nothing else is inferred from the choice.
  solidWoodField = function (key, label, value, options = {}) {
    const html = nativeField(key, label, value, options);
    if (key !== 'name') return html;
    const marker = ' data-solid-field="name"';
    if (html.split(marker).length !== 2 || !html.endsWith('</div>')) {
      throw Error('Wood piece name field changed');
    }
    const input = html.replace(marker, marker + ' list="solid-wood-piece-catalog" autocomplete="off"');
    const choices = '<datalist id="solid-wood-piece-catalog">' + catalog.map(name => '<option value="' + esc(name) + '"></option>').join('') + '</datalist>';
    return input.slice(0, -6) + choices + '</div>';
  };
}

export function extendWoodPieces(source) {
  const marker = 'globalThis.__client = {';
  if (source.includes('/* WOOD_PIECE_CATALOG */')) throw Error('Wood piece catalog already installed');
  if (source.split(marker).length !== 2) throw Error('Expected one public client export for wood piece catalog');
  const installation = '/* WOOD_PIECE_CATALOG */\n(' + installWoodPieceCatalog.toString() + ')();\n';
  return source.replace(marker, installation + marker);
}
