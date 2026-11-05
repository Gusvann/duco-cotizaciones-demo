// Inserted into the local D85 derivative, inside the native client closure.
export const phoneRendering = String.raw`
  function phoneState() {
    const source=String(app.q?.contactPhone||'');
    const quoteId=app.q?.id||'',versionId=app.q?.versionId||'';
    const prior=app.phoneDraft;
    if(prior?.quoteId===quoteId&&prior?.versionId===versionId&&prior?.source===source)return prior;
    const parsed=/^(\+[1-9]\d{0,2}) +([0-9(][0-9 ()-]*)$/i.exec(source);
    const match=parsed&&/\d/.test(parsed[2])?parsed:null;
    const country=match?.[1]||(!source?'+52':'');
    app.phoneDraft={quoteId,versionId,source,mode:!source||match?'split':'legacy',country,
      choice:country?DemoPhone.selectionFor(country):'',number:match?.[2]||'',errorControl:'',error:''};
    return app.phoneDraft;
  }
  function phoneEditor() {
    const state=phoneState(),issue=[...app.inputErrors.values(),...app.issues].find(i=>i.target?.entity==='quote'&&i.target.field==='contactPhone');
    const ambiguous=DemoPhone.analyze(state.source).ambiguous;
    const error=state.error||issue?.message||(ambiguous?'Revisa el número original para retirar la extensión.':'');
    const options=DemoPhone.countries.map(row=>'<option value="'+esc(row.id)+'" '+(state.choice===row.id?'selected':'')+'>'+esc(row.name+' ('+row.dial+')')+'</option>').join('');
    const shared=state.choice.startsWith('shared:')?'<option value="'+esc(state.choice)+'" selected>'+esc(state.country+' · código compartido')+'</option>':'';
    const choice='<div class="phone-piece"><label for="contact-phone-country">Lada de país</label><select id="contact-phone-country" data-phone-part="country" aria-describedby="contact-phone-error" aria-invalid="'+!!error+'"><option value="" '+(!state.choice?'selected':'')+'>Selecciona un país</option>'+shared+options+'<option value="other" '+(state.choice==='other'?'selected':'')+'>Otra lada</option></select></div>';
    const custom=state.choice==='other'?'<div class="phone-piece"><label for="contact-phone-custom">Otra lada</label><input id="contact-phone-custom" data-phone-part="custom" type="tel" value="'+esc(state.country)+'" aria-describedby="contact-phone-error" aria-invalid="'+!!error+'" autocomplete="off"></div>':'';
    const number='<div class="phone-piece phone-number"><label for="contact-phone-number">Número</label><input id="contact-phone-number" data-phone-part="number" type="tel" value="'+esc(state.number)+'" aria-describedby="contact-phone-error" aria-invalid="'+!!error+'" autocomplete="off"></div>';
    return '<div id="contact-phone-group" class="field contact-phone" role="group" aria-labelledby="contact-phone-title"><div class="phone-heading"><span id="contact-phone-title">Número de contacto</span></div>'+
      (state.mode==='legacy'?'<div class="phone-legacy"><input id="contact-phone-original" type="tel" readonly aria-label="Número de contacto original" aria-describedby="contact-phone-hint contact-phone-error" value="'+esc(state.source)+'"><button type="button" class="quiet" data-action="edit-phone">Revisar para editar</button></div><p id="contact-phone-hint" class="hint">Se conserva el número original. Revísalo si deseas editarlo.</p>':'<div class="phone-pieces'+(state.choice==='other'?' has-custom':'')+'">'+choice+custom+number+'</div>')+
      '<div class="error" id="contact-phone-error" role="status">'+esc(error)+'</div></div>';
  }
`;

export const phoneUpdating = String.raw`
  function updatePhone(el) {
    if(!editable()||app.busy)return;
    const part=el.dataset.phonePart;
    if(!['country','custom','number'].includes(part))return;
    const state=phoneState();if(state.mode!=='split')return;
    beginCapture();markContactEdited('contactPhone');
    const previousCountry=state.country;
    if(part==='country') {
      state.choice=el.value;
      const country=DemoPhone.countries.find(row=>row.id===state.choice);
      state.country=country?.dial||(state.choice.startsWith('shared:')?state.choice.slice(7):'');
    } else if(part==='custom') state.country=el.value;
    else state.number=el.value;
    state.error='';state.errorControl='';
    const country=state.country.trim(),number=state.number.trim();
    const invalid=(control,message)=>{state.errorControl='contact-phone-'+control;state.error=message;};
    if(number&&!/^\+[1-9]\d{0,2}$/.test(country))invalid(state.choice==='other'?'custom':'country','Indica la lada de país con + y de uno a tres dígitos.');
    else if(number&&(!/^[0-9(][0-9 ()-]*$/.test(number)||!/\d/.test(number)))invalid('number','El número debe contener dígitos; puede incluir espacios, paréntesis o guiones.');
    const composed=number?country+' '+number:'';
    if(!state.error){try{D.str(composed,60);}catch(_){invalid('number','El teléfono completo, incluida la lada, no debe superar 60 caracteres.');}}
    const issue=D.issue(app.q,'contactPhone',state.error,{},'INPUT_INVALID'),key=JSON.stringify(issue.target);
    app.inputErrors.delete(key);
    app.issues=app.issues.filter(i=>!(i.target?.entity==='quote'&&i.target.field==='contactPhone'));
    if(state.error)app.inputErrors.set(key,issue);
    else if(!(part==='country'&&previousCountry===state.country&&state.source)) {app.q.contactPhone=composed;state.source=composed;}
    dirty();
    if(part==='country'){
      const group=$('#contact-phone-group');if(group)group.outerHTML=phoneEditor();
      $(state.choice==='other'?'#contact-phone-custom':'#contact-phone-country')?.focus();
    } else {
      const group=$('#contact-phone-group');
      group?.querySelectorAll('input,select').forEach(node=>node.setAttribute('aria-invalid',String(!!state.error)));
      const error=$('#contact-phone-error');if(error)error.textContent=state.error;
    }
  }
`;
