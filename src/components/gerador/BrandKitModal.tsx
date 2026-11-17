import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Paintbrush, Upload, X } from 'lucide-react';
import type { BrandKit } from '../../utils/brandKit';
import { DEFAULT_BRAND_KIT, normalizeBrandKit } from '../../utils/brandKit';
import { contrastRatio, readableTextOn } from '../../utils/color';
import { normalizeLinkInput } from './ColumnsEditor';

interface BrandKitModalProps {
  isOpen: boolean;
  kit: BrandKit;
  isLoading?: boolean;
  loadError?: string | null;
  onClose: () => void;
  /** Saves the kit; when `applyToEmail` is true the current e-mail is recolored too. */
  onSave: (kit: BrandKit, applyToEmail: boolean) => Promise<void>;
  onUploadImage: (file: File) => Promise<string | null>;
}

const FONT_OPTIONS = [
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const COLOR_FIELDS: Array<{ key: 'headerBgColor' | 'buttonColor' | 'headingColor' | 'textColor'; label: string; hint: string; onWhite: boolean }> = [
  { key: 'headerBgColor', label: 'Cabeçalho', hint: 'Fundo dos banners', onWhite: false },
  { key: 'buttonColor', label: 'Botões', hint: 'Fundo dos botões e destaque do cupom', onWhite: false },
  { key: 'headingColor', label: 'Títulos', hint: 'Cor dos títulos', onWhite: true },
  { key: 'textColor', label: 'Textos', hint: 'Parágrafos e subtítulos', onWhite: true },
];

const SOCIAL_FIELDS: Array<{ key: 'instagramUrl' | 'whatsappUrl' | 'linkedinUrl' | 'facebookUrl' | 'websiteUrl'; label: string; placeholder: string }> = [
  { key: 'websiteUrl', label: 'Site', placeholder: 'https://www.suaempresa.com.br' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/suaempresa' },
  { key: 'whatsappUrl', label: 'WhatsApp', placeholder: 'https://wa.me/5521999999999' },
  { key: 'linkedinUrl', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/suaempresa' },
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/suaempresa' },
];

export const BrandKitModal: React.FC<BrandKitModalProps> = ({ isOpen, kit, isLoading, loadError, onClose, onSave, onUploadImage }) => {
  const [draft, setDraft] = useState<BrandKit>(kit);
  const [saving, setSaving] = useState<'save' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(kit);
      setError(null);
    }
  }, [isOpen, kit]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, saving]);

  if (!isOpen) return null;

  const set = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async (apply: boolean) => {
    setSaving(apply ? 'apply' : 'save');
    setError(null);
    try {
      const cleaned = normalizeBrandKit({
        ...draft,
        ...Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, normalizeLinkInput(draft[key])])),
      });
      await onSave(cleaned, apply);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o kit da marca.');
    } finally {
      setSaving(null);
    }
  };

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) set('logoUrl', url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-label="Kit da marca" className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Paintbrush className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Kit da marca</h2>
              <p className="text-xs text-slate-500">Configure uma vez; os blocos novos já nascem com estas cores, fonte e links.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando seu kit…</div>
          )}
          {loadError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{loadError}</div>}

          <section className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Cores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COLOR_FIELDS.map(({ key, label, hint, onWhite }) => {
                const ratio = onWhite ? contrastRatio(draft[key], '#ffffff') : null;
                return (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <input type="color" value={draft[key]} onChange={(e) => set(key, e.target.value)} className="w-9 h-9 rounded cursor-pointer border border-slate-300 p-0 shrink-0" aria-label={label} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700">{label} <span className="font-mono font-normal text-slate-400 uppercase">{draft[key]}</span></p>
                      <p className="text-[11px] text-slate-500">{hint}</p>
                      {!onWhite && (
                        <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: draft[key], color: readableTextOn(draft[key]) }}>Texto de exemplo</span>
                      )}
                      {ratio !== null && ratio < 4.5 && <p className="text-[10px] text-amber-700 mt-0.5">Pouco contraste com fundo branco ({ratio.toFixed(1)}:1).</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Fonte</h3>
            <select value={draft.fontFamily} onChange={(e) => set('fontFamily', e.target.value)} className="w-full p-2 rounded-lg border border-slate-300 bg-white">
              {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <p className="text-[11px] text-slate-500">Só fontes que aparecem iguais em todos os programas de e-mail.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Logo</h3>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadLogo} />
            <div className="flex items-center gap-3">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt="Logo" className="h-12 max-w-[160px] object-contain rounded border border-slate-200 bg-white p-1" />
              ) : (
                <div className="h-12 w-28 rounded border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">Sem logo</div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {draft.logoUrl ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {draft.logoUrl && (
                <button type="button" onClick={() => set('logoUrl', '')} className="text-rose-600 font-semibold hover:underline cursor-pointer">Remover</button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Usada no bloco "Imagem do cabeçalho". Prefira PNG com fundo branco, porque fundo transparente pode sumir no modo escuro.</p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Site e redes sociais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                <label key={key} className="space-y-0.5">
                  <span className="font-semibold text-slate-600 text-[11px]">{label}</span>
                  <input type="text" value={draft[key]} onChange={(e) => set(key, e.target.value)} onBlur={(e) => set(key, normalizeLinkInput(e.target.value))} placeholder={placeholder} className="w-full p-2 rounded-lg border border-slate-300 font-mono" />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-800 text-sm">Texto padrão do rodapé</h3>
            <textarea value={draft.footerText} onChange={(e) => set('footerText', e.target.value)} rows={3} className="w-full p-2 rounded-lg border border-slate-300 resize-none" />
          </section>

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setDraft({ ...DEFAULT_BRAND_KIT })} className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">Restaurar padrão</button>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void submit(false)} disabled={saving !== null} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer disabled:opacity-60">
              {saving === 'save' ? 'Salvando…' : 'Salvar kit'}
            </button>
            <button type="button" onClick={() => void submit(true)} disabled={saving !== null} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-60">
              {saving === 'apply' ? 'Aplicando…' : 'Salvar e aplicar neste e-mail'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
