import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distributeByWeights, periodsBetween, splitByShares, weightTotals } from './goalWeights';

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

test('divisão por peso sempre soma o total (maiores restos)', () => {
  const r = splitByShares(10, { a: 33.3, b: 33.3, c: 33.4 });
  assert.equal(sum(r), 10);
  assert.deepEqual(r, { a: 3, b: 3, c: 4 });
  assert.deepEqual(splitByShares(7, { a: 0, b: 0 }), { a: 0, b: 0 });
});

test('peso 0 não recebe meta e a BU fecha com a oficial', () => {
  const official = { bu_presencial: 20, bu_digital: 9, pos: 0, tecnico: 3 };
  const weights = {
    ana: { bu_presencial: 50, bu_digital: 0, pos: 0, tecnico: 100 },
    bia: { bu_presencial: 50, bu_digital: 100, pos: 0, tecnico: 0 },
  };
  const { values, untouchedBus } = distributeByWeights(official, ['ana', 'bia'], weights);
  assert.equal(values.ana.bu_presencial + values.bia.bu_presencial, 20);
  assert.equal(values.ana.bu_digital, 0);
  assert.equal(values.bia.bu_digital, 9);
  assert.equal(values.ana.tecnico, 3);
  assert.deepEqual(untouchedBus, ['pos']); // sem nenhum peso: não mexe
});

test('ajuste manual é mantido e o resto vai para os outros', () => {
  const official = { bu_presencial: 10, bu_digital: 0, pos: 0, tecnico: 0 };
  const weights = {
    ana: { bu_presencial: 50, bu_digital: 0, pos: 0, tecnico: 0 },
    bia: { bu_presencial: 25, bu_digital: 0, pos: 0, tecnico: 0 },
    caio: { bu_presencial: 25, bu_digital: 0, pos: 0, tecnico: 0 },
  };
  const manual = { ana: { bu_presencial: 2, bu_digital: 0, pos: 0, tecnico: 0 } };
  const { values } = distributeByWeights(official, ['ana', 'bia', 'caio'], weights, manual);
  assert.equal(values.ana.bu_presencial, 2);
  assert.equal(values.bia.bu_presencial + values.caio.bu_presencial, 8);
});

test('soma dos pesos por BU', () => {
  const totals = weightTotals({ a: { bu_presencial: 33.33, bu_digital: 0, pos: 0, tecnico: 0 }, b: { bu_presencial: 66.67, bu_digital: 0, pos: 0, tecnico: 0 } }, ['a', 'b']);
  assert.equal(totals.bu_presencial, 100);
});

test('semanas segunda a domingo cortadas no mês (borda do mês)', () => {
  const periods = periodsBetween('2026-11-01', '2026-11-30');
  const weeks = periods.filter(p => p.type === 'week').map(p => `${p.start}..${p.end}`);
  assert.equal(weeks[0], '2026-11-01..2026-11-01'); // 01/11/2026 é domingo
  assert.equal(weeks.at(-1), '2026-11-30..2026-11-30'); // segunda, último dia do mês
  assert.ok(periods.some(p => p.type === 'month' && p.start === '2026-11-01' && p.end === '2026-11-30'));
});
