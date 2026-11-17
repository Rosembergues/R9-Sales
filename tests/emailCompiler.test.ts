import { describe, expect, it } from 'vitest';
import { compileBlocksForEmail, compileTransportHtml } from '../src/utils/emailCompiler';
import { EmailBlock } from '../src/types';

describe('email compiler', () => {
  const blocks: EmailBlock[] = [
    { id: '1', type: 'title', text: 'Olá {{nome}}' },
    { id: '2', type: 'button', buttonLabel: 'Acessar', buttonUrl: 'https://example.com' },
  ];

  it('produces a table-based transport document', () => {
    const html = compileBlocksForEmail(blocks, { headerTitle: 'Teste' } as any);
    expect(html).toContain('<table');
    expect(html).toContain('role="article"');
    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('{{nome}}');
    expect(html).toContain('https://example.com');
  });

  it('does not expose scripts in the final email', () => {
    const html = compileBlocksForEmail([{ id: '1', type: 'text', text: '<script>alert(1)</script>Seguro' }]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Seguro');
  });
});


describe('transport source selection', () => {
  it('uses the block email compiler when the source is blocks, even if preview HTML exists', () => {
    const html = compileTransportHtml({ headerTitle: 'Teste', subject: 'Assunto', contentSource: 'blocks', customCodeHtml: '<div>preview</div>' } as any, [{ id: '1', type: 'button', buttonLabel: 'CTA', buttonUrl: 'https://example.com' }]);
    expect(html).toContain('role="article"');
    expect(html).toContain('CTA');
  });

  it('uses sanitized custom HTML only when the source is html', () => {
    const html = compileTransportHtml({ headerTitle: 'Teste', contentSource: 'html', customCodeHtml: '<script>alert(1)</script><p>Seguro</p>' } as any, []);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Seguro');
  });
});
