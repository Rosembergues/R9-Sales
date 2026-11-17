import { it } from 'vitest';
import type { EmailBlock } from '../src/types';
import { compileBlocksForEmail } from '../src/utils/emailCompiler';
import { parseHtmlToBlocks, extractEmailMeta } from '../src/utils/htmlParser';
import { createDefaultBlock } from '../src/utils/brandKit';
import { normalizeBlocks } from '../src/utils/blockNormalizer';

it('rt', () => {
  const types = ['header_text', 'header_image', 'title', 'subtitle', 'text', 'button', 'image', 'coupon', 'divider', 'social', 'footer', 'columns'] as const;
  const blocks: EmailBlock[] = types.map((t, i) => createDefaultBlock(t, `b${i}`));
  blocks[1].imageUrl = 'https://cdn.x.com/logo.png'; blocks[1].imageAlt = 'Logo';
  blocks[5].buttonUrl = 'https://x.com/a'; blocks[5].buttonWidth = 'full';
  blocks[6].imageUrl = 'https://cdn.x.com/a.jpg'; blocks[6].imageAlt = 'Foto'; blocks[6].imageLink = 'https://x.com/f'; blocks[6].imageCaption = 'Legenda'; blocks[6].imageWidthPx = 400; blocks[6].alignment = 'left';
  blocks[9] = { ...blocks[9], instagramUrl: 'https://instagram.com/x', websiteUrl: 'https://x.com' };
  blocks[4].text = 'Olá {{nome}}, <b>negrito</b> e <a href="https://x.com/l">link</a>.<br/>Linha 2';
  blocks[3].isItalic = true;
  blocks[2].textColor = '#aa0000';
  const html = compileBlocksForEmail(blocks, { subject: 'Assunto X', preheader: 'Pre X' } as any);
  const back = parseHtmlToBlocks(html);
  console.log('META', JSON.stringify(extractEmailMeta(html)));
  const norm = normalizeBlocks(blocks);
  const max = Math.max(norm.length, back.length);
  for (let i = 0; i < max; i++) {
    const a = norm[i] as any || {}; const b = back[i] as any || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const diffs: string[] = [];
    keys.forEach((k) => { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push(`${k}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`); });
    console.log(`DIFF ${i} ${a.type}/${b.type}: ${diffs.join(' | ') || 'OK'}`);
  }
});
