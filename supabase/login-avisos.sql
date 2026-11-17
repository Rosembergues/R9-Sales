-- =====================================================================
-- R9 Hub · Avisos do login
--   Permite à tela de login diferenciar "E-mail não encontrado" de "Senha incorreta".
--   (O Supabase responde "Invalid login credentials" nos dois casos.)
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- Sem esta função o login continua funcionando, só mostra o aviso genérico
-- "E-mail ou senha incorretos".
--
-- Observação de segurança: a função revela se um e-mail tem conta. Ela só
-- responde para e-mails dos domínios corporativos aceitos no cadastro.
-- =====================================================================

create or replace function public.email_cadastrado(p_email text)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select case
    when split_part(lower(trim(p_email)), '@', 2) not in ('estacio.br', 'yduqs.com.br') then null
    else exists (select 1 from auth.users where lower(email) = lower(trim(p_email)))
  end;
$$;

revoke all on function public.email_cadastrado(text) from public;
grant execute on function public.email_cadastrado(text) to anon, authenticated;
