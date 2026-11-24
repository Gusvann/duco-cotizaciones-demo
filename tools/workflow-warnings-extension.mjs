// Adapt the session client and its evaluator while preserving the frozen HTML source.
function once(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Workflow warning anchor changed: ' + before.slice(0, 90));
  return source.replace(before, () => after);
}

// Uses the same fixed-point parser as the monetary allocator. The distribution
// can be checked before a sales price exists.
function paymentDistribution(q) {
  const shares = [];
  for (const [i, row] of q.payments.entries()) {
    try {
      const points = decimal(row.percent, 2, 100, 'payments.' + i + '.percent');
      if (points === 0) return {shares, points: null, index: i, message: 'El porcentaje del hito debe ser mayor que cero.'};
      shares.push(points);
    } catch (error) {
      if (error.code !== 'VALIDATION') throw error;
      return {shares, points: null, index: i, message: 'Indica un porcentaje válido de hasta 100 % con hasta dos decimales.'};
    }
  }
  const missing = shares.indexOf(null);
  const points = sum(shares.filter(value => value !== null));
  if (!shares.length) return {shares, points, index: -1, message: 'Agrega un hito de pago.'};
  if (missing >= 0) return {shares, points, index: missing, message: 'Completa el porcentaje del hito de pago.'};
  const difference = 10000 - points;
  const percent = (Math.abs(difference) / 100).toLocaleString('es-MX');
  const message = difference > 0 ? 'Falta distribuir ' + percent + ' %.'
    : difference < 0 ? 'El reparto supera el 100 % por ' + percent + ' puntos.' : '';
  return {shares, points, index: 0, message};
}

function workflowReport() {
  if (globalThis.DemoQuote && app.q.id) return DemoQuote.summary(app.q.id);
  return {
    workflowIssues: DemoQuoteIssues.collect(app.q, financialEvaluation(), {
      inputErrors: app.inputErrors.values(), scopeState: app.scopeUatState
    }),
    saveBlockers: []
  };
}

function workflowIssueList(issues) {
  if (!issues.length) return '';
  const labels = ['Cliente y solicitud', 'Artículos', 'Costos generales', 'Precio', 'Revisión'];
  return labels.map((label, step) => {
    const group = issues.filter(issue => issue.step === step);
    if (!group.length) return '';
    return '<section class="workflow-issue-group"><h4>' + label + '</h4><ul class="pending-list">' +
      group.map(issue => {
        const item = app.q.items.find(row => row.id === issue.itemId);
        const title = item ? D.articleName(item) : '';
        const prefix = title && !issue.message.includes(title) ? esc(title) + ' · ' : '';
        return '<li><button type="button" data-action="goto-issue" data-target="' +
          esc(JSON.stringify(issue.target)) + '" data-code="' + esc(issue.code) + '">' +
          prefix + esc(issue.message) + '</button></li>';
      }).join('') + '</ul></section>';
  }).join('');
}

function review() {
  const report = workflowReport();
  const issues = report.workflowIssues.filter(issue => issue.severity !== 'info');
  const save = report.saveBlockers || [];
  app.displayedIssues = issues;
  const ready = !issues.length && !save.length && report.complete !== false;
  if (ready) telemetry.signal('READY');
  const saved = report.saveState ? report.saveState==='success' && !report.dirty : !app.dirty && !!app.q.id;
  const saving = report.saveState === 'pending' || report.saveState === 'unknown';
  const saveNote = save.length
    ? '<div class="note" role="status"><strong>Para guardar el borrador</strong><ul>' +
      save.map(message => '<li>' + esc(message) + '</li>').join('') + '</ul></div>'
    : saving ? '<p class="meta" role="status">Espera la confirmación del guardado para enviar a revisión.</p>'
    : !saved ? '<p class="meta">Guarda el borrador antes de enviarlo a revisión.</p>' : '';
  const list = issues.length
    ? '<h3>' + issues.length + (issues.length === 1 ? ' pendiente de captura' : ' pendientes de captura') + '</h3>' + workflowIssueList(issues)
    : '<p class="review-ready" role="status">' +
      (ready && saved ? 'Lista para revisión técnica.' : ready || save.length ? 'Los campos comerciales están completos.' : 'El cálculo de la cotización sigue pendiente.') + '</p>';
  return scopeTruth() + providerReview() + '<div class="workflow-review">' + list + '</div>' + saveNote +
    '<button class="primary" data-write data-action="send-review" ' + (!ready || !saved ? 'disabled' : '') + '>Enviar al diseñador</button>';
}

function workflowLocation(target, q) {
  const field = target.controlField;
  if (target.entity === 'quote' && ['scopeReview','scopeReview.scopes','scopeReview.declared'].includes(target.field)) {
    return {step: 2, selector: '[data-scope="GENERAL"]'};
  }
  if (target.topic && field) {
    const need = target.needId ? q.needs.find(row => row.id === target.needId) : generalNeed(target.topic);
    if (target.needId && !need) return null;
    const stage = scopeStageFor(target.topic);
    const location = {step: 2, generalUi: {topic: target.topic, needId: need?.id || ''}, generalField: field};
    if (scopeIncluded(stage) && ['resolution', 'reason', 'responsible', 'agreement'].includes(field)) {
      location.scopeField = ['reason', 'agreement'].includes(field) ? 'agreement' : 'responsible';
      location.scopeStageId = stage.id;
    }
    return location;
  }
  if (target.entity === 'manufacturing' && target.parentId) {
    const row = q.manufacturing?.items.find(item => item.itemId === target.parentId);
    if (!row) return null;
    const index = q.items.findIndex(item => item.id === row.itemId);
    if (!target.id && index >= 0 && !Number(q.items[index].quantity)) {
      return {step: 1, itemId:row.itemId, path:'items.' + index + '.quantity'};
    }
    const material = row.materials.find(m => m.id === target.id);
    const process = row.processes.find(p => p.id === target.id);
    const system = row.finishSystems?.find(s => s.id === target.id || s.layerIds.includes(target.id));
    const action = system ? 'edit-finish-system' : material ? 'edit-component' : process ? 'edit-process' : '';
    if (action) {
      let editableField = field || 'name';
      if (!field && material) {
        if (!material.name && material.section==='supplies') editableField='specification';
        else if (!Number(material.quantity)) editableField=material.section==='supplies'?'purchaseQuantity':'quantity';
        else if (!material.thickness && ['board','wood'].includes(material.type)) editableField='thickness';
        else if (material.measureSource==='own' && !material.length) editableField='length';
        else if (material.measureSource==='own' && !material.width) editableField='width';
      }
      if (field==='source.netAmount' && process?.section==='maquilas') editableField=Number(process.quantity)>0?'detail.unitPrice':'quantity';
      return {step: 1, itemId: row.itemId, component: {action, id: system?.id || target.id, fieldId: target.id, field:editableField}};
    }
    if (!target.id) return {step:1, itemId:row.itemId, selector:'#part-detail-'+CSS.escape(row.itemId)+' [data-break-action="add-detail-material"][data-section="supplies"]'};
  }
  if (target.entity === 'items' && ['materials','finishes'].includes(target.field)) {
    const i = q.items.findIndex(item => item.id === target.entityId);
    if (i >= 0) return {step: 1, itemId: target.entityId, path: 'items.' + i + '.' + target.field};
  }
  if (target.entity === 'quote' && ['included','excluded'].includes(target.field) && scopeEnabled()) {
    const direction = target.field === 'included' ? 'include' : 'exclude';
    return {step: 0, selector: '[data-scope-action="open"][data-scope-direction="' + direction + '"]'};
  }
  if (target.entity === 'needs' && ['conflict','links','component','confirm','description','detail'].includes(target.field)) {
    const need = q.needs.find(row => row.id === target.entityId);
    if (need) return {step: 2, needId: need.id, costGroupId: need.itemId || 'GENERAL', controlId: 'need-' + need.id};
  }
  return null;
}

function workflowControl(target) {
  if (target.component) {
    const {fieldId, field} = target.component;
    const name = CSS.escape(field);
    const editor=quoteRoot.querySelector('[data-row-editor="' + CSS.escape(fieldId) + '"]');
    return document.getElementById('break-' + fieldId + '-' + field.replaceAll('.', '-')) ||
      editor?.querySelector('[data-solid-field="' + name + '"], [data-break-field="' + name + '"]') ||
      editor?.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)');
  }
  if (target.scopeField) return quoteRoot.querySelector('.general-editor [data-scope-stage-id="' + CSS.escape(target.scopeStageId) + '"][data-scope-field="' + CSS.escape(target.scopeField) + '"]');
  if (target.generalField) {
    const editor=quoteRoot.querySelector('.general-editor');
    return editor?.querySelector('[data-general-field="' + CSS.escape(target.generalField) + '"]') ||
      editor?.querySelector('[data-scope-action="review-installation-scope"], [data-scope-field="responsible"]');
  }
  if (target.selector) return quoteRoot.querySelector(target.selector);
  return null;
}

export function extendWorkflowWarnings(source) {
  source = once(source, '  function paymentAmounts(q, t = totals(q)) {\n    const p = q.payments.map((r) => decimal(r.percent, 2, 100));\n    if (!t.completePrices || !p.length || p.includes(null) || sum(p) !== 10000) return null;',
    paymentDistribution.toString() + '\n  function paymentAmounts(q, t = totals(q)) {\n    const {shares: p, message} = paymentDistribution(q);\n    if (!t.completePrices || message) return null;');
  source = once(source, "if (!paymentAmounts(q)) add('payments', 'Los hitos de pago deben sumar exactamente 100%.');",
    "const distribution = paymentDistribution(q);\n    if (distribution.message) add(distribution.index < 0 ? 'payments' : 'payments.' + distribution.index + '.percent', distribution.message, {}, 'PAYMENT_DISTRIBUTION');");
  source = once(source, '    paymentAmounts,', '    paymentAmounts, paymentDistribution,');
  source = once(source, 'let totals={lines:[],allocation:{items:[]},net:null,tax:null,total:null};try{totals=financialTotals();}catch(_){}',
    `let totals={lines:[],allocation:{items:[]},net:null,tax:null,total:null};
    try {
      const evaluation=financialEvaluation();
      totals=evaluation.totals;
      app.issues=DemoQuoteIssues.collect(app.q,evaluation,{inputErrors:app.inputErrors.values(),scopeState:app.scopeUatState}).filter(issue=>issue.step===3&&issue.severity!=='info'&&issue.code!=='PAYMENT_DISTRIBUTION');
    } catch(error) { app.issues=[D.issue(app.q,error.field||'',error.message||'Revisa los importes.',{},error.code||'VALIDATION')]; }`);
  source = once(source, "const paymentSum=app.q.payments.reduce((sum,row)=>sum+(Number(row.percent)||0),0);",
    "const distribution=D.paymentDistribution(app.q),paymentSum=distribution.points/100;");
  source = once(source, "(Math.abs(paymentSum-100)<0.001?'good':'warn')", "(distribution.message?'warn':'good')");
  source = once(source, "paymentSum.toLocaleString('es-MX')+'% distribuido", "(distribution.message?esc(distribution.message):paymentSum.toLocaleString('es-MX')+' % distribuido')+'");

  const start = source.indexOf('  function review() {');
  const end = source.indexOf('  function design() {', start);
  if (start < 0 || end < 0) throw new Error('Native review view missing');
  const functions = [workflowReport, workflowIssueList, workflowLocation, workflowControl, review].map(fn => fn.toString()).join('\n');
  source = source.slice(0, start) + functions + '\n' + source.slice(end);
  source = once(source, '    const field = t.field, entity = t.entity;',
    '    const workflow=workflowLocation(t,q);if(workflow)return workflow;\n    const field = t.field, entity = t.entity;');
  source = once(source, '    app.issues=[...evaluateIssues(),...app.inputErrors.values()];',
    "    if(target.component)await breakdownAction({dataset:{breakAction:target.component.action,id:target.component.id}});\n    app.issues=[...evaluateIssues().filter(row=>row.step===target.step),...app.inputErrors.values()];");
  source = once(source, '    const target=resolveTarget(issue);', '    const target=resolveTarget(issue), navigationQuote=app.q;');
  source = once(source, '    let el=target.controlId?', '    if(app.q!==navigationQuote||app.step!==target.step||target.component&&app.openPartId!==target.itemId)return;\n    let el=target.controlId?');
  source = once(source, "    if(el) {\n      articleStudyReveal(el);", "    el=workflowControl(target)||el;\n    if(el) {\n      articleStudyReveal(el);");
  source = once(source, "const visibleConcepts=model.concepts.filter(concept=>!isPartEstimateNeedId(concept.needId)&&(concept.components.length>0",
    "const visibleConcepts=model.concepts.filter(concept=>!isPartEstimateNeedId(concept.needId)&&(concept.needId===app.openNeedId||concept.components.length>0");
  source = once(source, "(app.step>=4?scopeInstallationWarning():'')", "(app.step>4?scopeInstallationWarning():'')");
  source = once(source, '    const eligible=new Map((evaluation?.eligibleComponents||[]).map(c=>[c.id,c]));\n    const html=cards.map',
    "    const waiting=evaluation?DemoQuoteIssues.collect(app.q,evaluation,{scopeState:app.scopeUatState}).filter(issue=>issue.step===2&&issue.severity==='info'):[];\n    const eligible=new Map((evaluation?.eligibleComponents||[]).map(c=>[c.id,c]));\n    const html=cards.map");
  source = once(source, "scopeTruth()+costOverview()+'<div class=\"general-cards\">'",
    "scopeTruth()+costOverview()+waiting.map(issue=>'<p class=\"meta\">'+esc(issue.message)+'</p>').join('')+'<div class=\"general-cards\">'");
  source = once(source, "const productFields='<div class=\"part-core part-product-identity\">'",
    "const technicalSummary=QuoteManufacturing_.commercialSummary(q.manufacturing?.items.find(row=>row.itemId===r.id)||{});\n      const commercialFields=['materials','finishes'].filter(key=>!technicalSummary[key]).map(key=>field('items.'+i+'.'+key,key==='materials'?'Materiales':'Acabados',{max:500})).join('');\n      const productFields='<div class=\"part-core part-product-identity\">'");
  source = once(source, "field(`items.${i}.references`,'Detalles',{area:true,max:500})+'</div><div class=\"part-dimensions-row\">'",
    "field(`items.${i}.references`,'Detalles',{area:true,max:500})+commercialFields+'</div><div class=\"part-dimensions-row\">'");
  source = once(source, '        if(fromTab&&nextStep===app.step)return;',
    "        if(fromTab&&nextStep===app.step)return;\n        if(!fromTab&&app.step===0&&nextStep===1){\n          const missing=workflowReport().workflowIssues.filter(issue=>issue.step===0&&issue.severity!=='info');\n          if(missing.length){app.issues=missing;await navigateIssue(missing[0]);return;}\n        }");
  source = once(source, '      return evaluated.issues;\n    } catch (e) {\n      return [D.issue',
    "      return DemoQuoteIssues.collect(app.q,evaluated,{scopeState:app.scopeUatState}).filter(issue=>issue.severity!=='info');\n    } catch (e) {\n      return [D.issue");
  return source;
}
