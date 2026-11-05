import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Structural regressions for the approved B table; these are not browser layout QA.
const css=readFileSync(new URL('../src/row-variant.css',import.meta.url),'utf8');
const polish=readFileSync(new URL('../src/view-polish.css',import.meta.url),'utf8');
const workshop=readFileSync(new URL('../src/recipe-workshop.css',import.meta.url),'utf8');
const rules=selector=>[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match=>match[1].trim().split(/,\s*/).includes(selector)).map(match=>match[2]);

test('B keeps the same shared eight columns at every width instead of reflowing piece fields',()=>{
  const wood=rules('#quote-host .rv-grid.rv-wood-grid');
  assert.equal(wood.length,1,'A single grid definition serves headings and capture rows');
  const columns=[...wood[0].matchAll(/minmax\(0,[\d.]+fr\)/g)];
  assert.equal(columns.length,8,'Piece, quantity, material, thickness, measures, price, CNC and amount');
  assert.doesNotMatch(css,/grid-template-areas/,'Fields never silently wrap to a different visual order');
  assert.match(css,/\.rv-wood-measure-grid\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/\.rv-table-heading[^{}]*\{[^}]*display:none/,'Shared headings remain visible');
});

test('B confines narrow-screen overflow to its keyboard-focusable table and retains compact controls',()=>{
  assert.match(css,/\.rv-table-scroll\{[^}]*max-width:100%;min-width:0;overflow-x:auto/);
  assert.match(css,/\.rv-table-scroll:focus-visible\{outline:2px solid/);
  assert.match(css,/\.rv-table-content\.rv-wood-table\{min-width:1080px\}/);
  assert.match(css,/\.rv-table-content\.rv-supply-table\{min-width:820px\}/);
  assert.match(css,/\.rv-cell :is\(input,select,textarea\)\{[^}]*min-height:34px/);
  assert.match(css,/@container part-card \(max-width:600px\)\{[\s\S]*?min-height:38px;font-size:1rem/);
  assert.match(css,/#quote-host \.shell\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.rv-wood-cnc select\{max-width:70px\}/,'CNC remains a compact yes/no selector');
  assert.doesNotMatch(css,/outline\s*:\s*none|!important/);
});

test('B retains minimal confirmation controls, focus and family subtotals',()=>{
  assert.match(css,/\.rv-family-meta output\{[^}]*font-variant-numeric:tabular-nums/);
  assert.match(css,/\.rv-edit>\.break-editor-actions>button,[\s\S]*?min-height:34px/);
  assert.match(css,/\.rv-row:focus-within\{background:/);
  assert.match(css,/\.rv-cell :is\(input,select,textarea\):focus-visible\{outline:2px solid/);
});

test('annotated B uses Astil section tabs and compact accessible header quantity controls',()=>{
  assert.match(polish,/\.steps\.compact-steps\{[^}]*overflow-x:auto/);
  assert.match(polish,/\.steps\.compact-steps>button\.current\{[^}]*border-bottom-color:var\(--blue\)/);
  assert.match(polish,/#quote-host\[data-journey-screen="request"\] \.steps\.compact-steps\{display:none\}/,'Request retains just the commercial navigation, despite the later tab styles');
  assert.match(polish,/\.part-header-quantity input\{[^}]*min-height:34px/);
  assert.match(polish,/@container part-card \(max-width:660px\)/);
  assert.match(polish,/\.part-header-quantity input:focus-visible\{outline:2px solid/);
  assert.doesNotMatch(polish,/outline\s*:\s*none|!important/);
});

test('annotated B reference tables keep numeric values unbroken inside their own scroll region',()=>{
  assert.match(polish,/\.recipe-economics-table\{[^}]*max-width:100%[^}]*overflow-x:auto/);
  assert.match(polish,/\.recipe-economics-table table\{[^}]*min-width:730px[^}]*table-layout:auto/);
  assert.match(polish,/\.recipe-economics-table :is\(th,td\)\{[^}]*text-transform:none[^}]*overflow-wrap:normal;word-break:normal/);
  assert.match(polish,/\.recipe-economics-table tbody td:nth-child\(2\)[^{}]*\{white-space:nowrap\}/);
  assert.match(polish,/\.recipe-economics-reference>summary:focus-visible\{outline:2px solid/);
});

test('reference workshop tables contain narrow-screen overflow and keep labels and keyboard focus',()=>{
  assert.match(workshop,/\.workshop-table-scroll\{[^}]*max-width:100%;min-width:0;overflow-x:auto/);
  assert.match(workshop,/\.workshop-domino-table\{min-width:940px\}/,'The row includes its visible calculated cost');
  assert.match(workshop,/@container part-card \(max-width:600px\)/);
  assert.match(workshop,/\.workshop-field :is\(input,select\):focus-visible\{outline:2px solid/);
  assert.match(workshop,/\.workshop-finish-name>input\{[^}]*accent-color:var\(--blue\)/);
  assert.doesNotMatch(workshop,/outline\s*:\s*none|!important/);
});

test('wood requirement markers and compact workshop columns retain accessible fields and visible factor units',()=>{
  // Later 5 Nov annotation changes required markers from blue to red.
  assert.match(css,/\.rv-required-symbol\{[^}]*color:var\(--red,#bd2525\)/);
  assert.match(css,/\[data-rv-missing="true"\]>\.rv-missing-mark\{display:block/);
  assert.match(workshop,/\.workshop-table-row\{min-height:48px/);
  assert.match(workshop,/\.workshop-domino-table :is\(\.workshop-table-head,\.workshop-table-row\)\{grid-template-columns:/);
  assert.match(workshop,/\.workshop-other-table :is\(\.workshop-table-head,\.workshop-table-row\)\{grid-template-columns:/);
  assert.match(workshop,/\.workshop-other-table \.workshop-table-row>\.workshop-field>label\{position:static/);
});

test('piece quantity has a quiet right arrow and wood autosave announcements have no visible strip',()=>{
  assert.match(polish,/\.header-quantity-control>button\{[^}]*min-height:34px/);
  assert.match(polish,/\.header-quantity-control>button:focus-visible\{outline:2px solid/);
  assert.match(polish,/\.rv-announcement\{[^}]*width:1px;height:1px[^}]*clip:rect\(0,0,0,0\)/);
});

test('commercial stages share the underline design and quantity arrows frame the input',()=>{
  const journey=readFileSync(new URL('../src/journey.css',import.meta.url),'utf8');
  assert.match(journey,/\.j-stages \.j-btn\{[^}]*border-bottom:2px solid transparent[^}]*border-radius:0/);
  assert.match(journey,/\.j-stages \.j-btn\[aria-pressed=true\]\{border-bottom-color:var\(--j-blue\);background:transparent/);
  assert.match(journey,/\.j-stages\{[^}]*overflow-x:auto/);
  assert.match(polish,/\.header-quantity-control\{[^}]*width:108px/);
  assert.match(polish,/\.header-quantity-control>button:first-child\{border-left:0;border-right:1px solid/);
});

test('monetary inputs align decimals and the domino cost stays visible at the right of its scrollable row',()=>{
  assert.match(workshop,/\.workshop-money>input\{text-align:right;font-variant-numeric:tabular-nums\}/);
  assert.match(workshop,/\.workshop-domino-table \.workshop-table-row>\.workshop-amount[^{}]*\{position:sticky;right:0/);
  assert.match(workshop,/\.workshop-help>span\{[^}]*width:18px;height:18px/);
  assert.match(workshop,/\.workshop-help:focus-visible\{outline:2px solid/);
  assert.match(workshop,/\.workshop-help-copy\[hidden\]\{display:none\}/);
});
test('5 Nov board columns stay in one contained row and wood confirmation remains quiet and focusable',()=>{
  assert.match(css,/\.rv-board-table\{min-width:1510px\}/);
  assert.match(css,/\.rv-board-grid\{display:grid;grid-template-columns:180px 205px 64px 245px 150px 150px 185px minmax\(155px,1fr\)/);
  assert.match(css,/\.rv-board-cell-7\{position:sticky;right:0/);
  assert.match(css,/\.rv-wood-confirm button\{[^}]*background:transparent;box-shadow:none/);
  assert.match(css,/\.rv-wood-confirm button:focus-visible\{outline:2px solid/);
  assert.match(css,/\.rv-missing-mark\{[^}]*color:var\(--red,#bd2525\)/);
});

