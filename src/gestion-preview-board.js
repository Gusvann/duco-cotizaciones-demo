(() => {
  'use strict';

  const finished = new Set(['rejected', 'converted', 'closed']);
  const localDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' });

  function taskProgress(record) {
    const total = record.tasks?.length ?? 0;
    if (!total) return '';
    const done = record.tasks.filter(task => task.done).length;
    return '<div class="gp-board-progress"><progress value="' + done + '" max="' + total +
      '" aria-label="Tareas completadas"></progress><span>' + done + ' de ' + total + ' tareas</span></div>';
  }

  function stageControl(record, options, escape) {
    if (!options.length) return '';
    return '<div class="j-next"><select class="j-input gp-board-move" data-move="' + escape(record.id) + '" aria-label="Mover ' +
      escape(record.title) + ' a otra etapa"><option value="" selected disabled>Mover a…</option>' +
      options.map(stage => '<option value="' + escape(stage.id) + '">' + escape(stage.label) + '</option>').join('') +
      '</select></div>';
  }

  function card(record, context, today) {
    const { escape, personLabel, dateLabel, selectedId, statusOptions } = context;
    const options = statusOptions(record).filter(stage => stage.id !== record.status);
    const grip = options.length ? '<span class="gp-board-grip" title="Arrastrar a otra etapa" aria-hidden="true">⠿</span>' : '';
    const isLate = record.dueDate && record.dueDate < today && !finished.has(record.status);
    const date = record.dueDate ? dateLabel(record.dueDate) : 'Sin fecha';
    const priority = record.priority === 'high' ? '<span class="j-pill warn">Prioridad alta</span>' : '';
    return '<article class="j-card gp-board-card' + (record.id === selectedId ? ' is-selected' : '') + '"' +
      (options.length ? ' draggable="true"' : '') + '>' +
      '<div class="gp-board-card-heading"><span class="j-sub">' + escape(record.folio) + '</span>' + grip + '</div>' +
      '<h3><button type="button" class="j-btn gp-board-title" data-select="' + escape(record.id) + '" aria-pressed="' +
      (record.id === selectedId) + '">' + escape(record.title) + '</button></h3>' +
      '<p class="j-muted"><span class="j-sr">Responsable </span>' + escape(personLabel(record.owner) || 'Sin responsable') + '</p>' +
      '<div class="j-sub">Fecha límite · ' + escape(date) + '</div>' +
      (isLate ? '<div class="j-aging">Vencimiento superado</div>' : '') + priority +
      taskProgress(record) + stageControl(record, options, escape) + '</article>';
  }

  function render(context) {
    const { escape, kind, records, statuses } = context;
    const today = context.today || localDay.format(new Date());
    const label = kind === 'project' ? 'proyectos' : 'cotizaciones';
    const groups = new Map(statuses.map(status => [status.id, []]));
    for (const record of records) {
      groups.get(record.status)?.push(record);
    }
    const columns = statuses.map(stage => {
      const group = groups.get(stage.id);
      const stageId = 'gp-board-stage-' + escape(stage.id);
      const content = group.map(record => card(record, context, today)).join('');
      return '<section class="j-lane gp-board-lane" data-stage="' + escape(stage.id) +
        '" aria-labelledby="' + stageId + '"><header class="j-lane-head"><h2 id="' + stageId + '">' +
        escape(stage.label) + '</h2><span aria-label="' + group.length + ' ' + label + '">' +
        group.length + '</span></header>' + (content || '<p class="j-empty">Sin ' + label + '</p>') + '</section>';
    });
    return '<div class="gp-board-shell"><div class="j-board gp-board" role="region" aria-label="Tablero de ' + label +
      ' por etapa" tabindex="0">' + columns.join('') + '</div></div>';
  }

  function bindDrag(results, moveRecord) {
    let drag = null;
    let touch = null;
    let highlighted = null;
    let scrollFrame = 0;

    function highlight(lane) {
      if (lane === highlighted) return;
      highlighted?.classList.remove('gp-drop-target');
      highlighted = lane;
      highlighted?.classList.add('gp-drop-target');
    }

    function finish(lane = null) {
      const id = drag?.id;
      const stage = lane?.dataset.stage;
      const captured = touch;
      touch = null;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      highlight(null);
      drag?.card.classList.remove('gp-dragging');
      drag = null;
      if (captured?.grip.hasPointerCapture(captured.pointerId)) captured.grip.releasePointerCapture(captured.pointerId);
      if (id && stage) moveRecord(id, stage);
    }

    function begin(card) {
      const select = card?.querySelector('[data-move]');
      if (!select) return false;
      drag = {card, id:select.dataset.move, allowed:new Set([...select.options].map(option=>option.value))};
      card.classList.add('gp-dragging');
      return true;
    }

    function target(element) {
      const lane = element?.closest('.gp-board-lane');
      return drag?.card.isConnected && lane && results.contains(lane) && drag.allowed.has(lane.dataset.stage) ? lane : null;
    }

    // Keep the dragged record inside this board. External drops carry no record identity.
    results.addEventListener('dragstart', event=>{
      const card = event.target.closest('.gp-board-card[draggable="true"]');
      if (touch || !card || event.target.closest('select') || !begin(card)) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-duco-board-move','move');
    });
    results.addEventListener('dragover', event=>{
      const lane = target(event.target);
      highlight(lane);
      if (lane) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    });
    results.addEventListener('dragleave', event=>{
      if (!highlighted?.contains(event.relatedTarget)) highlight(null);
    });
    results.addEventListener('drop', event=>{
      const lane = target(event.target);
      if (lane) event.preventDefault();
      finish(lane);
    });
    results.addEventListener('dragend', ()=>finish());

    function touchTarget() {
      return target(document.elementFromPoint(touch.x, touch.y));
    }
    function scrollAtEdge() {
      scrollFrame = 0;
      if (!touch || !drag) return;
      const edge = 54;
      const top = results.ownerDocument.querySelector('.j-top').getBoundingClientRect().bottom;
      const dy = touch.y > innerHeight - edge ? 12 : touch.y < top + edge ? -12 : 0;
      if (!dy) return;
      const previous = window.scrollY;
      window.scrollBy(0, dy);
      highlight(touchTarget());
      if (window.scrollY !== previous) scrollFrame = requestAnimationFrame(scrollAtEdge);
    }

    // Touch and pen use a handle so ordinary swipes on the cards still scroll.
    results.addEventListener('pointerdown', event=>{
      const grip = event.target.closest('.gp-board-grip');
      if (event.pointerType === 'mouse' || !event.isPrimary || event.button !== 0 || !grip || touch) return;
      touch = {grip, pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, x:event.clientX, y:event.clientY};
      grip.setPointerCapture(event.pointerId);
    });
    results.addEventListener('pointermove', event=>{
      if (touch?.pointerId !== event.pointerId) return;
      touch.x = event.clientX;
      touch.y = event.clientY;
      if (!drag) {
        if (Math.hypot(touch.x - touch.startX, touch.y - touch.startY) < 5) return;
        if (!begin(touch.grip.closest('.gp-board-card'))) return finish();
      }
      highlight(touchTarget());
      if (!scrollFrame) scrollFrame = requestAnimationFrame(scrollAtEdge);
    });
    results.addEventListener('pointerup', event=>{
      if (touch?.pointerId !== event.pointerId) return;
      finish(target(document.elementFromPoint(event.clientX, event.clientY)));
    });
    for (const eventName of ['lostpointercapture','pointercancel']) {
      results.addEventListener(eventName, event=>{ if (event.pointerId === touch?.pointerId) finish(); });
    }
    document.addEventListener('keydown', event=>{ if (event.key === 'Escape' && (drag || touch)) finish(); });
  }

  window.GestionPreviewBoard = Object.freeze({render, bindDrag});
})();
