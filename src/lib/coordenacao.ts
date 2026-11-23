// Regras dos relatórios da Coordenação (portadas do app desktop "R9 Central de Relatórios").
// Tudo aqui trabalha sobre linhas já lidas da planilha (matriz de células), sem depender do navegador.

import { excelSerialToDate } from './dates';
import { stripAccents } from './text';

export type Row = unknown[];

// Relação fixa de coordenadores por curso, na ordem em que aparecem na arte.
const COORDENADORES: ReadonlyArray<{ curso: string; coordenador: string }> = [
  { curso: 'PEDAGOGIA', coordenador: 'ANGELA' },
  { curso: 'ANÁLISE E DESENVOLVIMENTO DE SISTEMAS', coordenador: 'ANTÔNIO' },
  { curso: 'CIÊNCIA DA COMPUTAÇÃO', coordenador: 'ANTÔNIO' },
  { curso: 'NUTRIÇÃO', coordenador: 'ETHEL' },
  { curso: 'BIOMEDICINA', coordenador: 'FABIO' },
  { curso: 'ESTÉTICA E COSMÉTICA', coordenador: 'FABIO' },
  { curso: 'RADIOLOGIA', coordenador: 'LUCIANO' },
  { curso: 'CIÊNCIAS BIOLÓGICAS - BACHARELADO', coordenador: 'MAYARA' },
  { curso: 'FARMÁCIA', coordenador: 'MAYARA' },
  { curso: 'EDUCAÇÃO FÍSICA - BACHARELADO', coordenador: 'MICHEL' },
  { curso: 'EDUCAÇÃO FÍSICA - LICENCIATURA', coordenador: 'MICHEL' },
  { curso: 'PSICOLOGIA', coordenador: 'NIHIL/JOHNNY' },
  { curso: 'DIREITO', coordenador: 'NILMA' },
  { curso: 'FISIOTERAPIA', coordenador: 'ROSINELI' },
  { curso: 'ADMINISTRAÇÃO', coordenador: 'UBIRATAN' },
  { curso: 'CIÊNCIAS CONTÁBEIS', coordenador: 'UBIRATAN' },
  { curso: 'GESTÃO DE RECURSOS HUMANOS', coordenador: 'UBIRATAN' },
  { curso: 'ENFERMAGEM', coordenador: 'RAPHAELA' },
];
export const CURSOS = COORDENADORES.map((c) => c.curso);

/** Maiúsculas, espaços simples e sem acentos — para comparar nomes vindos de fontes diferentes. */
export function normalizar(valor: unknown): string {
  return stripAccents(valor).trim().toUpperCase().replace(/\s+/g, ' ');
}

const CURSO_LOOKUP = new Map(CURSOS.map((c) => [normalizar(c), c]));
const cursoOficial = (valor: unknown) => CURSO_LOOKUP.get(normalizar(valor)) ?? null;

export function numero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor).trim().replace(/^R\$\s*/i, '');
  // "1.234,56" e "1.234" (pt-BR, ponto = milhar) ou "1234.56" (ponto decimal, como o Excel grava).
  const limpo = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : /^-?\d{1,3}(\.\d{3})+$/.test(texto)
      ? texto.replace(/\./g, '')
      : texto;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

const vazio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// ---------------------------------------------------------------------------
// 1) Desempenho de cursos x meta
// ---------------------------------------------------------------------------

export type CorDesempenho = 'verde' | 'amarelo' | 'vermelho' | 'sem_meta';

interface LinhaDesempenho {
  coordenador: string;
  curso: string;
  metaDia: number;
  atual: number;
  metaFech: number;
  pct: number | null;
  cor: CorDesempenho;
}

export interface Desempenho {
  linhas: LinhaDesempenho[];
  total: { metaDia: number; atual: number; metaFech: number; pct: number | null };
  ausentes: string[];
}

// Metas de fechamento provisórias do ciclo (até 31/03/2027), enviadas à parte enquanto o sistema
// não traz as definitivas. Cada valor é o fechamento do ano anterior × FATOR_CRESCIMENTO.
const FATOR_CRESCIMENTO = 1.2;
const METAS_FECH_PROVISORIAS: Record<string, number> = {
  PEDAGOGIA: 110.4,
  'ANÁLISE E DESENVOLVIMENTO DE SISTEMAS': 34.8,
  'CIÊNCIA DA COMPUTAÇÃO': 15.6,
  NUTRIÇÃO: 91.2,
  BIOMEDICINA: 132,
  'ESTÉTICA E COSMÉTICA': 39.6,
  RADIOLOGIA: 34.8,
  'CIÊNCIAS BIOLÓGICAS - BACHARELADO': 13.2,
  FARMÁCIA: 79.2,
  'EDUCAÇÃO FÍSICA - BACHARELADO': 194.4,
  'EDUCAÇÃO FÍSICA - LICENCIATURA': 44.4,
  PSICOLOGIA: 135.6,
  DIREITO: 163.2,
  FISIOTERAPIA: 111.6,
  ADMINISTRAÇÃO: 105.6,
  'CIÊNCIAS CONTÁBEIS': 24,
  'GESTÃO DE RECURSOS HUMANOS': 34.8,
  ENFERMAGEM: 75.6,
};

export const corDoPercentual = (pct: number | null): CorDesempenho =>
  pct === null ? 'sem_meta' : pct >= 1 ? 'verde' : pct >= 0.8 ? 'amarelo' : 'vermelho';

/**
 * Lê a planilha "Export" de indicadores. O cabeçalho repete o grupo
 * AA | META | ATUAL | META FECH | % AA | % META quatro vezes; o relatório usa o 3º grupo
 * (o mesmo que o app desktop lia em posições fixas).
 */
function lerIndicadores(rows: Row[], grupo = 3) {
  const headerIdx = rows.findIndex((r) => r.some((c) => normalizar(c) === 'CURSO'));
  if (headerIdx < 0) throw new Error('Não encontrei a coluna "CURSO" na planilha de indicadores.');
  const header = rows[headerIdx].map(normalizar);
  const colCurso = header.indexOf('CURSO');
  const metas = header.flatMap((h, i) => (h === 'META' ? [i] : []));
  if (metas.length === 0) throw new Error('Não encontrei as colunas "META" na planilha de indicadores.');
  const colMeta = metas[Math.min(grupo, metas.length) - 1];
  const achar = (nome: string) => {
    const i = header.indexOf(nome, colMeta);
    if (i < 0) throw new Error(`Não encontrei a coluna "${nome}" depois de "META" na planilha de indicadores.`);
    return i;
  };
  const colAtual = achar('ATUAL');
  const colFech = achar('META FECH');
  const colAA = header.lastIndexOf('AA', colMeta);
  if (colAA < 0) throw new Error('Não encontrei a coluna "AA" antes de "META" na planilha de indicadores.');

  const dados = new Map<string, { aa: number; metaDia: number; atual: number; metaFech: number }>();
  for (const r of rows.slice(headerIdx + 1)) {
    const curso = normalizar(r[colCurso]);
    if (!curso || curso === 'TOTAL') continue;
    dados.set(curso, {
      aa: numero(r[colAA]),
      metaDia: numero(r[colMeta]),
      atual: numero(r[colAtual]),
      metaFech: numero(r[colFech]),
    });
  }
  return dados;
}

export function montarDesempenho(rows: Row[]): Desempenho {
  const dados = lerIndicadores(rows);
  const ausentes: string[] = [];
  const total = { metaDia: 0, atual: 0, metaFech: 0, pct: null as number | null };

  const linhas = COORDENADORES.map(({ curso, coordenador }) => {
    const valores = dados.get(normalizar(curso));
    if (!valores) ausentes.push(curso);
    // Forecast pela curva do ano anterior: a meta até hoje é o que o curso tinha feito nesta
    // mesma data no ciclo passado × o mesmo crescimento aplicado à meta de fechamento.
    // Metas arredondadas antes do cálculo, para o % usar a mesma meta exibida.
    const metaDia = Math.round((valores?.aa ?? 0) * FATOR_CRESCIMENTO);
    const atual = valores?.atual ?? 0;
    const metaFech = Math.round(METAS_FECH_PROVISORIAS[curso] ?? 0);
    const pct = metaDia ? atual / metaDia : null;
    total.metaDia += metaDia;
    total.atual += atual;
    total.metaFech += metaFech;
    return { coordenador, curso, metaDia, atual, metaFech, pct, cor: corDoPercentual(pct) };
  });
  total.pct = total.metaDia ? total.atual / total.metaDia : null;
  return { linhas, total, ausentes };
}

export const formatarInteiro = (n: number) => Math.round(n).toLocaleString('pt-BR');
export const formatarPct = (pct: number | null) =>
  pct === null ? '—' : `${(pct * 100).toFixed(2).replace('.', ',')}%`;

// ---------------------------------------------------------------------------
// 2) Classificados (relatório de graduação)
// ---------------------------------------------------------------------------

export const PERIODOS_CLASSIFICADOS = ['2026.4', '2027.1'];
export const TURNOS_CLASSIFICADOS = ['MANHÃ', 'NOITE'];
export const FASES_CLASSIFICADOS = ['Classificado', 'Inscrito'];

// Colunas exportadas (D:L do relatório), localizadas pelo nome do cabeçalho.
const COLUNAS_CLASSIFICADOS = [
  'Periodo Acadêmico',
  'Modelo de Ensino',
  'Nome da oportunidade',
  'Nome da conta',
  'Curso',
  'Turno',
  'Telefone Celular',
  'Email',
  'Forma de Ingresso',
];

export interface Tabela {
  cabecalho: string[];
  linhas: unknown[][];
}

function indicePorNome(header: string[], nome: string, arquivo: string) {
  const i = header.indexOf(normalizar(nome));
  if (i < 0) throw new Error(`A coluna "${nome}" não foi encontrada no arquivo de ${arquivo}.`);
  return i;
}

export function filtrarClassificados(rows: Row[]) {
  const headerIdx = rows.slice(0, 100).findIndex((r) => r.some((c) => normalizar(c) === 'PERIODO ACADEMICO'));
  if (headerIdx < 0) {
    throw new Error('Não encontrei o cabeçalho "Periodo Acadêmico". Verifique se é o relatório de Classificados.');
  }
  const header = rows[headerIdx].map(normalizar);
  const col = (nome: string) => indicePorNome(header, nome, 'Classificados');
  const cPeriodo = col('Periodo Acadêmico');
  const cCurso = col('Curso');
  const cTurno = col('Turno');
  const cFase = col('Fase');
  const cPago = col('Valor Pago');
  const exportadas = COLUNAS_CLASSIFICADOS.map(col);

  const periodos = new Set(PERIODOS_CLASSIFICADOS.map(normalizar));
  const turnos = new Set(TURNOS_CLASSIFICADOS.map(normalizar));
  const fases = new Set(FASES_CLASSIFICADOS.map(normalizar));

  const porCurso = new Map<string, unknown[][]>(CURSOS.map((c) => [c, []]));
  let total = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const curso = cursoOficial(r[cCurso]);
    if (!curso) continue;
    if (!periodos.has(normalizar(r[cPeriodo]))) continue;
    if (!turnos.has(normalizar(r[cTurno]))) continue;
    if (!fases.has(normalizar(r[cFase]))) continue;
    if (!vazio(r[cPago])) continue;
    porCurso.get(curso)!.push(exportadas.map((i) => r[i] ?? null));
    total++;
  }
  return { cabecalho: COLUNAS_CLASSIFICADOS, porCurso, total };
}

// ---------------------------------------------------------------------------
// 3) Trancados / Abandono
// ---------------------------------------------------------------------------

const COLUNAS_TRANCADOS = [
  'COD_MATRICULA',
  'NOM_ALUNO',
  'CPF_ALUNO',
  'END_EMAIL',
  'NUM_TELEF_CELULAR',
  'NOM_CAMPUS',
  'NOM_CURSO',
  'NOM_SITUACAO_ALUNO',
  'DT_SITUACAO_ATUAL',
  'VLR_TOTAL_EM_ABERTO',
];

/** Converte data serial do Excel (ou texto) em Date; devolve o valor original se não reconhecer. */
export function paraData(valor: unknown): unknown {
  return (typeof valor === 'number' && excelSerialToDate(valor)) || valor;
}

export function separarTrancados(rows: Row[]) {
  const headerIdx = rows.slice(0, 20).findIndex((r) => r.some((c) => normalizar(c) === 'COD_MATRICULA'));
  if (headerIdx < 0) throw new Error('Não encontrei a coluna "COD_MATRICULA". Verifique se é o relatório de Trancados.');
  const header = rows[headerIdx].map(normalizar);
  const cols = COLUNAS_TRANCADOS.map((nome) => indicePorNome(header, nome, 'Trancados'));
  const [cMatricula, , , , cTelefone, , cCurso, , cData, cValor] = cols;

  const adimplentes = new Map<string, unknown[][]>(CURSOS.map((c) => [c, []]));
  const inadimplentes = new Map<string, unknown[][]>(CURSOS.map((c) => [c, []]));
  const vistos = new Set<string>();
  const stats = { lidos: 0, duplicados: 0, fora: 0, exportados: 0 };

  for (const r of rows.slice(headerIdx + 1)) {
    if (!r || r.every(vazio)) continue;
    stats.lidos++;
    const matricula = vazio(r[cMatricula]) ? '' : String(r[cMatricula]).trim();
    if (matricula) {
      if (vistos.has(matricula)) {
        stats.duplicados++;
        continue;
      }
      vistos.add(matricula);
    }
    const curso = cursoOficial(r[cCurso]);
    if (!curso) {
      stats.fora++;
      continue;
    }
    const valores = cols.map((i) => {
      const v = r[i];
      if (i === cTelefone) return vazio(v) ? '' : String(v).replace(/\D/g, '');
      if (i === cMatricula) return matricula;
      if (i === cData) return paraData(v);
      if (i === cValor) return vazio(v) ? null : numero(v);
      return typeof v === 'string' ? v.trim() : v ?? null;
    });
    (vazio(r[cValor]) ? adimplentes : inadimplentes).get(curso)!.push(valores);
    stats.exportados++;
  }
  return { cabecalho: COLUNAS_TRANCADOS, adimplentes, inadimplentes, stats };
}
