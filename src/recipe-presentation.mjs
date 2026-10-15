/* D87–D91 presentation on the public D85 client. No recipe, tariff or domain arithmetic. */
// Sum documentary saved amounts for ONE article; never derive a current charge.
// Keep source precision until the final subtotal and distinguish absence from 0.
export function recipeSourceSubtotal(rows) {
  const decimal = value => {
    if ((typeof value !== 'number' && typeof value !== 'string') || typeof value === 'number' && !Number.isFinite(value)) return null;
    const text = String(value);
    if (text.length > 128) return null;
    const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
    if (!match) return null;
    const exponent = Number(match[3] || 0);
    if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return null;
    let coefficient = BigInt(match[1] + (match[2] || '')), scale = (match[2] || '').length - exponent;
    if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
    return { coefficient, scale };
  };
  let total = 0n, scale = 0, knownCount = 0, missingCount = 0, invalidCount = 0;
  for (const row of rows) {
    const values = [row?.quantity, row?.unitPrice, row?.totalSaved];
    if (values.some(value => value === null || value === undefined || value === '')) { missingCount++; continue; }
    const parsed = values.map(decimal);
    if (parsed.some(value => value === null)) { invalidCount++; continue; }
    const amount = parsed[2], nextScale = Math.max(scale, amount.scale);
    total = total * 10n ** BigInt(nextScale - scale) + amount.coefficient * 10n ** BigInt(nextScale - amount.scale);
    scale = nextScale; knownCount++;
  }
  let cents = null;
  if (knownCount) {
    const divisor = 10n ** BigInt(Math.max(0, scale - 2));
    cents = String(scale <= 2 ? total * 10n ** BigInt(2 - scale) : (total + divisor / 2n) / divisor);
  }
  const pendingCount = missingCount + invalidCount;
  return { cents, rowCount: rows.length, knownCount, pendingCount, missingCount, invalidCount,
    status: rows.length === 0 ? 'NO_ROWS' : pendingCount ? 'PARTIAL' : 'COMPLETE_REFERENCE',
    quality: 'HISTORICAL_SOURCE_REFERENCE', financialConfirmed: false };
}

function installRecipePresentation(recipeSourceSubtotal) {
  const nativeWoodEditor = solidWoodEditorReferenceHtml;
  const nativeWoodRefresh = solidWoodRefresh;
  const nativeWoodSet = solidWoodSet;
  const nativeMaterialCard = articlePanelMaterialCard;
  const nativeProcessCard = articlePanelProcessCard;
  const nativeWoodFamily = solidWoodFamilyHtml;
  const nativeSupplyEditor = breakdownSupplyEditor;
  const nativePurchaseFields = breakdownPurchaseFields;
  const nativeBreakdownFooter = breakdownFooter;

  function metric(label, value, unit = '', notApplicable = false) {
    return '<span><small>' + esc(label) + '</small><strong>' + esc(notApplicable ? 'No aplica' : solidWoodNumber(value)) + (notApplicable || value == null || !unit ? '' : ' ' + esc(unit)) + '</strong></span>';
  }
  function unitBlocks(id, component, result) {
    const name = component.name || 'Pieza sin nombre', price = result.priceResolution;
    const isReference = component.recipeSource === 'LOCAL_REFERENCE_D91';
    const measurements = (values, wood, waste) => '<div class="wood-unit-metrics">' + metric('Área', values.areaM2, 'm²') + metric('PIES³ — ' + name, wood) + metric('PIES + DESP', waste) + metric('Pintura', values.paintM2, 'm²') + metric('Entablerado', values.jointedM2, 'm²', String(component.jointed) === '0') + '</div>';
    const unitMeasurements = measurements(result.unitMeasurements, result.unitP1WoodRequirement, result.unitP1WoodWithWaste);
    const unitCost = '<small>Costo madera — ' + esc(name) + '</small><strong>' + solidWoodMoney(result.unitCosts.woodCost) + '</strong><small>Unitario · preview' + (isReference ? ' · moneda sin acreditar' : ' MXN') + ' · ' + esc(price.quality) + '</small>';
    const unitPriceInfo = '<div class="wood-unit-price-reference"><span><small>' + (isReference ? 'Referencia histórica de material · PREVIEW' : 'Catálogo sintético · PREVIEW') + '</small><strong>' + solidWoodMoney(price.basePrice) + '</strong></span><span><small>Diferencia frente a la referencia</small><strong>' + solidWoodMoney(price.difference) + (price.differencePct == null ? '' : ' · ' + esc(solidWoodNumber(price.differencePct)) + '%') + '</strong></span></div><p class="meta">' + esc(price.quality === 'PENDING' ? 'Precio pendiente' : result.priceAdjustment ? 'Ajuste local · ESTIMATED · motivo obligatorio' : isReference ? 'Precio documental · vigencia, moneda e impuestos sin acreditar · PREVIEW' : 'Precio inventado de catálogo · PREVIEW') + '</p>' + (result.priceAdjustment ? '<p class="solid-wood-f-exception"><strong>Ajustado por Account · ESTIMATED</strong><br>Motivo: ' + esc(result.priceAdjustment.reason) + '<br>Actor de simulación: ' + esc(result.priceAdjustment.actor) + '</p>' : '');
    const articleTotals = '<p class="meta">' + esc(solidWoodNumber(result.articleQuantity)) + ' unidad(es) comerciales · resultado derivado una sola vez por el motor.</p>' + measurements(result.articleMeasurements, result.articleP1WoodRequirement, result.articleP1WoodWithWaste) + '<div class="wood-editor-cost wood-unit-article-cost"><small>Costo madera — ' + esc(name) + ' · total del Artículo · preview' + (isReference ? ' · moneda sin acreditar' : ' MXN') + '</small><strong>' + solidWoodMoney(result.articleCosts.woodCost) + '</strong><small>' + esc(price.quality) + ' · Los procesos pendientes no forman un costo confirmado.</small></div>';
    const woodTechnical = solidWoodLayoutBlocks(id, component, result).layoutTechnical + '<p class="meta">' + (isReference ? 'Precarga local de la variante de referencia; precio documental sin vigencia, moneda o impuestos acreditados. ' : 'Precios, recetas y procedencia de esta demo son sintéticos. ') + 'P1 conserva su unidad provisional; no es una tarifa por pie cúbico físico acreditada. CNC sin tarifa, primer y acabado final permanecen pendientes o diferidos.</p>';
    const blocks = { unitMeasurements, unitCost, unitPriceInfo, articleTotals, woodTechnical };
    return isReference ? Object.fromEntries(Object.entries(blocks).map(([key, value]) => [key, referenceText(value)])) : blocks;
  }
  function live(key, blocks, classes = '') { return '<div' + (classes ? ' class="' + classes + '"' : '') + ' data-solid-live="' + key + '" aria-live="polite">' + blocks[key] + '</div>'; }
  function group(key, title, body) { return '<section class="wood-editor-group" data-editor-group="' + key + '">' + (title ? '<h6>' + title + '</h6>' : '') + body + '</section>'; }
  function referenceText(html) {
    // Presentation on documentary recipes only; the synthetic commercial engine
    // still uses its own MXN contract. Target native markup exactly so input
    // values, names and textarea contents retain the user's original words.
    const labels = [
      ['Costo de madera · preview MXN', 'Costo de madera · preview · moneda sin acreditar'],
      ['Costo de madera aplicado · preview MXN', 'Costo de madera aplicado · preview · moneda sin acreditar'],
      ['Costo de madera de esta pieza · total del Artículo · preview MXN', 'Costo de madera de esta pieza · total del Artículo · preview · moneda sin acreditar'],
      ['Costo de madera del componente · total del Artículo · preview MXN', 'Costo de madera del componente · total del Artículo · preview · moneda sin acreditar'],
      ['Costo de línea · sin IVA', 'Costo de línea · referencia no acreditada'],
      ['Costo de línea · sin IVA · preview', 'Costo de línea · referencia no acreditada · preview'],
      ['Precio Administración · DEMO', 'Precio de referencia local'],
      ['Administración UAT · DEMO · no es un catálogo real', 'Referencia local · moneda, impuestos y vigencia sin acreditar'],
    ];
    for (const [before, after] of labels) html = html.replaceAll('<small>' + before + '</small>', '<small>' + after + '</small>');
    return html.replaceAll('title="Total del componente en este artículo, sin IVA, MXN; preview no confirmado."', 'title="Total del componente en este artículo, moneda e impuestos sin acreditar; preview no confirmado."')
      .replaceAll('<p class="meta">Preview · precio DEMO. La unidad P1 sigue pendiente de validación Duco.</p>', '<p class="meta">Preview · precio documental. La unidad P1 sigue pendiente de validación Duco.</p>')
      .replace(/(<label\b[^>]*>)Precio aplicado · unidad P1 provisional · MXN(<\/label>)/g, '$1Precio aplicado · unidad P1 provisional · moneda sin acreditar$2');
  }

  solidWoodEditorReferenceHtml = function () {
    const html = nativeWoodEditor();
    if (app.solidWoodUatConfig?.editorPresentation !== 'ORDERED_CAPTURE' || solidWoodEditorLayout() === 'CURRENT') return html;
    const draft = app.breakdownEditor, component = draft.solidWoodF, result = solidWoodResult(draft.itemId, component), blocks = unitBlocks(draft.itemId, component, result);
    const groups = new Map(), regions = [];
    for (const match of html.matchAll(/<section class="wood-editor-group" data-editor-group="([^"]+)">/g)) {
      if (groups.has(match[1])) throw Error('Duplicate recipe presentation region');
      const region = articleStudyElement(html, match.index, 'section'); groups.set(match[1], region.html); regions.push(region);
    }
    const expected = ['identity', 'material', 'dimensions', 'exceptions', 'cnc', 'price', 'result', 'pending', 'technical'];
    if (groups.size !== expected.length || expected.some(key => !groups.has(key))) throw Error('Recipe presentation contract changed');
    const exceptions = groups.get('exceptions'), priceAt = exceptions.indexOf('data-solid-field="adjustment.price"'), gridAt = exceptions.lastIndexOf('<div class="tech-form-grid">', priceAt);
    if (priceAt < 0 || gridAt < 0) throw Error('Recipe price controls missing');
    const grid = articleStudyElement(exceptions, gridAt, 'div');
    if (!grid.html.includes('data-solid-field="adjustment.reason"') || [...grid.html.matchAll(/data-solid-field=/g)].length !== 2) throw Error('Recipe price controls changed');
    groups.set('exceptions', exceptions.slice(0, gridAt) + exceptions.slice(grid.end));
    const priceValue = component.adjustment?.price ?? (result.priceResolution.appliedPrice === null ? '' : result.priceResolution.appliedPrice.toFixed(2));
    groups.set('unit', group('unit', 'Unitario', '<p class="meta">Una unidad del Artículo.</p>' + live('unitMeasurements', blocks)));
    groups.set('price', group('price', 'Precio material', '<div class="tech-form-grid wood-unit-price-grid">' + solidWoodField('adjustment.price', 'Precio material', priceValue, { money: true }) + live('unitCost', blocks, 'wood-unit-cost') + '</div>' + solidWoodField('adjustment.reason', 'Motivo del ajuste · obligatorio si cambia el precio', component.adjustment?.reason ?? '') + live('unitPriceInfo', blocks)));
    const resultHtml = groups.get('result'), processAt = resultHtml.indexOf('<details ');
    if (processAt < 0) throw Error('Recipe process consultation missing');
    const processes = articleStudyElement(resultHtml, processAt, 'details').html;
    if (!processes.includes('data-solid-live="layoutProcesses"')) throw Error('Recipe process consultation changed');
    groups.set('result', group('result', 'Total del Artículo', live('articleTotals', blocks) + processes));
    const technical = groups.get('technical'), at = technical.indexOf('data-solid-live="layoutTechnical"'), start = technical.lastIndexOf('<div', at);
    if (at < 0 || start < 0) throw Error('Recipe technical consultation missing');
    const region = articleStudyElement(technical, start, 'div');
    groups.set('technical', technical.slice(0, start) + live('woodTechnical', blocks) + technical.slice(region.end));
    const prefix = html.slice(0, regions[0].start).replace('wood-editor-ordered"', 'wood-editor-ordered wood-unit-pricing"');
    const output = prefix + ['identity', 'material', 'dimensions', 'unit', 'price', 'exceptions', 'cnc', 'result', 'pending', 'technical'].map(key => groups.get(key)).join('') + html.slice(regions.at(-1).end);
    return component.recipeSource === 'LOCAL_REFERENCE_D91' ? referenceText(output) : output;
  };
  solidWoodRefresh = function () {
    nativeWoodRefresh();
    const draft = app.breakdownEditor;
    if (!draft?.solidWoodF || !partSameContext(draft.context)) return;
    const blocks = unitBlocks(draft.itemId, draft.solidWoodF, solidWoodResult(draft.itemId, draft.solidWoodF));
    quoteRoot.querySelectorAll('[data-solid-live]').forEach(node => {
      if (Object.hasOwn(blocks, node.dataset.solidLive)) node.innerHTML = blocks[node.dataset.solidLive];
      else if (draft.solidWoodF.recipeSource === 'LOCAL_REFERENCE_D91') node.innerHTML = referenceText(node.innerHTML);
    });
    const field = quoteRoot.querySelector('[data-solid-field="adjustment.price"]');
    if (field && document.activeElement !== field && !draft.solidWoodF.adjustment) {
      const price = solidWoodResult(draft.itemId, draft.solidWoodF).priceResolution.appliedPrice;
      field.value = formatMoneyDisplay(price === null ? '' : price.toFixed(2));
    }
  };
  solidWoodSet = function (key, value) {
    const draft = app.breakdownEditor;
    if (!window.DemoQuote?.canEdit(app.q?.id)) return false;
    if (draft?.solidWoodF && !draft.solidWoodF.adjustment && editable() && !app.busy && !app.operation && partSameContext(draft.context)) {
      const base = solidWoodResult(draft.itemId, draft.solidWoodF).priceResolution.basePrice;
      if (key === 'adjustment.reason' && String(value).trim() && base !== null && !nativeWoodSet('adjustment.price', base.toFixed(2))) return false;
      if (key === 'adjustment.price' && base !== null) {
        try { if (D.decimal(moneyInputValue(String(value)), 2) === D.decimal(base.toFixed(2), 2)) { solidWoodRefresh(); return true; } }
        catch (_) { /* Native capture retains invalid values and their pending status. */ }
      }
    }
    return nativeWoodSet(key, value);
  };

  function quantity(value, unit) { try { const parsed = D.decimal(value, 3); return parsed === null ? 'Pendiente' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(parsed / 1000) + ' ' + (String(unit ?? '').trim() || '· unidad pendiente'); } catch (_) { return 'Pendiente'; } }
  function unitPrice(value) { try { const parsed = D.decimal(value, 2); return parsed === null ? 'Pendiente' : QuotePdf.money(parsed); } catch (_) { return 'Pendiente'; } }
  function cardPresentation(html, value, process = false, isReference = false) {
    const at = html.indexOf('<div class="article-panel-record-info">');
    if (at < 0) throw Error('Recipe component card changed');
    const region = articleStudyElement(html, at, 'div'), title = String(value.specification ?? '').trim() || value.name || value.category || 'Renglón sin nombre';
    const firstStrong = /<strong>[\s\S]*?<\/strong>/.exec(region.html);
    if (!firstStrong) throw Error('Recipe component title missing');
    const included = process && value.source?.kind === 'included', tariff = process && value.source?.kind === 'tariff';
    const line = included ? 'Servicio incluido en un componente comprado; no se suma de nuevo.' : tariff ? 'Tarifa versionada · precio de servicio pendiente de catálogo.' : [(process ? 'Cantidad de servicio: ' : 'Cantidad de compra: ') + quantity(process ? value.quantity : value.purchaseQuantity, process ? value.unit : value.purchaseUnit), process ? value.quantityScope === 'product' ? 'Por unidad del Artículo' : value.quantityScope === 'quote' ? 'Total del Artículo' : 'Alcance pendiente' : '', (isReference ? 'Precio unitario de referencia: ' : 'Precio unitario sin IVA: ') + unitPrice(process ? value.detail?.unitPrice : value.unitPrice), isReference ? 'Moneda e impuestos sin acreditar' : ''].filter(Boolean).join(' · ');
    const replacement = region.html.replace(firstStrong[0], '<strong>' + esc(title) + '</strong><small class="recipe-line-economics">' + esc(line) + '</small>');
    const output = html.slice(0, region.start) + replacement + html.slice(region.end);
    return isReference ? referenceText(output) : output;
  }
  function referenceFor(item) {
    const meta = recipeEntry(item.id), recipe = meta && DemoRecipeCatalog.recipe(meta.recipeId);
    const documentary = recipe?.documentary;
    return documentary?.basis === 'ONE_ARTICLE' && documentary.currency === 'UNVERIFIED' && documentary.financialConfirmed === false ? documentary : null;
  }
  function referencePurchasePresentation(html) {
    const draft = app.breakdownEditor;
    if (!draft?.itemId || !referenceFor({id:draft.itemId})) return html;
    // Replace only native labels/readouts. Editable textarea/input values can
    // contain the same words and must retain the user's exact content.
    return html.replace(/(<label\b[^>]*>)Precio unitario sin IVA · MXN(<\/label>)/g, '$1Precio unitario de referencia · moneda e IVA sin acreditar$2')
      .replaceAll('aria-label="Subtotal de línea · sin IVA"', 'aria-label="Subtotal de referencia · moneda e IVA sin acreditar"')
      .replaceAll('<span>Subtotal de línea · sin IVA</span>', '<span>Subtotal de referencia · moneda e IVA sin acreditar</span>');
  }
  breakdownSupplyEditor = function (material) { return referencePurchasePresentation(nativeSupplyEditor(material)); };
  breakdownPurchaseFields = function (material) { return referencePurchasePresentation(nativePurchaseFields(material)); };
  breakdownFooter = function (label, options) {
    const html = nativeBreakdownFooter(label, options);
    return ['purchase', 'component'].includes(app.breakdownEditor?.kind) ? referencePurchasePresentation(html) : html;
  };
  articlePanelMaterialCard = function (item, row, material, measurement) { const html = nativeMaterialCard(item, row, material, measurement); return material.section === 'supplies' ? cardPresentation(html, material, false, !!referenceFor(item)) : html; };
  articlePanelProcessCard = function (item, process, costs) { const html = nativeProcessCard(item, process, costs); return process.section === 'maquilas' ? cardPresentation(html, process, true, !!referenceFor(item)) : html; };

  function referenceAmount(value) {
    if (value === null || value === undefined || value === '') return 'Pendiente';
    const parsed = recipeSourceSubtotal([{quantity:'1',unitPrice:'1',totalSaved:value}]);
    if (parsed.knownCount !== 1) return 'Pendiente';
    return referenceCents(parsed.cents);
  }
  function referenceCents(cents) {
    return String(BigInt(cents) / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + String(BigInt(cents) % 100n).padStart(2, '0');
  }
  function recipeSourceSubtotalHtml(title, rows) {
    const subtotal = recipeSourceSubtotal(rows), cents = subtotal.cents;
    const label = subtotal.status === 'PARTIAL' ? cents === null ? 'Subtotal documental pendiente' : 'Subtotal documental conocido' : 'Subtotal documental';
    const note = subtotal.status === 'NO_ROWS' ? 'Sin renglones documentados' : subtotal.pendingCount
      ? subtotal.pendingCount + ' renglón(es) pendiente(s) de cantidad, precio o importe; no es un subtotal completo.'
      : 'Referencia histórica de una unidad del Artículo; no es un cargo adicional.';
    return '<tfoot class="recipe-documentary-subtotal" data-recipe-subtotal="' + esc(title) + '" data-reference-status="' + subtotal.status + '"><tr><th scope="row" colspan="4">' + esc(label) + '<small>' + esc(note) + '</small></th><td>' + (subtotal.status === 'NO_ROWS' ? '—' : cents === null ? 'Pendiente' : esc(referenceCents(cents))) + '</td></tr></tfoot>';
  }
  function recipeSourceCostsHtml(item) {
    const documentary = referenceFor(item);
    if (!documentary) return '';
    const units = {PZA:'pza',L:'L',FRACTIONAL_PZA_CONSUMPTION:'pza · consumo fraccionario',P1_WOOD_UNIT_PENDING_DUCO:'magnitud madera de referencia',ML:'m lineales',DAY:'día',HOUR:'hora',M2:'m²',M2_FINISH:'m² de acabado'};
    const priceUnits = {SOURCE_MONEY_PER_PZA:'pza',SOURCE_MONEY_PER_L:'L',SOURCE_MONEY_PER_PZA_CONSUMPTION:'pza de consumo',SOURCE_MONEY_PER_P1_WOOD_UNIT_PENDING_DUCO:'magnitud madera de referencia',SOURCE_MONEY_PER_MINUTE:'minuto',SOURCE_MONEY_PER_DAY:'día',SOURCE_MONEY_PER_HOUR:'hora',SOURCE_MONEY_PER_M2:'m²',SOURCE_MONEY_PER_M2_FINISH:'m² de acabado'};
    const quantity = value => value === null || value === undefined || value === '' ? 'Pendiente' : String(value);
    const table = section => '<h6>' + esc(section.title) + '</h6><div class="recipe-economics-table"><table><caption>Referencia de una unidad del Artículo · no es una compra adicional</caption><thead><tr><th>Concepto</th><th>Cantidad</th><th>Unidad</th><th>Precio fuente</th><th>Importe de referencia</th></tr></thead><tbody>' + section.rows.map(row => {
      const priced = referenceAmount(row.unitPrice), complete = recipeSourceSubtotal([row]).knownCount === 1;
      return '<tr><th scope="row">' + esc(row.name) + '</th><td>' + esc(quantity(row.quantity)) + '</td><td>' + esc(units[row.quantityUnit] || row.quantityUnit || 'Pendiente') + '</td><td>' + esc(priced + (priced === 'Pendiente' ? '' : ' / ' + (priceUnits[row.priceUnit] || row.priceUnit || 'unidad pendiente'))) + '</td><td>' + esc(complete ? referenceAmount(row.totalSaved) : 'Pendiente') + '</td></tr>';
    }).join('') + '</tbody>' + recipeSourceSubtotalHtml(section.title, section.rows) + '</table></div>';
    const cnc = documentary.sections.flatMap(section => section.rows).find(row => row.kind === 'CNC');
    const cncNote = cnc ? 'Referencia CNC: ' + quantity(cnc.quantity) + ' m × ' + quantity(documentary.cncMinutesPerMeter) + ' min/m × ' + referenceAmount(cnc.unitPrice) + ' por minuto. Sin activar esta tarifa. ' : '';
    return '<details class="recipe-economics-reference"><summary>Costos documentados de la receta</summary><p class="meta">Datos de referencia por una unidad del Artículo, conservados para revisar la precarga. No cambian al editar las medidas: no son consumos actuales recalculados ni nuevos cargos. Vigencia, moneda e impuestos de origen pendientes de acreditación.</p>' + documentary.sections.map(table).join('') + '<p class="meta">' + esc(cncNote) + 'La longitud CNC y su precio por minuto son magnitudes distintas. CNC y procesos sin tarifa validada siguen pendientes; una celda vacía no significa costo cero. Primer y acabado final permanecen diferidos.</p></details>';
  }
  solidWoodFamilyHtml = function (item, row, fold) {
    const html = nativeWoodFamily(item, row, fold), extra = recipeSourceCostsHtml(item);
    if (!extra) return html;
    const at = html.indexOf('<output class="solid-wood-f-total"');
    if (at < 0) throw Error('Documentary recipe cost disclosure placement changed');
    return referenceText(html.slice(0, at) + extra + html.slice(at));
  };
  return {recipeSourceSubtotal, recipeSourceCostsHtml, breakdownSupplyEditor, breakdownPurchaseFields};
}

export function extendRecipePresentation(source) {
  const marker = 'globalThis.__client = {';
  if (source.includes('/* SYNTHETIC_RECIPE_PRESENTATION */')) throw new Error('Recipe presentation already installed.');
  if (source.split(marker).length !== 2) throw new Error('Expected one public client export for recipe presentation.');
  const woodApply = '>Aplicar pieza F</button>';
  if (source.split(woodApply).length !== 3) throw new Error('Expected both native wood editor apply labels.');
  source = source.replaceAll(woodApply, '>Aplicar</button>');
  const installation = '/* SYNTHETIC_RECIPE_PRESENTATION */\nconst recipePresentation = (' + installRecipePresentation.toString() + ')((' + recipeSourceSubtotal.toString() + '));\n';
  return source.replace(marker, installation + marker + 'recipeSourceSubtotal:recipePresentation.recipeSourceSubtotal,recipeSourceCostsHtml:recipePresentation.recipeSourceCostsHtml,breakdownSupplyEditor:recipePresentation.breakdownSupplyEditor,breakdownPurchaseFields:recipePresentation.breakdownPurchaseFields,');
}
