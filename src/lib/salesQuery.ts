/**
 * Filtros da planilha de Vendas aplicados no Supabase (valem para TODAS as vendas,
 * não só para a página exibida).
 */
export interface SalesQueryFilters {
  searchTerm?: string;
  /** 'Graduação' | 'Pós Graduação' | 'Curso Técnico' */
  product?: string;
  /** aaaa-mm-dd (inclusive) */
  dateFrom?: string;
  /** aaaa-mm-dd (inclusive) */
  dateTo?: string;
  sellerId?: string;
  modality?: string;
  fdi?: string;
  shift?: string;
  /** Só vendas com algum campo obrigatório em branco. */
  incompleteOnly?: boolean;
}

export type SalesSortField =
  | 'collaborator' | 'opportunity' | 'candidate' | 'date' | 'fdi' | 'modality'
  | 'shift' | 'parcela_leve' | 'bolsa_convenio' | 'empresa' | 'notes';

export const SALES_SORT_COLUMN: Record<SalesSortField, string> = {
  collaborator: 'seller_name',
  opportunity: 'opportunity',
  candidate: 'client_name',
  date: 'sale_date',
  fdi: 'fdi',
  modality: 'modality',
  shift: 'turn',
  parcela_leve: 'light_installment',
  bolsa_convenio: 'partner_scholarship',
  empresa: 'custom_data->>empresa_convenio',
  notes: 'notes',
};

/** Remove caracteres que quebram a sintaxe de filtro do PostgREST. */
const clean = (v: string) => v.replace(/[%,_()\\*]/g, ' ').trim();

/** Início do dia local (aaaa-mm-dd) em ISO; `plusDays` avança dias. */
export function localDayStartIso(isoDate: string, plusDays = 0): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d + plusDays, 0, 0, 0, 0).toISOString();
}

/** Mesma regra da trava do banco (supabase/vendas-completas.sql). */
export const INCOMPLETE_SALE_FILTER = [
  'opportunity.is.null', 'opportunity.eq.',
  'client_name.is.null', 'client_name.eq.',
  'seller_id.is.null', 'seller_id.eq.',
  'product.is.null', 'product.eq.',
  'modality.is.null', 'modality.eq.',
  'turn.is.null', 'turn.eq.',
  'fdi.is.null', 'fdi.eq.', 'fdi.in.(true,false,sim,nao,não)',
  'sale_date.is.null',
].join(',');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applySalesFilters<Q extends { or: any; ilike: any; eq: any; gte: any; lt: any }>(query: Q, f: SalesQueryFilters): Q {
  let q = query;
  const term = clean(f.searchTerm || '');
  if (term) {
    q = q.or([
      `seller_name.ilike.%${term}%`,
      `client_name.ilike.%${term}%`,
      `opportunity.ilike.%${term}%`,
      `fdi.ilike.%${term}%`,
      `modality.ilike.%${term}%`,
      `notes.ilike.%${term}%`,
    ].join(','));
  }
  if (f.product) {
    const p = clean(f.product);
    q = q.or(`product.ilike.${p}%,product_name.ilike.${p}%`);
  }
  if (f.sellerId) q = q.eq('seller_id', f.sellerId);
  if (f.modality) q = q.ilike('modality', clean(f.modality));
  if (f.fdi) q = q.ilike('fdi', clean(f.fdi));
  if (f.shift) q = q.ilike('turn', clean(f.shift));
  if (f.dateFrom) q = q.gte('sale_date', localDayStartIso(f.dateFrom));
  if (f.dateTo) q = q.lt('sale_date', localDayStartIso(f.dateTo, 1));
  if (f.incompleteOnly) q = q.or(INCOMPLETE_SALE_FILTER);
  return q;
}
