import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { 
  X, 
  Zap, 
  User, 
  Hash, 
  Calendar, 
  BookOpen, 
  Layers, 
  Clock, 
  CreditCard, 
  Building2, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  HelpCircle,
  Tag,
  GraduationCap,
  Award,
  Wrench
} from 'lucide-react';
import { 
  MainProductType,
  ProductChannelFDI, 
  ModalityType, 
  ShiftType, 
  ParcelaLeveOption, 
  PaymentMethod 
} from '../../types';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProduct?: MainProductType;
}

const FDI_CHANNELS: ProductChannelFDI[] = [
  'Simplificada',
  'MSV',
  'Reabertura',
  'Transferência Externa',
  'Vestibular',
  'ENEM',
  'Técnico',
  'Pós Graduação'
];

const PARCELA_LEVE_OPTIONS: ParcelaLeveOption[] = [
  '3 parcelas',
  '2 parcelas',
  '1 parcela',
  'Sem parcelas'
];

/**
 * Regras de desabilitação para canais FDI baseado no Produto Principal:
 * - Graduação: desabilita 'Técnico' e 'Pós Graduação'
 * - Pós Graduação: desabilita todos que não são 'Pós Graduação'
 * - Curso Técnico: desabilita todos que não são 'Técnico'
 */
export const isFdiChannelDisabled = (channel: ProductChannelFDI, product: MainProductType): boolean => {
  if (product === 'Graduação') {
    return channel === 'Técnico' || channel === 'Pós Graduação';
  }
  if (product === 'Pós Graduação') {
    return channel !== 'Pós Graduação';
  }
  if (product === 'Curso Técnico') {
    return channel !== 'Técnico';
  }
  return false;
};

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialProduct = 'Graduação'
}) => {
  const { currentUser, profiles, refreshProfiles } = useAuth();
  const { activeCampaigns, addSale } = useSales();

  // Consultor Responsável
  const [selectedSellerId, setSelectedSellerId] = useState<string>(currentUser?.id || '');

  // Padrão Inteligente: usuário logado pré-selecionado e busca perfis atualizados ao abrir
  useEffect(() => {
    if (isOpen) {
      refreshProfiles();
      if (currentUser?.id) {
        setSelectedSellerId(currentUser.id);
      }
    }
  }, [isOpen, currentUser, refreshProfiles]);

  // Lista consolidada de consultores disponíveis (tabela profiles + usuário logado se não listado)
  const availableConsultants = React.useMemo(() => {
    const list = [...profiles];
    if (currentUser && !list.some(p => p.id === currentUser.id)) {
      list.unshift(currentUser);
    }
    return list;
  }, [profiles, currentUser]);

  const selectedConsultant = React.useMemo(() => {
    return availableConsultants.find(p => p.id === selectedSellerId) || currentUser;
  }, [availableConsultants, selectedSellerId, currentUser]);

  // 1. Produto Principal
  const [mainProduct, setMainProduct] = useState<MainProductType>(initialProduct);

  // 2. Dados da Oportunidade
  const [opportunityNumber, setOpportunityNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');

  // 3. Data da Venda (ISO yyyy-mm-dd for input, formatted dd/MM/yyyy for record)
  const getTodayDateStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [saleDateIso, setSaleDateIso] = useState<string>(getTodayDateStr());

  // 4. Produto/Canal (FDI)
  const [fdiChannel, setFdiChannel] = useState<ProductChannelFDI>('Vestibular');

  // 5. Modalidade & Turno
  const [modality, setModality] = useState<ModalityType>('Presencial');
  const [shift, setShift] = useState<ShiftType>('Noite');

  // 6. Condições de Pagamento
  const [parcelaLeve, setParcelaLeve] = useState<ParcelaLeveOption>('Sem parcelas');
  const [hasBolsaConvenio, setHasBolsaConvenio] = useState<boolean>(false);
  const [empresaConvenio, setEmpresaConvenio] = useState<string>('');

  // 7. Observações
  const [notes, setNotes] = useState<string>('');

  // Optional: Campanha Ativa
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    activeCampaigns[0]?.id || ''
  );

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update initial product when prop changes
  useEffect(() => {
    if (initialProduct) {
      setMainProduct(initialProduct);
    }
  }, [initialProduct]);

  // Adjust modalities and shifts based on selected main product
  useEffect(() => {
    if (mainProduct === 'Graduação') {
      if (isFdiChannelDisabled(fdiChannel, 'Graduação')) {
        setFdiChannel('Vestibular');
      }
      setModality('Presencial');
      setShift('Noite');
    } else if (mainProduct === 'Pós Graduação') {
      setFdiChannel('Pós Graduação');
      setModality('Pós Presencial');
      setShift('Noite');
    } else if (mainProduct === 'Curso Técnico') {
      setFdiChannel('Técnico');
      setModality('Técnico Presencial');
      setShift('Noite');
    }
  }, [mainProduct]);

  // Available modalities for the active main product
  const availableModalities = React.useMemo(() => {
    if (mainProduct === 'Graduação') {
      return [
        { name: 'Presencial', bu: 'BU Presencial', shifts: ['Manhã', 'Noite'] },
        { name: 'Semipresencial', bu: 'BU Presencial', shifts: ['Manhã', 'Noite'] },
        { name: 'Ao Vivo', bu: 'BU Presencial', shifts: ['Manhã', 'Noite'] },
        { name: 'EAD', bu: 'BU Digital', shifts: ['Virtual'] },
        { name: 'FLEX', bu: 'BU Digital', shifts: ['Virtual'] }
      ];
    } else if (mainProduct === 'Pós Graduação') {
      return [
        { name: 'Pós Presencial', bu: 'Pós Graduação', shifts: ['Manhã', 'Noite'] },
        { name: 'Pós Ao Vivo', bu: 'Pós Graduação', shifts: ['Manhã', 'Noite'] },
        { name: 'Pós Digital', bu: 'Pós Graduação', shifts: ['Virtual'] }
      ];
    } else {
      return [
        { name: 'Técnico Presencial', bu: 'Curso Técnico', shifts: ['Manhã', 'Noite'] }
      ];
    }
  }, [mainProduct]);

  // Allowed shifts for current modality
  const currentAllowedShifts = React.useMemo(() => {
    const found = availableModalities.find(m => m.name === modality);
    return found ? (found.shifts as ShiftType[]) : ['Manhã', 'Noite'];
  }, [availableModalities, modality]);

  const handleSelectModality = (modName: string) => {
    setModality(modName as ModalityType);
    const modConfig = availableModalities.find(m => m.name === modName);
    if (modConfig && modConfig.shifts.length > 0) {
      if (!modConfig.shifts.includes(shift)) {
        setShift(modConfig.shifts[0] as ShiftType);
      }
    }
  };

  if (!isOpen) return null;

  // Format ISO yyyy-mm-dd to dd/MM/yyyy
  const formatIsoToBrDate = (isoStr: string): string => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validações básicas
    if (!opportunityNumber.trim()) {
      setErrorMessage('Por favor, informe o Número da Oportunidade.');
      return;
    }

    if (!candidateName.trim()) {
      setErrorMessage('Por favor, informe o Nome do Candidato / Aluno.');
      return;
    }

    if (hasBolsaConvenio && !empresaConvenio.trim()) {
      setErrorMessage('Informe o nome da Empresa do Convênio ou selecione "Não".');
      return;
    }

    const formattedDateBr = formatIsoToBrDate(saleDateIso);

    setIsSubmitting(true);

    const chosenSeller = selectedConsultant || currentUser;
    const chosenSellerName = chosenSeller?.name || 'Consultor R9';
    const chosenSellerId = chosenSeller?.id || currentUser?.id || '';
    const chosenSellerEmail = chosenSeller?.email || currentUser?.email || '';

    try {
      const response = await addSale({
        campaign_id: selectedCampaignId || activeCampaigns[0]?.id || 'camp-1',
        client_name: candidateName.trim(),
        product_name: `${mainProduct} - ${modality} (${shift})`,
        value: 1200, // Valor padrão de referência no sistema
        payment_method: 'PIX',
        seller_id: chosenSellerId,
        seller_name: chosenSellerName,
        seller_email: chosenSellerEmail,
        collaborator_name: chosenSellerName,
        custom_data: {
          opportunity_number: opportunityNumber.trim(),
          candidate_name: candidateName.trim(),
          collaborator_name: chosenSellerName,
          seller_name: chosenSellerName,
          sale_date: formattedDateBr,
          main_product: mainProduct,
          business_unit: modality === 'EAD' || modality === 'FLEX' || modality === 'Pós Digital' ? 'BU Digital' : 'BU Presencial',
          fdi_channel: fdiChannel,
          modality: modality,
          shift: shift,
          parcela_leve: parcelaLeve,
          has_bolsa_convenio: hasBolsaConvenio,
          empresa_convenio: hasBolsaConvenio ? empresaConvenio.trim() : ''
        },
        notes: notes.trim()
      });

      setIsSubmitting(false);

      if (response.success) {
        setSuccessMessage('Venda registrada com sucesso no R9 Sales!');
        if (onSuccess) onSuccess();

        // Reset form
        setTimeout(() => {
          setOpportunityNumber('');
          setCandidateName('');
          setNotes('');
          setEmpresaConvenio('');
          setHasBolsaConvenio(false);
          setSuccessMessage(null);
          onClose();
        }, 1200);
      } else {
        setErrorMessage(response.error || 'Erro ao registrar venda. Tente novamente.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Erro inesperado ao registrar venda.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/75 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00478f] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              R9
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                <span>Lançamento de Venda</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                  {mainProduct}
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                Preencha os dados da oportunidade e condições do aluno
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-200/60 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 animate-in fade-in font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. SELEÇÃO DO PRODUTO PRINCIPAL */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider">
              1. Produto Principal *
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              
              <button
                type="button"
                onClick={() => setMainProduct('Graduação')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mainProduct === 'Graduação'
                    ? 'bg-blue-50 border-[#0052cc] text-[#0052cc] shadow-xs ring-1 ring-[#0052cc]'
                    : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <GraduationCap className="w-4 h-4" />
                  {mainProduct === 'Graduação' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0052cc]" />
                  )}
                </div>
                <span className="font-bold text-xs">Graduação</span>
                <span className="text-[10px] text-gray-400">Presencial & Digital</span>
              </button>

              <button
                type="button"
                onClick={() => setMainProduct('Pós Graduação')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mainProduct === 'Pós Graduação'
                    ? 'bg-purple-50 border-purple-600 text-purple-700 shadow-xs ring-1 ring-purple-500'
                    : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Award className="w-4 h-4" />
                  {mainProduct === 'Pós Graduação' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  )}
                </div>
                <span className="font-bold text-xs">Pós Graduação</span>
                <span className="text-[10px] text-gray-400">Especialização & MBAs</span>
              </button>

              <button
                type="button"
                onClick={() => setMainProduct('Curso Técnico')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mainProduct === 'Curso Técnico'
                    ? 'bg-amber-50 border-amber-600 text-amber-700 shadow-xs ring-1 ring-amber-500'
                    : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Wrench className="w-4 h-4" />
                  {mainProduct === 'Curso Técnico' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  )}
                </div>
                <span className="font-bold text-xs">Curso Técnico</span>
                <span className="text-[10px] text-gray-400">Formação Profissional</span>
              </button>

            </div>
          </div>

          {/* 2. SEÇÃO: DADOS DA OPORTUNIDADE & CONSULTOR */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <Hash className="w-4 h-4 text-[#0052cc]" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                2. Dados da Oportunidade & Responsável
              </h3>
            </div>

            {/* Consultor Responsável */}
            <div className="p-3 bg-blue-50/40 border border-blue-100/80 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="select-consultant" className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#0052cc]" />
                  <span>Consultor Responsável *</span>
                </label>
                {selectedConsultant && (
                  <span className="text-[10px] font-medium text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                    {selectedConsultant.id === currentUser?.id ? 'Usuário logado (Padrão)' : 'Consultor selecionado'}
                  </span>
                )}
              </div>
              <select
                id="select-consultant"
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-900 cursor-pointer shadow-2xs"
              >
                {availableConsultants.length > 0 ? (
                  availableConsultants.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} {prof.id === currentUser?.id ? '(Você - Logado)' : ''} ({prof.role === 'admin' ? 'Administrador' : 'Consultor'})
                    </option>
                  ))
                ) : (
                  <option value={currentUser?.id || ''}>
                    {currentUser?.name || 'Consultor Atual'} (Você - Logado)
                  </option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Nº da Oportunidade */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-gray-400" />
                  <span>Nº da Oportunidade *</span>
                </label>
                <input
                  id="input-opportunity-number"
                  type="text"
                  required
                  placeholder="Ex: OPT-2026-9812"
                  value={opportunityNumber}
                  onChange={(e) => setOpportunityNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50/50 hover:bg-white border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100 transition-all font-mono font-bold text-gray-900"
                />
              </div>

              {/* Nome do Candidato */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span>Nome do Candidato / Aluno *</span>
                </label>
                <input
                  id="input-candidate-name"
                  type="text"
                  required
                  placeholder="Ex: Amanda Ferreira dos Santos"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50/50 hover:bg-white border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-900"
                />
              </div>

            </div>

            {/* Data da Venda */}
            <div className="pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Data da Venda (Registro) *</span>
                </label>
                <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  Formato: {formatIsoToBrDate(saleDateIso)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="input-sale-date"
                  type="date"
                  required
                  value={saleDateIso}
                  onChange={(e) => setSaleDateIso(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setSaleDateIso(getTodayDateStr())}
                  className="px-3 py-2 text-xs font-semibold text-gray-700 hover:text-[#0052cc] bg-gray-100 hover:bg-blue-50 border border-gray-200 rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  Hoje
                </button>
              </div>
            </div>

          </div>

          {/* 3. SEÇÃO: PRODUTO / CANAL (FDI) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0052cc]" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  3. Produto / Canal (FDI) *
                </h3>
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                Selecionado: <strong className="text-blue-700">{fdiChannel}</strong>
              </span>
            </div>

            {/* Grid of FDI options */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FDI_CHANNELS.map((channel) => {
                const isSelected = fdiChannel === channel;
                const isDisabled = isFdiChannelDisabled(channel, mainProduct);

                return (
                  <button
                    key={channel}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        setFdiChannel(channel);
                      }
                    }}
                    title={isDisabled ? `Opção indisponível para ${mainProduct}` : undefined}
                    className={`px-3 py-2 text-xs rounded-xl font-medium border text-left transition-all flex items-center justify-between ${
                      isDisabled
                        ? 'opacity-35 bg-gray-100/90 border-gray-200 text-gray-400 cursor-not-allowed select-none'
                        : isSelected
                        ? 'bg-[#0052cc] text-white border-[#0052cc] shadow-xs font-bold scale-[1.01] cursor-pointer'
                        : 'bg-gray-50/70 border-gray-200/90 text-gray-700 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <span className="truncate">{channel}</span>
                    {isSelected && !isDisabled && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. SEÇÃO: MODALIDADE & TURNO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <Layers className="w-4 h-4 text-[#0052cc]" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                4. Modalidade & Turno ({mainProduct}) *
              </h3>
            </div>

            {/* Modalidade filtrada pelo Produto Principal */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Modalidade de Ensino:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {availableModalities.map((item) => {
                  const isSelected = modality === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleSelectModality(item.name)}
                      className={`p-2.5 rounded-xl text-xs font-medium border transition-all text-left cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-[#0052cc] text-blue-900 ring-1 ring-[#0052cc] font-bold shadow-xs'
                          : 'bg-gray-50/60 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{item.name}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#0052cc]" />}
                      </div>
                      <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                        {item.bu}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Turno */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Turno Permitido:</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {currentAllowedShifts.map((sh) => {
                  const isSelected = shift === sh;
                  return (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setShift(sh)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {sh === 'Manhã' && '☀️ '}
                      {sh === 'Noite' && '🌙 '}
                      {sh === 'Virtual' && '💻 '}
                      {sh}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* 5. SEÇÃO: CONDIÇÕES DE PAGAMENTO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100">
              <CreditCard className="w-4 h-4 text-[#0052cc]" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                5. Condições de Pagamento
              </h3>
            </div>

            {/* Parcela Leve */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Parcela Leve:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PARCELA_LEVE_OPTIONS.map((opt) => {
                  const isSelected = parcelaLeve === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setParcelaLeve(opt)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-1 ring-emerald-400'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bolsa Convênio Aplicada (Sim/Não) */}
            <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-800 block text-xs">
                    Bolsa Convênio Aplicada?
                  </span>
                  <span className="text-[11px] text-gray-500">
                    O aluno possui desconto por convênio corporativo?
                  </span>
                </div>
                
                <div className="inline-flex rounded-xl bg-gray-200/80 p-0.5 border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setHasBolsaConvenio(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      !hasBolsaConvenio
                        ? 'bg-white text-gray-900 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasBolsaConvenio(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      hasBolsaConvenio
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Sim
                  </button>
                </div>
              </div>

              {/* Input Dinâmico de Empresa do Convênio */}
              {hasBolsaConvenio && (
                <div className="pt-2 border-t border-gray-200/70 animate-in fade-in duration-150">
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Nome da Empresa / Parceiro do Convênio *</span>
                  </label>
                  <input
                    type="text"
                    required={hasBolsaConvenio}
                    placeholder="Ex: Petrobras, Banco do Brasil, OAB, etc."
                    value={empresaConvenio}
                    onChange={(e) => setEmpresaConvenio(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-purple-300 rounded-xl focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 font-medium"
                  />
                </div>
              )}
            </div>

          </div>

          {/* 6. SEÇÃO: OBSERVAÇÕES */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <span>Observações da Matrícula</span>
            </label>
            <textarea
              rows={2}
              placeholder="Anotações de negociação, documentação pendente ou detalhes adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50/50 hover:bg-white border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
            />
          </div>

          {/* Bottom Summary Bar */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-900">{mainProduct}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-700">{modality} ({shift})</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-600 font-medium">
                Parcela: <strong>{parcelaLeve}</strong>
                {hasBolsaConvenio && empresaConvenio && ` • ${empresaConvenio}`}
              </span>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#0052cc] hover:bg-[#00478f] active:scale-[0.99] rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando...' : 'Confirmar Lançamento'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
