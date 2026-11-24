/* Portafolio sintético: proyección pura de los expedientes y sus snapshots. */
(function(global) {
  'use strict';
  const CUTOFF = '2026-10-15';
  const CATEGORIES = Object.freeze({horeca:'HORECA',offices:'Oficinas',brands:'Marcas de diseño',lab:'Laboratorio de diseño',residential:'Residencial',retail:'Retail',logistics:'Logística y envíos',architecture:'Arquitectónico'});
  const PERIODS = Object.freeze({year:['2026-01-01',CUTOFF],q3:['2026-07-01','2026-09-30'],october:['2026-10-01',CUTOFF]});
  const FAMILIES = Object.freeze(['Ventas','Tickets','Preparación','Cierre','Cotizaciones por cliente','Cotizaciones por mes','Nuevos y recurrentes']);
  const TYPES = Object.freeze({line:'Producto de línea',project:'Proyecto'});
  const SEGMENTS = Object.freeze({new:'Nuevo',recurring:'Recurrente',unknown:'Sin historial'});
  const cityDate = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'});
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
  function localDate(value) {
    if (typeof value !== 'string') return null;
    if (value.length === 10) return calendarDate(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !calendarDate(value.slice(0,10))) return null;
    const instant = new Date(value);
    if (!Number.isFinite(instant.valueOf())) return null;
    const parts = Object.fromEntries(cityDate.formatToParts(instant).map(part => [part.type,part.value]));
    return parts.year+'-'+parts.month+'-'+parts.day;
  }
  function statusAge(status, enteredAt, now) {
    if (status === 'project' || status === 'rejected') return {days:null,kind:'inactive'};
    const age = days(localDate(enteredAt),localDate(now));
    return {days:age,kind:age === null ? 'unknown' : age >= 7 ? 'overdue' : 'current'};
  }
  const compactFolio = value => typeof value === 'string' ? value.trim().replace(/^(\d{2}(?:0[1-9]|1[0-2]))\s*[-–]\s*(\d+)$/,'$1$2') : '';
  const leadingFolio = value => /^\s*(?:\(\$\)\s*)?(\d{2}(?:0[1-9]|1[0-2])\s*[-–]\s*\d+|\d{2}(?:0[1-9]|1[0-2])\d{2,})(?=\s|_|$)/.exec(value || '');
  function projectFolio(project) {
    return project.folio || leadingFolio(project.title)?.[1] || project.id;
  }
  function projectTitle(project) {
    const title = project.title || '';
    const leading = leadingFolio(title);
    if (!leading || compactFolio(leading[1]) !== compactFolio(projectFolio(project))) return title;
    return title.replace(leading[0],prefix=>prefix.replace(leading[1],compactFolio(leading[1])));
  }
  function projectMatches(project, query, ...values) {
    const folio = projectFolio(project);
    const compactQuery = compactFolio(query);
    return (compactQuery!==query && compactFolio(folio)===compactQuery) || [folio,compactFolio(folio),project.title, ...values]
      .some(value=>String(value ?? '').toLocaleLowerCase('es-MX').includes(query));
  }
  function coveragePeriods(coverage) {
    const from=calendarDate(coverage?.from), through=calendarDate(coverage?.through), latest=calendarDate(coverage?.latest);
    if (!from || !through || through<from) return null;
    const periods = {cut:[from,through]};
    if (coverage.localOnly) return periods;
    if (from <= '2026-10-31' && through >= '2026-10-01') periods.october=['2026-10-01','2026-10-31'];
    if (from <= '2026-11-30' && through >= '2026-11-01') periods.november=['2026-11-01','2026-11-30'];
    if (latest && latest>through) {
      const firstLater = new Date(Date.parse(through+'T00:00:00Z')+86400000).toISOString().slice(0,10);
      periods.local=[firstLater,latest];
    }
    return periods;
  }
  function range(period,cutoff = CUTOFF,coverage) {
    const end = calendarDate(cutoff) || CUTOFF;
    const imported = coveragePeriods(coverage);
    const selected = imported ? imported[period] || imported.cut : PERIODS[period] || PERIODS.year;
    const start = imported && coverage.from > selected[0] ? coverage.from : selected[0];
    const bound = imported && period!=='local' && selected[1]>coverage.through ? coverage.through : selected[1];
    return [start, bound < end ? bound : end];
  }
  const inRange = (value,period,cutoff = CUTOFF,coverage) => { const day = coverage ? localDate(value) : calendarDate(value), [start,end] = range(period,cutoff,coverage); return Boolean(day && day >= start && day <= end && day <= cutoff); };
  const mean = values => { const valid = values.filter(value => value !== null); return valid.length ? valid.reduce((sum,value) => sum + value,0) / valid.length : null; };
  const hasPrice = row => Number.isSafeInteger(row.netCents) && row.netCents >= 0;
  function sum(rows) {
    const total = rows.filter(hasPrice).reduce((value,row) => value + BigInt(row.netCents),0n);
    return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
  }
  function importedQuote(record, clients, cutoff, duplicate, issues, projectIds) {
    const source=record.asana.commercial || {}, request=record.request || {};
    const clientId=record.clientId || null, client=clientId && Object.hasOwn(clients,clientId) ? clients[clientId] : null;
    const rejected=record.importedStatus==='rejected';
    const acceptedDate=localDate(source.acceptedAt);
    const acceptedAt=rejected ? null : acceptedDate;
    const saleAwaitingDate=!acceptedAt && ['accepted','project'].includes(record.importedStatus);
    const requestedAt=localDate(source.requestedAt || record.requestedAt);
    const firstSentAt=localDate(source.firstSentAt);
    const firstSaleAt=localDate(client?.firstSaleAt);
    const poAt=localDate(source.poAt);
    const linkedProject=source.linkedProjectId && projectIds.get(source.linkedProjectId)===1;
    const projectAt=linkedProject ? localDate(source.projectAt) : null;
    const netCents=acceptedAt && hasPrice({netCents:source.netCents}) ? source.netCents : null;
    if (acceptedAt && netCents===null) issues.push('La aceptación de Asana no tiene un importe sin IVA verificado.');
    if (saleAwaitingDate) issues.push('El estado de Asana señala venta o aceptación, pero falta la fecha y el importe aceptado sin IVA.');
    if (rejected && acceptedDate) issues.push('La fecha de aceptación de Asana contradice el estado Rechazada.');
    if (source.linkedProjectId && !linkedProject) issues.push('El proyecto de Asana está vinculado a más de una cotización.');
    if (!firstSaleAt || acceptedAt && firstSaleAt>acceptedAt) issues.push('Historial de primera venta no acreditado para clasificar al cliente.');
    if (!requestedAt) issues.push('Fecha de solicitud ausente o inválida.');
    return {id:record.id,folio:record.folio,title:request.title || record.id,clientId,clientName:client?.name || request.client || 'Sin cliente identificado',
      category:record.category || null,type:record.commercialType || null,requestedAt,firstSentAt,acceptedAt,
      createdAt:localDate(record.asana.createdAt),saleAwaitingDate,
      firstSaleAt:firstSaleAt && (!acceptedAt || firstSaleAt<=acceptedAt) ? firstSaleAt : null,
      poAt:poAt && (!acceptedAt || poAt>=acceptedAt) ? poAt : null,projectAt:projectAt && (!acceptedAt || projectAt>=acceptedAt) ? projectAt : null,
      projectId:linkedProject ? source.linkedProjectId : null,netCents,version:null,currentVersion:null,acceptanceIdentity:'imported',
      accepted:Boolean(acceptedAt && acceptedAt<=cutoff),rejected,ambiguous:duplicate,issues,imported:true};
  }
  function project(records,clients = {},cutoff = CUTOFF,useLocalDates = false) {
    const date = useLocalDates ? localDate : calendarDate;
    const ids = new Map(), projectIds = new Map();
    for (const record of records) {
      ids.set(record.id,(ids.get(record.id) || 0) + 1);
      const projectId=record.asana ? record.asana.commercial?.linkedProjectId : record.project?.id;
      if (projectId) projectIds.set(projectId,(projectIds.get(projectId) || 0) + 1);
    }
    return records.map(record => {
      const issues = [];
      const duplicate = !record.id || ids.get(record.id) !== 1;
      if (duplicate) issues.push('Identificador de expediente ausente o duplicado.');
      if (record.asana?.kind==='quote') return importedQuote(record,clients,cutoff,duplicate,issues,projectIds);
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
      const acceptedAt = selected ? date(selected.acceptedAt || selected.response.at) : null;
      if (selected && !acceptedAt) issues.push('La aceptación no tiene una fecha válida.');
      const netCents = selected?.snapshot?.summary?.priceCents ?? null;
      if (selected && !hasPrice({netCents})) issues.push('La versión aceptada no tiene un importe válido en centavos.');
      const request = selected?.snapshot?.request || record.request || {};
      const clientId = selected?.clientId || record.clientId || null;
      const client = clientId && Object.hasOwn(clients,clientId) ? clients[clientId] : null;
      if (!client) issues.push('Cliente sin identidad o historial identificable.');
      const firstSaleAt = date(client?.firstSaleAt);
      if (!firstSaleAt || acceptedAt && firstSaleAt > acceptedAt) issues.push('Historial de primera venta no acreditado para clasificar al cliente.');
      const requestedAt = date(record.requestedAt);
      const firstSentAt = date(record.firstSentAt);
      if (!requestedAt) issues.push('Fecha de solicitud ausente o inválida.');
      const poAt = date(record.poAt);
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
        const linkedAt = date(linked.createdAt);
        if (!linkedAt || acceptedAt && linkedAt < acceptedAt) {issues.push('La fecha del proyecto está ausente, es inválida o antecede a la aceptación.');validLink=false;}
        if (validLink) {projectId=linked.id;projectAt=linkedAt;}
      }
      return {id:record.id,title:request.title || record.request?.title || record.id,clientId,clientName:client?.name || request.client || 'Sin cliente identificado',category,type:commercialType,
        requestedAt,firstSentAt,acceptedAt,poAt:poAt && (!acceptedAt || poAt >= acceptedAt) ? poAt : null,firstSaleAt:firstSaleAt && (!acceptedAt || firstSaleAt <= acceptedAt) ? firstSaleAt : null,
        version:selected?.version ?? null,currentVersion:record.version,netCents,projectId,projectAt,acceptanceIdentity,
        rejected:record.sent?.response?.result === 'rejected',accepted:Boolean(selected && acceptedAt && acceptedAt <= cutoff),ambiguous:duplicate,issues};
    });
  }
  function segment(row,period,cutoff = CUTOFF,coverage) {
    const first = calendarDate(row.firstSaleAt), [start,end] = range(period,cutoff,coverage);
    return !first || first > end ? 'unknown' : first < start ? 'recurring' : 'new';
  }
  function aggregate(rows) {
    const priced = rows.filter(hasPrice), totalCents = sum(rows);
    return {rows,count:rows.length,pricedCount:priced.length,pendingCount:rows.length-priced.length,totalCents,ticketCents:averageCents(totalCents,priced.length)};
  }
  function averageCents(total,count) { return count && total !== null ? Number((2n*BigInt(total)+BigInt(count))/(2n*BigInt(count))) : null; }
  function compute(records,filters = {},clients = {}) {
    const coverage = coveragePeriods(filters.coverage) ? filters.coverage : null;
    const cutoff = calendarDate(filters.cutoff) || coverage?.latest || coverage?.through || CUTOFF;
    const periods = coveragePeriods(coverage) || PERIODS;
    const period = Object.hasOwn(periods,filters.period) ? filters.period : coverage ? 'cut' : 'year';
    const category = Object.hasOwn(CATEGORIES,filters.category) ? filters.category : 'all';
    const basis = filters.basis === 'poAt' ? 'poAt' : 'acceptedAt';
    const client = typeof filters.client === 'string' ? filters.client : 'all';
    const type = Object.hasOwn(TYPES,filters.type) ? filters.type : 'all';
    const customer = Object.hasOwn(SEGMENTS,filters.customer) ? filters.customer : 'all';
    const rows = project(records.filter(record=>record.asana?.kind!=='project'),clients,cutoff,!!coverage);
    const clientKey = row => row.clientId && Object.hasOwn(clients,row.clientId) ? row.clientId : 'unknown:'+row.id;
    const customerType = row => segment(row,period,cutoff,coverage);
    const within = date => inRange(date,period,cutoff,coverage);
    const scoped = rows.filter(row => (period!=='local' || !row.imported) && (category === 'all' || row.category === category) &&
      (client === 'all' || clientKey(row) === client) && (type === 'all' || row.type === type) &&
      (customer === 'all' || customerType(row) === customer));
    const base = scoped.filter(row=>!row.ambiguous);
    const eligible = base.filter(row => row.accepted && within(row[basis]));
    const priced = eligible.filter(hasPrice), totalCents = sum(priced);
    const cohort = base.filter(row => within(row.requestedAt));
    const times = base.filter(row => row.accepted && within(row.acceptedAt));
    const prep = times.map(row => days(row.requestedAt,row.firstSentAt)), close = times.map(row => days(row.firstSentAt,row.acceptedAt));
    const validPrep = prep.filter(value => value !== null), validClose = close.filter(value => value !== null);
    const byCategory = Object.entries(CATEGORIES).map(([key,label]) => ({key,label,...aggregate(eligible.filter(row => row.category === key))}));
    if (eligible.some(row => !Object.hasOwn(CATEGORIES,row.category))) byCategory.push({key:'unknown',label:'Sin categoría',...aggregate(eligible.filter(row => !Object.hasOwn(CATEGORIES,row.category)))});
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
    const [start,end] = range(period,cutoff,coverage), months = [];
    const cursor = new Date(start.slice(0,7)+'-01T00:00:00Z');
    while (start<=end && cursor.toISOString().slice(0,7)<=end.slice(0,7)) {
      months.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);
    }
    const monthlySales = months.map(key => {const subset=eligible.filter(row => row[basis]?.startsWith(key));return {key,...aggregate(subset),clients:saleClients(subset)};});
    const monthlyRequests = months.map(key => {const subset=cohort.filter(row => row.requestedAt?.startsWith(key));return {key,rows:subset,count:subset.length,clients:groupClients(subset).map(group => ({...group,count:group.rows.length}))};});
    const segments = Object.keys(SEGMENTS).map(key => {const subset=eligible.filter(row => customerType(row) === key);return {key,...aggregate(subset),clients:saleClients(subset)};});
    const timeExclusions = {withoutAcceptance:base.filter(row => !row.accepted).length,outsidePeriod:base.filter(row => row.accepted && !within(row.acceptedAt)).length,invalidPrep:times.length-validPrep.length,invalidClose:times.length-validClose.length};
    return {filters:{period,category,basis,cutoff,client,type,customer},coverage,interval:[start,end],rows,base,eligible,priced,pending:eligible.filter(row => !hasPrice(row)),
      undatedSales:base.filter(row=>row.saleAwaitingDate && within(row.createdAt)),totalCents,ticketCents:averageCents(totalCents,priced.length),
      cohort,times,prepDays:mean(validPrep),closeDays:mean(validClose),prepN:validPrep.length,closeN:validClose.length,timeExclusions,byCategory,byClient,byType,monthlySales,monthlyRequests,segments,
      unknown:eligible.filter(row => customerType(row) === 'unknown'),noPo:base.filter(row => row.accepted && within(row.acceptedAt) && !row.poAt),
      activity:{received:cohort.length,sent:cohort.filter(row => row.firstSentAt && row.firstSentAt <= cutoff).length,accepted:cohort.filter(row => row.accepted).length,projects:cohort.filter(row => row.projectId && row.projectAt && row.projectAt <= cutoff).length},
      quality:{ambiguous:scoped.filter(row => row.ambiguous),issues:scoped.flatMap(row => row.issues.map(message => ({id:row.id,message}))),overflow:totalCents === null}};
  }
  global.DemoPortfolio = Object.freeze({CUTOFF,CATEGORIES,PERIODS,FAMILIES,TYPES,SEGMENTS,calendarDate,localDate,days,statusAge,compactFolio,projectFolio,projectTitle,projectMatches,coveragePeriods,range,inRange,hasPrice,sum,segment,project,compute});
})(globalThis);
