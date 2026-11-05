// Local demo adaptation; the frozen native D85 source is never modified.
function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw Error('Article adaptation anchor changed: ' + label);
  return source.replace(before, after);
}

export function extendArticleMeasures(source) {
  const field = "(s.na?field(`items.${i}.specs.${j}.reason`,s.type+' · Motivo',{max:300}):field(`items.${i}.specs.${j}.value`,s.type,{type:'number',digits:3,positive:true}))+check(`items.${i}.specs.${j}.na`,'No se requiere',true)";
  source = replaceOnce(source, field, "field(`items.${i}.specs.${j}.value`,s.type,{type:'number',digits:3,positive:true})", 'measure fields');

  // Empty measurements are optional in this demo. A captured measurement
  // still needs a unit and positive numeric value; inherited calculations keep
  // their own missing-dimension checks. Historical no-apply values are retained.
  source = replaceOnce(source, "          if (!s.reason) add(p + 'reason', 'Explica por qué no aplica esta medida.');\n", '', 'no-apply reason');
  source = replaceOnce(source, "          if (!s.value) add(p + 'value', 'Completa el valor de la medida.');\n", '', 'blank measure');
  source = replaceOnce(source, "if (!s.unit) add(p + 'unit', 'Selecciona la unidad de la medida.');", "if (s.value && !s.unit) add(p + 'unit', 'Selecciona la unidad de la medida.');", 'measure unit');
  source = replaceOnce(source, "const f=(s.na && field==='value') || (!s.na && field==='reason')?'na':field;", "const f=['na','reason'].includes(field)?'value':field;", 'legacy issue target');

  // Editing a historical no-apply measurement turns it into an explicit value;
  // merely opening it or leaving it blank never changes its flag or reason.
  const previous = "else {set(path,el.type==='checkbox'?el.checked:value);if(/specs\\.\\d+\\.na$/.test(path)&&el.checked)set(path.replace(/na$/,'value'),'');}";
  const next = "else {const match=/^items\\.\\d+\\.specs\\.(\\d+)\\.value$/.exec(path||'');const item=tx.quote.items[index],spec=match?item.specs[Number(match[1])]:null,shared=spec?.na?itemMeasureUnit(item):'';set(path,el.type==='checkbox'?el.checked:value);if(spec?.na&&value!==''&&!tx.raw[key]&&Number(value)>0){spec.na=false;if(shared)spec.unit=shared;}if(/specs\\.\\d+\\.na$/.test(path)&&el.checked)set(path.replace(/na$/,'value'),'');}";
  source = replaceOnce(source, previous, next, 'historical measure edit');
  source = replaceOnce(source,
    "tx.quote.items[index].specs.filter(spec=>!spec.na&&(tx.quote.items[index].unit!=='Metro'||spec.type==='Largo'))",
    "tx.quote.items[index].specs.filter(spec=>(!spec.na||!spec.value)&&(tx.quote.items[index].unit!=='Metro'||spec.type==='Largo'))", 'shared measure unit');
  source = replaceOnce(source,
    "const units=[...new Set((item.specs||[]).filter(s=>!s.na&&s.unit).map(s=>s.unit))];",
    "const active=(item.specs||[]).filter(s=>!s.na&&s.unit),fallback=(item.specs||[]).filter(s=>s.na&&!s.value&&s.unit);const units=[...new Set((active.length?active:fallback).map(s=>s.unit))];", 'visible measure unit');

  // An omitted optional measure is not a zero or an invented No aplica.
  source = replaceOnce(source, "if (r.specs?.length)\n        paragraph(", "if (r.specs?.some(s => s.na || s.value))\n        paragraph(", 'commercial measures');
  source = replaceOnce(source, "r.specs\n            .map(\n              (s) =>", "r.specs.filter(s => s.na || s.value)\n            .map(\n              (s) =>", 'commercial measure rows');
  source = replaceOnce(source, "(s.na ? 'No aplica (' + s.reason + ')' : (s.value || 'Pendiente') + ' ' + s.unit)", "(s.na ? 'No aplica' + (s.reason ? ' (' + s.reason + ')' : '') : s.value + ' ' + s.unit)", 'commercial historical no-apply');

  const heading = '<div class="fab-heading"><h4>Despiece y fabricación</h4><span class="fab-badge">';
  if (source.split(heading).length !== 3) throw Error('Article heading anchors changed');
  source = source.replaceAll(heading, '<p class="meta article-flow-status"><span class="fab-badge">');
  source = replaceOnce(source, '</span></div><p class="meta">Captura las piezas y servicios que correspondan.', '</span> Captura las piezas y servicios que correspondan.', 'detailed status');
  source = replaceOnce(source, '</span></div><p class="meta">Organiza piezas por material y aplica procesos donde corresponde.', '</span> Organiza piezas por material y aplica procesos donde corresponde.', 'legacy status');
  return source;
}
