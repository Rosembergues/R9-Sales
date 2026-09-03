import React, { useState } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { CampaignField } from '../../types';
import { X, FileSpreadsheet, Plus, Trash2, CheckCircle2, Sliders, Sparkles } from 'lucide-react';

interface CreateCampaignModalProps {
  onClose: () => void;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ onClose }) => {
  const { createCampaign } = useSales();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [commissionRate, setCommissionRate] = useState('5.0');
  const [targetAmount, setTargetAmount] = useState('150000');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  
  // Custom form fields builder
  const [fields, setFields] = useState<CampaignField[]>([
    {
      id: 'f_client_doc',
      label: 'CNPJ / CPF do Cliente',
      type: 'text',
      required: true,
      placeholder: '00.000.000/0001-00',
    },
    {
      id: 'f_category',
      label: 'Linha de Produto',
      type: 'select',
      required: true,
      options: ['Software / SaaS', 'Consultoria Especializada', 'Hardware / Infraestrutura', 'Suporte VIP'],
    }
  ]);

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'currency'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CampaignField = {
      id: `f_${Date.now().toString().slice(-6)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      options: newFieldType === 'select' 
        ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
        : undefined,
    };

    setFields([...fields, newField]);
    setNewFieldLabel('');
    setNewFieldOptions('');
  };

  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) {
      setError('Título e código da campanha são obrigatórios.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createCampaign({
      title: title.trim(),
      description: description.trim(),
      code: code.trim().toUpperCase(),
      active: true,
      commission_rate: Number(commissionRate) || 5.0,
      target_amount: Number(targetAmount) || 100000,
      start_date: startDate,
      end_date: endDate,
      fields,
      created_by: currentUser?.id || '',
    });

    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Erro ao criar campanha.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk']">
                Nova Campanha e Formulário de Vendas
              </h3>
              <p className="text-xs text-slate-500">
                Configure os campos dinâmicos que os vendedores preencherão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Campanha / Formulário *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Campanha Expansão Varejo 2026"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código Único *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="EX: VAREJO-2026"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono uppercase placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição & Instruções aos Vendedores
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique o objetivo da campanha e as regras de lançamento..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comissão (%)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meta Global (R$)
              </label>
              <input
                type="number"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Início
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fim
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dynamic Fields Section */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Campos Personalizados do Formulário
              </span>
              <span className="text-[11px] text-slate-500">{fields.length} campos definidos</span>
            </div>

            {/* Existing fields list */}
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-slate-900">{f.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-medium border border-indigo-200">
                      {f.type}
                    </span>
                    {f.required && (
                      <span className="text-[10px] text-rose-600 font-bold">*Obrigatório</span>
                    )}
                    {f.options && (
                      <span className="text-[10px] text-slate-500">({f.options.length} opções)</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(f.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new field mini-form */}
            <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 space-y-2.5">
              <p className="text-[11px] font-semibold text-slate-700">Adicionar Novo Campo ao Formulário:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="Nome do Campo (ex: CNPJ, Canal, etc.)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="sm:col-span-5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />

                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as any)}
                  className="sm:col-span-3 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="text">Texto Curto</option>
                  <option value="number">Número</option>
                  <option value="select">Seleção (Dropdown)</option>
                  <option value="currency">Moeda / Valor</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddField}
                  className="sm:col-span-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Inserir Campo</span>
                </button>
              </div>

              {newFieldType === 'select' && (
                <input
                  type="text"
                  placeholder="Opções separadas por vírgula (ex: Opção 1, Opção 2, Opção 3)"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs disabled:opacity-50"
            >
              {loading ? 'Criando Campanha...' : 'Salvar & Ativar Campanha'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
