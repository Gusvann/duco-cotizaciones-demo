/* Portafolio sintético: proyección pura de los expedientes y sus snapshots. */
(function(global) {
  'use strict';
  const CUTOFF = '2026-10-15';
  const CATEGORIES = Object.freeze({horeca:'HORECA',offices:'Oficinas',brands:'Marcas de diseño',lab:'Laboratorio de diseño',residential:'Residencial',retail:'Retail',logistics:'Logística y envíos'});
  const PERIODS = Object.freeze({year:['2026-01-01',CUTOFF],q3:['2026-07-01','2026-09-30'],october:['2026-10-01',CUTOFF]});
  const FAMILIES = Object.freeze(['Ventas','Tickets','Preparación','Cierre','Cotizaciones por cliente','Cotizaciones por mes','Nuevos y recurrentes']);
  function calendarDate(value) {
    if (typeof value !== 'string') return null;
    const candidate = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value) ? value.slice(0,10) : '';
    if (!candidate) return null;
    const parsed = new Date(candidate + 'T00:00:00Z');
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0,10) === candidate ? candidate : null;
  }
  function days(start,end) {
    const first = calendarDate(start), last = calendarDate(end);
    if (!first || !last) return null;
    const value = (Date.parse(last + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z')) / 86400000;
    return value >= 0 ? value : null;
  }
  function range(period,cutoff = CUTOFF) {
    const end = calendarDate(cutoff) || CUTOFF;
    const selected = PERIODS[period] || PERIODS.year;
    return [selected[0], selected[1] < end ? selected[1] : end];
  }
  const inRange = (value,period,cutoff = CUTOFF) => { const day = calendarDate(value), [start,end] = range(period,cutoff); return Boolean(day && day >= start && day <= end && day <= cutoff); };
  const mean = values => { const valid = values.filter(value => value !== null); return valid.length ? valid.reduce((sum,value) => sum + value,0) / valid.length : null; };
  const hasPrice = row => Number.isSafeInteger(row.netCents) && row.netCents >= 0;
  function sum(rows) {
    const total = rows.filter(hasPrice).reduce((value,row) => value + BigInt(row.netCents),0n);
    return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
  }
  function project(records,clients = {},cutoff = CUTOFF) {
    const ids = new Map(), projectIds = new Map();
    for (const record of records) {
      ids.set(record.id,(ids.get(record.id) || 0) + 1);
      if (record.project?.id) projectIds.set(record.project.id,(projectIds.get(record.project.id) || 0) + 1);
    }
    return records.map(record => {
      const issues = [];
      const duplicate = !record.id || ids.get(record.id) !== 1;
      if (duplicate) issues.push('Identificador de expediente ausente o duplicado.');
      const acceptedVersions = (record.versions || []).filter(version => version.response?.result === 'accepted' && version.response.version === version.version);
      let selected = null;
      if (record.acceptedVersion != null) {
        const candidates = acceptedVersions.filter(version => version.version === record.acceptedVersion);
        if (candidates.length === 1) selected = candidates[0];
        else issues.push('La referencia de versión aceptada no identifica una única aceptación.');
      } else if (acceptedVersions.length === 1) selected = acceptedVersions[0];
      else if (acceptedVersions.length > 1) issues.push('Hay más de una versión aceptada sin referencia única.');
      let acceptanceIdentity = selected ? 'partial' : 'absent';
      if (selected) {
        const quote = selected.snapshot?.quote;
        const foreignQuote = quote?.id != null && quote.id !== record.id;
        const mismatchedVersion = selected.quoteVersionId != null && (!quote?.versionId || selected.quoteVersionId !== quote.versionId);
        if (foreignQuote || mismatchedVersion) {
          issues.push(foreignQuote ? 'La cotización del snapshot aceptado pertenece a otro expediente.' : 'La identidad de versión del snapshot contradice la referencia aceptada.');
          acceptanceIdentity = 'invalid';
          selected = null;
        } else if (quote?.id === record.id && typeof quote.versionId === 'string' && quote.versionId && selected.quoteVersionId === quote.versionId) acceptanceIdentity = 'verified';
        else issues.push('Identidad parcial del snapshot aceptado: no acredita la relación completa entre expediente y versión.');
      }
      const acceptedAt = selected ? calendarDate(selected.acceptedAt || selected.response.at) : null;
      if (selected && !acceptedAt) issues.push('La aceptación no tiene una fecha válida.');
      const netCents = selected?.snapshot?.summary?.priceCents ?? null;
      if (selected && !hasPrice({netCents})) issues.push('La versión aceptada no tiene un importe válido en centavos.');
      const request = selected?.snapshot?.request || record.request || {};
      const clientId = selected?.clientId || record.clientId || null;
      const client = clientId ? clients[clientId] : null;
      if (!client) issues.push('Cliente sin identidad o historial identificable.');
      const firstSaleAt = calendarDate(client?.firstSaleAt);
      if (!firstSaleAt || acceptedAt && firstSaleAt > acceptedAt) issues.push('Historial de primera venta no acreditado para clasificar al cliente.');
      const requestedAt = calendarDate(record.requestedAt);
      const firstSentAt = calendarDate(record.firstSentAt);
      if (!requestedAt) issues.push('Fecha de solicitud ausente o inválida.');
      const poAt = calendarDate(record.poAt);
      if (record.poAt && (!poAt || acceptedAt && poAt < acceptedAt)) issues.push('El hito anticipo / PO tiene una fecha inválida o anterior a la aceptación.');
      const category = selected?.category || record.category || null;
      const commercialType = selected?.commercialType || record.commercialType || null;
      if (!Object.hasOwn(CATEGORIES,category)) issues.push('Categoría sin clasificar.');
      if (!['line','project'].includes(commercialType)) issues.push('Tipo comercial sin clasificar.');
      let projectId = null, projectAt = null;
      if (record.project) {
        const linked = record.project, baselineQuote = linked.baseline?.quote, acceptedQuote = selected?.snapshot?.quote;
        let validLink = true;
        if (typeof linked.id !== 'string' || !linked.id.trim() || projectIds.get(linked.id) !== 1) {issues.push('El identificador de proyecto está ausente o vinculado a más de un expediente.');validLink=false;}
        if (!selected || acceptanceIdentity !== 'verified' || !acceptedAt) {issues.push('El proyecto no tiene una versión aceptada con identidad completa verificable.');validLink=false;}
        if (linked.sourceId !== record.id || linked.version !== selected?.version) {issues.push('El proyecto no corresponde al expediente y versión aceptada de origen.');validLink=false;}
        if (!baselineQuote || baselineQuote.id !== record.id || baselineQuote.versionId !== acceptedQuote?.versionId || baselineQuote.versionId !== selected?.quoteVersionId) {issues.push('La identidad del presupuesto base del proyecto no coincide con el snapshot aceptado.');validLink=false;}
        const linkedAt = calendarDate(linked.createdAt);
        if (!linkedAt || acceptedAt && linkedAt < acceptedAt) {issues.push('La fecha del proyecto está ausente, es inválida o antecede a la aceptación.');validLink=false;}
        if (validLink) {projectId=linked.id;projectAt=linkedAt;}
      }
      return {id:record.id,title:request.title || record.request?.title || record.id,clientId,clientName:client?.name || request.client || 'Sin cliente identificado',category,type:commercialType,
        requestedAt,firstSentAt,acceptedAt,poAt:poAt && (!acceptedAt || poAt >= acceptedAt) ? poAt : null,firstSaleAt:firstSaleAt && (!acceptedAt || firstSaleAt <= acceptedAt) ? firstSaleAt : null,
        version:selected?.version ?? null,currentVersion:record.version,netCents,projectId,projectAt,acceptanceIdentity,
        rejected:record.sent?.response?.result === 'rejected',accepted:Boolean(selected && acceptedAt && acceptedAt <= cutoff),ambiguous:duplicate,issues};
    });
  }
  function segment(row,period,cutoff = CUTOFF) {
    const first = calendarDate(row.firstSaleAt), [start,end] = range(period,cutoff);
    return !first || first > end ? 'unknown' : first < start ? 'recurring' : 'new';
  }
  function aggregate(rows) {
    const priced = rows.filter(hasPrice), totalCents = sum(rows);
    return {rows,count:rows.length,pricedCount:priced.length,pendingCount:rows.length-priced.length,totalCents,ticketCents:averageCents(totalCents,priced.length)};
  }
  function averageCents(total,count) { return count && total !== null ? Number((2n*BigInt(total)+BigInt(count))/(2n*BigInt(count))) : null; }
  function compute(records,filters = {},clients = {}) {
    const cutoff = calendarDate(filters.cutoff) || CUTOFF;
    const period = Object.hasOwn(PERIODS,filters.period) ? filters.period : 'year';
    const category = Object.hasOwn(CATEGORIES,filters.category) ? filters.category : 'all';
    const basis = filters.basis === 'poAt' ? 'poAt' : 'acceptedAt';
    const rows = project(records,clients,cutoff);
    const base = rows.filter(row => !row.ambiguous && (category === 'all' || row.category === category));
    const eligible = base.filter(row => row.accepted && inRange(row[basis],period,cutoff));
    const priced = eligible.filter(hasPrice), totalCents = sum(priced);
    const cohort = base.filter(row => inRange(row.requestedAt,period,cutoff));
    const times = base.filter(row => row.accepted && inRange(row.acceptedAt,period,cutoff));
    const prep = times.map(row => days(row.requestedAt,row.firstSentAt)), close = times.map(row => days(row.firstSentAt,row.acceptedAt));
    const validPrep = prep.filter(value => value !== null), validClose = close.filter(value => value !== null);
    const byCategory = Object.entries(CATEGORIES).map(([key,label]) => ({key,label,...aggregate(eligible.filter(row => row.category === key))}));
    if (eligible.some(row => !Object.hasOwn(CATEGORIES,row.category))) byCategory.push({key:'unknown',label:'Sin categoría',...aggregate(eligible.filter(row => !Object.hasOwn(CATEGORIES,row.category)))});
    const clientKey = row => row.clientId && clients[row.clientId] ? row.clientId : 'unknown:'+row.id;
    const clientLabel = key => clients[key]?.name || base.find(row => clientKey(row) === key)?.clientName || 'Sin cliente identificado';
    // A display name never merges identities. Empty scopes have no invented groups.
    const groupClients = subset => {
      const groups = new Map();
      for (const row of subset) {const key=clientKey(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
      return [...groups.keys()].sort().map(key => ({key,label:clientLabel(key),rows:groups.get(key)}));
    };
    const saleClients = subset => groupClients(subset).map(group => ({...group,...aggregate(group.rows)}));
    const clientKeys = [...new Set([...eligible,...cohort].map(clientKey))].sort();
    const byClient = clientKeys.map(key => { const matches = row => clientKey(row) === key; const activity = cohort.filter(matches); return {key,label:clientLabel(key),...aggregate(eligible.filter(matches)),received:activity.length,accepted:activity.filter(row => row.accepted).length,activity}; });
    const byType = ['line','project'].map(key => {const subset = times.filter(row => row.type === key), valid = subset.map(row => days(row.firstSentAt,row.acceptedAt)).filter(value => value !== null);return {key,label:key === 'line' ? 'Producto de línea' : 'Proyecto',rows:subset,count:subset.length,n:valid.length,closeDays:mean(valid)};});
    const [start,end] = range(period,cutoff), months = [];
    for (let month = Number(start.slice(5,7));month <= Number(end.slice(5,7));month++) months.push('2026-'+String(month).padStart(2,'0'));
    const monthlySales = months.map(key => {const subset=eligible.filter(row => row[basis]?.startsWith(key));return {key,...aggregate(subset),clients:saleClients(subset)};});
    const monthlyRequests = months.map(key => {const subset=cohort.filter(row => row.requestedAt?.startsWith(key));return {key,rows:subset,count:subset.length,clients:groupClients(subset).map(group => ({...group,count:group.rows.length}))};});
    const segments = ['new','recurring','unknown'].map(key => {const subset=eligible.filter(row => segment(row,period,cutoff) === key);return {key,...aggregate(subset),clients:saleClients(subset)};});
    const timeExclusions = {withoutAcceptance:base.filter(row => !row.accepted).length,outsidePeriod:base.filter(row => row.accepted && !inRange(row.acceptedAt,period,cutoff)).length,invalidPrep:times.length-validPrep.length,invalidClose:times.length-validClose.length};
    return {filters:{period,category,basis,cutoff},rows,base,eligible,priced,pending:eligible.filter(row => !hasPrice(row)),totalCents,ticketCents:averageCents(totalCents,priced.length),
      cohort,times,prepDays:mean(validPrep),closeDays:mean(validClose),prepN:validPrep.length,closeN:validClose.length,timeExclusions,byCategory,byClient,byType,monthlySales,monthlyRequests,segments,
      unknown:eligible.filter(row => segment(row,period,cutoff) === 'unknown'),noPo:base.filter(row => row.accepted && inRange(row.acceptedAt,period,cutoff) && !row.poAt),
      activity:{received:cohort.length,sent:cohort.filter(row => row.firstSentAt && row.firstSentAt <= cutoff).length,accepted:cohort.filter(row => row.accepted).length,projects:cohort.filter(row => row.projectId && row.projectAt && row.projectAt <= cutoff).length},
      quality:{ambiguous:rows.filter(row => row.ambiguous),issues:rows.flatMap(row => row.issues.map(message => ({id:row.id,message}))),overflow:totalCents === null}};
  }
  global.DemoPortfolio = Object.freeze({CUTOFF,CATEGORIES,PERIODS,FAMILIES,calendarDate,days,range,inRange,hasPrice,sum,segment,project,compute});
})(globalThis);
