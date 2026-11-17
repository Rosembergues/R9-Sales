import { describe, expect, it } from 'vitest';
import type { EmailData } from '../src/types';
import { parseHtmlToBlocks, extractEmailMeta } from '../src/utils/htmlParser';
import { analyzeHtmlConversion } from '../src/utils/htmlImportAnalysis';
import { sanitizeEmailHtml, sanitizeImportHtml } from '../src/utils/security';
import { convertForeignMergeTags, findForeignMergeTags } from '../src/utils/mergeTags';
import { runEmailChecklist } from '../src/utils/emailChecklist';

const strip = <T extends { id: string }>(blocks: T[]) => blocks.map(({ id: _id, ...rest }) => rest);

describe('style sanitizer keeps safe declarations next to background images', () => {
  it('drops only the unsafe declaration', () => {
    const html = sanitizeEmailHtml(`<table><tr><td style="background-image:url('https://x.com/hero.jpg');background-color:#222;color:#fff">Oi</td></tr></table>
      <p style="color:red;background:url(javascript:alert(1));font-size:20px">x</p>
      <p style="width:expression(alert(1));color:blue">y</p>`);
    expect(html).toContain("background-image:url('https://x.com/hero.jpg')");
    expect(html).toContain('background-color:#222');
    expect(html).toContain('color:red');
    expect(html).toContain('font-size:20px');
    expect(html).toContain('color:blue');
    expect(html).not.toMatch(/javascript|expression/i);
  });

  it('sanitizes the legacy background attribute', () => {
    const html = sanitizeImportHtml('<table><tr><td background="javascript:alert(1)">a</td><td background="https://x.com/bg.png">b</td></tr></table>');
    expect(html).not.toContain('javascript');
    expect(html).toContain('background="https://x.com/bg.png"');
  });
});

describe('background images', () => {
  const hero = `<table><tr><td background="https://x.com/hero.jpg" style="background-image:url('https://x.com/hero.jpg');background-color:#222222;padding:60px">
    <h1 style="color:#ffffff">Black Friday</h1>
    <a href="https://x.com" style="background:#e11d48;color:#fff;padding:12px 20px;display:inline-block">Comprar</a></td></tr></table>
    <p>Texto de baixo com mais conteúdo.</p>`;

  it('turns a hero background into an image block and keeps the text readable', () => {
    const blocks = strip(parseHtmlToBlocks(hero));
    expect(blocks[0]).toMatchObject({ type: 'image', imageUrl: 'https://x.com/hero.jpg' });
    expect(blocks[1]).toMatchObject({ type: 'title', textColor: '#ffffff', bgColor: '#222222' });
    expect(blocks[2]).toMatchObject({ type: 'button', buttonLabel: 'Comprar' });
    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(1);
  });

  it('counts background images in the import analysis', () => {
    const analysis = analyzeHtmlConversion(hero);
    expect(analysis.sourceImageCount).toBe(1);
    expect(analysis.retainedImageCount).toBe(1);
  });

  it('does not import a textured page background around a long e-mail', () => {
    const long = 'Parágrafo com bastante texto para o e-mail. '.repeat(15);
    const blocks = parseHtmlToBlocks(`<table width="100%" style="background:url(https://x.com/tile.png)"><tr><td><p>${long}</p><p>${long}</p></td></tr></table>`);
    expect(blocks.some((b) => b.type === 'image')).toBe(false);
  });
});

describe('stylesheet selectors', () => {
  it('applies descendant, id and child selectors with specificity', () => {
    const blocks = strip(parseHtmlToBlocks(`<style>
        p { color:#111111 }
        .mcnTextContent p { color:#e11d48; font-size:22px }
        #hero h1 { color:#00aa00 }
        td > a.btn { background:#003bb3; color:#ffffff; padding:10px; display:inline-block }
        a:hover { color:#ff00ff }
        @media (max-width:600px) { .mcnTextContent p { color:#000000 !important } }
        @media screen { .note { font-style:italic } }
      </style>
      <table><tr><td class="mcnTextContent"><p>Texto vermelho grande</p></td></tr></table>
      <div id="hero"><h1>Título verde</h1></div>
      <p class="note">Observação</p>
      <table><tr><td><a class="btn" href="https://x.com">Comprar</a></td></tr></table>`));
    expect(blocks[0]).toMatchObject({ text: 'Texto vermelho grande', textColor: '#e11d48', fontSizePx: 22 });
    expect(blocks[1]).toMatchObject({ type: 'title', textColor: '#00aa00' });
    expect(blocks[2]).toMatchObject({ text: 'Observação', isItalic: true, textColor: '#111111' });
    expect(blocks[3]).toMatchObject({ type: 'button', buttonBgColor: '#003bb3', buttonTextColor: '#ffffff' });
  });

  it('keeps stylesheet inline formatting inside text (clones keep resolved styles)', () => {
    const [block] = parseHtmlToBlocks('<style>.content .destaque { color:#e11d48; font-weight:bold }</style><div class="content"><p>Oferta <span class="destaque">imperdível</span> hoje</p></div>');
    expect(block.text).toBe('Oferta <span style="color: #e11d48;"><b>imperdível</b></span> hoje');
  });

  it('ignores invalid selectors instead of failing', () => {
    expect(() => parseHtmlToBlocks('<style>p:::bad { color:red } p { color:#123456 }</style><p>ok</p>')).not.toThrow();
    expect(parseHtmlToBlocks('<style>p:::bad { color:red } p { color:#123456 }</style><p>ok</p>')[0].textColor).toBe('#123456');
  });
});

describe('merge tags from other platforms', () => {
  it('converts name and e-mail tags', () => {
    expect(convertForeignMergeTags('Olá *|FNAME|*, *|EMAIL|*')).toBe('Olá {{nome}}, {{email}}');
    expect(convertForeignMergeTags('Oi {{ contact.FIRSTNAME }} / {{contact.EMAIL}} / {{ lead.nome }}')).toBe('Oi {{nome}} / {{email}} / {{nome}}');
    expect(convertForeignMergeTags('%%first_name%% %FIRSTNAME% {{ first_name|default:"amigo" }} {contactfield=email}')).toBe('{{nome}} {{nome}} {{nome}} {{email}}');
    expect(convertForeignMergeTags('{{var1}} *|UNSUB|* 50% OFF %%unsub_url%%')).toBe('{{var1}} *|UNSUB|* 50% OFF %%unsub_url%%');
  });

  it('converts tags in imported text, links, preheader and subject', () => {
    const html = `<html><head><title>Oferta para *|FNAME|*</title></head><body>
      <div style="display:none">Oi %%first_name%%</div>
      <p>Olá *|FNAME|*, confirme *|EMAIL|*.</p>
      <a href="https://x.com/?e=*|EMAIL|*" style="background:#000;color:#fff;padding:10px;display:inline-block">Confirmar</a></body></html>`;
    const blocks = parseHtmlToBlocks(html);
    expect(blocks[0].text).toBe('Olá {{nome}}, confirme {{email}}.');
    expect(blocks[1].buttonUrl).toBe('https://x.com/?e={{email}}');
    expect(extractEmailMeta(html)).toEqual({ preheader: 'Oi {{nome}}', subject: 'Oferta para {{nome}}' });
  });

  it('flags the tags that could not be converted', () => {
    expect(findForeignMergeTags('Sair: *|UNSUB|* e %%unsub%%')).toEqual(['*|UNSUB|*', '%%unsub%%']);
    const data = { headerTitle: '', greeting: '', buttonText: '', buttonUrl: '', bodyText: '', primaryColor: '', activeTemplateId: '', subject: 'Oi', preheader: 'p' } as EmailData;
    const issues = runEmailChecklist([{ id: 'f', type: 'footer', footerText: 'Descadastre: *|UNSUB|*' }], data, '');
    expect(issues.some((i) => i.title.includes('*|UNSUB|*') && i.blockId === 'f')).toBe(true);
  });
});
