import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  isSafeEmailUrl,
  sanitizeCssValue,
  sanitizeEmailHtml,
  sanitizeRichText,
  sanitizeUrl,
} from '../src/utils/security';

describe('security helpers', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
  });

  it('rejects dangerous URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)', 'href')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>', 'src')).toBe('');
    expect(sanitizeUrl('https://example.com/path', 'href')).toBe('https://example.com/path');
    expect(sanitizeUrl('https://example.com/aluno/{{var1}}', 'href')).toBe('https://example.com/aluno/{{var1}}');
    expect(sanitizeUrl('https://example.com/boleto?id={{var1}}', 'href')).toBe('https://example.com/boleto?id={{var1}}');
    expect(sanitizeUrl('{{var1}}', 'href')).toBe('{{var1}}');
    expect(sanitizeUrl('javascript:{{var1}}', 'href')).toBe('');
    expect(isSafeEmailUrl('mailto:test@example.com')).toBe(true);
  });

  it('rejects dangerous CSS declarations', () => {
    expect(sanitizeCssValue('red; color: expression(alert(1))', 'fallback')).toBe('fallback');
    expect(sanitizeCssValue('url(javascript:alert(1))', 'fallback')).toBe('fallback');
    expect(sanitizeCssValue('#2563eb')).toBe('#2563eb');
  });

  it('removes scripts and javascript URLs from rich text while preserving formatting', () => {
    const html = sanitizeRichText(
      `<strong>Olá</strong><script>alert(1)</script><a href="javascript:alert(1)">Clique</a>`
    );

    expect(html).toContain('<strong>Olá</strong>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  it('keeps email style blocks but removes unsafe CSS payloads', () => {
    const html = sanitizeEmailHtml(`
      <html><head><style>
        body { margin: 0; }
        @media (max-width: 600px) { .x { width: 100%; } }
        @import url("https://evil.example/style.css");
        .bad { behavior: url(x); }
      </style></head>
      <body><img src="https://example.com/image.png" onerror="alert(1)"></body></html>
    `);

    expect(html).toContain('<style>');
    expect(html).toContain('@media');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('behavior:');
    expect(html).not.toContain('onerror');
  });
});


describe('security edge cases', () => {
  it('preserves safe meta tags but removes dangerous meta attributes', () => {
    const html = sanitizeEmailHtml('<meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="0;url=https://evil.example"><p>ok</p>');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain('evil.example');
  });

  it('rejects SVG data images while allowing common raster data images', () => {
    expect(sanitizeUrl('data:image/svg+xml;base64,PHN2Zy8+', 'src')).toBe('');
    expect(sanitizeUrl('data:image/png;base64,AAAA', 'src')).toContain('data:image/png');
  });
});
