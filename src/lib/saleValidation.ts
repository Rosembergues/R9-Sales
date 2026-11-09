import type { Sale } from '../types';

/**
 * Número da oportunidade normalizado: sem espaços e em maiúsculas.
 * É a chave que identifica uma venda; duas vendas com o mesmo número são duplicadas.
 */
export const normalizeOpportunity = (value: unknown): string =>
  String(value ?? '').replace(/\s+/g, '').toUpperCase();

/** Valores gerados pelo sistema quando a venda antiga não tinha oportunidade (ex.: "OP-xxxx"). */
const isSyntheticOpportunity = (value: string) => /^OP-/.test(value);

export const saleOpportunity = (sale: Pick<Sale, 'custom_data'>): string =>
  normalizeOpportunity(sale.custom_data?.opportunity_number);

/** Venda já carregada com a mesma oportunidade (ignorando a própria venda em edição). */
export function findDuplicateByOpportunity(sales: Sale[], opportunity: string, excludeId?: string): Sale | null {
  const key = normalizeOpportunity(opportunity);
  if (!key || isSyntheticOpportunity(key)) return null;
  return sales.find(s => s.id !== excludeId && saleOpportunity(s) === key) ?? null;
}

const normalizeName = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/**
 * Vendas do mesmo aluno no mesmo produto (com outra oportunidade).
 * Não bloqueia: serve de alerta para o consultor conferir se não é a mesma venda.
 */
export function findSameStudentSales(
  sales: Sale[],
  candidateName: string,
  mainProduct: string,
  excludeId?: string,
): Sale[] {
  const name = normalizeName(candidateName);
  if (name.length < 5) return [];
  const product = normalizeName(mainProduct);
  return sales.filter(s =>
    s.id !== excludeId
    && normalizeName(s.custom_data?.candidate_name || s.client_name) === name
    && normalizeName(s.custom_data?.main_product || s.product_name).startsWith(product)
  );
}

/** Converte dd/mm/aaaa ou aaaa-mm-dd em aaaa-mm-dd, validando a data no calendário. */
export function parseSaleDate(value: string): string | null {
  const v = value.trim();
  let y: number; let m: number; let d: number;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (br) { d = +br[1]; m = +br[2]; y = +br[3]; }
  else if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const localTodayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/** Mensagem de erro para a data da venda, ou null se estiver ok. Não aceita data futura. */
export function validateSaleDate(value: string, todayIso: string = localTodayIso()): string | null {
  const iso = parseSaleDate(value);
  if (!iso) return 'Data da venda inválida. Use o formato dd/mm/aaaa.';
  if (iso > todayIso) return 'A data da venda não pode ser no futuro.';
  if (iso < '2020-01-01') return 'Data da venda muito antiga. Confira o ano.';
  return null;
}

/** Texto curto para mostrar a venda que já existe. */
export function describeSale(sale: Sale): string {
  const who = sale.seller_name || 'consultor';
  const date = sale.custom_data?.sale_date || sale.sale_date || '';
  const student = sale.custom_data?.candidate_name || sale.client_name || '';
  return `${student ? `${student}, ` : ''}lançada por ${who}${date ? ` em ${String(date).slice(0, 10)}` : ''}`;
}

/** Erro de violação de unicidade do Postgres (índice de oportunidade). */
export const isUniqueViolation = (error: { code?: string; message?: string } | null | undefined) =>
  Boolean(error && (error.code === '23505' || /duplicate key/i.test(error.message || '')));

/** Erro de rede (sem resposta do servidor): só nesse caso a venda vai para a fila offline. */
export const isNetworkError = (error: unknown) => {
  const msg = String((error as any)?.message ?? error ?? '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout/i.test(msg);
};
