/* Browser-local demo data. The Windows service owns its own persistence. */
(() => {
  'use strict';
  if (window.DucoPrivateApi || !['http:', 'https:'].includes(window.location?.protocol)) return;

  const databaseName = 'duco-cotizaciones-demo';
  const quotes = 'quotes';
  const problem = (message, status) => Object.assign(new Error(message), {status});
  const unavailable = () => problem('El almacenamiento de este navegador no está disponible. Revisa el espacio y los permisos del sitio.', 507);
  const conflict = () => problem('Otra pestaña guardó este expediente. Conserva tu captura y consulta la versión guardada antes de reintentar.', 409);
  const equal = (one, other) => JSON.stringify(one) === JSON.stringify(other);

  function check(record, snapshot) {
    const id = record?.id;
    if (!/^DEMO-[A-Za-z0-9-]{1,65}$/.test(id) || record.asana ||
        record.source !== 'SYNTHETIC_DEMO' || !Number.isSafeInteger(record.version) ||
        record.version < 1 || !Array.isArray(record.versions) || !Array.isArray(record.history) ||
        typeof record.request?.title !== 'string' || snapshot?.quote?.id !== id ||
        snapshot.quote.versionId !== id+'-V'+record.version ||
        !Number.isSafeInteger(snapshot.summary?.savedRevision) || !snapshot.request) {
      throw problem('El expediente de prueba no coincide con la versión de su cotización.', 422);
    }
  }

  function checkProject(record) {
    const {project, sent} = record;
    if (!project) return;
    if (sent?.response?.result !== 'accepted' || sent.response.version !== record.version ||
        sent.version !== record.version || !Number.isSafeInteger(sent.snapshot?.summary?.priceCents) ||
        project.id !== 'PR-'+record.id || project.sourceId !== record.id ||
        project.conversionKey !== record.id+':V'+record.version || project.version !== record.version ||
        !equal(project.baseline,sent.snapshot)) {
      throw problem('El proyecto requiere la versión enviada y aceptada de esta cotización.', 422);
    }
  }

  function openDatabase() {
    return new Promise((resolve,reject) => {
      let request;
      try { request = window.indexedDB.open(databaseName,1); }
      catch { reject(unavailable()); return; }
      request.onupgradeneeded = () => request.result.createObjectStore(quotes,{keyPath:'record.id'});
      let blocked=false;
      request.onerror = () => reject(unavailable());
      request.onblocked = () => {blocked=true; reject(unavailable());};
      request.onsuccess = () => {
        if(blocked)request.result.close();
        else resolve(request.result);
      };
    });
  }

  async function entries() {
    const db = await openDatabase();
    try {
      return await new Promise((resolve,reject) => {
        const tx = db.transaction(quotes,'readonly');
        const request = tx.objectStore(quotes).getAll();
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(unavailable());
      });
    } finally { db.close(); }
  }

  async function initial() {
    const drafts = await entries();
    for (const {record,snapshot,revision} of drafts) {
      check(record,snapshot);
      checkProject(record);
      if (!Number.isSafeInteger(revision) || revision<1) throw problem('Revisión de guardado inválida.',422);
    }
    return drafts;
  }

  async function put(record,snapshot,expectedRevision,action) {
    check(record,snapshot);
    checkProject(record);
    const db = await openDatabase();
    try {
      return await new Promise((resolve,reject) => {
        const tx = db.transaction(quotes,'readwrite');
        const store = tx.objectStore(quotes);
        const get = store.get(record.id);
        let failure, result;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || unavailable());
        get.onsuccess = () => {
          const prior = get.result;
          try {
            if (action==='convert' && prior?.record.project &&
                prior.record.project.conversionKey===record.project?.conversionKey &&
                equal(prior.record.project.baseline,record.project.baseline)) {
              result={revision:prior.revision,record:prior.record};
              return;
            }
            if ((prior?.revision || 0)!==expectedRevision) {
              if (prior && equal(prior.record,record) && equal(prior.snapshot,snapshot)) {
                result={revision:prior.revision};
                return;
              }
              throw conflict();
            }
            if (prior?.record.project && !equal(prior.record.project.baseline,record.project?.baseline)) throw conflict();
            if (prior && record.project && !prior.record.project &&
                (prior.record.sent?.response?.result!=='accepted' || !equal(prior.record.sent.snapshot,record.project.baseline))) throw conflict();
            const revision=expectedRevision+1;
            store.put({record,snapshot,revision});
            result={revision};
          } catch (error) {
            failure=error.status?error:unavailable();
            tx.abort();
          }
        };
      });
    } finally { db.close(); }
  }

  window.DemoBrowserStore = Object.freeze({initial,put});
})();
