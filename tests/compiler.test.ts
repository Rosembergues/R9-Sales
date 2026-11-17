import { describe, expect, it } from 'vitest';
import { compileBlocksToHtml, compileEmailToHtml, generateSingleBlockHtml } from '../src/utils/compiler';
import { EmailBlock } from '../src/types';

describe('email compiler security and regression contracts', () => {
  it('escapes/sanitizes user-controlled block content and URLs', () => {
    const block: EmailBlock = {
      id: 'test-1',
      type: 'button',
      buttonLabel: `<strong>Oferta</strong><script>alert(1)</script>`,
      buttonUrl: 'javascript:alert(1)',
      buttonBgColor: '#2563eb',
    };

    const html = generateSingleBlockHtml(block);

    expect(html).toContain('<strong>Oferta</strong>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('preserves the email style block in compiled output', () => {
    const html = compileBlocksToHtml([
      { id: '1', type: 'title', text: 'Teste' },
      { id: '2', type: 'text', text: 'Olá {{nome}}' },
    ]);

    expect(html).toContain('<style>');
    expect(html).toContain('@media (max-width: 620px)');
    expect(html).toContain('{{nome}}');
  });

  it('sanitizes custom HTML before returning it from the universal compiler', () => {
    const html = compileEmailToHtml({
      headerTitle: 'Teste',
      greeting: 'Olá',
      buttonText: 'Abrir',
      buttonUrl: 'https://example.com',
      bodyText: 'Conteúdo',
      footerText: 'Rodapé',
      primaryColor: '#2563eb',
      activeTemplateId: 'test',
      customCodeHtml: `<style>.card{color:red}</style><script>alert(1)</script><p>Olá</p>`,
    });

    expect(html).toContain('<style>');
    expect(html).toContain('<p>Olá</p>');
    expect(html).not.toContain('<script');
  });
});
