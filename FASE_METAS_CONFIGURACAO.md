# Fase — Configuração de Metas (primeiro esboço)

Esta versão introduz o primeiro esboço da nova página de Configuração de Metas.

## Incluído
- Meta mensal configurada por período.
- Meta semanal com início, fim, meta e gap.
- Distribuição de metas por consultor e produto.
- Busca de consultor.
- Painel auxiliar indicando que AA/Meta/Realizado importados serão conectados ao Analytics.
- Separação explícita entre dados importados e decisão operacional de metas.

## Observação importante
Nesta primeira versão, os campos de configuração da equipe (meta mensal, meta semanal, gap e período acadêmico) ficam salvos localmente no navegador para permitir validação do fluxo e do layout sem criar uma nova tabela no Supabase antes da aprovação do modelo.

As metas individuais continuam usando a tabela `goals` existente.

## Fase seguinte — Importação de Metas (rascunho)

Adicionada a página administrativa `Importação de Metas` com cinco destinos explícitos:
- Graduação / BU Presencial
- Graduação / BU Digital
- Pós / Pós Presencial
- Pós / Pós Digital
- Curso Técnico

A página aceita `.xlsx` e `.csv`, identifica Data / AA (ou AA Dinâmico / Anterior) / Meta / Realizado, mostra prévia e mantém os arquivos carregados localmente para teste. A gravação definitiva no Supabase ainda não foi implementada nesta etapa.
