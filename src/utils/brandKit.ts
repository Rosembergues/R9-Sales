import type { EmailBlock } from '../types';
import { isSafeCssColor, normalizeFontFamily } from './blockNormalizer';
import { readableTextOn } from './color';
import { sanitizeUrl } from './security';

/**
 * Visual identity applied to new blocks (and, on request, to the current e-mail),
 * so a non-technical user does not have to pick the right colors every time.
 */
export interface BrandKit {
  headerBgColor: string;
  buttonColor: string;
  headingColor: string;
  textColor: string;
  fontFamily: string;
  logoUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  websiteUrl: string;
  footerText: string;
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  headerBgColor: '#003bb3',
  buttonColor: '#4f46e5',
  headingColor: '#1e1b4b',
  textColor: '#334155',
  fontFamily: 'Helvetica, Arial, sans-serif',
  logoUrl: '',
  instagramUrl: '',
  whatsappUrl: '',
  linkedinUrl: '',
  facebookUrl: '',
  websiteUrl: '',
  footerText: 'Você está recebendo este e-mail enviado para {{email}}.\n© 2026 Todos os direitos reservados.',
};

const COLOR_KEYS = ['headerBgColor', 'buttonColor', 'headingColor', 'textColor'] as const;
const URL_KEYS = ['instagramUrl', 'whatsappUrl', 'linkedinUrl', 'facebookUrl', 'websiteUrl'] as const;

/** Coerces stored/edited data into a safe kit, falling back to defaults field by field. */
export function normalizeBrandKit(raw: unknown): BrandKit {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const kit: BrandKit = { ...DEFAULT_BRAND_KIT };
  for (const key of COLOR_KEYS) {
    if (isSafeCssColor(source[key])) kit[key] = String(source[key]).trim();
  }
  for (const key of URL_KEYS) {
    if (typeof source[key] === 'string') kit[key] = sanitizeUrl(source[key], 'href');
  }
  if (typeof source.logoUrl === 'string') kit.logoUrl = sanitizeUrl(source.logoUrl, 'src');
  const font = normalizeFontFamily(source.fontFamily);
  if (font) kit.fontFamily = font;
  if (typeof source.footerText === 'string') kit.footerText = source.footerText.slice(0, 2000);
  return kit;
}

function socialFrom(kit: BrandKit): Partial<EmailBlock> {
  const urls: Partial<EmailBlock> = {};
  for (const key of URL_KEYS) if (kit[key]) urls[key] = kit[key];
  return urls;
}

/**
 * Recolors an existing e-mail with the kit. Content (texts, links, images) is
 * never touched, except that empty social links and an empty header image are
 * filled from the kit.
 */
export function applyBrandKitToBlocks(blocks: EmailBlock[], kit: BrandKit): EmailBlock[] {
  return blocks.map((block) => {
    const next: EmailBlock = { ...block };
    if (block.type !== 'divider' && block.type !== 'image' && block.type !== 'header_image') {
      next.fontFamily = kit.fontFamily;
    }
    switch (block.type) {
      case 'header':
      case 'header_text': {
        const text = readableTextOn(kit.headerBgColor);
        next.headerBgColor = kit.headerBgColor;
        next.headerTextColor = text;
        next.headerSubtitleColor = text;
        break;
      }
      case 'title':
        next.textColor = kit.headingColor;
        break;
      case 'subtitle':
      case 'text':
        next.textColor = kit.textColor;
        break;
      case 'button':
        next.buttonBgColor = kit.buttonColor;
        next.buttonTextColor = readableTextOn(kit.buttonColor);
        break;
      case 'columns':
        next.textColor = kit.textColor;
        next.buttonBgColor = kit.buttonColor;
        next.buttonTextColor = readableTextOn(kit.buttonColor);
        break;
      case 'coupon':
        next.couponBorderColor = kit.buttonColor;
        break;
      case 'header_image':
        if (!block.imageUrl && kit.logoUrl) next.imageUrl = kit.logoUrl;
        break;
      case 'social':
        for (const key of URL_KEYS) {
          if (!block[key] && kit[key]) next[key] = kit[key];
        }
        break;
      default:
        break;
    }
    return next;
  });
}

/** Default content for a new block, styled with the brand kit. */
export function createDefaultBlock(type: EmailBlock['type'], id: string, kit: BrandKit = DEFAULT_BRAND_KIT): EmailBlock {
  const base: EmailBlock = { id, type };
  const font = kit.fontFamily;
  switch (type) {
    case 'header_text':
    case 'header': {
      const text = readableTextOn(kit.headerBgColor);
      return {
        ...base,
        headerTitle: 'Título do seu e-mail',
        headerSubtitle: 'Uma frase curta que explica a novidade',
        headerBgColor: kit.headerBgColor,
        headerTextColor: text,
        headerSubtitleColor: text,
        fontSizePx: 28,
        headerSubtitleSizePx: 16,
        alignment: 'center',
        isBold: true,
        fontFamily: font,
      };
    }
    case 'title':
      return { ...base, text: 'Novo título', fontSizePx: 26, textColor: kit.headingColor, alignment: 'left', isBold: true, fontFamily: font };
    case 'subtitle':
      return { ...base, text: 'Insira aqui seu subtítulo curto de apoio', fontSizePx: 18, textColor: kit.textColor, alignment: 'left', fontFamily: font };
    case 'text':
      return {
        ...base,
        text: 'Olá {{nome}}, escreva aqui o texto do seu e-mail.',
        fontSizePx: 15,
        textColor: kit.textColor,
        alignment: 'left',
        lineHeight: '1.6',
        fontFamily: font,
      };
    case 'button':
      return {
        ...base,
        buttonLabel: 'Clique aqui',
        buttonUrl: kit.websiteUrl || '',
        buttonBgColor: kit.buttonColor,
        buttonTextColor: readableTextOn(kit.buttonColor),
        buttonWidth: 'auto',
        alignment: 'center',
        fontSizePx: 16,
        isBold: true,
        fontFamily: font,
      };
    case 'image':
      return { ...base, imageUrl: '', imageAlt: '', imageCaption: '', imageWidthPx: 600, alignment: 'center', bgColor: '#ffffff' };
    case 'header_image':
      return {
        ...base,
        imageUrl: kit.logoUrl || '',
        imageAlt: '',
        imageCaption: '',
        imageWidthPx: kit.logoUrl ? 200 : 600,
        alignment: 'center',
        bgColor: '#ffffff',
        imageLink: kit.websiteUrl || undefined,
      };
    case 'coupon':
      return {
        ...base,
        couponCode: 'CUPOM10',
        couponDiscount: '10% DE DESCONTO',
        couponBgColor: '#f8fafc',
        couponBorderColor: kit.buttonColor,
        fontSizePx: 22,
        isBold: true,
      };
    case 'divider':
      return { ...base, dividerStyle: 'solid', dividerColor: '#e2e8f0' };
    case 'social':
      return { ...base, ...socialFrom(kit) };
    case 'footer':
      return {
        ...base,
        footerText: kit.footerText,
        footerBgColor: '#f8fafc',
        footerTextColor: '#64748b',
        fontSizePx: 12,
        alignment: 'center',
        fontFamily: font,
      };
    case 'columns':
      return {
        ...base,
        columns: [
          { text: '<b>Produto 1</b><br/>Descrição curta do item.', buttonLabel: 'Saiba mais', buttonUrl: kit.websiteUrl || '' },
          { text: '<b>Produto 2</b><br/>Descrição curta do item.', buttonLabel: 'Saiba mais', buttonUrl: kit.websiteUrl || '' },
        ],
        textColor: kit.textColor,
        buttonBgColor: kit.buttonColor,
        buttonTextColor: readableTextOn(kit.buttonColor),
        fontSizePx: 14,
        alignment: 'center',
        fontFamily: font,
      };
    default:
      return base;
  }
}
