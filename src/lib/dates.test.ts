import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDaysIso, excelSerialToIso, isoToBr, parseLocalIso, toBrDate, toLocalIso } from './dates';

test('data local em aaaa-mm-dd e dd/mm/aaaa', () => {
  const d = new Date(2026, 10, 1, 23, 30); // 01/11/2026 23:30 no fuso local
  assert.equal(toLocalIso(d), '2026-11-01');
  assert.equal(toBrDate(d), '01/11/2026');
  assert.equal(isoToBr('2026-11-01'), '01/11/2026');
  assert.equal(isoToBr('lixo'), '');
});

test('aaaa-mm-dd vira data do mesmo dia (sem voltar um dia pelo fuso)', () => {
  const d = parseLocalIso('2026-11-01');
  assert.equal(d.getDate(), 1);
  assert.equal(d.getMonth(), 10);
});

test('soma de dias atravessa mês e ano', () => {
  assert.equal(addDaysIso('2026-11-30', 1), '2026-12-01');
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28');
});

test('data serial do Excel', () => {
  assert.equal(excelSerialToIso(45000), '2023-03-15');
  assert.equal(excelSerialToIso(46327), '2026-11-01');
  assert.equal(excelSerialToIso(0), null);
});
