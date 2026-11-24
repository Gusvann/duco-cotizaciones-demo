// Apply the current quotation workflow to the frozen client at build time.
// These projections work on copies. They retain historical evidence and never
// turn an estimated recipe price into a confirmed purchase or invent its VAT.
function quoteEconomics() {
  const present = value => value !== undefined && value !== null && value !== '';
  function capturedRows(quote) {
    if (quote.contract !== QuoteSchema.contract) return quote;
    const costs = (quote.costs || []).map(cost => {
      if (!['Pendiente', 'Estimado con sustento', 'Confirmado'].includes(cost.status) ||
          QuoteManufacturing_.generated(cost.id) || !present(cost.netAmount ?? cost.amount)) return cost;
      const requiresSupplierBasis = cost.external && cost.providerMode === 'Por definir';
      return {...cost, status: cost.status === 'Pendiente' ? 'Estimado con sustento' : cost.status,
        basis: cost.basis || (requiresSupplierBasis ? '' : 'Importe capturado en la cotización.')};
    });
    const resources = (quote.resources || []).map(resource => {
      if (!['Pendiente', 'Estimado con sustento'].includes(resource.status) ||
          resource.rateStatus !== 'Validada' || !present(resource.rate)) return resource;
      return {...resource, status: 'Estimado con sustento',
        basis: resource.basis || 'Tiempo capturado y tarifa del perfil asignado.'};
    });
    return {...quote, costs, resources};
  }
  // Called only on the normalized manufacturing model used for evaluation.
  function manufacturing(model) {
    function estimate(source, value, provenance) {
      if (!present(value)) return;
      if (source.quality !== 'confirmed') source.quality = 'estimated';
      if (!source.basis) source.basis = provenance;
    }
    for (const row of model.items) {
      for (const material of row.materials) {
        if (!present(material.unitPrice)) continue;
        material.economicReviewed = true;
        if (material.purchaseQuality !== 'confirmed') material.purchaseQuality = 'estimated';
        if (!material.basis) material.basis = 'Precio unitario de la partida de compra.';
      }
      for (const process of row.processes) {
        const source = process.source;
        if (source.kind === 'manual') {
          estimate(source, source.netAmount, 'Importe capturado para la operación.');
          source.reviewed = present(source.netAmount);
        } else if (source.kind === 'included') source.reviewed = Boolean(source.includedInMaterialId);
        else source.reviewed = Boolean(process.tariffId && process.tariffRevision);
      }
    }
    if (model.packaging.method === 'fixed') estimate(model.packaging, model.packaging.netAmount, 'Importe fijo de empaque.');
    for (const percentage of model.generalPercentages) {
      if (percentage.method === 'percent') estimate(percentage, percentage.rate, 'Porcentaje del costo de fabricación del ámbito.');
    }
    return model;
  }
  return {capturedRows, manufacturing};
}

function replaceOnce(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw Error('Cambió la integración de costos: ' + anchor.slice(0, 95));
  return source.replace(anchor, () => replacement);
}

export function transformEconomicDefaults(source) {
  const replace = (anchor, replacement) => { source = replaceOnce(source, anchor, replacement); };
  replace('var QuoteDomain =', 'var QuoteEconomics = (' + quoteEconomics.toString() + ')();\nvar QuoteDomain =');
  // Keep immutable archived costs and scope fingerprints based on the captured
  // contract. Only the live evaluation uses the derived economic status.
  replace("    let componentsComplete=!workBad.size;\n    q.costs.forEach((c,i)=>{",
    "    let componentsComplete=!workBad.size;\n    const economicRows=QuoteEconomics.capturedRows(q);\n    economicRows.costs.forEach((c,i)=>{");
  replace("    const labors=q.resources.map(labor);\n    q.resources.forEach((r,i)=>{",
    "    const labors=economicRows.resources.map(labor);\n    economicRows.resources.forEach((r,i)=>{");
  replace('    const model=normalizeV2(q.manufacturing,q),date=', '    q=QuoteEconomics.capturedRows(q);\n    const model=QuoteEconomics.manufacturing(normalizeV2(q.manufacturing,q)),date=');
  replace("!origin?'workId':c.status==='Pendiente'?'status':c.amount===''?'netAmount'", "!origin?'workId':c.amount===''?'netAmount'");
  replace("c.external?'providerMode':'status';", "c.external?'providerMode':'netAmount';");
  replace("!r.people?'people':r.mode==='Jornadas'?(!r.days?'days':!r.hoursPerDay?'hoursPerDay':!rateValid?'rate':r.status==='Estimado con sustento'&&!r.basis?'basis':'status'):\n          !r.hours?'hours':!rateValid?'rate':r.status==='Estimado con sustento'&&!r.basis?'basis':'status';",
    "!r.people?'people':r.mode==='Jornadas'&&!r.days?'days':r.mode==='Jornadas'&&!r.hoursPerDay?'hoursPerDay':r.mode!=='Jornadas'&&!r.hours?'hours':!rateValid||r.rateStatus!=='Validada'?'rate':'basis';");
  replace("status:'la calidad',external:", "status:'la aplicabilidad',external:");
  replace("let complete=!!m.name&&!!quantity&&!!commercial&&!d.pending&&!!m.unit&&!(m.type==='metal'&&!m.metalForm);",
    "const hasPhysicalQuantity=quantity>0||(m.type==='consumable'&&m.quantity==='');\n        let complete=!!m.name&&hasPhysicalQuantity&&!!commercial&&!d.pending&&!!m.unit&&!(m.type==='metal'&&!m.metalForm);");
  replace("if(!complete)issue('manufacturing.items.materials','Revisa la compra, calidad, precio vigente y sustento; no se infiere compra desde la geometría.',item.id,m.id);",
    `const field=!(quantity>0)?['purchaseQuantity','Indica la cantidad de compra']:!m.purchaseUnit?['purchaseUnit','Elige la unidad de compra']:price===null?['unitPrice','Indica el precio unitario']:m.taxRate===''?['taxRate','Indica el IVA de compra']:m.validUntil&&m.validUntil<date?['validUntil','Actualiza la vigencia del precio']:null;
        if(field)issue('manufacturing.items.materials.'+field[0],field[1]+' de '+(m.name||'la pieza')+'.',item.id,m.id);`);
  replace("if(!technical||!source.reviewed||!materialReady.get(source.includedInMaterialId))issue('manufacturing.items.processes','Confirma el ámbito y componente comprado que incluye este proceso.',item.id,p.id);",
    `if(!technical)issue('manufacturing.items.processes','Completa el proceso y las piezas a las que aplica.',item.id,p.id);
          if(!source.includedInMaterialId)issue('manufacturing.items.processes.source.includedInMaterialId','Selecciona la compra que incluye '+(p.name||'el proceso')+'.',item.id,p.id);`);
  replace("if(!complete)issue('manufacturing.items.processes','Confirma ámbito, datos técnicos y una fuente económica revisada y vigente.',item.id,p.id);",
    `if(!complete){
          const name=p.name||'el proceso';
          const field=!technical?['','Completa los datos y el ámbito de '+name]:source.kind==='manual'?
            (net===null?['.source.netAmount','Indica el importe de '+name]:['.source.taxRate','Indica el IVA de '+name]):
            !dec(p.quantity)?['.quantity','Indica la cantidad de '+name]:['.tariffId','Selecciona una tarifa vigente para '+name];
          issue('manufacturing.items.processes'+field[0],field[1]+'.',item.id,p.id);
        }`);
  replace('Completa importe neto, impuesto, calidad y sustento del empaque fijo.', 'Completa el importe neto y el IVA del empaque fijo.');
  replace('Porcentaje pendiente: completa la fabricación del ámbito, tasa, calidad y sustento.', 'Completa el porcentaje y el IVA aplicables al costo general.');
  replace('  function breakdownField(key,label,value,options={}){',
    "  function breakdownField(key,label,value,options={}){\n    if (['purchaseQuality','source.quality','quality','economicReviewed','source.reviewed'].includes(key)) return '';");
  replace('return group+tech+purchase;', "return group+tech+purchase+(material.validUntil&&scopeEconomics('Fabricación')?breakdownField('validUntil','Vigencia del precio',material.validUntil,{max:10}):'');");
  replace("+shared\n      +(draft.needsEconomicReview?", "+shared\n      +(material.validUntil&&economics?breakdownField('validUntil','Vigencia del precio',material.validUntil,{max:10}):'')\n      +(draft.needsEconomicReview?");
  for (const collection of ['costs','resources']) {
    const selector = 'field(`' + collection + '.${i}.status`,\'Calidad del dato\',{options:qualityOptions(r.status),dynamic:true})+';
    replace(collection === 'costs' ? '      ' + selector + '\n' : selector, '');
  }
  replace('Resuelve la responsabilidad del concepto para dejar de usar “No aplica” como calidad.', 'Su aplicabilidad se gestiona en el alcance de la cotización.');
  replace("label:options.preview?'Costo preview':options.reviewed?'Costo capturado':'Costo por validar'", "label:options.preview||!options.reviewed?'Costo estimado':'Costo capturado'");
  replace("'Hay importe capturado; su validación sigue pendiente.'", "'Estimación con el importe de este renglón.'");
  replace("includedPending:!linked||!p.source.reviewed", "includedPending:!linked");
  return source;
}
