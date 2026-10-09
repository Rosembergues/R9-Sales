import type { Sale, UserGoalData } from '../../types';

export type RankingOperation =
  | 'todos_produtos'
  | 'graduacao_total'
  | 'bu_presencial'
  | 'bu_digital'
  | 'pos'
  | 'tecnico';

export const RANKING_OPERATION_OPTIONS: Array<{
  value: RankingOperation;
  label: string;
  description: string;
}> = [
  { value: 'todos_produtos', label: 'Todos os Produtos', description: 'Graduação + Pós + Técnico' },
  { value: 'graduacao_total', label: 'Graduação Total', description: 'BU Presencial + BU Digital' },
  { value: 'bu_presencial', label: 'BU Presencial', description: 'Presencial, Semi e Ao Vivo' },
  { value: 'bu_digital', label: 'BU Digital', description: 'EAD e FLEX' },
  { value: 'pos', label: 'Pós-Graduação', description: 'Todas as modalidades de Pós' },
  { value: 'tecnico', label: 'Curso Técnico', description: 'Técnico Presencial' },
];

export function normalizeRankingText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getSaleRankingOperation(sale: Sale): Exclude<RankingOperation, 'todos_produtos' | 'graduacao_total'> {
  const product = normalizeRankingText(sale.custom_data?.main_product || sale.product_name || '');
  const modality = normalizeRankingText(sale.custom_data?.modality || '');
  const businessUnit = normalizeRankingText(sale.custom_data?.business_unit || '');

  // Produto vem primeiro para que "Pós Digital" não entre na BU Digital da Graduação.
  if (product.includes('pos')) return 'pos';
  if (product.includes('tecnico') || modality.includes('tecnico')) return 'tecnico';

  const isDigital = businessUnit.includes('digital')
    || modality === 'ead'
    || modality === 'flex'
    || modality.includes('digital')
    || modality.includes('dlex');

  return isDigital ? 'bu_digital' : 'bu_presencial';
}

export function saleMatchesRankingOperation(sale: Sale, operation: RankingOperation): boolean {
  if (operation === 'todos_produtos') return true;

  const saleOperation = getSaleRankingOperation(sale);
  if (operation === 'graduacao_total') {
    return saleOperation === 'bu_presencial' || saleOperation === 'bu_digital';
  }
  return saleOperation === operation;
}

export function getRankingOperationTarget(
  goal: UserGoalData | undefined,
  operation: RankingOperation,
): number {
  if (!goal) return 0;

  const buPresencial = Number(goal.target_bu_presencial) || 0;
  const buDigital = Number(goal.target_bu_digital) || 0;

  switch (operation) {
    case 'todos_produtos': {
      // target_total is maintained as the sum of BU Presencial, BU Digital, Pós and Técnico.
      // Prefer this authoritative consolidated goal, falling back to category goals for legacy rows.
      const consolidatedTarget = Number(goal.target_total) || 0;
      if (consolidatedTarget > 0) return consolidatedTarget;
      const graduationTarget = Number(goal.target_graduacao) || buPresencial + buDigital;
      return graduationTarget + (Number(goal.target_pos) || 0) + (Number(goal.target_tecnico) || 0);
    }
    case 'graduacao_total': {
      const hasBuTargets = goal.target_bu_presencial !== undefined || goal.target_bu_digital !== undefined;
      const combinedBuTarget = buPresencial + buDigital;
      return hasBuTargets && combinedBuTarget > 0 ? combinedBuTarget : (Number(goal.target_graduacao) || 0);
    }
    case 'bu_presencial':
      return buPresencial;
    case 'bu_digital':
      return buDigital;
    case 'pos':
      return Number(goal.target_pos) || 0;
    case 'tecnico':
      return Number(goal.target_tecnico) || 0;
    default:
      return 0;
  }
}
