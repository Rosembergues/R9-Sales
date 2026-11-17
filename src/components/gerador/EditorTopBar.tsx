import React, { useState } from 'react';
import { SignOutButton } from '../auth/SignOutButton';
import {
  Undo2,
  Redo2,
  Monitor,
  Smartphone,
  UploadCloud,
  Download,
  Edit2,
  ArrowLeft,
  Save,
  FolderOpen,
  ChevronDown,
  Paintbrush,
} from 'lucide-react';

interface EditorTopBarProps {
  subject: string;
  onSubjectChange: (newSubject: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  previewDevice: 'desktop' | 'mobile';
  setPreviewDevice: (device: 'desktop' | 'mobile') => void;
  lastSavedTime: string;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onNavigateHome: () => void;
  onSave: () => void;
  onOpenTemplates: () => void;
  saveStatus: 'saved' | 'saving' | 'dirty' | 'error';
  onSignOut: () => Promise<void>;
  onOpenBrandKit?: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  subject,
  onSubjectChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  previewDevice,
  setPreviewDevice,
  lastSavedTime,
  onOpenImportModal,
  onOpenExportModal,
  onNavigateHome,
  onSave,
  onOpenTemplates,
  saveStatus,
  onSignOut,
  onOpenBrandKit,
}) => {
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [tempSubject, setTempSubject] = useState(subject);
  const [isHtmlMenuOpen, setIsHtmlMenuOpen] = useState(false);
  const [isTemplatesMenuOpen, setIsTemplatesMenuOpen] = useState(false);

  const handleSaveSubject = () => {
    setIsEditingSubject(false);
    if (tempSubject.trim()) {
      onSubjectChange(tempSubject.trim());
    } else {
      setTempSubject(subject);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveSubject();
    } else if (e.key === 'Escape') {
      setTempSubject(subject);
      setIsEditingSubject(false);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200/90 px-3 md:px-5 flex items-center justify-between gap-2 z-30 select-none shrink-0 shadow-2xs">
      {/* Left: Branding, Home navigation & Email Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onNavigateHome}
          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Voltar ao início"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Editable Subject / Campaign Title */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-[200px] sm:max-w-[280px] md:max-w-xs">
          {isEditingSubject ? (
            <input
              type="text"
              autoFocus
              value={tempSubject}
              onChange={(e) => setTempSubject(e.target.value)}
              onBlur={handleSaveSubject}
              onKeyDown={handleKeyDown}
              className="px-2 py-0.5 text-xs font-semibold text-slate-800 border border-indigo-400 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
              placeholder="Assunto do e-mail..."
            />
          ) : (
            <div
              onClick={() => {
                setTempSubject(subject);
                setIsEditingSubject(true);
              }}
              className="flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer group min-w-0"
              title="Clique para editar o assunto/título do e-mail"
            >
              <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-slate-900">
                {subject || 'E-mail sem assunto'}
              </span>
              <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )}
        </div>

        {/* Persistence status */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-medium pl-1">
          <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500' : saveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : saveStatus === 'error' ? 'bg-red-500' : 'bg-slate-400'}`} />
          <span className={saveStatus === 'error' ? 'text-red-500' : 'text-slate-400'}>
            {saveStatus === 'saved' ? `Rascunho salvo na nuvem${lastSavedTime ? ` ${lastSavedTime}` : ''}` : saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'error' ? 'Falha ao salvar' : 'Alterações não salvas'}
          </span>
        </div>
      </div>

      {/* Center: Undo / Redo & Device Selector */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/80">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className={`p-1.5 rounded-md transition-all ${
              canUndo
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white shadow-2xs cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className={`p-1.5 rounded-md transition-all ${
              canRedo
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white shadow-2xs cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Device Switcher (Desktop 600px / Mobile 375px) */}
        <div className="flex items-center bg-slate-100/80 rounded-lg p-0.5 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              previewDevice === 'desktop'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 cursor-pointer'
            }`}
            title="Visualização no computador (600px)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Computador</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              previewDevice === 'mobile'
                ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 cursor-pointer'
            }`}
            title="Visualização no celular (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Celular</span>
          </button>
        </div>
      </div>

      {/* Right: E-mail management and export/import actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => { setIsTemplatesMenuOpen((open) => !open); setIsHtmlMenuOpen(false); }}
            aria-haspopup="menu"
            aria-expanded={isTemplatesMenuOpen}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Publicar um modelo ou abrir a biblioteca compartilhada"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Biblioteca</span><span className="sm:hidden">Modelos</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTemplatesMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isTemplatesMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar menu de templates"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setIsTemplatesMenuOpen(false)}
              />
              <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setIsTemplatesMenuOpen(false); onSave(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  <span><strong className="block text-xs">Salvar template</strong><span className="block text-[10px] font-normal text-slate-500">Publicar na biblioteca compartilhada</span></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setIsTemplatesMenuOpen(false); onOpenTemplates(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span><strong className="block text-xs">Abrir biblioteca</strong><span className="block text-[10px] font-normal text-slate-500">Consultar e usar modelos da equipe</span></span>
                </button>
                {onOpenBrandKit && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setIsTemplatesMenuOpen(false); onOpenBrandKit(); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <Paintbrush className="h-4 w-4" />
                    <span><strong className="block text-xs">Kit da marca</strong><span className="block text-[10px] font-normal text-slate-500">Cores, fonte, logo e redes padrão</span></span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Export is the primary action; importing remains available in the same menu. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setIsHtmlMenuOpen((open) => !open); setIsTemplatesMenuOpen(false); }}
            aria-haspopup="menu"
            aria-expanded={isHtmlMenuOpen}
            className="px-3 sm:px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Exportar o e-mail ou importar um HTML existente"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isHtmlMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isHtmlMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar menu HTML"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setIsHtmlMenuOpen(false)}
              />
              <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setIsHtmlMenuOpen(false); onOpenImportModal(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Importar HTML</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setIsHtmlMenuOpen(false); onOpenExportModal(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar HTML</span>
                </button>
              </div>
            </>
          )}
        </div>

        <SignOutButton
          onSignOut={onSignOut}
          compactOnMobile
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60 sm:px-3"
        />
      </div>
    </header>
  );
};
