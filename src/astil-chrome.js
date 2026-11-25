/* Shared Astil workspace navigation and wordmark. */
(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Vector wordmark from AstilBrand, including the uniform lowercase s correction.
  function brandMarkup(className = '') {
    return `<span class="j-brand ${className}" aria-label="Astil"><svg class="j-sidebar-logo" viewBox="0 0 272 100" aria-hidden="true" focusable="false"><g class="j-wordmark-ink"><path d="M4 92 37 12h16L27 92Z"/><path d="m42 12 15-1 34 81H68Z"/><path d="M156 32h-34c-8 0-13 4-13 9s5 8 13 8h17c15 0 24 8 24 21s-10 22-27 22H98V77h38c7 0 11-3 11-8s-4-7-11-7h-17c-16 0-25-8-25-22 0-13 11-22 28-22h34Z" transform="translate(128.5 92) scale(0.8108108108108109) translate(-128.5 -92)"/><path d="m169 24 16-16v24h14v14h-14v22c0 7 4 10 11 10h5v14h-8c-16 0-24-8-24-23Z"/><path d="M211 32h16v60h-16Z"/><path d="m237 24 16-16v60c0 7 4 10 11 10h3v14h-7c-15 0-23-8-23-23Z"/></g><path class="j-wordmark-accent" d="m35 92 11-27 12 27z"/><rect class="j-wordmark-accent" x="211" y="8" width="16" height="16"/></svg></span>`;
  }

  function navIcon(name) {
    const paths = {
      panorama:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      finance:'<path d="M4 20V4m0 16h16M8 15l4-5 4 3 5-8"/>',
      inventory:'<path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',
      portfolio:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v3h4v-3"/>',
      treasury:'<path d="m3 9 9-6 9 6H3zm2 3v7m7-7v7m7-7v7M3 22h18"/>',
      menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
      chevron:'<path d="m6 9 6 6 6-6"/>'
    };
    return `<svg class="j-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || ''}</svg>`;
  }

  function sidebar({menuOpen, modal, openGroup, operationEntries, portfolioEntries, accountLabel, accountDetail}) {
    const inactive = (name, label) => `<div class="j-module j-nav-disabled" aria-disabled="true" title="No disponible">${navIcon(name)}<span>${label}</span></div>`;
    const group = (key,label,entries) => `<details class="j-nav-group" data-nav-group="${key}"${openGroup === key ? ' open' : ''}><summary class="j-module">${navIcon('portfolio')}<span>${label}</span>${navIcon('chevron')}</summary><div class="j-nav-submenu">${entries.join('')}</div></details>`;
    const operationMenu = group('operations','Operación',operationEntries);
    const portfolioMenu = group('portfolio','Portafolio',portfolioEntries);
    return `<aside id="j-sidebar" class="j-sidebar${menuOpen ? ' j-sidebar-open' : ''}" aria-label="Navegación de Astil"${modal ? ' role="dialog" aria-modal="true"' : ''}>${brandMarkup()}<p class="j-sidebar-subtitle">GESTIÓN EMPRESARIAL</p><nav aria-label="Módulos">${inactive('panorama','Panorama')}${inactive('finance','Finanzas')}${inactive('inventory','Inventario')}${operationMenu}${portfolioMenu}${inactive('treasury','Tesorería')}<p class="j-nav-scope">Cotizaciones, proyectos y entrega.</p></nav><div class="j-sidebar-bottom"><span class="j-avatar" aria-hidden="true">D</span><span><strong>${escape(accountLabel)}</strong><small>${escape(accountDetail)}</small></span></div></aside>${menuOpen ? '<button type="button" class="j-sidebar-backdrop" data-action="close-menu" aria-label="Cerrar menú"></button>' : ''}`;
  }

  function topbar(menuOpen, actions) {
    return `<header class="j-top"><div class="j-top-identity"><button type="button" class="j-mobile-menu" data-action="toggle-menu" aria-label="Abrir menú" aria-expanded="${menuOpen}" aria-controls="j-sidebar">${navIcon('menu')}</button>${brandMarkup('j-mobile-brand')}<span class="j-top-name">DUCO</span><span class="j-top-divider">/</span><span class="j-top-caption">Espacio de trabajo</span></div><div class="j-top-actions">${actions}</div></header>`;
  }
  window.AstilChrome = Object.freeze({brandMarkup, sidebar, topbar});
})();
