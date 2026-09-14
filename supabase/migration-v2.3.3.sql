-- DEHAX V2.3.3 — retenção, suporte, reembolso e ID público de compra.
-- Execute UMA VEZ depois da migration-v2.3.1.sql.

create extension if not exists pgcrypto;

create or replace function public.dehax_purchase_code()
returns text
language sql
volatile
set search_path=public
as $$
  select 'DHX-' || to_char(clock_timestamp(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
$$;

alter table public.payment_orders add column if not exists purchase_code text;
alter table public.payment_orders add column if not exists confirmation_email_sent_at timestamptz;
update public.payment_orders set purchase_code=public.dehax_purchase_code() where purchase_code is null or btrim(purchase_code)='';
alter table public.payment_orders alter column purchase_code set default public.dehax_purchase_code();
alter table public.payment_orders alter column purchase_code set not null;
create unique index if not exists payment_orders_purchase_code_uidx on public.payment_orders(purchase_code);

create table if not exists public.subscription_exit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id text,
  plan_code text not null check(plan_code in ('monthly','semester')),
  reason text not null,
  decision text not null check(decision in ('kept_with_offer','canceled','will_not_renew')),
  created_at timestamptz not null default now()
);
create index if not exists subscription_exit_feedback_user_idx on public.subscription_exit_feedback(user_id,created_at desc);

create table if not exists public.retention_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id text,
  plan_code text not null check(plan_code in ('monthly','semester')),
  discount_percent numeric(5,2) not null default 10,
  original_amount numeric(12,2),
  discounted_amount numeric(12,2),
  cycles_total integer,
  cycles_used integer not null default 0,
  status text not null default 'active' check(status in ('active','completed','canceled','redeemed','expired')),
  activated_at timestamptz not null default now(),
  completed_at timestamptz,
  redeemed_order_id uuid references public.payment_orders(id) on delete set null,
  provider_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists retention_offers_user_idx on public.retention_offers(user_id,created_at desc);
create index if not exists retention_offers_active_idx on public.retention_offers(status,plan_code) where status='active';
create unique index if not exists retention_offers_one_active_uidx on public.retention_offers(user_id,plan_code) where status='active';

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_order_id uuid not null references public.payment_orders(id) on delete restrict,
  purchase_code text not null,
  purchase_date timestamptz not null,
  eligibility_deadline timestamptz not null,
  phone text not null,
  cpf text not null,
  address jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','reviewing','approved','rejected','completed')),
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refund_requests_user_idx on public.refund_requests(user_id,created_at desc);
create index if not exists refund_requests_status_idx on public.refund_requests(status,created_at desc);
create unique index if not exists refund_requests_open_order_uidx on public.refund_requests(payment_order_id) where status in ('pending','reviewing','approved');

DO $$ BEGIN
  if not exists(select 1 from pg_trigger where tgname='retention_offers_updated_at') then
    create trigger retention_offers_updated_at before update on public.retention_offers for each row execute function public.set_updated_at();
  end if;
  if not exists(select 1 from pg_trigger where tgname='refund_requests_updated_at') then
    create trigger refund_requests_updated_at before update on public.refund_requests for each row execute function public.set_updated_at();
  end if;
END $$;

alter table public.subscription_exit_feedback enable row level security;
alter table public.retention_offers enable row level security;
alter table public.refund_requests enable row level security;

drop policy if exists subscription_exit_feedback_admin on public.subscription_exit_feedback;
drop policy if exists retention_offers_admin on public.retention_offers;
drop policy if exists refund_requests_admin on public.refund_requests;
drop policy if exists refund_requests_admin_update on public.refund_requests;
create policy subscription_exit_feedback_admin on public.subscription_exit_feedback for select using(public.is_admin());
create policy retention_offers_admin on public.retention_offers for select using(public.is_admin());
create policy refund_requests_admin on public.refund_requests for select using(public.is_admin());
create policy refund_requests_admin_update on public.refund_requests for update using(public.is_admin()) with check(public.is_admin());

revoke all on public.subscription_exit_feedback,public.retention_offers,public.refund_requests from anon;
revoke insert,update,delete on public.subscription_exit_feedback,public.retention_offers from authenticated;
revoke insert,delete on public.refund_requests from authenticated;
grant select on public.subscription_exit_feedback,public.retention_offers,public.refund_requests to authenticated;
grant update on public.refund_requests to authenticated;

insert into public.app_settings(key,value) values
  ('retention_discount_percent','10'::jsonb),
  ('retention_monthly_cycles','3'::jsonb),
  ('refund_request_days','7'::jsonb)
on conflict(key) do nothing;
