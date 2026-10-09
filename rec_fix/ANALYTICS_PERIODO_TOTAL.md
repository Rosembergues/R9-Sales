# Ajuste do Analytics — intervalo total importado

- Ao carregar um ciclo acadêmico, o Analytics identifica a menor e a maior data entre os dados dos arquivos ativos daquele ciclo.
- Esses limites passam a ser o intervalo padrão dos filtros de data.
- O intervalo é calculado considerando todos os modelos importados, mesmo quando um filtro de BU está selecionado, para manter a janela de análise consistente entre os filtros.
- Os campos de data continuam editáveis para análises de intervalos específicos.
- Se o ciclo não tiver importações ativas, o filtro volta ao mês corrente.

Validação de build: `npm run lint` não pôde ser concluído por ausência das dependências instaladas (`react`, `vite` e demais pacotes). Não foi possível validar o build neste ambiente.
