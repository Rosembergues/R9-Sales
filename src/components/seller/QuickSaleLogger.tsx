import React, { useState, useEffect } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentMethod } from '../../types';
import { 
  Zap, 
  DollarSign, 
  User, 
  CreditCard, 
  ShoppingBag, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Building2,
  Calendar,
  Layers,
  HelpCircle
} from 'lucide-react';

export const QuickSaleLogger: React.FC = () => {
  const { activeCampaigns, addSale } = useSales();
  const { currentUser } = useAuth();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientDocument, setClientDocument] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [productName, setProductName] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{ value: number; commission: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default campaign
  useEffect(() => {
    if (activeCampaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(activeCampaigns[0].id);
    }
  }, [activeCampaigns, selectedCampaignId]);

  const currentCampaign = activeCampaigns.find(c => c.id === selectedCampaignId) || activeCampaigns[0];
  const commissionRate = currentCampaign ? currentCampaign.commission_rate : 5.0;
  const numValue = Number(saleValue) || 0;
  const calculatedCommission = (numValue * commissionRate) / 100;

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setErrorMessage('Informe o nome do cliente.');
      return;
    }
    if (numValue <= 0) {
      setErrorMessage('Informe um valor de venda válido.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await addSale({
      campaign_id: selectedCampaignId || (activeCampaigns[0]?.id || 'camp-default'),
      client_name: clientName.trim(),
      client_document: clientDocument.trim(),
      client_phone: clientPhone.trim(),
      client_email: clientEmail.trim(),
      product_name: productName.trim() || 'Serviço / Produto Corporativo',
      value: numValue,
      payment_method: paymentMethod,
      custom_data: customData,
      notes: notes.trim(),
    });

    setIsSubmitting(false);

    if (result.success && result.sale) {
      setSuccessBanner({
        value: result.sale.value,
        commission: result.sale.commission,
      });

      // Clear form for quick next sale
      setClientName('');
      setClientDocument('');
      setClientPhone('');
      setClientEmail('');
      setProductName('');
      setSaleValue('');
      setNotes('');
      setCustomData({});

      setTimeout(() => setSuccessBanner(null), 6000);
    } else {
      setErrorMessage(result.error || 'Erro ao registrar venda.');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 sm:p-6 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-['Space_Grotesk']">
              Lançamento Rápido de Venda
            </h2>
            <p className="text-xs text-slate-500">
              Interface ágil sem burocracia para registrar fechamentos em tempo real
            </p>
          </div>
        </div>

        {/* Campaign selector dropdown */}
        {activeCampaigns.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 hidden sm:inline">Campanha:</span>
            <select
              id="sale-campaign-selector"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
            >
              {activeCampaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.commission_rate}% comissão)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Success Celebration Banner */}
      {successBanner && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600 text-white font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Venda de R$ {successBanner.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrada com sucesso!
              </p>
              <p className="text-xs text-emerald-700">
                Sua comissão desta venda: <strong className="text-emerald-950">R$ {successBanner.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> • Metas e Ranking atualizados ao vivo!
              </p>
            </div>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-xs text-emerald-600 hover:text-emerald-900 font-medium">
            Fechar
          </button>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {/* Form Grid */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          
          {/* Nome do Cliente */}
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Cliente / Razão Social *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="sale-client-name"
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Banco Santander / Tech S.A."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Valor da Venda (R$) */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor da Venda (R$) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <input
                id="sale-value"
                type="number"
                step="0.01"
                required
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Forma de Pagamento
            </label>
            <select
              id="sale-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="PIX">PIX (Instantâneo)</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Boleto Bancário">Boleto Bancário</option>
              <option value="Faturado / Transferência">Faturado / Transferência</option>
            </select>
          </div>

        </div>

        {/* Secondary Row: Produto / Contato */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          
          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Produto / Solução Vendida
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <input
                id="sale-product-name"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Assinatura Enterprise Anual"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail do Cliente / Contato
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="cliente@empresa.com"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefone / WhatsApp
            </label>
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 98765-4321"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

        </div>

        {/* Dynamic Campaign Fields (configured by admin) */}
        {currentCampaign?.fields && currentCampaign.fields.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Campos da Campanha: {currentCampaign.title}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentCampaign.fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-rose-600">*</span>}
                  </label>
                  
                  {field.type === 'select' && field.options ? (
                    <select
                      required={field.required}
                      value={customData[field.id] || ''}
                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Selecione uma opção...</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      value={customData[field.id] || ''}
                      onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Observações ou Termos de Fechamento (Opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Contrato enviado por e-mail, pagamento aprovado."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Bottom bar with Live Commission and Submit button */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 block text-[10px]">Comissão Estimada ({commissionRate}%):</span>
              <span className="font-bold text-emerald-600 text-sm">
                R$ {calculatedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-xs text-slate-500 hidden md:block">
              Vendedor logado: <strong className="text-slate-900">{currentUser?.name}</strong>
            </div>
          </div>

          <button
            id="submit-sale-btn"
            type="submit"
            disabled={isSubmitting || numValue <= 0 || !clientName.trim()}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isSubmitting ? (
              <span>Gravando Venda...</span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Registrar Venda Agora</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </div>

      </form>

    </div>
  );
};
