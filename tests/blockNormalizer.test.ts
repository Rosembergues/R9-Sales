import { describe, expect, it } from 'vitest';
import { normalizeBlock, normalizeBlocks } from '../src/utils/blockNormalizer';
import { compileBlocksToHtml, generateSingleBlockHtml } from '../src/utils/compiler';
import { compileBlocksForEmail } from '../src/utils/emailCompiler';
import type { EmailBlock } from '../src/types';

const injection = 'left" onmouseover="alert(document.domain)';

describe('block normalization (stored XSS hardening)', () => {
  it('drops attribute-breaking values from untrusted blocks', () => {
    const block = normalizeBlock({
      id: 'a',
      type: 'title',
      text: 'Oi',
      alignment: injection,
      fontSizePx: '20px" onload="x',
      textColor: 'red" onclick="x',
      fontFamily: 'x" onmouseover="alert(1)',
      lineHeight: '1.5;" onclick="x',
      unknownKey: 'value',
    });
    expect(block).toEqual({ id: 'a', type: 'title', text: 'Oi' });
  });

  it('keeps valid values and clamps numbers', () => {
    expect(normalizeBlock({ id: 'b', type: 'text', fontSizePx: 500, imageWidthPx: 10, textColor: '#abc', fontFamily: '"Segoe UI", Arial', lineHeight: 9, alignment: 'center' }))
      .toEqual({ id: 'b', type: 'text', fontSizePx: 72, imageWidthPx: 80, textColor: '#abc', fontFamily: "'Segoe UI', Arial", lineHeight: '3', alignment: 'center' });
  });

  it('removes unknown block types and de-duplicates ids', () => {
    const blocks = normalizeBlocks([{ id: 'x', type: 'text' }, { id: 'x', type: 'title' }, { id: 'y', type: 'iframe' }, null, 'junk']);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBe('x');
    expect(blocks[1].id).not.toBe('x');
  });

  it('never emits event handler attributes from malicious block data', () => {
    const malicious = [
      { id: 'a', type: 'title', text: 'Oi', alignment: injection },
      { id: 'b', type: 'text', text: 'Oi', fontFamily: 'x" onmouseover="alert(1)', textColor: 'red" onclick="alert(1)' },
      { id: 'c', type: 'button', buttonLabel: 'Oi', alignment: injection, buttonBgColor: '#000" onclick="alert(1)' },
      { id: 'd" onclick="alert(1)', type: 'divider' },
    ] as unknown as EmailBlock[];

    const outputs = [
      compileBlocksToHtml(malicious),
      compileBlocksForEmail(malicious),
      ...malicious.map((block) => generateSingleBlockHtml(block)),
    ];
    for (const html of outputs) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const handlers = Array.from(doc.querySelectorAll('*')).flatMap((el) =>
        Array.from(el.attributes).filter((attr) => attr.name.toLowerCase().startsWith('on')).map((attr) => attr.name));
      expect(handlers).toEqual([]);
    }
  });
});
