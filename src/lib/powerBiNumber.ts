/**
 * Número como o Power BI escreve no PDF: "1.400" / "1,400" (milhar), "12,5" / "12.5",
 * "1.400,5" / "1,400.5", "85%" e "(Blank)" (etapa sem valor = 0).
 * Devolve null quando o texto não é um número, para o chamador acusar o erro
 * em vez de mostrar um zero inventado.
 */
export function parsePowerBiNumber(raw: string): number | null {
  const v = raw.trim().replace(/%$/, '').trim();
  if (!v) return null;
  if (v.toLowerCase() === '(blank)') return 0;
  if (!/^-?[\d.,]+$/.test(v)) return null;

  let normalizado: string;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(v)) {
    // Só separador de milhar ("1.400", "1,400", "12.345.678"): os painéis de captação são contagens.
    normalizado = v.replace(/[.,]/g, '');
  } else if (v.includes('.') && v.includes(',')) {
    // Os dois separadores: o último é o decimal ("1.400,5" / "1,400.5").
    const ultimo = Math.max(v.lastIndexOf('.'), v.lastIndexOf(','));
    normalizado = v.slice(0, ultimo).replace(/[.,]/g, '') + '.' + v.slice(ultimo + 1);
  } else {
    normalizado = v.replace(',', '.');
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
