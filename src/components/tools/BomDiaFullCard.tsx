import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { Target, CalendarDays, ChartColumnIncreasing, Trophy, Users } from 'lucide-react';
import type { BusinessUnit, FunilSavaResult } from '../../lib/bomDiaParser';
import estacioLogo from '../../assets/estacio-logo.png';

interface BomDiaFullCardProps {
  presencial: FunilSavaResult | null;
  digital: FunilSavaResult | null;
}

export const BOM_DIA_CARD_WIDTH = 1200;

const NAVY = '#0B2B64';
const ROYAL = '#0E4DA4';
const TEAL = '#16AFC9';
const GOLD = '#FFB800';
const BLUE = '#1565D8';
const GREEN = '#00A651';
const RED = '#E53935';

const BU_LABEL: Record<BusinessUnit, string> = {
  presencial: 'BU PRESENCIAL',
  digital: 'BU DIGITAL',
};

const BU_DESCRICAO: Record<BusinessUnit, string> = {
  presencial: 'A BU Presencial contempla as modalidades Presencial, Semipresencial e Ao Vivo.',
  digital: 'A BU Digital contempla a modalidade EAD e a FLEX.',
};

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');

function corDoRealizado(realizado: number, metaDoDia: number): string {
  const r = Math.round(realizado);
  const m = Math.round(metaDoDia);
  if (r > m) return GREEN;
  if (r < m) return RED;
  return BLUE;
}

const tri = (polygon: string, bg: string, extra: CSSProperties): CSSProperties => ({
  position: 'absolute',
  clipPath: `polygon(${polygon})`,
  background: bg,
  ...extra,
});

function Dots({ cols, rows, style }: { cols: number; rows: number; style: CSSProperties }) {
  return (
    <div className="absolute grid gap-[10px]" style={{ gridTemplateColumns: `repeat(${cols}, 6px)`, ...style }}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="w-[6px] h-[6px] rounded-full bg-white" />
      ))}
    </div>
  );
}

export const BomDiaFullCard = forwardRef<HTMLDivElement, BomDiaFullCardProps>(({ presencial, digital }, ref) => {
  const colunas: { bu: BusinessUnit; resultado: FunilSavaResult | null; col: number }[] = [
    { bu: 'presencial', resultado: presencial, col: 1 },
    { bu: 'digital', resultado: digital, col: 2 },
  ];

  return (
    <div
      ref={ref}
      className="relative overflow-hidden font-sans select-none bg-gradient-to-br from-[#F7FAFE] to-[#EAF2FB] px-9 pt-6 pb-6"
      style={{ width: BOM_DIA_CARD_WIDTH }}
    >
      {/* Decorações */}
      <div style={tri('0 0, 100% 0, 100% 100%', ROYAL, { top: 0, right: 0, width: 330, height: 150 })} />
      <div style={tri('45% 0, 100% 0, 100% 75%', NAVY, { top: 0, right: 0, width: 330, height: 150 })} />
      <Dots cols={6} rows={3} style={{ top: 20, right: 44 }} />

      <div style={tri('0 0, 100% 100%, 0 100%', TEAL, { bottom: 0, left: 0, width: 210, height: 130 })} />
      <Dots cols={4} rows={3} style={{ bottom: 22, left: 22 }} />

      <div style={tri('100% 0, 100% 100%, 0 100%', ROYAL, { bottom: 0, right: 0, width: 340, height: 95 })} />
      <div style={tri('100% 45%, 100% 100%, 30% 100%', TEAL, { bottom: 0, right: 0, width: 340, height: 95 })} />
      <div style={tri('100% 60%, 100% 100%, 65% 100%', NAVY, { bottom: 0, right: 0, width: 340, height: 95 })} />

      {/* Cabeçalho */}
      <div className="relative flex items-center gap-2.5">
        <img src={estacioLogo} alt="Estácio" className="w-[36px] h-[36px]" />
        <span className="font-black text-[30px] leading-none tracking-tight" style={{ color: NAVY }}>
          Estácio
        </span>
      </div>

      <h1 className="relative mt-5 font-black text-[40px] leading-none tracking-tight" style={{ color: NAVY }}>
        ACOMPANHAMENTO DE CAPTAÇÃO
      </h1>

      {/* Colunas — cada linha do grid é compartilhada pelas duas BUs, garantindo o alinhamento */}
      <div className="relative mt-5 grid grid-cols-2 gap-x-10">
        {colunas.map(({ bu, col }) => (
          <p
            key={`label-${bu}`}
            className="font-black text-[32px] leading-none tracking-tight"
            style={{ color: TEAL, gridColumn: col, gridRow: 1 }}
          >
            {BU_LABEL[bu]}
          </p>
        ))}

        {colunas.map(({ bu, col }) => (
          <div key={`desc-${bu}`} className="mt-3 flex items-center gap-3.5" style={{ gridColumn: col, gridRow: 2 }}>
            <Users className="w-[46px] h-[46px] shrink-0" style={{ color: TEAL }} strokeWidth={1.6} />
            <div className="w-px self-stretch" style={{ background: `${NAVY}40` }} />
            <p className="text-[15px] leading-snug font-medium max-w-[300px]" style={{ color: NAVY }}>
              {BU_DESCRICAO[bu]}
            </p>
          </div>
        ))}

        {colunas.map(({ bu, resultado, col }) =>
          resultado ? (
            <Tiles key={`tiles-${bu}`} resultado={resultado} col={col} />
          ) : (
            <div
              key={`vazio-${bu}`}
              className="mt-4 rounded-xl border-2 border-dashed flex items-center justify-center"
              style={{ gridColumn: col, gridRow: '3 / span 2', borderColor: `${NAVY}33` }}
            >
              <p className="text-[18px] font-bold" style={{ color: `${NAVY}66` }}>
                Aguardando o PDF da {BU_LABEL[bu]}
              </p>
            </div>
          )
        )}

        {colunas.map(({ bu, resultado, col }) =>
          resultado ? <Status key={`status-${bu}`} resultado={resultado} col={col} /> : null
        )}
      </div>

      {/* Banner */}
      <div
        className="relative mx-auto mt-5 w-[580px] rounded-xl flex items-center justify-center gap-4 py-3.5"
        style={{ background: NAVY }}
      >
        <Trophy className="w-[40px] h-[40px] shrink-0" style={{ color: TEAL }} strokeWidth={2} />
        <p className="text-white font-black text-[25px] leading-none tracking-tight">VAMOS JUNTOS FAZER ACONTECER! 💪</p>
      </div>

      {/* Rodapé */}
      <div className="relative mt-4 flex items-center justify-center gap-2">
        <img src={estacioLogo} alt="Estácio" className="w-[28px] h-[28px]" />
        <span className="font-black text-[22px] leading-none" style={{ color: NAVY }}>
          Estácio
        </span>
      </div>
    </div>
  );
});

BomDiaFullCard.displayName = 'BomDiaFullCard';

function Tiles({ resultado, col }: { resultado: FunilSavaResult; col: number }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2" style={{ gridColumn: col, gridRow: 3 }}>
      <Tile icon={<Target className="w-[20px] h-[20px]" />} label={['META FINAL']} headerBg={ROYAL} valueColor={GOLD}>
        {fmt(resultado.metaFinal)}
      </Tile>
      <Tile icon={<CalendarDays className="w-[20px] h-[20px]" />} label={['META DO DIA']} headerBg={TEAL} valueColor={BLUE}>
        {fmt(resultado.metaDoDia)}
      </Tile>
      <Tile
        icon={<ChartColumnIncreasing className="w-[20px] h-[20px]" />}
        label={['REALIZADO ATÉ', 'O MOMENTO']}
        headerBg={NAVY}
        valueColor={corDoRealizado(resultado.realizado, resultado.metaDoDia)}
      >
        {fmt(resultado.realizado)}
      </Tile>
    </div>
  );
}

function Tile({
  icon,
  label,
  headerBg,
  valueColor,
  children,
}: {
  icon: ReactNode;
  label: string[];
  headerBg: string;
  valueColor: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-[#D3E1F2] shadow-[0_2px_6px_rgba(11,43,100,0.08)]">
      <div className="h-[64px] flex items-center gap-2 px-2.5 text-white" style={{ background: headerBg }}>
        <div className="w-[34px] h-[34px] rounded-full bg-black/15 flex items-center justify-center shrink-0">{icon}</div>
        <span className="font-black text-[14px] leading-[1.15] tracking-tight">
          {label.map((linha) => (
            <span key={linha} className="block whitespace-nowrap">
              {linha}
            </span>
          ))}
        </span>
      </div>
      <div className="h-[78px] flex items-center justify-center">
        <span className="font-black text-[56px] leading-none tracking-tight" style={{ color: valueColor }}>
          {children}
        </span>
      </div>
    </div>
  );
}

function ArrowDownFilled() {
  return (
    <svg viewBox="0 0 24 24" className="w-[34px] h-[34px]">
      <path d="M8.5 3h7v8.5h5L12 21.5 3.5 11.5h5z" fill={GOLD} strokeLinejoin="round" />
    </svg>
  );
}

function Status({ resultado, col }: { resultado: FunilSavaResult; col: number }) {
  const devendo = Math.max(0, Math.round(resultado.metaDoDia - resultado.realizado));
  const faltam = Math.max(0, Math.round(resultado.metaFinal - resultado.realizado));

  return (
    <div className="mt-5 flex flex-col" style={{ gridColumn: col, gridRow: 4 }}>
      <div
        className="self-start rounded-t-lg px-6 py-1.5 text-white font-black text-[18px] tracking-wide"
        style={{ background: NAVY }}
      >
        STATUS
      </div>
      <div className="flex-1 rounded-b-xl rounded-tr-xl bg-[#E3EDF9] px-6">
        <StatusLinha
          icone={<ArrowDownFilled />}
          corBorda={GOLD}
          inicio="Estamos devendo"
          numero={fmt(devendo)}
          corNumero={GOLD}
          fimLinha1="matrículas"
          linha2="para atingirmos a meta do dia."
        />
        <div className="h-px" style={{ background: `${NAVY}22` }} />
        <StatusLinha
          icone={<ChartColumnIncreasing className="w-[30px] h-[30px]" style={{ color: GREEN }} strokeWidth={2.5} />}
          corBorda={GREEN}
          inicio="Faltam"
          numero={fmt(faltam)}
          corNumero={GREEN}
          linha2="para alcançarmos a meta final."
        />
      </div>
    </div>
  );
}

function StatusLinha({
  icone,
  corBorda,
  inicio,
  numero,
  corNumero,
  fimLinha1,
  linha2,
}: {
  icone: ReactNode;
  corBorda: string;
  inicio: string;
  numero: string;
  corNumero: string;
  fimLinha1?: string;
  linha2: string;
}) {
  return (
    <div className="flex items-center gap-5 py-3.5">
      <div
        className="w-[62px] h-[62px] rounded-full bg-white border-2 flex items-center justify-center shrink-0"
        style={{ borderColor: corBorda }}
      >
        {icone}
      </div>
      <div className="text-[19px] leading-tight font-semibold" style={{ color: NAVY }}>
        <div className="flex items-baseline gap-2.5">
          <span>{inicio}</span>
          <span className="font-black text-[44px] leading-none" style={{ color: corNumero }}>
            {numero}
          </span>
          {fimLinha1 && <span>{fimLinha1}</span>}
        </div>
        <div className="mt-0.5">{linha2}</div>
      </div>
    </div>
  );
}
