import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { EmailData, EmailBlock, BlockType, Screen, TransitionType } from '../types';
import { extractEmailMeta, parseHtmlToBlocks } from '../utils/htmlParser';
import { formatBytes, normalizeImageDetailed } from '../utils/imageNormalizer';
import { uploadImage, checkImageSize } from '../utils/imageUploader';
import { compileBlocksToHtml } from '../utils/compiler';
import { compileTransportHtml } from '../utils/emailCompiler';
import { compilePlainText } from '../utils/plainTextCompiler';
import { runEmailChecklist } from '../utils/emailChecklist';
import type { ChecklistIssue } from '../utils/emailChecklist';
import { applyBrandKitToBlocks, createDefaultBlock, DEFAULT_BRAND_KIT } from '../utils/brandKit';
import type { BrandKit } from '../utils/brandKit';
import {
  createSavedBlock,
  deleteSavedBlock,
  listSavedBlocks,
  loadBrandKit,
  saveBrandKit,
} from '../utils/personalLibraryStore';
import type { SavedBlock } from '../utils/personalLibraryStore';
import { normalizeBlock } from '../utils/blockNormalizer';
import { BrandKitModal } from '../components/gerador/BrandKitModal';
import { SaveBlockModal } from '../components/gerador/SaveBlockModal';
import { sanitizeEmailHtml } from '../utils/security';
import { RichTextEditorRef } from '../components/RichTextEditor';
import {
  EditorTopBar,
  ExportModal,
  PreviewModal,
  ImportModal,
  TemplateManagerModal,
  SaveTemplateModal,
  BlocksSidebar,
  PropertiesPanel,
  PreviewCanvas,
  PreviewCanvasHandle,
} from '../components/gerador';
import { DEFAULT_BLOCKS } from '../data/defaultBlocks';
import { useEditorHistory } from '../hooks/useEditorHistory';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { Toast } from '../components/ui/Toast';
import { BlockSelectorModal } from '../components/gerador/BlockSelectorModal';
import { sanitizeBlockPropertyUpdate } from '../data/blockProperties';
import {
  createDocumentId,
  listSavedTemplates,
  loadDraft,
  loadLatestDraft,
  saveDraft,
  saveTemplateDocument,
  restoreTemplateVersion,
  deleteSavedTemplate,
  getTemplateLibraryContext,
} from '../utils/templateStore';
import type { TemplateDocument, TemplateLibraryContext } from '../utils/templateStore';

interface GeradorProScreenProps {
  emailData: EmailData;
  setEmailData: React.Dispatch<React.SetStateAction<EmailData>>;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  openLibraryOnStart?: boolean;
  onLibraryStartHandled?: () => void;
  initialTemplateToUse?: TemplateDocument | null;
  onInitialTemplateHandled?: () => void;
  initialTemplateToEdit?: TemplateDocument | null;
  onInitialTemplateEditHandled?: () => void;
  onSignOut: () => Promise<void>;
}


export const GeradorProScreen: React.FC<GeradorProScreenProps> = ({
  emailData,
  setEmailData,
  onNavigate,
  openLibraryOnStart = false,
  onLibraryStartHandled,
  initialTemplateToUse = null,
  onInitialTemplateHandled,
  initialTemplateToEdit = null,
  onInitialTemplateEditHandled,
  onSignOut,
}) => {
  // Each document has a UUID so the database can enforce stable ownership and draft isolation.
  const [documentId, setDocumentId] = useState<string>(() => {
    const candidate = emailData.documentId || '';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
      ? candidate
      : '';
  });
  const [draftLoadedFor, setDraftLoadedFor] = useState<string | null>(null);
  // Tracks an existing shared template being edited while the work-in-progress draft remains private and separate.
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    if (emailData.contentSource === 'html' && emailData.customCodeHtml) {
      const parsed = parseHtmlToBlocks(emailData.customCodeHtml);
      if (parsed && parsed.length > 0) return parsed;
    }
    return DEFAULT_BLOCKS;
  });
  const [savedTemplates, setSavedTemplates] = useState<TemplateDocument[]>([]);
  const [libraryContext, setLibraryContext] = useState<TemplateLibraryContext | null>(null);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [libraryLoadError, setLibraryLoadError] = useState<string | null>(null);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [isMobileBlockSelectorOpen, setIsMobileBlockSelectorOpen] = useState(false);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => blocks[0]?.id || null);

  useEffect(() => {
    if (!documentId) return;
    setEmailData((prev) => ({ ...prev, documentId, contentSource: 'blocks' }));
  }, [documentId, setEmailData]);

  const previewCanvasRef = useRef<PreviewCanvasHandle | null>(null);
  const blocksRef = useRef<EmailBlock[]>(blocks);
  blocksRef.current = blocks;

  const { push: pushToHistory, undo, redo, reset: resetHistory, canUndo, canRedo } = useEditorHistory(blocks);

  const handleUndo = useCallback(() => {
    previewCanvasRef.current?.commitInlineEdit();
    const previous = undo();
    if (previous) {
      blocksRef.current = previous;
      setBlocks(previous);
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    previewCanvasRef.current?.commitInlineEdit();
    const next = redo();
    if (next) {
      blocksRef.current = next;
      setBlocks(next);
    }
  }, [redo]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextEditing = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      if (isTextEditing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const { saveStatus, setSaveStatus, lastSavedTime, setLastSavedTime } = useDraftAutosave(blocks, emailData, documentId, 700, draftLoadedFor === documentId, editingTemplateId);

  // Modals state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [linkModalOpen, setLinkModalOpen] = useState<boolean>(false);
  const [linkText, setLinkText] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');

  // Selection state
  const [activeSelection, setActiveSelection] = useState<{
    fieldName: string;
    start: number;
    end: number;
    selectedText: string;
  } | null>(null);
  const [hasRichTextSelection, setHasRichTextSelection] = useState(false);

  useEffect(() => {
    setActiveSelection(null);
    setHasRichTextSelection(false);
  }, [selectedBlockId]);

  // Viewport Device and UI State
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [toastMessage, setToastMessage] = useState<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null);
  const [isNormalizing, setIsNormalizing] = useState<boolean>(false);

  // References
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeEditorRef = useRef<RichTextEditorRef | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(600);
  const localCompiledHtmlRef = useRef<string>(compileBlocksToHtml(blocks));

  // Memoize compiled HTML
  const compiledHtml = useMemo(() => compileBlocksToHtml(blocks), [blocks]);
  const transportHtml = useMemo(() => compileTransportHtml({ ...emailData, documentId }, blocks), [emailData, blocks, documentId]);

  // Handle iframe dynamic height
  const handleIframeLoad = useCallback(() => {
    try {
      if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
        const doc = previewIframeRef.current.contentDocument || previewIframeRef.current.contentWindow.document;
        if (doc) {
          const bodyH = doc.body?.scrollHeight || 0;
          const htmlH = doc.documentElement?.scrollHeight || 0;
          const contentH = Math.max(bodyH, htmlH);
          if (contentH > 100) {
            setIframeHeight(contentH + 20);
          }
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Mantém o HTML compilado em emailData (usado ao salvar e ao reabrir o e-mail)
  useEffect(() => {
    localCompiledHtmlRef.current = compiledHtml;
    if (!documentId) return;
    setEmailData((prev) => {
      if (prev.customCodeHtml === compiledHtml && prev.documentId === documentId && prev.contentSource === 'blocks') return prev;
      return {
        ...prev,
        customCodeHtml: compiledHtml,
        contentSource: 'blocks',
        documentId,
        subject: prev.subject || prev.headerTitle,
      };
    });
  }, [compiledHtml, documentId, setEmailData]);

  const showToast = useCallback((msg: string, kind: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ message: msg, kind });
  }, []);

  useEffect(() => {
    if (documentId) return;
    let active = true;
    // On a fresh page load, recover the most recently edited cloud draft unless the user explicitly chose a new template.
    loadLatestDraft().then((draft) => {
      if (!active) return;
      setDocumentId(draft?.documentId || createDocumentId());
    }).catch(() => {
      if (!active) return;
      setDocumentId(createDocumentId());
      showToast('Não foi possível localizar rascunhos anteriores na nuvem. O editor iniciará um novo rascunho.', 'error');
    });
    return () => { active = false; };
  }, [documentId, showToast]);

  useEffect(() => {
    if (!documentId) return;
    let active = true;
    setDraftLoadedFor(null);
    loadDraft(documentId).then((draft) => {
      if (!active) return;
      if (draft) {
        setEditingTemplateId(draft.sourceTemplateId || null);
        setBlocks(draft.blocks);
        blocksRef.current = draft.blocks;
        setSelectedBlockId(draft.blocks[0]?.id || null);
        setEmailData((prev) => ({ ...prev, ...draft.emailData, documentId, contentSource: 'blocks' }));
        resetHistory(draft.blocks);
      }
      setDraftLoadedFor(documentId);
    }).catch(() => {
      if (!active) return;
      // Let the editor recover, but the autosave status will show a cloud-write failure if persistence is unavailable.
      setDraftLoadedFor(documentId);
      showToast('Não foi possível carregar o rascunho da nuvem. Confira a conexão e a migração do Supabase.', 'error');
    });
    return () => { active = false; };
  }, [documentId, setEmailData, resetHistory, showToast]);

  const refreshTemplateLibrary = useCallback(async () => {
    setIsLibraryLoading(true);
    setLibraryLoadError(null);
    try {
      const [templates, context] = await Promise.all([
        listSavedTemplates(),
        getTemplateLibraryContext(),
      ]);
      setSavedTemplates(templates);
      setLibraryContext(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar a biblioteca.';
      setLibraryLoadError(message);
      showToast(message, 'error');
      throw error;
    } finally {
      setIsLibraryLoading(false);
    }
  }, [showToast]);

  const openTemplateLibrary = useCallback(async () => {
    setIsTemplateManagerOpen(true);
    try {
      await refreshTemplateLibrary();
    } catch {
      // The modal remains open and presents an empty/error toast so the user can retry.
    }
  }, [refreshTemplateLibrary]);

  useEffect(() => {
    if (!openLibraryOnStart || !documentId || draftLoadedFor !== documentId) return;
    onLibraryStartHandled?.();
    void openTemplateLibrary();
  }, [openLibraryOnStart, documentId, draftLoadedFor, onLibraryStartHandled, openTemplateLibrary]);

  const saveCurrentDraftNow = useCallback(async () => {
    previewCanvasRef.current?.commitInlineEdit();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const currentBlocks = blocksRef.current;
    const latestHtml = compileBlocksToHtml(currentBlocks);
    await saveDraft(currentBlocks, { ...emailData, customCodeHtml: latestHtml, documentId, contentSource: 'blocks' }, documentId, editingTemplateId);
  }, [documentId, emailData, editingTemplateId]);

  const handleSignOutFromEditor = useCallback(async () => {
    // Flush the current document before unmounting the editor so the autosave timer cannot be lost.
    try {
      await saveCurrentDraftNow();
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'Falha desconhecida ao salvar.';
      throw new Error(`Não foi possível salvar o rascunho antes de sair. Confira a conexão e tente novamente. Detalhe: ${detail}`);
    }
    await onSignOut();
  }, [onSignOut, saveCurrentDraftNow]);

  const navigateHomeAfterSave = useCallback(async () => {
    try {
      await saveCurrentDraftNow();
      onNavigate('inicio', 'none');
    } catch {
      showToast('Não foi possível salvar o rascunho na nuvem. Verifique a conexão antes de sair do editor.', 'error');
    }
  }, [onNavigate, saveCurrentDraftNow, showToast]);

  const openSaveTemplateModal = useCallback(() => {
    previewCanvasRef.current?.commitInlineEdit();
    setIsSaveTemplateModalOpen(true);
  }, []);

  const persistTemplate = useCallback(async (name: string, description: string): Promise<boolean> => {
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    if (!normalizedName || !normalizedDescription) {
      showToast('Informe o nome e a descrição para publicar o modelo.', 'error');
      return false;
    }

    previewCanvasRef.current?.commitInlineEdit();
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const currentBlocks = blocksRef.current;
    const latestHtml = compileBlocksToHtml(currentBlocks);
    const dataToSave = { ...emailData, customCodeHtml: latestHtml, documentId, contentSource: 'blocks' as const };
    setSaveStatus('saving');
    try {
      // Publish the shared template first. A separate private-draft failure must not
      // prevent the primary action the user explicitly requested from succeeding.
      const saved = await saveTemplateDocument({
        id: editingTemplateId || createDocumentId(),
        name: normalizedName,
        description: normalizedDescription,
        subject: emailData.subject || 'E-mail sem assunto',
        blocks: currentBlocks,
        emailData: dataToSave,
      });
      setEditingTemplateId(saved.id);

      let draftSaveError: unknown = null;
      try {
        await saveDraft(currentBlocks, dataToSave, documentId, saved.id);
      } catch (error) {
        draftSaveError = error;
      }

      const savedAt = `às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setLastSavedTime(savedAt);
      if (draftSaveError) {
        setSaveStatus('error');
        const detail = draftSaveError instanceof Error ? ` Detalhe: ${draftSaveError.message}` : '';
        showToast(`O modelo foi publicado, mas o rascunho privado não foi salvo na nuvem.${detail}`, 'error');
      } else {
        setSaveStatus('saved');
        showToast('Modelo publicado na biblioteca compartilhada.');
      }
      try {
        await refreshTemplateLibrary();
      } catch {
        // Publishing already succeeded; refresh reports its own error separately.
      }
      return true;
    } catch (error) {
      // Let the modal show the actual Supabase/database error instead of hiding it
      // behind a generic publication message. This is essential for diagnosing RLS,
      // schema-cache, session, and network failures.
      setSaveStatus('error');
      if (error instanceof Error) throw error;
      throw new Error('Falha desconhecida ao publicar o modelo. Confira a conexão e o console do navegador.');
    }
  }, [documentId, editingTemplateId, emailData, refreshTemplateLibrary, showToast, setSaveStatus, setLastSavedTime]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!isSaveTemplateModalOpen) openSaveTemplateModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaveTemplateModalOpen, openSaveTemplateModal]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  const prepareTemplateBlocks = (template: TemplateDocument): EmailBlock[] => {
    const safeHtml = sanitizeEmailHtml(template.emailData.customCodeHtml || '');
    const parsed = template.blocks?.length ? template.blocks : parseHtmlToBlocks(safeHtml);
    return Array.isArray(parsed) ? parsed : [];
  };

  const handleLoadSavedTemplate = (template: TemplateDocument) => {
    const safeHtml = sanitizeEmailHtml(template.emailData.customCodeHtml || '');
    const parsed = prepareTemplateBlocks(template);
    if (!parsed.length) {
      showToast('Não foi possível reconstruir este modelo.', 'error');
      return;
    }
    const workingDraftId = createDocumentId();
    setDocumentId(workingDraftId);
    setEditingTemplateId(template.id);
    setBlocks(parsed);
    blocksRef.current = parsed;
    setSelectedBlockId(parsed[0]?.id || null);
    setEmailData({ ...template.emailData, customCodeHtml: safeHtml, documentId: workingDraftId, contentSource: 'blocks', subject: template.subject });
    resetHistory(parsed);
    setIsTemplateManagerOpen(false);
    setSaveStatus('saved');
    showToast(`Editando o modelo "${template.name}".`);
  };

  const handleUseTemplate = (template: TemplateDocument) => {
    const safeHtml = sanitizeEmailHtml(template.emailData.customCodeHtml || '');
    const parsed = prepareTemplateBlocks(template);
    if (!parsed.length) {
      showToast('Não foi possível reconstruir este modelo.', 'error');
      return;
    }
    const newDocumentId = createDocumentId();
    const copiedBlocks = JSON.parse(JSON.stringify(parsed)) as EmailBlock[];
    const copiedEmailData = {
      ...template.emailData,
      documentId: newDocumentId,
      contentSource: 'blocks' as const,
      subject: template.subject,
      customCodeHtml: safeHtml,
    };
    setDocumentId(newDocumentId);
    setEditingTemplateId(null);
    setBlocks(copiedBlocks);
    blocksRef.current = copiedBlocks;
    setSelectedBlockId(copiedBlocks[0]?.id || null);
    setEmailData(copiedEmailData);
    resetHistory(copiedBlocks);
    setIsTemplateManagerOpen(false);
    showToast(`Cópia de "${template.name}" criada. O original permanece intacto.`);
  };

  const lastInitialTemplateAppliedRef = useRef<string | null>(null);
  const lastInitialTemplateEditAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialTemplateToUse) {
      lastInitialTemplateAppliedRef.current = null;
      return;
    }
    if (!documentId || draftLoadedFor !== documentId) return;
    if (lastInitialTemplateAppliedRef.current === initialTemplateToUse.id) return;

    lastInitialTemplateAppliedRef.current = initialTemplateToUse.id;
    handleUseTemplate(initialTemplateToUse);
    onInitialTemplateHandled?.();
  }, [initialTemplateToUse, documentId, draftLoadedFor, onInitialTemplateHandled]);

  useEffect(() => {
    if (!initialTemplateToEdit) {
      lastInitialTemplateEditAppliedRef.current = null;
      return;
    }
    if (!documentId || draftLoadedFor !== documentId) return;
    if (lastInitialTemplateEditAppliedRef.current === initialTemplateToEdit.id) return;

    lastInitialTemplateEditAppliedRef.current = initialTemplateToEdit.id;
    handleLoadSavedTemplate(initialTemplateToEdit);
    onInitialTemplateEditHandled?.();
  }, [initialTemplateToEdit, documentId, draftLoadedFor, onInitialTemplateEditHandled]);

  const handleDeleteSavedTemplate = async (id: string) => {
    try {
      await deleteSavedTemplate(id);
      await refreshTemplateLibrary();
      showToast('Modelo excluído da biblioteca.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o modelo.';
      showToast(message, 'error');
    }
  };

  const handleRestoreVersion = async (templateId: string, versionId: string) => {
    try {
      const restored = await restoreTemplateVersion(templateId, versionId);
      if (restored) {
        await refreshTemplateLibrary();
        handleLoadSavedTemplate(restored);
        showToast('Versão restaurada como a versão atual.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível restaurar a versão.';
      showToast(message, 'error');
    }
  };

  // ----- Brand kit & saved blocks (per user, Supabase) -----------------------
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [brandKitError, setBrandKitError] = useState<string | null>(null);
  const [isBrandKitLoading, setIsBrandKitLoading] = useState(false);
  const [isBrandKitOpen, setIsBrandKitOpen] = useState(false);
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([]);
  const [savedBlocksError, setSavedBlocksError] = useState<string | null>(null);
  const [blockToSave, setBlockToSave] = useState<EmailBlock | null>(null);

  useEffect(() => {
    let active = true;
    setIsBrandKitLoading(true);
    loadBrandKit()
      .then((kit) => { if (active) { setBrandKit(kit); setBrandKitError(null); } })
      .catch((error) => { if (active) setBrandKitError(error instanceof Error ? error.message : 'Não foi possível carregar o kit da marca.'); })
      .finally(() => { if (active) setIsBrandKitLoading(false); });
    return () => { active = false; };
  }, []);

  const refreshSavedBlocks = useCallback(() => {
    listSavedBlocks()
      .then((list) => { setSavedBlocks(list); setSavedBlocksError(null); })
      .catch((error) => setSavedBlocksError(error instanceof Error ? error.message : 'Não foi possível carregar seus blocos.'));
  }, []);

  useEffect(() => { refreshSavedBlocks(); }, [refreshSavedBlocks]);

  // Block management handlers
  const insertBlock = (newBlock: EmailBlock, insertAfterIndex?: number) => {
    const nextBlocks = [...blocks];
    if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < nextBlocks.length) {
      nextBlocks.splice(insertAfterIndex + 1, 0, newBlock);
    } else {
      nextBlocks.push(newBlock);
    }
    setBlocks(nextBlocks);
    setSelectedBlockId(newBlock.id);
    pushToHistory(nextBlocks);
  };

  const handleInsertSavedBlock = (saved: SavedBlock) => {
    const copy = normalizeBlock({ ...JSON.parse(JSON.stringify(saved.block)), id: `block-${Date.now()}` });
    if (!copy) return;
    insertBlock(copy);
    showToast(`"${saved.name}" adicionado ao e-mail!`);
  };

  const handleDeleteSavedBlock = async (saved: SavedBlock) => {
    if (!window.confirm(`Excluir "${saved.name}" de Meus blocos? Os e-mails que já usam este bloco não mudam.`)) return;
    try {
      await deleteSavedBlock(saved.id);
      setSavedBlocks((list) => list.filter((item) => item.id !== saved.id));
      showToast('Bloco excluído de Meus blocos.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível excluir o bloco.', 'error');
    }
  };

  const handleSaveReusableBlock = async (name: string) => {
    if (!blockToSave) return;
    previewCanvasRef.current?.commitInlineEdit();
    const latest = blocksRef.current.find((b) => b.id === blockToSave.id) || blockToSave;
    const saved = await createSavedBlock(name, latest);
    setSavedBlocks((list) => [saved, ...list]);
    setSavedBlocksError(null);
    setBlockToSave(null);
    showToast(`"${saved.name}" salvo em Meus blocos.`);
  };

  const handleSaveBrandKit = async (kit: BrandKit, applyToEmail: boolean) => {
    const saved = await saveBrandKit(kit);
    setBrandKit(saved);
    setBrandKitError(null);
    if (applyToEmail) {
      previewCanvasRef.current?.commitInlineEdit();
      const recolored = applyBrandKitToBlocks(blocksRef.current, saved);
      blocksRef.current = recolored;
      setBlocks(recolored);
      pushToHistory(recolored);
      showToast('Kit da marca salvo e aplicado. Use Desfazer (Ctrl+Z) se quiser voltar.');
    } else {
      showToast('Kit da marca salvo. Os próximos blocos usarão estas cores.');
    }
    setIsBrandKitOpen(false);
  };

  const handleAddBlock = (type: BlockType, insertAfterIndex?: number) => {
    const newBlock = createDefaultBlock(type, `block-${Date.now()}`, brandKit);
    insertBlock(newBlock, insertAfterIndex);
    showToast(`Bloco adicionado ao e-mail!`);
  };

  const handleDuplicate = (block: EmailBlock) => {
    const dupId = `block-${Date.now()}`;
    const dupBlock = { ...block, id: dupId };
    const index = blocks.findIndex((b) => b.id === block.id);
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, dupBlock);
    setBlocks(newBlocks);
    setSelectedBlockId(dupId);
    pushToHistory(newBlocks);
    showToast('Bloco duplicado!');
  };

  const handleDelete = (id: string) => {
    if (blocks.length <= 1) {
      showToast('O e-mail deve ter pelo menos 1 bloco.');
      return;
    }
    const newBlocks = blocks.filter((b) => b.id !== id);
    setBlocks(newBlocks);
    if (selectedBlockId === id) {
      setSelectedBlockId(newBlocks[0]?.id || null);
    }
    pushToHistory(newBlocks);
    showToast('Bloco removido.');
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= blocks.length || toIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    const [draggedItem] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, draggedItem);
    setBlocks(newBlocks);
    pushToHistory(newBlocks);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index - 1];
    newBlocks[index - 1] = newBlocks[index];
    newBlocks[index] = temp;
    setBlocks(newBlocks);
    pushToHistory(newBlocks);
  };

  const handleMoveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index + 1];
    newBlocks[index + 1] = newBlocks[index];
    newBlocks[index] = temp;
    setBlocks(newBlocks);
    pushToHistory(newBlocks);
  };

  const updateBlock = useCallback(
    (targetId: string, updatedProps: Partial<EmailBlock>, options?: { coalesce?: boolean }) => {
      const safeProps = sanitizeBlockPropertyUpdate(updatedProps);
      if (Object.keys(safeProps).length === 0) return;

      setBlocks((prevBlocks) => {
        const index = prevBlocks.findIndex((b) => b.id === targetId);
        if (index === -1) return prevBlocks;

        const nextBlocks = [...prevBlocks];
        nextBlocks[index] = { ...nextBlocks[index], ...safeProps };
        blocksRef.current = nextBlocks;

        const coalescibleFields = new Set([
          'text',
          'headerTitle',
          'headerSubtitle',
          'footerText',
          'buttonLabel',
          'buttonUrl',
          'couponCode',
          'couponDiscount',
          'columns',
        ]);
        const shouldCoalesce =
          options?.coalesce ?? Object.keys(safeProps).some((key) => coalescibleFields.has(key));

        pushToHistory(nextBlocks, shouldCoalesce ? { coalesce: true } : undefined);
        return nextBlocks;
      });
    },
    [pushToHistory]
  );

  const updateSelectedBlock = useCallback(
    (updatedProps: Partial<EmailBlock>) => {
      if (!selectedBlockId) return;
      updateBlock(selectedBlockId, updatedProps);
    },
    [selectedBlockId, updateBlock]
  );

  const handleImportHtmlContent = (rawHtml: string, parsedBlocks: EmailBlock[]) => {
    const safeHtml = sanitizeEmailHtml(rawHtml);
    const meta = extractEmailMeta(rawHtml);
    setEmailData((prev) => {
      const hasSubject = Boolean(prev.subject?.trim()) && prev.subject !== 'E-mail sem assunto';
      return {
        ...prev,
        customCodeHtml: safeHtml,
        contentSource: 'blocks',
        // The imported e-mail replaces the content, so its inbox texts come along
        // (the subject only when the user hasn't written one yet).
        preheader: meta.preheader ?? prev.preheader,
        subject: hasSubject ? prev.subject : meta.subject || prev.subject,
      };
    });
    const parsed = parsedBlocks?.length ? parsedBlocks : parseHtmlToBlocks(rawHtml);
    if (parsed && parsed.length > 0) {
      setBlocks(parsed);
      setSelectedBlockId(parsed[0].id);
      pushToHistory(parsed);
    }
  };

  /**
   * Optimizes (resize + compress) and uploads an image file, returning its public
   * HTTPS URL, or null when it failed (the user is told why).
   */
  const uploadImageFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP ou GIF).', 'error');
      return null;
    }
    // Large photos are accepted because they are compressed before the upload limit applies.
    const sizeCheck = checkImageSize(file, 15);
    if (!sizeCheck.valid) {
      showToast(sizeCheck.message || 'Imagem inválida.', 'error');
      return null;
    }
    showToast('Otimizando e enviando a imagem…', 'info');
    try {
      const optimized = await normalizeImageDetailed(file, 1200);
      const uploadRes = await uploadImage(optimized.dataUrl, file.name);
      const saved = optimized.originalBytes - optimized.finalBytes;
      showToast(saved > 10 * 1024
        ? `Imagem otimizada (${formatBytes(optimized.originalBytes)} → ${formatBytes(optimized.finalBytes)}) e enviada!`
        : 'Imagem enviada!');
      return uploadRes.url;
    } catch (err: unknown) {
      console.error('Erro no processamento da imagem:', err);
      showToast(err instanceof Error ? err.message : 'Não foi possível carregar a imagem selecionada.', 'error');
      return null;
    }
  }, [showToast]);

  // Image Upload handler with Firebase & Normalization
  const handleImageBlockUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const targetBlockId = selectedBlockId;
    setIsNormalizing(true);
    try {
      const url = await uploadImageFile(file);
      if (url && targetBlockId) updateBlock(targetBlockId, { imageUrl: url });
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleNormalizeExistingImage = async () => {
    const selected = blocks.find((b) => b.id === selectedBlockId);
    if (!selected || !selected.imageUrl) {
      showToast('Insira ou envie uma imagem primeiro para otimizar.');
      return;
    }

    setIsNormalizing(true);
    showToast('Otimizando a imagem para e-mail…', 'info');

    try {
      const optimized = await normalizeImageDetailed(selected.imageUrl, 1200);
      if (optimized.format === 'original') {
        showToast('Não foi possível otimizar esta imagem (o site de origem não permite). Envie o arquivo pelo botão "Trocar imagem".', 'error');
        return;
      }
      const res = await uploadImage(optimized.dataUrl, 'email_banner_otimizada');
      updateBlock(selected.id, { imageUrl: res.url });
      showToast(`Imagem otimizada (${optimized.width}×${optimized.height}px, ${formatBytes(optimized.finalBytes)}) e enviada!`);
    } catch {
      showToast('Não foi possível otimizar a imagem.', 'error');
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleUploadExistingImage = async () => {
    const selected = blocks.find((b) => b.id === selectedBlockId);
    if (!selected || !selected.imageUrl) {
      showToast('Nenhuma imagem selecionada para hospedar.');
      return;
    }

    setIsNormalizing(true);
    showToast('Enviando para o Firebase Storage (/emails/)...');

    try {
      const res = await uploadImage(selected.imageUrl, 'email_banner');
      if (res.isPublicUrl) {
        updateSelectedBlock({ imageUrl: res.url });
        showToast('🔥 Imagem enviada para o Firebase Storage (/emails/)!');
      } else {
        showToast(res.message);
      }
    } catch (err) {
      showToast('Não foi possível realizar o upload da imagem.');
    } finally {
      setIsNormalizing(false);
    }
  };

  // Text Selection and Links
  const handleTextSelectOrChange = (
    e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>,
    fieldName: string
  ) => {
    const target = e.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const fullText = target.value;

    if (start < end) {
      setActiveSelection({
        fieldName,
        start,
        end,
        selectedText: fullText.substring(start, end),
      });
    } else {
      setActiveSelection({
        fieldName,
        start,
        end: start,
        selectedText: '',
      });
    }
  };

  const handleOpenLinkModal = () => {
    const selected = blocks.find((b) => b.id === selectedBlockId);
    if (!selected) return;

    let selText = activeEditorRef.current?.getSelectionText() || activeSelection?.selectedText || '';
    const cleanSelText = selText.replace(/<[^>]*>/g, '');
    setLinkText(cleanSelText);
    setLinkUrl('https://');
    setLinkModalOpen(true);
  };

  const handleSaveLink = () => {
    if (!linkUrl.trim()) {
      showToast('Por favor, informe a URL do link.');
      return;
    }

    let finalUrl = linkUrl.trim();
    if (
      !finalUrl.startsWith('http://') &&
      !finalUrl.startsWith('https://') &&
      !finalUrl.startsWith('mailto:') &&
      !finalUrl.startsWith('tel:') &&
      !finalUrl.startsWith('{{')
    ) {
      finalUrl = 'https://' + finalUrl;
    }

    const displayText = linkText.trim() || finalUrl;
    const linkHtml = `<a href="${finalUrl}" target="_blank" style="color: #4f46e5; text-decoration: underline;">${displayText}</a>`;

    if (activeEditorRef.current) {
      activeEditorRef.current.insertHtml(linkHtml);
      showToast(`Link "${displayText}" inserido no texto!`);
    } else if (selectedBlockId) {
      const selected = blocks.find((b) => b.id === selectedBlockId);
      if (selected) {
        const defaultField = (
          (selected.type === 'header' || selected.type === 'header_text') ? 'headerTitle' :
          selected.type === 'footer' ? 'footerText' :
          selected.type === 'button' ? 'buttonLabel' : 'text'
        );
        const curr = String((selected as any)[defaultField] || '');
        updateSelectedBlock({ [defaultField]: curr ? `${curr} ${linkHtml}` : linkHtml });
        showToast(`Link "${displayText}" inserido!`);
      }
    }

    setLinkModalOpen(false);
    setLinkText('');
    setLinkUrl('');
  };

  const handleRemoveLinkFromBlock = () => {
    if (activeEditorRef.current) {
      activeEditorRef.current.execCommand('unlink');
      showToast('Link removido do texto.');
    }
    setLinkModalOpen(false);
  };

  const applyFormattingToSelection = (
    formatType: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'color' | 'fontSize' | 'fontFamily' | 'clear' | 'variable' | 'link' | 'unlink',
    formatValue?: string | number,
    colorTargetKey?: 'textColor' | 'headerTextColor' | 'buttonTextColor' | 'footerTextColor'
  ) => {
    const selected = blocks.find((b) => b.id === selectedBlockId);
    if (!selected) return;

    const editor = activeEditorRef.current;
    const hasInlineSelection = Boolean(editor?.hasSavedSelection());

    if (editor && hasInlineSelection) {
      editor.restoreSelection();
    }

    if (formatType === 'color' && formatValue && !hasInlineSelection) {
      const colorVal = String(formatValue);
      const targetField = colorTargetKey || (
        (selected.type === 'header' || selected.type === 'header_text') ? 'headerTextColor' :
        selected.type === 'footer' ? 'footerTextColor' :
        selected.type === 'button' ? 'buttonTextColor' : 'textColor'
      );
      updateSelectedBlock({ [targetField]: colorVal });
      return;
    }

    const editorCanApplyInline = Boolean(
      editor && (
        hasInlineSelection ||
        formatType === 'variable' ||
        formatType === 'link' ||
        formatType === 'unlink'
      )
    );

    if (editorCanApplyInline && editor) {
      switch (formatType) {
        case 'bold':
          editor.execCommand('bold');
          break;
        case 'italic':
          editor.execCommand('italic');
          break;
        case 'underline':
          editor.execCommand('underline');
          break;
        case 'strikethrough':
          editor.execCommand('strikeThrough');
          break;
        case 'color':
          if (formatValue) editor.applyInlineStyle('color', String(formatValue));
          break;
        case 'fontSize':
          if (formatValue) editor.applyInlineStyle('font-size', `${Number(formatValue)}px`);
          break;
        case 'fontFamily':
          if (formatValue) editor.applyInlineStyle('font-family', String(formatValue));
          break;
        case 'clear':
          editor.execCommand('removeFormat');
          break;
        case 'variable':
          if (formatValue) editor.insertHtml(` ${formatValue} `);
          break;
        case 'link':
          handleOpenLinkModal();
          return;
        case 'unlink':
          editor.execCommand('unlink');
          break;
      }
      showToast('Formatação aplicada no editor de texto!');
    } else {
      if (formatType === 'bold' && !hasInlineSelection) updateSelectedBlock({ isBold: !selected.isBold });
      else if (formatType === 'italic' && !hasInlineSelection) updateSelectedBlock({ isItalic: !selected.isItalic });
      else if (formatType === 'underline' && !hasInlineSelection) updateSelectedBlock({ isUnderline: !selected.isUnderline });
      else if (formatType === 'strikethrough' && !hasInlineSelection) updateSelectedBlock({ isStrikethrough: !selected.isStrikethrough });
      else if (formatType === 'fontSize' && formatValue && !hasInlineSelection) updateSelectedBlock({ fontSizePx: Number(formatValue) });
      else if (formatType === 'fontFamily' && formatValue && !hasInlineSelection) updateSelectedBlock({ fontFamily: String(formatValue) });
      else if (formatType === 'variable' && formatValue) {
        const defaultField = (
          (selected.type === 'header' || selected.type === 'header_text') ? 'headerTitle' :
          selected.type === 'footer' ? 'footerText' :
          selected.type === 'button' ? 'buttonLabel' : 'text'
        );
        const curr = String((selected as any)[defaultField] || '');
        updateSelectedBlock({ [defaultField]: curr + ` ${formatValue} ` });
      }
    }
  };

  const insertVariableToSelectedBlock = (varName: string) => {
    applyFormattingToSelection('variable', varName);
  };

  /** Inline edits address column cells as "columns.<index>.<field>". */
  const inlineEditProps = useCallback((blockId: string, field: string, value: string): Partial<EmailBlock> => {
    const cellMatch = field.match(/^columns\.(\d+)\.(text|buttonLabel)$/);
    if (!cellMatch) return { [field]: value };
    const block = blocksRef.current.find((b) => b.id === blockId);
    const columns = [...(block?.columns || [])];
    const index = Number(cellMatch[1]);
    if (!columns[index]) return {};
    columns[index] = { ...columns[index], [cellMatch[2]]: value };
    return { columns };
  }, []);

  const handleInlineBlockDraft = useCallback(
    (blockId: string, field: keyof EmailBlock, value: string) => {
      updateBlock(blockId, inlineEditProps(blockId, String(field), value), { coalesce: true });
    },
    [updateBlock, inlineEditProps]
  );

  const handleInlineBlockEdit = useCallback(
    (blockId: string, field: keyof EmailBlock, value: string) => {
      setSelectedBlockId(blockId);
      updateBlock(blockId, inlineEditProps(blockId, String(field), value), { coalesce: true });
    },
    [updateBlock, inlineEditProps]
  );

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  // Pre-export review and text version, computed only while the export window is open.
  const checklistIssues = useMemo(
    () => (isExportModalOpen ? runEmailChecklist(blocks, emailData, transportHtml) : []),
    [isExportModalOpen, blocks, emailData, transportHtml],
  );
  const plainTextVersion = useMemo(() => (isExportModalOpen ? compilePlainText(blocks) : ''), [isExportModalOpen, blocks]);

  const handleFixIssue = (issue: ChecklistIssue) => {
    setIsExportModalOpen(false);
    if (issue.blockId && blocks.some((b) => b.id === issue.blockId)) {
      setSelectedBlockId(issue.blockId);
      showToast('Bloco selecionado: corrija no painel da direita.', 'info');
    } else if (issue.target === 'settings') {
      setSelectedBlockId(null);
      showToast('Edite o assunto e o texto de pré-visualização no painel da direita.', 'info');
    }
  };

  if (!documentId || draftLoadedFor !== documentId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm font-medium">Carregando seu rascunho da nuvem…</p>
        <p className="text-xs">O editor será liberado assim que o conteúdo for recuperado.</p>
      </div>
    );
  }

  return (
    <>
      {toastMessage && <Toast message={toastMessage.message} kind={toastMessage.kind} onClose={() => setToastMessage(null)} />}
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100 font-sans">

      {/* Modern Fixed Top Bar */}
      <EditorTopBar
        subject={emailData.subject || 'E-mail sem assunto'}
        onSubjectChange={(newSubject) => setEmailData((prev) => ({ ...prev, subject: newSubject }))}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        previewDevice={previewDevice}
        setPreviewDevice={setPreviewDevice}
        lastSavedTime={lastSavedTime}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenExportModal={() => {
          previewCanvasRef.current?.commitInlineEdit();
          setIsExportModalOpen(true);
        }}
        onNavigateHome={() => { void navigateHomeAfterSave(); }}
        onSave={openSaveTemplateModal}
        onOpenTemplates={() => { void openTemplateLibrary(); }}
        saveStatus={saveStatus}
        onSignOut={handleSignOutFromEditor}
        onOpenBrandKit={() => setIsBrandKitOpen(true)}
      />

      {/* Main SaaS Workspace with 3 Distinct Panels */}
      <div className="flex-grow flex overflow-hidden w-full relative">
        {/* Panel A: Lista de blocos */}
        <aside className="w-72 lg:w-80 shrink-0 h-full overflow-hidden hidden md:flex flex-col z-10 shadow-xs">
          <BlocksSidebar
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            setSelectedBlockId={setSelectedBlockId}
            onAddBlock={handleAddBlock}
            onReorder={handleReorder}
            savedBlocks={savedBlocks}
            savedBlocksError={savedBlocksError}
            onInsertSavedBlock={handleInsertSavedBlock}
            onDeleteSavedBlock={(saved) => { void handleDeleteSavedBlock(saved); }}
            onOpenAddBlock={refreshSavedBlocks}
          />
        </aside>

        {/* Panel B: Center Canvas (The Email Document) */}
        <main className="flex-grow h-full overflow-hidden flex flex-col min-w-0">
          <PreviewCanvas
            ref={previewCanvasRef}
            compiledHtml={compiledHtml}
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            setSelectedBlockId={setSelectedBlockId}
            onInlineBlockEdit={handleInlineBlockEdit}
            onInlineBlockDraft={handleInlineBlockDraft}
            onSaveRequested={openSaveTemplateModal}
            previewDevice={previewDevice}
            iframeHeight={iframeHeight}
            onExpand={() => {
              previewCanvasRef.current?.commitInlineEdit();
              setIsPreviewModalOpen(true);
            }}
            handleIframeLoad={handleIframeLoad}
            iframeRef={previewIframeRef}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onAddBlock={handleAddBlock}
            onOpenTemplates={() => { void openTemplateLibrary(); }}
            onOpenBlockSelector={() => setIsMobileBlockSelectorOpen(true)}
          />
        </main>

        {/* Panel C: Right Sidebar (Properties Panel with Collapsible Accordion) */}
        <aside className="w-80 lg:w-88 shrink-0 h-full overflow-hidden hidden lg:flex flex-col z-10 shadow-xs">
          <PropertiesPanel
            selectedBlock={selectedBlock}
            updateSelectedBlock={updateSelectedBlock}
            applyFormattingToSelection={applyFormattingToSelection}
            insertVariableToSelectedBlock={insertVariableToSelectedBlock}
            activeSelection={activeSelection}
            hasRichTextSelection={hasRichTextSelection}
            linkModalOpen={linkModalOpen}
            setLinkModalOpen={setLinkModalOpen}
            linkText={linkText}
            setLinkText={setLinkText}
            linkUrl={linkUrl}
            setLinkUrl={setLinkUrl}
            onSaveLink={handleSaveLink}
            onRemoveLink={handleRemoveLinkFromBlock}
            handleOpenLinkModal={handleOpenLinkModal}
            handleDuplicate={handleDuplicate}
            handleDeleteBlock={handleDelete}
            onCloseSelection={() => setSelectedBlockId(null)}
            handleAddBlock={handleAddBlock}
            handleTextSelectOrChange={handleTextSelectOrChange}
            activeEditorRef={activeEditorRef}
            onRichTextSelectionChange={(selectedText) => {
              setHasRichTextSelection(Boolean(selectedText));
            }}
            imageFileInputRef={imageFileInputRef}
            handleImageBlockUpload={handleImageBlockUpload}
            handleNormalizeExistingImage={handleNormalizeExistingImage}
            handleUploadExistingImage={handleUploadExistingImage}
            isNormalizing={isNormalizing}
            emailData={emailData}
            setEmailData={setEmailData}
            onOpenBrandKit={() => setIsBrandKitOpen(true)}
            onSaveBlockAsReusable={(block) => setBlockToSave(block)}
            onUploadImageFile={uploadImageFile}
          />
        </aside>
      </div>

      <BlockSelectorModal
        isOpen={isMobileBlockSelectorOpen}
        onClose={() => setIsMobileBlockSelectorOpen(false)}
        onAddBlock={(type) => {
          handleAddBlock(type);
          setIsMobileBlockSelectorOpen(false);
        }}
        savedBlocks={savedBlocks}
        savedBlocksError={savedBlocksError}
        onInsertSavedBlock={handleInsertSavedBlock}
        onDeleteSavedBlock={(saved) => { void handleDeleteSavedBlock(saved); }}
      />

      <BrandKitModal
        isOpen={isBrandKitOpen}
        kit={brandKit}
        isLoading={isBrandKitLoading}
        loadError={brandKitError}
        onClose={() => setIsBrandKitOpen(false)}
        onSave={handleSaveBrandKit}
        onUploadImage={uploadImageFile}
      />

      <SaveBlockModal
        isOpen={blockToSave !== null}
        defaultName={blockToSave ? `${({
          header: 'Cabeçalho', header_text: 'Cabeçalho', header_image: 'Imagem do cabeçalho', title: 'Título', subtitle: 'Subtítulo',
          text: 'Texto', button: 'Botão', image: 'Imagem', coupon: 'Cupom', divider: 'Divisor', social: 'Redes sociais',
          footer: 'Rodapé', columns: 'Colunas',
        } as Record<BlockType, string>)[blockToSave.type]} salvo` : ''}
        onClose={() => setBlockToSave(null)}
        onSave={handleSaveReusableBlock}
      />

      {/* Visualização em janela (antes era uma tela separada) */}
      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        html={transportHtml}
        device={previewDevice}
      />

      {/* Export HTML Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        compiledHtml={transportHtml}
        plainText={plainTextVersion}
        subject={emailData.subject || ''}
        issues={checklistIssues}
        onFixIssue={handleFixIssue}
        onShowToast={showToast}
      />

      {/* Import HTML Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportHtml={handleImportHtmlContent}
        onShowToast={showToast}
      />

      <SaveTemplateModal
        isOpen={isSaveTemplateModalOpen}
        initialName={editingTemplateId ? (savedTemplates.find((item) => item.id === editingTemplateId)?.name || '') : ''}
        initialDescription={editingTemplateId ? (savedTemplates.find((item) => item.id === editingTemplateId)?.description || '') : ''}
        onClose={() => setIsSaveTemplateModalOpen(false)}
        onSubmit={persistTemplate}
      />

      <TemplateManagerModal
        isOpen={isTemplateManagerOpen}
        templates={savedTemplates}
        currentUserId={libraryContext?.userId || ''}
        isAdmin={libraryContext?.isAdmin === true}
        isLoading={isLibraryLoading}
        loadError={libraryLoadError}
        onRetry={() => { void refreshTemplateLibrary().catch(() => {}); }}
        onClose={() => setIsTemplateManagerOpen(false)}
        onUse={handleUseTemplate}
        onEdit={handleLoadSavedTemplate}
        onDelete={(id) => { void handleDeleteSavedTemplate(id); }}
        onRestoreVersion={(templateId, versionId) => { void handleRestoreVersion(templateId, versionId); }}
      />
    </div>
    </>
  );
};
