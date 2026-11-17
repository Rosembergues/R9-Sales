import type { EmailBlock } from '../types';
import { normalizeBlocks } from './blockNormalizer';
import { sanitizeRichText, sanitizeUrl } from './security';

const BLOCK_TAGS = /^(p|div|h[1-6]|li|ul|ol|blockquote|tr|table)$/;

/** Rich text → readable plain text; links become "texto (url)". */
export function richTextToPlainText(html: unknown): string {
  const source = String(html ?? '');
  if (!source.trim()) return '';
  if (typeof DOMParser === 'undefined') return source.replace(/<[^>]*>/g, '').trim();

  const doc = new DOMParser().parseFromString(`<div>${sanitizeRichText(source.replace(/\n/g, '<br/>'))}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const out: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      out.push((node.textContent || '').replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') {
      out.push('\n');
      return;
    }
    const isBlock = BLOCK_TAGS.test(tag);
    if (isBlock) out.push('\n');
    if (tag === 'li') out.push('• ');
    el.childNodes.forEach(visit);
    if (tag === 'a') {
      const href = sanitizeUrl(el.getAttribute('href'), 'href');
      const label = (el.textContent || '').trim();
      if (href && !href.startsWith('#') && label !== href && label !== href.replace(/^mailto:|^tel:/, '')) out.push(` (${href})`);
    }
    if (isBlock) out.push('\n');
  };
  root.childNodes.forEach(visit);

  return out.join('')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function link(label: string, url: unknown): string {
  const href = sanitizeUrl(url, 'href');
  if (!href || href === '#') return label;
  return label ? `${label}: ${href}` : href;
}

function blockToText(block: EmailBlock): string {
  switch (block.type) {
    case 'header':
    case 'header_text':
      return [richTextToPlainText(block.headerTitle).toUpperCase(), richTextToPlainText(block.headerSubtitle)].filter(Boolean).join('\n');
    case 'title': {
      const title = richTextToPlainText(block.text);
      return title ? `${title}\n${'='.repeat(Math.min(60, title.length))}` : '';
    }
    case 'subtitle':
    case 'text':
      return richTextToPlainText(block.text);
    case 'button':
      return link(richTextToPlainText(block.buttonLabel) || 'Acessar', block.buttonUrl);
    case 'image':
    case 'header_image': {
      const href = sanitizeUrl(block.imageLink, 'href');
      const alt = (block.imageAlt || '').trim();
      if (href) return link(alt ? `[${alt}]` : '', href);
      return '';
    }
    case 'coupon':
      return [block.couponDiscount && richTextToPlainText(block.couponDiscount), block.couponCode && `Cupom: ${richTextToPlainText(block.couponCode)}`]
        .filter(Boolean).join('\n');
    case 'divider':
      return '----------------------------------------';
    case 'social':
      return [
        ['Instagram', block.instagramUrl], ['WhatsApp', block.whatsappUrl], ['LinkedIn', block.linkedinUrl],
        ['Facebook', block.facebookUrl], ['Site', block.websiteUrl],
      ]
        .filter(([, url]) => sanitizeUrl(url, 'href'))
        .map(([label, url]) => link(String(label), url))
        .join('\n');
    case 'footer':
      return richTextToPlainText(block.footerText);
    case 'columns':
      return (block.columns || [])
        .map((cell) => {
          const parts: string[] = [];
          const text = richTextToPlainText(cell.text);
          if (text) parts.push(text);
          else if (cell.imageAlt && sanitizeUrl(cell.imageLink, 'href')) parts.push(link(`[${cell.imageAlt}]`, cell.imageLink));
          const label = richTextToPlainText(cell.buttonLabel);
          if (label) parts.push(link(label, cell.buttonUrl));
          return parts.join('\n');
        })
        .filter(Boolean)
        .join('\n\n');
    default:
      return '';
  }
}

/**
 * Plain-text alternative of the e-mail (the text/plain part of a multipart message).
 * Senders that include it are less likely to be flagged as spam, and it is what
 * text-only clients and some smartwatches display.
 */
export function compilePlainText(blocks: EmailBlock[]): string {
  const parts = normalizeBlocks(blocks).map(blockToText).filter((part) => part.trim());
  return `${parts.join('\n\n').trim()}\n`;
}
