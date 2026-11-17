/**
 * Small color helpers shared by the checklist, the brand kit and the dark-mode
 * simulation. Only the formats the editor itself produces are understood
 * (#rgb, #rrggbb, #rrggbbaa, rgb()/rgba() and a few common names); anything else
 * returns null so callers can skip the check instead of guessing.
 */

export interface Rgb { r: number; g: number; b: number }

const NAMED: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  gray: '#808080', grey: '#808080', yellow: '#ffff00', orange: '#ffa500', navy: '#000080',
  silver: '#c0c0c0', purple: '#800080', transparent: '',
};

export function parseCssColor(value: unknown): Rgb | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v in NAMED) return NAMED[v] ? parseCssColor(NAMED[v]) : null;

  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    if (h.length === 8 && parseInt(h.slice(6, 8), 16) < 13) return null; // practically transparent
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }

  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const alpha = rgb[4] ? (rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])) : 1;
    if (alpha < 0.05) return null;
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;
}

export function relativeLuminance(color: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(color.r) + 0.7152 * f(color.g) + 0.0722 * f(color.b);
}

/** WCAG contrast ratio, or null when either color can't be parsed. */
export function contrastRatio(a: unknown, b: unknown): number | null {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  if (!ca || !cb) return null;
  const [high, low] = [relativeLuminance(ca), relativeLuminance(cb)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** White or near-black, whichever reads better on the given background. */
export function readableTextOn(background: unknown): string {
  const onWhite = contrastRatio(background, '#ffffff') ?? 21;
  const onDark = contrastRatio(background, '#0f172a') ?? 1;
  return onWhite >= onDark ? '#ffffff' : '#0f172a';
}

function rgbToHsl({ r, g, b }: Rgb) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

/** Returns the color with its HSL lightness replaced (0–1), keeping hue and saturation. */
export function withLightness(color: Rgb, lightness: number): Rgb {
  const { h, s } = rgbToHsl(color);
  return hslToRgb(h, s, Math.max(0, Math.min(1, lightness)));
}

export function lightnessOf(color: Rgb): number {
  return rgbToHsl(color).l;
}
