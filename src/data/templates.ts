import { EmailTemplate } from '../types';

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'padrao',
    name: 'Padrão',
    description: 'Um layout limpo e direto, ideal para comunicados gerais e avisos institucionais.',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
    headerTitle: 'Novidades Especiais',
    greeting: 'Olá, {{nome}}!',
    buttonText: 'Agendar Demonstração',
    buttonUrl: 'https://exemplo.com',
    bodyText: 'Esperamos que este e-mail lhe encontre bem em {{var1}}.\n\nTemos o prazer de apresentar uma oferta desenhada sob medida para as suas necessidades de negócios. Clique no botão abaixo para agendar uma demonstração gratuita conosco.',
    footerText: 'Você está recebendo este e-mail comercial enviado para {{email}}.\n© 2026 Minha Empresa S.A. Todos os direitos reservados.',
    primaryColor: '#4f46e5',
    customCodeHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 20px; -webkit-text-size-adjust: 100%; }
    .card { background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background-color: #4f46e5; color: #ffffff; padding: 32px 24px; text-align: center; }
    .content { padding: 32px 24px; line-height: 1.6; }
    .footer { background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 16px; }
    h2 { color: #1e1b4b; margin-top: 0; }
    img { max-width: 100%; height: auto; border: 0; outline: none; }
    img.emoji, img.CToW4e, img[src*="emoji"], img[src*="emoticons"], img[alt*="emoji"] {
      width: 1.2em !important; height: 1.2em !important; max-width: 1.2em !important; max-height: 1.2em !important; display: inline-block !important; vertical-align: -0.2em !important; margin: 0 0.15em !important;
    }
    
    /* Regras de Visualização Responsiva Mobile */
    @media only screen and (max-width: 600px) {
      body { padding: 10px !important; }
      .card { border-radius: 0 !important; border: none !important; width: 100% !important; }
      .header { padding: 24px 16px !important; }
      .content { padding: 24px 16px !important; }
      .btn-full { display: block !important; width: 100% !important; text-align: center !important; padding: 14px 16px !important; box-sizing: border-box !important; font-size: 16px !important; }
      .btn { max-width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0; font-size:24px;">Novidades Especiais</h1>
    </div>
    <div class="content">
      <h2>Olá, {{nome}}!</h2>
      <p>Esperamos que este e-mail lhe encontre bem em <strong>{{var1}}</strong>.</p>
      <p>Temos o prazer de apresentar uma oferta desenhada sob medida para as suas necessidades de negócios. Clique no botão abaixo para agendar uma demonstração gratuita conosco.</p>
      <div style="text-align: center;">
        <a href="https://exemplo.com" class="btn">Agendar Demonstração</a>
      </div>
      <p style="margin-top: 24px;">Atenciosamente,<br>Equipe Comercial</p>
    </div>
    <div class="footer">
      Você está recebendo este e-mail comercial enviado para {{email}}.<br>
      © 2026 Minha Empresa S.A. Todos os direitos reservados.
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'estacio-matricula',
    name: 'Cupom / Oferta',
    description: 'Comunicação sobre início de matrícula, descontos especiais e cupom promocional.',
    badge: 'MATRÍCULA',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
    headerTitle: 'ESTÁCIO R9-TAQUARA\nSUA MATRÍCULA COMEÇA AQUI!',
    greeting: 'Olá, {{nome}}!',
    buttonText: 'FALE CONOSCO',
    buttonUrl: '{{var1}}',
    bodyText: 'Chegou a oportunidade de iniciar sua graduação com uma condição exclusiva.\n\n✅ Mensalidades a partir de R$ 79,90*\n✅ Mais de 120 cursos\n✅ Graduação Presencial, Flex e EAD\n✅ Atendimento personalizado',
    footerText: 'Esperamos você,\nEquipe Estácio.\n© 2026 Estácio. Todos os direitos reservados.',
    primaryColor: '#003bb3',
    customCodeHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 20px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    a { color: #4f46e5; }
    img { max-width: 100%; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic; }
    .img-container img, img.email-banner-img { width: 100% !important; max-width: 100% !important; height: auto !important; display: block; object-fit: contain; }
    .img-container { width: 100% !important; box-sizing: border-box !important; }

    /* Proteção para Emojis em Clientes de E-mail (Outlook, Gmail Web, Apple Mail) */
    img.emoji, img.CToW4e, img[src*="emoji"], img[src*="emoticons"], img[alt*="emoji"], img[style*="width: 1em"], img[style*="height: 1em"] {
      width: 1.2em !important;
      height: 1.2em !important;
      max-width: 1.2em !important;
      max-height: 1.2em !important;
      min-width: 0 !important;
      min-height: 0 !important;
      display: inline-block !important;
      vertical-align: -0.2em !important;
      margin: 0 0.15em !important;
      border: 0 !important;
      outline: none !important;
      object-fit: contain !important;
    }
    @media only screen and (max-width: 600px) {
      body { padding: 8px !important; }
      .card { border-radius: 0 !important; border: none !important; width: 100% !important; }
      .btn-full { display: block !important; width: 100% !important; text-align: center !important; padding: 14px 16px !important; box-sizing: border-box !important; font-size: 16px !important; }
      .btn { max-width: 100% !important; box-sizing: border-box !important; }
      .img-container { padding: 12px 12px !important; }
      .img-container img { width: 100% !important; max-width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    
    <div style="background-color: #003bb3; padding: 36px 24px; text-align: center; font-family: Helvetica, Arial, sans-serif;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-align: center; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5; ; line-height: 1.25; letter-spacing: 0.5px;">ESTÁCIO R9-TAQUARA<br/>SUA MATRÍCULA COMEÇA AQUI!</h1>
      <p style="margin: 16px 0 0 0; color: #ffffff; font-size: 16px; font-weight: 500; text-align: center; line-height: 1.4;">Condições especiais para estudar na Estácio R9 – Taquara</p>
    </div>
    <div style="padding: 24px 28px 8px 28px; text-align: left;">
      <h2 style="margin: 0; color: #1e1b4b; font-size: 28px; text-align: left; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5; ">Olá, {{nome}}!</h2>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Chegou a oportunidade de iniciar sua graduação com uma condição exclusiva.<br/><br/>✅ Mensalidades a partir de R$ 79,90*<br/>✅ Mais de 120 cursos<br/>✅ Graduação Presencial, Flex e EAD<br/>✅ Atendimento personalizado</div>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Precisando de mais um desconto?<br/>A Estácio R9-Taquara preparou um desconto especial para você!</div>
    </div>
    <div style="padding: 20px 28px; font-family: Helvetica, Arial, sans-serif;">
      <div style="background-color: #e0e7ff; border: 2px dashed #6366f1; border-radius: 10px; padding: 20px; text-align: center;">
        <span style="display: block; font-size: 12px; font-weight: bold; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">1° MÊS POR R$79 COM O PARCELA LEVE. DEPOIS, SÓ EM OUTUBRO</span>
        <div style="font-family: monospace; font-size: 22px; font-weight: bold; color: #0f172a; letter-spacing: 2px; padding: 6px 0;">
          formaaura
        </div>
      </div>
    </div>
    <div style="padding: 20px 28px; text-align: center;">
      <a href="{{var1}}" class="btn" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; text-decoration: none; font-weight: bold;   border-radius: 8px; font-size: 16px; font-family: Helvetica, Arial, sans-serif;">FALE CONOSCO</a>
    </div>
    <div style="background-color: #1e1b4b; padding: 20px 24px; border-top: 1px solid #f1f5f9;">
      <div style="color: #64748b; font-size: 16px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5; ">Esperamos você,<br/>Equipe Estácio.<br/>© 2026 Estácio. Todos os direitos reservados.</div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'estacio-boleto',
    name: 'Link de Pagamento',
    description: 'Aviso formal sobre a disponibilidade do boleto de matrícula com botões de ação.',
    badge: 'BOLETO',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    headerTitle: 'SEU BOLETO DE MATRÍCULA JÁ ESTÁ DISPONÍVEL!',
    greeting: 'Olá, {{nome}}!',
    buttonText: 'ACESSAR MEU BOLETO',
    buttonUrl: '{{var1}}',
    bodyText: 'Temos uma novidade importante: o boleto referente à sua matrícula já está disponível.\n\nPara confirmar sua matrícula e garantir o início da sua jornada acadêmica, acesse o ambiente de pagamento e consulte todos os detalhes do seu boleto.',
    footerText: '📍 Estácio R9 – Taquara\nRua André Rocha, 838 – Taquara – Rio de Janeiro/RJ\nEsperamos você, Equipe Estácio.\n© 2026 Estácio. Todos os direitos reservados.',
    primaryColor: '#003bb3',
    customCodeHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 20px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    a { color: #4f46e5; }
    img { max-width: 100%; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic; }
    .img-container img, img.email-banner-img { width: 100% !important; max-width: 100% !important; height: auto !important; display: block; object-fit: contain; }
    .img-container { width: 100% !important; box-sizing: border-box !important; }

    /* Proteção para Emojis em Clientes de E-mail (Outlook, Gmail Web, Apple Mail) */
    img.emoji, img.CToW4e, img[src*="emoji"], img[src*="emoticons"], img[alt*="emoji"], img[style*="width: 1em"], img[style*="height: 1em"] {
      width: 1.2em !important;
      height: 1.2em !important;
      max-width: 1.2em !important;
      max-height: 1.2em !important;
      min-width: 0 !important;
      min-height: 0 !important;
      display: inline-block !important;
      vertical-align: -0.2em !important;
      margin: 0 0.15em !important;
      border: 0 !important;
      outline: none !important;
      object-fit: contain !important;
    }
    @media only screen and (max-width: 600px) {
      body { padding: 8px !important; }
      .card { border-radius: 0 !important; border: none !important; width: 100% !important; }
      .btn-full { display: block !important; width: 100% !important; text-align: center !important; padding: 14px 16px !important; box-sizing: border-box !important; font-size: 16px !important; }
      .btn { max-width: 100% !important; box-sizing: border-box !important; }
      .img-container { padding: 12px 12px !important; }
      .img-container img { width: 100% !important; max-width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    
    <div style="background-color: #003bb3; padding: 36px 24px; text-align: center; font-family: Helvetica, Arial, sans-serif;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; text-align: center; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 2.0; ; line-height: 1.25; letter-spacing: 0.5px;">SEU BOLETO DE MATRÍCULA JÁ ESTÁ DISPONÍVEL!</h1>
      
    </div>
    <div style="padding: 24px 28px 8px 28px; text-align: left;">
      <h2 style="margin: 0; color: #1e1b4b; font-size: 28px; text-align: left; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5; ">Olá, {{nome}}!</h2>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Temos uma novidade importante: o boleto referente à sua matrícula já está disponível.<br/><br/>Para confirmar sua matrícula e garantir o início da sua jornada acadêmica, acesse o ambiente de pagamento e consulte todos os detalhes do seu boleto.</div>
    </div>
    <div style="padding: 20px 28px; text-align: center;">
      <a href="{{var1}}" class="btn" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; text-decoration: none; font-weight: bold;   border-radius: 8px; font-size: 16px; font-family: Helvetica, Arial, sans-serif;">ACESSAR MEU BOLETO</a>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">💙 Agora é só dar mais um passo!</div>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Seu futuro começa com uma escolha. E essa escolha está cada vez mais perto de se tornar realidade.<br/><br/>Consulte seu boleto, realize o pagamento e fique ainda mais perto de começar sua graduação na Estácio.</div>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Precisa de ajuda?</div>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Nossa equipe da Estácio R9 – Taquara está à disposição para auxiliar você em caso de dúvidas sobre sua matrícula ou pagamento.</div>
    </div>
    <div style="padding: 20px 28px; text-align: center;">
      <a href="{{var2}}" class="btn" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; text-decoration: none; font-weight: bold;   border-radius: 8px; font-size: 16px; font-family: Helvetica, Arial, sans-serif;">FALA CONOSCO</a>
    </div>
    <div style="padding: 12px 28px; text-align: left;">
      <div style="color: #334155; font-size: 12px; text-align: left; font-weight: normal; font-style: italic; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6; ">Esta mensagem é destinada ao processo de matrícula. Caso o pagamento já tenha sido realizado, desconsidere este aviso.</div>
    </div>
    <div style="background-color: #1e1b4b; padding: 20px 24px; border-top: 1px solid #f1f5f9;">
      <div style="color: #64748b; font-size: 16px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5; ">📍 Estácio R9 – Taquara<br/>Rua André Rocha, 838 – Taquara – Rio de Janeiro/RJ<br/>Esperamos você, Equipe Estácio.<br/>© 2026 Estácio. Todos os direitos reservados.</div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'documentacao',
    name: 'Documentação',
    description: 'Aviso de pendência na entrega de documentos com instruções de acesso ao portal do candidato.',
    badge: 'DOCUMENTOS',
    image: 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=600&q=80',
    headerTitle: 'SUA MATRÍCULA ESTÁ QUASE COMPLETA',
    greeting: 'Olá, {{nome}}!',
    buttonText: 'Fale conosco',
    buttonUrl: '{{var1}}',
    bodyText: 'Esperamos que este e-mail lhe encontre bem!\n\nEstou super ansioso para te conhecer e começar essa jornada com você! Porém, ao conferir a chamada, vi que ainda falta finalizar a entrega da sua documentação. Não queremos que você perca o início dessa nossa caminhada, certo?\n\nPara garantir seu lugar na turma, é só seguir este passo a passo:',
    footerText: '© 2026 Estácio. Todos os direitos reservados.',
    primaryColor: '#004acd',
    customCodeHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 20px; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    .card { background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    a { color: #4f46e5; }
    img { max-width: 100%; height: auto; border: 0; outline: none; -ms-interpolation-mode: bicubic; }
    .img-container img, img.email-banner-img { width: 100% !important; max-width: 100% !important; height: auto !important; display: block; object-fit: contain; }
    .img-container { width: 100% !important; box-sizing: border-box !important; }

    /* Proteção para Emojis em Clientes de E-mail (Outlook, Gmail Web, Apple Mail) */
    img.emoji, img.CToW4e, img[src*="emoji"], img[src*="emoticons"], img[alt*="emoji"], img[style*="width: 1em"], img[style*="height: 1em"] {
      width: 1.2em !important;
      height: 1.2em !important;
      max-width: 1.2em !important;
      max-height: 1.2em !important;
      min-width: 0 !important;
      min-height: 0 !important;
      display: inline-block !important;
      vertical-align: -0.2em !important;
      margin: 0 0.15em !important;
      border: 0 !important;
      outline: none !important;
      object-fit: contain !important;
    }
    @media only screen and (max-width: 600px) {
      body { padding: 8px !important; }
      .card { border-radius: 0 !important; border: none !important; width: 100% !important; }
      .btn-full { display: block !important; width: 100% !important; text-align: center !important; padding: 14px 16px !important; box-sizing: border-box !important; font-size: 16px !important; }
      .btn-auto { display: inline-block !important; width: auto !important; max-width: 100% !important; box-sizing: border-box !important; }
      .btn { max-width: 100% !important; box-sizing: border-box !important; }
      .img-container { padding: 12px 12px !important; }
      .img-container img { width: 100% !important; max-width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    
    <div class="header-img-container" style="padding: 0; width: 100%; text-align: center; font-family: Helvetica, Arial, sans-serif; box-sizing: border-box; overflow: hidden; ">
      <img src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0292381296.firebasestorage.app/o/emails%2F1786558902822_xy0llq_HEADER_02_3_png.png?alt=media&token=48a4360a-fa84-4d29-a651-4dbb72d41536" alt="Imagem de Cabeçalho do E-mail" class="email-header-img" width="100%" style="width: 100% !important; max-width: 100% !important; height: auto !important; display: block; border: 0; outline: none; margin: 0 auto; object-fit: cover;" />
      
    </div>
    <div style="padding: 4px 28px 12px 28px; text-align: center; background-color: #004acd;">
      <p style="margin: 0; color: #ffffff; font-size: 18px; text-align: center; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5;">SUA MATRÍCULA ESTÁ QUASE COMPLETA</p>
    </div>
    <div style="padding: 24px 28px 8px 28px; text-align: left; ">
      <h2 style="margin: 0; color: #1e1b4b; font-size: 16px; text-align: left; font-weight: bold; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5;">Olá,  {{nome}}!</h2>
    </div>
    <div style="padding: 12px 28px; text-align: left; ">
      <div style="color: #334155; font-size: 16px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5;">Esperamos que este e-mail lhe encontre bem!<br/><br/>Estou super ansioso para te conhecer e começar essa jornada com você! Porém, ao conferir a chamada, vi que ainda falta finalizar a entrega da sua documentação. Não queremos que você perca o início dessa nossa caminhada, certo?<br/><br/>Para garantir seu lugar na turma, é só seguir este passo a passo:</div>
    </div>
    <div style="padding: 12px 28px; text-align: left; ">
      <div style="color: #334155; font-size: 16px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5;">1- Acesse o portal do candidato -  <a href="https://candidatos.portal.estacio.br/acompanhe-sua-matricula" target="_blank" style="color: #4f46e5; text-decoration: underline;">Ir para o portal do candidato</a> <br/>2- Faça login com seu CPF e senha.<br/>3- Localize o campo 'Enviar Documentos' ou 'Pendências Documentais'.<br/>4-Tire uma foto clara ou digitalize os documentos solicitados e faça o envio pelo sistema.<br/><br/>Pronto! Assim que eu receber o aviso aqui, já poderei te dar as boas-vindas oficiais.<br/><br/>Estou te esperando ansiosamente para começarmos! Qualquer dúvida, é só chamar o consultor comercial abaixo para agilizar.</div>
    </div>
    <div style="padding: 20px 28px; text-align: center; ">
      <a href="{{var1}}" class="btn btn-auto" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; text-decoration: none; font-weight: bold;   border-radius: 8px; font-size: 16px; font-family: Helvetica, Arial, sans-serif;">Fale conosco</a>
    </div>
    <div style="padding: 12px 28px; text-align: left; ">
      <div style="color: #334155; font-size: 16px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5;">Atenciosamente,<br/>Equipe Comercial Estácio.</div>
    </div>
    <div style="padding: 12px 28px; text-align: left; ">
      <div style="color: #334155; font-size: 15px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.6;"><span style="font-size: 12px;"><i>Caso já esteja com a sua documentação completa, favor desconsiderar o email.</i></span></div>
    </div>
    <div style="background-color: #1e1b4b; padding: 20px 24px; border-top: 1px solid #f1f5f9;">
      <div style="color: #64748b; font-size: 16px; text-align: left; font-weight: normal; font-style: normal; text-decoration: none;  font-family: Helvetica, Arial, sans-serif; line-height: 1.5;">© 2026 Estácio. Todos os direitos reservados.</div>
    </div>
  </div>
</body>
</html>`,
  },
];
