/* Local session capture. This never creates or confirms a saved quote snapshot. */
function installSessionAutosave() {
  const previousGuard=breakdownGuard,previousPartGuard=partGuard;
  const previousSet=solidWoodSet,previousRowHtml=breakdownEditorHtml,previousWoodHtml=solidWoodEditorHtml;
  const previousDiscard=partDiscard,previousAction=breakdownAction;
  let timer=null,running=false,sequence=0;
  const statusKey=()=>JSON.stringify(partContext());
  const eligible=()=>recipeCanEdit()&&!app.busy&&!app.operation&&app.partDraft&&partSameContext(app.partDraft.context);
  const status=(state,text)=>{
    app.rowAutosave={context:statusKey(),state,text};
    quoteRoot.querySelectorAll('[data-row-autosave-status]').forEach(node=>{node.textContent=text;});
  };
  const focusState=()=>{
    const node=document.activeElement;
    return node&&quoteRoot.contains(node)?{id:node.id,start:node.selectionStart,end:node.selectionEnd}:null;
  };
  const restoreFocus=value=>{
    if(!value?.id)return;
    const context=statusKey();
    requestAnimationFrame(()=>{
      if(context!==statusKey())return;
      const node=quoteRoot.querySelector('#'+CSS.escape(value.id));
      if(!node||node.disabled)return;
      node.focus({preventScroll:true});
      if(value.start!=null&&node.setSelectionRange)node.setSelectionRange(value.start,value.end);
    });
  };
  function cancel(){sequence++;if(timer!==null)clearTimeout(timer);timer=null;app.rowAutosave=null;}
  const cloneWood=()=>app.solidWoodLocal?{...app.solidWoodLocal,articles:new Map([...app.solidWoodLocal.articles].map(([id,value])=>[id,breakdownClone(value)]))}:null;
  function restoreEditor(draft) {
    if(!draft)return;
    const row=breakdownRow(draft.itemId);
    if(draft.solidWoodF){
      const value=solidWoodEntries(draft.itemId).find(piece=>piece.id===draft.solidWoodF.id);
      if(!value)return;
      draft.solidWoodF=breakdownClone(value);draft.cncStage=breakdownClone(value.cnc);
      draft.initial=JSON.stringify(draft.solidWoodF);
    }else{
      const list=draft.kind==='process'?row.processes:draft.kind==='group'?row.groups:draft.kind==='finish'?row.finishSystems:row.materials;
      const value=list.find(entry=>entry.id===draft.value.id);if(!value)return;
      draft.value=breakdownClone(value);
      if(draft.group)draft.group=breakdownClone(row.groups.find(group=>group.id===value.groupId)||draft.group);
      draft.initial=JSON.stringify({value:draft.value,group:draft.group,layers:draft.layers});
    }
    draft.isNew=false;draft.forceDirty=false;draft.error='';draft.numericErrors={};draft.rawValues={};
    delete draft.copiedProcesses;delete draft.copiedSystems;delete draft.pendingGroupIds;delete draft.pendingGroupKey;
    draft.context=partContext();draft.owner=app.user.email;draft.quoteId=app.q.id;draft.versionId=app.q.versionId;
    app.breakdownEditor=draft;
  }
  function flush(options={}) {
    // 5 Nov: wood is an explicit per-piece transaction. Neither a timer nor
    // navigation may silently confirm it; other component capture stays automatic.
    if(app.breakdownEditor?.solidWoodF&&breakdownDraftDirty()&&!options.confirmWood)return false;
    if(options.onlyScheduled&&(app.rowAutosave?.context!==statusKey()||app.rowAutosave.state!=='editing'))return true;
    sequence++;
    if(timer!==null){clearTimeout(timer);timer=null;}
    if(running)return false;
    if(!app.partDraft)return true;
    if(!eligible()||app.breakdownContinuation||app.partContinuation)return false;
    if(!partDraftDirty()){status('saved','Cambios conservados durante esta sesión.');return true;}
    const keep=options.keepEditor!==false,focus=focusState();
    const before={q:app.q,partDraft:QuotePartDraft.clone(app.partDraft),breakdownEditor:app.breakdownEditor?QuotePartDraft.clone(app.breakdownEditor):null,
      solidWoodLocal:cloneWood(),syntheticRecipes:app.syntheticRecipes?breakdownClone(app.syntheticRecipes):null,
      technicalDrafts:new Map(app.technicalDrafts),technicalSummaryErrors:new Map(app.technicalSummaryErrors),dirty:app.dirty};
    const repaint=editor;running=true;editor=()=>{};
    let ok=false,error='';
    try{
      const draft=app.breakdownEditor;
      if(draft&&breakdownDraftDirty()){
        // Keep economic review exactly as captured; automatic capture is not approval.
        const reviewed=draft.value?.economicReviewed,sourceReviewed=draft.value?.source?.reviewed;
        if(!breakdownSave())throw Error(draft.error||'Corrige los datos de esta fila.');
        if(!draft.solidWoodF){
          const row=breakdownRow(draft.itemId),value=(draft.kind==='process'?row.processes:row.materials).find(entry=>entry.id===draft.value.id);
          if(value&&reviewed!==undefined)value.economicReviewed=reviewed;
          if(value?.source&&sourceReviewed!==undefined)value.source.reviewed=sourceReviewed;
        }
      }
      if(partDraftDirty()&&!partApply())throw Error(app.partDraft?.error||'No se pudieron conservar los cambios del artículo.');
      if(keep)restoreEditor(before.breakdownEditor);
      status('saved','Cambios conservados durante esta sesión.');ok=true;
    }catch(caught){
      error=caught?.message||'Revisa los datos antes de continuar.';
      Object.assign(app,before);
      if(app.breakdownEditor)app.breakdownEditor.error=error;
      if(app.partDraft)app.partDraft.error=error;
      status('invalid',error);
    }finally{editor=repaint;running=false;}
    editor();restoreFocus(focus);
    return ok;
  }
  function schedule() {
    if(app.breakdownEditor?.solidWoodF){sequence++;if(timer!==null)clearTimeout(timer);timer=null;return;}
    if(!eligible()||running)return;
    if(timer!==null)clearTimeout(timer);
    const context=statusKey(),itemId=app.partDraft.itemId,draftId=app.breakdownEditor?.value?.id||'',ticket=++sequence;
    status('editing','Conservando cambios…');
    timer=setTimeout(()=>{
      if(ticket!==sequence)return;
      timer=null;
      if(context!==statusKey()||app.partDraft?.itemId!==itemId||(app.breakdownEditor?.value?.id||'')!==draftId||!eligible())return;
      flush();
    },450);
  }
  solidWoodSet=function(key,value){
    const result=previousSet(key,value),draft=app.breakdownEditor;
    if(result&&key==='cnc.decision'&&draft?.solidWoodF&&['','yes','no'].includes(String(value))){
      // A yes/no decision is retained even without cutting data. The calculator
      // still reports incomplete CNC and never invents a length or a tariff.
      draft.solidWoodF.cnc=breakdownClone(solidWoodCncStage(draft));
      solidWoodRefresh();
    }
    return result;
  };
  breakdownGuard=function(continuation){
    if(app.breakdownEditor?.solidWoodF)return previousGuard(continuation);
    if(!running&&app.breakdownEditor&&breakdownDraftDirty()){
      if(!flush({keepEditor:false}))return false;
    }
    return previousGuard(continuation);
  };
  partGuard=function(continuation){
    if(app.breakdownEditor?.solidWoodF&&breakdownDraftDirty())return previousGuard(continuation);
    if(!running&&app.partDraft&&partDraftDirty()&&!flush({keepEditor:false}))return false;
    return previousPartGuard(continuation);
  };
  partDiscard=function(){cancel();return previousDiscard();};
  breakdownAction=async function(button){
    const action=button.dataset.breakAction,draft=app.breakdownEditor;
    if(draft?.solidWoodF&&['wood-confirm','save-continue'].includes(action)){
      if(!eligible())return false;
      const continuation=app.breakdownContinuation;
      app.breakdownContinuation=null;
      if(!breakdownDraftDirty()&&!partDraftDirty()){app.breakdownEditor=null;editor();if(continuation)continuation();return true;}
      const ok=flush({confirmWood:true,keepEditor:false});
      if(ok&&continuation)continuation();
      else if(!ok&&continuation)app.breakdownContinuation=continuation;
      return ok;
    }
    if(action==='wood-discard'){
      if(!eligible()||!draft?.solidWoodF)return false;
      cancel();app.breakdownEditor=null;editor();return true;
    }
    if(action==='cancel-editor')cancel();return previousAction(button);
  };
  function automaticHtml(html) {
    if(!html||!app.partDraft||app.breakdownEditor?.kind==='general')return html;
    const text=app.rowAutosave?.context===statusKey()?app.rowAutosave.text:'Los cambios se conservan automáticamente durante esta sesión.';
    return html
      .replace(/<button\b[^>]*data-break-action="save-editor"[^>]*>[\s\S]*?<\/button>/g,'')
      .replace(/(<div class="break-editor-actions">)<span class="meta">[\s\S]*?<\/span>/g,'$1<small data-row-autosave-status role="status" aria-live="polite">'+esc(text)+'</small>')
      .replace(/(data-break-action="cancel-editor"[^>]*>)Cancelar(?=<\/button>)/g,'$1Descartar captura pendiente');
  }
  breakdownEditorHtml=function(){return automaticHtml(previousRowHtml());};
  solidWoodEditorHtml=function(){return automaticHtml(previousWoodHtml());};
  for(const type of ['input','change'])quoteRoot.addEventListener(type,event=>{
    const data=event.target?.dataset||{};
    if(data.solidField||data.breakField||data.breakGroupField||data.breakLayer||/^items\./.test(data.path||'')||data.measureUnit!=null||data.partEstimateNet!=null||data.partEstimateTax!=null||data.partEstimateBasis!=null)schedule();
  });
  quoteRoot.addEventListener('focusout',event=>{
    const data=event.target?.dataset||{};
    if(data.solidField||data.breakField||data.breakGroupField||/^items\./.test(data.path||''))schedule();
  });
  return {flush,cancel};
}
function replaceOnce(source,before,after,name){
  if(source.split(before).length!==2)throw Error('Session capture anchor changed: '+name);
  return source.replace(before,after);
}
export function extendSessionAutosave(source) {
  source=replaceOnce(source,'<button type="button" class="primary" data-action="part-apply" data-id="\'+esc(r.id)+\'">Aplicar cambios</button>','','article apply button');
  source=replaceOnce(source,'data-action="part-discard" data-id="\'+esc(r.id)+\'">Descartar cambios</button>','data-action="part-discard" data-id="\'+esc(r.id)+\'">Descartar captura pendiente</button>','article pending discard');
  source=replaceOnce(source,'Artículo aplicado localmente. Cambios sin guardar.','Cambios conservados durante esta sesión.','article capture result');
  source=source.replaceAll('Aplicar el artículo no lo guarda: usa Guardar borrador y espera su confirmación por relectura.','Los cambios de esta sesión no sustituyen la última versión guardada.');
  return replaceOnce(source,'globalThis.__client = {','const rowSessionAutosave=('+installSessionAutosave.toString()+')();\nglobalThis.__client = {rowAutoFlush:rowSessionAutosave.flush,rowAutoCancel:rowSessionAutosave.cancel,','client capture extension');
}

