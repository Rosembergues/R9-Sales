import type { BlockType, ColumnCell, EmailBlock } from '../types';

const BLOCK_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  'header', 'header_text', 'header_image', 'title', 'subtitle', 'text',
  'button', 'image', 'coupon', 'divider', 'social', 'footer', 'columns',
]);

const COLUMN_STRING_KEYS = ['imageUrl', 'imageAlt', 'imageLink', 'text', 'buttonLabel', 'buttonUrl'] as const;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 3;

/** Coerces the cells of a "columns" block: always 2 or 3 plain-string cells. */
export function normalizeColumns(raw: unknown): ColumnCell[] {
  const source = Array.isArray(raw) ? raw.slice(0, MAX_COLUMNS) : [];
  const cells: ColumnCell[] = source.map((item) => {
    const cell: ColumnCell = {};
    if (item && typeof item === 'object') {
      for (const key of COLUMN_STRING_KEYS) {
        const value = (item as Record<string, unknown>)[key];
        if (typeof value === 'string') cell[key] = value.slice(0, 10_000);
      }
    }
    return cell;
  });
  while (cells.length < MIN_COLUMNS) cells.push({});
  return cells;
}

const STRING_KEYS = [
  'text', 'headerTitle', 'headerSubtitle', 'buttonLabel', 'buttonUrl', 'imageUrl', 'imageAlt',
  'imageLink', 'imageCaption', 'couponCode', 'couponDiscount', 'couponTitle', 'couponExpiry',
  'instagramUrl', 'whatsappUrl', 'linkedinUrl', 'facebookUrl', 'websiteUrl', 'footerText',
] as const;

const COLOR_KEYS = [
  'textColor', 'bgColor', 'headerBgColor', 'headerTextColor', 'headerSubtitleColor',
  'buttonBgColor', 'buttonTextColor', 'couponBgColor', 'couponBorderColor', 'dividerColor',
  'footerBgColor', 'footerTextColor',
] as const;

const BOOLEAN_KEYS = ['isBold', 'isItalic', 'isUnderline', 'isStrikethrough'] as const;

const NUMBER_RANGES = {
  fontSizePx: [8, 72],
  headerSubtitleSizePx: [8, 72],
  imageWidthPx: [80, 1200],
  dividerHeight: [1, 20],
} as const;

const ENUMS = {
  alignment: ['left', 'center', 'right', 'justify'],
  fontSize: ['sm', 'md', 'lg', 'xl'],
  textTransform: ['none', 'uppercase', 'lowercase', 'capitalize'],
  buttonWidth: ['full', 'auto'],
  dividerStyle: ['solid', 'dashed', 'dotted'],
} as const;

const MAX_TEXT_LENGTH = 50_000;

export function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)
    || /^(?:rgba?|hsla?)\(\s*[0-9.,%\s/deg]{1,60}\)$/i.test(v)
    || /^[a-z]{3,20}$/i.test(v);
}

export function normalizeFontFamily(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.replace(/"/g, "'").trim();
  return /^[A-Za-z0-9 ,'_-]{1,160}$/.test(v) ? v : undefined;
}

function normalizeLineHeight(value: unknown): string | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d+(?:\.\d+)?\s*$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return String(Math.round(Math.max(1, Math.min(3, n)) * 100) / 100);
}

let generatedIdCounter = 0;
function generateBlockId(): string {
  generatedIdCounter += 1;
  return `block-${Date.now().toString(36)}-${generatedIdCounter}`;
}

/**
 * Coerces untrusted block data (database rows, imports, old drafts) into a
 * well-formed EmailBlock. Unknown keys are dropped and every value that is
 * interpolated into HTML attributes is restricted to a safe shape.
 */
export function normalizeBlock(raw: unknown): EmailBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const type = source.type as BlockType;
  if (!BLOCK_TYPES.has(type)) return null;

  const id = typeof source.id === 'string' && source.id.trim() && source.id.length <= 120
    ? source.id
    : typeof source.id === 'number' ? String(source.id) : generateBlockId();
  const block: EmailBlock = { id, type };
  const target = block as unknown as Record<string, unknown>;

  for (const key of STRING_KEYS) {
    const value = source[key];
    if (typeof value === 'string') target[key] = value.slice(0, MAX_TEXT_LENGTH);
  }
  for (const key of COLOR_KEYS) {
    if (isSafeCssColor(source[key])) target[key] = (source[key] as string).trim();
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') target[key] = source[key];
  }
  for (const [key, [min, max]] of Object.entries(NUMBER_RANGES)) {
    const value = typeof source[key] === 'string' ? Number(source[key]) : source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      target[key] = Math.round(Math.max(min, Math.min(max, value)));
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = source[key];
    if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) target[key] = value;
  }

  const fontFamily = normalizeFontFamily(source.fontFamily);
  if (fontFamily) block.fontFamily = fontFamily;
  const lineHeight = normalizeLineHeight(source.lineHeight);
  if (lineHeight) block.lineHeight = lineHeight;
  if (type === 'columns') block.columns = normalizeColumns(source.columns);

  return block;
}

export function normalizeBlocks(raw: unknown): EmailBlock[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const blocks: EmailBlock[] = [];
  for (const item of raw) {
    const block = normalizeBlock(item);
    if (!block) continue;
    if (seen.has(block.id)) block.id = generateBlockId();
    seen.add(block.id);
    blocks.push(block);
  }
  return blocks;
}
