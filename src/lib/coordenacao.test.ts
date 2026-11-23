import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import {
  CURSOS,
  corDoPercentual,
  filtrarClassificados,
  formatarPct,
  montarDesempenho,
  normalizar,
  separarTrancados,
} from './coordenacao';
import { montarZipPorCurso } from './coordenacaoZip';

const grupo = ['AA', 'META', 'ATUAL', 'META FECH', '% AA', '% META'];
const linhaInd = (curso: string, meta: number, atual: number, fech: number) => [
  curso,
  ...[1, 100, 200, 300, 0, 0],
  ...[1, 90, 180, 270, 0, 0],
  ...[1, meta, atual, fech, 0, 0],
  ...[0, 0, 0, 0, 0, 0],
];

test('normalizar ignora acentos, caixa e espaços extras', () => {
  assert.equal(normalizar('  Ciências   contábeis '), 'CIENCIAS CONTABEIS');
});

test('desempenho usa o 3º grupo de colunas e arredonda as metas', () => {
  const rows = [
    ['CURSO', ...grupo, ...grupo, ...grupo, ...grupo],
    linhaInd('PSICOLOGIA', 5.856, 12, 14.77),
    linhaInd('Direito', 7.04, 5, 17.8),
    linhaInd('ENGENHARIA CIVIL', 3, 3, 3),
    linhaInd('Total', 99, 99, 99),
  ];
  const d = montarDesempenho(rows);
  const psi = d.linhas.find((l) => l.curso === 'PSICOLOGIA')!;
  assert.deepEqual([psi.metaDia, psi.atual, psi.metaFech, psi.cor], [6, 12, 15, 'verde']);
  assert.equal(formatarPct(psi.pct), '200,00%');
  const dir = d.linhas.find((l) => l.curso === 'DIREITO')!;
  assert.equal(dir.cor, 'vermelho');
  assert.equal(d.linhas.length, 18);
  assert.equal(d.ausentes.length, 16);
  assert.equal(d.total.metaDia, 13);
  assert.equal(d.total.atual, 17);
  assert.equal(d.linhas.find((l) => l.curso === 'PEDAGOGIA')!.cor, 'sem_meta');
});

test('cores: ≥100% verde, ≥80% amarelo, abaixo vermelho', () => {
  assert.equal(corDoPercentual(1), 'verde');
  assert.equal(corDoPercentual(0.8), 'amarelo');
  assert.equal(corDoPercentual(0.79), 'vermelho');
  assert.equal(corDoPercentual(null), 'sem_meta');
});

const cabClass = [null, 'Data/Hora Inscrição', null, 'Periodo Acadêmico', 'Modelo de Ensino', 'Nome da oportunidade',
  'Nome da conta', 'Curso', 'Turno', 'Telefone Celular', 'Email', 'Forma de Ingresso', 'Código Agente PDV',
  'Nome do Agente', 'Ação de vendas de Origem', 'Detalhe do Canal', 'Fase', 'Valor Pago'];
const lc = (periodo: string, curso: string, turno: string, fase: string, pago: unknown) =>
  [null, 'x', null, periodo, 'PRESENCIAL', '0001', 'Fulano', curso, turno, '2199', 'a@b', 'Vest', 1, 'Ag', '', 'Canal', fase, pago];

test('classificados localiza colunas pelo nome e aplica os filtros', () => {
  const rows = [
    [null, 'título'],
    cabClass,
    lc('2027.1', 'Enfermagem', 'NOITE', 'Classificado', null),
    lc('2026.4', 'ENFERMAGEM', 'MANHÃ', 'Inscrito', ''),
    lc('2027.1', 'ENFERMAGEM', 'VIRTUAL', 'Classificado', null),
    lc('2027.1', 'ENFERMAGEM', 'NOITE', 'Classificado', 641.68),
    lc('2027.1', 'ENFERMAGEM', 'NOITE', 'Desistente', null),
    lc('2026.1', 'ENFERMAGEM', 'NOITE', 'Classificado', null),
    lc('2027.1', 'MARKETING', 'NOITE', 'Classificado', null),
  ];
  const r = filtrarClassificados(rows);
  assert.equal(r.total, 2);
  assert.equal(r.porCurso.get('ENFERMAGEM')!.length, 2);
  assert.deepEqual(r.porCurso.get('ENFERMAGEM')![0], ['2027.1', 'PRESENCIAL', '0001', 'Fulano', 'Enfermagem', 'NOITE', '2199', 'a@b', 'Vest']);
});

test('trancados: deduplica matrícula, limpa telefone e separa por adimplência', () => {
  const h = ['COD_MATRICULA', 'NOM_ALUNO', 'CPF_ALUNO', 'END_EMAIL', 'NUM_TELEF_CELULAR', 'COD_CAMPUS', 'NOM_CAMPUS',
    'COD_CURSO', 'NOM_CURSO', 'COD_TURNO', 'X', 'Y', 'Z', 'NOM_SITUACAO_ALUNO', 'DT_SITUACAO_ATUAL', 'a', 'b', 'c', 'd', 'e', 'VLR_TOTAL_EM_ABERTO'];
  const l = (mat: string, curso: string, tel: string, valor: unknown) =>
    [mat, 'Nome', '1', 'e', tel, 1, 'R9', 1, curso, '1', 0, 0, 0, 'TRANCADO', 45883.5, 0, 0, 0, 0, 0, valor];
  const r = separarTrancados([
    h,
    l('1', 'DIREITO', '(21) 9999-0000', ''),
    l('1', 'DIREITO', '21', '50'),
    l('2', 'DIREITO', '21', '27085.56'),
    l('3', 'PUBLICIDADE E PROPAGANDA', '21', ''),
  ]);
  assert.deepEqual(r.stats, { lidos: 4, duplicados: 1, fora: 1, exportados: 2 });
  const adim = r.adimplentes.get('DIREITO')!;
  assert.equal(adim.length, 1);
  assert.equal(adim[0][4], '2199990000');
  assert.ok(adim[0][8] instanceof Date);
  assert.equal(r.inadimplentes.get('DIREITO')![0][9], 27085.56);
});

test('zip tem uma pasta por curso com os três arquivos', () => {
  const zip = unzipSync(
    montarZipPorCurso(
      filtrarClassificados([cabClass, lc('2027.1', 'DIREITO', 'NOITE', 'Classificado', null)]),
      separarTrancados([['COD_MATRICULA', 'NOM_ALUNO', 'CPF_ALUNO', 'END_EMAIL', 'NUM_TELEF_CELULAR', 'NOM_CAMPUS',
        'NOM_CURSO', 'NOM_SITUACAO_ALUNO', 'DT_SITUACAO_ATUAL', 'VLR_TOTAL_EM_ABERTO']])
    )
  );
  assert.equal(Object.keys(zip).length, CURSOS.length * 3);
  const xlsx = unzipSync(zip['DIREITO/DIREITO_Inscritos.xlsx']);
  const sheet = strFromU8(xlsx['xl/worksheets/sheet1.xml']);
  assert.match(sheet, /<row r="2">/);
  assert.match(sheet, /Periodo Acadêmico/);
});
