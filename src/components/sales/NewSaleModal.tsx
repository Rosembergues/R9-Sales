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
import { useOfficialGoals } from '../../hooks/useOfficialGoals';
import { buildCycleWindows, getSaleBusinessUnit, saleGoalGroup, suggestSaleCycle } from '../../lib/saleCycle';
import {
  describeSale,
  findDuplicateByOpportunity,
  findSameStudentSales,
  normalizeOpportunity,
  validateSaleDate,
} from '../../lib/saleValidation';
import { FDI_LABEL, PARCELA_OPTIONS, fdiOptionsFor, modalitiesFor, shiftsFor } from '../../lib/saleOptions';
import { isoToBr, todayLocalIso } from '../../lib/dates';
import { errorText } from '../../lib/errors';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialProduct?: MainProductType;
}

const getTodayDateStr = todayLocalIso;
const formatIsoToBrDate = isoToBr;

type MissingKey = 'product' | 'fdi' | 'modality' | 'shift' | 'parcela' | 'bolsa' | 'empresa';

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialProduct
}) => {
  const { currentUser, profiles } = useAuth();
  const { sales, addSale, findSaleByOpportunity } = useSales();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSellerId, setSelectedSellerId] = useState(currentUser?.id || '');
  // Nada vem marcado: o consultor escolhe cada opção (ver supabase/vendas-completas.sql).
  const [mainProduct, setMainProduct] = useState<MainProductType | ''>(initialProduct || '');
  const [opportunityNumber, setOpportunityNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [saleDateIso, setSaleDateIso] = useState(getTodayDateStr());
  const [fdiChannel, setFdiChannel] = useState<ProductChannelFDI | ''>('');
  const [modality, setModality] = useState<ModalityType | ''>('');
  const [shift, setShift] = useState<ShiftType | ''>('');

  const [parcelaLeve, setParcelaLeve] = useState<ParcelaLeveOption | ''>('');
  const [hasBolsaConvenio, setHasBolsaConvenio] = useState<boolean | null>(null);
  const [missing, setMissing] = useState<Set<MissingKey>>(new Set());
  const [empresaConvenio, setEmpresaConvenio] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  // Trava contra clique duplo: o estado só atualiza no próximo render, a ref é imediata.
  const submittingRef = useRef(false);
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
    // Consultor (não admin) só pode lançar para quem tem cadastro: o banco exige isso.
    const registeredIds = new Set(profiles.map(p => p.id));
    return list.filter(p => p.status !== 'inactive' && (currentUser?.role === 'admin' || registeredIds.has(p.id) || p.id === currentUser?.id));
  }, [profiles, currentUser, sales]);

  const selectedConsultant = useMemo(
    () => availableConsultants.find(p => p.id === selectedSellerId) || currentUser,
    [availableConsultants, selectedSellerId, currentUser]
  );

  // Ciclo acadêmico: definido automaticamente pela modalidade e data. Para uma mesma
  // modalidade nunca há dois ciclos vendendo no mesmo dia, então não há o que escolher.
  const official = useOfficialGoals();
  const cycleWindows = useMemo(() => buildCycleWindows(official.points), [official.points]);
  const effectiveCycle = useMemo(
    () => (mainProduct && modality ? suggestSaleCycle(saleGoalGroup(mainProduct, modality), saleDateIso, cycleWindows) : null),
    [mainProduct, modality, saleDateIso, cycleWindows]
  );

  // Alerta (não bloqueia): mesmo aluno, mesmo produto, outra oportunidade.
  const sameStudentSales = useMemo(
    () => (mainProduct ? findSameStudentSales(sales, candidateName, mainProduct) : []),
    [sales, candidateName, mainProduct]
  );

  const fdiOptions = useMemo(() => fdiOptionsFor(mainProduct), [mainProduct]);
  const availableModalities = useMemo(() => modalitiesFor(mainProduct), [mainProduct]);
  const currentAllowedShifts = useMemo<ShiftType[]>(() => shiftsFor(mainProduct, modality), [mainProduct, modality]);

  useEffect(() => {
    if (!isOpen || wasOpenRef.current) {
      wasOpenRef.current = isOpen;
      return;
    }
    setStep(1);
    setSelectedSellerId(currentUser?.id || '');
    setMainProduct(initialProduct || '');
    setOpportunityNumber('');
    setCandidateName('');
    setSaleDateIso(getTodayDateStr());
    setFdiChannel('');
    setModality('');
    setShift('');
    setParcelaLeve('');
    setHasBolsaConvenio(null);
    setMissing(new Set());
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

  if (!isOpen) return null;

  const validateStep = (targetStep: number) => {
    setErrorMessage(null);
    if (targetStep >= 2) {
      if (!selectedSellerId) return setErrorMessage('Selecione o consultor responsável pela venda.'), false;
      if (!opportunityNumber.trim()) return setErrorMessage('Informe o Número da Oportunidade.'), false;
      if (!candidateName.trim()) return setErrorMessage('Informe o nome do aluno.'), false;
      if (!saleDateIso) return setErrorMessage('Informe a data da venda.'), false;
      const dateError = validateSaleDate(saleDateIso);
      if (dateError) return setErrorMessage(dateError), false;
    }
    if (targetStep >= 3) {
      const gaps = new Set<MissingKey>();
      if (!mainProduct) gaps.add('product');
      if (!fdiChannel) gaps.add('fdi');
      if (!modality) gaps.add('modality');
      if (!shift) gaps.add('shift');
      setMissing(gaps);
      if (gaps.size) return setErrorMessage('Escolha produto, forma de ingresso, modalidade e turno para continuar.'), false;
    }
    if (targetStep >= 4) {
      const gaps = new Set<MissingKey>();
      if (!parcelaLeve) gaps.add('parcela');
      if (hasBolsaConvenio === null) gaps.add('bolsa');
      if (hasBolsaConvenio && !empresaConvenio.trim()) gaps.add('empresa');
      setMissing(gaps);
      if (gaps.has('empresa') && gaps.size === 1) return setErrorMessage('Informe a empresa do convênio ou selecione “Não”.'), false;
      if (gaps.size) return setErrorMessage('Escolha a condição de pagamento e se tem bolsa/convênio.'), false;
    }
    return true;
  };

  const clearMissing = (key: MissingKey) =>
    setMissing(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

  /** Verifica se a oportunidade já foi lançada (vendas carregadas + servidor). */
  const checkDuplicate = async (): Promise<boolean> => {
    const opportunity = normalizeOpportunity(opportunityNumber);
    setIsChecking(true);
    try {
      const duplicate = findDuplicateByOpportunity(sales, opportunity) || await findSaleByOpportunity(opportunity);
      if (duplicate) {
        setErrorMessage(`A oportunidade ${opportunity} já foi registrada (${describeSale(duplicate)}). Não é possível lançar de novo.`);
        return false;
      }
      return true;
    } finally {
      setIsChecking(false);
    }
  };

  const goNext = async () => {
    if (isChecking) return;
    if (step === 1 && validateStep(2) && await checkDuplicate()) setStep(2);
    else if (step === 2 && validateStep(3)) setStep(3);
  };

  const handleProductChange = (product: MainProductType) => {
    if (product === mainProduct) return;
    setMainProduct(product);
    clearMissing('product');
    // Opções que não existem no novo produto voltam a ficar em branco.
    if (fdiChannel && !fdiOptionsFor(product).includes(fdiChannel)) setFdiChannel('');
    const options = modalitiesFor(product);
    if (options.length === 1) {
      setModality(options[0].name);
      clearMissing('modality');
      const onlyShift = options[0].shifts.length === 1 ? options[0].shifts[0] : '';
      setShift(onlyShift);
      if (onlyShift) clearMissing('shift');
    } else {
      setModality('');
      setShift('');
    }
  };

  const handleModalityChange = (next: ModalityType) => {
    setModality(next);
    clearMissing('modality');
    const shifts = shiftsFor(mainProduct, next);
    // Turno único (EAD, Flex, Pós Digital = Virtual) é marcado sozinho.
    if (shifts.length === 1) {
      setShift(shifts[0]);
      clearMissing('shift');
    } else if (!shifts.includes(shift as ShiftType)) {
      setShift('');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submittingRef.current) return;
    if (!validateStep(4)) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    const chosen = selectedConsultant;
    const chosenSellerId = chosen?.id || selectedSellerId;
    const chosenSellerName = chosen?.name || currentUser?.name || 'Consultor';
    const chosenSellerEmail = chosen?.email || currentUser?.email || '';
    const formattedDateBr = formatIsoToBrDate(saleDateIso);

    try {
      const response = await addSale({
        client_name: candidateName.trim(),
        product_name: mainProduct as MainProductType,
        seller_id: chosenSellerId,
        seller_name: chosenSellerName,
        seller_email: chosenSellerEmail,
        collaborator_name: chosenSellerName,
        custom_data: {
          opportunity_number: normalizeOpportunity(opportunityNumber),
          candidate_name: candidateName.trim(),
          collaborator_name: chosenSellerName,
          collaborator_id: chosenSellerId,
          seller_name: chosenSellerName,
          seller_id: chosenSellerId,
          seller_email: chosenSellerEmail,
          sale_date: formattedDateBr,
          main_product: mainProduct as MainProductType,
          business_unit: getSaleBusinessUnit(mainProduct as MainProductType, modality as ModalityType),
          fdi: fdiChannel,
          fdi_channel: fdiChannel as ProductChannelFDI,
          modality: modality as ModalityType,
          shift: shift as ShiftType,
          ...(effectiveCycle ? { academic_period: effectiveCycle } : {}),
          parcela_leve: parcelaLeve as ParcelaLeveOption,
          has_bolsa_convenio: Boolean(hasBolsaConvenio),
          empresa_convenio: hasBolsaConvenio ? empresaConvenio.trim() : ''
        },
        notes: notes.trim()
      });

      if (!response.success) {
        if (response.sale) {
          // Sem conexão: a venda ficou na fila do aparelho. Não pode ser lançada de novo.
          setSuccessMessage('Venda guardada neste aparelho. Ela será enviada assim que a conexão voltar.');
          onSuccess?.();
        } else {
          setErrorMessage(response.error || 'Não foi possível registrar a venda.');
          if (response.duplicate) setStep(1);
        }
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Venda registrada com sucesso!');
      onSuccess?.();
      submittingRef.current = false;
      setIsSubmitting(false);
    } catch (err) {
      submittingRef.current = false;
      setIsSubmitting(false);
      setErrorMessage(errorText(err, 'Erro inesperado ao registrar venda.'));
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

        <form ref={formScrollRef} onSubmit={e => { e.preventDefault(); if (step === 3) handleSubmit(); else goNext(); }} className="p-6 overflow-y-auto flex-1">
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
                <select value={selectedSellerId} onChange={e => setSelectedSellerId(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" name="src_components_sales_newsalemodal_tsx_select_1">
                  {availableConsultants.map(p => <option key={p.id} value={p.id}>{p.name}{p.id === currentUser?.id ? ' (você)' : ''}</option>)}
                </select>
                {selectedSellerId && selectedSellerId !== currentUser?.id && currentUser?.role !== 'admin' && (
                  <p className="text-[11px] text-amber-700">Você está lançando para outro consultor. Depois de registrada, só ele ou um administrador poderá editar esta venda.</p>
                )}

                <FieldLabel icon={<Hash className="w-4 h-4" />} label="Oportunidade" />
                <input value={opportunityNumber} onChange={e => setOpportunityNumber(e.target.value)} placeholder="Número da oportunidade" inputMode="numeric" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" name="src_components_sales_newsalemodal_tsx_input_2" />

                <FieldLabel icon={<User className="w-4 h-4" />} label="Aluno" />
                <input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Nome completo do aluno" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" name="src_components_sales_newsalemodal_tsx_input_3" />

                <FieldLabel icon={<CalendarDays className="w-4 h-4" />} label="Data" />
                <div className="flex gap-2">
                  <input type="date" value={saleDateIso} max={getTodayDateStr()} onChange={e => setSaleDateIso(e.target.value)} className="flex-1 h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" name="src_components_sales_newsalemodal_tsx_input_4" />
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
                <FieldLabel icon={<BookOpen className="w-4 h-4" />} label="Produto" invalid={missing.has('product')} />
                <div className={`grid grid-cols-3 gap-3 mt-2 rounded-2xl ${missing.has('product') ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
                  <ProductCard active={mainProduct === 'Graduação'} icon={<GraduationCap className="w-5 h-5" />} label="Graduação" onClick={() => handleProductChange('Graduação')} />
                  <ProductCard active={mainProduct === 'Pós Graduação'} icon={<Award className="w-5 h-5" />} label="Pós" onClick={() => handleProductChange('Pós Graduação')} />
                  <ProductCard active={mainProduct === 'Curso Técnico'} icon={<Wrench className="w-5 h-5" />} label="Técnico" onClick={() => handleProductChange('Curso Técnico')} />
                </div>
              </div>

              <div>
                <FieldLabel icon={<Sparkles className="w-4 h-4" />} label="Forma de ingresso" invalid={missing.has('fdi')} />
                {!mainProduct ? <PickFirst text="Escolha o produto primeiro." /> : (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 rounded-xl ${missing.has('fdi') ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
                    {fdiOptions.map(option => (
                      <ChoiceButton key={option} active={fdiChannel === option} label={FDI_LABEL[option]} onClick={() => { setFdiChannel(option); clearMissing('fdi'); }} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <FieldLabel icon={<Layers3 className="w-4 h-4" />} label="Modalidade" invalid={missing.has('modality')} />
                {!mainProduct ? <PickFirst text="Escolha o produto primeiro." /> : (
                  <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 rounded-xl ${missing.has('modality') ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
                    {availableModalities.map(option => (
                      <ChoiceButton key={option.name} active={modality === option.name} label={option.name} onClick={() => handleModalityChange(option.name)} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <FieldLabel icon={<Clock3 className="w-4 h-4" />} label="Turno" invalid={missing.has('shift')} />
                {!modality ? <PickFirst text="Escolha a modalidade primeiro." /> : (
                  <div className={`grid grid-cols-3 gap-2 mt-2 rounded-xl ${missing.has('shift') ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
                    {currentAllowedShifts.map(option => (
                      <ChoiceButton key={option} active={shift === option} label={option} onClick={() => { setShift(option); clearMissing('shift'); }} />
                    ))}
                  </div>
                )}
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
                <FieldLabel label="Condição de pagamento" invalid={missing.has('parcela')} />
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 rounded-xl ${missing.has('parcela') ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}>
                  {PARCELA_OPTIONS.map(option => <ChoiceButton key={option} active={parcelaLeve === option} label={option} onClick={() => { setParcelaLeve(option); clearMissing('parcela'); }} />)}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 space-y-3 ${missing.has('bolsa') ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Building2 className="w-4 h-4 text-[#0052cc]" /> Bolsa / Convênio
                  {missing.has('bolsa') && <span className="text-[11px] font-semibold text-red-600">· escolha uma opção</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton active={hasBolsaConvenio === false} label="Não" onClick={() => { setHasBolsaConvenio(false); setEmpresaConvenio(''); clearMissing('bolsa'); clearMissing('empresa'); }} />
                  <ChoiceButton active={hasBolsaConvenio === true} label="Sim" onClick={() => { setHasBolsaConvenio(true); clearMissing('bolsa'); }} />
                </div>
                {hasBolsaConvenio && (
                  <input value={empresaConvenio} onChange={e => { setEmpresaConvenio(e.target.value); clearMissing('empresa'); }} placeholder="Nome da empresa" className={`w-full h-11 px-3 rounded-xl border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc] ${missing.has('empresa') ? 'border-red-300' : 'border-gray-200'}`} name="src_components_sales_newsalemodal_tsx_input_5" />
                )}
              </div>

              <div>
                <FieldLabel icon={<FileText className="w-4 h-4" />} label="Observação (opcional)" />
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Alguma informação relevante sobre esta venda?" className="mt-2 w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none resize-none focus:ring-2 focus:ring-blue-100 focus:border-[#0052cc]" name="src_components_sales_newsalemodal_tsx_textarea_6" />
              </div>

              {sameStudentSales.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                  <div className="flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4" /> Este aluno já tem venda de {mainProduct}</div>
                  <ul className="mt-2 space-y-1">
                    {sameStudentSales.slice(0, 3).map(s => (
                      <li key={s.id}>Oportunidade {s.custom_data?.opportunity_number} · {describeSale(s)}</li>
                    ))}
                  </ul>
                  <p className="mt-2">Confira se não é a mesma matrícula antes de confirmar.</p>
                </div>
              )}

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs font-bold text-gray-900">Resumo da venda</span></div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
                  <Summary label="Consultor" value={selectedConsultant?.name || '—'} />
                  <Summary label="Oportunidade" value={opportunityNumber} />
                  <Summary label="Aluno" value={candidateName} />
                  <Summary label="Data" value={formatIsoToBrDate(saleDateIso)} />
                  <Summary label="Produto" value={mainProduct} />
                  <Summary label="Forma de ingresso" value={fdiChannel ? FDI_LABEL[fdiChannel] : ''} />
                  <Summary label="Modalidade" value={modality} />
                  <Summary label="Turno" value={shift} />
                  {effectiveCycle && <Summary label="Ciclo" value={effectiveCycle} />}
                  <Summary label="Condição" value={parcelaLeve} />
                  <Summary label="Bolsa / Convênio" value={hasBolsaConvenio === null ? '' : hasBolsaConvenio ? empresaConvenio : 'Não'} />
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
              <button type="button" onClick={goNext} disabled={isChecking} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0052cc] text-white text-xs font-bold hover:bg-[#0045ad] disabled:opacity-60 disabled:cursor-not-allowed">
                {isChecking ? 'Verificando...' : <>Continuar <ChevronRight className="w-4 h-4" /></>}
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

const FieldLabel: React.FC<{ icon?: React.ReactNode; label: string; invalid?: boolean }> = ({ icon, label, invalid }) => (
  <label className={`flex items-center gap-2 text-xs font-bold ${invalid ? 'text-red-600' : 'text-gray-800'}`}>
    {icon && <span className={invalid ? 'text-red-500' : 'text-[#0052cc]'}>{icon}</span>}
    {label}
    {invalid && <span className="font-semibold text-[11px]">· escolha uma opção</span>}
  </label>
);

const PickFirst: React.FC<{ text: string }> = ({ text }) => (
  <p className="mt-2 text-[11px] text-gray-400 italic">{text}</p>
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
