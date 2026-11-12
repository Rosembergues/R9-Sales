import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMissingSaleFields, normalizeModalityName, shiftsFor, fdiOptionsFor } from './saleOptions';
import { findDuplicateByOpportunity, normalizeOpportunity, parseSaleDate, validateSaleDate } from './saleValidation';
import { applySalesFilters, localDayStartIso } from './salesQuery';
import { normalizeRemoteSale } from './salesMapper';
import { errorText } from './errors';
import type { Sale } from '../types';

test('venda completa não tem campo faltando', () => {
  const row = {
    opportunity: '123', client_name: 'Ana', sale_date: '2026-11-11', seller_id: 'u1',
    product: 'Graduação', modality: 'EAD', turn: 'Virtual', fdi: 'ENEM',
  };
  assert.deepEqual(findMissingSaleFields(row), []);
});

test('venda antiga sem modalidade, turno e com FDI "true" aparece incompleta', () => {
  const row = { opportunity: '1', client_name: 'Bia', sale_date: '2026-11-11', seller_id: 'u1', product: 'Graduação', fdi: 'true' };
  assert.deepEqual(findMissingSaleFields(row), ['modality', 'shift', 'fdi']);
  // dado só no custom_data também vale
  assert.deepEqual(findMissingSaleFields({ ...row, fdi: 'ENEM', custom_data: { modality: 'EAD', shift: 'Virtual' } }), []);
});

test('a planilha não inventa modalidade/turno, só marca o que falta', () => {
  const sale = normalizeRemoteSale({ id: 's1', opportunity: '1', client_name: 'Caio', seller_id: 'u1', product: 'Graduação', fdi: 'ENEM', sale_date: '2026-11-11' });
  assert.deepEqual(sale.missing_fields, ['modality', 'shift']);
});

test('opções do formulário dependem do produto e da modalidade', () => {
  assert.deepEqual(shiftsFor('Graduação', 'EAD'), ['Virtual']);
  assert.deepEqual(shiftsFor('Graduação', 'Presencial'), ['Manhã', 'Noite']);
  assert.deepEqual(shiftsFor('', ''), []);
  assert.ok(fdiOptionsFor('Curso Técnico').includes('Técnico'));
  assert.ok(!fdiOptionsFor('Graduação').includes('Técnico'));
  assert.equal(normalizeModalityName('flex'), 'FLEX');
  assert.equal(normalizeModalityName('tecnico'), 'Técnico Presencial');
});

test('oportunidade e data da venda', () => {
  assert.equal(normalizeOpportunity(' 95 5x 12 '), '955X12');
  assert.equal(parseSaleDate('01/11/2026'), '2026-11-01');
  assert.equal(parseSaleDate('31/02/2026'), null);
  assert.equal(validateSaleDate('2026-11-12', '2026-11-11'), 'A data da venda não pode ser no futuro.');
  assert.equal(validateSaleDate('2026-11-11', '2026-11-11'), null);
});

test('oportunidade duplicada é encontrada, mas não a própria venda', () => {
  const sales = [{ id: 'a', custom_data: { opportunity_number: '955 123' } }, { id: 'b', custom_data: { opportunity_number: '777' } }] as unknown as Sale[];
  assert.equal(findDuplicateByOpportunity(sales, '955123')?.id, 'a');
  assert.equal(findDuplicateByOpportunity(sales, '955123', 'a'), null);
});

test('filtros da planilha viram filtros do banco', () => {
  const calls: string[] = [];
  const q = {
    or: (v: string) => { calls.push(`or ${v}`); return q; },
    ilike: (c: string, v: string) => { calls.push(`ilike ${c} ${v}`); return q; },
    eq: (c: string, v: string) => { calls.push(`eq ${c} ${v}`); return q; },
    gte: (c: string, v: string) => { calls.push(`gte ${c} ${v}`); return q; },
    lt: (c: string, v: string) => { calls.push(`lt ${c} ${v}`); return q; },
  };
  applySalesFilters(q, { sellerId: 'u1', modality: 'EAD', dateFrom: '2026-11-01', dateTo: '2026-11-30', incompleteOnly: true, searchTerm: 'an,a' });
  assert.ok(calls.includes('eq seller_id u1'));
  assert.ok(calls.includes('ilike modality EAD'));
  assert.ok(calls.includes(`gte sale_date ${localDayStartIso('2026-11-01')}`));
  assert.ok(calls.includes(`lt sale_date ${localDayStartIso('2026-12-01')}`));
  assert.ok(calls.some(c => c.startsWith('or ') && c.includes('modality.is.null')));
  // vírgula na busca não quebra a sintaxe do filtro
  assert.ok(calls.some(c => c.includes('client_name.ilike.%an a%')));
});

test('texto de erro', () => {
  assert.equal(errorText(new Error('falhou'), 'x'), 'falhou');
  assert.equal(errorText({ message: 'do supabase' }, 'x'), 'do supabase');
  assert.equal(errorText(null, 'reserva'), 'reserva');
});
