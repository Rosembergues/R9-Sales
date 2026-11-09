# R9 Sales

## Baseline
Esta versão parte da baseline aprovada e inclui o primeiro rascunho da **Importação de Metas**.

### Importação de Metas
A tela administrativa tem um destino por modalidade (9 no total):
- BU Presencial: Presencial, Semipresencial, Ao Vivo
- BU Digital: EAD, Flex
- Pós-Graduação: Presencial, Ao Vivo, Digital
- Curso Técnico: Presencial

Os relatórios do Power BI (.xlsx/.csv) podem ser arrastados todos de uma vez. A modalidade, o período acadêmico e o campus são lidos do texto "Filtros aplicados" da célula A1; o cabeçalho aceito é Data / ANTERIOR (ou AA Dinamico) / META / REALIZADO. Antes de gravar há uma conferência com o "antes x depois" de cada modalidade e alertas (campus diferente, arquivo sem meta, período divergente). Arquivos sem dados são aceitos e registrados como "sem meta".

A gravação no Supabase (`goal_imports` + `goal_daily_data`) cria a importação nova como `cancelled` (rascunho invisível; o banco só aceita active/replaced/cancelled), insere os dias, ativa e só então arquiva a anterior, então uma falha no meio nunca apaga a importação vigente. As telas usam sempre a importação ativa mais recente de cada (período, modalidade).

## Fase — Conexão da Importação com Configuração de Metas

A página de Configuração de Metas agora lê os arquivos importados na página de Importação de Metas e exibe os dados como apoio operacional, sem alterar automaticamente as metas dos consultores.

Para o período selecionado, são calculados a partir das linhas importadas: AA acumulado, Meta oficial, Realizado, Atingimento e Gap, além do detalhamento por grupo de importação.

