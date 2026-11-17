import { describe, expect, it } from 'vitest';
import { compileBlocksToHtml } from '../src/utils/compiler';
import { parseHtmlToBlocks } from '../src/utils/htmlParser';
import { EmailBlock } from '../src/types';

describe('HTML parser/compiler round-trip', () => {
  it('recovers the main block types from compiled HTML', () => {
    const source: EmailBlock[] = [
      { id: 'title-1', type: 'title', text: 'Título principal' },
      { id: 'text-1', type: 'text', text: 'Texto de teste {{nome}}' },
      { id: 'button-1', type: 'button', buttonLabel: 'Acessar', buttonUrl: 'https://example.com' },
      { id: 'image-1', type: 'image', imageUrl: 'https://example.com/banner.png', imageAlt: 'Banner' },
    ];

    const html = compileBlocksToHtml(source);
    const parsed = parseHtmlToBlocks(html);
    const types = new Set(parsed.map((block) => block.type));

    expect(parsed.length).toBeGreaterThan(0);
    expect(types.has('title')).toBe(true);
    expect(types.has('text')).toBe(true);
    expect(types.has('button')).toBe(true);
    expect(types.has('image')).toBe(true);
  });

  it('does not turn unsafe imported markup into executable content', () => {
    const html = `<div><script>alert(1)</script><p>Texto seguro</p><a href="javascript:alert(1)">link</a></div>`;
    const parsed = parseHtmlToBlocks(html);

    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.some((block) => String(block.text || '').includes('alert(1)'))).toBe(false);
  });
});
