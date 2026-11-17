import React, { useState } from 'react';
import { EmailBlock } from '../../types';
import { getDefaultBlockFontSize } from '../../utils/compiler';
import { LinkEditorModal } from './LinkEditorModal';

interface FormattingToolbarProps {
  selectedBlock: EmailBlock;
  updateSelectedBlock: (updatedProps: Partial<EmailBlock>) => void;
  applyFormattingToSelection: (
    formatType: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'color' | 'fontSize' | 'clear' | 'variable' | 'link' | 'unlink',
    formatValue?: string | number,
    colorTargetKey?: 'textColor' | 'headerTextColor' | 'buttonTextColor' | 'footerTextColor'
  ) => void;
  insertVariableToSelectedBlock: (varName: string) => void;
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
  options?: {
    showTextColor?: boolean;
    showBgColor?: boolean;
    showAlign?: boolean;
    showFontFamily?: boolean;
    showLineHeight?: boolean;
    defaultColorKey?: 'textColor' | 'headerTextColor' | 'buttonTextColor' | 'footerTextColor';
    defaultBgKey?: 'bgColor' | 'headerBgColor' | 'buttonBgColor' | 'footerBgColor';
  };
}

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  selectedBlock,
  updateSelectedBlock,
  applyFormattingToSelection,
  insertVariableToSelectedBlock,
  activeSelection,
  linkModalOpen,
  setLinkModalOpen,
  linkText,
  setLinkText,
  linkUrl,
  setLinkUrl,
  onSaveLink,
  onRemoveLink,
  handleOpenLinkModal,
  options = {},
}) => {
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState<boolean>(false);

  const {
    showTextColor = true,
    showBgColor = true,
    showAlign = true,
    showFontFamily = true,
    showLineHeight = true,
    defaultColorKey = 'textColor',
    defaultBgKey = 'bgColor',
  } = options;

  const currentTextColor = (selectedBlock as any)[defaultColorKey] || selectedBlock.textColor || '#334155';
  const currentBgColor = (selectedBlock as any)[defaultBgKey] || selectedBlock.bgColor || '#ffffff';
  const defaultBlockSize = getDefaultBlockFontSize(selectedBlock.type);
  const currentFontSize = selectedBlock.fontSizePx || defaultBlockSize;
  const currentAlign = selectedBlock.alignment || 'left';

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-indigo-600">format_paint</span>
          <span>Estilização de Texto & Tipografia</span>
        </span>
        <span className="text-[11px] text-slate-400 font-medium">Selecione um texto para formatar apenas o trecho</span>
      </div>

      {/* Active Selection Info Badge */}
      {activeSelection && activeSelection.start < activeSelection.end && (
        <div className="bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg flex items-center justify-between text-xs text-indigo-900 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-medium truncate">
            <span className="material-symbols-outlined text-[16px] text-indigo-600">match_case</span>
            <span>Texto Selecionado:</span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-bold font-mono text-indigo-700 truncate max-w-xs">
              "{activeSelection.selectedText.replace(/<[^>]*>/g, '')}"
            </code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOpenLinkModal}
              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] rounded font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Inserir um hiperlink no texto selecionado"
            >
              <span className="material-symbols-outlined text-[14px]">link</span>
              <span>+ Inserir Link</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormattingToSelection('clear')}
              className="px-2 py-0.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 text-[11px] rounded font-bold transition-colors cursor-pointer"
              title="Remover tags HTML do texto selecionado"
            >
              Limpar Formatação
            </button>
          </div>
        </div>
      )}

      {/* Inline Link Editor Modal */}
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

      {/* Essential Format Toolbar (Always Visible) */}
      <div className="flex flex-wrap items-center gap-2.5 bg-slate-100/90 p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Style Buttons & Link */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormattingToSelection('bold')}
              className={`w-7 h-7 rounded-lg font-black text-xs transition-colors flex items-center justify-center cursor-pointer ${
                selectedBlock.isBold ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Negrito"
            >
              B
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormattingToSelection('italic')}
              className={`w-7 h-7 rounded-lg italic font-serif text-xs transition-colors flex items-center justify-center cursor-pointer ${
                selectedBlock.isItalic ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Itálico"
            >
              I
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormattingToSelection('underline')}
              className={`w-7 h-7 rounded-lg underline font-bold text-xs transition-colors flex items-center justify-center cursor-pointer ${
                selectedBlock.isUnderline ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Sublinhado"
            >
              U
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyFormattingToSelection('strikethrough')}
              className={`w-7 h-7 rounded-lg line-through font-bold text-xs transition-colors flex items-center justify-center cursor-pointer ${
                selectedBlock.isStrikethrough ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Tachado"
            >
              S
            </button>
          </div>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenLinkModal}
            className="h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
            title="Inserir / Editar Link no Texto"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-500">link</span>
            <span>Link</span>
          </button>

          {/* Quick Font Size Selector in Main Toolbar */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 h-9 rounded-xl border border-slate-200/90 shadow-2xs shrink-0" title="Tamanho da fonte">
            <span className="material-symbols-outlined text-[16px] text-slate-500">format_size</span>
            <select
              value={currentFontSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) updateSelectedBlock({ fontSizePx: val });
              }}
              className="text-xs font-bold text-indigo-700 bg-indigo-50/70 border border-indigo-200/70 rounded-lg px-2 py-0.5 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
            >
              {[10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}px {sz === defaultBlockSize ? ' (Padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Color Picker in Main Toolbar */}
          {showTextColor && (
            <div className="flex flex-wrap items-center gap-1.5 bg-white px-2.5 py-1 min-h-[36px] rounded-xl border border-slate-200/90 shadow-2xs max-w-full" title="Cor do texto">
              <div className="flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-[16px] text-slate-500">palette</span>
                <input
                  type="color"
                  value={currentTextColor}
                  onChange={(e) => applyFormattingToSelection('color', e.target.value, defaultColorKey)}
                  className="w-6 h-6 p-0 border border-slate-300 rounded cursor-pointer bg-white"
                  title="Escolher cor personalizada"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {['#ffffff', '#1e1b4b', '#334155', '#dc2626', '#16a34a', '#2563eb'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormattingToSelection('color', hex, defaultColorKey)}
                    className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 shadow-2xs cursor-pointer ${
                      currentTextColor.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-indigo-500 ring-offset-1 border-indigo-600' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={`Aplicar cor ${hex}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alignment Controls */}
        {showAlign && (
          <div className="flex items-center gap-0.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs sm:ml-auto shrink-0">
            <button
              type="button"
              onClick={() => updateSelectedBlock({ alignment: 'left' })}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                currentAlign === 'left' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Esquerda"
            >
              <span className="material-symbols-outlined text-[16px]">format_align_left</span>
            </button>
            <button
              type="button"
              onClick={() => updateSelectedBlock({ alignment: 'center' })}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                currentAlign === 'center' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Centralizado"
            >
              <span className="material-symbols-outlined text-[16px]">format_align_center</span>
            </button>
            <button
              type="button"
              onClick={() => updateSelectedBlock({ alignment: 'right' })}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                currentAlign === 'right' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Direita"
            >
              <span className="material-symbols-outlined text-[16px]">format_align_right</span>
            </button>
            <button
              type="button"
              onClick={() => updateSelectedBlock({ alignment: 'justify' })}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                currentAlign === 'justify' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Justificado"
            >
              <span className="material-symbols-outlined text-[16px]">format_align_justify</span>
            </button>
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <button
          type="button"
          onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
          className="px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 shadow-2xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-indigo-600">tune</span>
          <span>Configurações Avançadas</span>
          <span className="material-symbols-outlined text-[18px] text-slate-400">
            {isAdvancedSettingsOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {/* Collapsible Advanced Settings Accordion */}
      {isAdvancedSettingsOpen && (
        <div className="bg-slate-50 border border-slate-200/90 p-4 rounded-2xl space-y-4 shadow-2xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">tune</span>
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                Configurações Avançadas (Tamanho, Cores, Fontes)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAdvancedSettingsOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">expand_less</span>
            </button>
          </div>

          {/* Fixed Typography Size Selector Box */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-600">format_size</span>
                <span>Tamanho da Fonte Fixo / Tipografia do Bloco:</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md font-mono">
                  {currentFontSize}px
                </span>
                {selectedBlock.fontSizePx && selectedBlock.fontSizePx !== defaultBlockSize && (
                  <button
                    type="button"
                    onClick={() => updateSelectedBlock({ fontSizePx: defaultBlockSize })}
                    className="text-[10px] text-slate-500 hover:text-indigo-600 font-semibold underline cursor-pointer"
                    title="Restaurar tamanho padrão"
                  >
                    Restaurar Padrão ({defaultBlockSize}px)
                  </button>
                )}
              </div>
            </div>

            {/* Fixed Sizes Buttons Grid */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { sz: 10, label: '10px' },
                { sz: 12, label: '12px' },
                { sz: 14, label: '14px' },
                { sz: 15, label: '15px' },
                { sz: 16, label: '16px' },
                { sz: 18, label: '18px' },
                { sz: 20, label: '20px' },
                { sz: 22, label: '22px' },
                { sz: 24, label: '24px' },
                { sz: 28, label: '28px' },
                { sz: 32, label: '32px' },
                { sz: 36, label: '36px' },
                { sz: 40, label: '40px' },
                { sz: 48, label: '48px' },
              ].map(({ sz, label }) => {
                const isActive = currentFontSize === sz;
                const isDefault = sz === defaultBlockSize;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateSelectedBlock({ fontSizePx: sz })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white font-bold border-indigo-700 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title={`${label}${isDefault ? ' (Padrão para este bloco)' : ''}`}
                  >
                    {label}
                    {isDefault && <span className="text-[9px] opacity-75 ml-0.5">•</span>}
                  </button>
                );
              })}
            </div>

            {/* Semantic Scale Select Dropdown */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-semibold shrink-0">Escala de Uso:</span>
              <select
                value={currentFontSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) updateSelectedBlock({ fontSizePx: val });
                }}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white cursor-pointer"
              >
                <option value={10}>10px - Microtexto / Avisos legais</option>
                <option value={12}>12px - Rodapé / Informações de contato</option>
                <option value={14}>14px - Texto Compacto / Secundário</option>
                <option value={15}>15px - Padrão Parágrafo (Corpo do E-mail)</option>
                <option value={16}>16px - Texto Médio / Botão CTA</option>
                <option value={18}>18px - Subtítulo / Destaque Suave</option>
                <option value={20}>20px - Subtítulo Médio</option>
                <option value={22}>22px - Destaque Comercial / Cupom</option>
                <option value={24}>24px - Subtítulo Forte / Título H3</option>
                <option value={28}>28px - Título de Seção / Banner Padrão</option>
                <option value={32}>32px - Título Principal / Grande Impacto</option>
                <option value={36}>36px - Banner Grande</option>
                <option value={40}>40px - Super Destaque</option>
                <option value={48}>48px - Banner Gigante</option>
              </select>
            </div>
          </div>

          {/* 2-Column Grid of Advanced Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Família da Fonte */}
            {showFontFamily && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Família da Fonte:</label>
                <select
                  value={selectedBlock.fontFamily || 'Helvetica, Arial, sans-serif'}
                  onChange={(e) => updateSelectedBlock({ fontFamily: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 cursor-pointer"
                >
                  <option value="Helvetica, Arial, sans-serif">Helvetica / Arial (E-mail padrão)</option>
                  <option value="Georgia, serif">Georgia (Serifada)</option>
                  <option value="'Times New Roman', Times, serif">Times New Roman</option>
                  <option value="'Courier New', Courier, monospace">Courier New</option>
                  <option value="Verdana, Geneva, sans-serif">Verdana</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                </select>
              </div>
            )}

            {/* Altura da Linha */}
            {showLineHeight && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Altura da Linha:</label>
                <select
                  value={selectedBlock.lineHeight || '1.4'}
                  onChange={(e) => updateSelectedBlock({ lineHeight: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 cursor-pointer"
                >
                  <option value="1.2">Compacto (1.2)</option>
                  <option value="1.4">Normal (1.4)</option>
                  <option value="1.6">Confortável (1.6)</option>
                  <option value="1.8">Espaçado (1.8)</option>
                  <option value="2.0">Duplo (2.0)</option>
                </select>
              </div>
            )}

            {/* Estilo de Caixa */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Estilo de Caixa:</label>
              <select
                value={selectedBlock.textTransform || 'none'}
                onChange={(e) => updateSelectedBlock({ textTransform: e.target.value as any })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white font-medium text-slate-800 cursor-pointer"
              >
                <option value="none">Normal (Padrão)</option>
                <option value="uppercase">MAIÚSCULAS</option>
                <option value="lowercase">minúsculas</option>
                <option value="capitalize">Primeira Maiúscula</option>
              </select>
            </div>

            {/* Cor do Texto */}
            {showTextColor && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Cor do Texto:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentTextColor}
                    onChange={(e) => applyFormattingToSelection('color', e.target.value, defaultColorKey)}
                    className="w-9 h-8 p-0.5 border border-slate-300 rounded-lg cursor-pointer bg-white"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['#ffffff', '#1e1b4b', '#0f172a', '#334155', '#dc2626', '#16a34a', '#2563eb', '#0284c7'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyFormattingToSelection('color', hex, defaultColorKey)}
                        className="w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110 shadow-2xs cursor-pointer"
                        style={{ backgroundColor: hex }}
                        title={`Cor ${hex}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cor de Fundo do Bloco */}
            {showBgColor && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Cor de Fundo do Bloco:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentBgColor}
                    onChange={(e) => updateSelectedBlock({ [defaultBgKey]: e.target.value } as any)}
                    className="w-9 h-8 p-0.5 border border-slate-300 rounded-lg cursor-pointer bg-white"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['#1e1b4b', '#ffffff', '#f8fafc', '#f1f5f9', '#e0e7ff', '#f0fdf4', '#fef2f2', '#fffbeb', '#0284c7', '#0f172a'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updateSelectedBlock({ [defaultBgKey]: hex } as any)}
                        className="w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110 shadow-2xs cursor-pointer"
                        style={{ backgroundColor: hex }}
                        title={`Fundo: ${hex}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Atalhos de Variáveis */}
          <div className="pt-3 border-t border-slate-200/80 space-y-2">
            <label className="block text-xs font-bold text-slate-700">Atalhos de Variáveis:</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['{{nome}}', '{{email}}', '{{empresa}}', '{{var1}}', '{{var2}}'].map((vName) => (
                <button
                  key={vName}
                  type="button"
                  onClick={() => insertVariableToSelectedBlock(vName)}
                  className="px-3 py-1 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 text-xs font-mono font-bold rounded-lg transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  {vName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
