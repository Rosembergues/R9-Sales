import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Task, CustomFieldValue } from '../types.ts';

interface TaskCompletionModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirmComplete: (taskId: string, filledValues: CustomFieldValue[]) => Promise<void> | void;
}

function TaskCompletionModalContent({
  isOpen,
  task,
  onClose,
  onConfirmComplete,
}: TaskCompletionModalProps) {
  // Inicialização limpa: campos inicializados como '' (vazio), sem herdar valores fantasmas (como 5322) nem cache
  const [formValues, setFormValues] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    task.customFields?.forEach((field) => {
      initial[field.id] = '';
    });
    return initial;
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Garantir limpeza total de estado ao abrir novo modal ou alterar a tarefa
  useEffect(() => {
    if (isOpen && task) {
      const initial: Record<string, string | number> = {};
      task.customFields?.forEach((field) => {
        initial[field.id] = '';
      });
      setFormValues(initial);
      setValidationError(null);
    }
  }, [isOpen, task.id]);

  // Função para limpar/resetar o formulário manualmente
  const handleResetForm = () => {
    const initial: Record<string, string | number> = {};
    task.customFields?.forEach((field) => {
      initial[field.id] = '';
    });
    setFormValues(initial);
    setValidationError(null);
  };

  const handleInputChange = (fieldId: string, value: string, type: 'text' | 'number') => {
    setValidationError(null);
    if (type === 'number') {
      const trimmed = value.trim();
      if (trimmed === '') {
        setFormValues((prev) => ({ ...prev, [fieldId]: '' }));
      } else {
        const normalized = trimmed.replace(',', '.');
        const num = Number(normalized);
        // Garante que o número 0 ou positivo seja estritamente preservado e nunca decrementado indevidamente
        setFormValues((prev) => ({
          ...prev,
          [fieldId]: !isNaN(num) ? num : normalized,
        }));
      }
    } else {
      setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setValidationError(null);

    // Validar se todos os campos obrigatórios foram preenchidos
    const missingFields: string[] = [];
    const filledValues: CustomFieldValue[] = [];

    task.customFields?.forEach((field) => {
      const rawVal = formValues[field.id];
      const isNum = field.type === 'number';

      // Validação estrita: 0 (zero) é um valor válido! Apenas vazios '', null e undefined contam como não preenchido
      const isFilled = rawVal !== undefined && rawVal !== null && rawVal !== '';

      if (field.required && !isFilled) {
        missingFields.push(field.label);
      }

      if (isFilled) {
        if (isNum) {
          const normalized = typeof rawVal === 'string' ? rawVal.trim().replace(',', '.') : rawVal;
          const num = Number(normalized);
          if (isNaN(num)) {
            missingFields.push(`${field.label} (deve ser um número válido)`);
          } else {
            filledValues.push({
              fieldId: field.id,
              value: num, // Preserva explicitamente o número, inclusive 0
            });
          }
        } else {
          filledValues.push({
            fieldId: field.id,
            value: String(rawVal).trim(), // Textos limpos
          });
        }
      }
    });

    if (missingFields.length > 0) {
      setValidationError(
        `Preencha obrigatoriamente: ${missingFields.join(', ')} para concluir a ação.`
      );
      return;
    }

    // Auditoria e log de rastreabilidade de payload antes do envio
    console.log('[SUPABASE AUDIT - TASK COMPLETION MODAL PAYLOAD]', {
      taskId: task.id,
      taskTitle: task.title,
      capturedValues: formValues, // inclui o 0 explicitamente
      sanitizedFilledValues: filledValues,
      timestamp: new Date().toISOString(),
    });

    try {
      setIsSubmitting(true);
      await onConfirmComplete(task.id, filledValues);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar respostas no Supabase:', err);
      setValidationError(
        err?.message ||
          'Falha ao salvar respostas no Supabase. O formulário permanece aberto para você não perder os dados. Verifique a conexão e tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="completion-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="completion-modal-card"
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-gray-200 bg-emerald-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Concluir Ação Obrigatória
              </h3>
              <p className="text-[11px] text-gray-500 truncate max-w-[260px]">
                {task.title}
              </p>
            </div>
          </div>
        </div>

        {/* Formulário com Campos Customizados */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              O administrador configurou métricas/campos obrigatórios que devem ser preenchidos antes de marcar esta ação como <strong>Concluída</strong>.
            </p>
          </div>

          {validationError && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-medium text-gray-500">Campos obrigatórios</span>
              <button
                type="button"
                onClick={handleResetForm}
                disabled={isSubmitting}
                className="text-[11px] text-gray-500 hover:text-gray-800 flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                title="Limpar todos os campos digitados"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar campos</span>
              </button>
            </div>

            {task.customFields && task.customFields.length > 0 ? (
              task.customFields.map((field) => {
                const currentValue = formValues[field.id] !== undefined ? formValues[field.id] : '';

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      min={field.type === 'number' ? 0 : undefined}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      required={field.required}
                      placeholder={
                        field.placeholder ??
                        (field.type === 'number' ? '0' : 'Digite a resposta...')
                      }
                      value={currentValue}
                      onChange={(e) =>
                        handleInputChange(field.id, e.target.value, field.type)
                      }
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 bg-white"
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500 italic">
                Nenhum campo adicional necessário.
              </p>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleResetForm}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
            >
              Resetar valores
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando no Supabase...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar e Concluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}


// O conteúdo com hooks só é montado quando há tarefa para concluir.
// Evita alteração da ordem de hooks ao abrir/fechar o modal.
export default function TaskCompletionModal(props: TaskCompletionModalProps) {
  if (!props.isOpen || !props.task) return null;
  return <TaskCompletionModalContent key={props.task.id} {...props} />;
}
