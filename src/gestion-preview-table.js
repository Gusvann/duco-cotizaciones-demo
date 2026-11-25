(function () {
  'use strict';

  const priorities = {low: 'Baja', normal: 'Normal', high: 'Alta'};
  const finished = new Set(['accepted', 'rejected', 'converted', 'closed']);
  const calendar = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  function dueAlert(dueDate, status, today) {
    if (!dueDate || finished.has(status)) return '';
    const days = (Date.parse(dueDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
    if (days < 0) return 'Vencida';
    if (days === 0) return 'Vence hoy';
    if (days === 1) return 'Vence mañana';
    return '';
  }

  function render({records, selectedId, kind, statuses, escape, personLabel, dateLabel,
    today = calendar.format(new Date()), statusOptions}) {
    const project = kind === 'project';
    const collection = project ? 'proyectos' : 'cotizaciones';
    const labels = [project ? 'Proyecto' : 'Cotización', 'Etapa', 'Responsable', 'Fecha límite', 'Prioridad'];
    if (project) labels.push('Tareas');
    const headings = labels.map(label => '<th scope="col">' + label + '</th>').join('');
    const rows = records.map(record => {
      const id = escape(record.id);
      const title = escape(record.title);
      const selected = record.id === selectedId;
      const currentLabel = statuses.find(({id}) => id === record.status)?.label || 'Sin etapa';
      const choices = statusOptions ? statusOptions(record) : statuses.filter(({id}) => id !== 'converted');
      const progress = record.tasks.length;
      const done = record.tasks.filter(task => task.done).length;
      const priority = Object.hasOwn(priorities, record.priority) ? record.priority : 'normal';
      const alert = dueAlert(record.dueDate, record.status, today);
      const tone = ['accepted', 'converted', 'closed'].includes(record.status) ? ' good' : '';
      let statusControl = '<span class="j-pill' + tone + '">' + escape(currentLabel) + '</span>';
      if (record.status !== 'converted' && choices.some(choice => choice.id !== record.status)) {
        const options = choices.some(choice => choice.id === record.status)
          ? choices
          : [{id: record.status, label: currentLabel}, ...choices];
        statusControl = '<select class="j-pill gp-table-stage' + tone + '" data-move="' + id + '" aria-label="Etapa de ' + title + '">' +
          options.map(option => '<option value="' + escape(option.id) + '"' +
            (option.id === record.status ? ' selected' : '') + '>' + escape(option.label) + '</option>').join('') + '</select>';
      }
      const cells = [
        statusControl,
        escape(personLabel(record.owner) || 'Sin asignar'),
        escape(dateLabel(record.dueDate) || 'Sin fecha') + (alert
          ? '<div class="' + (alert === 'Vencida' ? 'j-aging' : 'j-sub') + '">' + alert + '</div>'
          : ''),
        priority === 'high' ? '<span class="j-pill warn">' + priorities.high + '</span>' : priorities[priority]
      ];
      if (project) cells.push(progress
        ? '<span class="gp-table-progress"><progress value="' + done + '" max="' + progress +
          '" aria-label="Tareas completadas"></progress><span aria-hidden="true">' + done + ' de ' + progress + '</span></span>'
        : '<span class="j-muted">Sin tareas</span>');
      return '<tr' + (selected ? ' class="gp-table-current"' : '') + '>' +
        '<td class="gp-table-name" role="rowheader"><button type="button" class="j-btn" data-select="' + id +
        '" aria-pressed="' + selected + '">' + title + '</button><div class="j-sub">' + escape(record.folio) + '</div></td>' +
        cells.map(cell => '<td>' + cell + '</td>').join('') + '</tr>';
    }).join('');
    const empty = '<tr><td class="j-empty" colspan="' + labels.length + '">No hay ' + collection + ' para mostrar con estos filtros.</td></tr>';
    return '<div class="j-table-wrap j-list-table gp-table-region" role="region" tabindex="0" aria-label="Mesa de ' +
      collection + '"><table class="j-table gp-table"><caption class="j-sr">' + (project ? 'Proyectos' : 'Cotizaciones') +
      '</caption><thead><tr>' + headings + '</tr></thead><tbody>' + (rows || empty) + '</tbody></table></div>';
  }

  window.GestionPreviewTable = Object.freeze({render});
})();
