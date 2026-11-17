import type { BlockType, EmailBlock } from '../types';
import { sanitizeUrl } from '../utils/security';
import { normalizeColumns } from '../utils/blockNormalizer';

export type BlockPropertyKind =
  | 'text'
  | 'richtext'
  | 'url'
  | 'image'
  | 'color'
  | 'number'
  | 'select'
  | 'boolean';

export type BlockPropertySection = 'content' | 'typography' | 'layout' | 'appearance' | 'advanced';

export interface BlockPropertyDefinition {
  key: keyof EmailBlock;
  label: string;
  kind: BlockPropertyKind;
  section: BlockPropertySection;
  blockTypes: BlockType[];
  min?: number;
  max?: number;
  step?: number;
  options?: readonly { label: string; value: string }[];
}

const TEXT_BLOCKS: BlockType[] = ['header', 'header_text', 'title', 'subtitle', 'text', 'button', 'coupon', 'footer'];
const TYPOGRAPHY_BLOCKS: BlockType[] = ['header', 'header_text', 'title', 'subtitle', 'text', 'button', 'coupon', 'footer'];

export const BLOCK_PROPERTY_DEFINITIONS: readonly BlockPropertyDefinition[] = [
  { key: 'headerTitle', label: 'Título do cabeçalho', kind: 'text', section: 'content', blockTypes: ['header', 'header_text'] },
  { key: 'headerSubtitle', label: 'Subtítulo do cabeçalho', kind: 'text', section: 'content', blockTypes: ['header', 'header_text'] },
  { key: 'text', label: 'Texto', kind: 'richtext', section: 'content', blockTypes: ['title', 'subtitle', 'text'] },
  { key: 'buttonLabel', label: 'Rótulo do botão', kind: 'text', section: 'content', blockTypes: ['button'] },
  { key: 'buttonUrl', label: 'URL do botão', kind: 'url', section: 'content', blockTypes: ['button'] },
  { key: 'imageUrl', label: 'Imagem', kind: 'image', section: 'content', blockTypes: ['image', 'header_image'] },
  { key: 'imageAlt', label: 'Texto alternativo', kind: 'text', section: 'content', blockTypes: ['image', 'header_image'] },
  { key: 'imageLink', label: 'Link da imagem', kind: 'url', section: 'content', blockTypes: ['image', 'header_image'] },
  { key: 'imageCaption', label: 'Legenda', kind: 'text', section: 'content', blockTypes: ['image', 'header_image'] },
  { key: 'imageWidthPx', label: 'Largura da imagem (px)', kind: 'number', section: 'layout', blockTypes: ['image', 'header_image'], min: 80, max: 1200, step: 1 },
  { key: 'couponCode', label: 'Código do cupom', kind: 'text', section: 'content', blockTypes: ['coupon'] },
  { key: 'couponDiscount', label: 'Desconto', kind: 'text', section: 'content', blockTypes: ['coupon'] },
  { key: 'couponTitle', label: 'Título do cupom', kind: 'text', section: 'content', blockTypes: ['coupon'] },
  { key: 'couponExpiry', label: 'Validade', kind: 'text', section: 'content', blockTypes: ['coupon'] },
  { key: 'footerText', label: 'Texto do rodapé', kind: 'text', section: 'content', blockTypes: ['footer'] },
  { key: 'fontFamily', label: 'Família da fonte', kind: 'select', section: 'typography', blockTypes: TYPOGRAPHY_BLOCKS },
  { key: 'fontSizePx', label: 'Tamanho da fonte', kind: 'number', section: 'typography', blockTypes: TYPOGRAPHY_BLOCKS, min: 8, max: 72, step: 1 },
  { key: 'lineHeight', label: 'Altura da linha', kind: 'number', section: 'typography', blockTypes: ['title', 'subtitle', 'text'], min: 1, max: 3, step: 0.1 },
  { key: 'alignment', label: 'Alinhamento', kind: 'select', section: 'typography', blockTypes: TEXT_BLOCKS, options: [
    { label: 'Esquerda', value: 'left' }, { label: 'Centro', value: 'center' }, { label: 'Direita', value: 'right' }, { label: 'Justificado', value: 'justify' },
  ] },
  { key: 'textTransform', label: 'Transformação', kind: 'select', section: 'typography', blockTypes: TEXT_BLOCKS, options: [
    { label: 'Normal', value: 'none' }, { label: 'Maiúsculas', value: 'uppercase' }, { label: 'Minúsculas', value: 'lowercase' }, { label: 'Capitalizar', value: 'capitalize' },
  ] },
  { key: 'isBold', label: 'Negrito', kind: 'boolean', section: 'typography', blockTypes: TYPOGRAPHY_BLOCKS },
  { key: 'isItalic', label: 'Itálico', kind: 'boolean', section: 'typography', blockTypes: TYPOGRAPHY_BLOCKS },
  { key: 'isUnderline', label: 'Sublinhado', kind: 'boolean', section: 'typography', blockTypes: TYPOGRAPHY_BLOCKS },
  { key: 'isStrikethrough', label: 'Tachado', kind: 'boolean', section: 'typography', blockTypes: TYPOGRAPHY_BLOCKS },
  { key: 'textColor', label: 'Cor do texto', kind: 'color', section: 'appearance', blockTypes: ['title', 'subtitle', 'text'] },
  { key: 'bgColor', label: 'Cor de fundo', kind: 'color', section: 'appearance', blockTypes: [...TEXT_BLOCKS, 'image', 'header_image'] },
  { key: 'buttonBgColor', label: 'Cor do botão', kind: 'color', section: 'appearance', blockTypes: ['button'] },
  { key: 'buttonTextColor', label: 'Cor do texto do botão', kind: 'color', section: 'appearance', blockTypes: ['button'] },
  { key: 'buttonWidth', label: 'Largura do botão', kind: 'select', section: 'layout', blockTypes: ['button'], options: [
    { label: 'Automática', value: 'auto' }, { label: 'Largura total', value: 'full' },
  ] },
  { key: 'dividerStyle', label: 'Estilo do divisor', kind: 'select', section: 'appearance', blockTypes: ['divider'], options: [
    { label: 'Sólido', value: 'solid' }, { label: 'Tracejado', value: 'dashed' }, { label: 'Pontilhado', value: 'dotted' },
  ] },
  { key: 'dividerColor', label: 'Cor do divisor', kind: 'color', section: 'appearance', blockTypes: ['divider'] },
  { key: 'dividerHeight', label: 'Altura do divisor', kind: 'number', section: 'layout', blockTypes: ['divider'], min: 1, max: 20, step: 1 },
];

export function getBlockPropertyDefinitions(type: BlockType, section?: BlockPropertySection) {
  return BLOCK_PROPERTY_DEFINITIONS.filter((definition) =>
    definition.blockTypes.includes(type) && (!section || definition.section === section),
  );
}

const URL_KEYS = new Set<keyof EmailBlock>(['buttonUrl', 'imageLink', 'instagramUrl', 'whatsappUrl', 'linkedinUrl', 'facebookUrl', 'websiteUrl']);
const COLOR_KEYS = new Set<keyof EmailBlock>([
  'textColor', 'bgColor', 'headerBgColor', 'headerTextColor', 'headerSubtitleColor',
  'buttonBgColor', 'buttonTextColor', 'couponBgColor', 'couponBorderColor', 'dividerColor', 'footerBgColor', 'footerTextColor',
]);

function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed) || /^(rgb|rgba|hsl|hsla)\([^)]{1,80}\)$/i.test(trimmed)) return trimmed;
  return null;
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return sanitizeUrl(trimmed, 'href') || null;
}

export function sanitizeBlockPropertyUpdate(updatedProps: Partial<Omit<EmailBlock, 'lineHeight'> & { lineHeight?: string | number }>): Partial<EmailBlock> {
  const result: Partial<EmailBlock> = {};
  for (const [rawKey, rawValue] of Object.entries(updatedProps)) {
    const key = rawKey as keyof EmailBlock;
    if (key === 'id' || key === 'type') continue;

    if (URL_KEYS.has(key)) {
      const value = String(rawValue ?? '');
      const normalized = normalizeUrl(value);
      if (normalized !== null) (result as Record<string, unknown>)[key] = normalized;
      continue;
    }

    if (COLOR_KEYS.has(key)) {
      const normalized = normalizeColor(String(rawValue ?? ''));
      if (normalized) (result as Record<string, unknown>)[key] = normalized;
      continue;
    }

    if (key === 'fontSizePx' || key === 'dividerHeight' || key === 'headerSubtitleSizePx' || key === 'imageWidthPx') {
      const value = Number(rawValue);
      if (Number.isFinite(value)) {
        const max = key === 'fontSizePx' ? 72 : key === 'imageWidthPx' ? 1200 : 20;
        const min = key === 'imageWidthPx' ? 80 : 1;
        (result as Record<string, unknown>)[key] = Math.max(min, Math.min(max, value));
      }
      continue;
    }

    if (key === 'columns') {
      result.columns = normalizeColumns(rawValue).map((cell) => ({
        ...cell,
        imageUrl: cell.imageUrl ? sanitizeUrl(cell.imageUrl, 'src') : cell.imageUrl,
        imageLink: cell.imageLink ? sanitizeUrl(cell.imageLink, 'href') : cell.imageLink,
        buttonUrl: cell.buttonUrl ? sanitizeUrl(cell.buttonUrl, 'href') : cell.buttonUrl,
      }));
      continue;
    }

    if (key === 'lineHeight') {
      const value = Number(rawValue);
      if (Number.isFinite(value)) result.lineHeight = String(Math.max(1, Math.min(3, value)));
      continue;
    }

    (result as Record<string, unknown>)[key] = rawValue;
  }
  return result;
}
