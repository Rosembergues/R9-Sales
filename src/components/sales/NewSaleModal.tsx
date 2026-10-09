import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import {
  X, User, Hash, CalendarDays, GraduationCap, Award, Wrench,
  ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Building2,
  FileText, Users, BookOpen, Layers3, Clock3, Sparkles
} from 'lucide-react';
import {
  MainProductType,
  ProductChannelFDI,
  ModalityType,
  ShiftType,
  ParcelaLeveOption,
  Profile
} from '../../types';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProduct?: MainProductType;
}

const BASE_FDI: ProductChannelFDI[] = [
  'Simplificada',
  'MSV',
  'Transferência Externa',
  'Reabertura',
  'Vestibular',
  'ENEM'
];

const FDI_LABEL: Record<ProductChannelFDI, string> = {
  Simplificada: 'Simplificada',
  MSV: 'MSV',
  'Transferência Externa': 'TE',
  Reabertura: 'Reabertura',
  Vestibular: 'Vestibular',
  ENEM: 'ENEM',
  Técnico: 'Técnico',
  'Pós Graduação': 'Pós-Graduação'
};

const PARCELA_OPTIONS: ParcelaLeveOption[] = [
  '1 parcela',
  '2 parcelas',
  '3 parcelas',
  'Sem parcelas'
];

const MODALITIES: Record<MainProductType, Array<{ name: ModalityType; shifts: ShiftType[] }>> = {
  'Graduação': [
    { name: 'Presencial', shifts: ['Manhã', 'Noite'] },
    { name: 'Semipresencial', shifts: ['Manhã', 'Noite'] },
    { name: 'Ao Vivo', shifts: ['Manhã', 'Noite'] },
    { name: 'EAD', shifts: ['Virtual'] },
    { name: 'FLEX', shifts: ['Virtual'] }
  ],
  'Pós Graduação': [
    { name: 'Pós Presencial', shifts: ['Manhã', 'Noite'] },
    { name: 'Pós Ao Vivo', shifts: ['Manhã', 'Noite'] },
    { name: 'Pós Digital', shifts: ['Virtual'] }
  ],
  'Curso Técnico': [
    { name: 'Técnico Presencial', shifts: ['Manhã', 'Noite'] }
  ]
};

const getTodayDateStr = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const formatIsoToBrDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};

const fdiOptionsFor = (product: MainProductType): ProductChannelFDI[] => {
  if (product === 'Graduação') return BASE_FDI;
  if (product === 'Pós Graduação') return [...BASE_FDI, 'Pós Graduação'];
  return [...BASE_FDI, 'Técnico'];
};

const defaultModalityFor = (product: MainProductType): ModalityType => MODALITIES[product][0].name;

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialProduct = 'Graduação'
}) => {
  const { currentUser, profiles } = useAuth();
  const { sales, activeCampaigns, addSale } = useSales();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSellerId, setSelectedSellerId] = useState(currentUser?.id || '');
  const [mainProduct, setMainProduct] = useState<MainProductType>(initialProduct);
  const [opportunityNumber, setOpportunityNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [saleDateIso, setSaleDateIso] = useState(getTodayDateStr());
  const [fdiChannel, setFdiChannel] = useState<ProductChannelFDI>('Simplificada');
  const [modality, setModality] = useState<ModalityType>(() => defaultModalityFor((initialProduct || 'Graduação') as MainProductType));
  const [shift, setShift] = useState<ShiftType>('Noite');

  const [parcelaLeve, setParcelaLeve] = useState<ParcelaLeveOption>('Sem parcelas');
  const [hasBolsaConvenio, setHasBolsaConvenio] = useState(false);
  const [empresaConvenio, setEmpresaConvenio] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const formScrollRef = useRef<HTMLFormElement | null>(null);

  const availableConsultants = useMemo(() => {
    const list: Profile[] = [...profiles];
    if (currentUser && !list.some(p => p.id === currentUser.id)) list.unshift(currentUser);
    sales.forEach(s => {
      const name = s.seller_name?.trim();
      if (!name || name === 'Consultor' || name === 'Consultor R9') return;
      if (!list.some(p => p.id === s.seller_id || p.name.toLowerCase() === name.toLowerCase())) {
        list.push({
          id: s.seller_id || `seller-${name.toLowerCase().replace(/\s+/g, '-')}`,
          name,
          email: s.seller_email || '',
          role: 'seller',
          created_at: s.created_at || new Date().toISOString(),
          status: 'active'
        });
      }
    });
    return list.filter(p => p.status !== 'inactive');
  }, [profiles, currentUser, sales]);

  const selectedConsultant = useMemo(
    () => availableConsultants.find(p => p.id === selectedSellerId) || currentUser,
    [availableConsultants, selectedSellerId, currentUser]
  );

  const fdiOptions = useMemo(() => fdiOptionsFor(mainProduct), [mainProduct]);
  const availableModalities = useMemo(() => MODALITIES[mainProduct], [mainProduct]);
  const currentAllowedShifts = useMemo(
    () => availableModalities.find(m => m.name === modality)?.shifts || ['Manhã', 'Noite'],
    [availableModalities, modality]
  );

  useEffect(() => {
    if (!isOpen || wasOpenRef.current) {
      wasOpenRef.current = isOpen;
      return;
    }
    setStep(1);
    setSelectedSellerId(currentUser?.id || '');
    setMainProduct(initialProduct);
    setOpportunityNumber('');
    setCandidateName('');
    setSaleDateIso(getTodayDateStr());
    setFdiChannel(initialProduct === 'Pós Graduação' ? 'Pós Graduação' : initialProduct === 'Curso Técnico' ? 'Técnico' : 'Simplificada');
    setModality(defaultModalityFor((initialProduct || 'Graduação') as MainProductType));
    setShift('Noite');
    setParcelaLeve('Sem parcelas');
    setHasBolsaConvenio(false);
    setEmpresaConvenio('');
    setNotes('');
    setErrorMessage(null);
    setSuccessMessage(null);
    wasOpenRef.current = true;
  }, [isOpen, currentUser?.id, initialProduct]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    // Cada etapa deve começar no topo para que nenhum campo fique oculto
    // por causa da posição de rolagem da etapa anterior.
    requestAnimationFrame(() => {
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [isOpen, step]);

  useEffect(() => {
    const options = fdiOptionsFor(mainProduct);
    if (!options.includes(fdiChannel)) setFdiChannel(options[0]);
    const defaultModality = defaultModalityFor(mainProduct);
    setModality(defaultModality);
    setShift(MODALITIES[mainProduct][0].shifts[0] === 'Virtual' ? 'Virtual' : 'Noite');
  }, [mainProduct]);

  useEffect(() => {
    const config = availableModalities.find(m => m.name === modality);
    if (!config) {
      setModality(availableModalities[0].name);
      return;
    }
    if (!config.shifts.includes(shift)) setShift(config.shifts[0]);
  }, [availableModalities, modality, shift]);

  if (!isOpen) return null;

  const validateStep = (targetStep: number) => {
    setErrorMessage(null);
    if (targetStep >= 2) {
      if (!selectedSellerId) return setErrorMessage('Selecione o consultor responsável pela venda.'), false;
      if (!opportunityNumber.trim()) return setErrorMessage('Informe o Número da Oportunidade.'), false;
      if (!candidateName.trim()) return setErrorMessage('Informe o nome do aluno.'), false;
      if (!saleDateIso) return setErrorMessage('Informe a data da venda.'), false;
    }
    if (targetStep >= 3 && hasBolsaConvenio && !empresaConvenio.trim()) {
      setErrorMessage('Informe a empresa do convênio ou selecione “Não”.');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1 && validateStep(2)) setStep(2);
    else if (step === 2 && validateStep(3)) setStep(3);
  };

  const handleProductChange = (product: MainProductType) => {
    setMainProduct(product);
    const nextFdi = product === 'Pós Graduação' ? 'Pós Graduação' : product === 'Curso Técnico' ? 'Técnico' : 'Simplificada';
    setFdiChannel(nextFdi);
  };

  const handleModalityChange = (next: ModalityType) => {
    setModality(next);
    const config = availableModalities.find(m => m.name === next);
    if (config) setShift(config.shifts[0]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateStep(3)) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const chosen = selectedConsultant;
    const chosenSellerId = chosen?.id || selectedSellerId;
    const chosenSellerName = chosen?.name || currentUser?.name || 'Consultor';
    const chosenSellerEmail = chosen?.email || currentUser?.email || '';
    const formattedDateBr = formatIsoToBrDate(saleDateIso);

    try {
      const response = await addSale({
        campaign_id: activeCampaigns[0]?.id || 'camp-1',
        client_name: candidateName.trim(),
        product_name: `${mainProduct} - ${modality} (${shift})`,
        seller_id: chosenSellerId,
        seller_name: chosenSellerName,
        seller_email: chosenSellerEmail,
        collaborator_name: chosenSellerName,
        fdi: fdiChannel,
        custom_data: {
          opportunity_number: opportunityNumber.trim(),
          candidate_name: candidateName.trim(),
          collaborator_name: chosenSellerName,
          collaborator_id: chosenSellerId,
          seller_name: chosenSellerName,
          seller_id: chosenSellerId,
          seller_email: chosenSellerEmail,
          sale_date: formattedDateBr,
          main_product: mainProduct,
          business_unit: modality === 'EAD' || modality === 'FLEX' || modality === 'Pós Digital' ? 'BU Digital' : 'BU Presencial',
          fdi: fdiChannel,
          fdi_channel: fdiChannel,
          modality,
          shift,
          parcela_leve: parcelaLeve,
          has_bolsa_convenio: hasBolsaConvenio,
          empresa_convenio: hasBolsaConvenio ? empresaConvenio.trim() : ''
        },
        notes: notes.trim()
      });

      if (!response.success) {
        setErrorMessage(response.error || 'Não foi possível registrar a venda.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Venda registrada com sucesso!');
      onSuccess?.();
      setIsSubmitting(false);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'Erro inesperado ao registrar venda.');
    }
  };

  const closeAfterSuccess = () => {
    setSuccessMessage(null);
    onClose();
  };

  const renderStepIndicator = () => (
    <div className="px-6 pt-4 pb-3 border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2">
        {[['1', 'Identificação'], ['2', 'Produto'], ['3', 'Condições']].map(([num, label], index) => {
          const active = Number(num) === step;
          const done = Number(num) < step;
          return (
            <React.Fragment key={num}>
              <div className={`flex items-center gap-2 ${active ? 'text-[#0052cc]' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${active ? 'bg-blue-50 border-blue-200' : done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  {done ? '✓' : num}
                </span>
                <span className="hidden sm:inline text-[11px] font-semibold">{label}</span>
              </div>
              {index < 2 && <div className={`h-px flex-1 ${done ? 'bg-emerald-200' : 'bg-gray-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#00478f] text-white flex items-center justify-center font-bold text-xs">R9</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Nova venda</h2>
                <p className="text-[11px] text-gray-500">Cadastre a venda em três etapas</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-200/60 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {renderStepIndicator()}

        <form ref={formScrollRef} onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="mb-5 p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="py-10 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Venda registrada!</h3>
              <p className="text-sm text-gray-500 mt-2">{candidateName} · oportunidade {opportunityNumber}</p>
              <button type="button" onClick={closeAfterSuccess} className="mt-7 px-5 py-2.5 rounded-xl bg-[#0052cc] text-white text-sm font-bold hover:bg-[#0045ad]">
                Fechar
              </button>
            </div>
          ) : step === 1 ? (
            <section className="space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0052cc]">Etapa 1</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">Identificação</h3>
                <p className="text-xs text-gray-500 mt-1">Defina quem está lançando a venda e identifique a oportunidade.</p>
              </div>

              <div className="space-y-4">
                <FieldLabel icon={<Users className="w-4 h-4" />} label="Consultor" />
                <select value={selectedSellerId} onChange={e => setSelectedSellerId(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]">
                  {availableConsultants.map(p => <option key={p.id} value={p.id}>{p.name}{p.id === currentUser?.id ? ' (você)' : ''}</option>)}
                </select>

                <FieldLabel icon={<Hash className="w-4 h-4" />} label="Oportunidade" />
                <input value={opportunityNumber} onChange={e => setOpportunityNumber(e.target.value)} placeholder="Número da oportunidade" inputMode="numeric" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" />

                <FieldLabel icon={<User className="w-4 h-4" />} label="Aluno" />
                <input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Nome completo do aluno" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" />

                <FieldLabel icon={<CalendarDays className="w-4 h-4" />} label="Data" />
                <div className="flex gap-2">
                  <input type="date" value={saleDateIso} onChange={e => setSaleDateIso(e.target.value)} className="flex-1 h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" />
                  <button type="button" onClick={() => setSaleDateIso(getTodayDateStr())} className="px-4 rounded-xl bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-[#0052cc]">Hoje</button>
                </div>
              </div>
            </section>
          ) : step === 2 ? (
            <section className="space-y-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0052cc]">Etapa 2</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">Produto</h3>
                <p className="text-xs text-gray-500 mt-1">Escolha o produto e depois as opções compatíveis.</p>
              </div>

              <div>
                <FieldLabel icon={<BookOpen className="w-4 h-4" />} label="Produto" />
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <ProductCard active={mainProduct === 'Graduação'} icon={<GraduationCap className="w-5 h-5" />} label="Graduação" onClick={() => handleProductChange('Graduação')} />
                  <ProductCard active={mainProduct === 'Pós Graduação'} icon={<Award className="w-5 h-5" />} label="Pós" onClick={() => handleProductChange('Pós Graduação')} />
                  <ProductCard active={mainProduct === 'Curso Técnico'} icon={<Wrench className="w-5 h-5" />} label="Técnico" onClick={() => handleProductChange('Curso Técnico')} />
                </div>
              </div>

              <div>
                <FieldLabel icon={<Sparkles className="w-4 h-4" />} label="Forma de ingresso" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {fdiOptions.map(option => (
                    <ChoiceButton key={option} active={fdiChannel === option} label={FDI_LABEL[option]} onClick={() => setFdiChannel(option)} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel icon={<Layers3 className="w-4 h-4" />} label="Modalidade" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {availableModalities.map(option => (
                    <ChoiceButton key={option.name} active={modality === option.name} label={option.name} onClick={() => handleModalityChange(option.name)} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel icon={<Clock3 className="w-4 h-4" />} label="Turno" />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {currentAllowedShifts.map(option => (
                    <ChoiceButton key={option} active={shift === option} label={option} onClick={() => setShift(option)} />
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0052cc]">Etapa 3</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">Condições</h3>
                <p className="text-xs text-gray-500 mt-1">Finalize as condições da venda e confirme o lançamento.</p>
              </div>

              <div>
                <FieldLabel label="Condição de pagamento" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {PARCELA_OPTIONS.map(option => <ChoiceButton key={option} active={parcelaLeve === option} label={option} onClick={() => setParcelaLeve(option)} />)}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><Building2 className="w-4 h-4 text-[#0052cc]" /> Bolsa / Convênio</div>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton active={!hasBolsaConvenio} label="Não" onClick={() => { setHasBolsaConvenio(false); setEmpresaConvenio(''); }} />
                  <ChoiceButton active={hasBolsaConvenio} label="Sim" onClick={() => setHasBolsaConvenio(true)} />
                </div>
                {hasBolsaConvenio && (
                  <input value={empresaConvenio} onChange={e => setEmpresaConvenio(e.target.value)} placeholder="Nome da empresa" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" />
                )}
              </div>

              <div>
                <FieldLabel icon={<FileText className="w-4 h-4" />} label="Observação (opcional)" />
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Alguma informação relevante sobre esta venda?" className="mt-2 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none resize-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" />
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs font-bold text-gray-900">Resumo da venda</span></div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
                  <Summary label="Consultor" value={selectedConsultant?.name || '—'} />
                  <Summary label="Oportunidade" value={opportunityNumber} />
                  <Summary label="Aluno" value={candidateName} />
                  <Summary label="Data" value={formatIsoToBrDate(saleDateIso)} />
                  <Summary label="Produto" value={mainProduct} />
                  <Summary label="Forma de ingresso" value={FDI_LABEL[fdiChannel]} />
                  <Summary label="Modalidade" value={modality} />
                  <Summary label="Turno" value={shift} />
                  <Summary label="Condição" value={parcelaLeve} />
                  <Summary label="Bolsa / Convênio" value={hasBolsaConvenio ? empresaConvenio : 'Não'} />
                </div>
              </div>
            </section>
          )}
        </form>

        {!successMessage && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between shrink-0">
            <button type="button" onClick={step === 1 ? onClose : () => { setErrorMessage(null); setStep((step - 1) as 1 | 2 | 3); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200">
              {step === 1 ? <><X className="w-4 h-4" /> Cancelar</> : <><ChevronLeft className="w-4 h-4" /> Voltar</>}
            </button>
            {step < 3 ? (
              <button type="button" onClick={goNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0052cc] text-white text-xs font-bold hover:bg-[#0045ad]">
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={() => handleSubmit()} disabled={isSubmitting} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0052cc] text-white text-xs font-bold hover:bg-[#0045ad] disabled:opacity-60 disabled:cursor-not-allowed">
                {isSubmitting ? 'Registrando...' : <><CheckCircle2 className="w-4 h-4" /> Confirmar venda</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const FieldLabel: React.FC<{ icon?: React.ReactNode; label: string }> = ({ icon, label }) => (
  <label className="flex items-center gap-2 text-xs font-bold text-gray-800">{icon && <span className="text-[#0052cc]">{icon}</span>}{label}</label>
);

const ProductCard: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button type="button" onClick={onClick} className={`min-h-24 rounded-2xl border p-3 flex flex-col items-center justify-center gap-2 transition-all ${active ? 'bg-blue-50 border-[#0052cc] text-[#0052cc] ring-1 ring-[#0052cc]' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
    {icon}
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const ChoiceButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button type="button" onClick={onClick} className={`min-h-10 px-3 rounded-xl border text-xs font-semibold transition-all ${active ? 'bg-[#0052cc] border-[#0052cc] text-white shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
    {label}
  </button>
);

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0"><span className="text-gray-400">{label}</span><div className="font-semibold text-gray-800 truncate">{value || '—'}</div></div>
);
