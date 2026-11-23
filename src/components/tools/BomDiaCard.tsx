import React, { forwardRef } from 'react';
import { Target, CalendarCheck, TrendingUp, ArrowDown, Trophy, Users } from 'lucide-react';
import type { BusinessUnit } from '../../lib/bomDiaParser';

interface BomDiaCardProps {
  bu: BusinessUnit;
  academicPeriod: string;
  metaFinal: number;
  metaDoDia: number;
  realizado: number;
}

const BU_LABEL: Record<BusinessUnit, string> = {
  presencial: 'BU PRESENCIAL',
  digital: 'BU DIGITAL',
};

const BU_DESCRICAO: Record<BusinessUnit, string> = {
  presencial: 'A BU Presencial contempla as modalidades Presencial, Semipresencial e Ao Vivo.',
  digital: 'A BU Digital contempla a modalidade Digital (EAD).',
};

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

export const BomDiaCard = forwardRef<HTMLDivElement, BomDiaCardProps>(
  ({ bu, academicPeriod, metaFinal, metaDoDia, realizado }, ref) => {
    const devendo = Math.max(0, Math.round(metaDoDia - realizado));
    const faltam = Math.max(0, Math.round(metaFinal - realizado));
    const metaBatida = faltam === 0;

    return (
      <div
        ref={ref}
        className="w-[340px] bg-[#EAF3FC] rounded-[20px] overflow-hidden relative flex flex-col p-5 font-sans select-none"
      >
        {/* Cabeçalho */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#16AFC9] to-[#0B2B64] shrink-0" />
          <span className="text-[#0B2B64] font-black text-lg tracking-tight">Estácio</span>
        </div>

        {/* Título */}
        <div className="mt-5">
          <h1 className="text-[#0B2B64] font-black text-[22px] leading-[1.08] tracking-tight">
            ACOMPANHAMENTO
            <br />
            DE CAPTAÇÃO
          </h1>
          <p className="text-[#16AFC9] font-black text-[17px] mt-0.5 tracking-tight">{BU_LABEL[bu]}</p>
        </div>

        {/* Subtítulo com ícone */}
        <div className="mt-3 flex items-start gap-2">
          <Users className="w-5 h-5 text-[#16AFC9] shrink-0 mt-0.5" strokeWidth={2} />
          <p className="text-[11px] leading-snug text-[#0B2B64]/80 font-medium">
            {BU_DESCRICAO[bu]}
            <br />
            <span className="opacity-70">Ciclo {academicPeriod}</span>
          </p>
        </div>

        {/* Tiles de metas */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Tile icon={<Target className="w-3.5 h-3.5 text-white" />} label="META FINAL" value={fmt(metaFinal)} headerBg="#0B2B64" />
          <Tile icon={<CalendarCheck className="w-3.5 h-3.5 text-white" />} label="META DO DIA" value={fmt(metaDoDia)} headerBg="#16AFC9" />
          <Tile icon={<TrendingUp className="w-3.5 h-3.5 text-white" />} label="REALIZADO ATÉ O MOMENTO" value={fmt(realizado)} headerBg="#0B2B64" />
        </div>

        {/* Status */}
        <div className="mt-4">
          <div className="bg-[#0B2B64] text-white font-black text-[11px] tracking-wide px-3 py-1.5 rounded-t-lg inline-block">
            STATUS
          </div>
          <div className="bg-white/70 rounded-b-lg rounded-tr-lg p-3 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white border border-[#FFC000]/40 flex items-center justify-center shrink-0">
                <ArrowDown className="w-3.5 h-3.5 text-[#FFC000]" strokeWidth={3} />
              </div>
              <p className="text-[11px] leading-tight text-[#0B2B64] font-semibold">
                Estamos devendo <span className="text-[#FFC000] font-black">{fmt(devendo)}</span> matrículas para
                atingirmos a meta do dia.
              </p>
            </div>
            <div className="h-px bg-[#0B2B64]/10" />
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white border border-[#00B050]/40 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-[#00B050]" strokeWidth={3} />
              </div>
              <p className="text-[11px] leading-tight text-[#0B2B64] font-semibold">
                Faltam <span className="text-[#00B050] font-black">{fmt(faltam)}</span> para alcançarmos a meta
                final.
              </p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="mt-4 bg-[#0B2B64] rounded-xl px-3 py-2.5 flex items-center gap-2.5">
          <Trophy className="w-6 h-6 text-[#16AFC9] shrink-0" strokeWidth={2} />
          <p className="text-[11px] leading-tight font-black">
            <span className="text-[#16AFC9]">
              {metaBatida ? 'META BATIDA! PARABÉNS, TIME!' : 'FALTA POUCO PARA CHEGARMOS LÁ!'}
            </span>
            <br />
            <span className="text-white">VAMOS JUNTOS FAZER ACONTECER! 💪</span>
          </p>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-center gap-1.5 pt-4">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[#16AFC9] to-[#0B2B64]" />
          <span className="text-[#0B2B64] font-black text-xs">Estácio</span>
        </div>
      </div>
    );
  }
);

BomDiaCard.displayName = 'BomDiaCard';

function Tile({ icon, label, value, headerBg }: { icon: React.ReactNode; label: string; value: string; headerBg: string }) {
  return (
    <div className="rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-1 px-1.5 py-1.5" style={{ backgroundColor: headerBg }}>
        {icon}
        <span className="text-white font-black text-[8px] leading-[1.05] tracking-tight">{label}</span>
      </div>
      <div className="flex-1 flex items-center justify-center py-2.5">
        <span className="text-[#0B2B64] font-black text-xl">{value}</span>
      </div>
    </div>
  );
}
