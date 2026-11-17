import type { EmailBlock } from '../types';
import { backgroundUrl, parseHtmlToBlocks, prepareImportDocument } from './htmlParser';

export interface HtmlImportAnalysis {
  blocks: EmailBlock[];
  blockCount: number;
  sourceWordCount: number;
  retainedWordCount: number;
  textCoveragePercent: number | null;
  sourceImageCount: number;
  retainedImageCount: number;
  sourceLinkCount: number;
  retainedLinkCount: number;
  hasContentLoss: boolean;
}

const CONTENT_FIELDS: Array<keyof EmailBlock> = [
  'text', 'headerTitle', 'headerSubtitle', 'footerText', 'buttonLabel',
  'couponCode', 'couponDiscount', 'couponTitle', 'couponExpiry', 'imageAlt', 'imageCaption',
];

const BLOCK_BOUNDARY_SELECTOR = 'address, article, aside, blockquote, br, center, div, footer, h1, h2, h3, h4, h5, h6, header, hr, li, ol, p, section, table, td, th, tr, ul';

const LINK_FIELDS: Array<keyof EmailBlock> = [
  'buttonUrl', 'imageLink', 'instagramUrl', 'whatsappUrl', 'linkedinUrl', 'facebookUrl', 'websiteUrl',
];

function getWords(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
}

function countRetainedWords(sourceWords: string[], outputWords: string[]): number {
  const available = new Map<string, number>();
  sourceWords.forEach((word) => available.set(word, (available.get(word) || 0) + 1));
  let retained = 0;
  outputWords.forEach((word) => {
    const remaining = available.get(word) || 0;
    if (remaining > 0) {
      retained += 1;
      available.set(word, remaining - 1);
    }
  });
  return retained;
}

function appendHtmlValue(doc: Document, value: string, outputParts: string[], outputImages: string[], outputLinks: string[]) {
  const fragment = doc.createElement('div');
  if (/<\/?[a-z][^>]*>/i.test(value)) {
    fragment.innerHTML = value;
  } else {
    fragment.textContent = value;
  }
  outputParts.push(fragment.textContent || '');
  fragment.querySelectorAll('img[src]').forEach((image) => {
    const src = image.getAttribute('src')?.trim();
    if (src) outputImages.push(src);
  });
  fragment.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim();
    if (href) outputLinks.push(href);
  });
}

function countMatchingOccurrences(source: string[], output: string[]): number {
  const available = new Map<string, number>();
  output.forEach((value) => available.set(value, (available.get(value) || 0) + 1));
  let matched = 0;
  source.forEach((value) => {
    const remaining = available.get(value) || 0;
    if (remaining > 0) {
      matched += 1;
      available.set(value, remaining - 1);
    }
  });
  return matched;
}

/**
 * Estimates how much visible text, image, and link content survives the conversion
 * into editable blocks. This intentionally measures content, not visual fidelity:
 * complex layout/styling can still be simplified during block conversion.
 */
export function analyzeHtmlConversion(html: string): HtmlImportAnalysis {
  const blocks = parseHtmlToBlocks(html);
  // Same cleaned document the parser sees: hidden preheaders and tracking pixels
  // are intentionally dropped and must not count as lost content.
  const sourceDoc = prepareImportDocument(html) || new DOMParser().parseFromString('', 'text/html');
  const root = sourceDoc.body;

  root.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
  // textContent glues adjacent blocks ("ofertas</h1><p>Até" → "ofertasAté"); separate them first.
  root.querySelectorAll(BLOCK_BOUNDARY_SELECTOR).forEach((node) => {
    node.before(' ');
    node.after(' ');
  });
  const sourceWords = getWords(root.textContent || '');
  // Icons (≤ 40px, e.g. social icons replaced by a social block) are decoration, not content.
  const isDecorative = (image: Element) => {
    const w = Number(image.getAttribute('width'));
    const h = Number(image.getAttribute('height'));
    return (w > 0 || h > 0) && (!w || w <= 40) && (!h || h <= 40);
  };
  const sourceImages = Array.from(root.querySelectorAll('img[src]'))
    .filter((image) => !isDecorative(image))
    .map((image) => image.getAttribute('src')?.trim())
    .filter((src): src is string => Boolean(src));
  // Background images (hero banners) are content too; a page texture that is not
  // imported then shows up as a non-recognized image instead of disappearing silently.
  const backgrounds = new Set<string>();
  root.querySelectorAll('[style*="url"], [background]').forEach((el) => {
    const url = backgroundUrl(el, { background: el.getAttribute('style') || '' });
    if (url) backgrounds.add(url);
  });
  sourceImages.push(...backgrounds);
  const sourceLinks = Array.from(root.querySelectorAll('a[href]'))
    .map((anchor) => anchor.getAttribute('href')?.trim())
    .filter((href): href is string => Boolean(href));

  const outputParts: string[] = [];
  const outputImages: string[] = [];
  const outputLinks: string[] = [];
  blocks.forEach((block) => {
    CONTENT_FIELDS.forEach((field) => {
      const value = block[field];
      if (typeof value === 'string' && value.trim()) {
        appendHtmlValue(sourceDoc, value, outputParts, outputImages, outputLinks);
      }
    });
    (block.columns || []).forEach((cell) => {
      [cell.text, cell.buttonLabel, cell.imageAlt].forEach((value) => {
        if (value?.trim()) appendHtmlValue(sourceDoc, value, outputParts, outputImages, outputLinks);
      });
      if (cell.imageUrl?.trim()) outputImages.push(cell.imageUrl.trim());
      [cell.imageLink, cell.buttonUrl].forEach((value) => {
        if (value?.trim()) outputLinks.push(value.trim());
      });
    });
    if (block.imageUrl?.trim()) outputImages.push(block.imageUrl.trim());
    LINK_FIELDS.forEach((field) => {
      const value = block[field];
      if (typeof value === 'string' && value.trim()) outputLinks.push(value.trim());
    });
  });

  const outputWords = outputParts.flatMap(getWords);
  const retainedWordCount = countRetainedWords(sourceWords, outputWords);
  const textCoveragePercent = sourceWords.length
    ? Math.max(0, Math.min(100, Math.round((retainedWordCount / sourceWords.length) * 100)))
    : null;
  const retainedImageCount = countMatchingOccurrences(sourceImages, outputImages);
  const retainedLinkCount = countMatchingOccurrences(sourceLinks, outputLinks);
  const hasContentLoss =
    (textCoveragePercent !== null && textCoveragePercent < 100) ||
    retainedImageCount < sourceImages.length ||
    retainedLinkCount < sourceLinks.length;

  return {
    blocks,
    blockCount: blocks.length,
    sourceWordCount: sourceWords.length,
    retainedWordCount,
    textCoveragePercent,
    sourceImageCount: sourceImages.length,
    retainedImageCount,
    sourceLinkCount: sourceLinks.length,
    retainedLinkCount,
    hasContentLoss,
  };
}
