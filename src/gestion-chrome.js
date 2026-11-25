(() => {
  'use strict';
  const chrome = document.getElementById('gp-chrome');
  const mobile = window.matchMedia('(max-width:750px)');
  const workspace = window.location.protocol === 'file:' ? 'index.html' : './';
  const workspaceLink = (label,section) =>
    '<a class="j-nav-link j-gestion-entry" href="'+workspace+'?modulo='+section+'" target="_blank" rel="noopener">'+label+' <span aria-hidden="true">↗</span></a>';
  const moduleButton = (kind,label) =>
    '<button type="button" class="j-nav-link" data-kind="'+kind+'" aria-pressed="false">'+label+'<span class="j-active-dot" aria-hidden="true" hidden></span></button>';

  chrome.innerHTML = window.AstilChrome.sidebar({
    openGroup:'portfolio', menuOpen:false, modal:false,
    operationEntries:[workspaceLink('Producción','production'),workspaceLink('Entregas','deliveries')],
    portfolioEntries:[workspaceLink('KPIs','kpis'),moduleButton('quote','Cotizador'),moduleButton('project','Proyectos')],
    accountLabel:'Gestión DUCO', accountDetail:'Vista de prueba'
  }) + '<button type="button" class="j-sidebar-backdrop" data-action="close-menu" aria-label="Cerrar menú" hidden></button>' +
    window.AstilChrome.topbar(false,'<span class="j-demo">SÓLO EN ESTA SESIÓN</span><button type="button" class="j-btn" id="gp-reset" data-action="reset">Reiniciar prueba</button>') +
    '<nav class="j-breadcrumb" aria-label="Ubicación"><a href="'+workspace+'" aria-label="Volver al espacio de trabajo">Portafolio</a> <span aria-hidden="true">›</span> <span id="gp-crumb-kind" aria-current="page">Cotizaciones</span></nav>';

  const sidebar = chrome.querySelector('#j-sidebar');
  const toggle = chrome.querySelector('.j-mobile-menu');
  const backdrop = chrome.querySelector('.j-sidebar-backdrop');
  const groups = Array.from(sidebar.querySelectorAll('details[data-nav-group]'));
  const content = document.getElementById('gp-app');

  function setKind(kind) {
    for (const button of sidebar.querySelectorAll('[data-kind]')) {
      const active = button.dataset.kind === kind;
      button.setAttribute('aria-pressed', String(active));
      button.className = active ? 'j-nav-current' : 'j-nav-link';
      button.querySelector('.j-active-dot').hidden = !active;
      if (active) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    document.getElementById('gp-crumb-kind').textContent = kind === 'project' ? 'Proyectos' : 'Cotizaciones';
  }

  function setMenu(open) {
    sidebar.classList.toggle('j-sidebar-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    backdrop.hidden = !open;
    content.inert = open;
    if (open) {
      sidebar.setAttribute('role','dialog');
      sidebar.setAttribute('aria-modal','true');
      const group = groups.find(element=>element.open) || groups[0];
      group.querySelector('summary').focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (mobile.matches) toggle.focus();
    }
  }

  chrome.addEventListener('click',event=>{
    const heading = event.target.closest('summary');
    if (heading) {
      for (const group of groups) if (group !== heading.parentElement) group.open = false;
    } else if (toggle.contains(event.target)) setMenu(backdrop.hidden);
    else if (!backdrop.hidden && (event.target === backdrop || event.target.closest('[data-kind],a[href]'))) setMenu(false);
  });
  document.addEventListener('keydown',event=>{
    if (backdrop.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false);
    } else if (event.key === 'Tab') {
      const controls = [...sidebar.querySelectorAll('summary, details[open] button, details[open] a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (!sidebar.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }
  });
  mobile.addEventListener('change',()=>{if (!backdrop.hidden) setMenu(false);});

  window.GestionChrome = Object.freeze({setKind});
  setKind('quote');
})();
