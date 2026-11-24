/* User-facing causes for the current quote. Reads the domain evaluation without updating the draft. */
(function () {
  'use strict';
  const blank = value => value == null || value === '';
  function general(problem, topic, controlField, message, needId = '', severity = 'error') {
    return { ...problem, step:2, itemId:'', severity, message,
      target:{...problem.target, topic, needId, controlField, parentId:'', context:{...problem.target.context, itemId:''}},
      key:JSON.stringify(['general', topic, needId, controlField]) };
  }
  function stepOf(target) {
    if (target.entity === 'quote') {
      if (target.field?.startsWith('terms.')) return 3;
      if (target.field?.startsWith('scopeReview')) return 2;
      return 0;
    }
    if (target.entity === 'payments') return 3;
    if (target.entity === 'items') return ['unitPrice','discount','tax'].includes(target.field) ? 3 : 1;
    if (target.entity === 'specs' || target.entity === 'manufacturing' || /^CST_EST_|^NEC_EST_/.test(target.entityId)) return 1;
    return 2;
  }
  function manufacturing(q, problem) {
    const model = q.manufacturing;
    if (!model) return problem;
    const {field, target} = problem;
    const byTopic = topic => q.needs?.find(need => !need.itemId && need.topic === topic)?.id || '';
    if (field.startsWith('manufacturing.packaging')) {
      const pack = model.packaging || {method:'percent'};
      const entry = (control, message, severity) => general(problem, 'Empaque', control, message, byTopic('Empaque'), severity);
      if (pack.method === 'pending') return entry('method', 'Elige cómo se calculará el empaque.');
      if (pack.method === 'fixed') {
        if (blank(pack.netAmount)) return entry('netAmount', 'Captura el importe del empaque.');
        if (blank(pack.taxRate)) return entry('taxRate', 'Indica el IVA de compra del empaque.');
        return entry('basis', 'Indica la referencia del importe de empaque.');
      }
      if (blank(model.packagingRate)) return entry('rate', 'Captura el porcentaje de empaque.');
      if (blank(model.packagingVatRate)) return entry('taxRate', 'Indica el IVA del empaque.');
      return entry('base', 'Empaque · Se calcula al completar fabricación.', 'info');
    }
    if (field.startsWith('manufacturing.indirect')) {
      const entry = (control, message, severity) => general(problem, 'Indirectos', control, message, byTopic('Indirectos'), severity);
      if (model.indirectMethod === 'pending') return entry('resolution', 'Indica si el pedido lleva indirectos.');
      if (blank(model.indirectRate)) return entry('rate', 'Captura el porcentaje de indirectos.');
      return entry('base', 'Indirectos · Se calculan al completar los costos aplicables.', 'info');
    }
    if (field.startsWith('manufacturing.generalPercentages')) {
      const pct = model.generalPercentages?.find(row => row.id === target.id);
      const need = q.needs?.find(row => row.id === pct?.needId);
      if (!pct || !need) return problem;
      const name = need.description || need.topic;
      const entry = (control, message, severity) => ({...general(problem,need.topic,control,message,need.id,severity), itemId:pct.itemId||''});
      if (need.resolution === 'Pendiente') return entry('resolution','Define quién cubre '+name+'.');
      if (blank(pct.rate)) return entry('rate','Indica el porcentaje de '+name+'.');
      if (blank(pct.taxRate)) return entry('taxRate','Indica el IVA de '+name+'.');
      if (field.endsWith('.basis')) return entry('basis','Indica la referencia de '+name+'.');
      return entry('base',name+' · Se calcula al completar fabricación.','info');
    }
    if (field === 'manufacturing.transport') {
      const link = q.coverageLinks?.find(row => row.componentType === 'Costo' && row.componentId === target.id);
      return general(problem,'Transporte','transportType','Selecciona transporte local o foráneo.',link?.needId);
    }
    if (field.startsWith('manufacturing.installation')) return general(problem,'Instalación','installationReason','Indica el motivo de la entrega sin instalación.',byTopic('Instalación'));
    const match = /\.(materials|processes|finishSystems)\.(?!\d+(?:\.|$))(.+)$/.exec(field);
    if (match) return {...problem,target:{...target, controlField:match[2]}};
    return problem;
  }
  function collect(q, evaluation, options = {}) {
    if (!q) return [];
    const result = new Map();
    const raw = evaluation?.issues || [];
    const itemById = new Map(), nameCounts = new Map();
    for (const [index,item] of (q.items || []).entries()) {
      const name=(item.description || '').trim();
      itemById.set(item.id,{name,position:index+1});
      nameCounts.set(name,(nameCounts.get(name)||0)+1);
    }
    const causes = new Set();
    for (const problem of raw) {
      const sourceId = problem.target?.context?.sourceCostId;
      if (sourceId) causes.add(sourceId);
      if (['COST_INCOMPLETE','RESOURCE_INCOMPLETE','COMPONENT_UNLINKED'].includes(problem.code))
        causes.add(problem.target?.entityId);
    }
    function add(problem) {
      const target = problem.target || {entity:'quote',field:problem.field || ''};
      const owner = Array.isArray(q[target.entity]) ? q[target.entity].find(row => row.id === target.entityId) : null;
      const itemId = problem.itemId ?? (target.parentId || target.context?.itemId || owner?.itemId ||
        (target.entity === 'items' ? target.entityId : '') || '');
      const key = problem.key || JSON.stringify([target.entity,target.entityId||target.id||'',itemId,
        target.controlField||target.field||problem.field, target.context?.topic||'']);
      const entry = {...problem, target, key, step:problem.step ?? stepOf(target), itemId, severity:problem.severity || 'error'};
      const item = itemById.get(itemId);
      if (item) {
        const named = item.name && entry.message.includes('«'+item.name+'»');
        if (!named && item.name) entry.message = '«'+item.name+'» · '+entry.message;
        if (!item.name || nameCounts.get(item.name)>1) entry.message = 'Artículo '+item.position+' · '+entry.message;
      }
      result.set(key,entry);
    }
    const sourceIds = new Set(raw.filter(row=>row.code==='MANUFACTURING_PENDING').map(row=>row.target?.context?.sourceCostId).filter(Boolean));
    const pendingScope = raw.some(problem=>problem.code==='SCOPE_IMPACT');
    const conflict = installationConflict(q, options.scopeState);
    if (conflict) add(conflict);
    for (const problem of raw) {
      const target = problem.target || {};
      if (problem.code === 'COST_INCOMPLETE' && sourceIds.has(target.entityId)) continue;
      if (problem.code === 'MANUFACTURING_PENDING') {
        if (conflict && problem.field === 'manufacturing.installationReason') continue;
        add(manufacturing(q,problem));
      } else if (problem.code === 'NEED_UNRESOLVED') {
        const need = q.needs?.find(row=>row.id===target.entityId) || target.context || {};
        const description = need.description || need.topic || 'este concepto';
        const topic = need.topic, field = target.field;
        if (pendingScope && field === 'confirm') continue;
        if (field === 'component' && target.context?.components?.length &&
            target.context.components.every(component=>causes.has(component.id))) continue;
        if (conflict && topic === 'Instalación' && !need.itemId) continue;
        const messages = {
          description:'Nombra el concepto de '+(topic || 'alcance')+'.',
          resolution:'Define quién cubre '+description+'.',
          links:'Vincula el costo o recurso que cubre '+description+'.',
          conflict:'Resuelve los costos vinculados a '+description+' antes de excluirlo del costo de Duco.',
          reason:'Indica el acuerdo de '+description+'.',
          confirm:'Revisa el acuerdo de '+description+' por el cambio de alcance.',
          component:'Vincula un costo o recurso aplicable a '+description+'.'
        };
        const mapped={...problem, message:messages[field] || problem.message};
        if(!need.itemId && ['Empaque','Transporte','Instalación','Indirectos','Viáticos','Contingencias','ADICIONAL'].includes(topic)) {
          const control = {confirm:'resolution',conflict:'resolution',component:'netAmount',links:'netAmount',description:'name'}[field] || field;
          add(general(mapped,topic,control,mapped.message,need.id||target.entityId));
        } else add(mapped);
      } else add(problem);
    }
    // An invalid value at the same control takes precedence over its empty-field diagnosis.
    for (const problem of options.inputErrors || []) add(problem);
    return [...result.values()];
  }
  function installationConflict(q, scope) {
    if (!q.manufacturing || q.manufacturing.installation !== 'no') return null;
    const need=q.needs?.find(row=>!row.itemId && row.topic==='Instalación');
    const stage=Object.values(scope?.stages||{}).find(row=>row.scopeId==='SCOPE_INSTALLATION');
    const current=!scope?.context || (scope.context.id===q.id && scope.context.versionId===q.versionId);
    const included=current && !scope?.opaque && stage && !stage.inactive && scope.selection?.include?.includes(stage.scopeId);
    if (!included && need?.resolution !== 'Cubierta por Duco') return null;
    return general({code:'INSTALLATION_CONFLICT',field:'manufacturing.installation',target:{entity:'manufacturing',field:'manufacturing.installation'}},
      'Instalación','installation','El alcance incluye instalación y fabricación indica entrega sin instalación. Revisa cuál corresponde.',need?.id);
  }
  window.DemoQuoteIssues = Object.freeze({collect});
})();
