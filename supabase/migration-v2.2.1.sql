-- DEHAX V2.2.1 — checkout Mercado Pago + planos mensal/semestral
-- Execute uma vez no SQL Editor do projeto existente antes de testar a V2.2.1.

alter table public.payment_orders add column if not exists plan_code text;
alter table public.payment_orders add column if not exists payment_method text;
alter table public.payment_orders add column if not exists access_granted_at timestamptz;

alter table public.payment_orders drop constraint if exists payment_orders_kind_check;
alter table public.payment_orders add constraint payment_orders_kind_check
  check (kind in ('pix','subscription','card_once'));

insert into public.app_settings(key,value) values
  ('pro_monthly_price','"19,90"'::jsonb),
  ('pro_semester_monthly_equiv','"9,90"'::jsonb),
  ('pro_semester_total','"59,40"'::jsonb),
  ('pix_access_days','30'::jsonb),
  ('renewal_notice_days','7'::jsonb)
on conflict(key) do nothing;

-- Concessão atômica/idempotente de acesso pré-pago (Pix mensal, Pix semestral ou cartão semestral).
drop function if exists public.grant_fixed_pro_for_order(uuid,integer);
drop function if exists public.grant_fixed_pro_for_order(uuid);
create or replace function public.grant_fixed_pro_for_order(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_profile public.profiles%rowtype;
  v_base timestamptz;
  v_until timestamptz;
  v_status text;
  v_days integer;
begin
  select * into v_order from public.payment_orders where id = p_order_id for update;
  if not found then raise exception 'payment order not found'; end if;
  if v_order.kind not in ('pix','card_once') then raise exception 'payment order is not a fixed-access purchase'; end if;
  if coalesce(v_order.plan_code,'') not in ('monthly','semester') then raise exception 'invalid fixed-access plan'; end if;

  select * into v_profile from public.profiles where id = v_order.user_id for update;
  if not found then raise exception 'profile not found'; end if;
  if v_order.access_granted_at is not null then return v_profile.access_expires_at; end if;

  -- Renovação antecipada nunca perde dias: se o membro ainda tem acesso,
  -- o novo período começa somente depois da expiração atual.
  v_base := case when v_profile.access_expires_at is not null and v_profile.access_expires_at > now()
                 then v_profile.access_expires_at else now() end;

  if v_order.plan_code = 'monthly' then
    v_days := greatest(1,coalesce(v_order.access_days,30));
    v_until := v_base + make_interval(days => v_days);
    v_status := 'pix_active';
  else
    v_until := v_base + make_interval(months => 6);
    v_status := 'semester_active';
  end if;

  update public.profiles
     set plan='pro',
         subscription_status=v_status,
         subscription_id=null,
         pro_started_at=coalesce(pro_started_at,now()),
         access_expires_at=v_until
   where id=v_order.user_id;

  update public.payment_orders set access_granted_at=now() where id=p_order_id;
  return v_until;
end $$;
revoke all on function public.grant_fixed_pro_for_order(uuid) from public,anon,authenticated;
grant execute on function public.grant_fixed_pro_for_order(uuid) to service_role;
