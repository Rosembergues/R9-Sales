import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Check,
  X,
  Layers,
  Palette,
  ShieldCheck,
  FolderOpen,
  Info,
  Sliders,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { tagService, PRESET_TAG_COLORS } from '../services/tagService.ts';
import { TagBucket, Task } from '../types.ts';

interface TagManagementViewProps {
  isAdmin: boolean;
  userRole?: string;
  tasks?: Task[];
  onBackToPlanner: () => void;
  onTagsUpdated?: (tags: TagBucket[]) => void;
}

export default function TagManagementView({
  isAdmin,
  userRole,
  tasks = [],
  onBackToPlanner,
  onTagsUpdated,
}: TagManagementViewProps) {
  const [tags, setTags] = useState<TagBucket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Ref estável para onTagsUpdated evitando loops de renderização
  const onTagsUpdatedRef = useRef(onTagsUpdated);
  useEffect(() => {
    onTagsUpdatedRef.current = onTagsUpdated;
  });

  // Formulário de Criação
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#004691');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Estados de Edição
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#004691');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal de Confirmação de Exclusão com Verificação de Vínculo
  const [deletingTag, setDeletingTag] = useState<TagBucket | null>(null);
  const [associatedTaskCount, setAssociatedTaskCount] = useState<number>(0);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notificações Toast
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Carregar todas as tags do Supabase com timeout de segurança e garantia incondicional no finally
  const loadTags = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);
    setFetchError(null);

    // Timeout de segurança para evitar que o loading fique rodando indefinidamente
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    }, 5000);

    try {
      const { data, error } = await tagService.fetchTags();

      if (error) {
        const errMsg =
          error.message ||
          (typeof error === 'string' ? error : 'Falha ao consultar a tabela tags_bucket.');
        setFetchError(errMsg);
        showNotification(`Erro ao consultar tags_bucket: ${errMsg}`, 'error');
        setTags([]);
        onTagsUpdatedRef.current?.([]);
      } else {
        setFetchError(null);
        setTags(data || []);
        onTagsUpdatedRef.current?.(data || []);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Erro de rede ao conectar ao Supabase.';
      setFetchError(errMsg);
      showNotification(errMsg, 'error');
      setTags([]);
    } finally {
      clearTimeout(fallbackTimer);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Busca inicial com dependências estritamente vazias [] para rodar apenas na montagem
  useEffect(() => {
    loadTags(true);

    // Canal Realtime para a tabela tags_bucket
    const channel = supabase
      .channel('tags_bucket_realtime_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags_bucket',
        },
        () => {
          loadTags(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Contagem de tarefas associadas por tag a partir do estado local de tarefas
  const tagUsageMap = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.bucket) {
        map[t.bucket] = (map[t.bucket] ?? 0) + 1;
      }
      if (Array.isArray(t.tags)) {
        t.tags.forEach((tagItem) => {
          map[tagItem] = (map[tagItem] ?? 0) + 1;
        });
      }
    });
    return map;
  }, [tasks]);

  // Filtragem de tags na busca
  const filteredTags = useMemo(() => {
    return tags.filter((t) => {
      const matchSearch =
        t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.descricao && t.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSearch;
    });
  }, [tags, searchTerm]);

  // Criar Nova Tag
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showNotification('Apenas administradores podem criar categorias.', 'error');
      return;
    }

    const cleanName = newTagName.trim();
    if (!cleanName) {
      showNotification('O nome da tag/categoria é obrigatório.', 'error');
      return;
    }

    // Verificar se já existe uma tag com o mesmo nome
    const exists = tags.some(
      (t) => t.nome.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      showNotification(`A categoria "${cleanName}" já está cadastrada.`, 'error');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await tagService.createTag({
        nome: cleanName,
        color: newTagColor,
        cor: newTagColor,
        description: newTagDescription.trim(),
        descricao: newTagDescription.trim(),
      });

      if (error) {
        showNotification(`Erro ao criar no Supabase: ${error.message || 'Falha na inserção.'}`, 'error');
      } else {
        showNotification(`Categoria "${cleanName}" cadastrada com sucesso!`, 'success');
        setNewTagName('');
        setNewTagDescription('');
        setNewTagColor('#004691');
        if (data) {
          const updated = [...tags, data].sort((a, b) => a.nome.localeCompare(b.nome));
          setTags(updated);
          onTagsUpdated?.(updated);
        } else {
          loadTags(false);
        }
      }
    } catch {
      showNotification('Erro ao criar categoria.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Iniciar Edição
  const handleStartEdit = (tag: TagBucket) => {
    setEditingTagId(tag.id);
    setEditName(tag.nome);
    setEditColor(tag.cor || '#004691');
    setEditDescription(tag.descricao || '');
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditName('');
    setEditColor('#004691');
    setEditDescription('');
  };

  // Salvar Edição
  const handleSaveEdit = async (tag: TagBucket) => {
    if (!isAdmin) return;

    const cleanName = editName.trim();
    if (!cleanName) {
      showNotification('O nome da categoria não pode ficar vazio.', 'error');
      return;
    }

    const isNameChanged = tag.nome.toLowerCase() !== cleanName.toLowerCase();
    if (isNameChanged) {
      const exists = tags.some(
        (t) => t.id !== tag.id && t.nome.toLowerCase() === cleanName.toLowerCase()
      );
      if (exists) {
        showNotification(`Já existe outra categoria chamada "${cleanName}".`, 'error');
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const { data, error } = await tagService.updateTag(tag.id, {
        nome: cleanName,
        cor: editColor,
        descricao: editDescription,
      });

      if (error) {
        showNotification(`Erro ao atualizar no Supabase: ${error.message}`, 'error');
      } else {
        // Se renomeou e há tarefas usando o nome antigo, atualiza as tarefas para refletir nos cards
        if (isNameChanged) {
          await tagService.renameTagInTasks(tag.nome, cleanName);
        }

        showNotification(`Categoria "${cleanName}" atualizada com sucesso!`, 'success');
        setEditingTagId(null);
        if (data) {
          const updated = tags.map((t) => (t.id === tag.id ? data : t));
          setTags(updated);
          onTagsUpdated?.(updated);
        } else {
          loadTags(false);
        }
      }
    } catch {
      showNotification('Erro ao atualizar categoria.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Abrir Modal de Exclusão com Verificação
  const handleOpenDeleteModal = async (tag: TagBucket) => {
    setDeletingTag(tag);
    setIsCheckingUsage(true);

    // Contar uso local e remoto
    const localUsage = tagUsageMap[tag.nome] ?? 0;
    try {
      const { count } = await tagService.countTasksWithTag(tag.nome);
      setAssociatedTaskCount(Math.max(localUsage, count));
    } catch {
      setAssociatedTaskCount(localUsage);
    } finally {
      setIsCheckingUsage(false);
    }
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!deletingTag || !isAdmin) return;

    setIsDeleting(true);
    const tagName = deletingTag.nome;
    const tagId = deletingTag.id;

    try {
      const { error } = await tagService.deleteTag(tagId);

      if (error) {
        showNotification(`Erro ao excluir no Supabase: ${error.message}`, 'error');
      } else {
        // Se houver tarefas com essa tag/bucket, reatribui para 'Geral' ou limpa nos cards
        if (associatedTaskCount > 0) {
          await tagService.removeTagFromTasks(tagName, 'Geral');
        }

        showNotification(`Categoria "${tagName}" removida do banco com sucesso.`, 'success');
        const updated = tags.filter((t) => t.id !== tagId);
        setTags(updated);
        onTagsUpdated?.(updated);
        setDeletingTag(null);
      }
    } catch {
      showNotification('Erro ao excluir categoria.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bloqueio de Acesso RBAC
  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#f7f9fb]">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Acesso Restrito ao Administrador
        </h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          A gestão de tags e categorias de tarefas é exclusiva para administradores da organização.
        </p>
        <button
          type="button"
          onClick={onBackToPlanner}
          className="flex items-center gap-2 px-4 py-2 bg-[#003067] hover:bg-[#00224b] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Planner</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="tag-management-view"
      className="h-full flex flex-col overflow-hidden bg-[#f7f9fb] select-none"
    >
      {/* 1. CABEÇALHO SUPERIOR */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPlanner}
            className="p-1.5 text-slate-500 hover:text-[#003067] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Voltar ao Calendário"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#003067] text-white flex items-center justify-center shadow-xs">
                <Tag className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Gerenciar Tags & Categorias
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#003067]">
                Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configuração das categorias e tags da tabela <code className="text-[#003067] font-mono bg-slate-100 px-1 py-0.5 rounded">tags_bucket</code> que alimentam os cards de tarefas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadTags(false)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#003067]' : ''}`} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>

          <button
            type="button"
            onClick={onBackToPlanner}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#003067] hover:bg-[#00224b] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>Voltar ao Planner</span>
          </button>
        </div>
      </div>

      {/* NOTIFICAÇÃO TOAST */}
      {notification && (
        <div
          className={`mx-5 mt-3 p-3 rounded-xl border text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-150 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. CONTEÚDO PRINCIPAL (SPLIT: FORMULÁRIO DE CRIAÇÃO À ESQUERDA + LISTAGEM À DIREITA) */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* PAINEL ESQUERDO: FORMULÁRIO DE NOVA TAG (4 colunas em telas grandes) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#003067] flex items-center justify-center font-bold">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  Nova Categoria / Tag
                </h2>
              </div>

              <form onSubmit={handleCreateTag} className="space-y-3.5">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Categoria *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Comercial, Jurídico, Logística..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-[#004691] focus:ring-1 focus:ring-[#004691]/20 transition-all text-slate-900 placeholder-slate-400 font-medium"
                  />
                </div>

                {/* Seletor de Cores */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Cor de Destaque
                  </label>
                  <div className="grid grid-cols-5 gap-2 mb-2">
                    {PRESET_TAG_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewTagColor(c.value)}
                        className={`h-7 rounded-lg transition-all flex items-center justify-center relative cursor-pointer ${
                          newTagColor === c.value
                            ? 'ring-2 ring-offset-1 ring-[#003067] scale-105 shadow-xs'
                            : 'hover:opacity-90'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      >
                        {newTagColor === c.value && (
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Input de Cor Customizada + Preview */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-mono text-slate-600 block truncate">
                        {newTagColor}
                      </span>
                    </div>
                    {/* Badge Preview */}
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white shadow-2xs"
                      style={{ backgroundColor: newTagColor }}
                    >
                      {newTagName || 'Preview'}
                    </span>
                  </div>
                </div>

                {/* Descrição Opcional */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descrição (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Para quais tipos de tarefas esta categoria é indicada..."
                    value={newTagDescription}
                    onChange={(e) => setNewTagDescription(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:bg-white focus:border-[#004691] focus:ring-1 focus:ring-[#004691]/20 transition-all text-slate-900 placeholder-slate-400"
                  />
                </div>

                {/* Botão de Envio */}
                <button
                  type="submit"
                  disabled={isCreating || !newTagName.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#003067] hover:bg-[#00224b] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Cadastrando...' : 'Adicionar ao Banco'}</span>
                </button>
              </form>
            </div>

            {/* Informações e Métricas Rápidas */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-slate-800">
                <Layers className="w-4 h-4 text-[#004691]" />
                <h3 className="text-xs font-bold">Métricas do Sistema</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                    Total de Tags
                  </span>
                  <span className="text-lg font-bold text-[#003067]">
                    {tags.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                    Tags em Uso
                  </span>
                  <span className="text-lg font-bold text-emerald-600">
                    {tags.filter((t) => (tagUsageMap[t.nome] ?? 0) > 0).length}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                💡 Ao criar ou renomear categorias aqui, a lista de seleção nos modais de criação de ação e nos cards será atualizada automaticamente em tempo real.
              </p>
            </div>
          </div>

          {/* PAINEL DIREITO: TABELA / GRID DE TAGS EXISTENTES (8 colunas) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col min-h-[460px]">
              
              {/* Barra de Pesquisa e Contagem */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Categorias Cadastradas
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {filteredTags.length} de {tags.length}
                  </span>
                </div>

                {/* Input de Busca */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar categorias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#004691] text-slate-900 placeholder-slate-400 transition-all"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Registros */}
              <div className="flex-1 py-3 space-y-2.5 overflow-y-auto">
                {isLoading ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#004691] mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      Buscando categorias da tabela tags_bucket...
                    </p>
                  </div>
                ) : fetchError ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-5 border border-rose-200 bg-rose-50/50 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                    <p className="text-xs font-bold text-rose-900">
                      Não foi possível carregar a tabela tags_bucket
                    </p>
                    <p className="text-[11px] text-rose-700 mt-1 max-w-sm">
                      {fetchError}
                    </p>
                    <button
                      type="button"
                      onClick={() => loadTags(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tentar Novamente</span>
                    </button>
                  </div>
                ) : filteredTags.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <FolderOpen className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-700">
                      {searchTerm ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada no banco'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                      {searchTerm
                        ? 'Tente buscar com outros termos.'
                        : 'Utilize o formulário ao lado para adicionar a primeira categoria do sistema.'}
                    </p>
                  </div>
                ) : (
                  filteredTags.map((tag) => {
                    const isEditing = editingTagId === tag.id;
                    const usageCount = tagUsageMap[tag.nome] ?? 0;

                    if (isEditing) {
                      return (
                        <div
                          key={tag.id}
                          className="p-3.5 rounded-2xl bg-blue-50/60 border-2 border-[#004691] space-y-3 shadow-xs animate-in fade-in"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#003067] flex items-center gap-1.5">
                              <Edit2 className="w-3.5 h-3.5" />
                              Editando Categoria
                            </span>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="text-slate-400 hover:text-slate-600 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Nome *
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#004691] font-semibold text-slate-900"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Cor de Destaque
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                                />
                                <input
                                  type="text"
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-slate-700"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Descrição
                            </label>
                            <input
                              type="text"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Breve descrição da categoria..."
                              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#004691] text-slate-800"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(tag)}
                              disabled={isSavingEdit || !editName.trim()}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#003067] hover:bg-[#00224b] rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-2xs transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Indicador Visual da Cor: Círculo com estilo inline lendo diretamente tag.color */}
                          {(() => {
                            const tagColor = tag.color || tag.cor || '#004691';
                            return (
                              <div
                                className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-2 ring-white border border-black/10 transition-transform group-hover:scale-110"
                                style={{ backgroundColor: tagColor }}
                                title={`Código da cor: ${tagColor}`}
                              />
                            );
                          })()}

                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Nome da Categoria / Tag */}
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {tag.nome}
                              </span>

                              {/* Badge com a cor exata em background inline */}
                              {(() => {
                                const tagColor = tag.color || tag.cor || '#004691';
                                return (
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-2xs shrink-0"
                                    style={{ backgroundColor: tagColor }}
                                  >
                                    {tagColor.toUpperCase()}
                                  </span>
                                );
                              })()}

                              {usageCount > 0 ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#003067] border border-blue-200/60">
                                  {usageCount} {usageCount === 1 ? 'tarefa ativa' : 'tarefas ativas'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                  Sem tarefas vinculadas
                                </span>
                              )}
                            </div>
                            {(tag.description || tag.descricao) && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {tag.description || tag.descricao}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tag)}
                            className="p-1.5 text-slate-400 hover:text-[#003067] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Renomear / Editar Categoria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(tag)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir Categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (Com Verificação de Vínculo de Tarefas) */}
      {deletingTag && (
        <div
          id="delete-tag-modal-backdrop"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeletingTag(null)}
        >
          <div
            id="delete-tag-modal-card"
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Excluir Categoria
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirmar remoção da tabela tags_bucket
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Categoria:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: deletingTag.cor || '#004691' }}
                  />
                  {deletingTag.nome}
                </span>
              </div>
            </div>

            {/* Alerta se houver tarefas vinculadas */}
            {isCheckingUsage ? (
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verificando vínculo com cards de tarefas...</span>
              </div>
            ) : associatedTaskCount > 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Atenção: Categoria em uso</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Existem <strong>{associatedTaskCount}</strong> tarefa(s) associada(s) a esta categoria. Ao excluir, ela será removida da lista que alimenta os cards de tarefas do sistema e as tarefas serão reatribuídas com segurança.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Nenhuma tarefa ativa depende desta categoria. Ela será removida com segurança da lista.
              </p>
            )}

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
