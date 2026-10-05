# R9 Sales

Aplicação web interna para gestão de vendas, metas e desempenho da operação R9.

## Stack

- React + TypeScript
- Vite
- Supabase Auth / Database / Realtime
- Tailwind CSS
- Lucide React
- React Hook Form

## Desenvolvimento

```bash
npm install
npm run dev
```

## Validação

```bash
npm run lint
npm run build
```

O Supabase é a fonte oficial dos dados quando disponível. O LocalStorage é usado apenas como cache/fila offline para vendas ainda não confirmadas.

### Banco de dados

O SQL atualizado para criação/migração do banco está disponível em `src/lib/supabase.ts` e pode ser executado pelo SQL Editor do Supabase. A migração também normaliza `sale_date` de registros históricos que ainda guardam a data real apenas em `custom_data`.

## Estrutura principal

- `src/components/dashboard/R9Dashboard.tsx` — shell e navegação principal
- `src/components/dashboard/HomeDashboard.tsx` — início
- `src/components/dashboard/SalesSpreadsheetTable.tsx` — vendas/paginação/filtros
- `src/components/seller/PerformanceDashboard.tsx` — desempenho operacional
- `src/components/seller/WeeklyRankView.tsx` / `MonthlyRankView.tsx` — rankings
- `src/context/AuthContext.tsx` — autenticação e perfis
- `src/context/SalesContext.tsx` — estado e operações de vendas
- `src/lib/salesMapper.ts` — normalização e payloads
- `src/lib/supabase.ts` — cliente, cache local e SQL de referência

## Segurança

O cadastro público sempre cria usuários como `seller`. Alterações de papel devem ocorrer por administradores autenticados. Operações que exigem privilégios de administração do Supabase Auth, como criar/excluir usuários de autenticação, não devem usar uma `service_role` no navegador; devem ser implementadas por uma Edge Function ou backend seguro.
