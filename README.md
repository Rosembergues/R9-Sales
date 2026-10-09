# R9 Sales

## Baseline
Esta versão parte da baseline aprovada e inclui o primeiro rascunho da **Importação de Metas**.

### Importação de Metas
A tela administrativa possui cinco destinos explícitos:
- Graduação — BU Presencial (Presencial + Semipresencial + Ao Vivo)
- Graduação — BU Digital (EAD + Flex)
- Pós-Graduação — Pós Presencial (Presencial + Ao Vivo)
- Pós-Graduação — Pós Digital
- Curso Técnico — Técnico Presencial

O usuário escolhe manualmente qual arquivo pertence a cada grupo. O sistema não tenta adivinhar o grupo.

A primeira versão aceita `.xlsx` e `.csv`, identifica Data, AA/AA Dinâmico/Anterior, Meta e Realizado, mostra uma prévia e salva a prévia localmente no navegador para teste. A persistência definitiva no Supabase será definida depois que o fluxo for validado.


## Fase — Conexão da Importação com Configuração de Metas

A página de Configuração de Metas agora lê os arquivos importados na página de Importação de Metas e exibe os dados como apoio operacional, sem alterar automaticamente as metas dos consultores.

Para o período selecionado, são calculados a partir das linhas importadas: AA acumulado, Meta oficial, Realizado, Atingimento e Gap, além do detalhamento por grupo de importação.

Nesta fase os dados continuam no armazenamento local do navegador. A persistência definitiva dos arquivos e dados importados no Supabase será feita depois que o fluxo e os cálculos forem validados.
