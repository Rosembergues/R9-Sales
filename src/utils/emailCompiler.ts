import type { EmailBlock, EmailData } from '../types';
import { escapeHtml, sanitizeCssValue, sanitizeEmailHtml, sanitizeRichText, sanitizeUrl } from './security';
import { generateSingleBlockHtml } from './compiler';
import { normalizeBlocks } from './blockNormalizer';

/**
 * Produces the transport/export version of a visual template.
 * The preview compiler remains DOM-friendly; this compiler adds a table-based
 * email shell, Outlook conditional markup and conservative email CSS.
 */
/** Plain text of a rich-text label (for VML, which cannot contain HTML). */
function richTextToPlain(value: string): string {
  if (typeof DOMParser === 'undefined') return value.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

const CONTENT_WIDTH = 600;
const BUTTON_SIDE_PADDING = 28;

/**
 * Outlook for Windows (Word engine) ignores padding and border-radius on links, so
 * the classic "bulletproof" VML roundrect is emitted for it while every other client
 * gets the regular HTML link.
 */
function outlookButton(options: {
  url: string; label: string; bg: string; color: string; fontFamily: string;
  size: number; bold: boolean; isFull: boolean; uppercase: boolean;
}): string {
  const height = Math.round(options.size * 1.2 + 28);
  const maxWidth = CONTENT_WIDTH - BUTTON_SIDE_PADDING * 2;
  const charWidth = options.size * (options.uppercase ? 0.72 : 0.62);
  const width = options.isFull
    ? maxWidth
    : Math.max(120, Math.min(maxWidth, Math.round(options.label.length * charWidth + 56)));
  // Values are already sanitized; escapeHtml also guarantees the comment can't be closed early ("-->").
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(options.url)}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="17%" stroke="f" fillcolor="${escapeHtml(options.bg)}">
<w:anchorlock/>
<center style="color:${escapeHtml(options.color)};font-family:${escapeHtml(options.fontFamily)};font-size:${options.size}px;font-weight:${options.bold ? 'bold' : 'normal'};">${escapeHtml(options.uppercase ? options.label.toUpperCase() : options.label)}</center>
</v:roundrect>
<![endif]-->`;
}

/** Hidden inbox preview text, padded so clients don't pull body text after it. */
function preheaderHtml(preheader: string): string {
  const text = preheader.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const filler = '&#847;&zwnj;&nbsp;'.repeat(Math.max(0, 110 - text.length));
  return `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(text)}${filler}</div>`;
}

export function compileBlocksForEmail(blocks: EmailBlock[], data?: EmailData): string {
  const content = normalizeBlocks(blocks).map((block) => {
    if (block.type === 'button') {
      const align = block.alignment === 'left' || block.alignment === 'right' ? block.alignment : 'center';
      const bg = sanitizeCssValue(block.buttonBgColor || '#4f46e5', '#4f46e5');
      const color = sanitizeCssValue(block.buttonTextColor || '#ffffff', '#ffffff');
      // Same rich-text policy as the editor preview, so formatting applied in the editor is exported as-is.
      const label = sanitizeRichText(block.buttonLabel || 'Clique Aqui');
      const url = sanitizeUrl(block.buttonUrl, 'href') || '#';
      const isFull = block.buttonWidth === 'full';
      const fontFamily = sanitizeCssValue(block.fontFamily || 'Helvetica, Arial, sans-serif', 'Helvetica, Arial, sans-serif');
      const size = block.fontSizePx ?? 15;
      const weight = block.isBold === false ? 'normal' : 'bold';
      const italic = block.isItalic ? 'font-style:italic;' : '';
      const transform = block.textTransform && block.textTransform !== 'none' ? `text-transform:${block.textTransform};` : '';
      const outerBg = block.bgColor ? sanitizeCssValue(block.bgColor) : '';
      const outerBgAttrs = outerBg ? ` bgcolor="${outerBg}"` : '';
      const outerBgStyle = outerBg ? `background-color:${outerBg};` : '';
      const vml = outlookButton({
        url, label: richTextToPlain(label), bg, color, fontFamily, size,
        bold: weight === 'bold', isFull, uppercase: block.textTransform === 'uppercase',
      });
      return `<tr><td align="${align}"${outerBgAttrs} style="padding:20px ${BUTTON_SIDE_PADDING}px;${outerBgStyle}">
        ${vml}
        <!--[if !mso]><!-->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="${align}"${isFull ? ' width="100%"' : ''}><tr><td align="center" bgcolor="${bg}" style="border-radius:8px;">
          <a href="${url}" target="_blank" style="display:${isFull ? 'block' : 'inline-block'};background-color:${bg};color:${color} !important;font-family:${fontFamily};font-size:${size}px;font-weight:${weight};${italic}${transform}line-height:1.2;text-decoration:none;padding:14px 28px;border-radius:8px;">${label}</a>
        </td></tr></table>
        <!--<![endif]-->
      </td></tr>`;
    }
    if (block.type === 'image' || block.type === 'header_image') {
      const src = sanitizeUrl(block.imageUrl, 'src') || '';
      const alt = escapeHtml(block.imageAlt || 'Imagem do e-mail');
      const href = sanitizeUrl(block.imageLink, 'href');
      const align = ['left', 'center', 'right'].includes(block.alignment || '') ? block.alignment! : 'center';
      const bg = sanitizeCssValue(block.bgColor || '#ffffff', '#ffffff');
      const width = Number.isFinite(block.imageWidthPx) ? Math.max(80, Math.min(1200, Number(block.imageWidthPx))) : 600;
      const image = src
        ? `<img src="${src}" alt="${alt}" width="${width}"${block.type === 'header_image' ? ' class="email-header-img"' : ''} style="display:block;width:${width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;margin:${align === 'left' ? '0 auto 0 0' : align === 'right' ? '0 0 0 auto' : '0 auto'};" />`
        : `<div role="img" aria-label="${alt}" style="padding:32px 16px;background:#f1f5f9;color:#64748b;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:13px;">Imagem não definida</div>`;
      const body = href && src ? `<a href="${href}" target="_blank" style="display:block;text-decoration:none;">${image}</a>` : image;
      return `<tr><td align="${align}" bgcolor="${bg}" style="padding:0;background-color:${bg};">${body}</td></tr>`;
    }
    const blockHtml = generateSingleBlockHtml(block);
    if (!blockHtml) return '';
    return `<tr><td align="center" valign="top" style="padding:0;margin:0;">${blockHtml}</td></tr>`;
  }).join('');

  const subject = (data?.subject || '').trim();
  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
${subject ? `<title>${escapeHtml(subject)}</title>` : ''}
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  table { border-collapse:collapse !important; }
  img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; max-width:100%; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#f1f5f9; }
  a { text-decoration:none; }
  @media screen and (max-width:620px) {
    .email-shell { width:100% !important; }
    .email-padding { padding-left:0 !important; padding-right:0 !important; }
    .email-body { width:100% !important; }
  }
  @media screen and (max-width:480px) {
    .r9-col { display:block !important; width:100% !important; box-sizing:border-box; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
${preheaderHtml(data?.preheader || '')}
<center role="article" aria-roledescription="email" lang="pt-BR" style="width:100%;background-color:#f1f5f9;">
<!--[if mso]>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" align="center"><tr><td>
<![endif]-->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-shell" style="max-width:600px;margin:0 auto;background:#ffffff;">
  <tr><td class="email-padding" style="padding:0;margin:0;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-body">
      ${content}
    </table>
  </td></tr>
</table>
<!--[if mso]>
</td></tr></table>
<![endif]-->
</center>
</body>
</html>`;

  return sanitizeEmailHtml(html);
}

export function compileTransportHtml(data: EmailData, blocks: EmailBlock[]): string {
  // The visual editor is authoritative when the document source is blocks.
  // customCodeHtml is a derived preview cache in that mode, not the transport source.
  if (data.contentSource === 'html' && data.customCodeHtml) {
    return sanitizeEmailHtml(data.customCodeHtml);
  }
  return compileBlocksForEmail(blocks, data);
}

export function validateEmailLinks(html: string): { valid: boolean; invalidUrls: string[] } {
  const invalidUrls: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('a[href],img[src]').forEach((node) => {
    const attr = node.tagName.toLowerCase() === 'img' ? 'src' : 'href';
    const value = node.getAttribute(attr);
    if (!value || value.startsWith('{{') || value.startsWith('#')) return;
    if (!sanitizeUrl(value, node.tagName.toLowerCase() === 'img' ? 'src' : 'href')) invalidUrls.push(value);
  });
  return { valid: invalidUrls.length === 0, invalidUrls };
}
