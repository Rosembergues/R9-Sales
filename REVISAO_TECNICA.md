# R9 Sales — revisão funcional e técnica

**Data:** 09/10/2026  
**Escopo:** código-fonte enviado em `r9-sales (10).zip`; foram priorizados riscos de dados, autorização, sincronização e robustez. A revisão não acessou nem alterou o projeto remoto do Supabase.

## Correções aplicadas

1. **IDs de vendas e campanhas:** os IDs usavam apenas os últimos seis dígitos do timestamp, que se repetem a cada 16 minutos e 40 segundos. Agora usam UUID quando suportado, com fallback aleatório.
2. **Autorização no fallback de login:** quando a consulta a `profiles` falhava, o sistema aproveitava `user_metadata.role` para montar o perfil local. Como esses metadados são controláveis no fluxo público de cadastro, isso poderia exibir privilégios administrativos indevidos. O fallback agora assume sempre `seller`; o cadastro não envia mais um cargo definido pelo cliente.
3. **Política SQL de alteração de cargo:** a configuração do banco incluía uma política de atualização do próprio perfil sem impedir mudança de `role`. Foi adicionado um trigger que restringe mudanças de cargo a administradores.
4. **Autoria das vendas:** a política SQL de inserção aceitava qualquer venda de qualquer usuário autenticado. Agora restringe inserção ao próprio responsável ou a administradores, e o trigger valida os campos de autoria também em `custom_data`.
5. **Dados pessoais nos logs:** `logSupabaseError` imprimia o payload completo de escrita, incluindo nome, documento, telefone e e-mail de candidatos. Agora informa somente os nomes dos campos do payload.
6. **Listener do planejador:** o canal Broadcast agora é compartilhado e cada tela registra/remove seu callback; isso evita handlers presos ou duplicados após desmontagem e navegação.
7. **Acesso ao armazenamento local:** a leitura de `localStorage` usada pelo timeout de inatividade agora tolera contextos em que o navegador bloqueia o armazenamento.
8. **Filtro de busca da página de vendas:** caracteres especiais de sintaxe de filtros PostgREST também são neutralizados para reduzir falhas em buscas com parênteses ou barras invertidas.
9. **IDs de campos de campanha:** a criação de campos dinâmicos também deixou de depender de um sufixo de timestamp curto.

## Validações executadas

- **Imports relativos:** 155 caminhos conferidos; nenhum caminho local ausente.
- **Sintaxe TypeScript/TSX:** 52 arquivos analisados; zero erros de parsing.
- **Build / verificação de tipos completa:** não concluídos. O ambiente não tinha as dependências npm instaladas e `npm install --no-audit --no-fund` excedeu o limite de execução. A saída de `tsc` ficou dominada por módulos ausentes e erros JSX derivados da ausência dos tipos React; não é correto afirmar que o build passou.
- **Testes de navegador e integração real:** não executados, porque não havia dependências disponíveis nem sessão/teste autorizado contra o Supabase do usuário.

## Ação necessária no Supabase

As mudanças de interface e TypeScript já estão no código, mas **políticas e triggers SQL não são aplicadas remotamente pela entrega do ZIP**. Execute `SUPABASE_REVISAO_SEGURANCA.sql` no SQL Editor do projeto Supabase usado pela aplicação. Antes de executar em produção, confira se há políticas RLS antigas adicionais nas tabelas `sales` e `profiles`: políticas permissivas extras podem continuar autorizando operações, pois o PostgreSQL combina políticas permissivas com `OR`.

O SQL de configuração exibido pelo próprio modal (`SUPABASE_SQL_SCHEMA`) também foi atualizado para novas instalações.

## Pontos ainda pendentes de validação funcional

- Executar `npm install` e `npm run build` em um ambiente com acesso ao registry npm.
- Testar login, cadastro, alteração de cargo por administrador, tentativa de autoelevação por usuário comum, lançamento/edição de venda, sincronização offline e realtime com a política SQL aplicada.
- Confirmar a lista de políticas RLS atualmente implantadas no Supabase, pois o código local não permite inferir quais políticas históricas existem no projeto remoto.
- Mudança de URL/chave do Supabase em tempo de execução merece teste específico de canais Realtime; a revisão não alterou o fluxo de troca de projeto para evitar reinicialização automática sem teste de interface.

### Ajuste complementar após validação no Supabase

Após a confirmação de funcionamento do SQL de permissões, a revisão encontrou comparações antigas `profiles.id = auth.uid()` ainda presentes no SQL de configuração embutido no site e no arquivo SQL distribuído no pacote. Ambas as fontes foram alinhadas para comparar `id::text = auth.uid()::text`, evitando que uma futura configuração reproduza o erro `operator does not exist: text = uuid`. Essa mudança não altera os dados nem o schema da tabela.

### Validação final pendente

O ZIP passou pela validação de integridade e pelas verificações estáticas de sintaxe/imports relatadas. A compilação Vite completa continua pendente porque a instalação de dependências excedeu o tempo limite deste ambiente; os fluxos conectados ao Supabase também precisam ser exercitados no navegador.

## Ajuste de interface — remoção da barra superior

Após a revisão técnica, a navegação foi simplificada conforme a solicitação:

- Removida a barra fixa superior, incluindo a data e os controles globais que ocupavam espaço no conteúdo.
- Transferida a alternância de visualização **Admin/Membro** para o rodapé fixo do menu lateral, mantendo-a visível somente para contas com papel real de administrador.
- Transferido o botão **Sair da conta** para o mesmo rodapé lateral.
- Mantido o recolhimento/expansão do menu; no modo recolhido há um botão visível para expandi-lo novamente.
- Separadas as áreas de navegação rolável e controles fixos, de modo que os controles de conta permaneçam no fim do menu.
- Ajustada a altura do layout para ocupar a janela sem a faixa superior; a rolagem principal fica no conteúdo, sem adicionar cabeçalho fixo.

**Validação específica desta mudança:** o transpile sintático do TypeScript foi executado nos 51 arquivos `.ts`/`.tsx` (excluindo declarações `.d.ts`) e terminou com zero erros de sintaxe. Foram conferidos também os IDs e a presença dos controles de troca de perfil, sair e recolher/expandir. O build Vite e o teste visual no navegador continuam pendentes até a instalação das dependências.

## Ajuste visual do menu lateral recolhido

- O botão **Lançar Venda** passa a exibir somente o ícone no modo recolhido, com tamanho fixo e tooltip acessível.
- A navegação **Início** também oculta o rótulo e centraliza o ícone nesse modo.
- A área rolável do menu agora bloqueia overflow horizontal, evitando a barra de rolagem horizontal que aparecia no modo recolhido.
- O controle foi validado por transpilation sintática de `R9Dashboard.tsx`. O build Vite completo continua dependendo da instalação das dependências do projeto.


## Ajuste do ranking por operação

- O ranking semanal e mensal agora inicia em **Graduação Total**, somando vendas e metas da BU Presencial + BU Digital.
- Foram adicionadas visões independentes para BU Presencial, BU Digital, Pós-Graduação e Curso Técnico.
- A classificação, o pódio, os indicadores coletivos e o atingimento individual utilizam somente a operação selecionada.
- O filtro de modalidade passa a mostrar apenas modalidades existentes na operação selecionada e é limpo ao trocar de operação.
- A classificação de vendas verifica o produto antes da unidade de negócio para impedir que Pós Digital seja contabilizada como Graduação Digital.
- Pós Presencial e Pós Digital permanecem reunidos no ranking de Pós-Graduação porque o modelo atual de metas contém somente `target_pos`, sem metas separadas para esses dois segmentos. Separá-los exigiria uma alteração deliberada no modelo de dados e na tela de configuração de metas.
- Validações realizadas nesta alteração: transpilation/sintaxe TypeScript/TSX dos quatro arquivos alterados e testes unitários diretos para classificação por operação e cálculo das metas. O build Vite completo não foi executado porque as dependências do projeto não estão instaladas no ambiente de trabalho.


## Ranking consolidado — Todos os Produtos

- Adicionada a sexta opção **Todos os Produtos** ao seletor do ranking semanal e mensal.
- Essa visão considera todas as vendas do período selecionado, incluindo Graduação, Pós-Graduação e Curso Técnico, sem alterar as classificações específicas já existentes.
- O atingimento individual e coletivo utiliza `target_total`, que é mantido pela configuração de metas como a soma das metas por BU, Pós e Técnico; quando esse total não está disponível, o helper usa as metas por categoria como fallback.
- A troca de operação limpa o filtro de modalidade, evitando que uma modalidade selecionada em outra visão restrinja inadvertidamente o consolidado.
- O seletor foi reorganizado para apresentar seis opções em duas linhas de três cartões em telas largas.
- **Validação desta alteração:** sintaxe TypeScript/TSX dos 54 arquivos verificada sem erros; testes diretos da lógica passaram para a inclusão de todos os produtos, manutenção dos filtros de Graduação e metas das seis visões. O build Vite completo segue pendente por ausência das dependências npm no ambiente.
