import { describe, expect, it } from 'vitest';
import { generateSingleBlockHtml } from '../src/utils/compiler';

describe('header_image block', () => {
  it('respects background, width and alignment without forcing image to full width', () => {
    const html = generateSingleBlockHtml({
      id: 'header-1',
      type: 'header_image',
      imageUrl: 'https://example.com/logo.png',
      imageWidthPx: 600,
      alignment: 'center',
      bgColor: '#003bb3',
    });

    expect(html).toContain('background-color: #003bb3;');
    expect(html).toContain('width="600"');
    expect(html).toContain('width: 600px;');
    expect(html).toContain('max-width: 100%');
    expect(html).not.toContain('width: 100% !important');
  });
});
