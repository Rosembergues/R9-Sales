import type { MainProductType, ModalityType, ParcelaLeveOption, ProductChannelFDI, ShiftType } from '../types';

/** Opções do formulário de venda. Uma lista só, usada no lançamento, na edição e nos filtros. */

export const MAIN_PRODUCTS: MainProductType[] = ['Graduação', 'Pós Graduação', 'Curso Técnico'];

export const MODALITIES_BY_PRODUCT: Record<MainProductType, Array<{ name: ModalityType; shifts: ShiftType[] }>> = {
  'Graduação': [
    { name: 'Presencial', shifts: ['Manhã', 'Noite'] },
    { name: 'Semipresencial', shifts: ['Manhã', 'Noite'] },
    { name: 'Ao Vivo', shifts: ['Manhã', 'Noite'] },
    { name: 'EAD', shifts: ['Virtual'] },
    { name: 'FLEX', shifts: ['Virtual'] },
  ],
  'Pós Graduação': [
    { name: 'Pós Presencial', shifts: ['Manhã', 'Noite'] },
    { name: 'Pós Ao Vivo', shifts: ['Manhã', 'Noite'] },
    { name: 'Pós Digital', shifts: ['Virtual'] },
  ],
  'Curso Técnico': [{ name: 'Técnico Presencial', shifts: ['Manhã', 'Noite'] }],
};

export const ALL_MODALITIES: ModalityType[] = MAIN_PRODUCTS.flatMap(p => MODALITIES_BY_PRODUCT[p].map(m => m.name));
export const ALL_SHIFTS: ShiftType[] = ['Manhã', 'Noite', 'Virtual'];

const BASE_FDI: ProductChannelFDI[] = ['Simplificada', 'MSV', 'Transferência Externa', 'Reabertura', 'Vestibular', 'ENEM'];
export const ALL_FDI: ProductChannelFDI[] = [...BASE_FDI, 'Técnico', 'Pós Graduação'];

export const FDI_LABEL: Record<ProductChannelFDI, string> = {
  Simplificada: 'Simplificada',
  MSV: 'MSV',
  'Transferência Externa': 'TE',
  Reabertura: 'Reabertura',
  Vestibular: 'Vestibular',
  ENEM: 'ENEM',
  Técnico: 'Técnico',
  'Pós Graduação': 'Pós-Graduação',
};

export const fdiOptionsFor = (product: MainProductType | ''): ProductChannelFDI[] => {
  if (!product) return [];
  if (product === 'Graduação') return BASE_FDI;
  if (product === 'Pós Graduação') return [...BASE_FDI, 'Pós Graduação'];
  return [...BASE_FDI, 'Técnico'];
};

export const modalitiesFor = (product: MainProductType | '') => (product ? MODALITIES_BY_PRODUCT[product] : []);

export const shiftsFor = (product: MainProductType | '', modality: ModalityType | ''): ShiftType[] =>
  modalitiesFor(product).find(m => m.name === modality)?.shifts || [];

export const PARCELA_OPTIONS: ParcelaLeveOption[] = ['1 parcela', '2 parcelas', '3 parcelas', 'Sem parcelas'];

/** Campos obrigatórios de toda venda (mesma lista da trava no banco). */
export type RequiredSaleField = 'opportunity' | 'candidate' | 'date' | 'seller' | 'product' | 'modality' | 'shift' | 'fdi';

export const REQUIRED_FIELD_LABEL: Record<RequiredSaleField, string> = {
  opportunity: 'Oportunidade',
  candidate: 'Aluno',
  date: 'Data',
  seller: 'Consultor',
  product: 'Produto',
  modality: 'Modalidade',
  shift: 'Turno',
  fdi: 'FDI',
};

const filled = (v: unknown) => typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined;
const LEGACY_FDI = new Set(['true', 'false', 't', 'f', 'sim', 'nao', 'não', 'null', 'undefined']);
const validFdi = (v: unknown) => typeof v === 'string' && v.trim() !== '' && !LEGACY_FDI.has(v.trim().toLowerCase());

/**
 * Quais campos obrigatórios a venda gravada no banco NÃO tem.
 * Olha o dado bruto (antes de qualquer valor padrão de exibição).
 */
export function findMissingSaleFields(row: Record<string, any>): RequiredSaleField[] {
  const c = row.custom_data && typeof row.custom_data === 'object' ? row.custom_data : {};
  const missing: RequiredSaleField[] = [];
  if (!filled(row.opportunity) && !filled(row.opportunity_number) && !filled(c.opportunity_number)) missing.push('opportunity');
  if (!filled(row.candidate_name) && !filled(row.client_name) && !filled(c.candidate_name)) missing.push('candidate');
  if (!filled(row.sale_date) && !filled(c.sale_date)) missing.push('date');
  if (!filled(row.seller_id) && !filled(row.collaborator_id) && !filled(c.seller_id) && !filled(c.collaborator_id)) missing.push('seller');
  if (!filled(row.product) && !filled(row.product_name) && !filled(c.main_product)) missing.push('product');
  if (!filled(row.modality) && !filled(c.modality)) missing.push('modality');
  if (!filled(row.turn) && !filled(row.shift) && !filled(c.shift)) missing.push('shift');
  if (![row.fdi, c.fdi, c.fdi_channel, row.fdi_channel].some(validFdi)) missing.push('fdi');
  return missing;
}
