import { describe, expect, it } from 'vitest';
import { parseHtmlToBlocks } from '../src/utils/htmlParser';
import { compileBlocksToHtml } from '../src/utils/compiler';
import { compileBlocksForEmail } from '../src/utils/emailCompiler';
import { analyzeHtmlConversion } from '../src/utils/htmlImportAnalysis';
import type { EmailBlock } from '../src/types';

const strip = (blocks: EmailBlock[]) => blocks.map(({ id: _id, ...rest }) => rest);
const allText = (blocks: EmailBlock[]) =>
  blocks.map((b) => [b.text, b.headerTitle, b.headerSubtitle, b.footerText, b.buttonLabel, b.couponCode, b.couponDiscount].filter(Boolean).join(' ')).join(' ');

describe('HTML importer: content preservation', () => {
  it('reads every sibling table, not only the first one', () => {
    const blocks = parseHtmlToBlocks('<table><tr><td><p>Primeira tabela</p></td></tr></table><table><tr><td><p>Segunda tabela</p></td></tr></table>');
    expect(blocks.map((b) => b.text)).toEqual(['Primeira tabela', 'Segunda tabela']);
  });

  it('keeps loose text that sits next to a button in the same cell', () => {
    const blocks = parseHtmlToBlocks('<table><tr><td>Olá Fulano,<br><br>Texto solto importante.<br><a href="https://a.com" class="btn" style="background:#f00;padding:10px">Comprar</a></td></tr></table>');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].text).toBe('Olá Fulano,<br/><br/>Texto solto importante.');
    expect(blocks[1]).toMatchObject({ type: 'button', buttonLabel: 'Comprar', buttonUrl: 'https://a.com', buttonBgColor: '#ff0000' });
  });

  it('does not collapse a container into a social block because of one social link', () => {
    const blocks = parseHtmlToBlocks('<div><p>Texto importante do corpo do e-mail.</p><a href="https://site.com">Saiba mais</a> <a href="https://instagram.com/x">IG</a></div>');
    expect(allText(blocks)).toContain('Texto importante do corpo do e-mail.');
    expect(blocks.some((b) => b.type === 'social')).toBe(false);
  });

  it('does not collapse a short e-mail into a footer because it contains ©', () => {
    const blocks = parseHtmlToBlocks('<div><p>Oi</p><p>Corpo curto</p><p>© 2026 Empresa</p></div>');
    expect(blocks.map((b) => b.type)).toEqual(['text', 'text', 'footer']);
    expect(blocks[2].footerText).toBe('© 2026 Empresa');
  });

  it('keeps <button> text, <font> colors and <header> structure that the old sanitizer dropped', () => {
    const blocks = parseHtmlToBlocks('<header><img src="https://cdn.site.com/logo.png" width="200"></header><p>Texto <font color="#00aa00">verde</font></p><button style="background:#111">Enviar</button>');
    expect(blocks[0]).toMatchObject({ type: 'header_image', imageUrl: 'https://cdn.site.com/logo.png', imageWidthPx: 200 });
    expect(blocks[1].text).toBe('Texto <span style="color: #00aa00;">verde</span>');
    expect(blocks[2]).toMatchObject({ type: 'button', buttonLabel: 'Enviar', buttonBgColor: '#111111', buttonTextColor: '#ffffff' });
  });

  it('accepts protocol-relative image URLs', () => {
    const blocks = parseHtmlToBlocks('<div><img src="//cdn.site.com/a.png"></div>');
    expect(blocks[0]).toMatchObject({ type: 'image', imageUrl: 'https://cdn.site.com/a.png' });
  });
});

describe('HTML importer: formatting fidelity', () => {
  it('keeps the span color as text color only (no same-color highlight)', () => {
    const [block] = parseHtmlToBlocks('<p>Texto com <span style="color:#ff0000">vermelho</span> no meio</p>');
    expect(block.text).toBe('Texto com <span style="color: #ff0000;">vermelho</span> no meio');
    expect(block.textColor).toBeUndefined();
  });

  it('lifts a wrapper that covers the whole paragraph into block properties', () => {
    const [block] = parseHtmlToBlocks('<p><span style="color:#ffffff;font-size:20px"><b>Tudo em negrito</b></span></p>');
    expect(block).toMatchObject({ text: 'Tudo em negrito', textColor: '#ffffff', fontSizePx: 20, isBold: true });
  });

  it('collapses source-code indentation instead of turning it into line breaks', () => {
    const [block] = parseHtmlToBlocks('<p>\n      Linha de código\n      indentada com <b>negrito</b>\n    </p>');
    expect(block.text).toBe('Linha de código indentada com <b>negrito</b>');
  });

  it('resolves heading defaults, units and inherited font sizes', () => {
    const blocks = parseHtmlToBlocks(`
      <div><h1>Título</h1></div>
      <div style="font-size:14px"><p style="font-size:150%">Maior</p><p style="font-size:1.2em">Em</p><p style="font-size:12pt">Pontos</p></div>
      <td style="font-size:13px"><p>Herdado</p></td>`);
    expect(blocks[0]).toMatchObject({ type: 'title', fontSizePx: 32, isBold: true });
    expect(blocks.find((b) => b.text === 'Maior')?.fontSizePx).toBe(21);
    expect(blocks.find((b) => b.text === 'Em')?.fontSizePx).toBe(17);
    expect(blocks.find((b) => b.text === 'Pontos')?.fontSizePx).toBe(16);
  });

  it('applies simple <style> rules (tag and class selectors)', () => {
    const [block] = parseHtmlToBlocks('<style>.lead { color: #123456; font-size: 18px; font-weight: bold } @media (max-width:600px) { .lead { color: red } }</style><p class="lead">Destaque</p>');
    expect(block).toMatchObject({ type: 'subtitle', textColor: '#123456', fontSizePx: 18, isBold: true });
  });

  it('keeps quoted font names valid', () => {
    const [block] = parseHtmlToBlocks(`<p style='font-family: "Segoe UI", Arial'>Fonte</p>`);
    expect(block.fontFamily).toBe("'Segoe UI', Arial");
    expect(compileBlocksToHtml([block])).toContain("font-family: 'Segoe UI', Arial;");
  });

  it('does not apply the page background color to every block', () => {
    const blocks = parseHtmlToBlocks('<table width="100%" bgcolor="#f4f4f4"><tr><td><table bgcolor="#ffffff"><tr><td><h1>Oferta</h1><p>Parágrafo</p></td></tr></table></td></tr></table>');
    expect(blocks.every((b) => b.bgColor === undefined)).toBe(true);
  });

  it('keeps button text readable and fixes low-contrast colors', () => {
    const blocks = parseHtmlToBlocks(`
      <a href="https://a.com" style="background:rgb(255,153,0);color:#ffffff;padding:10px;display:inline-block">Laranja</a>
      <a href="https://b.com" style="background:yellow;color:yellow;padding:10px;display:inline-block">Amarelo</a>`);
    expect(blocks[0]).toMatchObject({ buttonBgColor: '#ff9900', buttonTextColor: '#ffffff' });
    expect(blocks[1]).toMatchObject({ buttonBgColor: '#ffff00', buttonTextColor: '#0f172a' });
  });

  it('turns lists into a single bulleted text block', () => {
    const [block] = parseHtmlToBlocks('<ul><li>Um</li><li><b>Dois</b></li></ul><ol start="3"><li>Três</li></ol>');
    expect(block.text).toBe('• Um<br/>• <b>Dois</b>');
  });
});

describe('HTML importer: noise removal', () => {
  it('ignores spacer cells, hidden preheaders and tracking pixels', () => {
    const blocks = parseHtmlToBlocks(`
      <div style="display:none;max-height:0;overflow:hidden">Texto oculto de preheader</div>
      <table><tr><td height="20">&nbsp;</td></tr><tr><td><p>Conteúdo</p></td></tr></table>
      <img src="https://t.co/p.gif" width="1" height="1">`);
    expect(strip(blocks)).toEqual([expect.objectContaining({ type: 'text', text: 'Conteúdo' })]);
  });

  it('turns a thin colored spacer row into a divider', () => {
    const blocks = parseHtmlToBlocks('<table><tr><td><p>A</p></td></tr><tr><td height="1" bgcolor="#dddddd" style="line-height:1px;font-size:1px">&nbsp;</td></tr><tr><td><p>B</p></td></tr></table>');
    expect(blocks.map((b) => b.type)).toEqual(['text', 'divider', 'text']);
    expect(blocks[1].dividerColor).toBe('#dddddd');
  });
});

describe('HTML importer: block detection', () => {
  it('detects bulletproof table buttons', () => {
    const blocks = parseHtmlToBlocks(`
      <table align="center"><tr><td align="center" bgcolor="#e11d48" style="border-radius:6px">
        <a href="https://loja.com" style="color:#ffffff;font-size:18px;font-weight:bold;display:inline-block;padding:12px 24px">Ver ofertas</a>
      </td></tr></table>`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'button', buttonLabel: 'Ver ofertas', buttonUrl: 'https://loja.com', buttonBgColor: '#e11d48', buttonTextColor: '#ffffff', fontSizePx: 18, alignment: 'center' });
  });

  it('detects icon-only social rows including WhatsApp', () => {
    const blocks = parseHtmlToBlocks(`
      <p>Siga a gente</p>
      <table><tr><td align="center">
        <a href="https://instagram.com/r9"><img src="https://cdn.x/ig.png" width="24" height="24" alt="Instagram"></a>
        <a href="https://wa.me/5511999999999"><img src="https://cdn.x/wa.png" width="24" height="24" alt="WhatsApp"></a>
        <a href="https://linkedin.com/company/r9"><img src="https://cdn.x/in.png" width="24" height="24" alt="LinkedIn"></a>
      </td></tr></table>`);
    expect(blocks[0].text).toBe('Siga a gente');
    expect(blocks[1]).toMatchObject({
      type: 'social',
      instagramUrl: 'https://instagram.com/r9',
      whatsappUrl: 'https://wa.me/5511999999999',
      linkedinUrl: 'https://linkedin.com/company/r9',
    });
  });

  it('detects a colored hero banner with title and subtitle', () => {
    const [block] = parseHtmlToBlocks('<table><tr><td bgcolor="#003bb3" align="center"><h1 style="color:#ffffff">Matrículas abertas</h1><p style="color:#dbeafe">Garanta sua vaga</p></td></tr></table><p>Corpo do e-mail com mais conteúdo para não virar wrapper.</p><p>Mais um parágrafo de conteúdo longo o suficiente.</p>');
    expect(block).toMatchObject({ type: 'header_text', headerTitle: 'Matrículas abertas', headerSubtitle: 'Garanta sua vaga', headerBgColor: '#003bb3', headerTextColor: '#ffffff', alignment: 'center' });
  });

  it('detects coupons by dashed border', () => {
    const blocks = parseHtmlToBlocks('<div style="border:2px dashed #16a34a;background:#f0fdf4"><p>20% OFF na primeira compra</p><p>Cupom: BEMVINDO20</p></div>');
    expect(blocks[0]).toMatchObject({ type: 'coupon', couponCode: 'BEMVINDO20', couponDiscount: '20% OFF na primeira compra', couponBorderColor: '#16a34a', couponBgColor: '#f0fdf4' });
  });

  it('merges footer fragments and small print into one footer', () => {
    const blocks = parseHtmlToBlocks('<p>Corpo</p><p style="font-size:12px">© 2026 Empresa. Todos os direitos reservados.</p><p style="font-size:11px">Rua Exemplo, 123 - São Paulo</p><p style="font-size:11px"><a href="https://x.com/unsub">Descadastrar</a></p>');
    expect(blocks.map((b) => b.type)).toEqual(['text', 'footer']);
    expect(blocks[1].footerText).toContain('Rua Exemplo, 123');
    expect(blocks[1].footerText).toContain('href="https://x.com/unsub"');
  });
});

describe('HTML importer: realistic marketing e-mail', () => {
  const email = `<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; }
      .preheader { display: none !important; }
    </style></head>
    <body style="margin:0;background:#eeeeee">
      <span class="preheader">Ofertas da semana dentro!</span>
      <table width="100%" bgcolor="#eeeeee" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table width="600" bgcolor="#ffffff" cellpadding="0" cellspacing="0">
          <tr><td class="header" align="center" style="padding:20px"><a href="https://loja.com"><img src="https://loja.com/logo.png" width="160" alt="Loja"></a></td></tr>
          <tr><td><img src="https://loja.com/banner.jpg" width="600" alt="Promoção"></td></tr>
          <tr><td style="padding:24px;font-size:15px;color:#333333;line-height:22px">
            <h2 style="color:#111111;margin:0">Olá {{nome}},</h2>
            <p>Separamos <strong>ofertas especiais</strong> para você. Confira <a href="https://loja.com/ofertas" style="color:#e11d48">aqui</a>.</p>
          </td></tr>
          <tr><td align="center" style="padding:0 24px 24px">
            <table><tr><td bgcolor="#e11d48" style="border-radius:4px;padding:12px 28px"><a href="https://loja.com/comprar" style="color:#ffffff;text-decoration:none;font-weight:bold">Comprar agora</a></td></tr></table>
          </td></tr>
          <tr><td height="24" style="font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td align="center" style="padding:16px">
            <a href="https://facebook.com/loja"><img src="https://loja.com/fb.png" width="32" height="32" alt="Facebook"></a>
            <a href="https://instagram.com/loja"><img src="https://loja.com/ig.png" width="32" height="32" alt="Instagram"></a>
          </td></tr>
          <tr><td align="center" style="padding:16px;font-size:11px;color:#999999">© 2026 Loja Exemplo. <a href="https://loja.com/sair" style="color:#999999">Descadastrar</a></td></tr>
        </table>
      </td></tr></table>
      <img src="https://track.loja.com/open.gif" width="1" height="1" alt="">
    </body></html>`;

  it('produces the expected block sequence', () => {
    const blocks = parseHtmlToBlocks(email);
    expect(blocks.map((b) => b.type)).toEqual(['header_image', 'image', 'title', 'text', 'button', 'social', 'footer']);
    expect(blocks[0]).toMatchObject({ imageUrl: 'https://loja.com/logo.png', imageLink: 'https://loja.com', imageWidthPx: 160 });
    expect(blocks[2]).toMatchObject({ text: 'Olá {{nome}},', textColor: '#111111', fontFamily: 'Arial, sans-serif' });
    expect(blocks[3]).toMatchObject({ textColor: '#333333', fontSizePx: 15, lineHeight: '1.47' });
    expect(blocks[3].text).toBe('Separamos <b>ofertas especiais</b> para você. Confira <a href="https://loja.com/ofertas" target="_blank" style="color: #e11d48;">aqui</a>.');
    expect(blocks[4]).toMatchObject({ buttonLabel: 'Comprar agora', buttonBgColor: '#e11d48', buttonTextColor: '#ffffff', alignment: 'center' });
    expect(blocks[5]).toMatchObject({ facebookUrl: 'https://facebook.com/loja', instagramUrl: 'https://instagram.com/loja' });
    expect(blocks[6]).toMatchObject({ footerTextColor: '#999999', alignment: 'center', fontSizePx: 11 });
    expect(blocks.every((b) => b.bgColor === undefined)).toBe(true);
  });

  it('does not glue words from adjacent blocks when measuring coverage', () => {
    const analysis = analyzeHtmlConversion('<table><tr><td bgcolor="#003bb3"><h1 style="color:#fff">Semana de ofertas</h1><p style="color:#fff">Até 50% em toda a loja</p></td></tr></table><p>Mais texto do corpo para o banner não virar wrapper da página.</p>');
    expect(analysis.textCoveragePercent).toBe(100);
  });

  it('reports full coverage when only invisible content was dropped', () => {
    const analysis = analyzeHtmlConversion(email);
    expect(analysis.textCoveragePercent).toBe(100);
    expect(analysis.retainedImageCount).toBe(analysis.sourceImageCount);
    expect(analysis.retainedLinkCount).toBe(analysis.sourceLinkCount);
    expect(analysis.hasContentLoss).toBe(false);
  });
});

describe('HTML importer: R9 round trip', () => {
  const source: EmailBlock[] = [
    { id: 'h', type: 'header_text', headerTitle: 'Bem-vindo', headerSubtitle: 'Sub', headerBgColor: '#003bb3', headerTextColor: '#ffffff', headerSubtitleColor: '#dbeafe', headerSubtitleSizePx: 18, fontSizePx: 30, alignment: 'center' },
    { id: 'hi', type: 'header_image', imageUrl: 'https://x.com/logo.png', imageWidthPx: 240, alignment: 'left', bgColor: '#003bb3', imageAlt: 'Logo' },
    { id: 't', type: 'title', text: 'Título <i>principal</i>', fontSizePx: 26, textColor: '#111111', alignment: 'center', isBold: true },
    { id: 's', type: 'subtitle', text: 'Subtítulo', fontSizePx: 18, textColor: '#475569' },
    { id: 'x', type: 'text', text: 'Linha 1\nLinha <b>2</b> {{nome}}', fontSizePx: 15, textColor: '#334155', lineHeight: '1.6', bgColor: '#fef3c7' },
    { id: 'b', type: 'button', buttonLabel: 'Acessar', buttonUrl: 'https://example.com/{{id}}', buttonBgColor: '#16a34a', buttonTextColor: '#ffffff', buttonWidth: 'full', alignment: 'right', fontSizePx: 17 },
    { id: 'i', type: 'image', imageUrl: 'https://example.com/banner.png', imageAlt: 'Banner', imageLink: 'https://example.com', imageCaption: 'Legenda', imageWidthPx: 500 },
    { id: 'c', type: 'coupon', couponCode: 'R9OFF', couponDiscount: '10% OFF', couponBgColor: '#f0fdf4', couponBorderColor: '#16a34a' },
    { id: 'd', type: 'divider', dividerStyle: 'dashed', dividerColor: '#cbd5e1' },
    { id: 'so', type: 'social', instagramUrl: 'https://instagram.com/r9', whatsappUrl: 'https://wa.me/55', websiteUrl: 'https://r9.com' },
    { id: 'f', type: 'footer', footerText: '© 2026 R9', footerBgColor: '#f8fafc', footerTextColor: '#64748b', fontSizePx: 12, alignment: 'center' },
  ];

  const expectRoundTrip = (parsed: EmailBlock[]) => {
    expect(parsed.map((b) => b.id)).toEqual(source.map((b) => b.id));
    expect(parsed.map((b) => b.type)).toEqual(source.map((b) => b.type));
    expect(parsed[0]).toMatchObject({ headerTitle: 'Bem-vindo', headerSubtitle: 'Sub', headerBgColor: '#003bb3', headerSubtitleSizePx: 18, fontSizePx: 30 });
    expect(parsed[1]).toMatchObject({ imageUrl: 'https://x.com/logo.png', imageWidthPx: 240, alignment: 'left', bgColor: '#003bb3' });
    expect(parsed[2]).toMatchObject({ text: 'Título <i>principal</i>', fontSizePx: 26, textColor: '#111111', alignment: 'center', isBold: true });
    expect(parsed[4]).toMatchObject({ text: 'Linha 1<br/>Linha <b>2</b> {{nome}}', lineHeight: '1.6', bgColor: '#fef3c7' });
    expect(parsed[5]).toMatchObject({ buttonUrl: 'https://example.com/{{id}}', buttonBgColor: '#16a34a', buttonWidth: 'full', alignment: 'right', fontSizePx: 17 });
    expect(parsed[6]).toMatchObject({ imageLink: 'https://example.com', imageCaption: 'Legenda', imageWidthPx: 500 });
    expect(parsed[7]).toMatchObject({ couponCode: 'R9OFF', couponDiscount: '10% OFF', couponBorderColor: '#16a34a' });
    expect(parsed[8]).toMatchObject({ dividerStyle: 'dashed', dividerColor: '#cbd5e1' });
    expect(parsed[9]).toMatchObject({ instagramUrl: 'https://instagram.com/r9', whatsappUrl: 'https://wa.me/55', websiteUrl: 'https://r9.com' });
    expect(parsed[10]).toMatchObject({ footerText: '© 2026 R9', footerTextColor: '#64748b', fontSizePx: 12 });
  };

  it('rebuilds blocks from the editor preview HTML', () => {
    expectRoundTrip(parseHtmlToBlocks(compileBlocksToHtml(source)));
  });

  it('rebuilds R9 blocks from the exported e-mail HTML', () => {
    const parsed = parseHtmlToBlocks(compileBlocksForEmail(source));
    // The export renders buttons and images as e-mail tables, so those are detected generically.
    expect(parsed.map((b) => b.type)).toEqual(source.map((b) => b.type));
    expect(parsed[5]).toMatchObject({ buttonLabel: 'Acessar', buttonBgColor: '#16a34a', buttonWidth: 'full', alignment: 'right' });
    expect(parsed[6]).toMatchObject({ imageUrl: 'https://example.com/banner.png', imageLink: 'https://example.com' });
  });
});

describe('HTML importer: safety', () => {
  it('never produces executable content', () => {
    const blocks = parseHtmlToBlocks('<div><script>alert(1)</script><p onclick="alert(2)">Texto seguro</p><a href="javascript:alert(3)">link</a></div>');
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toMatch(/alert|onclick|javascript:/);
    expect(allText(blocks)).toContain('Texto seguro');
  });

  it('returns no blocks for empty input', () => {
    expect(parseHtmlToBlocks('')).toEqual([]);
    expect(parseHtmlToBlocks('   ')).toEqual([]);
  });
});
