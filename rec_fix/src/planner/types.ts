export type UserRole = 'admin' | 'member';

export type Priority = 'Urgente' | 'Alta' | 'Média' | 'Baixa';

export type Recurrence = 'Nenhuma' | 'Segunda a Sexta' | 'Diariamente' | 'Semanalmente' | 'Mensalmente' | 'Personalizado';

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarColor: string;
  initials: string;
  color?: string; // alias opcional para avatarColor
  avatar?: string; // alias opcional para initials
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  text: string;
  createdAt: string;
}

export interface CustomFormField {
  id: string;
  label: string; // Ex: "Número de ligações totais"
  type: 'number' | 'text';
  required: boolean;
  placeholder?: string;
}

export interface CustomFieldValue {
  fieldId: string;
  value: string | number;
}

export interface UserTaskSubmission {
  userId: string;
  userName?: string;
  completed: boolean;
  completedAt?: string;
  observacao?: string; // Observação individual opcional sobre a parte do responsável
  observation?: string; // alias opcional
  values: Record<string, string | number>; // fieldId -> value
  completedByAdmin?: boolean; // Sinaliza se esta submissão/parte foi concluída por um Administrador
  completed_by_admin?: boolean; // Alias compatível com Supabase
  finalizada_por_admin?: boolean; // Alias em português
}

export interface TagBucket {
  id: string;
  nome: string;
  cor?: string;
  color?: string; // alias direto para a coluna 'color' do Supabase
  descricao?: string;
  description?: string; // alias direto para a coluna 'description' do Supabase
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  recurrence: Recurrence;
  recurrenceDays?: string[]; // Ex: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
  tags: string[];
  assignedTo?: string | null; // TeamMember ID principal/legado
  assignedToIds?: string[]; // Múltiplos responsáveis designados
  bucket: string; // ex: 'Financeiro', 'Operacional', 'Tecnologia', 'Marketing', 'Estratégico'
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  scheduledDate?: string | null; // YYYY-MM-DD for assigned day, or null for unscheduled
  status: TaskStatus;
  comments: TaskComment[];
  customFields?: CustomFormField[]; // Campos dinâmicos configurados pelo admin
  customFieldValues?: CustomFieldValue[]; // Valores preenchidos legado/unificado
  userSubmissions?: Record<string, UserTaskSubmission>; // Submissão individual de cada usuário responsável
  completedByAdmin?: boolean; // Sinaliza se a tarefa foi finalizada por um Administrador
  completed_by_admin?: boolean; // Alias para compatibilidade direta com payloads do Supabase
  finalizada_por_admin?: boolean; // Alias alternativo em português
}
