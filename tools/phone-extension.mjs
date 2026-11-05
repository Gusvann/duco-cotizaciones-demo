import {phoneRendering,phoneUpdating} from '../src/phone-client.mjs';

function once(source,from,to) {
  if(source.split(from).length!==2)throw new Error('Phone extension anchor changed: '+from.slice(0,90));
  return source.replace(from,to);
}
function block(source,start,end,replacement) {
  if(source.split(start).length!==2||source.split(end).length!==2)throw new Error('Phone extension boundary changed');
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  if(b<0)throw new Error('Phone extension boundary order changed');
  return source.slice(0,a)+replacement.trimStart()+'\n'+source.slice(b);
}
// Only the generated integrated demo changes; src/cotizador.html stays byte-for-byte D85.
export function extendPhone(source) {
  source=block(source,'  function phoneState() {','  function markContactEdited(field) {',phoneRendering);
  source=block(source,'  function updatePhone(el) {','  function first() {',phoneUpdating);
  source=once(source,"if(el.dataset.phonePart){if(el.type!=='checkbox')updatePhone(el);return;}","if(el.dataset.phonePart){if(el.tagName!=='SELECT')updatePhone(el);return;}");
  source=once(source,"if(el.dataset.phonePart){if(el.type==='checkbox')updatePhone(el);return;}","if(el.dataset.phonePart){if(el.tagName==='SELECT')updatePhone(el);return;}");
  source=once(source,"const state=phoneState();state.mode='split';state.country='';state.number=state.source;state.extension='';state.extensionEnabled=false;","const state=phoneState();state.mode='split';state.country='';state.choice='';state.number=state.source;");
  source=once(source,"(app.step===0?'Continuar a artículos →':'Siguiente →')","(app.step===0?'Continuar sin guardar →':'Siguiente →')");
  return source;
}
