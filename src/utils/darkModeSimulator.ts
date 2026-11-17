import { lightnessOf, parseCssColor, rgbToHex, withLightness } from './color';

/*
 * Approximates the "partial inversion" that Gmail (apps) and Outlook.com apply
 * in dark mode: light backgrounds become dark, dark text becomes light, and
 * colors that are already dark/light enough are kept. Images are left as they
 * are, which is exactly what exposes logos with transparent backgrounds or text
 * baked into images. It is a simulation for review, not a pixel-perfect copy of
 * any single client.
 */

const DARK_PAGE = '#121212';

function darkenBackground(value: string): string | null {
  const color = parseCssColor(value);
  if (!color) return null;
  const l = lightnessOf(color);
  // Only light backgrounds (white, light grays, pastels) are inverted; brand colors such
  // as a purple button or a blue banner are kept by Gmail/Outlook.com.
  if (l <= 0.7) return null;
  return rgbToHex(withLightness(color, Math.max(0.07, (1 - l) * 0.6)));
}

function lightenText(value: string): string | null {
  const color = parseCssColor(value);
  if (!color) return null;
  const l = lightnessOf(color);
  if (l > 0.55) return null; // already light
  return rgbToHex(withLightness(color, Math.min(0.92, Math.max(0.78, 1 - l))));
}

function transformStyle(style: string): string {
  return style
    .split(';')
    .map((declaration) => {
      const index = declaration.indexOf(':');
      if (index <= 0) return declaration;
      const property = declaration.slice(0, index).trim().toLowerCase();
      const raw = declaration.slice(index + 1);
      const important = /!important/i.test(raw) ? ' !important' : '';
      const value = raw.replace(/!important/i, '').trim();
      if (property === 'background-color' || property === 'background') {
        const next = darkenBackground(value);
        return next ? `${property}:${next}${important}` : declaration;
      }
      if (property === 'color') {
        const next = lightenText(value);
        return next ? `color:${next}${important}` : declaration;
      }
      if (property === 'border-top' || property === 'border' || property === 'border-color') {
        return declaration.replace(/#[0-9a-f]{3,8}\b/gi, (hex) => {
          const color = parseCssColor(hex);
          return color && lightnessOf(color) > 0.7 ? rgbToHex(withLightness(color, 0.3)) : hex;
        });
      }
      return declaration;
    })
    .join(';');
}

/** Returns a copy of the e-mail HTML recolored the way dark-mode clients typically do. */
export function simulateDarkMode(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    el.setAttribute('style', transformStyle(el.getAttribute('style') || ''));
  });
  doc.querySelectorAll('[bgcolor]').forEach((el) => {
    const next = darkenBackground(el.getAttribute('bgcolor') || '');
    if (next) el.setAttribute('bgcolor', next);
  });

  const override = doc.createElement('style');
  override.textContent = `html, body { background-color: ${DARK_PAGE} !important; color: #e5e7eb; }`;
  doc.head.appendChild(override);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}
