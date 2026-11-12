import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareOffer, parseScholarship, resolveOffer, weekStartOf } from './priceComparison';

test('bolsa composta: 1º semestre e contínua', () => {
  assert.deepEqual(parseScholarship('65% 1ºS + 60% CT'), { first: 0.65, ct: 0.6 });
  assert.deepEqual(parseScholarship('60% CT'), { first: null, ct: 0.6 });
  assert.deepEqual(parseScholarship(50), { first: null, ct: 0.5 });
});

test('oferta da concorrente completa o valor que falta', () => {
  const offer = resolveOffer('X', 1000, 0.4, null);
  assert.equal(offer.price_to, 600);
  assert.equal(offer.offered, true);
  assert.equal(resolveOffer('Y', null, 0.5, 300).price_from, 600);
});

test('ofensa: concorrente 8% ou mais abaixo do nosso preço', () => {
  const offer = (to: number) => ({ name: 'X', price_from: null, discount_pct: null, price_to: to, offered: true });
  assert.equal(compareOffer(1000, offer(920), 8).status, 'offense');
  assert.equal(compareOffer(1000, offer(950), 8).status, 'cheaper');
  assert.equal(compareOffer(1000, offer(1100), 8).status, 'ours_cheaper');
  assert.equal(compareOffer(null, offer(900), 8).status, 'na');
});

test('semana do comparador começa na segunda', () => {
  assert.equal(weekStartOf('2026-11-11'), '2026-11-09'); // quarta → segunda
  assert.equal(weekStartOf('2026-11-15'), '2026-11-09'); // domingo → segunda anterior
});
