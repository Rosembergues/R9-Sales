import type { EmailBlock, EmailData } from '../types';
import { normalizeBlocks } from './blockNormalizer';
import { contrastRatio } from './color';
import { findUnknownVariables } from './sampleData';
import { findForeignMergeTags } from './mergeTags';
import { sanitizeUrl } from './security';

export type ChecklistSeverity = 'error' | 'warning';

export interface ChecklistIssue {
  id: string;
  severity: ChecklistSeverity;
  title: string;
  detail?: string;
  /** Block to select so the user can fix it. */
  blockId?: string;
  /** E-mail level setting to open (subject/preheader live in the e-mail settings panel). */
  target?: 'settings';
}

/** Gmail clips messages larger than ~102 KB and hides the rest behind "Ver mensagem inteira". */
export const GMAIL_CLIP_BYTES = 102 * 1024;
const SIZE_WARNING_BYTES = 90 * 1024;

const BLOCK_NAMES: Record<string, string> = {
  header: 'Cabeçalho', header_text: 'Cabeçalho', header_image: 'Imagem do cabeçalho', title: 'Título',
  subtitle: 'Subtítulo', text: 'Texto', button: 'Botão', image: 'Imagem', coupon: 'Cupom',
  divider: 'Divisor', social: 'Redes sociais', footer: 'Rodapé', columns: 'Colunas',
};

const PLACEHOLDER_HOSTS = /(^|\.)(exemplo\.com(\.br)?|example\.(com|org|net)|seusite\.com(\.br)?|suaempresa\.com(\.br)?)$/i;
const GENERIC_ALTS = new Set([
  'imagem', 'imagem ilustrativa', 'imagem de cabeçalho', 'imagem do e-mail', 'banner promocional',
  'cabeçalho do e-mail', 'preview', 'image', 'banner',
]);
const GENERIC_SOCIAL = /^https?:\/\/(www\.)?(instagram\.com|linkedin\.com|facebook\.com|wa\.me|whatsapp\.com)\/?$/i;

function plain(html: unknown): string {
  return String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

type LinkProblem = 'missing' | 'placeholder' | 'insecure' | null;

function linkProblem(url: unknown): LinkProblem {
  const raw = String(url ?? '').trim();
  if (!raw || raw === '#' || raw === 'https://' || raw === 'http://') return 'missing';
  if (/^\{\{[^}]+\}\}$/.test(raw)) return null; // filled in by the sender
  const safe = sanitizeUrl(raw, 'href');
  if (!safe) return 'missing';
  if (/^https?:/i.test(safe)) {
    try {
      const host = new URL(safe.replace(/\{\{[^}]+\}\}/g, 'x')).hostname;
      if (PLACEHOLDER_HOSTS.test(host)) return 'placeholder';
    } catch {
      return 'missing';
    }
  }
  if (/^http:/i.test(safe)) return 'insecure';
  return null;
}

function anchorsIn(html: unknown): string[] {
  return Array.from(String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)).map((m) => m[2]);
}

/** Text fields of a block, used for variable and inline-link checks. */
function textFields(block: EmailBlock): string[] {
  const values = [
    block.text, block.headerTitle, block.headerSubtitle, block.footerText, block.buttonLabel,
    block.couponCode, block.couponDiscount, block.imageCaption,
  ];
  for (const cell of block.columns || []) values.push(cell.text, cell.buttonLabel);
  return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return unescape(encodeURIComponent(value)).length;
}

/**
 * Pre-export review aimed at non-technical users: catches the mistakes that
 * actually reach recipients (placeholder links, missing images, unreadable
 * colors, unknown merge variables, clipped messages).
 */
export function runEmailChecklist(rawBlocks: EmailBlock[], data: EmailData, transportHtml: string): ChecklistIssue[] {
  const issues: ChecklistIssue[] = [];
  const blocks = normalizeBlocks(rawBlocks);
  const add = (issue: Omit<ChecklistIssue, 'id'>) => issues.push({ ...issue, id: `${issue.blockId || issue.target || 'email'}-${issues.length}` });

  // ----- e-mail settings ------------------------------------------------------
  const subject = (data.subject || '').trim();
  if (!subject || subject === 'E-mail sem assunto') {
    add({ severity: 'error', title: 'O e-mail está sem assunto', detail: 'O assunto é a primeira coisa que o destinatário lê.', target: 'settings' });
  } else if (subject.length > 80) {
    add({ severity: 'warning', title: 'Assunto longo', detail: `Tem ${subject.length} caracteres; no celular costumam aparecer só uns 40.`, target: 'settings' });
  }
  const preheader = (data.preheader || '').trim();
  if (!preheader) {
    add({ severity: 'warning', title: 'Sem texto de pré-visualização (preheader)', detail: 'Sem ele, a caixa de entrada mostra o começo do e-mail, que costuma ser pouco atrativo.', target: 'settings' });
  }
  for (const tag of findForeignMergeTags(`${subject} ${preheader}`)) {
    add({ severity: 'error', title: `Variável de outra plataforma ${tag} no assunto ou preheader`, detail: 'Ela chegaria escrita assim para o destinatário.', target: 'settings' });
  }
  for (const variable of findUnknownVariables(`${subject} ${preheader}`)) {
    add({ severity: 'error', title: `Variável desconhecida ${variable} no assunto ou preheader`, detail: 'Ela chegaria escrita assim para o destinatário.', target: 'settings' });
  }

  if (!blocks.length) {
    add({ severity: 'error', title: 'O e-mail não tem nenhum bloco' });
    return issues;
  }

  // ----- blocks ---------------------------------------------------------------
  const checkLink = (url: unknown, blockId: string, what: string, required: boolean) => {
    const problem = linkProblem(url);
    if (problem === 'missing' && required) add({ severity: 'error', title: `${what} sem link`, detail: 'Informe o endereço para onde o clique deve levar.', blockId });
    if (problem === 'placeholder') add({ severity: 'error', title: `${what} com link de exemplo`, detail: `Troque "${String(url)}" pelo link real.`, blockId });
    if (problem === 'insecure') add({ severity: 'warning', title: `${what} com link sem https`, detail: 'Links "http://" podem ser marcados como inseguros.', blockId });
  };
  const checkImage = (url: unknown, alt: unknown, blockId: string, what: string) => {
    const src = String(url ?? '').trim();
    if (!src) {
      add({ severity: 'error', title: `${what} sem imagem`, detail: 'Envie uma imagem ou remova o bloco.', blockId });
      return;
    }
    if (/^data:/i.test(src)) {
      add({ severity: 'error', title: `${what} não está hospedada`, detail: 'Imagens embutidas no HTML são bloqueadas pelo Gmail e pelo Outlook. Clique em "Trocar imagem" para enviá-la à nuvem.', blockId });
    } else if (/^http:/i.test(src)) {
      add({ severity: 'warning', title: `${what} usa http://`, detail: 'Alguns clientes bloqueiam imagens sem https.', blockId });
    }
    const altText = String(alt ?? '').trim();
    if (!altText || GENERIC_ALTS.has(altText.toLowerCase())) {
      add({ severity: 'warning', title: `${what} sem descrição (texto alternativo)`, detail: 'Muitos clientes bloqueiam imagens até o destinatário liberar; a descrição aparece no lugar.', blockId });
    }
  };
  const checkContrast = (fg: unknown, bg: unknown, sizePx: number, bold: boolean, blockId: string, what: string) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) return;
    const large = sizePx >= 24 || (sizePx >= 18 && bold);
    const minimum = large ? 3 : 4.5;
    if (ratio < minimum) {
      add({
        severity: ratio < 2 ? 'error' : 'warning',
        title: `${what}: texto difícil de ler`,
        detail: `O contraste entre o texto e o fundo é ${ratio.toFixed(1)}:1; o recomendado é pelo menos ${minimum}:1.`,
        blockId,
      });
    }
  };

  let hasFooter = false;
  blocks.forEach((block) => {
    const id = block.id;
    const name = BLOCK_NAMES[block.type] || 'Bloco';
    const size = block.fontSizePx ?? 15;

    const linkFields = [block.buttonUrl, block.imageLink, ...(block.columns || []).flatMap((c) => [c.buttonUrl, c.imageLink])]
      .filter((v): v is string => typeof v === 'string');
    for (const tag of new Set([...textFields(block), ...linkFields].flatMap(findForeignMergeTags))) {
      add({ severity: 'error', title: `${name}: variável de outra plataforma ${tag}`, detail: 'O disparador do R9 não substitui essa variável; ela chegaria escrita assim. Troque por {{nome}}, {{email}} ou {{var1}} a {{var3}}.', blockId: id });
    }
    for (const variable of new Set(textFields(block).flatMap(findUnknownVariables))) {
      add({ severity: 'error', title: `${name}: variável desconhecida ${variable}`, detail: 'Ela chegaria escrita assim para o destinatário. Use {{nome}}, {{email}} ou {{var1}} a {{var3}}.', blockId: id });
    }
    for (const field of textFields(block)) {
      for (const href of anchorsIn(field)) {
        const problem = linkProblem(href);
        if (problem === 'missing' || problem === 'placeholder') {
          add({ severity: 'error', title: `${name}: link no texto ${problem === 'placeholder' ? 'é de exemplo' : 'está vazio'}`, detail: href ? `Endereço atual: ${href}` : undefined, blockId: id });
        }
      }
    }

    switch (block.type) {
      case 'header':
      case 'header_text':
        checkContrast(block.headerTextColor || '#ffffff', block.headerBgColor || block.bgColor || '#003bb3', block.fontSizePx ?? 28, block.isBold !== false, id, name);
        break;
      case 'title':
      case 'subtitle':
      case 'text':
        if (!plain(block.text)) add({ severity: 'warning', title: `${name} vazio`, blockId: id });
        checkContrast(block.textColor || (block.type === 'title' ? '#1e1b4b' : '#334155'), block.bgColor || '#ffffff', size, Boolean(block.isBold), id, name);
        break;
      case 'button':
        if (!plain(block.buttonLabel)) add({ severity: 'error', title: 'Botão sem texto', blockId: id });
        checkLink(block.buttonUrl, id, 'Botão', true);
        checkContrast(block.buttonTextColor || '#ffffff', block.buttonBgColor || '#4f46e5', size, block.isBold !== false, id, name);
        break;
      case 'image':
      case 'header_image':
        checkImage(block.imageUrl, block.imageAlt, id, name);
        checkLink(block.imageLink, id, name, false);
        break;
      case 'coupon':
        if (!plain(block.couponCode)) add({ severity: 'error', title: 'Cupom sem código', blockId: id });
        checkContrast('#0f172a', block.couponBgColor || '#f0fdf4', 22, true, id, name);
        break;
      case 'social': {
        const urls = [block.instagramUrl, block.whatsappUrl, block.linkedinUrl, block.facebookUrl, block.websiteUrl]
          .map((u) => String(u ?? '').trim()).filter(Boolean);
        if (!urls.length) add({ severity: 'warning', title: 'Redes sociais sem nenhum link', detail: 'O bloco aparecerá vazio.', blockId: id });
        if (urls.some((u) => GENERIC_SOCIAL.test(u))) {
          add({ severity: 'warning', title: 'Rede social com link genérico', detail: 'Use o endereço do perfil da empresa (ex.: instagram.com/suaempresa), não só o site da rede.', blockId: id });
        }
        urls.forEach((u) => checkLink(u, id, name, false));
        break;
      }
      case 'footer':
        hasFooter = true;
        checkContrast(block.footerTextColor || '#64748b', block.footerBgColor || block.bgColor || '#f8fafc', size, Boolean(block.isBold), id, name);
        break;
      case 'columns':
        (block.columns || []).forEach((cell, index) => {
          const what = `Coluna ${index + 1}`;
          if (cell.imageUrl) checkImage(cell.imageUrl, cell.imageAlt, id, `${what}: imagem`);
          if (cell.imageUrl) checkLink(cell.imageLink, id, `${what}: imagem`, false);
          if (plain(cell.buttonLabel)) checkLink(cell.buttonUrl, id, `${what}: botão`, true);
          if (!cell.imageUrl && !plain(cell.text) && !plain(cell.buttonLabel)) {
            add({ severity: 'warning', title: `${what} está vazia`, blockId: id });
          }
        });
        checkContrast(block.textColor || '#334155', block.bgColor || '#ffffff', block.fontSizePx ?? 14, false, id, name);
        if ((block.columns || []).some((cell) => plain(cell.buttonLabel))) {
          checkContrast(block.buttonTextColor || '#ffffff', block.buttonBgColor || '#4f46e5', 14, true, id, `${name} (botões)`);
        }
        break;
      default:
        break;
    }
  });

  if (!hasFooter) {
    add({ severity: 'warning', title: 'E-mail sem rodapé', detail: 'Inclua quem envia e como deixar de receber; isso evita denúncias de spam.' });
  }

  // ----- size -----------------------------------------------------------------
  const bytes = byteLength(transportHtml || '');
  if (bytes > GMAIL_CLIP_BYTES) {
    add({ severity: 'error', title: 'O Gmail vai cortar este e-mail', detail: `O HTML tem ${Math.round(bytes / 1024)} KB; acima de 102 KB o Gmail esconde o final (incluindo o rodapé).` });
  } else if (bytes > SIZE_WARNING_BYTES) {
    add({ severity: 'warning', title: 'E-mail perto do limite do Gmail', detail: `O HTML tem ${Math.round(bytes / 1024)} KB; o Gmail corta acima de 102 KB.` });
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}
