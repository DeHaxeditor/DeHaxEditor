-- DEHAX V2.2.2 — checkout para novos usuários + vantagens editáveis dos planos
-- Execute uma vez no SQL Editor depois da migration V2.2.1.

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists checkout_sessions_user_idx on public.checkout_sessions(user_id,created_at desc);
create index if not exists checkout_sessions_expiry_idx on public.checkout_sessions(expires_at);
alter table public.checkout_sessions enable row level security;
-- Sem policy para anon/authenticated: somente o backend com service_role acessa esta tabela.
revoke all on table public.checkout_sessions from anon, authenticated;

insert into public.app_settings(key,value) values
  ('free_plan_benefits','["Conta na plataforma","Assets e aulas gratuitas","Visualização da biblioteca PRO"]'::jsonb),
  ('monthly_plan_benefits','["Toda a biblioteca de assets","Todos os tutoriais PRO","Novos conteúdos adicionados","Preview + download direto","Renovação mensal flexível"]'::jsonb),
  ('semester_plan_benefits','["Toda a biblioteca de assets","Todos os tutoriais PRO","Novos conteúdos adicionados","Preview + download direto","6 meses de acesso com maior economia"]'::jsonb)
on conflict(key) do nothing;
