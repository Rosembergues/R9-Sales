import React, { forwardRef } from 'react';
import legendaImg from '../../../assets/coordenacao/legenda.png';
import rodapeImg from '../../../assets/coordenacao/rodape.png';
import { formatarInteiro, formatarPct, type CorDesempenho, type Desempenho } from '../../../lib/coordenacao';

// Reproduz o slide "Desempenho Cursos x Meta" (16:9). Exportado em 1920x1080 (pixelRatio 1.5).
export const DESEMPENHO_CARD_W = 1280;
export const DESEMPENHO_CARD_H = 720;

const NAVY = '#071F54';
const TEAL = '#00808C';
const COR_FUNDO: Record<CorDesempenho, string> = {
  verde: '#70AD47',
  amarelo: '#FFE666',
  vermelho: '#FF0000',
  sem_meta: '#D9D9D9',
};

// Larguras das colunas do slide original (convertidas para 1280px de largura).
const COLS = [201, 415, 77, 77, 87, 96];
const FONT = '"Aptos Narrow", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';

const cell: React.CSSProperties = {
  border: '1px solid #000',
  padding: '0 4px',
  height: 26.85,
  lineHeight: 1,
  fontSize: 19,
  verticalAlign: 'bottom',
  paddingBottom: 3,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

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
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1.05,
        height: 41,
        textAlign: 'center',
        width: COLS[i],
      }}
    >
      {texto}
    </th>
  );

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
          left: 32,
          top: 9.6,
          width: 787,
          height: 48,
          background: NAVY,
          borderRadius: 10,
          color: '#fff',
          fontFamily: 'Aptos, "Segoe UI", Arial, sans-serif',
          fontWeight: 700,
          fontSize: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: 0.3,
        }}
      >
        {titulo || 'DESEMPENHO CURSOS X META'}
      </div>

      <table
        style={{
          position: 'absolute',
          left: 32,
          top: 64,
          width: COLS.reduce((a, b) => a + b, 0),
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
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
              <td style={{ ...cell, textAlign: 'center' }}>{l.coordenador}</td>
              <td style={{ ...cell, textAlign: 'left', fontSize: l.curso.length > 34 ? 17 : 19 }}>{l.curso}</td>
              <td style={{ ...cell, textAlign: 'center' }}>{formatarInteiro(l.metaDia)}</td>
              <td style={{ ...cell, textAlign: 'center' }}>{formatarInteiro(l.atual)}</td>
              <td style={{ ...cell, textAlign: 'center' }}>{formatarInteiro(l.metaFech)}</td>
              <td style={{ ...cell, textAlign: 'right', background: COR_FUNDO[l.cor] }}>{formatarPct(l.pct)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }} />
            <td style={{ ...cell, fontWeight: 700, textAlign: 'left' }}>Total</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: 'center' }}>{formatarInteiro(dados.total.metaDia)}</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: 'center' }}>{formatarInteiro(dados.total.atual)}</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: 'center' }}>{formatarInteiro(dados.total.metaFech)}</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: 'right', background: TEAL, color: '#fff' }}>
              {formatarPct(dados.total.pct)}
            </td>
          </tr>
        </tbody>
      </table>

      <img
        src={legendaImg}
        alt=""
        style={{ position: 'absolute', left: 984, top: 146, width: 264, height: 459 }}
      />

      <div style={{ position: 'absolute', left: 0, top: 634, width: DESEMPENHO_CARD_W, height: 86, overflow: 'hidden' }}>
        <img src={rodapeImg} alt="" style={{ width: DESEMPENHO_CARD_W, height: 121, display: 'block' }} />
      </div>
    </div>
  );
});
DesempenhoCursosCard.displayName = 'DesempenhoCursosCard';
