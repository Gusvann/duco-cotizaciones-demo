/* Telephone policy for this in-memory demo; the quote still stores one string. */
(function () {
  'use strict';
  const countries = globalThis.DemoCountries;
  if (!Array.isArray(countries) || countries.length !== 245) throw new Error('Catálogo de ladas incompleto.');
  const byDial = new Map();
  for (const country of countries) {
    if (!byDial.has(country.dial)) byDial.set(country.dial, []);
    byDial.get(country.dial).push(country);
  }

  function analyze(input) {
    const source = typeof input === 'string' ? input : '';
    // Only strip an explicitly labelled final extension from a telephone-shaped base.
    const match = /^(\+?[0-9(][0-9 ()-]*?)(?:\s*(?:ext(?:ensi[oó]n)?\.?|x)\s*[:.#-]?\s*)(\d+)\s*$/iu.exec(source);
    if (match && /\d/.test(match[1])) return {value:match[1].replace(/\s+$/u,''),removed:true,ambiguous:false};
    const ambiguous = /(?:^|[\s\d])(?:ext(?:ensi[oó]n)?\.?|x|#)(?:\s*[:.#-]?\s*.*)?$/iu.test(source);
    return {value:source,removed:false,ambiguous};
  }
  function cleanHolder(holder) {
    if (!holder || typeof holder !== 'object' || typeof holder.contactPhone !== 'string') return holder;
    return {...holder,contactPhone:analyze(holder.contactPhone).value};
  }
  function cleanSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;
    const copy = {...snapshot};
    if (Object.prototype.hasOwnProperty.call(snapshot,'quote')) copy.quote = cleanHolder(snapshot.quote);
    if (Object.prototype.hasOwnProperty.call(snapshot,'request')) copy.request = cleanHolder(snapshot.request);
    return copy;
  }
  function cleanRecord(record) {
    // Preserve aliases between sent and versions: response updates share that object.
    const copy = structuredClone(record);
    if (copy.request) copy.request = cleanHolder(copy.request);
    const seen = new Set();
    for (const version of [copy.sent,...(Array.isArray(copy.versions) ? copy.versions : [])]) {
      if (!version || seen.has(version)) continue;
      seen.add(version);
      if (Object.prototype.hasOwnProperty.call(version,'snapshot')) version.snapshot = cleanSnapshot(version.snapshot);
    }
    if (copy.project?.baseline) copy.project.baseline = cleanSnapshot(copy.project.baseline);
    return copy;
  }
  function recordNeedsAttention(record) {
    const snapshots = [record?.sent?.snapshot,...(record?.versions || []).map(version => version?.snapshot),record?.project?.baseline];
    const values = [record?.request?.contactPhone,...snapshots.flatMap(snapshot => [snapshot?.quote?.contactPhone,snapshot?.request?.contactPhone])];
    return values.some(value => typeof value === 'string' && analyze(value).ambiguous);
  }
  function selectionFor(dial) {
    const matches = byDial.get(dial) || [];
    return matches.length === 1 ? matches[0].id : matches.length > 1 ? 'shared:'+dial : 'other';
  }
  globalThis.DemoPhone = Object.freeze({countries,analyze,cleanHolder,cleanSnapshot,cleanRecord,recordNeedsAttention,selectionFor});
})();
