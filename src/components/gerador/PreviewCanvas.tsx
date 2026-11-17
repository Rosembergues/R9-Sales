import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { EmailBlock, BlockType } from '../../types';
import { generateSingleBlockHtml } from '../../utils/compiler';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  X,
  Plus,
  Sparkles,
  LayoutTemplate,
} from 'lucide-react';

export interface PreviewCanvasHandle {
  commitInlineEdit: () => void;
}

export interface PreviewCanvasProps {
  compiledHtml: string;
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  onInlineBlockEdit: (blockId: string, field: keyof EmailBlock, value: string) => void;
  onInlineBlockDraft: (blockId: string, field: keyof EmailBlock, value: string) => void;
  onSaveRequested?: () => void;
  previewDevice: 'desktop' | 'mobile';
  iframeHeight: number;
  onExpand: () => void;
  handleIframeLoad: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicate: (block: EmailBlock) => void;
  onDelete: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
  onOpenTemplates: () => void;
  onOpenBlockSelector: () => void;
}

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(({
  compiledHtml,
  blocks,
  selectedBlockId,
  setSelectedBlockId,
  onInlineBlockEdit,
  onInlineBlockDraft,
  onSaveRequested,
  previewDevice,
  iframeHeight,
  onExpand,
  handleIframeLoad,
  iframeRef,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onAddBlock,
  onOpenTemplates,
  onOpenBlockSelector,
}, ref) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number }>({ top: 56, left: 16 });
  const [inlineFormatToolbar, setInlineFormatToolbar] = useState<{ top: number; left: number; visible: boolean }>({ top: 0, left: 0, visible: false });
  const canvasRootRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const floatingToolbarRef = useRef<HTMLDivElement | null>(null);
  const inlineFormatToolbarRef = useRef<HTMLDivElement | null>(null);
  const inlineSelectionRef = useRef<{ range: Range; blockId: string; field: keyof EmailBlock; element: HTMLElement } | null>(null);

  // Stable references for callbacks to prevent stale closure bugs in iframe event handlers
  const onInlineBlockEditRef = useRef(onInlineBlockEdit);
  onInlineBlockEditRef.current = onInlineBlockEdit;
  const onInlineBlockDraftRef = useRef(onInlineBlockDraft);
  onInlineBlockDraftRef.current = onInlineBlockDraft;
  const onSaveRequestedRef = useRef(onSaveRequested);
  onSaveRequestedRef.current = onSaveRequested;
  const setSelectedBlockIdRef = useRef(setSelectedBlockId);
  setSelectedBlockIdRef.current = setSelectedBlockId;

  // Active inline editing tracking
  const activeInlineEditorRef = useRef<{
    blockId: string;
    field: keyof EmailBlock;
    element: HTMLElement;
  } | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const readInlineEditValue = (element: HTMLElement, field: keyof EmailBlock): string => {
    const isRich = field === 'text' || field === 'headerTitle' || field === 'headerSubtitle' || field === 'footerText' || field === 'buttonLabel'
      || /^columns\.\d+\.(text|buttonLabel)$/.test(String(field));
    return isRich ? element.innerHTML : element.innerText || element.textContent || '';
  };

  const commitCurrentInlineEdit = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const active = activeInlineEditorRef.current;
    if (!active || !active.element) {
      activeInlineEditorRef.current = null;
      return;
    }

    const { blockId, field, element } = active;
    const value = readInlineEditValue(element, field);
    onInlineBlockEditRef.current(blockId, field, value);

    element.contentEditable = 'false';
    delete element.dataset.r9Editing;
    element.title = 'Duplo clique para editar';
    activeInlineEditorRef.current = null;
    setInlineFormatToolbar((prev) => ({ ...prev, visible: false }));
  }, []);

  // Expose imperative handle so parent (GeradorProScreen) can flush anytime
  useImperativeHandle(ref, () => ({
    commitInlineEdit: commitCurrentInlineEdit,
  }), [commitCurrentInlineEdit]);

  // Keep srcDoc stable unless the structure of blocks or preview device changes.
  // This prevents the iframe from reloading when block contents change,
  // ensuring the user's cursor / caret is NEVER destroyed during typing.
  const structureKey = useMemo(() => {
    return blocks.map((b) => `${b.id}:${b.type}`).join('|') + `:${previewDevice}`;
  }, [blocks, previewDevice]);

  const [currentSrcDoc, setCurrentSrcDoc] = useState(compiledHtml);
  const prevStructureKeyRef = useRef(structureKey);

  useEffect(() => {
    if (prevStructureKeyRef.current !== structureKey) {
      prevStructureKeyRef.current = structureKey;
      commitCurrentInlineEdit();
      setCurrentSrcDoc(compiledHtml);
    }
  }, [structureKey, compiledHtml, commitCurrentInlineEdit]);

  // Synchronize block changes in-place in the iframe DOM without a full reload
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      if (!doc || !doc.body) return;

      blocks.forEach((block) => {
        const blockEl = doc.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement | null;
        if (blockEl) {
          // If this block is currently being typed in directly in the canvas, do not replace it
          if (activeInlineEditorRef.current?.blockId === block.id) return;
          const activeEditingEl = blockEl.querySelector('[data-inline-edit][contenteditable="true"][data-r9-editing="true"]');
          if (activeEditingEl) return;

          const tempDiv = doc.createElement('div');
          tempDiv.innerHTML = generateSingleBlockHtml(block).trim();
          const newBlockEl = tempDiv.firstElementChild;
          if (newBlockEl && blockEl.outerHTML !== newBlockEl.outerHTML) {
            blockEl.replaceWith(newBlockEl);
            newBlockEl.querySelectorAll<HTMLElement>('[data-inline-edit]').forEach((el) => {
              el.title = 'Duplo clique para editar';
            });
          }
        }
      });

      highlightSelectedBlockInIframe(selectedBlockId);
      handleIframeLoad();
    } catch {
      // Safe guard
    }
  }, [blocks, selectedBlockId, handleIframeLoad, iframeRef]);

  // Global parent window listener: whenever user clicks anywhere outside the iframe
  // (e.g. TopBar, PropertiesPanel, Sidebars, Modals), commit any active canvas inline edit immediately!
  useEffect(() => {
    const handleParentMouseDown = (e: MouseEvent) => {
      if (!activeInlineEditorRef.current) return;
      const target = e.target as Node | null;

      // The floating formatting toolbar lives outside the iframe. Do not commit
      // the inline edit on its mousedown: committing updates `blocks`, which can
      // replace the selected iframe element before the toolbar's click handler
      // restores the saved Range and applies formatting.
      if (target && inlineFormatToolbarRef.current?.contains(target)) return;

      // If clicking inside the iframe container, let iframe handlers handle it.
      if (target && iframeRef.current && iframeRef.current.contains(target)) return;
      commitCurrentInlineEdit();
    };

    window.addEventListener('mousedown', handleParentMouseDown, true);
    window.addEventListener('blur', commitCurrentInlineEdit);

    return () => {
      window.removeEventListener('mousedown', handleParentMouseDown, true);
      window.removeEventListener('blur', commitCurrentInlineEdit);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [commitCurrentInlineEdit, iframeRef]);

  const selectedIndex = blocks.findIndex((b) => b.id === selectedBlockId);
  const selectedBlock = selectedIndex !== -1 ? blocks[selectedIndex] : null;

  // Enhance iframe with click detection, keyboard shortcuts, and inline editing
  const handleEnhancedIframeLoad = () => {
    handleIframeLoad();
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        if (!doc) return;

        // Injeta CSS para cursor e destaque no iframe
        const styleId = 'r9-editor-canvas-styles';
        let styleTag = doc.getElementById(styleId);
        if (!styleTag) {
          styleTag = doc.createElement('style');
          styleTag.id = styleId;
          styleTag.textContent = `
            [data-block-id] {
              cursor: pointer !important;
              transition: outline 0.15s ease, box-shadow 0.15s ease !important;
            }
            [data-block-id]:hover {
              outline: 2px dashed #818cf8 !important;
              outline-offset: -2px !important;
            }
            [data-block-id].r9-selected-block {
              outline: 2px solid #4f46e5 !important;
              outline-offset: -2px !important;
              box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2) !important;
            }
            [data-inline-edit][contenteditable="true"] {
              outline: 2px solid #6366f1 !important;
              outline-offset: 2px !important;
              border-radius: 4px !important;
              cursor: text !important;
              background-color: rgba(99, 102, 241, 0.04) !important;
            }
          `;
          doc.head.appendChild(styleTag);
        }

        // Listener de clique nos blocos
        doc.body.onclick = (e: MouseEvent) => {
          let target = e.target as HTMLElement | null;

          // Se estava editando um elemento e clicou fora dele, confirma a edição
          if (activeInlineEditorRef.current && (!target || !activeInlineEditorRef.current.element.contains(target))) {
            commitCurrentInlineEdit();
          }

          // No editor, nenhum link deve navegar: a pré-visualização trocaria de página.
          if (target?.closest('a[href]')) e.preventDefault();

          const buttonLink = target?.closest('a[data-inline-edit="buttonLabel"], a.btn, a.btn-full, a.btn-auto') as HTMLAnchorElement | null;
          if (buttonLink) {
            e.preventDefault();
            e.stopPropagation();
            const blockEl = buttonLink.closest('[data-block-id]') as HTMLElement | null;
            const blockId = blockEl?.getAttribute('data-block-id');
            if (blockId) setSelectedBlockIdRef.current(blockId);
            return;
          }

          while (target && target !== doc.body) {
            const blockId = target.getAttribute('data-block-id');
            if (blockId) {
              e.stopPropagation();
              setSelectedBlockIdRef.current(blockId);
              return;
            }
            target = target.parentElement;
          }
        };

        // Edição rápida diretamente no preview (duplo clique)
        doc.body.ondblclick = (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
          const el = target?.closest('[data-inline-edit]') as HTMLElement | null;
          if (!el || !doc.body.contains(el)) return;

          // Se havia outro elemento em edição, confirma-o primeiro
          if (activeInlineEditorRef.current && (!el || !activeInlineEditorRef.current.element.contains(el))) {
            commitCurrentInlineEdit();
          }

          event.stopPropagation();

          const blockEl = el.closest('[data-block-id]') as HTMLElement | null;
          const blockId = blockEl?.getAttribute('data-block-id');
          const field = el.getAttribute('data-inline-edit') as keyof EmailBlock | null;
          if (!blockId || !field) return;

          setSelectedBlockIdRef.current(blockId);
          activeInlineEditorRef.current = { blockId, field, element: el };
          el.contentEditable = 'true';
          el.dataset.r9Editing = 'true';
          el.title = '';
          el.focus();

          // Mantém a seleção de palavra criada pelo duplo clique se disponível
          try {
            const selection = doc.getSelection();
            if (!selection || selection.rangeCount === 0 || !selection.toString()) {
              const range = doc.createRange();
              range.selectNodeContents(el);
              range.collapse(false);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          } catch {
            // Safe guard
          }
        };

        const updateInlineFormatToolbar = () => {
          const selection = doc.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            setInlineFormatToolbar((prev) => ({ ...prev, visible: false }));
            return;
          }

          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const containerEl = container.nodeType === Node.ELEMENT_NODE
            ? container as Element
            : container.parentElement;
          const editable = containerEl?.closest?.('[data-inline-edit][contenteditable="true"]') as HTMLElement | null;
          if (!editable || !doc.body.contains(editable) || !editable.dataset.r9Editing) {
            setInlineFormatToolbar((prev) => ({ ...prev, visible: false }));
            return;
          }

          const blockEl = editable.closest('[data-block-id]') as HTMLElement | null;
          const blockId = blockEl?.getAttribute('data-block-id');
          const field = editable.getAttribute('data-inline-edit') as keyof EmailBlock | null;
          if (!blockId || !field || !selection.toString().trim()) {
            setInlineFormatToolbar((prev) => ({ ...prev, visible: false }));
            return;
          }

          inlineSelectionRef.current = {
            range: range.cloneRange(),
            blockId,
            field,
            element: editable,
          };

          const rect = range.getBoundingClientRect();
          if (!rect.width && !rect.height) {
            setInlineFormatToolbar((prev) => ({ ...prev, visible: false }));
            return;
          }

          const iframe = iframeRef.current;
          const root = canvasRootRef.current;
          if (!iframe || !root) return;

          const iframeRect = iframe.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const scaleX = iframe.clientWidth ? iframeRect.width / iframe.clientWidth : 1;
          const scaleY = iframe.clientHeight ? iframeRect.height / iframe.clientHeight : 1;
          const selectionCenterX = iframeRect.left + ((rect.left + rect.right) / 2) * scaleX - rootRect.left;
          const selectionTop = iframeRect.top + rect.top * scaleY - rootRect.top;

          setInlineFormatToolbar({
            top: Math.max(48, selectionTop - 44),
            left: Math.max(8, Math.min(selectionCenterX - 92, root.clientWidth - 192)),
            visible: true,
          });
        };

        doc.body.onmouseup = () => {
          requestAnimationFrame(updateInlineFormatToolbar);
        };
        doc.body.onkeyup = () => {
          requestAnimationFrame(updateInlineFormatToolbar);
        };
        doc.addEventListener('selectionchange', updateInlineFormatToolbar);

        // Atualização em tempo real enquanto o usuário digita:
        // 1. Atualiza o rascunho instantaneamente para reflexão em outros painéis.
        // 2. Chama onInlineBlockEdit para que blocks seja atualizado na mesma hora de forma coalescida.
        doc.body.oninput = (event: Event) => {
          const target = event.target as HTMLElement | null;
          const editingEl = (target?.closest?.('[data-r9-editing="true"]') || target?.closest?.('[data-inline-edit][contenteditable="true"]')) as HTMLElement | null;
          if (!editingEl) return;

          const blockEl = editingEl.closest('[data-block-id]') as HTMLElement | null;
          const blockId = blockEl?.getAttribute('data-block-id');
          const field = editingEl.getAttribute('data-inline-edit') as keyof EmailBlock | null;
          if (!blockId || !field) return;

          const value = readInlineEditValue(editingEl, field);
          activeInlineEditorRef.current = { blockId, field, element: editingEl };
          onInlineBlockDraftRef.current(blockId, field, value);
          onInlineBlockEditRef.current(blockId, field, value);
        };

        // Quando o elemento perde foco dentro do iframe: commit garantido
        doc.body.addEventListener('focusout', (e: Event) => {
          const focusEvent = e as FocusEvent;
          const related = focusEvent.relatedTarget as Node | null;
          if (activeInlineEditorRef.current && related && activeInlineEditorRef.current.element.contains(related)) {
            return;
          }
          commitCurrentInlineEdit();
        });

        // Atalhos de teclado no iframe:
        // - Escape: encerra a edição e salva o valor digitado.
        // - Enter em campos de linha única (título, subtítulo, botão): encerra edição e salva.
        // - Ctrl+S / Cmd+S: salva o template imediatamente.
        doc.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            commitCurrentInlineEdit();
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            commitCurrentInlineEdit();
            onSaveRequestedRef.current?.();
            return;
          }
          if (e.key === 'Enter') {
            const target = e.target as HTMLElement | null;
            const editable = target?.closest?.('[data-inline-edit]') as HTMLElement | null;
            const field = editable?.getAttribute('data-inline-edit');
            if (field && field !== 'text' && field !== 'footerText' && !/^columns\.\d+\.text$/.test(field)) {
              e.preventDefault();
              commitCurrentInlineEdit();
            }
          }
        });

        doc.defaultView?.addEventListener('blur', commitCurrentInlineEdit);

        doc.querySelectorAll<HTMLElement>('[data-inline-edit]').forEach((el) => {
          el.title = 'Duplo clique para editar';
        });

        // Aplica classe de selecionado
        highlightSelectedBlockInIframe(selectedBlockId);
      }
    } catch {
      // Cross-origin safe guard
    }
  };

  const applyInlineFormat = (command: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'removeFormat') => {
    const saved = inlineSelectionRef.current;
    const iframe = iframeRef.current;
    if (!saved || !iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !doc.body.contains(saved.element)) return;

      saved.element.contentEditable = 'true';
      saved.element.focus();
      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(saved.range);

      doc.execCommand(command, false);

      const value = readInlineEditValue(saved.element, saved.field);
      onInlineBlockEditRef.current(saved.blockId, saved.field, value);
      setInlineFormatToolbar((prev) => ({ ...prev, visible: false }));
      inlineSelectionRef.current = null;
    } catch {
      // Safe guard
    }
  };

  const highlightSelectedBlockInIframe = (blockId: string | null) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        if (!doc) return;

        doc.querySelectorAll('.r9-selected-block').forEach((el) => {
          el.classList.remove('r9-selected-block');
        });

        if (blockId) {
          const selectedEl = doc.querySelector(`[data-block-id="${blockId}"]`);
          if (selectedEl) {
            selectedEl.classList.add('r9-selected-block');
          }
        }
      }
    } catch {
      // Cross-origin safe guard
    }
  };

  useEffect(() => {
    highlightSelectedBlockInIframe(selectedBlockId);
  }, [selectedBlockId, compiledHtml]);

  // Posiciona a barra de ações ao lado do bloco selecionado, em vez de
  // mantê-la presa ao topo do canvas. Como o bloco vive dentro do iframe,
  // convertemos as coordenadas do elemento para as coordenadas do canvas.
  const updateToolbarPosition = () => {
    const root = canvasRootRef.current;
    const iframe = iframeRef.current;
    const toolbar = floatingToolbarRef.current;
    if (!root || !iframe || !toolbar || !selectedBlockId) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const selectedEl = Array.from(doc.querySelectorAll<HTMLElement>('[data-block-id]'))
        .find((el) => el.getAttribute('data-block-id') === selectedBlockId);
      if (!selectedEl) return;

      const iframeRect = iframe.getBoundingClientRect();
      const blockRect = selectedEl.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const gap = 8;

      // O getBoundingClientRect() do conteúdo do iframe usa as coordenadas
      // internas dele. Quando o canvas está com zoom, precisamos aplicar a
      // mesma escala visual do iframe antes de converter para o canvas externo.
      const scaleX = iframe.clientWidth ? iframeRect.width / iframe.clientWidth : 1;
      const scaleY = iframe.clientHeight ? iframeRect.height / iframe.clientHeight : 1;
      const blockLeft = iframeRect.left + blockRect.left * scaleX - rootRect.left;
      const blockRight = iframeRect.left + blockRect.right * scaleX - rootRect.left;
      const blockTop = iframeRect.top + blockRect.top * scaleY - rootRect.top;
      const blockBottom = iframeRect.top + blockRect.bottom * scaleY - rootRect.top;
      const blockCenterY = (blockTop + blockBottom) / 2;

      const minLeft = 8;
      const maxLeft = Math.max(minLeft, root.clientWidth - toolbarRect.width - 8);

      // Primeiro tenta colocar a barra à direita do bloco. Se não houver espaço,
      // coloca à esquerda. Assim ela acompanha o bloco mesmo em telas menores.
      let left = blockRight + gap;
      if (left > maxLeft) {
        left = blockLeft - toolbarRect.width - gap;
      }
      left = Math.max(minLeft, Math.min(left, maxLeft));

      const minTop = 52; // abaixo da barra superior do canvas
      const maxTop = Math.max(minTop, root.clientHeight - toolbarRect.height - 8);
      let top = blockCenterY - toolbarRect.height / 2;
      top = Math.max(minTop, Math.min(top, maxTop));

      setToolbarPosition({ top, left });
    } catch {
      // O iframe pode estar entre dois renders; a próxima atualização reposiciona.
    }
  };

  useEffect(() => {
    if (!selectedBlockId) return;

    const update = () => requestAnimationFrame(updateToolbarPosition);
    update();

    const workspace = workspaceRef.current;
    workspace?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      workspace?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [selectedBlockId, compiledHtml, previewDevice, zoomLevel, iframeHeight]);

  // Handle drop from sidebar
  const handleDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const data = e.dataTransfer.getData('text/plain');
    if (data && data.startsWith('block:')) {
      const blockType = data.replace('block:', '') as BlockType;
      onAddBlock(blockType);
    }
  };

  return (
    <div ref={canvasRootRef} className="flex-grow h-full flex flex-col bg-slate-100/75 select-none relative overflow-hidden">
      {/* Canvas Top Controls Toolbar */}
      <div className="h-11 px-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-xs flex items-center justify-end gap-2 z-20 shrink-0">
        {/* Zoom & Fullscreen Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(z - 10, 60))}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
              title="Reduzir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span
              onClick={() => setZoomLevel(100)}
              className="px-2 cursor-pointer hover:text-indigo-600 font-mono text-[11px]"
              title="Resetar para 100%"
            >
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(z + 10, 150))}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onExpand}
            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-slate-200"
            title="Expandir Visualização em Tela Cheia"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating text-format toolbar for direct canvas editing. It is separate from
          the block action toolbar and only appears when the user selects text inside
          an actively edited canvas field. */}
      {inlineFormatToolbar.visible && (
        <div
          ref={inlineFormatToolbarRef}
          className="absolute z-40 bg-slate-900 text-white rounded-lg shadow-xl px-1.5 py-1 flex items-center gap-0.5 border border-slate-700"
          style={{ top: inlineFormatToolbar.top, left: inlineFormatToolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat('bold')} className="w-7 h-7 rounded hover:bg-slate-700 font-black" title="Negrito">B</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat('italic')} className="w-7 h-7 rounded hover:bg-slate-700 italic font-serif" title="Itálico">I</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat('underline')} className="w-7 h-7 rounded hover:bg-slate-700 underline font-bold" title="Sublinhado">U</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat('strikeThrough')} className="w-7 h-7 rounded hover:bg-slate-700 line-through font-bold" title="Tachado">S</button>
          <span className="mx-0.5 h-5 w-px bg-slate-700" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyInlineFormat('removeFormat')} className="px-2 h-7 rounded hover:bg-slate-700 text-[11px] font-semibold" title="Limpar formatação da seleção">Limpar</button>
        </div>
      )}

      {/* Floating Action Toolbar for the Selected Block */}
      {selectedBlock && selectedIndex !== -1 && (
        <div
          ref={floatingToolbarRef}
          style={{ top: toolbarPosition.top, left: toolbarPosition.left }}
          className="absolute z-30 bg-slate-900 text-white rounded-xl shadow-xl px-2 py-1.5 flex items-center gap-1 text-xs border border-slate-700 animate-slideDown"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={selectedIndex === 0}
              onClick={() => onMoveUp(selectedIndex)}
              className="p-1 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-300 hover:text-white transition-colors"
              title="Mover para cima"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={selectedIndex === blocks.length - 1}
              onClick={() => onMoveDown(selectedIndex)}
              className="p-1 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded text-slate-300 hover:text-white transition-colors"
              title="Mover para baixo"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDuplicate(selectedBlock)}
              className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors"
              title="Duplicar bloco"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(selectedBlock.id)}
              className="p-1 hover:bg-rose-900/60 rounded text-rose-300 hover:text-rose-100 transition-colors"
              title="Excluir bloco"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedBlockId(null)}
            className="p-1 text-slate-400 hover:text-white rounded ml-1"
            title="Desmarcar bloco"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Canvas Workspace Area with Scroll */}
      <div
        ref={workspaceRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDropOnCanvas}
        className={`flex-grow overflow-y-auto p-4 sm:p-8 flex justify-center items-start transition-colors ${
          isDragOver ? 'bg-indigo-50/50 ring-4 ring-indigo-400/20 ring-inset' : ''
        }`}
      >
        {blocks.length > 0 && (
          <button
            type="button"
            onClick={onOpenBlockSelector}
            className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-colors"
            title="Adicionar bloco"
          >
            <Plus className="w-4 h-4" />
            Adicionar bloco
          </button>
        )}

        {blocks.length === 0 ? (
          /* Empty State */
          <div className="my-auto max-w-md w-full bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
              <LayoutTemplate className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Seu e-mail está em branco
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Adicione blocos pela barra lateral à esquerda ou comece com um modelo profissional pronto.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onAddBlock('header_text')}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Banner</span>
              </button>

              <button
                type="button"
                onClick={onOpenTemplates}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Ver biblioteca compartilhada</span>
              </button>
            </div>
          </div>
        ) : (
          /* The Email Document Container (Simulating real paper/email client) */
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
            }}
            className={`transition-all duration-300 bg-white rounded-xl shadow-2xl shadow-slate-900/10 border border-slate-200/90 overflow-hidden relative ${
              previewDevice === 'mobile' ? 'w-[375px]' : 'w-[600px]'
            }`}
          >
            <iframe
              ref={iframeRef}
              onLoad={handleEnhancedIframeLoad}
              title="R9Bot Mailer Live Canvas Preview"
              srcDoc={currentSrcDoc}
              scrolling="no"
              style={{ height: `${iframeHeight}px` }}
              className="w-full border-0 block transition-[height] duration-200"
            />
          </div>
        )}
      </div>
    </div>
  );
});
