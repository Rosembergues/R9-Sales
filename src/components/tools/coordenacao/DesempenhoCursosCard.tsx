import React, { forwardRef } from 'react';
import { ArrowDown, ArrowUp, ChartNoAxesColumn, ClipboardList, Goal, Minus, Users } from 'lucide-react';
import { formatarInteiro, formatarPct, type CorDesempenho, type Desempenho } from '../../../lib/coordenacao';

// Reproduz o slide "Desempenho Cursos x Meta" (16:9). Exportado em 1920x1080 (pixelRatio 1.5).
export const DESEMPENHO_CARD_W = 1280;
export const DESEMPENHO_CARD_H = 720;

const NAVY = '#071F54';
const TEAL = '#00808C';
const ICON_TEAL = '#1A9AA0';
const TEXTO_LEGENDA = '#2B3A55';
const COR_FUNDO: Record<CorDesempenho, string> = {
  verde: '#70AD47',
  amarelo: '#FFE666',
  vermelho: '#FF0000',
  sem_meta: '#D9D9D9',
};

// Larguras das colunas medidas na arte de referência (escala 1280px).
const COLS = [203, 417, 77, 78, 86, 98];
const TABELA_W = COLS.reduce((a, b) => a + b, 0);
const LINHA_H = 26.8;

// Roboto Condensed vem do Google Fonts (index.html), então a arte sai igual em qualquer computador.
const FONT = '"Roboto Condensed", "Aptos Narrow", "Arial Narrow", Arial, sans-serif';
const FONT_TITULO = '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';

const cell: React.CSSProperties = {
  border: '1px solid #000',
  height: LINHA_H,
  padding: '0 6px 3px',
  lineHeight: 1,
  fontSize: 17,
  verticalAlign: 'bottom',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const esq: React.CSSProperties = { ...cell, textAlign: 'left' };
const dir: React.CSSProperties = { ...cell, textAlign: 'right' };

interface Props {
  dados: Desempenho;
  titulo?: string;
}

export const DesempenhoCursosCard = forwardRef<HTMLDivElement, Props>(({ dados, titulo }, ref) => {
  const head = (texto: React.ReactNode, cor: string, i: number) => (
    <th
      key={i}
      style={{
        background: cor,
        color: '#fff',
        border: '1px solid #000',
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1.15,
        height: 54,
        padding: '5px 4px 0',
        verticalAlign: 'top',
        textAlign: 'center',
        width: COLS[i],
      }}
    >
      {texto}
    </th>
  );

  const total: React.CSSProperties = { background: TEAL, fontWeight: 700 };

  return (
    <div
      ref={ref}
      style={{
        width: DESEMPENHO_CARD_W,
        height: DESEMPENHO_CARD_H,
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        fontFamily: FONT,
        color: '#000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 30,
          top: 10,
          width: 792,
          height: 48,
          background: NAVY,
          borderRadius: 10,
          color: '#fff',
          fontFamily: FONT_TITULO,
          fontWeight: 800,
          fontSize: 27,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: 0.2,
        }}
      >
        {titulo || 'DESEMPENHO CURSOS X META'}
      </div>

      <table
        style={{
          position: 'absolute',
          left: 30,
          top: 64,
          width: TABELA_W,
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          {COLS.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {head('COORDENADOR', TEAL, 0)}
            {head('CURSO', TEAL, 1)}
            {head(<>META<br />DIA</>, NAVY, 2)}
            {head('ATUAL', NAVY, 3)}
            {head(<>META<br />FECH</>, NAVY, 4)}
            {head(<>% META<br />DIA</>, NAVY, 5)}
          </tr>
        </thead>
        <tbody>
          {dados.linhas.map((l) => (
            <tr key={l.curso}>
              <td style={esq}>{l.coordenador}</td>
              <td style={esq}>{l.curso}</td>
              <td style={dir}>{formatarInteiro(l.metaDia)}</td>
              <td style={dir}>{formatarInteiro(l.atual)}</td>
              <td style={dir}>{formatarInteiro(l.metaFech)}</td>
              <td style={{ ...dir, background: COR_FUNDO[l.cor] }}>{formatarPct(l.pct)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...esq, ...total }} />
            <td style={{ ...esq, ...total, fontWeight: 400, fontSize: 19 }}>Total</td>
            <td style={{ ...dir, ...total }}>{formatarInteiro(dados.total.metaDia)}</td>
            <td style={{ ...dir, ...total }}>{formatarInteiro(dados.total.atual)}</td>
            <td style={{ ...dir, ...total }}>{formatarInteiro(dados.total.metaFech)}</td>
            <td style={{ ...dir, ...total }}>{formatarPct(dados.total.pct)}</td>
          </tr>
        </tbody>
      </table>

      <Legenda />
      <Rodape />
    </div>
  );
});
DesempenhoCursosCard.displayName = 'DesempenhoCursosCard';

const LEGENDA_ITENS = [
  { cor: '#1E9A3E', icone: <ArrowUp />, titulo: 'Acima da meta', texto: ['Desempenho positivo', 'em relação à meta.'] },
  { cor: '#E9B500', icone: <Minus />, titulo: 'Atenção', texto: ['Resultado abaixo da', 'meta, com oportunidade', 'de melhoria.'] },
  { cor: '#C8202A', icone: <ArrowDown />, titulo: 'Abaixo da meta', texto: ['Desempenho abaixo do', 'esperado.'] },
];

function Legenda() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 999,
        top: 161,
        width: 246,
        height: 436,
        background: '#fff',
        border: '1.5px solid #E1E7EF',
        borderRadius: 18,
        boxShadow: '0 2px 10px rgba(7,31,84,0.06)',
        padding: '30px 14px 30px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: FONT_TITULO,
      }}
    >
      {LEGENDA_ITENS.map((it) => (
        <div key={it.titulo} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: it.cor,
              color: '#fff',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {React.cloneElement(it.icone, { size: 24, strokeWidth: 3 })}
          </div>
          <div style={{ paddingTop: 2 }}>
            <div style={{ color: it.cor, fontWeight: 800, fontSize: 16 }}>{it.titulo}</div>
            <div
              style={{ color: TEXTO_LEGENDA, fontSize: 12.5, lineHeight: 1.4, marginTop: 4, fontWeight: 500, whiteSpace: 'nowrap' }}
            >
              {it.texto.map((t) => (
                <div key={t}>{t}</div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const RODAPE_ITENS = [
  { icone: <Goal size={40} strokeWidth={1.8} />, texto: ['ACOMPANHAMENTO', 'DE METAS'] },
  {
    icone: (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `2.5px solid ${ICON_TEAL}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChartNoAxesColumn size={22} strokeWidth={2.6} />
      </div>
    ),
    texto: ['ANÁLISE DE', 'DESEMPENHO'],
  },
  { icone: <ClipboardList size={40} strokeWidth={1.8} />, texto: ['GESTÃO POR', 'RESULTADOS'] },
  { icone: <Users size={42} strokeWidth={1.8} />, texto: ['FOCO EM', 'CONVERSÃO'] },
];

function Rodape() {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 26,
          top: 638,
          width: 1030,
          height: 68,
          background: '#F4F7FB',
          border: '1.5px solid #D9E2EC',
          borderRadius: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 30px',
          fontFamily: FONT_TITULO,
        }}
      >
        {RODAPE_ITENS.map((it) => (
          <div key={it.texto[0]} style={{ display: 'flex', alignItems: 'center', gap: 14, color: ICON_TEAL }}>
            {it.icone}
            <div style={{ color: '#1E3A5F', fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>
              {it.texto.map((t) => (
                <div key={t}>{t}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <svg
        width={200}
        height={84}
        viewBox="0 0 200 84"
        style={{ position: 'absolute', right: 0, bottom: 0 }}
        preserveAspectRatio="none"
      >
        <path d="M0 84 C 70 70, 140 40, 200 0 L200 84 Z" fill={ICON_TEAL} />
        <path d="M18 84 C 85 72, 150 46, 200 12 L200 84 Z" fill={NAVY} />
      </svg>
    </>
  );
}
