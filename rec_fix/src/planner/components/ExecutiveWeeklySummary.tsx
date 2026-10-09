import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowRight,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Users,
  ChevronDown,
  ChevronUp,
  Hash,
  DollarSign,
  Layers,
  Repeat,
  Sparkles,
  BarChart3,
  CalendarDays,
  Shield,
  CheckSquare,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { Task, TeamMember, Priority, TaskStatus, CustomFormField, CustomFieldValue } from '../types.ts';
import {
  formatISO,
  parseISO,
  getWeekDates,
  formatWeekInterval,
  MONTH_NAMES_PT,
  WEEKDAYS_PT,
  WEEKDAYS_SHORT_PT,
} from '../utils/dateUtils.ts';

interface ExecutiveWeeklySummaryProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  todayISO: string;
  todayDate: Date;
  onBackToPlanner: () => void;
  onTaskClick: (task: Task) => void;
}

// Estrutura de Totalização de um Campo de Formulário
interface FormFieldTotal {
  fieldId: string;
  label: string;
  type: string;
  unit?: string;
  numericSum: number;
  filledInstancesCount: number;
  totalInstancesCount: number;
  isNumeric: boolean;
  checkboxTrueCount: number;
  distinctValues: string[];
}

// Estrutura de uma Tarefa Consolidada na Semana
interface ConsolidatedTaskGroup {
  id: string; // chave base (título normalizado)
  title: string;
  description?: string;
  bucket?: string;
  priority: Priority;
  recurrence?: string;
  tags: string[];
  instances: Task[];
  totalInstances: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  completionRate: number;
  assignedMemberIds: string[];
  fieldTotals: FormFieldTotal[];
  hasFormFields: boolean;
  filledFormsCount: number;
  formFillRate: number;
}

/**
 * Função utilitária para extrair e converter números de forma tolerante a diferentes formatos
 * Suporta inteiros, floats, formato brasileiro "1.500,50", "937", strings com moeda, etc.
 */
function parseNumericValue(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    // Limpar símbolos de moeda R$, espaços, e converter vírgula decimal
    const cleaned = trimmed
      .replace(/[R$\s]/g, '')
      .replace(/\.(?=\d{3})/g, '') // remove ponto de milhar se houver
      .replace(',', '.'); // substitui vírgula decimal por ponto

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Formata um total numérico de forma elegante com separador de milhar pt-BR
 */
function formatNumberTotal(num: number, type: string, unit?: string): string {
  if (type === 'currency' || (unit && unit.toLowerCase() === 'r$')) {
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Se for inteiro ou float
  const isFloat = num % 1 !== 0;
  const formatted = num.toLocaleString('pt-BR', {
    minimumFractionDigits: isFloat ? 1 : 0,
    maximumFractionDigits: isFloat ? 2 : 0,
  });

  if (unit && unit.trim()) {
    return `${formatted} ${unit.trim()}`;
  }
  return formatted;
}

export default function ExecutiveWeeklySummary({
  tasks,
  teamMembers,
  todayISO,
  todayDate,
  onBackToPlanner,
  onTaskClick,
}: ExecutiveWeeklySummaryProps) {
  // 1. Controle da Semana Selecionada
  const [referenceDate, setReferenceDate] = useState<Date>(todayDate);
  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);
  const weekISOStrings = useMemo(() => weekDates.map(formatISO), [weekDates]);
  const currentWeekFormatted = useMemo(() => formatWeekInterval(weekDates), [weekDates]);

  // Navegação de Semanas
  const handlePrevWeek = () => {
    const prev = new Date(referenceDate);
    prev.setDate(prev.getDate() - 7);
    setReferenceDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(referenceDate);
    next.setDate(next.getDate() + 7);
    setReferenceDate(next);
  };

  const handleCurrentWeek = () => {
    setReferenceDate(new Date(todayDate));
  };

  // 2. Filtros e Estado da Interface
  const [searchTerm, setSearchTerm] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'concluida' | 'em_andamento' | 'pendente'>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [formOnlyFilter, setFormOnlyFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'title' | 'instances' | 'completion' | 'forms'>('instances');

  // Estado de expansão dos cards consolidados para ver o detalhamento diário
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpand = (groupId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const expandAllCards = () => {
    const hasAny = Object.values(expandedCards).some(Boolean);
    if (hasAny) {
      setExpandedCards({});
    } else {
      const all: Record<string, boolean> = {};
      consolidatedGroups.forEach((g) => {
        all[g.id] = true;
      });
      setExpandedCards(all);
    }
  };

  // 3. Filtragem das tarefas pertencentes à semana atual
  const weekTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tarefas agendadas nesta semana
      if (t.scheduledDate && weekISOStrings.includes(t.scheduledDate)) {
        return true;
      }
      // Tarefas que iniciam ou terminam nesta semana
      if (t.startDate && weekISOStrings.includes(t.startDate)) {
        return true;
      }
      if (t.endDate && weekISOStrings.includes(t.endDate)) {
        return true;
      }
      return false;
    });
  }, [tasks, weekISOStrings]);

  // Lista de todos os Buckets/Categorias presentes na semana
  const availableBuckets = useMemo(() => {
    const set = new Set<string>();
    weekTasks.forEach((t) => {
      if (t.bucket && t.bucket.trim()) {
        set.add(t.bucket.trim());
      }
    });
    return Array.from(set).sort();
  }, [weekTasks]);

  // 4. AGRUPAMENTO POR TÍTULO DA TAREFA & SOMA DOS FORMULÁRIOS (JSONB)
  const consolidatedGroups = useMemo<ConsolidatedTaskGroup[]>(() => {
    // Mapa chaveado pelo título normalizado
    const groupsMap = new Map<string, Task[]>();

    weekTasks.forEach((task) => {
      const titleKey = (task.title || 'Sem Título').trim().toLowerCase();
      if (!groupsMap.has(titleKey)) {
        groupsMap.set(titleKey, []);
      }
      groupsMap.get(titleKey)!.push(task);
    });

    const result: ConsolidatedTaskGroup[] = [];

    groupsMap.forEach((instances, key) => {
      // Ordenar instâncias por data agendada cronologicamente
      instances.sort((a, b) => {
        const dateA = a.scheduledDate ?? a.startDate ?? '';
        const dateB = b.scheduledDate ?? b.startDate ?? '';
        return dateA.localeCompare(dateB);
      });

      const firstInstance = instances[0];
      const title = firstInstance.title ?? 'Sem Título';
      const description = instances.find((t) => t.description)?.description ?? '';
      const bucket = instances.find((t) => t.bucket)?.bucket ?? 'Geral';
      const recurrence = instances.find((t) => t.recurrence && t.recurrence !== 'Nenhuma')?.recurrence ?? firstInstance.recurrence;

      // Determinar prioridade mais alta entre as instâncias
      let priority: Priority = 'Baixa';
      if (instances.some((t) => t.priority === 'Urgente')) priority = 'Urgente';
      else if (instances.some((t) => t.priority === 'Alta')) priority = 'Alta';
      else if (instances.some((t) => t.priority === 'Média')) priority = 'Média';

      // Coletar todas as tags distintas
      const tagsSet = new Set<string>();
      instances.forEach((t) => t.tags?.forEach((tag) => tagsSet.add(tag)));

      // Contagem de status
      const totalInstances = instances.length;
      const completedCount = instances.filter((t) => t.status === 'concluida').length;
      const inProgressCount = instances.filter((t) => t.status === 'em_andamento').length;
      const pendingCount = instances.filter((t) => t.status === 'pendente').length;
      const completionRate = totalInstances > 0 ? Math.round((completedCount / totalInstances) * 100) : 0;

      // Membros responsáveis envolvidos
      const memberIdsSet = new Set<string>();
      instances.forEach((t) => {
        if (t.assignedToIds && Array.isArray(t.assignedToIds)) {
          t.assignedToIds.forEach((id) => memberIdsSet.add(id));
        }
        if (t.assignedTo) memberIdsSet.add(t.assignedTo);
      });

      // --- SOMA E TOTALIZAÇÃO DOS FORMULÁRIOS (campos_customizados) ---
      // 1. Mapear todos os campos definidos em qualquer instância desta tarefa
      const fieldsMap = new Map<string, { field: CustomFormField; order: number }>();
      let orderCounter = 0;

      instances.forEach((t) => {
        if (t.customFields && Array.isArray(t.customFields)) {
          t.customFields.forEach((f) => {
            const fKey = f.id || f.label;
            if (!fieldsMap.has(fKey)) {
              fieldsMap.set(fKey, { field: f, order: orderCounter++ });
            }
          });
        }
      });

      // 2. Para cada campo identificado, somar valores numéricos de todas as instâncias da semana
      const fieldTotals: FormFieldTotal[] = [];

      fieldsMap.forEach(({ field }) => {
        let numericSum = 0;
        let filledInstancesCount = 0;
        let checkboxTrueCount = 0;
        const distinctValuesSet = new Set<string>();

        // Determina se o campo é explicitamente numérico ou monetário
        const isNumericType =
          field.type === 'number' ||
          /contato|quantidade|total|valor|meta|retorno|chamada|ligac|faturamento|reais|venda|producao|horas|ponto/i.test(
            field.label || field.id
          );

        instances.forEach((t) => {
          let instanceHasValues = false;

          // Se houver submissões individuais de usuários
          if (t.userSubmissions && Object.keys(t.userSubmissions).length > 0) {
            Object.values(t.userSubmissions).forEach((sub) => {
              if (sub && sub.values && sub.values[field.id] !== undefined && sub.values[field.id] !== null && sub.values[field.id] !== '') {
                instanceHasValues = true;
                const num = parseNumericValue(sub.values[field.id]);
                numericSum += num;
                distinctValuesSet.add(String(sub.values[field.id]));
              }
            });
          } else if (t.customFieldValues && Array.isArray(t.customFieldValues)) {
            const fVal = t.customFieldValues.find(
              (v) => v.fieldId === field.id || v.fieldId === field.label
            );

            if (fVal && fVal.value !== undefined && fVal.value !== null && fVal.value !== '') {
              instanceHasValues = true;
              const num = parseNumericValue(fVal.value);
              numericSum += num;

              if (typeof fVal.value === 'string' || typeof fVal.value === 'number') {
                distinctValuesSet.add(String(fVal.value));
              }
            }
          }

          if (instanceHasValues) {
            filledInstancesCount++;
          }
        });

        // Extrair possível unidade a partir do label (ex: "Total de contatos (contatos)")
        let extractedUnit = '';
        const unitMatch = (field.label || '').match(/\(([^)]+)\)$/);
        if (unitMatch && unitMatch[1]) {
          extractedUnit = unitMatch[1].trim();
        } else if (/contato|ligac|chamada/i.test(field.label || '')) {
          extractedUnit = 'contatos';
        } else if (/retorno/i.test(field.label || '')) {
          extractedUnit = 'retornos';
        }

        fieldTotals.push({
          fieldId: field.id,
          label: field.label || field.id,
          type: field.type,
          unit: extractedUnit,
          numericSum,
          filledInstancesCount,
          totalInstancesCount: totalInstances,
          isNumeric: isNumericType,
          checkboxTrueCount,
          distinctValues: Array.from(distinctValuesSet),
        });
      });

      // Se houver instâncias com respostas em `customFieldValues` cujo campo não estava no esquema formal
      instances.forEach((t) => {
        if (t.customFieldValues && Array.isArray(t.customFieldValues)) {
          t.customFieldValues.forEach((valObj) => {
            const alreadyExists = fieldTotals.some(
              (ft) => ft.fieldId === valObj.fieldId || ft.label === valObj.fieldId
            );
            if (!alreadyExists && valObj.fieldId) {
              const rawNum = parseNumericValue(valObj.value);
              const isNum = typeof valObj.value === 'number' || !isNaN(Number(valObj.value));
              fieldTotals.push({
                fieldId: valObj.fieldId,
                label: valObj.fieldId,
                type: isNum ? 'number' : 'text',
                numericSum: rawNum,
                filledInstancesCount: 1,
                totalInstancesCount: totalInstances,
                isNumeric: isNum,
                checkboxTrueCount: 0,
                distinctValues: [String(valObj.value)],
              });
            }
          });
        }
      });

      const hasFormFields = fieldTotals.length > 0;
      const filledFormsCount = instances.filter(
        (t) => t.customFieldValues && t.customFieldValues.length > 0
      ).length;
      const formFillRate =
        totalInstances > 0 ? Math.round((filledFormsCount / totalInstances) * 100) : 0;

      result.push({
        id: key,
        title,
        description,
        bucket,
        priority,
        recurrence,
        tags: Array.from(tagsSet),
        instances,
        totalInstances,
        completedCount,
        inProgressCount,
        pendingCount,
        completionRate,
        assignedMemberIds: Array.from(memberIdsSet),
        fieldTotals,
        hasFormFields,
        filledFormsCount,
        formFillRate,
      });
    });

    return result;
  }, [weekTasks]);

  // 5. Aplicação dos Filtros do Usuário
  const filteredGroups = useMemo(() => {
    return consolidatedGroups
      .filter((group) => {
        // Filtro de Busca
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchTitle = group.title.toLowerCase().includes(term);
          const matchDesc = group.description?.toLowerCase().includes(term);
          const matchBucket = group.bucket?.toLowerCase().includes(term);
          const matchTags = group.tags.some((t) => t.toLowerCase().includes(term));
          const matchMembers = group.assignedMemberIds.some((id) => {
            const m = teamMembers.find((member) => member.id === id);
            return m?.name.toLowerCase().includes(term);
          });
          const matchFields = group.fieldTotals.some((f) =>
            f.label.toLowerCase().includes(term)
          );

          if (
            !matchTitle &&
            !matchDesc &&
            !matchBucket &&
            !matchTags &&
            !matchMembers &&
            !matchFields
          ) {
            return false;
          }
        }

        // Filtro de Categoria / Bucket
        if (bucketFilter !== 'all' && group.bucket !== bucketFilter) {
          return false;
        }

        // Filtro de Status
        if (statusFilter === 'concluida' && group.completedCount === 0) return false;
        if (statusFilter === 'em_andamento' && group.inProgressCount === 0) return false;
        if (statusFilter === 'pendente' && group.pendingCount === 0) return false;

        // Filtro de Membro Responsável
        if (memberFilter !== 'all') {
          if (memberFilter === 'unassigned') {
            if (group.assignedMemberIds.length > 0) return false;
          } else {
            if (!group.assignedMemberIds.includes(memberFilter)) return false;
          }
        }

        // Filtro Apenas com Formulários
        if (formOnlyFilter && !group.hasFormFields) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'instances') return b.totalInstances - a.totalInstances;
        if (sortBy === 'completion') return b.completionRate - a.completionRate;
        if (sortBy === 'forms') return b.filledFormsCount - a.filledFormsCount;
        return a.title.localeCompare(b.title, 'pt-BR');
      });
  }, [
    consolidatedGroups,
    searchTerm,
    bucketFilter,
    statusFilter,
    memberFilter,
    formOnlyFilter,
    sortBy,
    teamMembers,
  ]);

  // 6. Métricas Executivas Globais da Semana
  const globalMetrics = useMemo(() => {
    const totalWeekTasks = weekTasks.length;
    const totalConsolidatedActions = consolidatedGroups.length;
    const totalCompleted = weekTasks.filter((t) => t.status === 'concluida').length;
    const totalInProgress = weekTasks.filter((t) => t.status === 'em_andamento').length;
    const totalPending = weekTasks.filter((t) => t.status === 'pendente').length;
    const globalCompletionRate =
      totalWeekTasks > 0 ? Math.round((totalCompleted / totalWeekTasks) * 100) : 0;

    // Métricas de Formulários
    const tasksWithForms = weekTasks.filter(
      (t) => t.customFields && t.customFields.length > 0
    ).length;
    const tasksWithFilledForms = weekTasks.filter(
      (t) => t.customFieldValues && t.customFieldValues.length > 0
    ).length;

    // Totalizadores Globais Chave (ex: Contatos, Retornos, Faturamento somados de toda a empresa)
    let totalContatos = 0;
    let totalRetornos = 0;
    let totalFinanceiro = 0;

    consolidatedGroups.forEach((group) => {
      group.fieldTotals.forEach((f) => {
        const labelLower = f.label.toLowerCase();
        if (/contato|chamada|ligac/i.test(labelLower)) {
          totalContatos += f.numericSum;
        } else if (/retorno|visita|reuniao/i.test(labelLower)) {
          totalRetornos += f.numericSum;
        } else if (
          f.type === 'currency' ||
          /faturamento|valor|faturado|receita/i.test(labelLower)
        ) {
          totalFinanceiro += f.numericSum;
        }
      });
    });

    const activeMemberIds = Array.from(
      new Set(
        weekTasks.flatMap((t) =>
          t.assignedToIds && t.assignedToIds.length > 0
            ? t.assignedToIds
            : t.assignedTo
            ? [t.assignedTo]
            : []
        )
      )
    );

    return {
      totalWeekTasks,
      totalConsolidatedActions,
      totalCompleted,
      totalInProgress,
      totalPending,
      globalCompletionRate,
      tasksWithForms,
      tasksWithFilledForms,
      totalContatos,
      totalRetornos,
      totalFinanceiro,
      activeMembersCount: activeMemberIds.length,
    };
  }, [weekTasks, consolidatedGroups]);

  // Exportar dados consolidados em formato CSV
  const handleExportCSV = () => {
    const headers = [
      'Título da Tarefa',
      'Categoria/Bucket',
      'Prioridade',
      'Recorrência',
      'Total de Ocorrências na Semana',
      'Concluídas',
      'Em Andamento',
      'Pendentes',
      'Taxa de Conclusão (%)',
      'Responsáveis',
      'Totais dos Formulários (Campos Somados)',
    ];

    const rows = filteredGroups.map((g) => {
      const memberNames = g.assignedMemberIds
        .map((id) => teamMembers.find((m) => m.id === id)?.name || id)
        .join('; ');

      const formsSummary = g.fieldTotals
        .map((f) => {
          if (f.isNumeric) {
            return `${f.label}: ${formatNumberTotal(f.numericSum, f.type, f.unit)}`;
          }
          if (f.type === 'checkbox') {
            return `${f.label}: ${f.checkboxTrueCount}/${f.totalInstancesCount} confirmados`;
          }
          return `${f.label}: ${f.distinctValues.join(', ')}`;
        })
        .join(' | ');

      return [
        `"${g.title.replace(/"/g, '""')}"`,
        `"${g.bucket || ''}"`,
        `"${g.priority}"`,
        `"${g.recurrence || 'Nenhuma'}"`,
        `"${g.totalInstances}"`,
        `"${g.completedCount}"`,
        `"${g.inProgressCount}"`,
        `"${g.pendingCount}"`,
        `"${g.completionRate}%"`,
        `"${memberNames.replace(/"/g, '""')}"`,
        `"${formsSummary.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `resumo_executivo_consolidado_${weekISOStrings[0]}_a_${weekISOStrings[6]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="executive-weekly-summary-view"
      className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto"
    >
      {/* 1. TOPO DA VISÃO EXECUTIVA */}
      <div className="bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-4 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Título & Identificação */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-zinc-900 leading-tight">
                  Resumo Executivo Semanal
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                  <Shield className="w-3 h-3" />
                  Consolidado por Tarefa
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Visão consolidada com soma total dos formulários preenchidos na semana
              </p>
            </div>
          </div>

          {/* Navegação de Semanas & Ações */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            {/* Seletor de Semana */}
            <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-lg p-0.5 shadow-2xs">
              <button
                id="exec-prev-week-btn"
                type="button"
                onClick={handlePrevWeek}
                className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 rounded-md transition-colors cursor-pointer"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                id="exec-current-week-btn"
                type="button"
                onClick={handleCurrentWeek}
                className="px-2.5 py-1 text-xs font-semibold text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-200/80 rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                Semana Atual
              </button>

              <button
                id="exec-next-week-btn"
                type="button"
                onClick={handleNextWeek}
                className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 rounded-md transition-colors cursor-pointer"
                title="Próxima semana"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 text-xs font-bold text-blue-900 flex items-center gap-1.5 border-l border-zinc-200/70 ml-0.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{currentWeekFormatted}</span>
              </div>
            </div>

            {/* Exportar CSV */}
            <button
              id="exec-export-csv-btn"
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200/80 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="Baixar relatório consolidado da semana em CSV"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Voltar ao Planner */}
            <button
              id="exec-back-to-planner-btn"
              type="button"
              onClick={onBackToPlanner}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <span>Voltar ao Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. CONTEÚDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* CARDS DE RESUMO / MÉTRICAS EXECUTIVAS GLOBAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total de Tarefas Consolidadas */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Ações Consolidadas
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-zinc-900">
                {globalMetrics.totalConsolidatedActions}
              </span>
              <span className="text-xs font-medium text-zinc-500">títulos distintos</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span>Instâncias na semana:</span>
              <span className="font-bold text-zinc-800">
                {globalMetrics.totalWeekTasks} ocorrências
              </span>
            </div>
          </div>

          {/* Card 2: Taxa de Conclusão Global */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Conclusão Geral
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600">
                  {globalMetrics.totalCompleted}
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  / {globalMetrics.totalWeekTasks}
                </span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {globalMetrics.globalCompletionRate}% taxa
              </span>
            </div>

            {/* Barra de Progresso */}
            <div className="mt-2.5 w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${globalMetrics.globalCompletionRate}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
              <span className="text-amber-600 font-medium">
                {globalMetrics.totalInProgress} em andamento
              </span>
              <span className="text-zinc-600 font-medium">
                {globalMetrics.totalPending} pendentes
              </span>
            </div>
          </div>

          {/* Card 3: Totalizadores de Formulários (Soma Chave da Semana) */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Total de Contatos / Volume
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Hash className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-700">
                {globalMetrics.totalContatos > 0
                  ? globalMetrics.totalContatos.toLocaleString('pt-BR')
                  : globalMetrics.tasksWithFilledForms}
              </span>
              <span className="text-xs font-medium text-zinc-500">
                {globalMetrics.totalContatos > 0 ? 'contatos somados' : 'formulários preenchidos'}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span>Retornos / Retornos:</span>
              <span className="font-bold text-indigo-900">
                {globalMetrics.totalRetornos > 0
                  ? `${globalMetrics.totalRetornos.toLocaleString('pt-BR')} retornos`
                  : `${globalMetrics.tasksWithFilledForms} instâncias`}
              </span>
            </div>
          </div>

          {/* Card 4: Colaboradores & Cobertura de Formulários */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Equipe em Atividade
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-700">
                {globalMetrics.activeMembersCount}
              </span>
              <span className="text-xs font-medium text-zinc-500">membros com tarefas</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <span>Cobertura de formulários:</span>
              <span className="font-bold text-purple-900">
                {globalMetrics.tasksWithForms > 0
                  ? `${Math.round((globalMetrics.tasksWithFilledForms / globalMetrics.tasksWithForms) * 100)}% preenchidos`
                  : '100%'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. BARRA DE FILTROS, ORDENAÇÃO E PESQUISA */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="exec-search-consolidated-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título (ex: MSV), categoria, campo ou membro..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-zinc-800 placeholder-zinc-400"
              />
            </div>

            {/* Ordenação dos Cards */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="instances">Mais Ocorrências na Semana</option>
                <option value="completion">Maior Taxa de Conclusão</option>
                <option value="forms">Mais Formulários Preenchidos</option>
                <option value="title">Título Alfabético (A-Z)</option>
              </select>

              <button
                type="button"
                onClick={expandAllCards}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                title="Expandir ou recolher detalhamento de todos os cards"
              >
                {Object.values(expandedCards).some(Boolean) ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Recolher Detalhes</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Expandir Detalhes</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filtros Secundários: Categoria, Status, Membro e Checkbox de Formulários */}
          <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por Categoria / Bucket */}
              {availableBuckets.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-500">Plano/Bucket:</span>
                  <select
                    value={bucketFilter}
                    onChange={(e) => setBucketFilter(e.target.value)}
                    className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px] truncate"
                  >
                    <option value="all">Todos os Planos</option>
                    {availableBuckets.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro de Status */}
              <div className="flex items-center gap-1 text-xs text-zinc-600">
                <span className="font-medium text-zinc-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">Todos os Status</option>
                  <option value="concluida">Com Concluídas</option>
                  <option value="em_andamento">Com Em Andamento</option>
                  <option value="pendente">Com Pendentes</option>
                </select>
              </div>

              {/* Filtro de Responsável */}
              <div className="flex items-center gap-1 text-xs text-zinc-600">
                <span className="font-medium text-zinc-500">Membro:</span>
                <select
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px] truncate"
                >
                  <option value="all">Toda a Equipe</option>
                  <option value="unassigned">Sem Atribuição</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkbox Apenas com Formulários */}
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 font-medium cursor-pointer ml-1 select-none">
                <input
                  type="checkbox"
                  checked={formOnlyFilter}
                  onChange={(e) => setFormOnlyFilter(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span>Apenas com formulários preenchidos</span>
              </label>
            </div>

            <div className="text-xs text-zinc-400 font-medium">
              Exibindo <strong className="text-zinc-700">{filteredGroups.length}</strong> de{' '}
              {consolidatedGroups.length} títulos consolidados ({weekTasks.length} instâncias)
            </div>
          </div>
        </div>

        {/* 4. LISTA DE CARDS CONSOLIDADOS POR TÍTULO DA TAREFA */}
        {filteredGroups.length === 0 ? (
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-4">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-zinc-800">
              Nenhuma tarefa encontrada para esta semana
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              Não há tarefas agendadas no período de {currentWeekFormatted} com os filtros atuais.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCurrentWeek}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Ir para Semana Atual
              </button>
              {(searchTerm || bucketFilter !== 'all' || statusFilter !== 'all' || formOnlyFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setBucketFilter('all');
                    setStatusFilter('all');
                    setMemberFilter('all');
                    setFormOnlyFilter(false);
                  }}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const isExpanded = !!expandedCards[group.id];

              return (
                <div
                  key={group.id}
                  id={`consolidated-card-${group.id}`}
                  className="bg-white border border-zinc-200/90 rounded-2xl shadow-2xs hover:shadow-xs transition-all overflow-hidden"
                >
                  {/* CABEÇALHO DO CARD CONSOLIDADO */}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Esquerda: Identificação da Tarefa, Badges e Descrição */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                            <span>{group.title}</span>
                          </h2>

                          {/* Badge de Bucket / Categoria */}
                          {group.bucket && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200/70">
                              {group.bucket}
                            </span>
                          )}

                          {/* Badge de Recorrência */}
                          {group.recurrence && group.recurrence !== 'Nenhuma' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
                              <Repeat className="w-3 h-3 text-blue-500" />
                              <span>{group.recurrence}</span>
                            </span>
                          )}

                          {/* Badge de Prioridade */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              group.priority === 'Urgente'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                : group.priority === 'Alta'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                : group.priority === 'Média'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                : 'bg-zinc-100 text-zinc-600 border border-zinc-200/70'
                            }`}
                          >
                            {group.priority}
                          </span>
                        </div>

                        {/* Descrição resumida se houver */}
                        {group.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2">{group.description}</p>
                        )}

                        {/* Linha do Tempo da Semana (Dias em que ocorreu) */}
                        <div className="flex items-center flex-wrap gap-1.5 pt-1">
                          <span className="text-[11px] font-medium text-zinc-400">
                            Dias agendados:
                          </span>
                          {group.instances.map((inst) => {
                            const dateStr = inst.scheduledDate || inst.startDate || '';
                            let dayLabel = dateStr;
                            if (dateStr) {
                              const parsed = parseISO(dateStr);
                              const dayIndex = parsed.getDay();
                              dayLabel = `${WEEKDAYS_SHORT_PT[dayIndex]} ${parsed.getDate()}`;
                            }

                            return (
                              <button
                                key={inst.id}
                                type="button"
                                onClick={() => onTaskClick(inst)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                                  inst.status === 'concluida'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                    : inst.status === 'em_andamento'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                    : 'bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200'
                                }`}
                                title={`Ver detalhes da instância do dia ${dateStr} (${inst.status})`}
                              >
                                {inst.status === 'concluida' ? (
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5 text-zinc-400" />
                                )}
                                <span>{dayLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Direita: Métricas de Progresso & Responsáveis */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 min-w-[240px]">
                        {/* Status de Conclusão */}
                        <div className="w-full text-left lg:text-right space-y-1">
                          <div className="flex items-center justify-between lg:justify-end gap-2">
                            <span className="text-xs font-semibold text-zinc-500">
                              {group.completedCount} de {group.totalInstances} concluídas
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {group.completionRate}%
                            </span>
                          </div>
                          {/* Barra de Progresso do Card */}
                          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${group.completionRate}%` }}
                            />
                          </div>
                        </div>

                        {/* Membros Envolvidos */}
                        {group.assignedMemberIds.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-zinc-400">Responsáveis:</span>
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {group.assignedMemberIds.map((memberId) => {
                                const member = teamMembers.find((m) => m.id === memberId);
                                const initials = member?.name
                                  ? member.name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2)
                                  : '?';

                                return (
                                  <div
                                    key={memberId}
                                    className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-2xs"
                                    title={member?.name || 'Membro da equipe'}
                                  >
                                    {initials}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DESTAQUE PRINCIPAL: TOTAIS E SOMA DOS FORMULÁRIOS (campos_customizados) */}
                    {group.hasFormFields && group.fieldTotals.length > 0 ? (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span>Totalizadores Consolidados da Semana</span>
                          </div>
                          <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                            {group.filledFormsCount} de {group.totalInstances} instâncias
                            preenchidas ({group.formFillRate}%)
                          </span>
                        </div>

                        {/* Grade de Cards Totalizadores Somados */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                          {group.fieldTotals.map((fieldTotal) => {
                            return (
                              <div
                                key={fieldTotal.fieldId}
                                className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-100/90 rounded-xl p-3 shadow-2xs flex flex-col justify-between"
                              >
                                <span className="text-[11px] font-bold text-zinc-600 line-clamp-1">
                                  {fieldTotal.label}
                                </span>

                                <div className="mt-1.5 flex items-baseline gap-1">
                                  {fieldTotal.isNumeric ? (
                                    <span className="text-xl font-black text-blue-900 tracking-tight">
                                      {formatNumberTotal(
                                        fieldTotal.numericSum,
                                        fieldTotal.type,
                                        fieldTotal.unit
                                      )}
                                    </span>
                                  ) : fieldTotal.type === 'checkbox' ? (
                                    <span className="text-base font-black text-blue-900">
                                      {fieldTotal.checkboxTrueCount} /{' '}
                                      {fieldTotal.totalInstancesCount} confirmados
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-zinc-700 line-clamp-2">
                                      {fieldTotal.distinctValues.length > 0
                                        ? fieldTotal.distinctValues.join(', ')
                                        : '—'}
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] text-zinc-400 mt-1">
                                  {fieldTotal.filledInstancesCount} registros na semana
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-400 flex items-center justify-between">
                        <span>Sem campos de formulário configurados</span>
                        <span className="text-zinc-500 font-medium">
                          {group.totalInstances} instâncias cadastradas
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RODAPÉ DO CARD: BOTÃO PARA EXPANDIR AS OCORRÊNCIAS DIÁRIAS */}
                  <div className="bg-zinc-50/80 border-t border-zinc-100 px-4 py-2.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleCardExpand(group.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Ocultar ocorrências diárias da semana ({group.totalInstances})</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                          <span>
                            Ver detalhamento diário de <strong>{group.title}</strong> (
                            {group.totalInstances} instâncias)
                          </span>
                        </>
                      )}
                    </button>

                    <span className="text-[11px] text-zinc-400 font-medium">
                      Semana {currentWeekFormatted}
                    </span>
                  </div>

                  {/* PAINEL EXPANSÍVEL: TABELA COM CADA DIA E VALORES INDIVIDUAIS */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 bg-white p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 text-zinc-500 font-semibold bg-zinc-50">
                            <th className="py-2 px-3">Data / Dia</th>
                            <th className="py-2 px-3">Responsável</th>
                            <th className="py-2 px-3">Status</th>
                            {group.fieldTotals.map((ft) => (
                              <th key={ft.fieldId} className="py-2 px-3 text-right">
                                {ft.label}
                              </th>
                            ))}
                            <th className="py-2 px-3 text-center">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {group.instances.map((inst) => {
                            const dateStr = inst.scheduledDate || inst.startDate || '';
                            let formattedDate = dateStr;
                            if (dateStr) {
                              const parsed = parseISO(dateStr);
                              const dayOfWeek = WEEKDAYS_PT[parsed.getDay()];
                              formattedDate = `${dayOfWeek}, ${parsed.getDate()} de ${MONTH_NAMES_PT[parsed.getMonth()]}`;
                            }

                            const assignedMember = teamMembers.find(
                              (m) => m.id === inst.assignedTo
                            );

                            return (
                              <tr key={inst.id} className="hover:bg-blue-50/40 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-zinc-800 whitespace-nowrap">
                                  {formattedDate}
                                </td>
                                <td className="py-2.5 px-3 text-zinc-600 whitespace-nowrap">
                                  {assignedMember?.name || 'Não atribuído'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      inst.status === 'concluida'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : inst.status === 'em_andamento'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                                    }`}
                                  >
                                    {inst.status === 'concluida'
                                      ? 'Concluída'
                                      : inst.status === 'em_andamento'
                                      ? 'Em Andamento'
                                      : 'Pendente'}
                                  </span>
                                </td>

                                {/* Valores individuais do dia */}
                                {group.fieldTotals.map((ft) => {
                                  const valObj = inst.customFieldValues?.find(
                                    (v) => v.fieldId === ft.fieldId || v.fieldId === ft.label
                                  );

                                  let displayVal = '—';
                                  if (
                                    valObj &&
                                    valObj.value !== undefined &&
                                    valObj.value !== null &&
                                    valObj.value !== ''
                                  ) {
                                    if (ft.isNumeric) {
                                      const num = parseNumericValue(valObj.value);
                                      displayVal = formatNumberTotal(num, ft.type, ft.unit);
                                    } else if (ft.type === 'checkbox') {
                                      displayVal = valObj.value ? '✓ Sim' : '✗ Não';
                                    } else {
                                      displayVal = String(valObj.value);
                                    }
                                  }

                                  return (
                                    <td
                                      key={ft.fieldId}
                                      className="py-2.5 px-3 text-right font-bold text-zinc-800 whitespace-nowrap"
                                    >
                                      {displayVal}
                                    </td>
                                  );
                                })}

                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => onTaskClick(inst)}
                                    className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Abrir detalhes e formulário desta ocorrência"
                                  >
                                    <span>Abrir</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
