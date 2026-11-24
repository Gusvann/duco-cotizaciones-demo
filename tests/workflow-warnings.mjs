import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {quoteTemplate} from '../tools/build.mjs';

const source = quoteTemplate(readFileSync(new URL('../src/cotizador.html', import.meta.url), 'utf8'));
const domain = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('var QuoteDomain ='))[1];
const sandbox = vm.createContext({});
vm.runInContext(domain, sandbox);
const D = sandbox.QuoteDomain;
const quote = (...percentages) => ({payments: percentages.map(percent => ({percent}))});

test('el reparto de pagos se comprueba antes de conocer el precio o el impuesto', () => {
  const q = quote('70', '30');
  assert.equal(D.paymentDistribution(q).message, '');
  assert.equal(D.paymentAmounts(q, {completePrices:false, total:null}), null);
  assert.deepEqual(Array.from(D.paymentAmounts(q, {completePrices:true, total:10001})), [7000, 3001]);
  assert.equal(D.paymentDistribution(quote('70','20')).message, 'Falta distribuir 10 %.');
  assert.equal(D.paymentDistribution(quote('70.01','30.01')).message, 'El reparto supera el 100 % por 0.02 puntos.');
  assert.equal(D.paymentDistribution(quote('33.33','33.33','33.34')).points, 10000);
  assert.equal(D.paymentDistribution(quote('33.33','33.33','33.34')).message, '');
});

test('el hito ausente, vacío, fuera de rango o con porcentaje cero lleva al control correspondiente', () => {
  assert.equal(D.paymentDistribution(quote()).index, -1);
  for (const percent of ['', '0', '101', '1.001']) {
    const q = quote('70', percent);
    assert.equal(D.paymentDistribution(q).index, 1);
    assert.ok(D.paymentDistribution(q).message);
    assert.equal(D.paymentAmounts(q, {completePrices:true, total:10000}), null);
  }
});
