/**
 * Formato das linhas que o app lê do Supabase (ver supabase/schema.sql e scripts).
 *
 * O cliente do Supabase devolve as linhas sem tipo; estes tipos dizem o que cada
 * tela espera encontrar. Colunas que podem faltar em bancos antigos são opcionais.
 */

/** public.goal_imports — uma importação de metas do Power BI. */
export interface GoalImportRow {
  id: string;
  academic_period: string;
  product: string;
  goal_group: string;
  file_name: string;
  imported_by?: string | null;
  status: 'active' | 'replaced' | 'cancelled';
  imported_at: string;
}

/** public.goal_daily_data — um dia de uma importação de metas. */
export interface GoalDailyRow {
  id?: string;
  import_id: string;
  academic_period?: string;
  product?: string;
  goal_group?: string;
  reference_date: string;
  aa: number | null;
  target: number | null;
  actual: number | null;
}

/** public.metas_pesos — peso (%) de um consultor numa BU. */
export interface GoalWeightRow {
  user_id: string;
  bu: 'bu_presencial' | 'bu_digital' | 'pos' | 'tecnico';
  percentual: number;
}

/** public.tags_bucket — categoria de tarefa. */
export interface TagBucketRow {
  id: string;
  nome: string;
  color?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** public.price_courses — um curso de uma importação do Comparador. */
export interface PriceCourseRow {
  id?: string;
  import_id: string;
  sort_order: number;
  campus: string | null;
  course_code: string | null;
  course_name: string;
  shift: string | null;
  modality: string | null;
  list_price: number | string | null;
  scholarship_label: string | null;
  scholarship_first_pct: number | string | null;
  scholarship_ct_pct: number | string | null;
  price_first: number | string | null;
  price_ct: number | string | null;
  our_price: number | string | null;
  competitors: unknown;
}

/**
 * Linha "solta" do banco (tarefas, cadastros, perfis): as funções de leitura conferem
 * cada campo, porque registros antigos usam nomes de coluna diferentes.
 */
export type LooseRow = Record<string, unknown>;

/** Lê um campo de texto de uma linha solta ('' quando falta). */
export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

// ---------------------------------------------------------------------------
// Planejamento. Registros antigos usam outros nomes de coluna (inglês ou camelCase);
// as funções de leitura aceitam todos, por isso quase tudo é opcional.
// ---------------------------------------------------------------------------

/** Conteúdo do JSON public.tarefas.campos_customizados. */
export interface TaskCustomJson {
  fields?: unknown;
  customFields?: unknown;
  values?: unknown;
  customFieldValues?: unknown;
  assigneeIds?: unknown;
  recurrenceDays?: unknown;
  userSubmissions?: unknown;
  user_submissions?: unknown;
  completed_by_admin?: boolean;
  completedByAdmin?: boolean;
  finalizada_por_admin?: boolean;
  recurrenceSeriesId?: string;
}

/** public.tarefas — uma execução de tarefa. */
export interface TaskDbRow {
  id: string | number;
  titulo?: string | null;
  title?: string | null;
  descricao?: string | null;
  description?: string | null;
  prioridade?: string | null;
  priority?: string | null;
  recorrencia?: string | null;
  recurrence?: string | null;
  bucket?: string | null;
  categoria?: string | null;
  status?: string | null;
  tags?: string[] | string | null;
  data_inicio?: string | null;
  start_date?: string | null;
  startDate?: string | null;
  data_fim?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  data_agendada?: string | null;
  scheduled_date?: string | null;
  scheduledDate?: string | null;
  campos_customizados?: TaskCustomJson | unknown[] | null;
  custom_fields?: TaskCustomJson | unknown[] | null;
  valores_customizados?: unknown;
  comentarios?: unknown;
  comments?: unknown;
  responsaveis_ids?: unknown;
  assigned_to_ids?: unknown;
  assignees?: unknown;
  responsavel_id?: string | null;
  assigned_to?: string | null;
  assignedTo?: string | null;
  dias_recorrencia?: unknown;
  recurrence_days?: unknown;
  recurrenceDays?: unknown;
  submissoes_usuarios?: unknown;
  user_submissions?: unknown;
  userSubmissions?: unknown;
  completed_by_admin?: boolean | null;
  finalizada_por_admin?: boolean | null;
  completedByAdmin?: boolean | null;
  modelo_id?: string | null;
  data_prevista?: string | null;
}

/** public.tarefas_modelo — o cadastro de uma tarefa. */
export interface TaskModelDbRow {
  id: string;
  titulo?: string | null;
  descricao?: string | null;
  prioridade?: string | null;
  bucket?: string | null;
  tags?: unknown;
  responsaveis_ids?: unknown;
  campos?: unknown;
  recorrencia?: string | null;
  dias_recorrencia?: unknown;
  data_inicio?: string | null;
  data_fim?: string | null;
  ativa?: boolean | null;
  criado_por?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

/** public.profiles lido pelo Planejamento (aceita nomes antigos da tabela "perfis"). */
export interface PlannerProfileDbRow {
  id: string;
  nome?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  funcao?: string | null;
  role?: string | null;
  avatar_color?: string | null;
  avatarColor?: string | null;
  created_at?: string;
  createdAt?: string;
}

/** public.tags_bucket com os nomes alternativos aceitos na leitura. */
export interface TagDbRow extends Partial<TagBucketRow> {
  id: string;
  cor?: string | null;
  tag_color?: string | null;
  descricao?: string | null;
  name?: string | null;
  tag?: string | null;
  bucket?: string | null;
  titulo?: string | null;
  createdAt?: string;
}
