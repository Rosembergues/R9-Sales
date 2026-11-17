import { describe, expect, it } from 'vitest';
import { getBlockPropertyDefinitions, sanitizeBlockPropertyUpdate } from '../src/data/blockProperties';

describe('block property system', () => {
  it('exposes content and typography properties by block type', () => {
    const defs = getBlockPropertyDefinitions('text');
    expect(defs.some((d) => d.key === 'text' && d.section === 'content')).toBe(true);
    expect(defs.some((d) => d.key === 'fontSizePx' && d.section === 'typography')).toBe(true);
    expect(defs.some((d) => d.key === 'alignment')).toBe(true);
  });

  it('sanitizes URLs, colors and numeric ranges before state mutation', () => {
    const safe = sanitizeBlockPropertyUpdate({
      buttonUrl: 'javascript:alert(1)',
      textColor: 'red; color:expression(alert(1))',
      fontSizePx: 999,
      lineHeight: 9,
      text: 'Olá {{nome}}',
    });

    expect(safe.buttonUrl).toBeUndefined();
    expect(safe.textColor).toBeUndefined();
    expect(safe.fontSizePx).toBe(72);
    expect(safe.lineHeight).toBe('3');
    expect(safe.text).toBe('Olá {{nome}}');
  });
});
