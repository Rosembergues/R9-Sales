import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { 
  X, 
  Shield, 
  Check, 
  Trash2, 
  Save, 
  Calendar, 
  User, 
  Hash, 
  Building2, 
  Layers, 
  Clock, 
  CreditCard, 
  FileText,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { 
  Sale, 
  MainProductType, 
  ProductChannelFDI, 
  ModalityType, 
  ShiftType, 
  ParcelaLeveOption,
  SaleStatus 
} from '../../types';
import { getSaleFdiDisplay } from '../../lib/salesMapper';

interface EditSaleModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

const isFdiChannelDisabled = (channel: ProductChannelFDI, product: MainProductType): boolean => {
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

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  sale,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profiles, currentUser } = useAuth();
  const { updateSale, deleteSale } = useSales();

  // Form states
  const [sellerId, setSellerId] = useState('');
  const [opportunityNumber, setOpportunityNumber] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [mainProduct, setMainProduct] = useState<MainProductType>('Graduação');
  const [fdiChannel, setFdiChannel] = useState<ProductChannelFDI>('Simplificada');
  const [modality, setModality] = useState<ModalityType>('Presencial');
  const [shift, setShift] = useState<ShiftType>('Noite');
  const [parcelaLeve, setParcelaLeve] = useState<ParcelaLeveOption>('Sem parcelas');
  const [hasBolsaConvenio, setHasBolsaConvenio] = useState(false);
  const [empresaConvenio, setEmpresaConvenio] = useState('');
  const [value, setValue] = useState<number>(0);
  const [status, setStatus] = useState<SaleStatus>('Aprovada');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load sale data when opened
  useEffect(() => {
    if (sale) {
      setSellerId(sale.seller_id || '');
      setOpportunityNumber(sale.custom_data?.opportunity_number || sale.id.replace('sale-', '955'));
      setCandidateName(sale.custom_data?.candidate_name || sale.client_name || '');
      
      // Date formatting: either dd/MM/yyyy or yyyy-mm-dd
      let dateVal = sale.custom_data?.sale_date;
      if (!dateVal) {
        const d = new Date(sale.created_at);
        dateVal = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      setSaleDate(dateVal);

      setMainProduct(sale.custom_data?.main_product || 'Graduação');
      const resolvedChannel = getSaleFdiDisplay(sale);
      setFdiChannel((resolvedChannel as ProductChannelFDI) || 'Simplificada');
      setModality(sale.custom_data?.modality || 'Presencial');
      setShift(sale.custom_data?.shift || 'Noite');
      setParcelaLeve(sale.custom_data?.parcela_leve || 'Sem parcelas');
      setHasBolsaConvenio(!!sale.custom_data?.has_bolsa_convenio);
      setEmpresaConvenio(sale.custom_data?.empresa_convenio || '');
      setValue(Number(sale.value) || 0);
      setStatus(sale.status || 'Aprovada');
      setNotes(sale.notes || '');

      setConfirmDelete(false);
      setErrorMessage(null);
      setSuccessToast(null);
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  // Verify that the user is an admin
  const isAdmin = currentUser?.role === 'admin';
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
          <p className="text-xs text-slate-500">
            Apenas usuários com cargo de Administrador possuem permissão para editar lançamentos de vendas já registrados.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setErrorMessage('O nome do candidato / aluno é obrigatório.');
      return;
    }
    if (!opportunityNumber.trim()) {
      setErrorMessage('O número da oportunidade é obrigatório.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const selectedSeller = profiles.find(p => p.id === sellerId);
      const chosenSellerName = selectedSeller?.name || sale.seller_name || 'Consultor';
      const chosenSellerId = selectedSeller?.id || sellerId || sale.seller_id;
      const chosenSellerEmail = selectedSeller?.email || sale.seller_email;
      
      const updatedFields: Partial<Sale> = {
        client_name: candidateName.trim(),
        value: Number(value) || 0,
        status,
        notes: notes.trim(),
        product_name: `${mainProduct} - ${modality} (${shift})`,
        fdi: fdiChannel,
        seller_id: chosenSellerId,
        seller_name: chosenSellerName,
        seller_email: chosenSellerEmail,
        custom_data: {
          ...(sale.custom_data || {}),
          opportunity_number: opportunityNumber.trim(),
          candidate_name: candidateName.trim(),
          collaborator_name: chosenSellerName,
          seller_name: chosenSellerName,
          seller_id: chosenSellerId,
          seller_email: chosenSellerEmail,
          sale_date: saleDate.trim(),
          main_product: mainProduct,
          fdi: fdiChannel,
          fdi_channel: fdiChannel,
          modality,
          shift,
          parcela_leve: parcelaLeve,
          has_bolsa_convenio: hasBolsaConvenio,
          empresa_convenio: hasBolsaConvenio ? empresaConvenio.trim() : '',
          business_unit: modality === 'EAD' || modality === 'FLEX' || modality === 'Pós Digital' ? 'BU Digital' : 'BU Presencial',
        }
      };

      const result = await updateSale(sale.id, updatedFields);
      setIsSaving(false);

      if (result.success) {
        setSuccessToast('Venda atualizada com sucesso!');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 800);
      } else {
        setErrorMessage(result.error || 'Erro ao salvar alterações.');
      }
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err?.message || 'Erro inesperado ao salvar alterações.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    const result = await deleteSale(sale.id);
    setIsDeleting(false);

    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMessage(result.error || 'Erro ao excluir venda.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk']">
                  Editar Lançamento de Venda
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Oportunidade #{opportunityNumber || sale.id} • Modificação autorizada de registro
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback notifications */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          {/* Row 1: Colaborador (Vendedor) & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Colaborador / Vendedor</span>
              </label>
              <select
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role === 'admin' ? 'Admin' : 'Membro'} • {p.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Data do Lançamento</span>
              </label>
              <input
                type="text"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                placeholder="Ex: 01/09/2026"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Row 2: Número da Oportunidade & Nome do Candidato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-blue-600" />
                <span>Número da Oportunidade</span>
              </label>
              <input
                type="text"
                value={opportunityNumber}
                onChange={(e) => setOpportunityNumber(e.target.value)}
                placeholder="Ex: 955552929"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Nome do Candidato / Aluno</span>
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Nome completo do aluno"
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-semibold"
              />
            </div>
          </div>

          {/* Row 3: Produto Principal & Canal (FDI) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>Produto Principal</span>
              </label>
              <select
                value={mainProduct}
                onChange={(e) => {
                  const newProduct = e.target.value as MainProductType;
                  setMainProduct(newProduct);
                  if (isFdiChannelDisabled(fdiChannel, newProduct)) {
                    if (newProduct === 'Graduação') setFdiChannel('Vestibular');
                    else if (newProduct === 'Pós Graduação') setFdiChannel('Pós Graduação');
                    else if (newProduct === 'Curso Técnico') setFdiChannel('Técnico');
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors font-semibold"
              >
                <option value="Graduação">Graduação</option>
                <option value="Pós Graduação">Pós Graduação</option>
                <option value="Curso Técnico">Curso Técnico</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Produto / Canal (FDI)</span>
              </label>
              <select
                value={fdiChannel}
                onChange={(e) => setFdiChannel(e.target.value as ProductChannelFDI)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {FDI_CHANNELS.map(ch => {
                  const isDisabled = isFdiChannelDisabled(ch, mainProduct);
                  return (
                    <option key={ch} value={ch} disabled={isDisabled}>
                      {ch} {isDisabled ? '(Indisponível)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Row 4: Modalidade & Turno */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Modalidade</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as ModalityType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="Presencial">Presencial</option>
                <option value="Semipresencial">Semipresencial</option>
                <option value="Ao Vivo">Ao Vivo</option>
                <option value="EAD">EAD</option>
                <option value="FLEX">FLEX</option>
                <option value="Técnico Presencial">Técnico Presencial</option>
                <option value="Pós Presencial">Pós Presencial</option>
                <option value="Pós Ao Vivo">Pós Ao Vivo</option>
                <option value="Pós Digital">Pós Digital</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Turno</span>
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="Noite">Noite</option>
                <option value="Manhã">Manhã</option>
                <option value="Virtual">Virtual / EAD</option>
                <option value="Manhã e Noite">Manhã e Noite</option>
              </select>
            </div>
          </div>

          {/* Row 5: Condições de Pagamento & Bolsa Convênio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Parcela Leve</span>
              </label>
              <select
                value={parcelaLeve}
                onChange={(e) => setParcelaLeve(e.target.value as ParcelaLeveOption)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {PARCELA_LEVE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Bolsa Convênio & Empresa</span>
              </label>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBolsaConvenio}
                    onChange={(e) => setHasBolsaConvenio(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">Possui Bolsa Convênio Empresa</span>
                </label>

                {hasBolsaConvenio && (
                  <input
                    type="text"
                    value={empresaConvenio}
                    onChange={(e) => setEmpresaConvenio(e.target.value)}
                    placeholder="Qual Empresa Parceira?"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                )}
              </div>
            </div>
          </div>


          {/* Row 7: Observações */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Observações (Opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anotações internas, canal de captação, etc."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
            
            {/* Delete button on the left for Admin */}
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-red-600 font-semibold">Confirmar?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              )}
            </div>

            {/* Right: Cancel & Save */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>

          </div>

        </form>

      </div>
    </div>
  );
};
