import React, { FormEvent, useEffect, useState } from 'react';
import { BookOpen, LoaderCircle, X } from 'lucide-react';

interface SaveTemplateModalProps {
  isOpen: boolean;
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<boolean>;
}

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  initialName = '',
  initialDescription = '',
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Reset only when the modal opens. A library refresh during submission must not clear fields
    // or re-enable the submit button while the publish request is still running.
    // New publications intentionally start blank; edits use saved library metadata, not the editor title.
    setName(initialName);
    setDescription(initialDescription);
    setValidationError(null);
    setIsSubmitting(false);
    // initialName/initialDescription are snapshots for this opening and should not reset live form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanDescription = description.trim();

    if (!cleanName) {
      setValidationError('Informe um nome para o modelo.');
      return;
    }
    if (!cleanDescription) {
      setValidationError('Informe uma descrição para o modelo.');
      return;
    }
    if (cleanName.length > MAX_NAME_LENGTH) {
      setValidationError(`O nome deve ter até ${MAX_NAME_LENGTH} caracteres.`);
      return;
    }
    if (cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
      setValidationError(`A descrição deve ter até ${MAX_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    try {
      const saved = await onSubmit(cleanName, cleanDescription);
      if (saved) onClose();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Não foi possível publicar o modelo. Confira a conexão e tente novamente.';
      setValidationError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="save-template-title" className="text-base font-bold text-slate-900">Salvar na biblioteca</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Defina como este modelo será identificado e encontrado pela equipe.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="library-template-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Nome do modelo <span className="text-red-500">*</span></label>
            <input
              id="library-template-name"
              autoFocus
              required
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(event) => { setName(event.target.value); setValidationError(null); }}
              placeholder="Ex.: Campanha de rematrícula 2027.1"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50"
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">{name.length}/{MAX_NAME_LENGTH}</div>
          </div>

          <div>
            <label htmlFor="library-template-description" className="mb-1.5 block text-sm font-semibold text-slate-700">Descrição <span className="text-red-500">*</span></label>
            <textarea
              id="library-template-description"
              required
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={4}
              value={description}
              onChange={(event) => { setDescription(event.target.value); setValidationError(null); }}
              placeholder="Explique para que serve este modelo e quando a equipe deve utilizá-lo."
              disabled={isSubmitting}
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50"
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">{description.length}/{MAX_DESCRIPTION_LENGTH}</div>
          </div>

          {validationError && <p role="alert" className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700">{validationError}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={isSubmitting} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Publicando…' : 'Confirmar publicação'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
