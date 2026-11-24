/* Loaded exclusively by the loopback server after authentication. */
(function () {
  'use strict';
  let csrf = '';
  async function request(path, payload) {
    const response=await fetch('/api/'+path,payload===undefined ? {cache:'no-store'} : {
      method:'POST', headers:{'Content-Type':'application/json','X-Duco-CSRF':csrf},body:JSON.stringify(payload)
    });
    const data=await response.json();
    if(!response.ok) throw Object.assign(new Error(data.message||'El servidor local no completó la operación.'),{status:response.status,code:data.code});
    return data;
  }
  const query = (route,params) => request(route+'?'+new URLSearchParams(params));
  window.DucoPrivateApi=Object.freeze({
    async initial() { const data=await request('initial'); csrf=data.csrf; return data; },
    put:(record,snapshot,revision)=>request('quote',{record,snapshot,revision}),
    get:id=>query('quote',{id}),
    suppliers:q=>query('suppliers',{q}),
    clients:q=>query('clients',{q}),
    clientContact:id=>query('client/contact',{id}),
    clientCreate:input=>request('client',input),
    clientCreateStatus:requestId=>query('client/status',{requestId}),
    catalog:()=>request('catalog'),
    lineStatus:({quoteId,itemId})=>query('line',{quoteId,itemId}),
    lineForSent:quoteId=>query('line/sent',{quoteId}),
    requestLine:input=>request('line/request',input),
    approveLine:input=>request('line/approve',input),
    async logout() { await request('logout',{}); location.replace('/acceso'); }
  });
  document.addEventListener('click',async event=>{
    const trigger=event.target.closest?.('[data-sent-line-list]');
    if(!trigger||trigger.disabled)return;
    const panel=trigger.closest('[data-sent-line-panel]');
    const status=panel?.querySelector('[data-sent-line-status]'),list=panel?.querySelector('[data-sent-line-rows]');
    if(!status||!list)return;
    trigger.disabled=true;status.textContent='Consultando solicitudes…';list.replaceChildren();
    try {
      const {requests}=await window.DucoPrivateApi.lineForSent(panel.dataset.sentLinePanel);
      if(!panel.isConnected)return;
      status.textContent=requests.length?'':'La versión enviada no tiene solicitudes pendientes.';
      for(const {id,revision,version,item} of requests){
        const row=document.createElement('div'),label=document.createElement('label'),check=document.createElement('input');
        const approve=document.createElement('button'),feedback=document.createElement('p');
        row.className='j-spaced';
        label.className='j-check';check.type='checkbox';
        label.append(check,document.createTextNode('Autorizar '+item+' · V'+version+' · revisión '+revision));
        approve.type='button';approve.className='j-btn j-primary';approve.textContent='Guardar autorización';approve.disabled=true;
        feedback.setAttribute('role','status');
        check.addEventListener('change',()=>{approve.disabled=!check.checked;});
        approve.addEventListener('click',async()=>{
          if(!check.checked||approve.disabled||!row.isConnected)return;
          approve.disabled=true;check.disabled=true;feedback.textContent='Guardando autorización…';
          try {
            const response=await window.DucoPrivateApi.approveLine({id,revision});
            if(response.request?.id!==id||response.request?.status!=='approved')throw Error('Resultado sin confirmar.');
            feedback.textContent='Receta autorizada.';label.remove();approve.remove();
          } catch(error){
            feedback.textContent=[403,409,422].includes(error.status)?error.message:'Vuelve a consultar para verificar el resultado.';
          }
        });
        row.append(label,approve,feedback);list.append(row);
      }
    } catch(error){
      status.textContent=[401,403].includes(error.status)?error.message:'No se pudieron consultar las solicitudes.';
    } finally {trigger.disabled=false;}
  });
})();
