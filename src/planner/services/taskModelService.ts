import { supabase } from '../../lib/supabase';
import { todayLocalIso } from '../../lib/dates';
import { CustomFormField, Priority, Recurrence, TaskModel } from '../types.ts';
import type { TaskModelDbRow } from '../../lib/dbTypes';
import { errorText } from '../../lib/errors';

/**
 * Cadastro de tarefas (tabela tarefas_modelo).
 * As execuções (tabela tarefas) são criadas e sincronizadas pelo banco:
 * ao gravar/editar um cadastro, os gatilhos geram as próximas 8 semanas e
 * atualizam as execuções futuras pendentes.
 */

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* texto separado por vírgula */
    }
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

export const mapRowToTaskModel = (row: TaskModelDbRow): TaskModel => ({
  id: String(row.id),
  title: row.titulo ?? 'Sem título',
  description: row.descricao ?? '',
  priority: (row.prioridade ?? 'Alta') as Priority,
  bucket: row.bucket ?? 'Operacional',
  tags: toArray(row.tags),
  assigneeIds: toArray(row.responsaveis_ids),
  fields: Array.isArray(row.campos) ? (row.campos as CustomFormField[]) : [],
  recurrence: (row.recorrencia ?? 'Nenhuma') as Recurrence,
  recurrenceDays: toArray(row.dias_recorrencia),
  startDate: row.data_inicio ?? null,
  endDate: row.data_fim ?? null,
  active: row.ativa !== false,
  createdBy: row.criado_por ?? null,
  createdAt: row.criado_em,
  updatedAt: row.atualizado_em,
});

export type TaskModelInput = Omit<TaskModel, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'active'> & { active?: boolean };

const toRow = (m: TaskModelInput) => ({
  titulo: m.title.trim(),
  descricao: (m.description ?? '').trim(),
  prioridade: m.priority,
  bucket: m.bucket,
  tags: m.tags ?? [],
  responsaveis_ids: m.assigneeIds,
  campos: m.fields,
  recorrencia: m.recurrence,
  dias_recorrencia: m.recurrence === 'Personalizado' ? m.recurrenceDays : [],
  data_inicio: m.startDate || null,
  data_fim: m.recurrence === 'Nenhuma' ? null : m.endDate || null,
  ...(m.active !== undefined ? { ativa: m.active } : {}),
});

const friendlyError = (error: unknown): Error => {
  const msg = errorText(error, '');
  if (/tarefas_modelo/.test(msg) && /(does not exist|schema cache|not find)/i.test(msg)) {
    return new Error('O cadastro de tarefas ainda não existe no banco. Rode supabase/tarefas-modelo.sql no Supabase.');
  }
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error('Só quem criou a tarefa (ou um admin) pode alterá-la.');
  }
  return new Error(msg || 'Não foi possível salvar a tarefa.');
};

export const taskModelService = {
  async list(): Promise<{ data: TaskModel[]; error: Error | null; missingTable?: boolean }> {
    const { data, error } = await supabase.from('tarefas_modelo').select('*').order('titulo', { ascending: true });
    if (error) {
      const missingTable = /tarefas_modelo/.test(error.message) && /(does not exist|schema cache|not find)/i.test(error.message);
      return { data: [], error: friendlyError(error), missingTable };
    }
    return { data: (data || []).map(mapRowToTaskModel), error: null };
  },

  async create(input: TaskModelInput, userId: string): Promise<TaskModel> {
    const { data, error } = await supabase
      .from('tarefas_modelo')
      .insert({ ...toRow(input), criado_por: userId })
      .select('*')
      .single();
    if (error || !data) throw friendlyError(error);
    return mapRowToTaskModel(data);
  },

  async update(id: string, input: TaskModelInput): Promise<TaskModel> {
    const { data, error } = await supabase.from('tarefas_modelo').update(toRow(input)).eq('id', id).select('*');
    if (error) throw friendlyError(error);
    if (!data || !data.length) throw new Error('Só quem criou a tarefa (ou um admin) pode alterá-la.');
    return mapRowToTaskModel(data[0]);
  },

  async remove(id: string): Promise<void> {
    const { data, error } = await supabase.from('tarefas_modelo').delete().eq('id', id).select('id');
    if (error) throw friendlyError(error);
    if (!data || !data.length) throw new Error('Só quem criou a tarefa (ou um admin) pode excluí-la.');
  },

  /** Garante o horizonte de 8 semanas (o banco também roda isso todo dia via pg_cron). */
  async ensureHorizon(): Promise<number> {
    const { data, error } = await supabase.rpc('gerar_execucoes_tarefas');
    if (error) return 0;
    return Number(data) || 0;
  },
};

// ---------------------------------------------------------------------------
// Regras de repetição (para a aba Tarefas)
// ---------------------------------------------------------------------------

export const WEEKDAY_KEYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAY_INDEX: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, 'sáb': 6 };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const parseIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

/** Dias da semana (0 = domingo) em que a tarefa roda; vazio para mensais e avulsas. */
export function weekdaysOf(model: TaskModel): number[] {
  const rec = norm(model.recurrence);
  if (rec.includes('diari')) return [0, 1, 2, 3, 4, 5, 6];
  if (rec.includes('segunda') || rec.includes('util')) return [1, 2, 3, 4, 5];
  if (rec.includes('personaliz')) {
    return Array.from(new Set(model.recurrenceDays.map((d) => DAY_INDEX[norm(d).slice(0, 3)]).filter((n) => n !== undefined)));
  }
  if (rec.includes('seman')) return [parseIsoDate(model.startDate || todayLocalIso()).getDay()];
  return [];
}

export const isRecurring = (model: Pick<TaskModel, 'recurrence'>) => norm(model.recurrence) !== 'nenhuma' && String(model.recurrence) !== '';
export const isMonthly = (model: Pick<TaskModel, 'recurrence'>) => norm(model.recurrence).includes('mensa');

export function ruleLabel(model: TaskModel): string {
  const rec = norm(model.recurrence);
  if (rec.includes('diari')) return 'Todos os dias';
  if (rec.includes('segunda') || rec.includes('util')) return 'Segunda a sexta';
  if (rec.includes('personaliz')) {
    const days = weekdaysOf(model).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return days.length ? days.map((d) => WEEKDAY_FULL[d].slice(0, 3)).join(', ') : 'Dias específicos';
  }
  if (rec.includes('seman')) {
    const d = weekdaysOf(model)[0];
    return `Toda ${WEEKDAY_FULL[d].toLowerCase()}${d === 0 || d === 6 ? '' : '-feira'}`;
  }
  if (rec.includes('mensa')) return model.startDate ? `Todo dia ${parseIsoDate(model.startDate).getDate()}` : 'Todo mês';
  if (model.startDate) return `Uma vez · ${parseIsoDate(model.startDate).toLocaleDateString('pt-BR')}`;
  return 'Uma vez · sem data (fila)';
}
