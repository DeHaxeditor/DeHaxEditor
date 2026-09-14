import crypto from 'node:crypto';
import { json,parseBody,requireProfile,activePro,errResponse,sb,audioAiSettings,audioCycleWindow,audioTokenCost,env,presignR2,safeFilename } from './_lib.mjs';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||a));
const MODELS=new Set(['eleven_multilingual_v2','eleven_flash_v2_5','eleven_v3']);
async function validateVoiceAccess(apiKey,voiceId){
  const [sr,vr]=await Promise.all([
    fetch('https://api.elevenlabs.io/v1/user/subscription',{headers:{'xi-api-key':apiKey}}),
    fetch(`https://api.elevenlabs.io/v2/voices?voice_ids=${encodeURIComponent(voiceId)}&page_size=1&include_total_count=false&include_custom_rates=false`,{headers:{'xi-api-key':apiKey}})
  ]);
  const sub=sr.ok?await sr.json().catch(()=>({})):{};
  const data=vr.ok?await vr.json().catch(()=>({})):{};
  const voice=(data.voices||[])[0];
  if(!voice)throw Object.assign(new Error('Esta voz não está disponível para geração no plano atual do provedor. Escolha outra voz.'),{status:400,expose:true});
  const tier=String(sub.tier||'free').toLowerCase(),tiers=Array.isArray(voice.available_for_tiers)?voice.available_for_tiers.map(x=>String(x).toLowerCase()):[];
  if((tier==='free'&&voice?.sharing?.status==='enabled')||(tiers.length&&!tiers.includes(tier)))throw Object.assign(new Error('Esta voz não está disponível para geração no plano atual do provedor. Escolha outra voz.'),{status:400,expose:true});
  return {tier,voice};
}
async function currentUsage(userId,p,settings){
  const cycle=audioCycleWindow(p,settings.cycleDays);
  const {data:usage}=await sb(`/rest/v1/ai_audio_generations?user_id=eq.${encodeURIComponent(userId)}&status=in.(ready,expired,deleted)&created_at=gte.${encodeURIComponent(cycle.start)}&created_at=lt.${encodeURIComponent(cycle.end)}&select=tokens_spent`);
  const tokens=(usage||[]).reduce((n,x)=>n+Number(x.tokens_spent||0),0);
  const {data:stored}=await sb(`/rest/v1/ai_audio_generations?user_id=eq.${encodeURIComponent(userId)}&status=eq.ready&select=file_size`);
  const bytes=(stored||[]).reduce((n,x)=>n+Number(x.file_size||0),0);
  return {cycle,tokens,bytes};
}
async function providerAudio(kind,body,apiKey,settings){
  if(kind==='narration'){
    const voiceId=String(body.voiceId||'').trim();if(!/^[A-Za-z0-9_-]{5,80}$/.test(voiceId))throw Object.assign(new Error('Escolha uma voz antes de gerar.'),{status:400});
    const model=MODELS.has(String(body.modelId||''))?String(body.modelId):'eleven_multilingual_v2';
    await validateVoiceAccess(apiKey,voiceId);
    const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,{
      method:'POST',headers:{'xi-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({text:body.text,model_id:model,voice_settings:{stability:clamp(body.stability,.05,1),similarity_boost:clamp(body.similarity,.05,1),style:clamp(body.style,0,1),speed:clamp(body.speed,.7,1.2)}})
    });
    if(!r.ok){const d=await r.json().catch(()=>({}));let msg=d?.detail?.message||d?.detail?.status||d?.message||'O provedor não conseguiu gerar a narração.';if(/free users cannot use library voices|not available for free users/i.test(String(msg)))msg='Esta voz não está disponível para geração no plano atual do provedor. Escolha outra voz.';throw Object.assign(new Error(msg),{status:502,expose:true})}
    return {buffer:Buffer.from(await r.arrayBuffer()),model,voiceId,duration:null};
  }
  const duration=clamp(body.durationSeconds,.5,settings.maxSfxSeconds),influence=clamp(body.promptInfluence,.05,1);
  const r=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',{
    method:'POST',headers:{'xi-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({text:body.text,duration_seconds:duration,loop:!!body.loop,prompt_influence:influence,model_id:'eleven_text_to_sound_v2'})
  });
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(d?.detail?.message||d?.detail?.status||d?.message||'O provedor não conseguiu gerar o efeito sonoro.'),{status:502,expose:true})}
  return {buffer:Buffer.from(await r.arrayBuffer()),model:'eleven_text_to_sound_v2',voiceId:null,duration};
}

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  let generationId=null;
  try{
    const {user,p}=await requireProfile(event);if(!activePro(p))return json(403,{error:'A IA de áudio é um recurso PRO. Escolha um plano para gerar.',upgrade:true});
    const settings=await audioAiSettings();if(!settings.enabled)return json(503,{error:'A IA de áudio está preparada, mas ainda não foi ativada pelo administrador.'});
    const apiKey=env('ELEVENLABS_API_KEY',false);if(!apiKey)return json(503,{error:'O provedor de IA de áudio ainda não foi conectado.'});
    const body=parseBody(event),kind=String(body.kind||'narration');if(!['narration','sfx'].includes(kind))return json(400,{error:'Tipo de geração inválido.'});
    const text=String(body.text||'').trim();if(!text)return json(400,{error:kind==='narration'?'Digite o texto da narração.':'Descreva o efeito sonoro que deseja gerar.'});
    if(kind==='narration'&&text.length>settings.maxNarrationChars)return json(400,{error:`A narração aceita até ${settings.maxNarrationChars} caracteres por geração.`});
    const duration=kind==='sfx'?clamp(body.durationSeconds,.5,settings.maxSfxSeconds):0;
    const modelId=kind==='narration'?(MODELS.has(String(body.modelId||''))?String(body.modelId):'eleven_multilingual_v2'):'eleven_text_to_sound_v2';
    const cost=audioTokenCost(kind,text,settings,duration||5,modelId),usage=await currentUsage(user.id,p,settings),admin=p.role==='admin';
    const maxBytes=Math.round(settings.storageGb*1024*1024*1024);if(usage.bytes>=maxBytes)return json(413,{error:'Seu espaço de IA está cheio. Aguarde a expiração dos arquivos ou baixe o que precisa antes de gerar novamente.'});
    generationId=crypto.randomUUID();const expiresAt=new Date(Date.now()+settings.storageDays*86400000).toISOString();
    try{
      await sb('/rest/v1/rpc/reserve_ai_audio_generation',{method:'POST',body:{p_id:generationId,p_user_id:user.id,p_kind:kind,p_provider:settings.provider,p_model_id:modelId,p_voice_id:kind==='narration'?String(body.voiceId||''):null,p_prompt_preview:text.slice(0,240),p_tokens:cost,p_expires_at:expiresAt,p_cycle_start:usage.cycle.start,p_cycle_end:usage.cycle.end,p_token_limit:admin?null:settings.tokensPerCycle}});
    }catch(reserveError){
      const m=String(reserveError?.message||'');const hit=m.match(/AI_TOKEN_LIMIT\|(\d+)\|(\d+)/);
      if(hit)return json(402,{error:`Tokens insuficientes. Esta geração custa ${hit[1]} tokens e você possui ${hit[2]} disponíveis.`,tokensRequired:Number(hit[1]),tokensRemaining:Number(hit[2])});
      throw reserveError;
    }
    const out=await providerAudio(kind,{...body,text},apiKey,settings);if(!out.buffer.length)throw new Error('O provedor retornou um arquivo vazio.');
    if(usage.bytes+out.buffer.length>maxBytes)throw Object.assign(new Error('O áudio foi gerado, mas ultrapassaria seu limite de armazenamento. Libere espaço e tente uma geração menor.'),{status:413,expose:true});
    const key=`ai-audio/${user.id}/${new Date().toISOString().slice(0,7)}/${generationId}.mp3`,uploadUrl=presignR2({method:'PUT',key,expires:300});
    const put=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':'audio/mpeg'},body:out.buffer});if(!put.ok)throw Object.assign(new Error('Não foi possível armazenar o áudio gerado.'),{status:502,expose:true});
    await sb(`/rest/v1/ai_audio_generations?id=eq.${encodeURIComponent(generationId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{file_key:key,file_size:out.buffer.length,duration_seconds:out.duration,status:'ready',model_id:out.model,voice_id:out.voiceId}});
    const filename=safeFilename(`dehax-${kind==='narration'?'narracao':'sfx'}-${generationId.slice(0,8)}.mp3`),url=presignR2({method:'GET',key,expires:600,responseDisposition:`inline; filename="${filename}"`});
    return json(200,{id:generationId,kind,tokensSpent:cost,fileSize:out.buffer.length,expiresAt,url,filename});
  }catch(e){
    if(generationId){try{await sb(`/rest/v1/ai_audio_generations?id=eq.${encodeURIComponent(generationId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'failed'}})}catch{}}
    return errResponse(e)
  }
};
