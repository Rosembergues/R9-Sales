<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/99b38acd-70b5-4d59-9a20-70329071c0c3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Fase 1 — Fundação (02/10/2026)

- Supabase tratado como fonte oficial quando disponível; LocalStorage fica como cache/fallback offline.
- Vendas criadas sem confirmação do Supabase entram em uma fila local temporária para sincronização posterior.
- RLS de `profiles` não permite mais INSERT público; criação normal ocorre pelo trigger `handle_new_user` em `SECURITY DEFINER`.
- Adicionados índices para data, criação, vendedor, campanha, status, produto e FDI.
- A tabela de vendas passou a renderizar no máximo 50 linhas por página, mantendo filtros/ordenação/exportação sobre o conjunto filtrado.

**Importante:** execute o SQL atualizado exibido pelo `SupabaseSetupModal` no SQL Editor do seu projeto Supabase para aplicar as alterações de RLS e índices.
