import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Unit tests only: pure shipped domain + bridge with a minimal DOM substitute.
// These do not prove layout, real browser interaction, storage or integration.
const template = readFileSync(new URL('../src/cotizador.html', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../src/quote-bridge.js', import.meta.url), 'utf8');
const recipeCatalog = readFileSync(new URL('../src/recipe-catalog.js', import.meta.url), 'utf8');
const recipeReference = readFileSync(new URL('../src/recipe-reference.js', import.meta.url), 'utf8');
const domain = [...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1])
  .find(source => source.includes('var QuoteSchema') && source.includes('var QuoteManufacturing_'));
if (!domain) throw new Error('The public template must contain its shared pure domain.');

const request = () => ({ title: 'Solicitud inventada', client: 'Cliente de ejemplo', contact: 'Persona ficticia',
  need: 'Dos módulos sintéticos', included: 'Fabricación y empaque', excluded: 'Instalación y transporte',
  account: 'Account de ejemplo', designer: 'Diseño de ejemplo', quoteDue: '2026-10-20', deliveryDate: '2026-11-20' });

function harness() {
  const sandbox = vm.createContext({ structuredClone, queueMicrotask });
  vm.runInContext(domain, sandbox, { filename: 'public-domain.js' });
  vm.runInContext(`
    globalThis.window = globalThis;
    globalThis.__host = { inert: false };
    globalThis.document = {
      getElementById(id) { return id === 'quote-host' ? __host : id === 'workspace' ? { replaceChildren() {} } : null; },
      addEventListener() {}
    };
    globalThis.__client = { app: { epoch: 0, inputErrors: new Map() }, D: QuoteDomain, editor() {} };
  `, sandbox);
  vm.runInContext(recipeReference, sandbox, { filename: 'recipe-reference.js' });
  vm.runInContext(recipeCatalog, sandbox, { filename: 'recipe-catalog.js' });
  vm.runInContext(bridge, sandbox, { filename: 'quote-bridge.js' });
  return { Q: sandbox.DemoQuote, app: sandbox.__client.app, M: sandbox.QuoteManufacturing_, host: sandbox.__host };
}

test('independent money oracle; purchase and provider total each enter once', () => {
  const { Q, app, M } = harness();
  const s = Q.create('DEMO-101', 'complete', request());
  Q.open('DEMO-101', request());
  // Independent cents: 2 purchased units × 1000 = 200000; provider total = 50000.
  // Packaging is gross 2% × 250000 = 5000; net = round(5000/1.16) = 4310.
  // Indirects = round((250000 + 4310) × 10%) = 25431; net cost = 279741.
  assert.equal(s.complete, true);
  assert.equal(s.costCents, 279741);
  assert.equal(s.priceCents, 600000);
  assert.equal(s.taxCents, 96000);
  assert.equal(s.totalCents, 696000);
  assert.equal(s.blockers.length, 0);
  const generated = M.evaluate(app.q).costs;
  assert.equal(generated.find(cost => cost.description === 'Componente comprado de ejemplo').netCents, 200000);
  assert.equal(generated.find(cost => cost.description === 'Integración sintética').netCents, 50000);
});

test('F/CNC preview is separate and cannot become a confirmed quote', async () => {
  const { Q } = harness();
  const s = Q.create('DEMO-102', 'wood', request());
  assert.equal(s.complete, false);
  assert.match(s.blockers.join(' '), /Madera F/);
  assert.equal((await Q.save('DEMO-102')).state, 'blocked');
  assert.equal(Q.snapshot('DEMO-102'), null);
  assert.equal(Q.freeze('DEMO-102'), null);
});

test('failed save provides no snapshot and cannot freeze for sending', async () => {
  const { Q } = harness();
  Q.create('DEMO-101', 'complete', request());
  const result = await Q.save('DEMO-101', 'fail');
  assert.equal(result.ok, false);
  assert.equal(result.state, 'failed');
  assert.equal(Q.snapshot('DEMO-101'), null);
  assert.equal(Q.freeze('DEMO-101'), null);
});

test('unknown result locks editing and confirms the retained snapshot explicitly', async () => {
  const { Q, host } = harness();
  Q.create('DEMO-101', 'complete', request());
  Q.open('DEMO-101', request());
  const result = await Q.save('DEMO-101', 'unknown');
  assert.equal(result.state, 'unknown');
  assert.equal(host.inert, true);
  assert.equal(Q.snapshot('DEMO-101'), null);
  assert.equal(Q.leave('DEMO-101').ok, false);
  assert.equal(Q.freeze('DEMO-101'), null);
  const confirmed = await Q.resolveSave('DEMO-101');
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.summary.dirty, false);
  assert.equal(confirmed.summary.savedRevision, confirmed.summary.revision);
  assert.equal(host.inert, false);
});

test('a changed unknown operation conflicts and preserves prior confirmed evidence', async () => {
  const { Q, app } = harness();
  Q.create('DEMO-101', 'complete', request());
  Q.open('DEMO-101', request());
  await Q.save('DEMO-101');
  await Q.save('DEMO-101', 'unknown');
  // Simulate a stale/programmatic mutation despite the inert browser host.
  app.q.items[0].unitPrice = '4000';
  const result = await Q.resolveSave('DEMO-101');
  assert.equal(result.state, 'conflict');
  assert.equal(result.ok, false);
  assert.equal(Q.snapshot('DEMO-101').quote.items[0].unitPrice, '3000');
  assert.equal(Q.summary('DEMO-101').dirty, true);
});

test('applied drafts are preserved separately while switching expedientes', () => {
  const { Q, app } = harness();
  Q.create('DEMO-101', 'complete', request());
  Q.create('DEMO-102', 'wood', request());
  Q.open('DEMO-101', request());
  app.q.items[0].unitPrice = '4000';
  assert.equal(Q.summary('DEMO-101').priceCents, 800000);
  Q.open('DEMO-102', request());
  assert.equal(Q.summary('DEMO-102').priceCents, 600000);
  Q.open('DEMO-101', request());
  assert.equal(app.q.items[0].unitPrice, '4000');
  assert.equal(Q.summary('DEMO-101').dirty, true);
});

test('confirmed and frozen snapshots are detached copies', async () => {
  const { Q } = harness();
  Q.create('DEMO-101', 'complete', request());
  await Q.save('DEMO-101');
  const copy = Q.snapshot('DEMO-101');
  copy.quote.items[0].unitPrice = '1';
  assert.equal(Q.snapshot('DEMO-101').quote.items[0].unitPrice, '3000');
  const frozen = Q.freeze('DEMO-101');
  assert.ok(frozen);
  frozen.summary.totalCents = 1;
  assert.equal(Q.snapshot('DEMO-101').summary.totalCents, 696000);
  assert.equal((await Q.save('DEMO-101')).ok, false);
});

test('a new version has a new identity and needs its own confirmed save', async () => {
  const { Q, app } = harness();
  Q.create('DEMO-101', 'complete', request());
  Q.open('DEMO-101', request());
  await Q.save('DEMO-101');
  Q.freeze('DEMO-101');
  assert.equal(Q.revise('DEMO-101'), true);
  assert.equal(app.q.versionId, 'DEMO-101-V2');
  assert.equal(Q.snapshot('DEMO-101'), null);
  assert.equal(Q.summary('DEMO-101').savedRevision, 0);
  assert.equal(Q.summary('DEMO-101').dirty, true);
  assert.equal(Q.freeze('DEMO-101'), null);
  const saved = await Q.save('DEMO-101');
  assert.equal(saved.ok, true);
  assert.equal(saved.snapshot.quote.versionId, 'DEMO-101-V2');
});

test('unknown operation prevents switching to another expediente', async () => {
  const { Q, app } = harness();
  Q.create('DEMO-101', 'complete', request());
  Q.create('DEMO-102', 'wood', request());
  Q.open('DEMO-101', request());
  await Q.save('DEMO-101', 'unknown');
  assert.equal(Q.open('DEMO-102', request()), false);
  assert.equal(app.q.id, 'DEMO-101');
});

test('reset removes records and cancels an in-flight memory save', async () => {
  const { Q } = harness();
  Q.create('DEMO-101', 'complete', request());
  const saving = Q.save('DEMO-101');
  Q.reset();
  assert.equal((await saving).state, 'reset');
  assert.throws(() => Q.summary('DEMO-101'), /inexistente/);
});

test('reopening stale shell metadata preserves native form edits and their saved snapshot', async () => {
  const { Q, app } = harness();
  const stale = request();
  Q.create('DEMO-101', 'complete', stale);
  Q.create('DEMO-102', 'wood', request());
  Q.open('DEMO-101', stale);
  const native = { location: 'Sala sintética B', contactPhone: '+52 55 0000 0018 ext. 09', contactEmail: 'persona+nueva@example.test',
    need: 'Necesidad editada en el formulario nativo', included: 'Alcance nativo conservado', excluded: 'Exclusión nativa conservada' };
  Object.assign(app.q, native);
  Q.hide();
  Q.open('DEMO-102', request());
  Q.open('DEMO-101', stale);
  for (const [key, value] of Object.entries(native)) assert.equal(app.q[key], value, `Native ${key} must win over stale metadata`);
  const saved = await Q.save('DEMO-101');
  assert.equal(saved.ok, true);
  for (const [key, value] of Object.entries(native)) {
    assert.equal(saved.snapshot.quote[key], value, `The quote snapshot preserves ${key}`);
    assert.equal(saved.snapshot.request[key], value, `The shell snapshot projects ${key} from the quote`);
  }
});

test('an explicit fabrication/packaging preset accepts only its exact declared texts', () => {
  const { Q, app } = harness();
  const explicit = { ...request(), included: 'Fabricación; Empaque', excluded: 'Obra civil' };
  Q.create('DEMO-EXPLICIT', 'complete', explicit, { scopePreset: 'fabrication-packaging' });
  Q.open('DEMO-EXPLICIT', explicit);
  assert.equal(app.scopeUatSeedUsed, false);
  assert.equal(app.q.included, 'Fabricación; Empaque');
  assert.equal(app.q.excluded, 'Obra civil');
  assert.equal(JSON.stringify(app.scopeUatConfig.seed.includeIds), JSON.stringify(['SCOPE_FABRICATION', 'SCOPE_PACKAGING']));
  assert.equal(JSON.stringify(app.scopeUatConfig.seed.excludeIds), JSON.stringify(['SCOPE_CIVIL_WORK']));
});

test('incoherent explicit preset texts are rejected instead of inferred or silently replaced', () => {
  const { Q } = harness();
  assert.throws(() => Q.create('DEMO-BAD-INCLUDE', 'complete', { ...request(), included: 'Fabricación y empaque', excluded: 'Obra civil' },
    { scopePreset: 'fabrication-packaging' }), /coincidir explícitamente/);
  assert.throws(() => Q.create('DEMO-BAD-EXCLUDE', 'complete', { ...request(), included: 'Fabricación; Empaque', excluded: 'Sin obra civil' },
    { scopePreset: 'fabrication-packaging' }), /coincidir explícitamente/);
  assert.throws(() => Q.summary('DEMO-BAD-INCLUDE'), /inexistente/);
  assert.throws(() => Q.summary('DEMO-BAD-EXCLUDE'), /inexistente/);
});

test('legacy text remains opaque by default even when it resembles the structured preset', () => {
  const { Q, app } = harness();
  const legacy = { ...request(), included: 'Fabricación; Empaque', excluded: 'Obra civil' };
  Q.create('DEMO-LEGACY', 'complete', legacy);
  Q.open('DEMO-LEGACY', legacy);
  assert.equal(app.scopeUatSeedUsed, true);
  assert.equal(app.q.included, legacy.included);
  assert.equal(app.q.excluded, legacy.excluded);
});
