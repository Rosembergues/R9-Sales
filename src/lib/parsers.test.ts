import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePowerBiNumber } from './powerBiNumber';
import { numero, paraData } from './coordenacao';
import { detectCsvSeparator } from './readSheetRows';
import { stripAccents } from './text';
import { dateToExcelSerial, excelSerialToDate } from './dates';

test('número do Power BI: milhar, decimal, % e (Blank)', () => {
  assert.equal(parsePowerBiNumber('1.400'), 1400);
  assert.equal(parsePowerBiNumber('1,400'), 1400);
  assert.equal(parsePowerBiNumber('12.345.678'), 12345678);
  assert.equal(parsePowerBiNumber('12,5'), 12.5);
  assert.equal(parsePowerBiNumber('1.400,5'), 1400.5);
  assert.equal(parsePowerBiNumber('1,400.5'), 1400.5);
  assert.equal(parsePowerBiNumber('85%'), 85);
  assert.equal(parsePowerBiNumber('(Blank)'), 0);
  assert.equal(parsePowerBiNumber('-'), null);
  assert.equal(parsePowerBiNumber(''), null);
  assert.equal(parsePowerBiNumber('M.FIN'), null);
});

test('número de planilha: pt-BR com milhar sem vírgula e R$', () => {
  assert.equal(numero('1.234'), 1234);
  assert.equal(numero('1.234,56'), 1234.56);
  assert.equal(numero('R$ 2.500,00'), 2500);
  assert.equal(numero('1234.56'), 1234.56);
  assert.equal(numero(42), 42);
  assert.equal(numero(''), 0);
  assert.equal(numero('abc'), 0);
});

test('separador do CSV pela primeira linha', () => {
  assert.equal(detectCsvSeparator('COD_MATRICULA;NOM_ALUNO;CPF\n1;a;2'), ';');
  assert.equal(detectCsvSeparator('﻿a,b,c\n1,2,3'), ',');
  assert.equal(detectCsvSeparator('NOM_ALUNO;OBS\n"Silva, João";x'), ';');
});

test('sem acentos', () => {
  assert.equal(stripAccents('Ciências Contábeis'), 'Ciencias Contabeis');
  assert.equal(stripAccents(null), '');
  assert.equal(stripAccents('a b'), 'a b');
});

test('data serial do Excel ida e volta', () => {
  const d = excelSerialToDate(45000.5)!;
  assert.equal(d.toISOString(), '2023-03-15T12:00:00.000Z');
  assert.equal(dateToExcelSerial(d), 45000.5);
  assert.equal(excelSerialToDate(0), null);
  assert.equal(paraData('texto'), 'texto');
  assert.ok(paraData(45000) instanceof Date);
});
