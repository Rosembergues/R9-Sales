/**
 * Central security helpers for user-controlled HTML, URLs and CSS values.
 *
 * The editor runs in a browser, so HTML sanitization uses the platform DOMParser
 * instead of a regex-based HTML parser. The same policy is reused by previews,
 * rich text and imported custom HTML.
 */

const BLOCKED_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'textarea',
  'select', 'option', 'button', 'base', 'link', 'stylelink'
]);

const ALLOWED_RICH_TEXT_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br', 'p', 'div', 'span',
  'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]);

const ALLOWED_EMAIL_TAGS = new Set([
  'html', 'head', 'body', 'title', 'meta', 'style', 'center', 'table', 'thead', 'tbody',
  'tfoot', 'tr', 'td', 'th', 'div', 'span', 'p', 'br', 'hr', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'a', 'img', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'blockquote', 'ul', 'ol', 'li', 'small', 'sup', 'sub'
]);

const SAFE_URL_PROTOCOLS = /^(https?:|mailto:|tel:)/i;
const SAFE_IMAGE_PROTOCOLS = /^(https?:|data:image\/(?:png|jpeg|gif|webp);base64,)/i;
const DANGEROUS_CSS = /(expression\s*\(|behavior\s*:|-moz-binding\s*:|@import\b|url\s*\()/i;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeCssValue(value: unknown, fallback = ''): string {
  const raw = String(value ?? '').trim();
  if (!raw || DANGEROUS_CSS.test(raw)) return fallback;
  // Values are interpolated into double-quoted style attributes, so a double quote
  // would close the attribute; single quotes keep font names like 'Segoe UI' valid.
  return raw
    .replace(/"/g, "'")
    .replace(/[<>\\{};=`]/g, '')
    .replace(/\bjavascript\s*:/gi, '')
    .replace(/\bvbscript\s*:/gi, '');
}

const TEMPLATE_VARIABLE = /\{\{[A-Za-z0-9_.-]+\}\}/g;

/**
 * URLs may contain mail-merge variables, e.g. https://portal.exemplo/{{var1}}
 * or a variable that itself contains the complete URL, e.g. {{var1}}.
 * Validate the static URL structure while keeping the template tokens intact.
 */
function normalizeTemplateUrl(raw: string): string | null {
  const tokens = raw.match(TEMPLATE_VARIABLE) || [];
  if (tokens.length === 0) return null;

  const withoutTokens = raw.replace(TEMPLATE_VARIABLE, 'r9var');
  if (!SAFE_URL_PROTOCOLS.test(withoutTokens)) return null;

  try {
    const parsed = new URL(withoutTokens);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:' && parsed.protocol !== 'mailto:' && parsed.protocol !== 'tel:') {
      return null;
    }
  } catch {
    return null;
  }

  return raw.replace(/[\"'<>]/g, '');
}

export function sanitizeUrl(value: unknown, kind: 'href' | 'src' = 'href'): string {
  let raw = String(value ?? '').trim();
  if (!raw) return '';
  // Protocol-relative URLs (//cdn.example.com/img.png) are common in exported e-mails.
  if (/^\/\/[a-z0-9]/i.test(raw)) raw = `https:${raw}`;

  if (kind === 'src') {
    return SAFE_IMAGE_PROTOCOLS.test(raw) ? raw.replace(/[\"'<>]/g, '') : '';
  }

  const normalizedTemplate = normalizeTemplateUrl(raw);
  if (normalizedTemplate) return normalizedTemplate;

  // A complete template variable is allowed to resolve to a URL at send time.
  if (/^\{\{[A-Za-z0-9_.-]+\}\}$/.test(raw)) return raw;

  return SAFE_URL_PROTOCOLS.test(raw) ? raw.replace(/[\"'<>]/g, '') : '';
}

/** Splits a style attribute on top-level semicolons (ignores those inside quotes or parentheses). */
function splitDeclarations(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let buffer = '';
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === ';' && depth === 0) {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  parts.push(buffer);
  return parts.map((part) => part.trim()).filter(Boolean);
}

const UNSAFE_DECLARATION = /expression\s*\(|behavior\s*:|-moz-binding|@import|javascript\s*:|vbscript\s*:|\\/i;

/** True when every url(...) in the declaration is a plain http(s) address (background images). */
function hasOnlySafeUrls(declaration: string): boolean {
  const urls = Array.from(declaration.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi));
  const urlCount = (declaration.match(/url\s*\(/gi) || []).length;
  if (urls.length !== urlCount) return false;
  return urls.every(([, , target]) => /^(?:https?:)?\/\/[^\s'"()<>]+$/i.test(target.trim()));
}

/**
 * Removes only the unsafe declarations of a style attribute. Dropping the whole
 * attribute (as before) also lost harmless colors next to a background image,
 * e.g. white text on a dark banner turned into white text on white.
 */
function sanitizeStyleAttribute(value: string): string {
  return splitDeclarations(value)
    .filter((declaration) => !UNSAFE_DECLARATION.test(declaration))
    .filter((declaration) => !/url\s*\(/i.test(declaration) || hasOnlySafeUrls(declaration))
    .map((declaration) => declaration.replace(/[<>]/g, ''))
    .join('; ');
}

function sanitizeStyleElement(styleElement: Element): void {
  const css = styleElement.textContent || '';
  styleElement.textContent = css
    .replace(/@import[^;]+;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .replace(/-moz-binding\s*:[^;]+;?/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*(?:javascript:|vbscript:)[^)]*\)/gi, '');
}

function sanitizeElements(elements: Element[], allowedTags: Set<string>, allowStyle: boolean): void {

  for (const element of elements) {
    const tag = element.tagName.toLowerCase();

    if (BLOCKED_TAGS.has(tag) || (!allowStyle && tag === 'style')) {
      element.remove();
      continue;
    }

    if (!allowedTags.has(tag)) {
      const parent = element.parentNode;
      if (parent) {
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        parent.removeChild(element);
      }
      continue;
    }

    if (tag === 'style') {
      sanitizeStyleElement(element);
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith('on') || name === 'formaction' || name === 'action' || name === 'xlink:href') {
        element.removeAttribute(attr.name);
        continue;
      }

      if (name === 'href') {
        const safe = sanitizeUrl(value, 'href');
        if (safe) element.setAttribute('href', safe);
        else element.removeAttribute(attr.name);
        continue;
      }

      if (name === 'src' || name === 'background') {
        const safe = sanitizeUrl(value, 'src');
        if (safe) element.setAttribute(name, safe);
        else element.removeAttribute(attr.name);
        continue;
      }

      if (name === 'style') {
        const safe = sanitizeStyleAttribute(value);
        if (safe) element.setAttribute('style', safe);
        else element.removeAttribute(attr.name);
        continue;
      }

      if (tag === 'meta') {
        const httpEquiv = (element.getAttribute('http-equiv') || '').toLowerCase();
        const metaName = (element.getAttribute('name') || '').toLowerCase();
        const allowedNames = new Set(['viewport', 'format-detection', 'color-scheme', 'supported-color-schemes']);
        const allowed =
          name === 'charset' ||
          (name === 'name' && allowedNames.has(metaName)) ||
          (name === 'http-equiv' && httpEquiv === 'x-ua-compatible') ||
          (name === 'content' && (allowedNames.has(metaName) || httpEquiv === 'x-ua-compatible'));
        if (!allowed) element.removeAttribute(attr.name);
        continue;
      }

      if (name === 'target' && tag === 'a' && value !== '_blank' && value !== '_self') {
        element.setAttribute('target', '_blank');
      }
    }

    if (tag === 'a' && element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

function sanitizeDocument(root: Document, allowedTags: Set<string>, allowStyle: boolean): void {
  sanitizeElements(Array.from(root.querySelectorAll('*')), allowedTags, allowStyle);
}

/** Sanitizes rich-text fragments while preserving formatting tags and inline styles. */
export function sanitizeRichText(html: unknown): string {
  const source = String(html ?? '');
  if (!source) return '';

  if (typeof DOMParser === 'undefined') {
    return escapeHtml(source);
  }

  const doc = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return escapeHtml(source);

  sanitizeElements(Array.from(container.querySelectorAll('*')), ALLOWED_RICH_TEXT_TAGS, false);
  return container.innerHTML;
}

/** Sanitizes full HTML intended for preview/import, including safe <style> blocks. */
export function sanitizeEmailHtml(html: unknown): string {
  const source = String(html ?? '');
  if (!source) return '';

  if (typeof DOMParser === 'undefined') {
    return escapeHtml(source);
  }

  const doc = new DOMParser().parseFromString(source, 'text/html');
  sanitizeDocument(doc, ALLOWED_EMAIL_TAGS, true);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

const ALLOWED_IMPORT_TAGS = new Set([
  ...ALLOWED_EMAIL_TAGS,
  'font', 'center', 'header', 'footer', 'section', 'article', 'main', 'nav', 'aside',
  'figure', 'figcaption', 'caption', 'mark', 'del', 'ins', 'label', 'address', 'pre', 'code',
]);

/**
 * Sanitizes third-party HTML before block conversion. Same safety rules as
 * sanitizeEmailHtml, but keeps presentational tags (font, header, footer…) the
 * parser relies on and keeps <button> text as a marked span.
 */
export function sanitizeImportHtml(html: unknown): string {
  const source = String(html ?? '');
  if (!source) return '';
  if (typeof DOMParser === 'undefined') return escapeHtml(source);

  const doc = new DOMParser().parseFromString(source, 'text/html');
  doc.querySelectorAll('button').forEach((button) => {
    const span = doc.createElement('span');
    const style = button.getAttribute('style');
    const className = button.getAttribute('class');
    if (style) span.setAttribute('style', style);
    if (className) span.setAttribute('class', className);
    span.setAttribute('data-r9-button', '1');
    while (button.firstChild) span.appendChild(button.firstChild);
    button.replaceWith(span);
  });
  sanitizeDocument(doc, ALLOWED_IMPORT_TAGS, true);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/** Returns true when a URL is suitable for an e-mail link. */
export function isSafeEmailUrl(value: unknown): boolean {
  return Boolean(sanitizeUrl(value, 'href'));
}
