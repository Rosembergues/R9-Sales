# R9Bot Mailer

Aplicação para criar, importar, editar, organizar e exportar e-mails usando blocos visuais.

## Telas
- **Início:** abre o editor, dá acesso à Biblioteca e mostra os três modelos públicos atualizados mais recentemente.
- **Editor:** blocos arrastáveis, edição de texto diretamente no e-mail, imagens, botões, desfazer/refazer, prévia responsiva, importação e exportação de HTML.
- **Biblioteca de modelos:** catálogo compartilhado de modelos públicos, com cópia independente para uso e permissões de edição por proprietário/administrador.

## Persistência online
- O **rascunho atual** é salvo automaticamente no Supabase após uma breve pausa na edição. Os rascunhos são privados para cada usuário autenticado.
- **Salvar template** publica o modelo na biblioteca compartilhada ou atualiza o modelo existente se o usuário for seu dono ou administrador.
- **Usar modelo** cria uma cópia independente; não altera o original.
- O histórico é registrado no banco quando um modelo é publicado ou seu conteúdo/metadados são alterados.
- O projeto não utiliza mais `localStorage` para armazenar templates ou rascunhos. A persistência local de sessão do Supabase permanece ativada para manter o login.

## Configuração do Supabase
1. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente do projeto.
2. Execute `supabase/migrations/202610160001_shared_mailer_library.sql` no SQL Editor do projeto Supabase ou aplique-o pelo fluxo de migrations adotado pela equipe.
3. Cadastre pelo menos um administrador, substituindo o e-mail na consulta abaixo por uma conta já registrada em Auth > Users:

```sql
insert into public.mailer_library_admins (user_id)
select id from auth.users where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
```

A tabela de administradores não permite que usuários autenticados adicionem a si mesmos. A promoção administrativa deve ser feita por alguém com acesso privilegiado ao banco.

### Regras implementadas
- Consultar e usar modelos públicos: todos os usuários autenticados.
- Criar/publicar modelos públicos: todos os usuários autenticados.
- Editar modelos: somente o dono ou um administrador.
- Excluir modelos: somente administradores.
- O administrador pode editar um modelo sem transferir a propriedade do criador original.
- Os rascunhos são privados e as permissões são aplicadas por RLS no Supabase, além dos controles de interface.

**Importante:** a migração do banco precisa ser aplicada no projeto Supabase real antes de testar os fluxos da biblioteca. Este pacote inclui a migração, mas não aplica alterações remotamente ao seu projeto.

## Importar HTML
A importação analisa o conteúdo antes de substituir o e-mail atual e mostra uma estimativa de palavras preservadas, imagens, links e blocos gerados. O conteúdo textual pode ser aproveitado mesmo quando colunas, bordas, espaçamentos e outros detalhes visuais precisam ser simplificados na conversão para blocos.

O importador (`src/utils/htmlParser.ts`) percorre o documento até as folhas de conteúdo, inclusive texto solto entre elementos, e só aplica heurísticas de classificação a contêineres pequenos:
- **Reconhece:** títulos e subtítulos (por tag ou tamanho de fonte), parágrafos com negrito, itálico, cores e links, listas, imagens com link, botões (inclusive o padrão de tabela "bulletproof"), banners coloridos com título, cupons (borda tracejada ou classe `cupom`/`coupon`), divisores, redes sociais (inclusive linhas só com ícones) e rodapés.
- **Estilos:** resolve CSS inline, atributos legados (`bgcolor`, `align`, `<font>`), regras de `<style>` com qualquer seletor (`.mcnTextContent p`, `#hero h1`, `td > a.btn`) respeitando a especificidade, herança e unidades (`px`, `pt`, `em`, `rem`, `%`). Media queries com condição (celular, modo escuro) e estados como `:hover` são ignorados.
- **Imagens de fundo:** um banner com foto de fundo (`background-image` ou atributo `background`) vira um bloco de imagem seguido do texto e do botão que ficavam sobre ela. Texturas de fundo da página inteira não são importadas, e a análise de importação as conta como imagens não reconhecidas.
- **Variáveis de outras plataformas:** nome e e-mail do Mailchimp (`*|FNAME|*`), Brevo/HubSpot/RD (`{{ contact.FIRSTNAME }}`), Salesforce (`%%first_name%%`), ActiveCampaign (`%FIRSTNAME%`) e Mautic viram `{{nome}}` e `{{email}}`. As que não têm equivalente (por exemplo `*|UNSUB|*`) aparecem como erro na revisão de exportação.
- **Descarta:** conteúdo oculto (preheaders com `display:none`), pixels de rastreamento, células espaçadoras e o fundo da página/cartão.
- **E-mails do próprio R9:** HTML gerado pelo editor (preview ou exportação) é reconstruído bloco a bloco, preservando IDs e propriedades.

Os testes em `tests/htmlParser.test.ts` documentam cada caso suportado.

## Segurança dos blocos
Blocos vindos do Supabase, de importações ou de rascunhos antigos passam por `normalizeBlocks` (`src/utils/blockNormalizer.ts`), que descarta chaves desconhecidas e restringe cores, alinhamentos, tamanhos e fontes a formatos seguros. O compilador também normaliza cada bloco antes de gerar HTML, então dados manipulados diretamente pela API não conseguem injetar atributos no preview.

Aplique também `supabase/migrations/202611130001_validate_mailer_blocks.sql`, que rejeita payloads de blocos malformados (não-array ou grandes demais) em novas gravações, sem alterar as linhas existentes.

## Recursos de edição

- **Assunto e texto de pré-visualização (preheader):** com nenhum bloco selecionado, o painel da direita mostra o assunto e o preheader. O preheader é exportado como texto oculto no topo do e-mail e é lido de volta ao importar um HTML.
- **Revisão antes de exportar** (`src/utils/emailChecklist.ts`): a janela de exportação abre numa lista de problemas que chegariam ao destinatário. A lista cobre e-mail sem assunto ou preheader, botões sem link ou com link de exemplo, imagens sem hospedagem ou sem descrição, variáveis desconhecidas (`{{empresa}}`), texto com pouco contraste, falta de rodapé e HTML acima de 102 KB (o Gmail corta). Clicar em "Corrigir" seleciona o bloco com problema.
- **Colunas:** bloco com 2 ou 3 itens lado a lado (imagem, texto e botão por coluna). No celular as colunas ficam empilhadas. O importador reconhece grades de produtos (linhas de tabela com 2–3 células que tenham imagem ou botão).
- **Kit da marca:** cores de cabeçalho, botões, títulos e textos, fonte, logo, site, redes e rodapé padrão. Os blocos novos já nascem com o kit, e "Salvar e aplicar neste e-mail" recolore o e-mail atual (dá para desfazer com Ctrl+Z). Fica no menu Biblioteca e no painel de configurações do e-mail.
- **Meus blocos:** o ícone de marcador no painel de um bloco salva esse bloco para reutilizar. Os blocos salvos aparecem no topo de "Adicionar bloco".
- **Modo escuro na visualização:** a visualização em tela cheia simula como Gmail e Outlook escurecem o e-mail (fundos claros ficam escuros, textos escuros ficam claros, imagens não mudam).

O kit da marca e Meus blocos são **por usuário** e precisam da migração `supabase/migrations/202611130002_brand_kit_and_saved_blocks.sql`. Sem ela, o editor continua funcionando com o kit padrão e mostra um aviso.

## Qualidade do HTML exportado

- **Outlook para Windows:** os botões são exportados também em VML (`v:roundrect`), então aparecem com cantos arredondados e área de clique correta no Outlook, que ignora padding e border-radius em links.
- **Texto puro:** a aba "Texto puro" da exportação gera a versão `text/plain` do e-mail, com os links por extenso. Cole-a no disparador se ele tiver esse campo.
- **Imagens otimizadas no envio:** as imagens são redimensionadas para no máximo 1200 px. Fotos e imagens sem transparência viram JPEG comprimido até cerca de 300 KB (WEBP também é convertido, porque o Outlook não o exibe). Imagens com transparência continuam PNG, e GIFs animados não são alterados. Arquivos de até 15 MB são aceitos, porque são comprimidos antes do limite de 5 MB do upload.

## Rodar localmente
1. `npm install`
2. Configure as variáveis de ambiente do Supabase e do Firebase se for usar upload de imagens.
3. `npm run dev`

## Verificar
- `npm run lint`
- `npm test`
- `npm run build`

### Publicação na biblioteca compartilhada

Ao clicar em **Salvar template** (ou usar `Ctrl+S` no editor), o sistema abre um formulário próprio para o nome e a descrição do modelo. Para uma nova publicação, esses campos começam vazios e são obrigatórios; o assunto/título do e-mail não é utilizado como nome automaticamente. Ao editar um modelo já publicado, o formulário recupera o nome e a descrição registrados na biblioteca.

### Diagnóstico de falha ao publicar

A publicação do modelo é executada antes da gravação do rascunho privado, então uma falha isolada no autosave não impede a publicação. Se a publicação em si falhar, a janela exibe a mensagem devolvida pela operação em vez de ocultá-la com um aviso genérico. Se apenas o rascunho falhar, o sistema informa que o modelo foi publicado e que o rascunho precisa de atenção. O diagnóstico somente leitura do banco está em `supabase/diagnostics/check-mailer-library.sql`; execute-o no SQL Editor para conferir todas as colunas usadas pelo código, políticas, funções e RLS. Se houver colunas ausentes em tabelas que já existiam antes da migração, execute `supabase/diagnostics/repair-mailer-library-columns.sql`: ele apenas adiciona colunas ausentes, preenche metadados disponíveis e solicita a atualização do cache de schema do PostgREST, sem apagar registros.

## Recuperação de senha
- A tela de login envia o e-mail de recuperação pelo Supabase Auth.
- O link retorna para `/?auth=password-reset`, onde o usuário define e confirma a nova senha.
- Configure a **Site URL**, as **Redirect URLs** e o template de e-mail de recuperação no painel do Supabase. O passo a passo está em [`SUPABASE_AUTH_SETUP.md`](./SUPABASE_AUTH_SETUP.md).
- Não é necessária uma migração SQL para este recurso. Use o arquivo `.env.example` como referência das variáveis de ambiente; não coloque a chave `service_role` no frontend.

## Encerrar sessão
- O botão **Sair** fica disponível na navegação principal e também na barra superior do editor.
- Ao sair pelo editor, o R9Bot tenta salvar o rascunho atual na nuvem antes de encerrar a sessão; se o salvamento falhar, informa o problema e mantém o usuário no editor.
- O encerramento da sessão é feito por `supabase.auth.signOut()`. O usuário retorna à tela de autenticação.

## Aviso diário de novidades

O aviso aparece também na tela de login, antes de a pessoa entrar, e continua disponível após a autenticação. Ele explica o login por e-mail, a Biblioteca compartilhada e deixa claro que qualquer funcionário pode criar a própria conta pelo botão **Criar conta**. O aviso pode ser fechado pelo botão `X` ou por `Entendi, continuar` e volta a aparecer no próximo dia. Como ele também aparece antes do login, o aplicativo guarda somente a data em que foi fechado em uma chave local do navegador; essa marcação evita que o aviso reapareça imediatamente após a pessoa entrar. Modelos e rascunhos não são armazenados nessa chave.


## Modelos recentes na página inicial
A seção de modelos do Início é carregada da Biblioteca compartilhada no Supabase e mostra até três modelos públicos ordenados pela atualização mais recente. O botão **Usar modelo** abre uma cópia independente no editor, sem alterar o modelo original. Se ainda não houver modelos publicados, ou se a conexão falhar, a página mostra uma mensagem de estado vazio/erro e oferece acesso à Biblioteca ou nova tentativa; as imagens locais dos modelos antigos não são mais usadas nessa seção.

## Biblioteca como página completa

A navegação principal agora abre uma página dedicada da Biblioteca. A janela compacta de seleção continua disponível dentro do editor para que seja possível escolher um modelo sem sair do fluxo de edição.

A página completa inclui busca por nome, descrição ou assunto; filtros para todos os modelos públicos e modelos criados pelo usuário; detalhes e histórico de versões; uso de uma cópia independente; edição permitida somente ao dono ou administrador; exclusão somente por administradores; restauração de versões anteriores para dono/admin; e estados de carregamento, erro e biblioteca vazia.

### Prévia compacta dos modelos da biblioteca

A página da Biblioteca mostra uma miniatura visual baseada nos blocos reais do modelo, tanto nos cartões da lista quanto no painel de detalhes. A prévia é renderizada com componentes React leves (sem criar um iframe ou fazer uma nova consulta ao Supabase por cartão), mostra apenas os primeiros blocos para manter a interface rápida e carrega imagens com `loading="lazy"`.
