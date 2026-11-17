import { describe, expect, it } from 'vitest';
import { generateSingleBlockHtml } from '../src/utils/compiler';
import { sanitizeBlockPropertyUpdate } from '../src/data/blockProperties';

describe('inline editing metadata', () => {
  it('marks editable text content in preview HTML', () => {
    const html = generateSingleBlockHtml({ id: 'b1', type: 'text', text: 'Olá' });
    expect(html).toContain('data-inline-edit="text"');
    expect(html).toContain('data-block-id="b1"');
  });

  it('marks button label as editable without exposing the URL as editable text', () => {
    const html = generateSingleBlockHtml({ id: 'b2', type: 'button', buttonLabel: 'Acessar', buttonUrl: 'https://example.com' });
    expect(html).toContain('data-inline-edit="buttonLabel"');
    expect(html).not.toContain('data-inline-edit="buttonUrl"');
  });

  it('synchronizes inline edits through block sanitization without dropping rich formatting', () => {
    const inlineUpdate = {
      headerTitle: 'Estácio <b>Taquara</b><br>Matrículas Abertas',
      buttonLabel: 'Garantir <strong>Bolsa 50%</strong>',
      text: 'Texto atualizado pelo <em>canva</em> com sucesso.',
      footerText: '© 2026 <b>Estácio</b>',
    };

    const sanitized = sanitizeBlockPropertyUpdate(inlineUpdate);
    expect(sanitized.headerTitle).toBe(inlineUpdate.headerTitle);
    expect(sanitized.buttonLabel).toBe(inlineUpdate.buttonLabel);
    expect(sanitized.text).toBe(inlineUpdate.text);
    expect(sanitized.footerText).toBe(inlineUpdate.footerText);

    // Ensure compiler renders the updated HTML into the compiled block
    const compiledHeader = generateSingleBlockHtml({ id: 'h1', type: 'header', ...sanitized });
    expect(compiledHeader).toContain('Estácio <b>Taquara</b>');
    expect(compiledHeader).toContain('data-inline-edit="headerTitle"');

    const compiledBtn = generateSingleBlockHtml({ id: 'btn1', type: 'button', ...sanitized, buttonUrl: 'https://estacio.br' });
    expect(compiledBtn).toContain('Garantir <strong>Bolsa 50%</strong>');
    expect(compiledBtn).toContain('data-inline-edit="buttonLabel"');
  });
});
