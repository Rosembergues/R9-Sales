# R9 Hub

Central da operação comercial do R9: lançamento e consulta de vendas, metas (importadas do Power BI e distribuídas por peso), desempenho e ranking da equipe, planejamento de tarefas, repositório de mensagens e comparador de preços da concorrência.

Feito com **React 19 + Vite + TypeScript + Tailwind CSS 4**, com banco, login e tempo real no **Supabase**. Publicado na **Vercel**.

## Rodar na sua máquina

Precisa do Node.js 20 ou mais novo.

```bash
npm install
npm run dev        # abre em http://localhost:3000
```

Sem configuração, o app usa o projeto Supabase oficial. Para usar outro banco (por exemplo, um de testes), copie `.env.example` para `.env.local` e preencha.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Gera o site final em `dist/`. |
| `npm run typecheck` | Confere os tipos (TypeScript em modo rígido). |
| `npm test` | Roda os testes automáticos (`src/**/*.test.ts`). |
| `npm run check` | Tipos + testes. Rode antes de publicar. |

## Publicar

A Vercel publica a partir desta pasta: ela instala as dependências com o `bun.lock` e roda `vite build`. O `vercel.json` faz toda rota cair no `index.html`.

Mudanças no banco **não** vão junto: rode o SQL novo no Supabase antes de publicar a versão que depende dele (veja [supabase/README.md](supabase/README.md)).

### Configuração de login no Supabase

Em **Authentication → URL Configuration**:

- **Site URL:** o endereço do site publicado (ex.: `https://seu-dominio.com`).
- **Redirect URLs:** inclua `https://seu-dominio.com/redefinir-senha` (e `http://localhost:3000/redefinir-senha` para testar na sua máquina).

Se o domínio mudar, atualize os dois. Sem a página na lista de Redirect URLs, o link do e-mail de senha cai na página inicial (o site ainda reconhece e abre a tela de senha nova, mas o certo é cadastrar).

O texto do e-mail fica em **Authentication → Email Templates → Reset Password** (pode traduzir; mantenha o `{{ .ConfirmationURL }}`).

## Organização do código

```
src/
  main.tsx, App.tsx        entrada; login → aguardando autorização → painel
  context/                 AuthContext (sessão, perfis, autorização) e SalesContext (vendas)
  components/
    dashboard/             R9Dashboard (menu e abas) e Início
    sales/                 planilha de Vendas, Fechamento Diário, lançar/editar venda
    performance/           Desempenho e Analytics
    ranking/               Ranking semanal/mensal
    admin/                 Gerenciar Equipe, Gerenciar Metas (goalManagement/), Importar Metas (goalImport/)
    prices/                Comparador de Preços
    messages/              Repositório de Mensagens
    auth/                  login, cadastro, aguardando autorização
    common/                peças usadas em várias telas (tela de erro)
  planner/                 Planejamento (calendário, rotina da semana, balanço, tags)
    components/planner/    dados (usePlannerData), ações (usePlannerActions) e blocos da tela
    components/taskDetail/ janela de uma tarefa: estado, visão do consultor e do admin
    services/              leitura/gravação de tarefas, cadastros, tags e equipe
  lib/                     regras sem tela (testáveis):
    supabase.ts            conexão única com o banco
    localCache.ts          o que fica guardado no navegador (fila offline, perfis, metas)
    dates.ts               datas no fuso local
    saleOptions.ts         produtos, modalidades, turnos, FDI e campos obrigatórios da venda
    saleStyles.ts          cores das FDI
    salesQuery.ts          filtros da planilha de Vendas aplicados no banco
    salesMapper.ts         linha do banco ⇄ venda do app
    saleValidation.ts      oportunidade duplicada, data da venda
    goalImport*.ts         leitura e gravação das metas do Power BI
    goalWeights.ts         distribuição das metas por peso
    goalProgress.ts, performance.ts, saleCycle.ts   cálculos de metas, desempenho e ciclo
    priceComparison*.ts    leitura e comparação da planilha da concorrência
    errors.ts              texto de erro
    dbTypes.ts             formato das linhas lidas do banco (tarefas, metas, comparador...)
supabase/                  scripts do banco e a ordem de execução
scripts/run-tests.mjs      executor dos testes (usa o esbuild que já vem com o Vite)
```

### Convenções

- **Datas:** use `lib/dates.ts`. Nunca `toISOString().slice(0, 10)` para "hoje": em Brasília, depois das 21h já é o dia seguinte em UTC. Para comparar dias, compare textos `aaaa-mm-dd`.
- **Opções de venda** (modalidade, turno, FDI) só em `lib/saleOptions.ts`; cores só em `lib/saleStyles.ts`.
- **Erros:** `catch (err)` + `errorText(err, 'mensagem padrão')`.
- **Sem `any`:** dado vindo do banco recebe o tipo de `lib/dbTypes.ts` no ponto em que chega (`data as GoalDailyRow[]`).
- **Telas grandes** seguem o mesmo desenho: um hook com o estado e as ações (`useX`) e blocos da tela que recebem `st` (o resultado do hook).
- **Banco:** toda regra de segurança fica no Supabase (RLS e gatilhos). A tela só esconde botões; quem bloqueia é o banco.
- **Telas grandes** são carregadas sob demanda (`lazy` no `R9Dashboard`) e cada aba fica dentro de uma tela de erro.
- Comentários e textos em português.

## Funcionalidades

### Vendas & Operação
- **Venda sempre completa:** o formulário começa sem nada marcado (produto, FDI, modalidade, turno, parcela leve e bolsa). O turno é marcado sozinho quando só existe uma opção (EAD, Flex e Pós Digital são "Virtual"). O banco recusa venda nova incompleta.
- **Vendas:** filtros de período, consultor, produto, modalidade, FDI, turno e "Só as minhas" valem para todas as vendas. Exportar leva tudo o que foi filtrado. Venda nova aparece sem recarregar. Vendas antigas sem algum campo aparecem como "Falta preencher" e o filtro **Cadastros incompletos** lista essas vendas.
- **Fechamento Diário:** totais do dia por modalidade, FDI e consultor; "Copiar Fechamento" gera o texto para o WhatsApp.
- Uma oportunidade só pode ser lançada uma vez. Consultor pode lançar para colega; só o dono da venda ou um admin edita.

### Metas
- **Importar Metas:** os relatórios do Power BI (.xlsx/.csv) são arrastados de uma vez. Modalidade, período acadêmico e campus vêm do texto "Filtros aplicados" (célula A1). Há conferência "antes × depois" e alertas antes de gravar. A importação nova é gravada como rascunho e só substitui a anterior quando termina, então uma falha nunca apaga a vigente.
- **Metas por peso:** em Gerenciar Metas → Pesos por BU, cada consultor tem um % por BU (cada BU soma 100%; peso 0 = sem meta). A meta oficial de cada semana/mês é dividida pelos pesos com arredondamento que mantém a soma. Recalcula ao abrir a tela, ao salvar os pesos e após cada importação, só da semana/mês atual em diante. Editar o valor de alguém marca ajuste manual ("voltar ao peso" desfaz).
- Semanas são de segunda a domingo, cortadas no mês.

### Equipe e acesso
- Cadastro só com `@estacio.br` ou `@yduqs.com.br`; todo cadastro novo espera autorização de um admin.
- **Gerenciar Equipe:** Ativo, Fora do ranking (acessa, mas sai de ranking, desempenho e metas), Bloqueado (histórico mantido) e Aguardando autorização. Menu ⋯ por pessoa: editar nome, tornar admin/consultor, tirar/voltar ao ranking, bloquear/autorizar.
- No banco: só admin muda função ou acesso, ninguém bloqueia a si mesmo e o último admin não pode ser removido.
- **Esqueci minha senha** (no login): manda um link para o e-mail. O link abre `/redefinir-senha`, onde a pessoa cria a senha nova (mínimo 8 caracteres, com letras e números). Link expirado ou já usado mostra o aviso e deixa pedir outro. A resposta ao pedir o link é sempre a mesma, para não revelar quem tem cadastro.

### Planejamento
- **Tarefa** (cadastro, `tarefas_modelo`) × **execução** (`tarefas`, cada dia em que roda). O banco grava as execuções das próximas 8 semanas e renova todo dia.
- Todos criam tarefas (inclusive para colegas), com repetição e formulário; só quem criou ou um admin altera. Os responsáveis concluem e preenchem o formulário.
- Menu: Calendário (com a Fila de tarefas sem data), Minhas tarefas, Rotina da semana, Balanço da semana e Tags (admin).

### Comparador de Preços
- Importa a planilha da Análise da Concorrência (aba com "NOME DO CURSO"), recalculando as fórmulas que vêm sem valor. Bolsa composta (`65% 1ºS + 60% CT`) compara pelo 1º semestre.
- **Ofensa:** concorrente X% ou mais abaixo do nosso preço (padrão 8%, ajustável). Cada envio fica no histórico; reenviar na mesma semana substitui.
- Todos veem; só admin importa e muda o limite.
