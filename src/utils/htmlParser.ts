import type { ColumnCell, EmailBlock } from '../types';
import { sanitizeImportHtml } from './security';
import { MAX_COLUMNS, MIN_COLUMNS, normalizeBlocks, normalizeFontFamily } from './blockNormalizer';
import { convertForeignMergeTags } from './mergeTags';

/*
 * HTML → blocks importer.
 *
 * The document is walked down to its content leaves. Consecutive inline content
 * (text nodes, <b>, <a>, <span>…) inside a container becomes one text block;
 * block-level children are processed recursively. Heuristic classification
 * (button, social, coupon, banner, footer) is only applied to small containers,
 * so a wrapper that happens to contain a social link or a "©" never swallows
 * the whole e-mail.
 */

type Align = 'left' | 'center' | 'right' | 'justify';
type Styles = Record<string, string>;
type NewBlock = Omit<EmailBlock, 'id'>;

interface WalkContext {
  inFooter: boolean;
  inHeader: boolean;
}

interface SheetRule {
  selector: string;
  specificity: number;
  order: number;
  decls: Styles;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const SKIP_TAGS = new Set(['script', 'style', 'head', 'meta', 'link', 'title', 'noscript', 'template', 'base']);

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'caption', 'center', 'dd', 'div', 'dl', 'dt',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
  'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr', 'ul',
]);
const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(',');

const INVISIBLE_CHARS = /[ ­͏᠎​-‍⁠﻿]/g;

const FOOTER_TEXT = /©|\(c\)\s*\d{4}|direitos reservados|descadastr|unsubscribe|cancelar (?:a |sua )?inscri[cç][aã]o|n[aã]o deseja (?:mais )?receber|deixar de receber|este e-?mail foi enviado|voc[eê] (?:est[aá] recebendo|recebeu) este e-?mail/i;

const KEYWORD_FONT_SIZES: Record<string, number> = {
  'xx-small': 9, 'x-small': 10, small: 13, medium: 16, large: 18, 'x-large': 24, 'xx-large': 32,
};
const FONT_TAG_SIZES = [10, 13, 16, 18, 24, 32, 48];
const TAG_FONT_SCALE: Record<string, number> = {
  h1: 2, h2: 1.5, h3: 1.17, h4: 1, h5: 0.83, h6: 0.67, small: 0.83, sub: 0.83, sup: 0.83,
};
const BOLD_TAGS = new Set(['b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th']);
const ITALIC_TAGS = new Set(['i', 'em', 'cite']);

const SOCIAL_PATTERNS: Array<[keyof EmailBlock | 'other', RegExp]> = [
  ['instagramUrl', /instagram\.com|instagr\.am/],
  ['whatsappUrl', /wa\.me|whatsapp\.com/],
  ['linkedinUrl', /linkedin\.com|lnkd\.in/],
  ['facebookUrl', /facebook\.com|\bfb\.(?:com|me|watch)/],
  ['other', /(?:^|[/.])(?:twitter\.com|x\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.[a-z.]+|threads\.net|t\.me)(?:[/:?#]|$)/],
];

const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', purple: '#800080', gray: '#808080', grey: '#808080', orange: '#ffa500',
  navy: '#000080', silver: '#c0c0c0', maroon: '#800000', teal: '#008080', olive: '#808000',
  lime: '#00ff00', aqua: '#00ffff', cyan: '#00ffff', fuchsia: '#ff00ff', magenta: '#ff00ff',
  pink: '#ffc0cb', brown: '#a52a2a', gold: '#ffd700', darkgray: '#a9a9a9', darkgrey: '#a9a9a9',
  lightgray: '#d3d3d3', lightgrey: '#d3d3d3', whitesmoke: '#f5f5f5', darkblue: '#00008b',
  darkred: '#8b0000', darkgreen: '#006400', indigo: '#4b0082', violet: '#ee82ee', crimson: '#dc143c',
  coral: '#ff7f50', tomato: '#ff6347', salmon: '#fa8072', beige: '#f5f5dc', ivory: '#fffff0',
  khaki: '#f0e68c', royalblue: '#4169e1', steelblue: '#4682b4', skyblue: '#87ceeb',
  dodgerblue: '#1e90ff', slategray: '#708090', slategrey: '#708090', dimgray: '#696969',
  dimgrey: '#696969', gainsboro: '#dcdcdc', firebrick: '#b22222', seagreen: '#2e8b57',
  forestgreen: '#228b22', darkorange: '#ff8c00', midnightblue: '#191970', lightblue: '#add8e6',
  lightgreen: '#90ee90', lightyellow: '#ffffe0', aliceblue: '#f0f8ff', ghostwhite: '#f8f8ff',
  snow: '#fffafa', linen: '#faf0e6', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f',
};

// ---------------------------------------------------------------------------
// Colors

interface Rgba { r: number; g: number; b: number; a: number }

function hexToRgba(hex: string): Rgba | null {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

function channel(value: string, max = 255): number {
  return value.endsWith('%') ? (parseFloat(value) / 100) * max : parseFloat(value);
}

function hslToRgb(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function parseRgba(value?: string): Rgba | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || /^(inherit|initial|unset|none|currentcolor|auto)$/.test(v)) return null;

  const hex = v.match(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-f])/);
  if (hex) return hexToRgba(hex[0]);
  const rgb = v.match(/rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (rgb) return { r: channel(rgb[1]), g: channel(rgb[2]), b: channel(rgb[3]), a: rgb[4] ? channel(rgb[4], 1) : 1 };
  const hsl = v.match(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (hsl) return { ...hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3])), a: hsl[4] ? channel(hsl[4], 1) : 1 };
  // Legacy bgcolor="ffffff" without the hash.
  if (/^(?:[0-9a-f]{6}|[0-9a-f]{3})$/.test(v)) return hexToRgba(`#${v}`);

  for (const word of v.split(/[\s,]+/)) {
    if (word === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (NAMED_COLORS[word]) return hexToRgba(NAMED_COLORS[word]);
  }
  return null;
}

function toHex({ r, g, b, a }: Rgba): string {
  // Semi-transparent colors are flattened over white, the e-mail card background.
  const blend = (c: number) => Math.round(a >= 1 ? c : c * a + 255 * (1 - a));
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, blend(c))).toString(16).padStart(2, '0')).join('')}`;
}

function parseColor(value?: string): string | undefined {
  const color = parseRgba(value);
  if (!color || color.a < 0.05) return undefined;
  return toHex(color);
}

function luminance(hex: string): number {
  const c = hexToRgba(hex);
  if (!c) return 0;
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function readableTextOn(bg: string): string {
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#0f172a') ? '#ffffff' : '#0f172a';
}

// ---------------------------------------------------------------------------
// CSS

function parseDeclarations(text: string): Styles {
  const out: Styles = {};
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let buffer = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = '';
      buffer += ch;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  parts.push(buffer);

  for (const part of parts) {
    const index = part.indexOf(':');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).replace(/!important/gi, '').trim();
    if (key && value) out[key] = value;
  }
  return out;
}

/** Selectors that only apply on interaction (or to pseudo-elements) say nothing about the static look. */
const DYNAMIC_SELECTOR = /::|:(?:hover|active|focus|focus-within|focus-visible|visited|target|before|after)\b/i;

/** CSS specificity packed in one number: ids × 10000 + classes/attributes/pseudo-classes × 100 + types. */
function selectorSpecificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) || []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
  const types = (selector
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|:{1,2}[\w-]+(?:\([^)]*\))?/g, ' ')
    .match(/(?:^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return ids * 10000 + classes * 100 + types;
}

/**
 * Collects the rules of <style> blocks, with any selector the browser understands
 * (`.mcnTextContent p`, `#hero h1`, `td > a.btn`). Media queries with a condition
 * (`max-width`, `prefers-color-scheme`…) are mobile/dark overrides and are skipped;
 * plain `@media screen { … }` wrappers are read.
 */
function parseStylesheets(doc: Document): SheetRule[] {
  const rules: SheetRule[] = [];
  const parseCss = (css: string) => {
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf('{', i);
      if (open === -1) break;
      const selectorText = css.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth += 1;
        else if (css[j] === '}') depth -= 1;
        j += 1;
      }
      const body = css.slice(open + 1, j - 1);
      i = j;
      if (selectorText.startsWith('@')) {
        if (/^@media\b/i.test(selectorText) && !selectorText.includes('(')) parseCss(body);
        continue;
      }
      const decls = parseDeclarations(body);
      if (!Object.keys(decls).length) continue;
      for (const raw of selectorText.split(',')) {
        const selector = raw.trim();
        if (!selector || DYNAMIC_SELECTOR.test(selector)) continue;
        try {
          doc.body?.matches(selector); // validates the selector once
        } catch {
          continue;
        }
        rules.push({ selector, specificity: selectorSpecificity(selector), order: rules.length, decls });
      }
    }
  };
  doc.querySelectorAll('style').forEach((style) => parseCss((style.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '')));
  // Cascade order: lower specificity first, then source order, so later/stronger rules win.
  return rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
}

function parseFontSize(raw: string, parentSize: number): number | undefined {
  const v = raw.trim().toLowerCase();
  if (KEYWORD_FONT_SIZES[v]) return KEYWORD_FONT_SIZES[v];
  if (v === 'smaller') return parentSize / 1.2;
  if (v === 'larger') return parentSize * 1.2;
  const match = v.match(/^([\d.]+)\s*(px|pt|em|rem|%)?$/);
  if (!match) return undefined;
  const n = parseFloat(match[1]);
  if (!(n > 0)) return undefined;
  switch (match[2]) {
    case 'pt': return (n * 4) / 3;
    case 'em': return n * parentSize;
    case 'rem': return n * 16;
    case '%': return (n / 100) * parentSize;
    default: return n;
  }
}

function parsePx(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const match = String(raw).trim().match(/^([\d.]+)\s*(px)?$/i);
  return match ? parseFloat(match[1]) : undefined;
}

function classTokens(el: Element): string[] {
  return (el.getAttribute('class') || '').toLowerCase().split(/\s+/).filter(Boolean);
}

function normalizeText(value: string): string {
  return value.replace(INVISIBLE_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

function meaningfulText(node: Node | null | undefined): string {
  return normalizeText(node?.textContent || '');
}

function isEmojiLike(value: string): boolean {
  return value.length > 0 && value.length <= 4 && /\p{Extended_Pictographic}/u.test(value);
}

function finalizeInlineHtml(html: string): string {
  let out = html
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  // Drop formatting tags that ended up empty after cleaning, keeping a separating space.
  let previous = '';
  while (previous !== out) {
    previous = out;
    out = out.replace(/<(b|i|u|s|span|strong|em|sub|sup)(?:\s[^>]*)?>(\s*)<\/\1>/g, (_, _tag, space: string) => (space ? ' ' : ''));
  }
  return out.replace(/ {2,}/g, ' ').trim().replace(/\n/g, '<br/>');
}

/** Background image URL from `background-image`, the `background` shorthand or the legacy attribute. */
export function backgroundUrl(el: Element, styles: Record<string, string>): string | undefined {
  const declaration = `${styles['background-image'] || ''} ${styles.background || ''}`;
  const fromCss = declaration.match(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/i)?.[2];
  const raw = (fromCss || el.getAttribute('background') || '').trim();
  if (!raw) return undefined;
  const url = raw.startsWith('//') ? `https:${raw}` : raw;
  return /^https?:\/\/[^\s'"<>()]+$/i.test(url) ? url : undefined;
}

function htmlToPlainLines(html: string): string[] {
  return html
    .split(/<br\s*\/?>/i)
    .map((line) => normalizeText(line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')))
    .filter(Boolean);
}

/** Rewrites name/e-mail merge tags of other platforms (Mailchimp, Brevo…) in every text and link of a block. */
function convertBlockMergeTags(block: EmailBlock): EmailBlock {
  const next = { ...block } as Record<string, unknown>;
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === 'string') next[key] = convertForeignMergeTags(value);
  }
  if (Array.isArray(block.columns)) {
    next.columns = block.columns.map((cell) => Object.fromEntries(
      Object.entries(cell).map(([key, value]) => [key, typeof value === 'string' ? convertForeignMergeTags(value) : value]),
    ));
  }
  return next as unknown as EmailBlock;
}

// ---------------------------------------------------------------------------
// Importer

class BlockImporter {
  private readonly rules: SheetRule[];
  private readonly styleCache = new WeakMap<Element, Styles>();
  private readonly fontSizeCache = new WeakMap<Element, number>();
  private readonly textLengthCache = new WeakMap<Element, number>();
  private readonly blocks: EmailBlock[] = [];
  private readonly usedIds = new Set<string>();
  private readonly emittedBackgrounds = new Set<string>();
  private readonly idPrefix = Math.random().toString(36).slice(2, 7);
  private counter = 0;
  private totalTextLength = 0;

  constructor(readonly doc: Document) {
    this.rules = parseStylesheets(doc);
    this.removeInvisibleContent();
    this.totalTextLength = this.textLength(doc.body);
  }

  run(): EmailBlock[] {
    this.walk(this.doc.body, { inFooter: false, inHeader: false });
    this.mergeFooters();
    if (this.blocks.length === 0) {
      const text = meaningfulText(this.doc.body);
      if (text) this.push({ type: 'text', text: text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
    }
    return normalizeBlocks(this.blocks.map(convertBlockMergeTags));
  }

  // ----- styles ------------------------------------------------------------

  styles(el: Element): Styles {
    const cached = this.styleCache.get(el);
    if (cached) return cached;

    const s: Styles = {};
    const tag = el.tagName.toLowerCase();
    const attr = (name: string) => el.getAttribute(name);

    const align = attr('align');
    if (align) s['text-align'] = align.toLowerCase();
    const bgcolor = attr('bgcolor');
    if (bgcolor) s['background-color'] = bgcolor;
    const width = attr('width');
    if (width) s.width = /^\d+(\.\d+)?$/.test(width) ? `${width}px` : width;
    const height = attr('height');
    if (height) s.height = /^\d+(\.\d+)?$/.test(height) ? `${height}px` : height;
    if (tag === 'font') {
      const color = attr('color');
      if (color) s.color = color;
      const face = attr('face');
      if (face) s['font-family'] = face;
      const size = Number(attr('size'));
      if (Number.isInteger(size) && size >= 1 && size <= 7) s['font-size'] = `${FONT_TAG_SIZES[size - 1]}px`;
    }

    for (const rule of this.rules) {
      if (el.matches(rule.selector)) Object.assign(s, rule.decls);
    }
    Object.assign(s, parseDeclarations(attr('style') || ''));

    if (!s['background-color'] && s.background && parseRgba(s.background)) s['background-color'] = s.background;
    if (s.font) this.expandFontShorthand(s);

    this.styleCache.set(el, s);
    return s;
  }

  private expandFontShorthand(s: Styles) {
    const font = s.font;
    const size = font.match(/(?:^|\s)([\d.]+(?:px|pt|em|rem|%))(?:\s*\/\s*([\d.]+(?:px|pt|em|rem|%)?))?\s+(.+)$/);
    if (!size) return;
    s['font-size'] ??= size[1];
    if (size[2]) s['line-height'] ??= size[2];
    s['font-family'] ??= size[3];
    const before = font.slice(0, font.indexOf(size[1]));
    if (/\b(bold|[6-9]00)\b/.test(before)) s['font-weight'] ??= 'bold';
    if (/\bitalic\b/.test(before)) s['font-style'] ??= 'italic';
  }

  private up<T>(el: Element | null, read: (el: Element) => T | undefined): T | undefined {
    let current = el;
    while (current) {
      const value = read(current);
      if (value !== undefined) return value;
      if (current === this.doc.body) break;
      current = current.parentElement;
    }
    return undefined;
  }

  private ownBg(el: Element): string | undefined {
    return parseColor(this.styles(el)['background-color']);
  }

  private inheritedBg(el: Element): string | undefined {
    return this.up(el, (e) => this.ownBg(e));
  }

  private color(el: Element): string | undefined {
    return this.up(el, (e) => parseColor(this.styles(e).color));
  }

  private align(el: Element): Align | undefined {
    return this.up(el, (e): Align | undefined => {
      if (e.tagName.toLowerCase() === 'center') return 'center';
      const v = this.styles(e)['text-align'];
      if (v === 'left' || v === 'center' || v === 'right' || v === 'justify') return v;
      if (v === 'middle') return 'center';
      if (v === 'start') return 'left';
      if (v === 'end') return 'right';
      return undefined;
    });
  }

  private fontFamily(el: Element): string | undefined {
    return this.up(el, (e) => {
      const value = this.styles(e)['font-family'];
      if (!value || /^(inherit|initial)$/i.test(value)) return undefined;
      return normalizeFontFamily(value);
    });
  }

  private bold(el: Element): boolean {
    return this.up(el, (e) => {
      const weight = this.styles(e)['font-weight'];
      if (weight) {
        if (/bold|bolder/.test(weight)) return true;
        const n = parseInt(weight, 10);
        if (!Number.isNaN(n)) return n >= 600;
        if (/normal|lighter/.test(weight)) return false;
      }
      return BOLD_TAGS.has(e.tagName.toLowerCase()) ? true : undefined;
    }) ?? false;
  }

  private italic(el: Element): boolean {
    return this.up(el, (e) => {
      const style = this.styles(e)['font-style'];
      if (style) return /italic|oblique/.test(style);
      return ITALIC_TAGS.has(e.tagName.toLowerCase()) ? true : undefined;
    }) ?? false;
  }

  private textTransform(el: Element): EmailBlock['textTransform'] {
    const value = this.up(el, (e) => this.styles(e)['text-transform']);
    return value === 'uppercase' || value === 'lowercase' || value === 'capitalize' ? value : undefined;
  }

  private lineHeight(el: Element, fontSize: number): string | undefined {
    const raw = this.up(el, (e) => this.styles(e)['line-height']);
    if (!raw) return undefined;
    const match = raw.trim().match(/^([\d.]+)\s*(px|%|em)?$/i);
    if (!match) return undefined;
    const n = parseFloat(match[1]);
    const ratio = match[2] === 'px' ? n / fontSize : match[2] === '%' ? n / 100 : n;
    if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
    return String(Math.round(Math.max(1, Math.min(3, ratio)) * 100) / 100);
  }

  private fontSize(el: Element): number {
    const cached = this.fontSizeCache.get(el);
    if (cached !== undefined) return cached;
    const parentSize = el === this.doc.body || !el.parentElement ? 16 : this.fontSize(el.parentElement);
    const raw = this.styles(el)['font-size'];
    let size = raw ? parseFontSize(raw, parentSize) : undefined;
    if (size === undefined) size = parentSize * (TAG_FONT_SCALE[el.tagName.toLowerCase()] ?? 1);
    const result = Math.round(Math.max(6, Math.min(96, size)));
    this.fontSizeCache.set(el, result);
    return result;
  }

  private decorations(elements: Element[]) {
    let underline = false;
    let strike = false;
    for (const e of elements) {
      const tag = e.tagName.toLowerCase();
      const deco = `${this.styles(e)['text-decoration'] || ''} ${this.styles(e)['text-decoration-line'] || ''}`;
      if (tag === 'u' || tag === 'ins' || /underline/.test(deco)) underline = true;
      if (tag === 's' || tag === 'strike' || tag === 'del' || /line-through/.test(deco)) strike = true;
    }
    return { underline, strike };
  }

  // ----- structure helpers ---------------------------------------------------

  private textLength(el: Element): number {
    const cached = this.textLengthCache.get(el);
    if (cached !== undefined) return cached;
    const length = meaningfulText(el).length;
    this.textLengthCache.set(el, length);
    return length;
  }

  /** Outer layout wrappers (page background, centered card) hold almost all of the e-mail's text. */
  private isPageWrapper(el: Element): boolean {
    if (el === this.doc.body || el === this.doc.documentElement) return true;
    return this.totalTextLength > 0 && this.textLength(el) >= this.totalTextLength * 0.85;
  }

  private imageSize(img: Element): { w?: number; h?: number } {
    const s = this.styles(img);
    const rawWidth = s.width || '';
    const percent = rawWidth.match(/^([\d.]+)%$/);
    const w = percent ? (parseFloat(percent[1]) / 100) * 600 : parsePx(rawWidth);
    return { w, h: parsePx(s.height) };
  }

  /** Public http(s) URL of the element's background image, if it should become a block. */
  private backgroundImageOf(el: Element): string | undefined {
    const tag = el.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') return undefined;
    const url = backgroundUrl(el, this.styles(el));
    if (!url || this.emittedBackgrounds.has(url)) return undefined;
    // A textured page background wraps the whole (long) e-mail; a hero holds a short text.
    if (this.textLength(el) > 400 && this.isPageWrapper(el)) return undefined;
    return url;
  }

  private isSignificantImage(img: Element): boolean {
    if (!img.getAttribute('src')) return false;
    const { w, h } = this.imageSize(img);
    if (w === undefined && h === undefined) return true;
    // Icons and emoji images (≤ 40px) are treated as inline decoration.
    return !((w === undefined || w <= 40) && (h === undefined || h <= 40));
  }

  private significantImages(el: Element): Element[] {
    const images = el.tagName.toLowerCase() === 'img' ? [el] : Array.from(el.querySelectorAll('img'));
    return images.filter((img) => this.isSignificantImage(img));
  }

  private isHidden(el: Element): boolean {
    if (el.hasAttribute('hidden')) return true;
    const s = this.styles(el);
    if ((s.display || '').trim().toLowerCase() === 'none') return true;
    if (/hidden|collapse/i.test(s.visibility || '')) return true;
    if (s.opacity !== undefined && parseFloat(s.opacity) === 0) return true;
    const zero = (v?: string) => v !== undefined && /^0(?:\.0+)?(?:px|%|em|rem)?$/i.test(v.trim());
    const clipped = /hidden/i.test(s.overflow || '');
    return clipped && (zero(s['max-height']) || zero(s.height) || zero(s['max-width']) || zero(s.width));
  }

  /** Removes hidden preheaders, tracking pixels and spacer images before anything is measured. */
  private removeInvisibleContent() {
    const all = Array.from(this.doc.body.querySelectorAll('*'));
    for (const el of all) {
      if (!el.isConnected) continue;
      if (this.isHidden(el)) {
        el.remove();
        continue;
      }
      if (el.tagName.toLowerCase() === 'img') {
        const { w, h } = this.imageSize(el);
        if (!el.getAttribute('src') || (w !== undefined && w <= 3) || (h !== undefined && h <= 3)) el.remove();
      }
    }
  }

  private isButtonAnchorStyle(el: Element): boolean {
    const s = this.styles(el);
    if (parseColor(s['background-color'])) return true;
    const hasPadding = Boolean(s.padding || s['padding-top'] || s['padding-left'] || s['padding-right']);
    const hasBorder = Boolean(s.border && !/^(none|0)/.test(s.border));
    if ((hasPadding || hasBorder || s['border-radius']) && /^(block|inline-block|table|table-cell)/.test(s.display || '')) return true;
    return Boolean(s['border-radius'] && (hasPadding || hasBorder));
  }

  private hasButtonClass(el: Element): boolean {
    return classTokens(el).some((t) => /^(btn|button|cta|botao|botão)(?:[-_].*)?$/.test(t) || /[-_](btn|button|cta)$/.test(t));
  }

  private isButtonAnchor(el: Element): boolean {
    const isMarked = el.hasAttribute('data-r9-button');
    if (el.tagName.toLowerCase() !== 'a' && !isMarked) return false;
    const text = meaningfulText(el);
    if (!text || text.length > 60) return false;
    if (this.significantImages(el).length) return false;
    if (isMarked || this.hasButtonClass(el)) return true;
    if (this.isButtonAnchorStyle(el)) return true;
    const inner = this.deepestSingleChild(el);
    if (inner !== el && parseColor(this.styles(inner)['background-color'])) return true;
    return Boolean(this.buttonCell(el));
  }

  /** The table cell / wrapper that paints a "bulletproof" button around an otherwise plain link. */
  private buttonCell(anchor: Element): Element | null {
    const text = meaningfulText(anchor);
    const as = this.styles(anchor);
    const anchorHasPadding = Boolean(as.padding || as['padding-top'] || as['padding-left']);
    let current = anchor.parentElement;
    for (let depth = 0; current && current !== this.doc.body && depth < 4; depth += 1, current = current.parentElement) {
      if (meaningfulText(current) !== text || this.significantImages(current).length) return null;
      const s = this.styles(current);
      if (!this.ownBg(current)) continue;
      const boxed = Boolean(s['border-radius'])
        || ((Boolean(s.padding || s['padding-top']) || current.hasAttribute('height') || anchorHasPadding) && text.length <= 40);
      if (boxed) return current;
    }
    return null;
  }

  private deepestSingleChild(el: Element): Element {
    let current = el;
    for (;;) {
      const nodes = Array.from(current.childNodes).filter((n) => (n.nodeType === ELEMENT_NODE ? meaningfulText(n) : n.nodeType === TEXT_NODE && meaningfulText(n)));
      if (nodes.length !== 1 || nodes[0].nodeType !== ELEMENT_NODE) return current;
      current = nodes[0] as Element;
    }
  }

  private hasButton(el: Element): boolean {
    return Array.from(el.querySelectorAll('a, [data-r9-button]')).some((a) => this.isButtonAnchor(a));
  }

  private hasBlockContent(el: Element): boolean {
    return el.querySelector(BLOCK_SELECTOR) !== null
      || this.significantImages(el).some((img) => img !== el)
      || this.hasButton(el);
  }

  private isBlockLevel(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (BLOCK_TAGS.has(tag)) return true;
    if (tag === 'img') return this.isSignificantImage(el);
    if (/^(block|flex|grid|table|list-item)/.test(this.styles(el).display || '')) return true;
    if (this.isButtonAnchor(el)) return true;
    return this.hasBlockContent(el);
  }

  private soleAnchor(el: Element): Element | null {
    const anchors = el.querySelectorAll('a, [data-r9-button]');
    if (anchors.length !== 1) return null;
    return meaningfulText(anchors[0]) === meaningfulText(el) ? anchors[0] : null;
  }

  // ----- output --------------------------------------------------------------

  private push(block: NewBlock, preferredId?: string | null) {
    const id = preferredId && !this.usedIds.has(preferredId) ? preferredId : `imp-${this.idPrefix}-${++this.counter}`;
    this.usedIds.add(id);
    this.blocks.push({ ...block, id } as EmailBlock);
  }

  /** Converts inline nodes into the rich-text subset used by the editor. */
  private inlineHtml(nodes: Node[]): string {
    const wrapper = this.doc.createElement('div');
    nodes.forEach((node) => wrapper.appendChild(this.cloneWithStyles(node)));
    this.cleanInline(wrapper);
    return finalizeInlineHtml(wrapper.innerHTML);
  }

  private cleanInline(parent: Element) {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === TEXT_NODE) {
        child.textContent = (child.textContent || '').replace(/[\t\n\r\f ]+/g, ' ');
        continue;
      }
      if (child.nodeType !== ELEMENT_NODE) {
        child.remove();
        continue;
      }
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      if (tag === 'br' || tag === 'hr') {
        el.replaceWith(this.doc.createTextNode('\n'));
        continue;
      }
      if (tag === 'img') {
        const alt = (el.getAttribute('alt') || '').trim();
        el.replaceWith(this.doc.createTextNode(isEmojiLike(alt) ? alt : ''));
        continue;
      }

      if (tag === 'a') {
        const fallbackLabel = (el.querySelector('img[alt]')?.getAttribute('alt') || '').trim();
        this.cleanInline(el);
        const href = el.getAttribute('href');
        if (!href) {
          this.unwrap(el);
          continue;
        }
        const color = parseColor(this.styles(el).color);
        Array.from(el.attributes).forEach((a) => {
          if (a.name !== 'href' && a.name !== 'title') el.removeAttribute(a.name);
        });
        el.setAttribute('target', '_blank');
        if (color) el.setAttribute('style', `color: ${color};`);
        // Icon-only links would become invisible once the icon is dropped.
        if (!meaningfulText(el)) el.textContent = fallbackLabel || href.replace(/^(https?:\/\/|mailto:|tel:)/, '').replace(/\/$/, '');
        continue;
      }

      this.cleanInline(el);

      if (BLOCK_TAGS.has(tag)) {
        const prefix = tag === 'li' ? '• ' : '';
        el.before(this.doc.createTextNode(`\n${prefix}`));
        el.after(this.doc.createTextNode('\n'));
        this.unwrap(el);
        continue;
      }

      const s = this.styles(el);
      const weight = s['font-weight'] || '';
      const deco = `${s['text-decoration'] || ''} ${s['text-decoration-line'] || ''}`;
      const bold = tag === 'b' || tag === 'strong' || /bold/.test(weight) || parseInt(weight, 10) >= 600;
      const italic = ITALIC_TAGS.has(tag) || /italic|oblique/.test(s['font-style'] || '');
      const underline = tag === 'u' || tag === 'ins' || /underline/.test(deco);
      const strike = tag === 's' || tag === 'strike' || tag === 'del' || /line-through/.test(deco);
      const color = parseColor(s.color);
      const background = parseColor(s['background-color']) || (tag === 'mark' ? '#ffff00' : undefined);

      let content: Node[] = Array.from(el.childNodes);
      const wrap = (wrapperTag: string, style?: string) => {
        const wrapper = this.doc.createElement(wrapperTag);
        if (style) wrapper.setAttribute('style', style);
        content.forEach((node) => wrapper.appendChild(node));
        content = [wrapper];
      };
      if (tag === 'sub' || tag === 'sup') wrap(tag);
      if (strike) wrap('s');
      if (underline) wrap('u');
      if (italic) wrap('i');
      if (bold) wrap('b');
      const styleParts = [color && `color: ${color};`, background && `background-color: ${background};`].filter(Boolean);
      if (styleParts.length) wrap('span', styleParts.join(' '));
      el.replaceWith(...content);
    }
  }

  /**
   * Deep clone whose elements keep the styles resolved for the originals. A detached
   * clone can't match descendant selectors such as `.content p`, so without this
   * stylesheet colors and weights would be lost when the clone is cleaned.
   */
  private cloneWithStyles<T extends Node>(node: T): T {
    const copy = node.cloneNode(true) as T;
    const mirror = (original: Node, cloned: Node) => {
      if (original.nodeType !== ELEMENT_NODE) return;
      this.styleCache.set(cloned as Element, this.styles(original as Element));
      const a = original.childNodes;
      const b = cloned.childNodes;
      for (let i = 0; i < a.length && i < b.length; i += 1) mirror(a[i], b[i]);
    };
    mirror(node, copy);
    return copy;
  }

  private unwrap(el: Element) {
    el.replaceWith(...Array.from(el.childNodes));
  }

  // ----- walking -------------------------------------------------------------

  private walk(container: Element, ctx: WalkContext) {
    let run: Node[] = [];
    const flush = () => {
      if (run.length) this.emitRun(run, container, ctx);
      run = [];
    };
    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === TEXT_NODE) {
        run.push(child);
        continue;
      }
      if (child.nodeType !== ELEMENT_NODE) continue;
      const el = child as Element;
      if (SKIP_TAGS.has(el.tagName.toLowerCase())) continue;
      if (this.isBlockLevel(el)) {
        flush();
        this.processElement(el, ctx);
      } else {
        run.push(el);
      }
    }
    flush();
  }

  private processElement(el: Element, ctx: WalkContext) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return;

    if (el.hasAttribute('data-block-id')) {
      const block = this.parseR9Block(el);
      if (block) {
        this.push(block, el.getAttribute('data-block-id'));
        return;
      }
    }

    // Hero banners often paint a photo as the cell background with text on top.
    // E-mail blocks can't layer, so the photo becomes an image block placed
    // right before the content that was over it.
    const background = this.backgroundImageOf(el);
    if (background) {
      this.emittedBackgrounds.add(background);
      const { w } = this.imageSize(el);
      this.push({
        type: 'image',
        imageUrl: background,
        imageWidthPx: Math.round(Math.max(80, Math.min(1200, w ?? 600))),
        alignment: 'center',
      });
    }

    if (tag === 'hr') {
      this.push(this.dividerBlock(el));
      return;
    }
    if (tag === 'img') {
      this.pushImage(el, ctx);
      return;
    }

    const containsR9 = el.querySelector('[data-block-id]') !== null;
    // Social rows are often icon-only (no text, small images), so check them before spacers.
    const social = containsR9 ? null : this.trySocial(el);
    if (social) {
      this.push(social);
      return;
    }
    const columns = containsR9 ? null : this.tryColumns(el);
    if (columns) {
      this.push(columns);
      return;
    }

    const text = meaningfulText(el);
    const images = this.significantImages(el);
    if (!text && images.length === 0) {
      const divider = this.dividerFromSpacer(el);
      if (divider) this.push(divider);
      // A divider line may be painted by a nested cell (tr > td bgcolor height=1).
      else if (el.children.length) this.walk(el, ctx);
      return;
    }
    if (!text && images.length === 1) {
      this.pushImage(images[0], ctx);
      return;
    }
    if (this.isButtonAnchor(el)) {
      this.pushButton(el);
      return;
    }

    // Heuristic classifications never apply to containers holding R9 blocks,
    // which are reconstructed exactly instead.
    if (!containsR9) {
      const anchor = this.soleAnchor(el);
      if (anchor && this.isButtonAnchor(anchor)) {
        this.pushButton(anchor);
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        this.emitList(el, ctx);
        return;
      }
      if (!ctx.inFooter && this.isFooterContainer(el)) {
        this.walk(el, { ...ctx, inFooter: true });
        return;
      }
      const coupon = this.tryCoupon(el);
      if (coupon) {
        this.push(coupon);
        return;
      }
      const banner = this.tryBanner(el);
      if (banner) {
        this.push(banner);
        return;
      }
      if (!ctx.inHeader && this.isHeaderContainer(el)) {
        this.walk(el, { ...ctx, inHeader: true });
        return;
      }
    }

    // Inline element promoted to block (e.g. <a style="display:block">): keep the element itself.
    if (!BLOCK_TAGS.has(tag) && !this.hasBlockContent(el)) {
      this.emitRun([el], el.parentElement || el, ctx);
      return;
    }
    this.walk(el, ctx);
  }

  private runStyleSource(nodes: Node[], container: Element): { source: Element; chain: Element[] } {
    const meaningful = nodes.filter((n) => meaningfulText(n));
    if (meaningful.length !== 1 || meaningful[0].nodeType !== ELEMENT_NODE) return { source: container, chain: [] };
    const chain: Element[] = [];
    let current = meaningful[0] as Element;
    while (current.tagName.toLowerCase() !== 'a' && !current.hasAttribute('data-r9-button')) {
      chain.push(current);
      const kids = Array.from(current.childNodes).filter((n) => meaningfulText(n));
      if (kids.length !== 1 || kids[0].nodeType !== ELEMENT_NODE) break;
      current = kids[0] as Element;
    }
    return chain.length ? { source: chain[chain.length - 1], chain } : { source: container, chain };
  }

  private emitRun(nodes: Node[], container: Element, ctx: WalkContext) {
    const plain = normalizeText(nodes.map((n) => n.textContent || '').join(''));
    if (!plain) return;
    const { source, chain } = this.runStyleSource(nodes, container);
    const html = this.inlineHtml(source === container ? nodes : Array.from(source.childNodes));
    if (!htmlToPlainLines(html).length) return;
    this.pushTextBlock(html, plain, source, [...chain, container], ctx);
  }

  private pushTextBlock(html: string, plain: string, source: Element, decoSources: Element[], ctx: WalkContext, forceType?: 'text') {
    const fontSizePx = this.fontSize(source);
    const color = this.color(source);
    const alignment = this.align(source) || 'left';
    const fontFamily = this.fontFamily(source);
    const { underline, strike } = this.decorations([source, ...decoSources]);
    const common = {
      fontSizePx,
      alignment,
      fontFamily,
      isBold: this.bold(source),
      isItalic: this.italic(source),
      isUnderline: underline || undefined,
      isStrikethrough: strike || undefined,
      textTransform: this.textTransform(source),
      lineHeight: this.lineHeight(source, fontSizePx),
    };

    if (!forceType && (ctx.inFooter || (FOOTER_TEXT.test(plain) && plain.length <= 600))) {
      this.push({
        ...common,
        type: 'footer',
        footerText: html,
        footerTextColor: color || '#64748b',
        footerBgColor: this.blockBg(source, color) || '#ffffff',
      });
      return;
    }

    const heading = this.up(source, (e) => (/^h[1-6]$/.test(e.tagName.toLowerCase()) ? e.tagName.toLowerCase() : undefined));
    let type: 'title' | 'subtitle' | 'text' = 'text';
    if (!forceType && plain.length <= 200) {
      if (heading === 'h1' || heading === 'h2' || fontSizePx >= 24) type = 'title';
      else if (heading || fontSizePx >= 20 || (fontSizePx >= 18 && common.isBold)) type = 'subtitle';
    }
    this.push({ ...common, type, text: html, textColor: color, bgColor: this.blockBg(source, color) });
  }

  /**
   * Background for a block: the nearest painted ancestor, except page-level
   * wrappers (gray page background, white card), which the editor already
   * provides. A wrapper color is kept only when the text would be unreadable on white.
   */
  private blockBg(el: Element, textColor?: string): string | undefined {
    const owner = this.up(el, (e) => (this.ownBg(e) ? e : undefined));
    if (!owner) return undefined;
    const bg = this.ownBg(owner)!;
    if (this.isPageWrapper(owner)) {
      return textColor && contrastRatio(textColor, '#ffffff') < 2 ? bg : undefined;
    }
    return bg === '#ffffff' ? undefined : bg;
  }

  private emitList(list: Element, ctx: WalkContext) {
    const items = Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li');
    if (!items.length || items.some((li) => this.significantImages(li).length || this.hasButton(li))) {
      this.walk(list, ctx);
      return;
    }
    const ordered = list.tagName.toLowerCase() === 'ol';
    const start = parseInt(list.getAttribute('start') || '1', 10) || 1;
    const lines = items
      .map((li, index) => {
        const html = this.inlineHtml(Array.from(li.childNodes));
        return html ? `${ordered ? `${start + index}.` : '•'} ${html}` : '';
      })
      .filter(Boolean);
    if (lines.length) this.pushTextBlock(lines.join('<br/>'), meaningfulText(list), items[0], [], ctx, 'text');
  }

  private pushImage(img: Element, ctx: WalkContext) {
    const src = img.getAttribute('src');
    if (!src) return;
    const { w } = this.imageSize(img);
    const align = this.align(img);
    const link = img.closest('a');
    const isHeader = ctx.inHeader
      || classTokens(img).includes('email-header-img')
      || Boolean(this.up(img.parentElement, (e) => (this.isHeaderContainer(e) ? true : undefined)));
    this.push({
      type: isHeader ? 'header_image' : 'image',
      imageUrl: src,
      imageAlt: img.getAttribute('alt') || undefined,
      imageLink: link?.getAttribute('href') || undefined,
      imageWidthPx: Math.round(Math.max(80, Math.min(1200, w ?? 600))),
      alignment: align === 'left' || align === 'right' ? align : 'center',
      bgColor: this.blockBg(img),
    });
  }

  private pushButton(anchor: Element) {
    this.push(this.buttonProps(anchor));
  }

  private buttonProps(anchor: Element): NewBlock {
    const linkEl = anchor.tagName.toLowerCase() === 'a' ? anchor : anchor.closest('a');
    const inner = this.deepestSingleChild(anchor);
    const cell = this.buttonCell(anchor);
    const bg = this.ownBg(anchor)
      || (inner !== anchor ? this.ownBg(inner) : undefined)
      || (cell ? this.ownBg(cell) : undefined)
      || '#4f46e5';
    let textColor = parseColor(this.styles(inner).color) || parseColor(this.styles(anchor).color) || this.color(anchor);
    if (!textColor || contrastRatio(bg, textColor) < 2) textColor = readableTextOn(bg);

    const positioned = cell ? cell.closest('table') || cell : anchor;
    const align = this.align(positioned);
    const outerBg = this.blockBg(positioned.parentElement || positioned);
    const widthDecl = `${this.styles(anchor).width || ''} ${cell ? this.styles(cell.closest('table') || cell).width || '' : ''}`;

    return {
      type: 'button',
      buttonLabel: meaningfulText(anchor),
      buttonUrl: linkEl?.getAttribute('href') || '#',
      buttonBgColor: bg,
      buttonTextColor: textColor,
      buttonWidth: /100%/.test(widthDecl) ? 'full' : 'auto',
      alignment: align === 'left' || align === 'right' ? align : 'center',
      fontSizePx: this.fontSize(inner),
      isBold: this.bold(inner),
      isItalic: this.italic(inner) || undefined,
      textTransform: this.textTransform(inner),
      fontFamily: this.fontFamily(inner),
      bgColor: outerBg && outerBg !== bg ? outerBg : undefined,
    };
  }

  /**
   * A table row with 2–3 cells that each hold an image or a button (product grid,
   * "two cards side by side"). Data tables and text-only layouts are left alone.
   */
  private tryColumns(row: Element): NewBlock | null {
    // No page-wrapper check: a grid can be most of a short e-mail; the per-cell limits
    // below (≤ 400 chars, ≤ 1 image, ≤ 1 button) already exclude whole-layout rows.
    if (row.tagName.toLowerCase() !== 'tr') return null;
    const cells = Array.from(row.children).filter((child) => /^t[dh]$/i.test(child.tagName));
    const contentCells = cells.filter((cell) => meaningfulText(cell) || this.significantImages(cell).length);
    if (contentCells.length < MIN_COLUMNS || contentCells.length > MAX_COLUMNS) return null;

    const parsed: Array<{ cell: Element; image?: Element; button?: Element }> = [];
    for (const cell of contentCells) {
      if (this.textLength(cell) > 400) return null;
      const images = this.significantImages(cell);
      if (images.length > 1) return null;
      const buttons = Array.from(cell.querySelectorAll('a, [data-r9-button]')).filter((a) => this.isButtonAnchor(a));
      if (buttons.length > 1) return null;
      // Nested multi-row layouts are walked normally.
      if (cell.querySelectorAll('tr').length > 6) return null;
      parsed.push({ cell, image: images[0], button: buttons[0] });
    }
    const withImage = parsed.filter((p) => p.image).length;
    const withButton = parsed.filter((p) => p.button).length;
    if (withImage < 2 && withButton < parsed.length) return null;

    const columns: ColumnCell[] = parsed.map(({ cell, image, button }) => {
      const out: ColumnCell = {};
      const clone = this.cloneWithStyles(cell);
      // Locate the image/button in the clone by their position among same-tag elements.
      const indexIn = (el: Element | undefined, selector: string) => (el ? Array.from(cell.querySelectorAll(selector)).indexOf(el) : -1);
      const imageIndex = indexIn(image, 'img');
      const buttonIndex = indexIn(button, 'a, [data-r9-button]');
      const cloneButton = buttonIndex >= 0 ? clone.querySelectorAll('a, [data-r9-button]')[buttonIndex] : null;
      const cloneImage = imageIndex >= 0 ? clone.querySelectorAll('img')[imageIndex] : null;

      if (image) {
        out.imageUrl = image.getAttribute('src') || undefined;
        out.imageAlt = image.getAttribute('alt') || undefined;
        out.imageLink = image.closest('a')?.getAttribute('href') || undefined;
      }
      if (button) {
        const props = this.buttonProps(button);
        out.buttonLabel = props.buttonLabel;
        out.buttonUrl = props.buttonUrl;
      }
      cloneButton?.remove();
      if (cloneImage) {
        const imageLink = cloneImage.closest('a');
        if (imageLink && !meaningfulText(imageLink)) imageLink.remove();
        else cloneImage.remove();
      }
      const html = this.inlineHtml(Array.from(clone.childNodes));
      if (htmlToPlainLines(html).length) out.text = html;
      return out;
    });

    // Typography comes from the first text in the first cell that has any.
    const textSource = parsed
      .map(({ cell, button }) => {
        const walker = this.doc.createTreeWalker(cell, 4);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (parent && meaningfulText(node) && !(button && button.contains(parent))) return parent;
        }
        return null;
      })
      .find(Boolean);
    const firstButton = parsed.find((p) => p.button)?.button;
    const buttonStyle = firstButton ? this.buttonProps(firstButton) : null;
    const align = textSource ? this.align(textSource) : this.align(contentCells[0]);

    return {
      type: 'columns',
      columns,
      textColor: textSource ? this.color(textSource) : undefined,
      fontSizePx: textSource ? this.fontSize(textSource) : undefined,
      fontFamily: textSource ? this.fontFamily(textSource) : undefined,
      alignment: align === 'left' || align === 'right' ? align : 'center',
      buttonBgColor: buttonStyle?.buttonBgColor,
      buttonTextColor: buttonStyle?.buttonTextColor,
      bgColor: this.blockBg(row),
    };
  }

  private socialKind(anchor: Element): keyof EmailBlock | 'other' | null {
    const href = (anchor.getAttribute('href') || '').toLowerCase();
    if (!href) return null;
    for (const [kind, pattern] of SOCIAL_PATTERNS) {
      if (pattern.test(href)) return kind;
    }
    return null;
  }

  private trySocial(el: Element): NewBlock | null {
    const anchors = Array.from(el.querySelectorAll('a[href]'));
    if (el.tagName.toLowerCase() === 'a' && el.hasAttribute('href')) anchors.push(el);
    const kinds = anchors.map((a) => this.socialKind(a));
    const socialCount = kinds.filter(Boolean).length;
    if (!socialCount) return null;
    const marked = classTokens(el).some((t) => /social|redes/.test(t));
    if (socialCount < 2 && !marked) return null;
    const others = anchors.filter((_, i) => !kinds[i]);
    if (others.length > 1) return null;

    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll('a').forEach((a) => a.remove());
    if (meaningfulText(clone).replace(/[|•·\-–—/]/g, '').trim().length > 3) return null;
    if (this.significantImages(el).some((img) => !img.closest('a'))) return null;

    const block: NewBlock = { type: 'social' };
    const target = block as Record<string, unknown>;
    anchors.forEach((a, i) => {
      const kind = kinds[i];
      const href = a.getAttribute('href') || '';
      if (kind && kind !== 'other') target[kind] ??= href;
    });
    const website = others[0]?.getAttribute('href') || anchors.find((_, i) => kinds[i] === 'other')?.getAttribute('href');
    if (website) block.websiteUrl = website;
    const bg = this.blockBg(el);
    if (bg) block.bgColor = bg;
    return block;
  }

  private isFooterContainer(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    const marked = tag === 'footer' || classTokens(el).some((t) => /(^|[-_])(footer|rodape|rodapé)([-_]|$)/.test(t));
    return marked && !this.isPageWrapper(el);
  }

  private isHeaderContainer(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    const marked = tag === 'header' || classTokens(el).some((t) => /(^|[-_])(header|cabecalho|cabeçalho|topo)([-_]|$)/.test(t));
    return marked && !this.isPageWrapper(el) && this.textLength(el) <= 300;
  }

  private tryCoupon(el: Element): NewBlock | null {
    const s = this.styles(el);
    const marked = classTokens(el).some((t) => /coupon|cupom|voucher/.test(t));
    const borders = [s.border, s['border-style'], s['border-top'], s['border-top-style']].join(' ');
    if (!marked && !/dashed|dotted/.test(borders)) return null;
    const text = meaningfulText(el);
    if (!text || text.length > 160 || this.significantImages(el).length || this.hasButton(el)) return null;

    const lines = htmlToPlainLines(this.inlineHtml(Array.from(el.childNodes)));
    let code: string | undefined;
    let codeIndex = lines.findIndex((line) => /^(cupom|c[oó]digo|code)\b\s*:?/i.test(line));
    if (codeIndex !== -1) {
      code = lines[codeIndex].replace(/^(cupom|c[oó]digo|code)\b\s*:?\s*/i, '').trim();
      if (!code && lines[codeIndex + 1]) {
        code = lines[codeIndex + 1];
        lines.splice(codeIndex + 1, 1);
      }
    } else {
      codeIndex = lines.findIndex((line) => /^[A-Z0-9][A-Z0-9_-]{2,24}$/.test(line));
      if (codeIndex !== -1) code = lines[codeIndex];
    }
    if (!code && !marked) return null;
    const discount = lines.filter((_, i) => i !== codeIndex).join(' ');

    return {
      type: 'coupon',
      couponCode: code || lines[0],
      couponDiscount: discount || undefined,
      couponBgColor: this.ownBg(el),
      couponBorderColor: parseColor(s['border-color']) || parseColor(s.border) || parseColor(s['border-top']),
      bgColor: el.parentElement ? this.blockBg(el.parentElement) : undefined,
    };
  }

  /** A short block with its own background and a heading: the classic hero banner. */
  private tryBanner(el: Element): NewBlock | null {
    if (this.isPageWrapper(el)) return null;
    const ownBg = this.ownBg(el);
    const parentBg = el.parentElement ? this.inheritedBg(el.parentElement) : undefined;
    if (!ownBg || ownBg === parentBg || ownBg === '#ffffff') return null;
    const text = meaningfulText(el);
    if (!text || text.length > 250 || this.significantImages(el).length || this.hasButton(el)) return null;

    const runs: Array<{ nodes: Node[]; container: Element }> = [];
    this.collectRuns(el, runs);
    if (!runs.length || runs.length > 3) return null;

    const sized = runs.map((r) => {
      const { source } = this.runStyleSource(r.nodes, r.container);
      const heading = this.up(source, (e) => (/^h[12]$/.test(e.tagName.toLowerCase()) ? true : undefined));
      return { ...r, source, size: this.fontSize(source), heading: Boolean(heading) };
    });
    const title = sized.find((r) => r.heading) || [...sized].sort((a, b) => b.size - a.size)[0];
    if (!title.heading && title.size < 20) return null;

    const htmlOf = (r: typeof title) => this.inlineHtml(r.source === r.container ? r.nodes : Array.from(r.source.childNodes));
    const subtitles = sized.filter((r) => r !== title);
    const titleColor = this.color(title.source);
    const subtitleColor = subtitles[0] ? this.color(subtitles[0].source) : undefined;
    const align = this.align(title.source);

    return {
      type: 'header_text',
      headerTitle: htmlOf(title),
      headerSubtitle: subtitles.length ? subtitles.map(htmlOf).filter(Boolean).join('<br/>') : undefined,
      headerBgColor: ownBg,
      headerTextColor: titleColor && contrastRatio(titleColor, ownBg) >= 2 ? titleColor : readableTextOn(ownBg),
      headerSubtitleColor: subtitleColor && contrastRatio(subtitleColor, ownBg) >= 2 ? subtitleColor : readableTextOn(ownBg),
      headerSubtitleSizePx: subtitles[0] ? subtitles[0].size : undefined,
      fontSizePx: title.size,
      alignment: align || 'center',
      isBold: this.bold(title.source),
      fontFamily: this.fontFamily(title.source),
    };
  }

  private collectRuns(container: Element, out: Array<{ nodes: Node[]; container: Element }>) {
    let run: Node[] = [];
    const flush = () => {
      if (run.some((n) => meaningfulText(n))) out.push({ nodes: run, container });
      run = [];
    };
    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === TEXT_NODE) run.push(child);
      else if (child.nodeType === ELEMENT_NODE && !SKIP_TAGS.has((child as Element).tagName.toLowerCase())) {
        if (this.isBlockLevel(child as Element)) {
          flush();
          this.collectRuns(child as Element, out);
        } else {
          run.push(child);
        }
      }
    }
    flush();
  }

  private dividerBlock(el: Element): NewBlock {
    const s = this.styles(el);
    const declaration = [s['border-top'], s['border-bottom'], s.border, s['border-style'], s['border-top-style']].filter(Boolean).join(' ');
    const color = parseColor(s['border-top-color'])
      || parseColor(s['border-top'])
      || parseColor(s['border-bottom'])
      || parseColor(s['border-color'])
      || parseColor(s.border)
      || parseColor(el.getAttribute('color') || undefined)
      || this.ownBg(el);
    return {
      type: 'divider',
      dividerStyle: /dashed/.test(declaration) ? 'dashed' : /dotted/.test(declaration) ? 'dotted' : 'solid',
      dividerColor: color,
      bgColor: el.parentElement ? this.blockBg(el.parentElement) : undefined,
    };
  }

  /** Empty elements are spacers unless they paint a thin visible line. */
  private dividerFromSpacer(el: Element): NewBlock | null {
    const s = this.styles(el);
    const height = parsePx(s.height);
    const line = s['border-top'] || s['border-bottom'] || '';
    if (/solid|dashed|dotted|double/.test(line) && (height === undefined || height <= 10)) return this.dividerBlock(el);
    const bg = this.ownBg(el);
    if (height !== undefined && height > 0 && height <= 4 && bg && el.parentElement && bg !== this.inheritedBg(el.parentElement)) {
      return { type: 'divider', dividerStyle: 'solid', dividerColor: bg };
    }
    return null;
  }

  // ----- R9 round trip -------------------------------------------------------

  /** Rebuilds blocks produced by this editor's own compiler (preview or export HTML). */
  private parseR9Block(el: Element): NewBlock | null {
    const field = (name: string) => el.querySelector(`[data-inline-edit="${name}"]`);
    const bg = this.ownBg(el);
    const htmlOf = (e: Element) => this.inlineHtml(Array.from(e.childNodes));
    const align = (e: Element): Align | undefined => {
      const v = this.styles(e)['text-align'];
      return v === 'left' || v === 'center' || v === 'right' || v === 'justify' ? v : undefined;
    };
    const typography = (e: Element) => {
      const s = this.styles(e);
      const size = parseFontSize(s['font-size'] || '', 16);
      const deco = s['text-decoration'] || '';
      const transform = s['text-transform'];
      return {
        fontSizePx: size ? Math.round(size) : undefined,
        isBold: s['font-weight'] ? /bold/.test(s['font-weight']) || parseInt(s['font-weight'], 10) >= 600 : undefined,
        isItalic: s['font-style'] ? /italic/.test(s['font-style']) : undefined,
        isUnderline: /underline/.test(deco) || undefined,
        isStrikethrough: /line-through/.test(deco) || undefined,
        textTransform: transform === 'uppercase' || transform === 'lowercase' || transform === 'capitalize' ? transform : undefined,
        fontFamily: normalizeFontFamily(s['font-family']),
        lineHeight: s['line-height'],
        alignment: align(e) || align(el),
      } as const;
    };

    if (classTokens(el).includes('r9-columns')) {
      const tds = Array.from(el.querySelectorAll('td.r9-col'));
      if (tds.length >= MIN_COLUMNS) {
        let firstText: Element | null = null;
        let firstButton: Element | null = null;
        const columns: ColumnCell[] = tds.slice(0, MAX_COLUMNS).map((td, index) => {
          const img = td.querySelector('img');
          const text = td.querySelector(`[data-inline-edit="columns.${index}.text"]`);
          const button = td.querySelector(`[data-inline-edit="columns.${index}.buttonLabel"]`);
          firstText ??= text;
          firstButton ??= button;
          return {
            imageUrl: img?.getAttribute('src') || undefined,
            imageAlt: img?.getAttribute('alt') || undefined,
            imageLink: img?.closest('a')?.getAttribute('href') || undefined,
            text: text ? htmlOf(text) : undefined,
            buttonLabel: button ? htmlOf(button) : undefined,
            buttonUrl: button?.getAttribute('href') || undefined,
          };
        });
        // Assigned inside the callback above; widen back from the initial `null` narrowing.
        const textEl = firstText as Element | null;
        const buttonEl = firstButton as Element | null;
        const textStyles: Styles = textEl ? this.styles(textEl) : {};
        const buttonStyles: Styles = buttonEl ? this.styles(buttonEl) : {};
        const cellAlign = align(tds[0]);
        return {
          type: 'columns',
          columns,
          textColor: parseColor(textStyles.color),
          fontSizePx: textStyles['font-size'] ? parsePx(textStyles['font-size']) : undefined,
          fontFamily: normalizeFontFamily(textStyles['font-family']),
          lineHeight: textStyles['line-height'],
          alignment: cellAlign === 'justify' ? undefined : cellAlign,
          buttonBgColor: parseColor(buttonStyles['background-color']),
          buttonTextColor: parseColor(buttonStyles.color),
          bgColor: bg,
        };
      }
    }

    const headerTitle = field('headerTitle');
    if (headerTitle) {
      const subtitle = field('headerSubtitle');
      const t = typography(headerTitle);
      return {
        type: 'header_text',
        headerTitle: htmlOf(headerTitle),
        headerSubtitle: subtitle ? htmlOf(subtitle) : undefined,
        headerBgColor: bg,
        headerTextColor: parseColor(this.styles(headerTitle).color),
        headerSubtitleColor: subtitle ? parseColor(this.styles(subtitle).color) : undefined,
        headerSubtitleSizePx: subtitle ? parsePx(this.styles(subtitle)['font-size']) : undefined,
        fontSizePx: t.fontSizePx,
        isBold: t.isBold,
        isItalic: t.isItalic,
        textTransform: t.textTransform,
        fontFamily: t.fontFamily,
        alignment: align(el) || t.alignment,
      };
    }

    const buttonLabel = field('buttonLabel');
    if (buttonLabel) {
      const s = this.styles(buttonLabel);
      const t = typography(buttonLabel);
      return {
        type: 'button',
        buttonLabel: htmlOf(buttonLabel),
        buttonUrl: buttonLabel.getAttribute('href') || '#',
        buttonBgColor: parseColor(s['background-color']),
        buttonTextColor: parseColor(s.color),
        buttonWidth: classTokens(buttonLabel).includes('btn-full') ? 'full' : 'auto',
        alignment: align(el),
        fontSizePx: t.fontSizePx,
        isBold: t.isBold,
        isItalic: t.isItalic,
        textTransform: t.textTransform,
        fontFamily: t.fontFamily,
        bgColor: bg,
      };
    }

    const couponCode = field('couponCode');
    if (couponCode) {
      const box = couponCode.parentElement || el;
      const discount = field('couponDiscount');
      const boxStyles = this.styles(box);
      return {
        type: 'coupon',
        couponCode: meaningfulText(couponCode),
        couponDiscount: discount ? meaningfulText(discount) : undefined,
        couponBgColor: this.ownBg(box),
        couponBorderColor: parseColor(boxStyles.border) || parseColor(boxStyles['border-color']),
        bgColor: bg,
      };
    }

    const footerText = field('footerText');
    if (footerText) {
      const t = typography(footerText);
      return {
        ...t,
        type: 'footer',
        footerText: htmlOf(footerText),
        footerBgColor: bg,
        footerTextColor: parseColor(this.styles(footerText).color),
      };
    }

    const classes = classTokens(el);
    if (classes.includes('social-block')) {
      const block: NewBlock = { type: 'social', bgColor: bg };
      const byLabel: Record<string, keyof EmailBlock> = {
        instagram: 'instagramUrl', whatsapp: 'whatsappUrl', linkedin: 'linkedinUrl', facebook: 'facebookUrl', website: 'websiteUrl',
      };
      el.querySelectorAll('a[href]').forEach((a) => {
        const key = byLabel[meaningfulText(a).toLowerCase()];
        if (key) (block as Record<string, unknown>)[key] = a.getAttribute('href');
      });
      return block;
    }

    if (classes.includes('header-img-container') || classes.includes('img-container')) {
      const img = el.querySelector('img');
      const caption = el.querySelector(':scope > p');
      const width = parsePx(img?.getAttribute('width'));
      return {
        type: classes.includes('header-img-container') ? 'header_image' : 'image',
        imageUrl: img?.getAttribute('src') || '',
        imageAlt: img?.getAttribute('alt') || el.querySelector('[role="img"]')?.getAttribute('aria-label') || undefined,
        imageLink: el.querySelector('a[href]')?.getAttribute('href') || undefined,
        imageCaption: caption ? htmlOf(caption) : undefined,
        imageWidthPx: width,
        alignment: align(el),
        bgColor: bg,
      };
    }

    const hr = el.querySelector('hr');
    if (hr && !meaningfulText(el)) return { ...this.dividerBlock(hr), bgColor: bg };

    const text = field('text');
    if (text) {
      const tag = text.tagName.toLowerCase();
      return {
        ...typography(text),
        type: tag === 'h2' ? 'title' : tag === 'p' ? 'subtitle' : 'text',
        text: htmlOf(text),
        textColor: parseColor(this.styles(text).color),
        bgColor: bg,
      };
    }
    return null;
  }

  // ----- post-processing ------------------------------------------------------

  /** Joins consecutive footer fragments, plus small print that directly follows a footer. */
  private mergeFooters() {
    for (let i = 1; i < this.blocks.length; i += 1) {
      const previous = this.blocks[i - 1];
      const current = this.blocks[i];
      if (previous.type !== 'footer') continue;
      const isSmallPrint = current.type === 'text' && (current.fontSizePx ?? 16) <= 13;
      if (current.type !== 'footer' && !isSmallPrint) continue;
      const extra = current.type === 'footer' ? current.footerText : current.text;
      if (extra) previous.footerText = previous.footerText ? `${previous.footerText}<br/>${extra}` : extra;
      this.blocks.splice(i, 1);
      i -= 1;
    }
  }
}

/**
 * Parses and cleans imported HTML (sanitized, hidden content and tracking
 * pixels removed). Shared by the importer and the import analysis so both
 * measure the same visible content.
 */
export function prepareImportDocument(html?: string | null): Document | null {
  if (!html || typeof html !== 'string' || !html.trim() || typeof DOMParser === 'undefined') return null;
  const safeHtml = sanitizeImportHtml(html);
  if (!safeHtml) return null;
  const doc = new DOMParser().parseFromString(safeHtml, 'text/html');
  if (!doc.body) return null;
  new BlockImporter(doc);
  return doc;
}

const HIDDEN_STYLE = /display\s*:\s*none|max-height\s*:\s*0(?:px)?\s*(?:;|$)|mso-hide\s*:\s*all|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)/i;

/**
 * Reads the inbox preview text (hidden "preheader") and the <title> of an HTML
 * e-mail, so importing keeps them as the e-mail's preheader and subject.
 */
export function extractEmailMeta(html?: string | null): { preheader?: string; subject?: string } {
  if (!html || typeof html !== 'string' || typeof DOMParser === 'undefined') return {};
  const doc = new DOMParser().parseFromString(sanitizeImportHtml(html), 'text/html');
  const clean = (value: string) => convertForeignMergeTags(value.replace(INVISIBLE_CHARS, ' ').replace(/[͏‌]/g, ' ').replace(/\s+/g, ' ').trim());
  const meta: { preheader?: string; subject?: string } = {};

  // The preheader is a hidden element placed before any visible content.
  for (const el of Array.from(doc.body?.querySelectorAll('[style]') || [])) {
    const style = el.getAttribute('style') || '';
    if (!HIDDEN_STYLE.test(style)) {
      if (meaningfulText(el) && !el.querySelector('[style]')) break;
      continue;
    }
    const text = clean(el.textContent || '');
    if (text) {
      meta.preheader = text.slice(0, 200);
      break;
    }
  }
  const title = clean(doc.querySelector('title')?.textContent || '');
  if (title && title.length <= 200) meta.subject = title;
  return meta;
}

/** Converts an HTML e-mail (third-party or exported by this editor) into editable blocks. */
export function parseHtmlToBlocks(html?: string | null): EmailBlock[] {
  if (!html || typeof html !== 'string' || !html.trim() || typeof DOMParser === 'undefined') return [];
  try {
    const safeHtml = sanitizeImportHtml(html);
    if (!safeHtml) return [];
    const doc = new DOMParser().parseFromString(safeHtml, 'text/html');
    if (!doc.body) return [];
    return new BlockImporter(doc).run();
  } catch (error) {
    console.error('Falha ao converter HTML em blocos:', error);
    return [
      {
        id: 'block-fallback-1',
        type: 'text',
        text: 'Não foi possível carregar a estrutura original do e-mail. Adicione novos blocos para editar.',
      },
    ];
  }
}
