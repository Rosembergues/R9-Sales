import React from 'react';
import type { EmailBlock } from '../types';
import { sanitizeUrl } from '../utils/security';

interface TemplateMiniPreviewProps {
  blocks: EmailBlock[];
  variant?: 'card' | 'detail';
  label?: string;
}

function plainText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function alignClass(alignment?: EmailBlock['alignment']): string {
  if (alignment === 'center') return 'text-center';
  if (alignment === 'right') return 'text-right';
  return 'text-left';
}

function PreviewBlock({ block }: { block: EmailBlock }) {
  const backgroundColor = block.bgColor || '#ffffff';
  const textColor = block.textColor || '#334155';
  const alignment = alignClass(block.alignment);
  const heading = plainText(block.headerTitle || 'ESTÁCIO • SUA MATRÍCULA COMEÇA AQUI');
  const subtitle = plainText(block.headerSubtitle);
  const text = plainText(block.text);
  const imageUrl = sanitizeUrl(block.imageUrl, 'src');

  switch (block.type) {
    case 'header':
    case 'header_text':
      return (
        <div className="px-3 py-3 text-center" style={{ backgroundColor: block.headerBgColor || block.bgColor || '#003bb3', color: block.headerTextColor || '#ffffff' }}>
          <div className="line-clamp-3 whitespace-pre-line break-words font-bold leading-tight" style={{ fontSize: 10 }}>{heading}</div>
          {subtitle && <div className="mt-1 line-clamp-2 break-words leading-tight" style={{ color: block.headerSubtitleColor || block.headerTextColor || '#ffffff', fontSize: 6.5 }}>{subtitle}</div>}
        </div>
      );
    case 'header_image':
    case 'image':
      return (
        <div className="px-2 py-1.5" style={{ backgroundColor }}>
          {imageUrl ? (
            <img src={imageUrl} alt={block.imageAlt || 'Prévia da imagem do e-mail'} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="mx-auto block max-h-12 w-full rounded object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="flex h-8 items-center justify-center rounded bg-slate-100 text-[7px] text-slate-400">Imagem do e-mail</div>
          )}
          {block.imageCaption && <div className="mt-1 line-clamp-1 text-center text-[6px] text-slate-500">{plainText(block.imageCaption)}</div>}
        </div>
      );
    case 'title':
      return <div className={`break-words px-3 pb-1 pt-2 font-bold leading-tight ${alignment}`} style={{ color: textColor, backgroundColor, fontSize: 11 }}>{text || 'Título do e-mail'}</div>;
    case 'subtitle':
      return <div className={`line-clamp-2 break-words px-3 py-1 leading-tight ${alignment}`} style={{ color: textColor || '#475569', backgroundColor, fontSize: 8 }}>{text || 'Subtítulo do e-mail'}</div>;
    case 'text':
      return <div className={`line-clamp-3 break-words px-3 py-1.5 leading-snug ${alignment}`} style={{ color: textColor, backgroundColor, fontSize: 7.5 }}>{text || 'Texto do e-mail…'}</div>;
    case 'button':
      return (
        <div className={`px-3 py-2 ${alignment}`} style={{ backgroundColor }}>
          <span className="inline-block max-w-full truncate rounded px-3 py-1.5 font-bold" style={{ backgroundColor: block.buttonBgColor || '#4f46e5', color: block.buttonTextColor || '#ffffff', fontSize: 7.5 }}>{plainText(block.buttonLabel || 'Clique aqui')}</span>
        </div>
      );
    case 'coupon':
      return (
        <div className="px-3 py-2" style={{ backgroundColor }}>
          <div className="rounded border border-dashed px-2 py-2 text-center" style={{ backgroundColor: block.couponBgColor || '#eef2ff', borderColor: block.couponBorderColor || '#818cf8' }}>
            <div className="line-clamp-1 font-bold uppercase" style={{ color: block.couponBorderColor || '#6366f1', fontSize: 6 }}>{plainText(block.couponDiscount || 'Oferta especial')}</div>
            <div className="mt-1 font-mono font-bold text-slate-800" style={{ fontSize: 9 }}>{plainText(block.couponCode || 'CUPOM')}</div>
          </div>
        </div>
      );
    case 'divider':
      return <div className="px-3 py-2" style={{ backgroundColor }}><div style={{ borderTop: `${Math.max(1, Math.min(3, block.dividerHeight || 1))}px ${block.dividerStyle || 'solid'} ${block.dividerColor || '#e2e8f0'}` }} /></div>;
    case 'social':
      return <div className="flex justify-center gap-2 px-2 py-2 text-[6px] font-semibold text-indigo-600" style={{ backgroundColor }}>{['Instagram', 'WhatsApp', 'LinkedIn', 'Facebook'].filter((name, index) => [block.instagramUrl, block.whatsappUrl, block.linkedinUrl, block.facebookUrl][index]).map((name) => <span key={name}>{name}</span>)}</div>;
    case 'columns':
      return (
        <div className="flex gap-1.5 px-3 py-2" style={{ backgroundColor }}>
          {(block.columns || []).map((cell, index) => {
            const src = sanitizeUrl(cell.imageUrl, 'src');
            return (
              <div key={index} className="min-w-0 flex-1 text-center">
                {src ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="mx-auto mb-1 block h-7 w-full rounded object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}
                <div className="line-clamp-2 break-words leading-tight" style={{ color: textColor, fontSize: 6.5 }}>{plainText(cell.text)}</div>
                {cell.buttonLabel && <span className="mt-1 inline-block max-w-full truncate rounded px-1.5 py-0.5 font-bold" style={{ backgroundColor: block.buttonBgColor || '#4f46e5', color: block.buttonTextColor || '#ffffff', fontSize: 6 }}>{plainText(cell.buttonLabel)}</span>}
              </div>
            );
          })}
        </div>
      );
    case 'footer':
      return <div className="line-clamp-2 break-words px-3 py-2 text-center leading-tight" style={{ backgroundColor: block.footerBgColor || block.bgColor || '#f8fafc', color: block.footerTextColor || '#64748b', fontSize: 6.5 }}>{plainText(block.footerText || '© Todos os direitos reservados.')}</div>;
    default:
      return <div className="px-3 py-2 text-[7px] text-slate-400">Bloco de conteúdo</div>;
  }
}

export const TemplateMiniPreview: React.FC<TemplateMiniPreviewProps> = ({ blocks, variant = 'card', label = 'Prévia do e-mail' }) => {
  const maxBlocks = variant === 'detail' ? 7 : 5;
  const visibleBlocks = (Array.isArray(blocks) ? blocks : []).slice(0, maxBlocks);
  const hasMore = Array.isArray(blocks) && blocks.length > visibleBlocks.length;

  return (
    <div aria-label={label} aria-hidden="true" className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${variant === 'detail' ? 'h-60 p-3' : 'h-40 p-2'}`}>
      {visibleBlocks.length > 0 ? (
        <div className="mx-auto min-h-full w-full max-w-[320px] overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200/70">
          {visibleBlocks.map((block, index) => <PreviewBlock key={block.id || `${block.type}-${index}`} block={block} />)}
          {hasMore && <div className="px-3 py-2 text-center text-[6px] text-slate-400">… mais conteúdo</div>}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center rounded-md bg-white text-xs text-slate-400">Sem prévia disponível</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-slate-100 to-transparent" />
      <span className="absolute bottom-2 right-2 rounded-full border border-slate-200 bg-white/95 px-2 py-0.5 text-[9px] font-semibold text-slate-500">Prévia</span>
    </div>
  );
};
