/* Synthetic demo adapter. Memory only; the unmodified domain calculates cents. */
(function () {
  'use strict';
  const c = window.__client;
  if (!c || !window.QuoteSchema || !window.QuoteManufacturing_) throw new Error('Cotizador no disponible.');
  const recipeCatalog = window.DemoRecipeCatalog;
  if (typeof recipeCatalog?.configure !== 'function') throw new Error('Catálogo sintético no disponible.');
  const phone = window.DemoPhone;
  if (typeof phone?.analyze !== 'function') throw new Error('Catálogo de teléfono no disponible.');
  const { app, D } = c, M = window.QuoteManufacturing_, S = window.QuoteSchema;
  function clone(value) {
    if (typeof value === 'function') return null; // DOM continuations belong to the currently open view.
    if (value == null || typeof value !== 'object') return value;
    if (value instanceof Map) return new Map([...value].map(([key, child]) => [key, clone(child)]));
    if (value instanceof Set) return new Set([...value].map(clone));
    if (Array.isArray(value)) return value.map(clone);
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  const entries = new Map(), listeners = new Set();
  let active = '', profile = 'account', queued = false, serial = 0;
  const uid = prefix => prefix + '-DEMO-' + (++serial);
  const HOST = () => document.getElementById('quote-host');
  const account = { email: 'account@example.test', name: 'Account de ejemplo', role: 'Account', state: 'Activo' };
  const designer = { email: 'designer@example.test', name: 'Diseño de ejemplo', role: 'Disenador', state: 'Activo' };
  const requestKeys = ['title', 'client', 'contact', 'location', 'contactPhone', 'contactEmail', 'need', 'included', 'excluded', 'account', 'designer', 'quoteDue', 'deliveryDate'];
  const user = () => clone(profile === 'designer' ? designer : account);
  const requestDefaults = { location: 'Espacio ficticio', contactPhone: '', contactEmail: 'contacto@example.test' };
  const normalizeRequest = input => phone.cleanHolder(Object.fromEntries(requestKeys.map(key => [key, typeof input?.[key] === 'string' ? input[key] : requestDefaults[key] || ''])));
  const initialApp = clone(app);

  function scopeConfig() {
    const definitions = [
      ['FABRICATION', 'Fabricación', 'INCLUDE', 'manufacturing'], ['PACKAGING', 'Empaque', 'INCLUDE', 'general'],
      ['TRANSPORT', 'Transporte', 'INCLUDE', 'general'], ['INSTALLATION', 'Instalación', 'INCLUDE', 'general'],
      ['CIVIL_WORK', 'Obra civil', 'EXCLUDE', 'commercial'], ['OTHER', 'Otro…', 'BOTH', 'commercial'],
    ];
    const processes = [['TURNING', 'Torneado', 'other'], ['CNC', 'CNC / Láser', 'cnc'], ['JOINTING', 'Tablerado', 'other'],
      ['CARPENTRY', 'Carpintería / armado', 'carpentry'], ['INTEGRATION', 'Integración', 'assembly'], ['METALWORK', 'Herrería', 'metalwork'],
      ['WEAVE', 'Tejido', 'weave'], ['MAQUILA', 'Maquila externa', 'maquila'], ['OTHER', 'Otro proceso', 'other']];
    return {
      version: 1,
      catalogs: {
        scope: definitions.map(([id, label, allowedDirection, category]) => ({ id: 'SCOPE_' + id, label, legacyText: label, allowedDirection, category, effect: category === 'commercial' ? 'neutral' : 'stage', active: true })),
        stages: definitions.slice(0, 4).map(([id, topic]) => ({ id: 'STAGE_' + id, scopeId: 'SCOPE_' + id, topic })),
        processes: processes.map(([id, label, type]) => ({ id: 'PROC_' + id, label, type, category: 'Fabricación', allowedScope: ['COMPONENT', 'GROUP', 'PRODUCT'], classification: id === 'OTHER' ? 'UNMAPPED_PROCESS' : 'MAPPED_PROCESS', active: true })),
      },
      seed: { includeIds: ['SCOPE_FABRICATION', 'SCOPE_PACKAGING'], excludeIds: ['SCOPE_CIVIL_WORK'], other: { include: '', exclude: '' },
        stages: definitions.slice(0, 4).map(([id]) => ({ id: 'STAGE_' + id, scopeId: 'SCOPE_' + id, responsible: id === 'FABRICATION' || id === 'PACKAGING' ? 'Duco' : 'Cliente', agreement: 'Entrega sin instalación ni transporte.' })) },
    };
  }

  function applyRequest(q, request) {
    q.name = request.title; q.client.name = request.client; q.contact = request.contact;
    for (const key of ['location', 'contactPhone', 'contactEmail', 'need', 'included', 'excluded', 'quoteDue', 'deliveryDate']) q[key] = request[key];
    // Display names never select roles; synthetic identities remain explicit.
    q.account = account.email; q.designer = designer.email;
  }

  function fixture(id, request) {
    let q = D.upgrade(D.blank(uid), uid);
    Object.assign(q, { id, versionId: id + '-V1', revision: 1, client: { id: 'CLI-' + id, name: '', status: 'Activo', requestId: '', requestName: '', requestReason: '' },
      location: 'Espacio ficticio', contactEmail: 'contacto@example.test', contactPhone: '', costs: [], resources: [], needs: [], coverageLinks: [], workUnits: [] });
    applyRequest(q, request);
    Object.assign(q.terms, { validDays: '15', leadDays: '20', leadEvent: 'Anticipo', notes: 'Condiciones de entrega y pago.' });
    const item = D.newItem(uid);
    Object.assign(item, { description: 'Consola modular', quantity: '2', unit: 'Pieza', materials: 'Componente comprado', finishes: 'Terminado de fábrica de ejemplo',
      deliverables: 'Dos módulos', unitPrice: '3000', discount: '0', tax: '16' });
    item.specs.forEach(spec => Object.assign(spec, { value: spec.type === 'Largo' ? '90' : spec.type === 'Ancho' ? '40' : '60', unit: 'cm' }));
    q.items = [item];
    for (const topic of S.generalRubros) q.needs.push(D.newNeed(uid, '', topic));
    for (const topic of [...S.itemRubros, 'Personal']) q.needs.push(D.newNeed(uid, item.id, topic));
    q.needs.forEach(need => Object.assign(need, { resolution: 'No requerida', reason: 'No forma parte de este alcance.' }));
    q.manufacturing = M.blank(q, uid);
    Object.assign(q.manufacturing, { packagingRate: '2', indirectRate: '10', indirectMethod: 'percent', installation: 'no', installationReason: 'Entrega sin instalación.', packaging: { method: 'percent', netAmount: '', taxRate: '16', quality: 'confirmed', basis: 'Porcentaje declarado', manualAntecedents: [] } });
    const row = q.manufacturing.items[0], groupId = uid('GRP');
    Object.assign(row, { technical: true, mode: 'detailed', groups: [{ id: groupId, type: 'consumable', woodKind: '', unit: 'pieza', lengthUnit: '', woodWasteRate: '', specification: 'Compra ficticia' }],
      materials: [{ id: uid('MAT'), groupId, type: 'consumable', section: 'supplies', name: 'Componente comprado de ejemplo', quantity: '1', unit: 'pieza', measureSource: 'own',
        length: '', width: '', lengthUnit: '', thickness: '', woodKind: '', category: 'Otros', specification: 'Componente terminado', purchaseQuantity: '2', purchaseUnit: 'pieza', unitPrice: '1000', taxRate: '16',
        basis: 'Importe declarado para dos componentes completos.', supplier: 'Proveedor de ejemplo', reference: 'REF-DEMO', economicReviewed: true, purchaseQuality: 'confirmed', detail: {} }],
      processes: [{ id: uid('PRC'), type: 'assembly', name: 'Integración', execution: 'external', providerId: 'PRV-DEMO', quantity: '', quantityScope: 'quote', tariffId: '', tariffRevision: '', tariff: null,
        rope: '', ropeQuantity: '', ropeUnit: '', materialId: '', specification: '', coats: '', target: { kind: 'product', groupId: '', componentIds: [] },
        source: { kind: 'manual', reviewed: true, netAmount: '500', taxRate: '16', quality: 'confirmed', basis: 'Importe total para el conjunto; se aplica una vez.', supplier: 'Proveedor de ejemplo', reference: 'REF-DEMO-PROCESO', includedInMaterialId: '' }, consumption: '', consumptionUnit: '' }], finishSystems: [] });
    q = M.apply(q);
    q.scopeReview.confirmations = q.needs.map(need => ({ needId: need.id, scopeHash: D.coverageFingerprint(q, need.id) }));
    q = D.prepareCoverage(q, null, { actor: account.email, now: '2026-10-14T12:00:00.000Z' }).quote;
    return D.sanitize(q);
  }

  function configure(state) {
    state.token = 'DEMO_MEMORY_ONLY'; state.user = user(); state.capability = { manufacturingReady: true, processCatalogReady: true };
    state.articleStudyVariant = 'panel'; state.panelInterior = 'current';
    state.scopeUatConfig = scopeConfig();
    // Request text is the source: opening the editor must not replace it with UAT seed text.
    state.scopeUatSeedUsed = true;
    state.solidWoodUatConfig = { version: 1, source: 'LOCAL_UAT', viewVariant: 'F_REFERENCE', unit: 'P1_WOOD_UNIT_PENDING_DUCO',
      prices: [{ species: 'Pino', price: '120', unit: 'P1_WOOD_UNIT_PENDING_DUCO', source: 'ADMIN_UAT', quality: 'PREVIEW' }],
      parameters: { source: 'DEMO', wasteRate: '30' }, recipes: [], editorLayout: 'RESULT_FIRST', editorPresentation: 'ORDERED_CAPTURE' };
    state.lineCatalog = { clients: [], users: [{ id: account.email, name: account.name, role: account.role, status: 'Activo' }, { id: designer.email, name: designer.name, role: designer.role, status: 'Activo' }], products: [], processTariffs: [] };
    state.lineImages = {}; state.solidWoodLocal = null; state.syntheticRecipes = { articles: {} };
    recipeCatalog.configure(state);
  }

  function context(state) { return { owner: state.user.email, token: state.token, epoch: state.epoch, quoteId: state.q.id, versionId: state.q.versionId, revision: state.q.revision }; }
  function seedWood(state) {
    const item = state.q.items[0];
    item.description = 'Objeto de muestra con madera pendiente';
    state.q.scopeReview.confirmations = state.q.needs.map(need => ({ needId: need.id, scopeHash: D.coverageFingerprint(state.q, need.id) }));
    state.q = D.prepareCoverage(state.q, null, { actor: account.email, now: '2026-10-14T12:00:00.000Z' }).quote;
    const component = { id: uid('F'), name: 'Pieza inventada', groupId: uid('GROUP'), woodKind: 'Pino', quantityPerProduct: '1', width: '36', length: '84', lengthUnit: 'cm', thickness: '1', wasteRate: '30', finishFaces: '2', jointed: '0', cnc: { decision: 'yes', length: '', unit: 'cm', repetitions: '' } };
    state.solidWoodLocal = { context: context(state), articles: new Map([[item.id, { applied: [component], draft: null }]]) };
  }

  function get(id) { const entry = entries.get(id); if (!entry) throw new Error('Expediente de demo inexistente.'); return entry; }
  function cleanStatePhone(state) {
    if (state?.q && typeof state.q.contactPhone === 'string') {
      const result = phone.analyze(state.q.contactPhone);
      if (result.removed) { state.q.contactPhone = result.value; state.phoneDraft = null; }
    }
    if (state?.baseQuote && typeof state.baseQuote.contactPhone === 'string') {
      const result = phone.analyze(state.baseQuote.contactPhone);
      if (result.removed) state.baseQuote.contactPhone = result.value;
    }
  }
  function capture() { if (active) {cleanStatePhone(app);const state=clone(app);recipeCatalog.configure(state);get(active).state=state;} }
  function currentState(entry) { return active === entry.id ? app : entry.state; }
  function woodEntries(state) {
    const rows = [...(state.solidWoodLocal?.articles?.values() || [])].flatMap(local => local.draft ?? local.applied ?? []);
    if (state.breakdownEditor?.solidWoodF && !rows.some(row => row.id === state.breakdownEditor.solidWoodF.id)) rows.push(state.breakdownEditor.solidWoodF);
    return rows;
  }
  function pending(entry) {
    const state = currentState(entry);
    if (entry.id === active && typeof c.partDraftDirty === 'function') return c.partDraftDirty();
    return !!state.partDraft && (!!window.QuotePartDraft?.changed(state.partDraft) || !!state.breakdownEditor || [...(state.solidWoodLocal?.articles?.values() || [])].some(local => local.draft && JSON.stringify(local.draft) !== JSON.stringify(local.applied)));
  }
  function fingerprint(entry) {
    const state = currentState(entry), q = state.q;
    cleanStatePhone(state);
    if (active === entry.id) {
      Object.assign(entry.request, { title: q.name, client: q.client.name, contact: q.contact });
      for (const key of ['location', 'contactPhone', 'contactEmail', 'need', 'included', 'excluded', 'quoteDue', 'deliveryDate']) entry.request[key] = q[key];
      for (const key of ['account', 'designer']) entry.request[key] = state.lineCatalog.users.find(row => row.id === q[key])?.name || q[key];
    }
    return JSON.stringify({ quote: q, wood: woodEntries(state), recipeArticles: state.syntheticRecipes?.articles || {}, request: entry.request });
  }
  function touch(entry) { const value = fingerprint(entry); if (entry.lastFingerprint !== value) { entry.revision++; entry.lastFingerprint = value; } return value; }
  function summary(id) {
    const entry = get(id), state = currentState(entry); touch(entry);
    const blockers = [];
    const phoneNeedsReview = phone.analyze(state.q?.contactPhone).ambiguous;
    if (phoneNeedsReview) blockers.push('Revisa el teléfono para retirar la posible extensión.');
    let evaluated = null;
    try { evaluated = D.evaluate(state.q, { base: state.baseQuote, preview: true, date: '2026-10-14' }); }
    catch (error) { blockers.push(error.message || 'Revisa los datos capturados.'); }
    if (evaluated) blockers.push(...evaluated.issues.map(issue => issue.message));
    if (woodEntries(state).length) blockers.push('Madera: el costo y su guardado siguen pendientes. No se guardará parcialmente.');
    const hasPending = pending(entry);
    if (hasPending) blockers.push('Hay captura sin aplicar en el artículo.');
    if (state.inputErrors?.size) blockers.push('Hay entradas inválidas sin resolver.');
    if (entry.saveState === 'unknown') blockers.push('Resultado del guardado pendiente de confirmar.');
    const totals = evaluated?.totals;
    return {
      costCents: totals?.cost ?? null, priceCents: totals?.net ?? null, taxCents: totals?.tax ?? null, totalCents: totals?.total ?? null,
      complete: !!evaluated?.structuralValid && !!evaluated?.calculationsComplete && !evaluated?.issues.length && !woodEntries(state).length && !hasPending && !state.inputErrors?.size && !phoneNeedsReview,
      blockers: [...new Set(blockers)], revision: entry.revision, savedRevision: entry.savedRevision,
      hasPending, dirty: fingerprint(entry) !== entry.savedFingerprint, saveState: entry.saveState,
    };
  }
  function notify(id = active) { if (!id || !entries.has(id)) return; const payload = { id, clientId: currentState(get(id)).q.client.id, step: currentState(get(id)).step, summary: summary(id), request: clone(get(id).request) }; listeners.forEach(listener => listener(clone(payload))); }
  function scheduleNotify() { if (queued) return; queued = true; queueMicrotask(() => { queued = false; if (active) notify(); }); }
  function locked(entry) { return entry.frozen || entry.saveState === 'unknown' || entry.saveState === 'pending'; }
  // Local editing state for demo extensions; native role/context guards still apply.
  function canEdit(id) { return entries.has(id) && active === id && app.q?.id === id && !locked(get(id)); }
  function paintLock(entry) { if (HOST()) HOST().inert = locked(entry); }
  function render(entry) { c.editor(); paintLock(entry); }

  function create(id, scenario, request, options = {}) {
    if (entries.has(id)) return summary(id);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{3,80}$/.test(id)) throw new Error('Identificador de demo inválido.');
    const state = clone(initialApp), req = normalizeRequest(request);
    configure(state); state.q = fixture(id, req); state.baseQuote = null;
    if (options.clientId != null) {
      if (typeof options.clientId !== 'string' || !/^[A-Za-z0-9_-]{3,80}$/.test(options.clientId)) throw new Error('Cliente sintético inválido.');
      state.q.client.id = options.clientId;
    }
    if (options.unitPriceCents != null) {
      if (!Number.isSafeInteger(options.unitPriceCents) || options.unitPriceCents < 0) throw new Error('Precio sintético inválido.');
      state.q.items[0].unitPrice = Math.floor(options.unitPriceCents / 100) + '.' + String(options.unitPriceCents % 100).padStart(2,'0');
    }
    if (options.scopePreset === 'fabrication-packaging') {
      // An explicitly authored new fixture, never an interpretation of legacy text.
      const config = state.scopeUatConfig;
      for (const [direction, field] of [['include', 'included'], ['exclude', 'excluded']]) {
        const expected = config.seed[direction + 'Ids'].map(id => config.catalogs.scope.find(row => row.id === id).legacyText).join('; ');
        if (req[field] !== expected) throw new Error('La selección sintética y sus textos deben coincidir explícitamente.');
      }
      state.scopeUatSeedUsed = false;
    }
    state.meta = { state: 'Borrador', current: true, number: 1, folio: id }; state.dirty = true;
    state.versions = []; state.reviews = []; state.step = 0;
    if (scenario === 'wood') seedWood(state);
    if(options.emptyArticles){
      state.q.items=[];state.q.manufacturing.items=[];
      state.q.needs=state.q.needs.filter(need=>!need.itemId);
      state.q.costs=state.q.costs.filter(cost=>!cost.itemId&&!cost.id?.startsWith('CST_MFG_'));
      state.q.scopeReview.confirmations=[];
    }
    const entry = { id, scenario, request: req, state, revision: 1, savedRevision: 0, savedFingerprint: '', saved: null, pendingSave: null, saveState: 'idle', frozen: false, lastFingerprint: '' };
    entries.set(id, entry); entry.lastFingerprint = fingerprint(entry); return summary(id);
  }
  function leave(id) {
    const entry = get(id);
    if (entry.saveState === 'unknown' || entry.saveState === 'pending') return { ok: false, pending: 'save' };
    if (id === active && !entry.frozen) c.rowAutoFlush?.({onlyScheduled:true});
    if (pending(entry)) return { ok: false, pending: 'capture' };
    capture(); return { ok: true };
  }
  function open(id, request) {
    const entry = get(id);
    if (active && active !== id && !leave(active).ok) return false;
    capture();
    // After creation, the native quote is authoritative; stale shell metadata must never overwrite it.
    active = id; Object.assign(app, clone(entry.state)); recipeCatalog.configure(app); app.user = user();
    if (app.partDraft && app.partDraft.context?.owner !== app.user.email) { app.partDraft = null; app.breakdownEditor = null; app.openPartId = ''; }
    if (app.solidWoodLocal) app.solidWoodLocal.context = context(app);
    if (app.syntheticRecipes) app.syntheticRecipes.context = context(app);
    app.lineCatalog.clients = [...new Map([...entries.values()].map(row => [row.state.q.client.id,{ id: row.state.q.client.id, name: row.request.client, status: 'Activo' }])).values()];
    if (app.technicalQuoteId !== app.q.id) c.restoreManufacturing?.();
    render(entry); notify(id); return true;
  }
  function hide() { capture(); }
  function showStep(step) {
    if (active) c.rowAutoFlush?.({onlyScheduled:true});
    if (!active || !Number.isInteger(step) || step < 0 || step > 5 || pending(get(active))) return false;
    app.step = step; render(get(active)); notify(); return true;
  }
  function snapshot(id) { return clone(get(id).saved); }
  function snapshotCandidate(entry) {
    const state = currentState(entry), evaluation = summary(entry.id);
    // Only the canonical quote is serializable. F state is explicitly blocked before this function.
    return { quote: clone(D.sanitize(state.q)), summary: clone(evaluation), request: clone(entry.request) };
  }
  function confirmSave(entry, operation) {
    touch(entry);
    if (operation.fingerprint !== fingerprint(entry) || operation.revision !== entry.revision) {
      entry.saveState = 'conflict'; entry.pendingSave = null;
      if (active === entry.id) paintLock(entry);
      notify(entry.id);
      return { ok: false, state: 'conflict', summary: summary(entry.id), snapshot: snapshot(entry.id) };
    }
    entry.saved = clone(operation.snapshot); entry.savedRevision = operation.revision; entry.savedFingerprint = operation.fingerprint;
    entry.saveState = 'success'; entry.pendingSave = null;
    const state = currentState(entry); state.dirty = false; state.storedEvaluation = D.evaluate(state.q, { base: state.baseQuote, preview: true, date: '2026-10-14' }); state.storedTotals = clone(state.storedEvaluation.totals);
    entry.saved.summary = { ...summary(entry.id), dirty: false, saveState: 'success', savedRevision: operation.revision };
    if (active === entry.id) render(entry);
    notify(entry.id); return { ok: true, state: 'success', summary: summary(entry.id), snapshot: snapshot(entry.id) };
  }
  async function save(id, outcome = 'success') {
    const entry = get(id), state = currentState(entry);
    if (!['success', 'fail', 'unknown'].includes(outcome)) throw new Error('Resultado de guardado inválido.');
    if (entry.frozen || entry.saveState === 'unknown' || entry.saveState === 'pending') return { ok: false, state: entry.saveState, summary: summary(id), snapshot: snapshot(id) };
    if (id === active) c.rowAutoFlush?.({onlyScheduled:true});
    if (pending(entry) || woodEntries(state).length || state.inputErrors?.size || phone.analyze(state.q?.contactPhone).ambiguous) return { ok: false, state: 'blocked', summary: summary(id), snapshot: snapshot(id) };
    const operation = { id: uid('SAVE'), snapshot: snapshotCandidate(entry), revision: entry.revision, fingerprint: fingerprint(entry) };
    entry.pendingSave = operation; entry.saveState = 'pending'; if (active === id) paintLock(entry); notify(id);
    await Promise.resolve();
    if (entries.get(id) !== entry) return { ok: false, state: 'reset', summary: null, snapshot: null };
    if (outcome === 'fail') { entry.saveState = 'failed'; entry.pendingSave = null; if (active === id) paintLock(entry); notify(id); return { ok: false, state: 'failed', summary: summary(id), snapshot: snapshot(id) }; }
    if (outcome === 'unknown') { entry.saveState = 'unknown'; if (active === id) paintLock(entry); notify(id); return { ok: false, state: 'unknown', summary: summary(id), snapshot: snapshot(id) }; }
    return confirmSave(entry, operation);
  }
  async function resolveSave(id) {
    const entry = get(id);
    if (entry.saveState !== 'unknown' || !entry.pendingSave) return { ok: false, state: entry.saveState, summary: summary(id), snapshot: snapshot(id) };
    return confirmSave(entry, entry.pendingSave);
  }
  function applyPending(id) { const entry = get(id); if (active !== id || locked(entry)) return false; const ok = !pending(entry) || !!c.partApply?.(); notify(id); return ok; }
  function discardPending(id) { const entry = get(id); if (active !== id || locked(entry)) return false; c.partDiscard?.(); render(entry); notify(id); return true; }
  function freeze(id) { const entry = get(id), value = summary(id); if (!entry.saved || !value.complete || value.dirty || value.hasPending || value.saveState !== 'success') return null; entry.frozen = true; if (active === id) paintLock(entry); return snapshot(id); }
  function revise(id) {
    const entry = get(id);
    if (entry.saveState === 'unknown' || entry.saveState === 'pending' || pending(entry)) return false;
    const state = currentState(entry), number = (state.meta?.number || 1) + 1;
    if (active === id) c.partDiscard?.();
    state.partDraft = null; state.breakdownEditor = null; state.openPartId = '';
    state.baseQuote = clone(entry.saved?.quote || state.q);
    state.q.versionId = id + '-V' + number; state.q.revision++;
    state.meta = { ...state.meta, number, state: 'Borrador', current: true };
    if (state.solidWoodLocal) state.solidWoodLocal.context = context(state);
    if (state.syntheticRecipes) state.syntheticRecipes.context = context(state);
    entry.frozen = false; entry.saved = null; entry.savedRevision = 0; entry.savedFingerprint = ''; entry.saveState = 'idle'; entry.pendingSave = null;
    state.dirty = true; touch(entry);
    if (active === id) render(entry);
    notify(id); return true;
  }
  function setProfile(value) {
    if (!['account', 'designer'].includes(value)) return false;
    if (active && (pending(get(active)) || ['unknown', 'pending'].includes(get(active).saveState))) return false;
    profile = value;
    if (active) { c.partDiscard?.(); app.user = user(); if (app.solidWoodLocal) app.solidWoodLocal.context = context(app); if (app.syntheticRecipes) app.syntheticRecipes.context = context(app); render(get(active)); notify(); }
    return true;
  }
  function reset() { c.rowAutoCancel?.(); entries.clear(); active = ''; serial = 0; profile = 'account'; Object.assign(app, clone(initialApp)); configure(app); if (HOST()) { HOST().inert = false; const workspace = document.getElementById('workspace'); if (workspace) workspace.replaceChildren(); } }

  window.DemoLocalApi = async function (action, input = {}) {
    if (action === 'search' && ['clients', 'users'].includes(input.kind)) {
      const query = String(input.query || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const rows = input.kind === 'users' ? [{ id: account.email, name: account.name, role: account.role, status: 'Activo' }, { id: designer.email, name: designer.name, role: designer.role, status: 'Activo' }] : [...new Map([...entries.values()].map(entry => [entry.state.q.client.id,{ id: entry.state.q.client.id, name: entry.request.client, status: 'Activo' }])).values()];
      return { items: rows.filter(row => row.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query)).slice(0, 20), next: null, total: rows.length };
    }
    if (action === 'clientContact') { const entry = [...entries.values()].find(row => row.state.q.client.id === input.clientId); return entry ? { clientId: input.clientId, contact: entry.request.contact, contactPhone: entry.request.contactPhone, contactEmail: entry.request.contactEmail } : null; }
    if (action === 'processTariffs') return { items: [], next: null, total: 0, fixture: 'SYNTHETIC_DEMO' };
    const error = new Error('Acción no disponible. No hay conexión con este servicio.'); error.code = 'DEMO_ONLY'; throw error;
  };
  window.DemoQuote = { automaticCapture:typeof c.rowAutoFlush==='function',create, open, hide, showStep, summary, save, resolveSave, snapshot, leave, applyPending, discardPending, freeze, revise, reset, setProfile, canEdit,
    onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); } };
  for (const eventName of ['input', 'change', 'click']) document.addEventListener(eventName, event => { if (HOST()?.contains(event.target)) scheduleNotify(); });
  // Native navigation may finish after an awaited handler. Observe its committed
  // view rather than guessing that the document click already changed the step.
  if (typeof MutationObserver === 'function' && document.getElementById('workspace')) {
    new MutationObserver(scheduleNotify).observe(document.getElementById('workspace'), { childList: true });
  }
})();
