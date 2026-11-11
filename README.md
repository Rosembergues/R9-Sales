# R9 Hub

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


## Comparador de Preços

Menu **Comparador de Preços** (todos veem; só admin importa e altera o limite de ofensa).

- **Antes de usar:** rodar `supabase/comparador-precos.sql` no SQL Editor do Supabase (cria `price_imports`, `price_courses`, `price_settings`).
- **Importação:** a planilha da Análise da Concorrência (aba com "NOME DO CURSO"). As fórmulas costumam vir sem valor salvo, então o sistema recalcula: preço por = preço de × (1 − bolsa); desconto de / % / para da concorrente a partir dos dois que estiverem preenchidos. `x` = concorrente não oferta.
- **Bolsa composta** (`65% 1ºS + 60% CT`): a comparação usa o preço do 1º semestre; o preço contínuo (CT) aparece abaixo.
- **Ofensa:** preço final da concorrente X% ou mais abaixo do nosso (padrão 8%, configurável na própria tela).
- **Histórico:** cada envio é guardado. A tela principal mostra a atualização com a data mais recente; reenviar na mesma semana substitui a anterior (que fica no histórico como "substituída"). Aba Histórico: foto de qualquer semana e evolução de um curso semana a semana.

## Controle de acesso

- **Antes de publicar:** rodar `supabase/acesso-autorizacao.sql` no SQL Editor do Supabase.
- **Cadastro** só com e-mail `@estacio.br` ou `@yduqs.com.br`. A tela avisa, e o banco recusa qualquer outro domínio (trigger em `auth.users`), mesmo se alguém chamar a API direto.
- **Autorização:** todo cadastro novo entra como `pending` e vê só a tela "Aguardando autorização". O admin autoriza ou recusa em Administração → Gerenciar Equipe. Também dá para bloquear e liberar de novo quem já tem acesso.
- **No banco:** uma política RLS *restritiva* em todas as tabelas do schema `public` exige usuário autorizado (`active`/`inactive`). Ela se soma às políticas existentes, então nenhuma regra antiga fica mais frouxa. Só um admin consegue mudar o `status` de um perfil.
- Perfis pendentes ou recusados não aparecem em rankings, metas, lançamento de venda nem no Planner.

## Planejamento: tarefas e execuções

- **Antes de publicar:** rodar `supabase/tarefas-modelo.sql` no SQL Editor (depois do `acesso-autorizacao.sql`).
- **Tarefa** (`tarefas_modelo`) é o cadastro: título, responsáveis, formulário e regra de repetição. **Execução** (`tarefas`) é cada dia em que a tarefa roda.
- O banco grava as execuções das próximas 8 semanas e renova esse prazo todo dia (pg_cron, com o app chamando `gerar_execucoes_tarefas` ao abrir o Planejamento como reserva).
- Editar a tarefa atualiza as execuções futuras pendentes. As concluídas ficam como histórico. Excluir uma execução não a recria, e mover uma execução de dia não a duplica.
- **Permissões:** todos criam tarefas, inclusive para colegas, com repetição e formulário. Só quem criou (ou um admin) altera, move ou exclui. Os responsáveis concluem, preenchem o formulário e comentam. As tarefas antigas, migradas, ficam com os admins.
- **Aba "Tarefas"** (Planejamento → Tarefas): rotina da semana (o que roda em cada dia), mensais, avulsas em aberto e uma lista com regra, responsáveis, próximas datas e conclusão das últimas 4 semanas.

## Metas por peso

- **Antes de publicar:** rodar `supabase/metas-pesos.sql` (cria `metas_pesos` e a coluna `goals.ajuste_manual`).
- Em Gerenciar Metas → **Pesos por BU**, cada consultor recebe um % por BU, e cada BU precisa somar 100%. Peso 0 = não recebe meta naquela BU.
- A meta oficial importada de cada semana e mês é distribuída pelos pesos, com arredondamento que mantém a soma igual à oficial, e gravada em `goals`. Início, Desempenho e Rankings continuam lendo de lá.
- **Quando recalcula:** ao abrir Gerenciar Metas, ao salvar os pesos e depois de cada importação de metas. Só a semana/mês atual e os futuros; períodos encerrados ficam congelados.
- **Ajuste manual:** editar o valor de uma pessoa e salvar marca o ajuste. O restante da BU vai para os outros pelos pesos. "Voltar ao peso" desfaz o ajuste.
- BU sem nenhum peso definido não é alterada (mantém o que estava gravado).

## Gerenciar Equipe

Rodar `supabase/equipe-protecoes.sql` no SQL Editor (pode rodar mais de uma vez).

- **Situações:** Ativo (acessa e entra no ranking), Fora do ranking (acessa, mas sai de Ranking, Desempenho e distribuição de metas), Bloqueado (sem acesso; histórico mantido) e Aguardando autorização.
- Ações por pessoa no menu ⋯: editar nome, tornar admin/consultor (com confirmação), tirar/voltar ao ranking, bloquear/autorizar de novo.
- Não há mais exclusão de usuário pela tela: excluir apagava o histórico de metas. Para quem saiu da equipe, use **Bloquear acesso**.
- Proteções no banco: só admin muda a função de alguém (antes o próprio usuário conseguia), ninguém bloqueia o próprio acesso e o último administrador não pode ser rebaixado, bloqueado nem excluído.
