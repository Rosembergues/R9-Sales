/**
 * Cores das formas de ingresso (FDI), iguais em todas as telas de vendas.
 * As classes ficam escritas por inteiro para o Tailwind encontrá-las no build.
 */
export interface FdiStyle {
  /** Etiqueta pequena (fundo + texto + borda). */
  badge: string;
  bg: string;
  text: string;
  border: string;
  /** Cartão selecionado. */
  activeBorder: string;
  activeBg: string;
}

const STYLES: Record<string, FdiStyle> = {
  blue: { badge: 'bg-blue-50 text-blue-700 border-blue-200/60', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/70', activeBorder: 'border-blue-500 ring-2 ring-blue-500/20', activeBg: 'bg-blue-50/50' },
  amber: { badge: 'bg-amber-50 text-amber-700 border-amber-200/60', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/70', activeBorder: 'border-amber-500 ring-2 ring-amber-500/20', activeBg: 'bg-amber-50/50' },
  purple: { badge: 'bg-purple-50 text-purple-700 border-purple-200/60', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/70', activeBorder: 'border-purple-500 ring-2 ring-purple-500/20', activeBg: 'bg-purple-50/50' },
  emerald: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/70', activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20', activeBg: 'bg-emerald-50/50' },
  indigo: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/60', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200/70', activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20', activeBg: 'bg-indigo-50/50' },
  cyan: { badge: 'bg-cyan-50 text-cyan-700 border-cyan-200/60', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200/70', activeBorder: 'border-cyan-500 ring-2 ring-cyan-500/20', activeBg: 'bg-cyan-50/50' },
  orange: { badge: 'bg-orange-50 text-orange-700 border-orange-200/60', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200/70', activeBorder: 'border-orange-500 ring-2 ring-orange-500/20', activeBg: 'bg-orange-50/50' },
  rose: { badge: 'bg-rose-50 text-rose-700 border-rose-200/60', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/70', activeBorder: 'border-rose-500 ring-2 ring-rose-500/20', activeBg: 'bg-rose-50/50' },
  slate: { badge: 'bg-slate-50 text-slate-700 border-slate-200/60', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200/70', activeBorder: 'border-slate-500 ring-2 ring-slate-500/20', activeBg: 'bg-slate-50/50' },
};

const FDI_TONE: Record<string, keyof typeof STYLES> = {
  Vestibular: 'blue',
  ENEM: 'amber',
  'Transferência Externa': 'purple',
  'Transferência': 'purple',
  Simplificada: 'emerald',
  MSV: 'indigo',
  Reabertura: 'cyan',
  Técnico: 'orange',
  'Pós Graduação': 'rose',
};

/** Cores de uma FDI; FDI desconhecida fica cinza. */
export const fdiStyle = (fdi: string | null | undefined): FdiStyle => STYLES[FDI_TONE[fdi || ''] || 'slate'];
