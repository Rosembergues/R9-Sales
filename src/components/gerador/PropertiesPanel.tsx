import React, { useEffect, useRef, useState } from 'react';
import { EmailBlock, BlockType, EmailData } from '../../types';
import { RichTextEditor, RichTextEditorRef } from '../RichTextEditor';
import { LinkEditorModal } from './LinkEditorModal';
import { EMAIL_VARIABLES } from '../../utils/sampleData';
import {
  Settings,
  Type,
  Palette,
  Layout,
  Code2,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  X,
  Upload,
  Link,
  Sparkles,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Sliders,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  BookmarkPlus,
  Paintbrush,
} from 'lucide-react';
import { ColumnsEditor } from './ColumnsEditor';

interface PropertiesPanelProps {
  selectedBlock: EmailBlock | null;
  updateSelectedBlock: (updatedProps: Partial<EmailBlock>) => void;
  applyFormattingToSelection: (
    formatType: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'color' | 'fontSize' | 'fontFamily' | 'clear' | 'variable' | 'link' | 'unlink',
    formatValue?: string | number,
    colorTargetKey?: 'textColor' | 'headerTextColor' | 'buttonTextColor' | 'footerTextColor'
  ) => void;
  insertVariableToSelectedBlock: (varName: string) => void;
  hasRichTextSelection?: boolean;
  onRichTextSelectionChange?: (selectedText: string) => void;
  activeSelection: {
    fieldName: string;
    start: number;
    end: number;
    selectedText: string;
  } | null;
  linkModalOpen: boolean;
  setLinkModalOpen: (open: boolean) => void;
  linkText: string;
  setLinkText: (text: string) => void;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
  onSaveLink: () => void;
  onRemoveLink: () => void;
  handleOpenLinkModal: () => void;
  handleDuplicate: (block: EmailBlock) => void;
  handleDeleteBlock: (id: string) => void;
  onCloseSelection: () => void;
  handleAddBlock: (type: BlockType) => void;
  handleTextSelectOrChange: (e: any, fieldName: string) => void;
  activeEditorRef: React.MutableRefObject<RichTextEditorRef | null>;
  imageFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageBlockUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNormalizeExistingImage: () => void;
  handleUploadExistingImage: () => void;
  isNormalizing: boolean;
  emailData?: EmailData;
  setEmailData?: React.Dispatch<React.SetStateAction<EmailData>>;
  onOpenBrandKit?: () => void;
  onSaveBlockAsReusable?: (block: EmailBlock) => void;
  onUploadImageFile?: (file: File) => Promise<string | null>;
}

const PREHEADER_IDEAL_MAX = 110;

const COLOR_PRESETS = [
  '#003bb3', // Estácio Blue
  '#4f46e5', // Indigo
  '#0284c7', // Sky
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48', // Rose
  '#1e293b', // Slate 800
  '#ffffff', // White
  '#000000', // Black
];

interface SelectableRichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  activeEditorRef: React.MutableRefObject<RichTextEditorRef | null>;
  onFocus?: () => void;
  onSelectionChange?: (selectedText: string) => void;
}

const SelectableRichTextField: React.FC<SelectableRichTextFieldProps> = ({
  value,
  onChange,
  placeholder,
  minHeight = '72px',
  activeEditorRef,
  onFocus,
  onSelectionChange,
}) => {
  const localRef = useRef<RichTextEditorRef | null>(null);

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
      <RichTextEditor
        ref={localRef}
        value={value}
        onChange={onChange}
        onFocus={() => {
          activeEditorRef.current = localRef.current;
          onFocus?.();
        }}
        onSelectionChange={(selectedText) => {
          activeEditorRef.current = localRef.current;
          onSelectionChange?.(selectedText);
        }}
        placeholder={placeholder}
        minHeight={minHeight}
        className="p-3 text-xs leading-relaxed focus:outline-none bg-white"
      />
    </div>
  );
};

const FONT_FAMILIES = [
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New (Mono)', value: "'Courier New', Courier, monospace" },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedBlock,
  updateSelectedBlock,
  applyFormattingToSelection,
  insertVariableToSelectedBlock,
  activeSelection,
  hasRichTextSelection = false,
  onRichTextSelectionChange,
  linkModalOpen,
  setLinkModalOpen,
  linkText,
  setLinkText,
  linkUrl,
  setLinkUrl,
  onSaveLink,
  onRemoveLink,
  handleOpenLinkModal,
  handleDuplicate,
  handleDeleteBlock,
  onCloseSelection,
  handleAddBlock,
  handleTextSelectOrChange,
  activeEditorRef,
  imageFileInputRef,
  handleImageBlockUpload,
  handleNormalizeExistingImage,
  handleUploadExistingImage,
  isNormalizing,
  emailData,
  setEmailData,
  onOpenBrandKit,
  onSaveBlockAsReusable,
  onUploadImageFile,
}) => {
  // Accordion open/close states
  const [openSections, setOpenSections] = useState({
    content: true,
    style: true,
    layout: false,
    advanced: false,
  });

  // URL do botão: mantemos um rascunho local durante a digitação.
  // O sanitizador central exige uma URL completa (http/https), então aplicar
  // sanitizeBlockPropertyUpdate a cada tecla fazia o input controlado voltar ao
  // valor anterior assim que o usuário digitava, por exemplo, apenas "h" ou "https://".
  const [buttonUrlDraft, setButtonUrlDraft] = useState('');

  useEffect(() => {
    if (selectedBlock?.type === 'button') {
      setButtonUrlDraft(selectedBlock.buttonUrl || '');
    } else {
      setButtonUrlDraft('');
    }
  }, [selectedBlock?.id, selectedBlock?.type, selectedBlock?.buttonUrl]);

  const commitButtonUrl = () => {
    updateSelectedBlock({ buttonUrl: buttonUrlDraft });
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Plain-text paste protection for single-line text inputs (Title, Header, etc.)
  const handlePlainTextPaste = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    fieldKey: keyof EmailBlock
  ) => {
    e.preventDefault();
    const plainText = e.clipboardData.getData('text/plain');
    if (!plainText) return;

    const target = e.currentTarget;
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const currentVal = String((selectedBlock as any)?.[fieldKey] || '');

    const newVal = currentVal.substring(0, start) + plainText + currentVal.substring(end);
    updateSelectedBlock({ [fieldKey]: newVal });

    // Restores cursor position
    setTimeout(() => {
      target.selectionStart = target.selectionEnd = start + plainText.length;
    }, 0);
  };

  const getTextColorField = (): 'textColor' | 'headerTextColor' | 'buttonTextColor' | 'footerTextColor' => {
    if (selectedBlock?.type === 'header' || selectedBlock?.type === 'header_text') return 'headerTextColor';
    if (selectedBlock?.type === 'button') return 'buttonTextColor';
    if (selectedBlock?.type === 'footer') return 'footerTextColor';
    return 'textColor';
  };

  const applyTextColor = (color: string) => {
    if (hasRichTextSelection && activeEditorRef.current?.hasSavedSelection()) {
      applyFormattingToSelection('color', color, getTextColorField());
      return;
    }
    updateSelectedBlock({ [getTextColorField()]: color });
  };

  const applyFontSize = (size: number) => {
    if (hasRichTextSelection && activeEditorRef.current?.hasSavedSelection()) {
      applyFormattingToSelection('fontSize', size);
      return;
    }
    updateSelectedBlock({ fontSizePx: size });
  };

  const applyFontFamily = (family: string) => {
    if (hasRichTextSelection && activeEditorRef.current?.hasSavedSelection()) {
      applyFormattingToSelection('fontFamily', family);
      return;
    }
    updateSelectedBlock({ fontFamily: family });
  };

  // If NO block is selected: Show Global Email Settings
  if (!selectedBlock) {
    return (
      <div className="w-full h-full flex flex-col bg-white border-l border-slate-200/90 select-none overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Configurações do E-mail
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Clique em um bloco do e-mail para editá-lo.
          </p>
        </div>

        <div className="p-4 space-y-5 flex-grow overflow-y-auto min-h-0">
          {/* Nome do e-mail: nome exibido ao publicar e localizar o modelo na biblioteca */}
          {emailData && setEmailData && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Nome do e-mail:</label>
              <input
                type="text"
                value={emailData.headerTitle || ''}
                onChange={(e) => setEmailData((prev) => ({ ...prev, headerTitle: e.target.value }))}
                placeholder="Ex: Matrícula outubro"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Serve para você encontrar este e-mail depois.
              </p>
            </div>
          )}

          {emailData && setEmailData && (
            <div className="space-y-1.5 pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block" htmlFor="email-subject">Assunto:</label>
              <input
                id="email-subject"
                type="text"
                value={emailData.subject === 'E-mail sem assunto' ? '' : emailData.subject || ''}
                onChange={(e) => setEmailData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Ex: Sua matrícula com 30% de desconto"
                maxLength={200}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">No celular aparecem só uns 40 caracteres; comece pelo mais importante.</p>
            </div>
          )}

          {emailData && setEmailData && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700" htmlFor="email-preheader">Texto de pré-visualização:</label>
                <span className={`text-[10px] font-mono ${(emailData.preheader || '').length > PREHEADER_IDEAL_MAX ? 'text-amber-600' : 'text-slate-400'}`}>
                  {(emailData.preheader || '').length}/{PREHEADER_IDEAL_MAX}
                </span>
              </div>
              <textarea
                id="email-preheader"
                value={emailData.preheader || ''}
                onChange={(e) => setEmailData((prev) => ({ ...prev, preheader: e.target.value.replace(/\n/g, ' ') }))}
                placeholder="Ex: Só até sexta. Garanta sua vaga com condições especiais."
                rows={3}
                maxLength={250}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white resize-none"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Aparece ao lado do assunto na caixa de entrada e não aparece dentro do e-mail. Complete o assunto em vez de repeti-lo.
              </p>
            </div>
          )}

          {onOpenBrandKit && (
            <div className="pt-4 border-t border-slate-100 space-y-1.5">
              <button
                type="button"
                onClick={onOpenBrandKit}
                className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg flex items-center justify-center gap-2 text-xs transition-colors cursor-pointer border border-indigo-200"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Kit da marca</span>
              </button>
              <p className="text-[11px] text-slate-500 leading-relaxed">Cores, fonte, logo e redes da empresa usadas nos blocos novos.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const getBlockTitle = (type: BlockType) => {
    const titles: Record<BlockType, string> = {
      header_text: 'Cabeçalho / Banner',
      header: 'Cabeçalho Simples',
      header_image: 'Imagem do Cabeçalho',
      title: 'Título Principal',
      subtitle: 'Subtítulo',
      text: 'Texto / Parágrafo',
      button: 'Botão CTA',
      image: 'Banner / Imagem',
      coupon: 'Cupom de Desconto',
      divider: 'Linha Divisória',
      social: 'Redes Sociais',
      footer: 'Rodapé Legal',
      columns: 'Colunas',
    };
    return titles[type] || type;
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-slate-200/90 select-none overflow-hidden">
      {/* Panel Top Header with Block Name & Quick Actions */}
      <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-900 truncate">
              {getBlockTitle(selectedBlock.type)}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onSaveBlockAsReusable && (
            <button
              type="button"
              onClick={() => onSaveBlockAsReusable(selectedBlock)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Salvar em Meus blocos para reutilizar em outros e-mails"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDuplicate(selectedBlock)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Duplicar este bloco"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteBlock(selectedBlock.id)}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Excluir este bloco"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onCloseSelection}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Fechar propriedades"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Accordion List */}
      <div className="divide-y divide-slate-100 flex-grow overflow-y-auto min-h-0">
        {/* =========================================================================
            SECTION 1: CONTEÚDO (Content)
        ========================================================================= */}
        <div className="border-b border-slate-100">
          <button
            type="button"
            onClick={() => toggleSection('content')}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              <span>Conteúdo</span>
            </div>
            {openSections.content ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.content && (
            <div className="px-4 pb-4 pt-1 space-y-4 text-xs animate-fadeIn">
              {/* Header Text / Header Block */}
              {(selectedBlock.type === 'header' || selectedBlock.type === 'header_text') && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">Título do Cabeçalho:</label>
                      <span className="text-[10px] text-slate-400">Suporta quebra de linha</span>
                    </div>
                    <SelectableRichTextField
                      activeEditorRef={activeEditorRef}
                      value={selectedBlock.headerTitle || ''}
                      onChange={(value) => updateSelectedBlock({ headerTitle: value })}
                      onSelectionChange={onRichTextSelectionChange}
                      placeholder="ESTÁCIO — SUA MATRÍCULA COMEÇA AQUI!"
                      minHeight="90px"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Subtítulo / Apoio:</label>
                    <SelectableRichTextField
                      activeEditorRef={activeEditorRef}
                      value={selectedBlock.headerSubtitle || ''}
                      onChange={(value) => updateSelectedBlock({ headerSubtitle: value })}
                      onSelectionChange={onRichTextSelectionChange}
                      placeholder="Condições especiais para estudar na Estácio R9"
                      minHeight="70px"
                    />
                  </div>
                </div>
              )}

              {/* Title Block */}
              {selectedBlock.type === 'title' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Texto do Título:</label>
                  <SelectableRichTextField
                    activeEditorRef={activeEditorRef}
                    value={selectedBlock.text || ''}
                    onChange={(value) => updateSelectedBlock({ text: value })}
                    onSelectionChange={onRichTextSelectionChange}
                    placeholder="Novidades exclusivas para você"
                  />
                </div>
              )}

              {/* Subtitle Block */}
              {selectedBlock.type === 'subtitle' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Texto do Subtítulo:</label>
                  <SelectableRichTextField
                    activeEditorRef={activeEditorRef}
                    value={selectedBlock.text || ''}
                    onChange={(value) => updateSelectedBlock({ text: value })}
                    onSelectionChange={onRichTextSelectionChange}
                    placeholder="Olá {{nome}}, temos uma atualização especial"
                  />
                </div>
              )}

              {/* Rich Paragraph Text Block (With Guaranteed Plain-Text Paste Handler) */}
              {selectedBlock.type === 'text' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Corpo do Texto:</label>
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Limpeza de formatação ativa</span>
                    </span>
                  </div>

                  <SelectableRichTextField
                    activeEditorRef={activeEditorRef}
                    value={selectedBlock.text || ''}
                    onChange={(newHtml) => updateSelectedBlock({ text: newHtml })}
                    onSelectionChange={onRichTextSelectionChange}
                    placeholder="Escreva seu parágrafo aqui... Cole textos da web sem receio de formatação quebrada."
                    minHeight="140px"
                  />
                </div>
              )}

              {/* Button CTA Block */}
              {selectedBlock.type === 'button' && (
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Rótulo do Botão:</label>
                    <SelectableRichTextField
                      activeEditorRef={activeEditorRef}
                      value={selectedBlock.buttonLabel || ''}
                      onChange={(value) => updateSelectedBlock({ buttonLabel: value })}
                      onSelectionChange={onRichTextSelectionChange}
                      placeholder="Conhecer Plataforma Agora"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Link de Destino (URL):</label>
                    <div className="relative">
                      <input
                        type="url"
                        value={buttonUrlDraft}
                        onChange={(e) => setButtonUrlDraft(e.target.value)}
                        onBlur={commitButtonUrl}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitButtonUrl();
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="https://exemplo.com.br"
                        autoComplete="url"
                        className="w-full p-2.5 pr-8 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono"
                      />
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                    </div>
                  </div>
                </div>
              )}

              {/* Image / Banner Block */}
              {(selectedBlock.type === 'image' || selectedBlock.type === 'header_image') && (
                <div className="space-y-3">
                  {/* Hidden image input for upload */}
                  <input
                    type="file"
                    ref={imageFileInputRef}
                    onChange={handleImageBlockUpload}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                  />

                  {/* Image Preview or Placeholder */}
                  {selectedBlock.imageUrl ? (
                    <div className="space-y-2">
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 text-center">
                        <img
                          src={selectedBlock.imageUrl}
                          alt={selectedBlock.imageAlt || 'Preview'}
                          className="max-h-36 mx-auto object-contain rounded-lg shadow-2xs"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => imageFileInputRef.current?.click()}
                          className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Trocar Imagem</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleNormalizeExistingImage}
                          disabled={isNormalizing}
                          className="py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                          title="Reduzir o peso e as dimensões da imagem para carregar rápido no e-mail"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isNormalizing ? 'Otimizando...' : 'Otimizar'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => imageFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 transition-all space-y-2"
                    >
                      <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-bold text-slate-700 text-xs">Fazer upload de imagem</p>
                      <p className="text-[10px] text-slate-400">
                        PNG, JPG, WEBP ou GIF até 15 MB. A imagem é otimizada automaticamente.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">URL Direta da Imagem:</label>
                    <input
                      type="url"
                      value={selectedBlock.imageUrl || ''}
                      onChange={(e) => updateSelectedBlock({ imageUrl: e.target.value })}
                      placeholder="https://exemplo.com/imagem.png"
                      className="w-full p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Texto Alternativo (Alt):</label>
                    <input
                      type="text"
                      value={selectedBlock.imageAlt || ''}
                      onChange={(e) => updateSelectedBlock({ imageAlt: e.target.value })}
                      placeholder="Descrição da imagem para acessibilidade"
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Link ao Clicar (Opcional):</label>
                    <input
                      type="url"
                      value={selectedBlock.imageLink || ''}
                      onChange={(e) => updateSelectedBlock({ imageLink: e.target.value })}
                      placeholder="https://exemplo.com/promocao"
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>

                  {(selectedBlock.type === 'image' || selectedBlock.type === 'header_image') && (
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Largura da imagem (px):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={80}
                            max={1200}
                            step={1}
                            value={selectedBlock.imageWidthPx || 600}
                            onChange={(e) => updateSelectedBlock({ imageWidthPx: Math.max(80, Math.min(1200, Number(e.target.value) || 600)) })}
                            className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono"
                          />
                          <span className="text-[10px] text-slate-400 shrink-0">máx. 1200</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">A imagem mantém a proporção e se adapta ao espaço disponível no e-mail.</p>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Alinhamento:</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { value: 'left', label: 'Esquerda', Icon: AlignLeft },
                            { value: 'center', label: 'Centro', Icon: AlignCenter },
                            { value: 'right', label: 'Direita', Icon: AlignRight },
                          ].map(({ value, label, Icon }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => updateSelectedBlock({ alignment: value as EmailBlock['alignment'] })}
                              className={`py-2 rounded-lg border text-[10px] font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer ${selectedBlock.alignment === value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700">Cor de fundo do bloco:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedBlock.bgColor || '#ffffff'}
                              onChange={(e) => updateSelectedBlock({ bgColor: e.target.value })}
                              className="w-7 h-7 rounded cursor-pointer border border-slate-300 p-0"
                            />
                            <span className="font-mono text-[10px] text-slate-500 uppercase">{selectedBlock.bgColor || '#ffffff'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {COLOR_PRESETS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => updateSelectedBlock({ bgColor: color })}
                              className="w-5 h-5 rounded-md border border-slate-300 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">A cor aparece no espaço ao redor da imagem quando ela não ocupa toda a largura do bloco.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Block */}
              {selectedBlock.type === 'coupon' && (
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Código do Cupom:</label>
                    <input
                      type="text"
                      value={selectedBlock.couponCode || ''}
                      onChange={(e) => updateSelectedBlock({ couponCode: e.target.value.toUpperCase() })}
                      onPaste={(e) => handlePlainTextPaste(e, 'couponCode')}
                      placeholder="EX: ESTACIO30OFF"
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold uppercase tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Descrição do Desconto:</label>
                    <input
                      type="text"
                      value={selectedBlock.couponDiscount || ''}
                      onChange={(e) => updateSelectedBlock({ couponDiscount: e.target.value })}
                      onPaste={(e) => handlePlainTextPaste(e, 'couponDiscount')}
                      placeholder="30% DE DESCONTO NO PLANO ANUAL"
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Divider Block */}
              {selectedBlock.type === 'divider' && (
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Estilo da Linha:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => updateSelectedBlock({ dividerStyle: style })}
                        className={`py-1.5 text-xs font-semibold rounded-lg border capitalize transition-all cursor-pointer ${
                          selectedBlock.dividerStyle === style
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {style === 'solid' ? 'Sólido' : style === 'dashed' ? 'Tracejado' : 'Pontilhado'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Social Media Block */}
              {selectedBlock.type === 'social' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500">
                    Insira as URLs das redes da sua empresa:
                  </p>
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[11px]">Instagram:</label>
                    <input
                      type="url"
                      value={selectedBlock.instagramUrl || ''}
                      onChange={(e) => updateSelectedBlock({ instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/suaempresa"
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[11px]">WhatsApp:</label>
                    <input
                      type="url"
                      value={selectedBlock.whatsappUrl || ''}
                      onChange={(e) => updateSelectedBlock({ whatsappUrl: e.target.value })}
                      placeholder="https://wa.me/5521999999999"
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[11px]">LinkedIn:</label>
                    <input
                      type="url"
                      value={selectedBlock.linkedinUrl || ''}
                      onChange={(e) => updateSelectedBlock({ linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/company/suaempresa"
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Footer Block */}
              {selectedBlock.type === 'footer' && (
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block">Texto do Rodapé:</label>
                  <SelectableRichTextField
                    activeEditorRef={activeEditorRef}
                    value={selectedBlock.footerText || ''}
                    onChange={(value) => updateSelectedBlock({ footerText: value })}
                    onSelectionChange={onRichTextSelectionChange}
                    placeholder="Você está recebendo este e-mail..."
                    minHeight="100px"
                  />
                </div>
              )}

              {selectedBlock.type === 'columns' && (
                <ColumnsEditor
                  block={selectedBlock}
                  onChange={updateSelectedBlock}
                  onUploadImage={onUploadImageFile || (async () => null)}
                />
              )}

              {/* Personalizar com dados do contato + link no texto */}
              {selectedBlock.type !== 'divider' && selectedBlock.type !== 'image' && selectedBlock.type !== 'header_image' && selectedBlock.type !== 'social' && selectedBlock.type !== 'columns' && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="space-y-2">
                    <label className="font-bold text-slate-700 block">Personalizar com dados do contato:</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {EMAIL_VARIABLES.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          title={variable.description}
                          onClick={() => insertVariableToSelectedBlock(variable.tag)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-mono text-[11px] transition-colors cursor-pointer active:scale-95"
                        >
                          + {variable.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenLinkModal}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Link className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Inserir / Editar Link no Texto</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            SECTION 2: ESTILO & CORES (Style & Typography)
        ========================================================================= */}
        <div className="border-b border-slate-100">
          <button
            type="button"
            onClick={() => toggleSection('style')}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              <span>Aparência</span>
            </div>
            {openSections.style ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.style && (
            <div className="px-4 pb-4 pt-1 space-y-4 text-xs animate-fadeIn">
              {hasRichTextSelection && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-700">
                    <Type className="w-3.5 h-3.5" />
                    <span>Texto selecionado</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Cor, tamanho e formatação serão aplicados somente ao trecho selecionado.</p>
                </div>
              )}

              {/* Color Customization */}
              {selectedBlock.type !== 'divider' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Cor do Texto / Título:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedBlock[getTextColorField()] || '#1e293b'}
                        onMouseDown={() => activeEditorRef.current?.saveSelection()}
                        onChange={(e) => applyTextColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                      />
                      <span className="font-mono text-[11px] text-slate-500 uppercase">
                        {selectedBlock[getTextColorField()] || '#1e293b'}
                      </span>
                    </div>
                  </div>

                  {/* Preset quick colors */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onMouseDown={() => activeEditorRef.current?.saveSelection()}
                        onClick={() => applyTextColor(color)}
                        className="w-5 h-5 rounded-md border border-slate-300 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Background Color Customization (for Header, Button, Coupon, Footer, Divider) */}
              {(selectedBlock.type === 'header' ||
                selectedBlock.type === 'header_text' ||
                selectedBlock.type === 'button' ||
                selectedBlock.type === 'coupon' ||
                selectedBlock.type === 'footer' ||
                selectedBlock.type === 'divider') && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      {selectedBlock.type === 'divider' ? 'Cor da Linha:' : 'Cor de Fundo:'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          selectedBlock.headerBgColor ||
                          selectedBlock.buttonBgColor ||
                          selectedBlock.couponBgColor ||
                          selectedBlock.footerBgColor ||
                          selectedBlock.dividerColor ||
                          '#4f46e5'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (selectedBlock.type === 'header' || selectedBlock.type === 'header_text') {
                            updateSelectedBlock({ headerBgColor: val });
                          } else if (selectedBlock.type === 'button') {
                            updateSelectedBlock({ buttonBgColor: val });
                          } else if (selectedBlock.type === 'coupon') {
                            updateSelectedBlock({ couponBgColor: val });
                          } else if (selectedBlock.type === 'footer') {
                            updateSelectedBlock({ footerBgColor: val });
                          } else if (selectedBlock.type === 'divider') {
                            updateSelectedBlock({ dividerColor: val });
                          }
                        }}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                      />
                      <span className="font-mono text-[11px] text-slate-500 uppercase">
                        {selectedBlock.headerBgColor ||
                          selectedBlock.buttonBgColor ||
                          selectedBlock.couponBgColor ||
                          selectedBlock.footerBgColor ||
                          selectedBlock.dividerColor ||
                          '#4f46e5'}
                      </span>
                    </div>
                  </div>

                  {/* Preset quick colors for background */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          if (selectedBlock.type === 'header' || selectedBlock.type === 'header_text') {
                            updateSelectedBlock({ headerBgColor: color });
                          } else if (selectedBlock.type === 'button') {
                            updateSelectedBlock({ buttonBgColor: color });
                          } else if (selectedBlock.type === 'coupon') {
                            updateSelectedBlock({ couponBgColor: color });
                          } else if (selectedBlock.type === 'footer') {
                            updateSelectedBlock({ footerBgColor: color });
                          } else if (selectedBlock.type === 'divider') {
                            updateSelectedBlock({ dividerColor: color });
                          }
                        }}
                        className="w-5 h-5 rounded-md border border-slate-300 hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Typography Size Slider & Number Input */}
              {selectedBlock.type !== 'divider' && selectedBlock.type !== 'image' && selectedBlock.type !== 'header_image' && selectedBlock.type !== 'social' && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Tamanho da Fonte:</label>
                    <span className="font-mono font-bold text-indigo-600">
                      {selectedBlock.fontSizePx || 16}px
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={48}
                      value={selectedBlock.fontSizePx || 16}
                      onMouseDown={() => activeEditorRef.current?.saveSelection()}
                      onChange={(e) => applyFontSize(Number(e.target.value))}
                      className="flex-grow accent-indigo-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={10}
                      max={48}
                      value={selectedBlock.fontSizePx || 16}
                      onMouseDown={() => activeEditorRef.current?.saveSelection()}
                      onChange={(e) => applyFontSize(Number(e.target.value))}
                      className="w-14 p-1 rounded-md border border-slate-300 text-center font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Text Alignment Controls */}
              {selectedBlock.type !== 'divider' && selectedBlock.type !== 'image' && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">Alinhamento:</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                    {[
                      { align: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, title: 'Esquerda' },
                      { align: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, title: 'Centro' },
                      { align: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, title: 'Direita' },
                    ].map((item) => (
                      <button
                        key={item.align}
                        type="button"
                        onClick={() => updateSelectedBlock({ alignment: item.align as any })}
                        className={`py-1.5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                          (selectedBlock.alignment || 'left') === item.align
                            ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title={item.title}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Style Toggles (Bold, Italic, Underline, Strikethrough) */}
              {selectedBlock.type !== 'divider' && selectedBlock.type !== 'image' && selectedBlock.type !== 'columns' && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">Estilo do Texto:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); activeEditorRef.current?.saveSelection(); }}
                      onClick={() => applyFormattingToSelection('bold')}
                      className={`p-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedBlock.isBold
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title="Negrito"
                    >
                      <Bold className="w-3.5 h-3.5" />
                      <span>B</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); activeEditorRef.current?.saveSelection(); }}
                      onClick={() => applyFormattingToSelection('italic')}
                      className={`p-1.5 rounded-lg border text-xs font-medium italic flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedBlock.isItalic
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title="Itálico"
                    >
                      <Italic className="w-3.5 h-3.5" />
                      <span>I</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); activeEditorRef.current?.saveSelection(); }}
                      onClick={() => applyFormattingToSelection('underline')}
                      className={`p-1.5 rounded-lg border text-xs underline flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedBlock.isUnderline
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title="Sublinhado"
                    >
                      <Underline className="w-3.5 h-3.5" />
                      <span>U</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Largura do botão: opção mais usada em botões, fica visível */}
              {/* Button Width Mode */}
              {selectedBlock.type === 'button' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Largura do Botão:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateSelectedBlock({ buttonWidth: 'auto' })}
                      className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        (selectedBlock.buttonWidth || 'auto') === 'auto'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Automático (Ajustado)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedBlock({ buttonWidth: 'full' })}
                      className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        selectedBlock.buttonWidth === 'full'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      100% (Largura Total)
                    </button>
                  </div>
                </div>
              )}

              {/* Mais opções de texto: recolhido por padrão */}
              {selectedBlock.type !== 'divider' && selectedBlock.type !== 'image' && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => toggleSection('layout')}
                    className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Mais opções de texto</span>
                    {openSections.layout ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                  {openSections.layout && (
                    <div className="pt-3 space-y-4 animate-fadeIn">
              {/* Line Height (for Text and Title) */}
              {(selectedBlock.type === 'text' || selectedBlock.type === 'title' || selectedBlock.type === 'subtitle') && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Espaçamento Entre Linhas (Line-height):</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['1.2', '1.4', '1.6', '1.8'].map((lh) => (
                      <button
                        key={lh}
                        type="button"
                        onClick={() => updateSelectedBlock({ lineHeight: lh })}
                        className={`py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                          (selectedBlock.lineHeight || '1.5') === lh
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {lh}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Transform (Uppercase, Lowercase, Capitalize) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">Transformação de Texto:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'none', label: 'Normal' },
                      { id: 'uppercase', label: 'MAIÚSCULO' },
                      { id: 'capitalize', label: 'Primeiras' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSelectedBlock({ textTransform: opt.id as any })}
                        className={`py-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                          (selectedBlock.textTransform || 'none') === opt.id
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

              {/* Font Family Selection */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">Fonte Segura para E-mail:</label>
                  <select
                    value={selectedBlock.fontFamily || 'Helvetica, Arial, sans-serif'}
                    onMouseDown={() => activeEditorRef.current?.saveSelection()}
                    onChange={(e) => applyFontFamily(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <LinkEditorModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        linkText={linkText}
        setLinkText={setLinkText}
        linkUrl={linkUrl}
        setLinkUrl={setLinkUrl}
        onSaveLink={onSaveLink}
        onRemoveLink={onRemoveLink}
      />
    </div>
  );
};
