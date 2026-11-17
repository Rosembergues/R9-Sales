import type { EmailBlock } from '../types';

export const DEFAULT_BLOCKS: EmailBlock[] = [
  { id: 'block-1', type: 'header_text', headerTitle: 'ESTÁCIO\nSUA MATRÍCULA\nCOMEÇA AQUI!', headerSubtitle: 'Condições especiais para estudar na Estácio R9 – Taquara', headerBgColor: '#003bb3', headerTextColor: '#ffffff', headerSubtitleColor: '#ffffff', alignment: 'center', fontSizePx: 28, headerSubtitleSizePx: 16, isBold: true },
  { id: 'block-2', type: 'title', text: 'Novidades exclusivas para você', fontSizePx: 28, textColor: '#1e1b4b', alignment: 'left', isBold: true, fontFamily: 'Helvetica, Arial, sans-serif' },
  { id: 'block-3', type: 'subtitle', text: 'Olá {{nome}}, temos uma atualização especial para você!', fontSizePx: 18, textColor: '#475569', alignment: 'left', isItalic: false, fontFamily: 'Helvetica, Arial, sans-serif' },
  { id: 'block-4', type: 'text', text: 'Estamos muito felizes em apresentar as novas funcionalidades desenvolvidas sob medida para impulsionar os resultados de sua equipe.\n\nCom a nossa nova plataforma, você terá controle total sobre suas entregas, relatórios automatizados e integração simplificada em tempo real.', fontSizePx: 15, textColor: '#334155', alignment: 'left', lineHeight: '1.6', fontFamily: 'Helvetica, Arial, sans-serif' },
  { id: 'block-5', type: 'button', buttonLabel: 'Conhecer Plataforma Agora', buttonUrl: 'https://exemplo.com/plataforma', buttonBgColor: '#4f46e5', buttonTextColor: '#ffffff', buttonWidth: 'auto', alignment: 'center', fontSizePx: 16, isBold: true },
  { id: 'block-6', type: 'divider', dividerStyle: 'solid', dividerColor: '#e2e8f0' },
  { id: 'block-7', type: 'coupon', couponCode: 'ESTACIO30OFF', couponDiscount: '30% DE DESCONTO NO PLANO ANUAL', couponBgColor: '#e0e7ff', couponBorderColor: '#6366f1', fontSizePx: 22, isBold: true },
  { id: 'block-8', type: 'footer', footerText: 'Você está recebendo este e-mail enviado para {{email}}.\n© 2026 Estácio. Todos os direitos reservados.', footerBgColor: '#f8fafc', footerTextColor: '#64748b', fontSizePx: 12, alignment: 'center' },
];
