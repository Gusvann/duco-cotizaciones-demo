// Apply the current workflow to the pinned calculator at build time.
// Coverage decisions are independent of the financial eligibility of their linked costs.
export function extendCoverageDefaults(html) {
  function replace(before, after) {
    if (!html.includes(before)) throw new Error('COVERAGE_WORKFLOW_ANCHOR: ' + before.slice(0, 60));
    html = html.replace(before, () => after);
  }
  replace('  function scopeImpact(q,base) {', `  function manufacturingResponsibilities(q) {
    const scope=manufacturingGeneralScope(q);
    if(!scope)return null;
    return {packagingMethod:scope.packaging?.method||'',indirectMethod:scope.indirectMethod||'',
      transport:scope.transport||[],percentages:(scope.generalPercentages||[]).map(p=>[p.id,p.needId,p.itemId,p.method])};
  }
  function scopeImpact(q,base) {`);
  replace('if(canonical(manufacturingGeneralScope(q))!==canonical(manufacturingGeneralScope(base)))',
    'if(canonical(manufacturingResponsibilities(q))!==canonical(manufacturingResponsibilities(base)))');
  replace('  function prepareCoverage(input,base,actor) {', `  function installationOmitted(q,need){
    return need?.topic==='Instalación' && q.manufacturing?.installation==='no' && !!q.manufacturing.installationReason &&
      ['Pendiente','No requerida'].includes(need.resolution) && !q.coverageLinks.some(link=>link.needId===need.id);
  }
  function coverageDecisionApplies(q, need, links, base, impact) {
    if (!impact.impactDeclared || !need.description || !need.topic) return false;
    const duco = need.resolution === 'Cubierta por Duco';
    const exempt = ['Cubierta por cliente', 'No requerida'].includes(need.resolution);
    if (!(duco && links.length || exempt && need.reason && !links.length)) return false;
    // The fabrication projection owns these links; financial problems belong to the source.
    if (duco && /^NEC_MFG_/.test(need.id) && links.every(link =>
        /^LNK_MFG_/.test(link.id) && link.componentType === 'Costo' && QuoteManufacturing_.generated(link.componentId))) return true;
    // A sealed decision with a mismatched fingerprint cannot be reconstructed
    // from the draft alone. The caller separately checks fresh/matching evidence.
    if (!base) return !need.confirmedHash;
    if (!impact.affectedNeedIds.includes(need.id)) return true;
    if (impact.generalChanged) return false;
    const prior = base.needs.find(row => row.id === need.id);
    if (!prior) return true;
    if (['resolution','reason','itemId','topic','description'].some(key => prior[key] !== need[key])) return false;
    const priorLinks = base.coverageLinks.filter(link => link.needId === need.id);
    if (priorLinks.length !== links.length || links.some(link => !priorLinks.some(old =>
        old.componentType === link.componentType && old.componentId === link.componentId))) return false;
    const ownership = (quote, link) => {
      const component = (link.componentType==='Costo'?quote.costs:quote.resources).find(row=>row.id===link.componentId);
      const work = quote.workUnits.find(row=>row.id===component?.workId);
      return [component?.itemId,component?.nature,component?.external,component?.workId,work?.source].map(value=>value??null);
    };
    if(links.some(link=>canonical(ownership(q,link))!==canonical(ownership(base,link))))return false;
    if(impact.changedFields.some(change=>change.id===need.itemId&&change.field==='manufacturing')) {
      const shape=quote=>{
        const row=quote.manufacturing?.items?.find(item=>item.itemId===need.itemId);
        if(!row)return null;
        const select=(record,keys)=>keys.map(key=>record[key]??null);
        return {mode:row.mode,materials:row.materials.map(material=>select(material,[
          'id','groupId','purchaseGroup','type','name','quantity','unit','measureSource','length','width','lengthUnit',
          'metalForm','thickness','woodKind','specification','substrate','coating','gauge','profile','dimension'
        ])),processes:row.processes.map(process=>select(process,['id','type','name','execution','target','quantityScope','specification']))};
      };
      if(canonical(shape(q))!==canonical(shape(base)))return false;
    }
    // Price and quantity changes with the same responsibility do not change the agreement.
    return !impact.changedFields.some(change => change.entity === 'items' && change.id === need.itemId &&
      !['quantity','manufacturing'].includes(change.field));
  }
  function prepareCoverage(input,base,actor) {`);
  replace('      const links=q.coverageLinks.filter(l=>l.needId===n.id);\n      const requested=', `      const links=q.coverageLinks.filter(l=>l.needId===n.id);
      if (installationOmitted(q,n)) {
        return {id:n.id,resolution:'No requerida',reason:q.manufacturing.installationReason,confirmed:false,complete:true,derived:true};
      }
      const requested=`);
  const start = html.indexOf('      let complete=!!n.description&&!!n.topic&&confirmed;');
  const end = html.indexOf('\n    });', start);
  if (start < 0 || end < 0 || !html.slice(start, end).includes('NEED_UNRESOLVED')) throw new Error('COVERAGE_CAUSES_ANCHOR');
  html = html.slice(0, start) + `      const resolved=coverageDecisionApplies(q,n,links,context.base,impact);
      const pendingLinks=links.filter(link=>!componentGood.get(link.componentType+'|'+link.componentId));
      let cause='';
      if(!n.description||!n.topic) cause='description';
      else if(n.resolution==='Pendiente') cause='resolution';
      else if(n.resolution==='Cubierta por Duco') {
        if(!links.length) cause='links';
        else if(pendingLinks.length) cause='component';
      } else if(links.length) cause='conflict';
      else if(!n.reason) cause='reason';
      if(!cause&&!confirmed&&!resolved) cause='confirm';
      if(cause) {
        coverageComplete=false;
        out.push(issue(q,'needs.'+i+'.'+cause,'Revisa el alcance de '+(n.description||n.topic||'este concepto')+'.',{
          topic:n.topic,itemId:n.itemId,description:n.description,resolution:n.resolution,
          components:pendingLinks.map(link=>({type:link.componentType,id:link.componentId}))
        },'NEED_UNRESOLVED'));
      }
      return {id:n.id,resolution:n.resolution,confirmed:!!confirmed,complete:!cause,...(resolved&&!confirmed?{decisionFromData:true}:{})};` + html.slice(end);
  // Include source identity on an issue so projections can suppress a duplicate cost
  // without matching its display name or recomputing the deterministic ID.
  replace("if(!m.complete){t.complete=false;t.completeCosts=false;t.profit=null;t.margin=null;allIssues.push(...m.issues);}", `if(!m.complete){
        t.complete=false;t.completeCosts=false;t.profit=null;t.margin=null;
        for(const problem of m.issues){
          const sourceCostId=QuoteManufacturing_.issueCostId(q.manufacturing,problem);
          if(sourceCostId)problem.target.context.sourceCostId=sourceCostId;
          allIssues.push(problem);
        }
      }`);
  replace('  function dimensions(item,m){', `  function issueCostId(model,problem){
    const itemId=problem.target.parentId,id=problem.target.id,field=problem.field;
    if(field.startsWith('manufacturing.packaging')) return identity('CST_PACK_',itemId||model.id,itemId?'PACK':'GLOBAL');
    if(field.startsWith('manufacturing.indirect')) return identity('CST_INDIRECT_',model.id,'INDIRECT');
    if(field.startsWith('manufacturing.generalPercentages') && id) return identity('CST_MFG_PCT_',model.id,id);
    const row=model.items.find(item=>item.itemId===itemId);
    if(!row||!id)return '';
    const material=row.materials.find(m=>m.id===id);
    if(material)return identity('CST_MFG_',itemId,'M_'+(material.purchaseGroup||id));
    if(row.processes.some(p=>p.id===id))return identity('CST_MFG_',itemId,'P_'+id);
    return '';
  }
  function dimensions(item,m){`);
  replace('processTypes,generated,dimensions,woodMeasurements', 'processTypes,generated,issueCostId,dimensions,woodMeasurements');
  replace('newNeed, upgrade, scopeImpact, coverageFingerprint, prepareCoverage, evaluate,', 'newNeed, upgrade, scopeImpact, coverageFingerprint, prepareCoverage, installationOmitted, evaluate,');
  replace("    if(scoped)value.resolution=stage.responsible", `    if(!scoped&&D.installationOmitted(app.q,need)){
      value.resolution='No requerida';value.reason=app.q.manufacturing.installationReason;
    }
    if(scoped)value.resolution=stage.responsible`);
  return html;
}
