-- DEHAX V2.3.0 — IA de áudio + controles de quota/armazenamento
-- Execute UMA VEZ no SQL Editor depois das migrations V2.2.1 e V2.2.2.

create table if not exists public.ai_audio_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('narration','sfx')),
  provider text not null default 'elevenlabs',
  model_id text,
  voice_id text,
  prompt_preview text default '',
  tokens_spent integer not null default 0 check(tokens_spent >= 0),
  file_key text,
  file_size bigint not null default 0 check(file_size >= 0),
  duration_seconds numeric(8,2),
  status text not null default 'ready' check(status in ('processing','ready','failed','expired','deleted')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_audio_generations_user_created_idx
  on public.ai_audio_generations(user_id,created_at desc);
create index if not exists ai_audio_generations_expiry_idx
  on public.ai_audio_generations(expires_at)
  where status='ready';

DO $$ BEGIN
  if not exists(select 1 from pg_trigger where tgname='ai_audio_generations_updated_at') then
    create trigger ai_audio_generations_updated_at before update on public.ai_audio_generations
    for each row execute function public.set_updated_at();
  end if;
END $$;

alter table public.ai_audio_generations enable row level security;
drop policy if exists ai_audio_generations_read on public.ai_audio_generations;
create policy ai_audio_generations_read on public.ai_audio_generations
  for select using(user_id=auth.uid() or public.is_admin());

-- Geração/alteração é exclusiva do backend com service_role.
revoke all on public.ai_audio_generations from anon;
revoke insert,update,delete on public.ai_audio_generations from authenticated;
grant select on public.ai_audio_generations to authenticated;

insert into public.app_settings(key,value) values
  ('ai_audio_enabled','false'::jsonb),
  ('ai_audio_provider','"elevenlabs"'::jsonb),
  ('ai_audio_pro_tokens_per_cycle','1000'::jsonb),
  ('ai_audio_token_cycle_days','30'::jsonb),
  ('ai_audio_narration_tokens_per_1000_chars','50'::jsonb),
  ('ai_audio_sfx_tokens_per_second','10'::jsonb),
  ('ai_audio_storage_days','30'::jsonb),
  ('ai_audio_storage_gb_per_user','1'::jsonb),
  ('ai_audio_max_narration_chars','5000'::jsonb),
  ('ai_audio_max_sfx_seconds','30'::jsonb),
  ('ai_audio_voice_limit','12'::jsonb)
on conflict(key) do nothing;

-- Reserva atômica de tokens: evita que várias gerações simultâneas ultrapassem a franquia.
create or replace function public.reserve_ai_audio_generation(
  p_id uuid,
  p_user_id uuid,
  p_kind text,
  p_provider text,
  p_model_id text,
  p_voice_id text,
  p_prompt_preview text,
  p_tokens integer,
  p_expires_at timestamptz,
  p_cycle_start timestamptz,
  p_cycle_end timestamptz,
  p_token_limit integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer := 0;
  v_remaining integer;
begin
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'profile not found'; end if;

  select coalesce(sum(tokens_spent),0)::integer into v_used
    from public.ai_audio_generations
   where user_id=p_user_id
     and created_at>=p_cycle_start
     and created_at<p_cycle_end
     and status in ('processing','ready','expired','deleted');

  if p_token_limit is not null and v_used + p_tokens > p_token_limit then
    raise exception 'AI_TOKEN_LIMIT|%|%', p_tokens, greatest(0,p_token_limit-v_used);
  end if;

  insert into public.ai_audio_generations(
    id,user_id,kind,provider,model_id,voice_id,prompt_preview,tokens_spent,
    file_size,duration_seconds,status,expires_at
  ) values (
    p_id,p_user_id,p_kind,p_provider,p_model_id,p_voice_id,p_prompt_preview,p_tokens,
    0,null,'processing',p_expires_at
  );

  if p_token_limit is null then return null; end if;
  v_remaining := greatest(0,p_token_limit-(v_used+p_tokens));
  return v_remaining;
end $$;
revoke all on function public.reserve_ai_audio_generation(uuid,uuid,text,text,text,text,text,integer,timestamptz,timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai_audio_generation(uuid,uuid,text,text,text,text,text,integer,timestamptz,timestamptz,timestamptz,integer) to service_role;
