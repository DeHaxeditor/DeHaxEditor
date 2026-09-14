-- DEHAX V2.3.1 — ajuste econômico da IA de áudio.
-- Execute UMA VEZ depois da migration-v2.3.0.sql.
-- Preserva valores que o administrador já personalizou; só troca os antigos defaults conhecidos.

insert into public.app_settings(key,value) values
  ('ai_audio_narration_hq_tokens_per_1000_chars','55'::jsonb),
  ('ai_audio_narration_flash_tokens_per_1000_chars','28'::jsonb)
on conflict(key) do nothing;

update public.app_settings set value='150'::jsonb
 where key='ai_audio_pro_tokens_per_cycle' and value='1000'::jsonb;
update public.app_settings set value='1'::jsonb
 where key='ai_audio_sfx_tokens_per_second' and value='10'::jsonb;
update public.app_settings set value='30'::jsonb
 where key='ai_audio_voice_limit' and value='12'::jsonb;

-- A chave antiga continua no banco por compatibilidade com versões anteriores,
-- mas a V2.3.1 passa a usar custos separados para HQ/v3 e Flash/Turbo.
