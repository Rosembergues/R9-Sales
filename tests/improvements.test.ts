import { describe, expect, it } from 'vitest';
import type { EmailBlock, EmailData } from '../src/types';
import { compileBlocksForEmail } from '../src/utils/emailCompiler';
import { generateSingleBlockHtml } from '../src/utils/compiler';
import { extractEmailMeta, parseHtmlToBlocks } from '../src/utils/htmlParser';
import { runEmailChecklist } from '../src/utils/emailChecklist';
import { compilePlainText, richTextToPlainText } from '../src/utils/plainTextCompiler';
import { simulateDarkMode } from '../src/utils/darkModeSimulator';
import { applyBrandKitToBlocks, createDefaultBlock, DEFAULT_BRAND_KIT, normalizeBrandKit } from '../src/utils/brandKit';
import { normalizeBlock } from '../src/utils/blockNormalizer';
import { sanitizeBlockPropertyUpdate } from '../src/data/blockProperties';
import { analyzeHtmlConversion } from '../src/utils/htmlImportAnalysis';

const data = (extra: Partial<EmailData> = {}): EmailData => ({
  headerTitle: 'Teste', greeting: '', buttonText: '', buttonUrl: '', bodyText: '', primaryColor: '#000000', activeTemplateId: '',
  subject: 'Matrícula aberta', preheader: 'Só até sexta', ...extra,
});

const columnsBlock: EmailBlock = {
  id: 'cols-1',
  type: 'columns',
  columns: [
    { imageUrl: 'https://cdn.exemplo.net/a.jpg', imageAlt: 'Curso A', imageLink: 'https://site.com.br/a', text: '<b>Curso A</b><br/>Online', buttonLabel: 'Ver curso', buttonUrl: 'https://site.com.br/a' },
    { imageUrl: 'https://cdn.exemplo.net/b.jpg', imageAlt: 'Curso B', text: '<b>Curso B</b>', buttonLabel: 'Ver curso', buttonUrl: 'https://site.com.br/b' },
  ],
  textColor: '#334155',
  buttonBgColor: '#0055aa',
  buttonTextColor: '#ffffff',
  fontSizePx: 14,
  alignment: 'center',
};

describe('columns block', () => {
  it('normalizes to 2–3 cells and drops unknown keys', () => {
    const block = normalizeBlock({ id: 'c', type: 'columns', columns: [{ text: 'a', onclick: 'x' }] });
    expect(block?.columns).toHaveLength(2);
    expect(block?.columns?.[0]).toEqual({ text: 'a' });
    const many = normalizeBlock({ id: 'c', type: 'columns', columns: [{}, {}, {}, {}, {}] });
    expect(many?.columns).toHaveLength(3);
  });

  it('renders stackable table cells with escaped content', () => {
    const html = generateSingleBlockHtml({
      ...columnsBlock,
      columns: [{ text: '<img src=x onerror=alert(1)>Oi', buttonLabel: 'Ir', buttonUrl: 'javascript:alert(1)' }, { text: 'B' }],
    });
    expect(html).toContain('class="r9-col"');
    expect(html).toContain('width="50%"');
    expect(html).not.toMatch(/onerror|javascript:/i);
    expect(html).toContain('data-inline-edit="columns.0.text"');
  });

  it('survives an export → import round trip', () => {
    const html = compileBlocksForEmail([columnsBlock], data());
    expect(html).toContain('.r9-col');
    const [parsed] = parseHtmlToBlocks(html);
    expect(parsed.type).toBe('columns');
    expect(parsed.id).toBe('cols-1');
    expect(parsed.columns).toHaveLength(2);
    expect(parsed.columns?.[0]).toMatchObject({
      imageUrl: 'https://cdn.exemplo.net/a.jpg',
      imageAlt: 'Curso A',
      imageLink: 'https://site.com.br/a',
      buttonLabel: 'Ver curso',
      buttonUrl: 'https://site.com.br/a',
    });
    expect(parsed.columns?.[0].text).toContain('Curso A');
    expect(parsed.buttonBgColor).toBe('#0055aa');
  });

  it('recognizes a third-party product grid', () => {
    const html = `<table><tr>
      <td width="50%"><a href="https://loja.com/1"><img src="https://loja.com/1.jpg" width="260" alt="Tênis"></a>
        <p style="color:#222222;font-size:14px">Tênis Run <b>R$ 199</b></p>
        <a href="https://loja.com/1" style="background:#e11d48;color:#fff;padding:10px 16px;display:inline-block">Comprar</a></td>
      <td width="50%"><a href="https://loja.com/2"><img src="https://loja.com/2.jpg" width="260" alt="Bolsa"></a>
        <p style="color:#222222;font-size:14px">Bolsa Couro <b>R$ 299</b></p>
        <a href="https://loja.com/2" style="background:#e11d48;color:#fff;padding:10px 16px;display:inline-block">Comprar</a></td>
    </tr></table>`;
    const blocks = parseHtmlToBlocks(html);
    expect(blocks).toHaveLength(1);
    const [cols] = blocks;
    expect(cols.type).toBe('columns');
    expect(cols.columns?.map((c) => c.imageAlt)).toEqual(['Tênis', 'Bolsa']);
    expect(cols.columns?.[1].text).toContain('Bolsa Couro');
    expect(cols.columns?.[1].text).not.toContain('Comprar');
    expect(cols.columns?.[1].buttonUrl).toBe('https://loja.com/2');
    expect(cols.buttonBgColor).toBe('#e11d48');
    expect(cols.textColor).toBe('#222222');

    const analysis = analyzeHtmlConversion(html);
    expect(analysis.retainedImageCount).toBe(2);
    expect(analysis.textCoveragePercent).toBe(100);
  });

  it('leaves logo + text header rows and data tables alone', () => {
    const header = parseHtmlToBlocks('<table><tr><td><img src="https://x.com/logo.png" width="150"></td><td><a href="https://x.com/web">Ver no navegador</a></td></tr></table>');
    expect(header.some((b) => b.type === 'columns')).toBe(false);
    const dataTable = parseHtmlToBlocks('<table><tr><td>Curso</td><td>Valor</td></tr><tr><td>ADS</td><td>R$ 99</td></tr></table>');
    expect(dataTable.some((b) => b.type === 'columns')).toBe(false);
  });

  it('sanitizes column URLs in property updates', () => {
    const update = sanitizeBlockPropertyUpdate({ columns: [{ buttonUrl: 'javascript:alert(1)', imageUrl: 'https://ok.com/a.png' }, {}] });
    expect(update.columns?.[0].buttonUrl).toBe('');
    expect(update.columns?.[0].imageUrl).toBe('https://ok.com/a.png');
  });
});

describe('preheader, title and Outlook buttons', () => {
  it('exports a hidden preheader and the subject as <title>', () => {
    const html = compileBlocksForEmail([{ id: 't', type: 'text', text: 'Corpo' }], data({ preheader: 'Garanta sua vaga <hoje>' }));
    expect(html).toContain('<title>Matrícula aberta</title>');
    expect(html).toMatch(/display:\s*none[^>]*>Garanta sua vaga &lt;hoje&gt;/);
    expect(html).toContain('name="color-scheme"');
  });

  it('reads the preheader and title back on import', () => {
    const html = compileBlocksForEmail([{ id: 't', type: 'text', text: 'Corpo visível' }], data({ preheader: 'Prévia na caixa de entrada' }));
    expect(extractEmailMeta(html)).toEqual({ preheader: 'Prévia na caixa de entrada', subject: 'Matrícula aberta' });
    const blocks = parseHtmlToBlocks(html);
    expect(JSON.stringify(blocks)).not.toContain('Prévia na caixa');
  });

  it('ignores hidden elements that come after visible content', () => {
    expect(extractEmailMeta('<body><p style="color:red">Olá</p><div style="display:none">tarde</div></body>').preheader).toBeUndefined();
  });

  it('emits a VML roundrect for Outlook with escaped, plain-text label', () => {
    const html = compileBlocksForEmail([{ id: 'b', type: 'button', buttonLabel: '<b>Quero</b> --> agora', buttonUrl: 'https://site.com/?a=1&b=2', buttonBgColor: '#e11d48' }], data());
    expect(html).toContain('v:roundrect');
    expect(html).toContain('fillcolor="#e11d48"');
    expect(html).toContain('<!--[if !mso]><!-->');
    const vml = html.slice(html.indexOf('<v:roundrect'), html.indexOf('</v:roundrect>'));
    expect(vml).not.toContain('<b>');
    expect(vml).toContain('Quero --&gt; agora');
    // The non-Outlook link is still a real anchor.
    expect(html).toMatch(/<a href="https:\/\/site\.com\/\?a=1&amp;b=2"/);
  });

  it('round-trips buttons exported with VML', () => {
    const html = compileBlocksForEmail([{ id: 'b1', type: 'button', buttonLabel: 'Inscreva-se', buttonUrl: 'https://site.com' }], data());
    const blocks = parseHtmlToBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'button', buttonLabel: 'Inscreva-se', buttonUrl: 'https://site.com' });
  });
});

describe('export checklist', () => {
  const titles = (blocks: EmailBlock[], d = data(), html = '<html></html>') => runEmailChecklist(blocks, d, html).map((i) => i.title);

  it('flags placeholder and missing links, unhosted images and unknown variables', () => {
    const issues = runEmailChecklist([
      { id: 'b1', type: 'button', buttonLabel: 'Ir', buttonUrl: 'https://exemplo.com/x' },
      { id: 'b2', type: 'button', buttonLabel: 'Ir', buttonUrl: '' },
      { id: 'i1', type: 'image', imageUrl: 'data:image/png;base64,AAAA', imageAlt: 'Foto' },
      { id: 't1', type: 'text', text: 'Olá {{empresa}}, veja <a href="#">aqui</a>' },
      { id: 'f', type: 'footer', footerText: 'Rodapé' },
    ], data(), '<html></html>');
    const byBlock = (id: string) => issues.filter((i) => i.blockId === id).map((i) => i.title);
    expect(byBlock('b1')).toContain('Botão com link de exemplo');
    expect(byBlock('b2')).toContain('Botão sem link');
    expect(byBlock('i1')).toContain('Imagem não está hospedada');
    expect(byBlock('t1').some((t) => t.includes('{{empresa}}'))).toBe(true);
    expect(byBlock('t1').some((t) => t.includes('link no texto'))).toBe(true);
    expect(issues[0].severity).toBe('error');
  });

  it('flags missing subject/preheader, low contrast, missing footer and Gmail clipping', () => {
    const list = titles(
      [{ id: 'x', type: 'text', text: 'Cinza no branco', textColor: '#dddddd' }],
      data({ subject: '', preheader: '' }),
      `<html>${'x'.repeat(110 * 1024)}</html>`,
    );
    expect(list).toContain('O e-mail está sem assunto');
    expect(list).toContain('Sem texto de pré-visualização (preheader)');
    expect(list).toContain('Texto: texto difícil de ler');
    expect(list).toContain('E-mail sem rodapé');
    expect(list).toContain('O Gmail vai cortar este e-mail');
  });

  it('is quiet for a well-formed e-mail', () => {
    const issues = runEmailChecklist([
      { id: 'h', type: 'header_text', headerTitle: 'Olá', headerBgColor: '#003bb3', headerTextColor: '#ffffff' },
      { id: 't', type: 'text', text: 'Olá {{nome}}, tudo bem?' },
      { id: 'b', type: 'button', buttonLabel: 'Acessar', buttonUrl: 'https://portal.estacio.br' },
      { id: 'i', type: 'image', imageUrl: 'https://cdn.site.com/a.png', imageAlt: 'Alunos no campus' },
      columnsBlock,
      { id: 'f', type: 'footer', footerText: 'Enviado para {{email}}' },
    ], data(), compileBlocksForEmail([], data()));
    expect(issues).toEqual([]);
  });
});

describe('plain text version', () => {
  it('turns blocks into readable text with links', () => {
    const text = compilePlainText([
      { id: 'h', type: 'header_text', headerTitle: 'Matrícula', headerSubtitle: 'Aberta' },
      { id: 't', type: 'text', text: 'Olá {{nome}},<br/>veja <a href="https://site.com/a">o curso</a>.' },
      { id: 'b', type: 'button', buttonLabel: '<b>Inscreva-se</b>', buttonUrl: 'https://site.com/i' },
      { id: 'd', type: 'divider' },
      columnsBlock,
      { id: 'f', type: 'footer', footerText: '© 2026' },
    ]);
    expect(text).toContain('MATRÍCULA\nAberta');
    expect(text).toContain('Olá {{nome}},\nveja o curso (https://site.com/a).');
    expect(text).toContain('Inscreva-se: https://site.com/i');
    expect(text).toContain('Curso A\nOnline\nVer curso: https://site.com.br/a');
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('does not repeat a link whose text is the URL', () => {
    expect(richTextToPlainText('<a href="https://a.com">https://a.com</a>')).toBe('https://a.com');
  });
});

describe('dark mode simulation', () => {
  it('darkens light backgrounds and lightens dark text, keeping dark brand colors', () => {
    const out = simulateDarkMode('<html><body><table bgcolor="#ffffff"><tr><td style="background-color:#ffffff;color:#334155">Oi</td><td style="background-color:#003bb3;color:#ffffff">Banner</td></tr></table></body></html>');
    const doc = new DOMParser().parseFromString(out, 'text/html');
    const [light, brand] = Array.from(doc.querySelectorAll('td'));
    expect(light.getAttribute('style')).not.toContain('#ffffff');
    expect(light.getAttribute('style')).not.toContain('#334155');
    expect(brand.getAttribute('style')).toContain('#003bb3');
    expect(brand.getAttribute('style')).toContain('#ffffff');
    expect(doc.querySelector('table')?.getAttribute('bgcolor')).not.toBe('#ffffff');
  });
});

describe('brand kit', () => {
  it('normalizes untrusted kit data', () => {
    const kit = normalizeBrandKit({ buttonColor: 'red;}<script>', websiteUrl: 'javascript:alert(1)', fontFamily: 'Georgia, serif', logoUrl: 'https://a.com/l.png' });
    expect(kit.buttonColor).toBe(DEFAULT_BRAND_KIT.buttonColor);
    expect(kit.websiteUrl).toBe('');
    expect(kit.fontFamily).toBe('Georgia, serif');
    expect(kit.logoUrl).toBe('https://a.com/l.png');
  });

  it('styles new blocks and recolors existing ones without touching content', () => {
    const kit = { ...DEFAULT_BRAND_KIT, buttonColor: '#ffcc00', headerBgColor: '#111111', websiteUrl: 'https://empresa.com', instagramUrl: 'https://instagram.com/empresa' };
    const button = createDefaultBlock('button', 'n1', kit);
    expect(button.buttonBgColor).toBe('#ffcc00');
    expect(button.buttonTextColor).toBe('#0f172a'); // readable on yellow
    expect(button.buttonUrl).toBe('https://empresa.com');
    expect(createDefaultBlock('social', 'n2', kit).instagramUrl).toBe('https://instagram.com/empresa');

    const [header, btn] = applyBrandKitToBlocks([
      { id: 'h', type: 'header_text', headerTitle: 'Meu título', headerBgColor: '#ffffff' },
      { id: 'b', type: 'button', buttonLabel: 'Comprar', buttonUrl: 'https://loja.com', buttonBgColor: '#000000' },
    ], kit);
    expect(header).toMatchObject({ headerTitle: 'Meu título', headerBgColor: '#111111', headerTextColor: '#ffffff' });
    expect(btn).toMatchObject({ buttonLabel: 'Comprar', buttonUrl: 'https://loja.com', buttonBgColor: '#ffcc00' });
  });

  it('new default blocks do not trigger checklist variable errors', () => {
    const blocks = (['text', 'title', 'footer', 'columns'] as const).map((type, i) => createDefaultBlock(type, `d${i}`));
    const issues = runEmailChecklist(blocks, data(), '<html></html>');
    expect(issues.some((i) => i.title.includes('variável'))).toBe(false);
  });
});
