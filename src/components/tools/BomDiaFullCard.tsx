import { forwardRef, type ReactNode } from 'react';
import { Target, CalendarCheck, TrendingUp, ArrowDown, Trophy, Users } from 'lucide-react';
import type { BusinessUnit, FunilSavaResult } from '../../lib/bomDiaParser';
import estacioLogo from '../../assets/estacio-logo.png';

interface BomDiaFullCardProps {
  presencial: FunilSavaResult | null;
  digital: FunilSavaResult | null;
}

const BU_LABEL: Record<BusinessUnit, string> = {
  presencial: 'BU PRESENCIAL',
  digital: 'BU DIGITAL',
};

const BU_DESCRICAO: Record<BusinessUnit, string> = {
  presencial: 'A BU Presencial contempla as modalidades Presencial, Semipresencial e Ao Vivo.',
  digital: 'A BU Digital contempla a modalidade EAD e a FLEX.',
};

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

export const BomDiaFullCard = forwardRef<HTMLDivElement, BomDiaFullCardProps>(
  ({ presencial, digital }, ref) => {
    return (
      <div
        ref={ref}
        className="w-[1040px] bg-[#EFF5FC] rounded-[24px] relative overflow-hidden flex flex-col p-10 font-sans select-none"
      >
        {/* Decoração canto superior direito */}
        <div className="absolute top-0 right-0 w-[280px] h-[220px] overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 right-0 w-[60px] h-[260px] bg-gradient-to-b from-[#8FD9C4] to-[#16AFC9]"
            style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />
          <div
            className="absolute top-0 right-0 w-[240px] h-[240px] bg-[#0B2B64]"
            style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />
          <div className="absolute top-7 right-10 grid grid-cols-5 gap-2.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-[5px] h-[5px] rounded-full bg-white/80" />
            ))}
          </div>
        </div>

        {/* Decoração canto inferior esquerdo */}
        <div className="absolute bottom-0 left-0 w-[240px] h-[170px] overflow-hidden pointer-events-none">
          <div
            className="absolute bottom-0 left-0 w-[240px] h-[150px] bg-[#16AFC9]"
            style={{ clipPath: 'polygon(0 100%, 0 0, 100% 100%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[150px] h-[95px] bg-[#0B2B64]"
            style={{ clipPath: 'polygon(0 100%, 0 0, 100% 100%)' }}
          />
          <div
            className="absolute bottom-0 left-0 w-[75px] h-[48px] bg-[#8FD9C4]"
            style={{ clipPath: 'polygon(0 100%, 0 0, 100% 100%)' }}
          />
        </div>

        {/* Cabeçalho */}
        <div className="relative z-10 flex items-center gap-2.5">
          <img src={estacioLogo} alt="Estácio" className="w-9 h-9 shrink-0" />
          <span className="text-[#0B2B64] font-black text-2xl tracking-tight">Estácio</span>
        </div>

        {/* Título */}
        <h1 className="relative z-10 mt-6 text-[#0B2B64] font-black text-[34px] leading-tight tracking-tight">
          ACOMPANHAMENTO DE CAPTAÇÃO
        </h1>

        {/* Colunas das BUs */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-8">
          <BuColumn bu="presencial" resultado={presencial} />
          <BuColumn bu="digital" resultado={digital} />
        </div>

        {/* Banner */}
        <div className="relative z-10 mt-6 bg-[#0B2B64] rounded-2xl px-6 py-3.5 flex items-center justify-center gap-3">
          <Trophy className="w-7 h-7 text-[#FFC000] shrink-0" strokeWidth={2} />
          <p className="text-white font-black text-lg tracking-tight">VAMOS JUNTOS FAZER ACONTECER! 💪</p>
        </div>

        {/* Rodapé */}
        <div className="relative z-10 flex items-center justify-center gap-2 pt-6">
          <img src={estacioLogo} alt="Estácio" className="w-6 h-6" />
          <span className="text-[#0B2B64] font-black text-sm">Estácio</span>
        </div>
      </div>
    );
  }
);

BomDiaFullCard.displayName = 'BomDiaFullCard';

function BuColumn({ bu, resultado }: { bu: BusinessUnit; resultado: FunilSavaResult | null }) {
  if (!resultado) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#0B2B64]/20 flex items-center justify-center min-h-[280px]">
        <p className="text-xs font-semibold text-[#0B2B64]/40 text-center px-6">
          Aguardando o PDF da {BU_LABEL[bu]}
        </p>
      </div>
    );
  }

  const devendo = Math.max(0, Math.round(resultado.metaDoDia - resultado.realizado));
  const faltam = Math.max(0, Math.round(resultado.metaFinal - resultado.realizado));

  return (
    <div>
      <p className="text-[#16AFC9] font-black text-2xl tracking-tight">{BU_LABEL[bu]}</p>

      <div className="mt-2 flex items-start gap-2.5">
        <Users className="w-5 h-5 text-[#16AFC9] shrink-0 mt-0.5" strokeWidth={2} />
        <p className="text-[13px] leading-snug text-[#0B2B64]/80 font-medium">{BU_DESCRICAO[bu]}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Tile icon={<Target className="w-4 h-4 text-white" />} label="META FINAL" value={fmt(resultado.metaFinal)} headerBg="#0B2B64" />
        <Tile icon={<CalendarCheck className="w-4 h-4 text-white" />} label="META DO DIA" value={fmt(resultado.metaDoDia)} headerBg="#16AFC9" />
        <Tile icon={<TrendingUp className="w-4 h-4 text-white" />} label="REALIZADO ATÉ O MOMENTO" value={fmt(resultado.realizado)} headerBg="#0B2B64" />
      </div>

      <div className="mt-4">
        <div className="bg-[#0B2B64] text-white font-black text-xs tracking-wide px-3.5 py-1.5 rounded-t-lg inline-block">
          STATUS
        </div>
        <div className="bg-white/70 rounded-b-xl rounded-tr-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-[#FFC000]/40 flex items-center justify-center shrink-0">
              <ArrowDown className="w-4 h-4 text-[#FFC000]" strokeWidth={3} />
            </div>
            <p className="text-[13px] leading-tight text-[#0B2B64] font-semibold">
              Estamos devendo <span className="text-[#FFC000] font-black">{fmt(devendo)}</span> matrículas para
              atingirmos a meta do dia.
            </p>
          </div>
          <div className="h-px bg-[#0B2B64]/10" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-[#00B050]/40 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#00B050]" strokeWidth={3} />
            </div>
            <p className="text-[13px] leading-tight text-[#0B2B64] font-semibold">
              Faltam <span className="text-[#00B050] font-black">{fmt(faltam)}</span> para alcançarmos a meta
              final.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, headerBg }: { icon: ReactNode; label: string; value: string; headerBg: string }) {
  return (
    <div className="rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-1 px-1.5 py-1.5" style={{ backgroundColor: headerBg }}>
        {icon}
        <span className="text-white font-black text-[8px] leading-[1.05] tracking-tight">{label}</span>
      </div>
      <div className="flex-1 flex items-center justify-center py-3">
        <span className="text-[#0B2B64] font-black text-xl">{value}</span>
      </div>
    </div>
  );
}
