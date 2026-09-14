import { json,requireProfile,activePro,errResponse,sb,audioAiSettings,audioCycleWindow,env } from './_lib.mjs';

let voiceCache={at:0,key:'',voices:[],subscription:null};
function tierAllows(voice,tier){
  const t=String(tier||'free').toLowerCase();
  // A Voice Library não pode ser usada pela API no Free. Vozes próprias/premade
  // sem compartilhamento continuam elegíveis quando a API as expõe.
  if(t==='free'&&voice?.sharing?.status==='enabled')return false;
  const list=Array.isArray(voice?.available_for_tiers)?voice.available_for_tiers.map(x=>String(x).toLowerCase()):[];
  return !list.length||list.includes(t);
}
async function elevenSubscription(apiKey){
  const r=await fetch('https://api.elevenlabs.io/v1/user/subscription',{headers:{'xi-api-key':apiKey}});
  if(!r.ok)return {tier:'unknown',status:'unknown'};
  const d=await r.json().catch(()=>({}));
  return {tier:String(d.tier||'unknown').toLowerCase(),status:String(d.status||'unknown'),characterCount:Number(d.character_count||0),characterLimit:Number(d.character_limit||0)};
}
async function loadVoices(limit){
  const apiKey=env('ELEVENLABS_API_KEY',false);if(!apiKey)return {voices:[],subscription:null};
  const sub=await elevenSubscription(apiKey),cacheKey=`${limit}:${sub.tier}`;
  if(voiceCache.key===cacheKey&&Date.now()-voiceCache.at<10*60*1000)return {voices:voiceCache.voices,subscription:voiceCache.subscription};
  const u=new URL('https://api.elevenlabs.io/v2/voices');
  // Busca mais itens para filtrar as vozes indisponíveis ao tier e as de taxa customizada.
  u.searchParams.set('page_size',String(Math.min(100,Math.max(limit*3,30))));
  u.searchParams.set('include_total_count','false');
  u.searchParams.set('include_custom_rates','false');
  u.searchParams.set('include_live_moderated','true');
  const r=await fetch(u,{headers:{'xi-api-key':apiKey}});if(!r.ok)return {voices:[],subscription:sub};
  const data=await r.json().catch(()=>({}));
  const voices=(data.voices||[])
    .filter(v=>v?.voice_id&&v?.name&&tierAllows(v,sub.tier))
    .slice(0,limit)
    .map(v=>({
      id:String(v.voice_id),name:String(v.name),description:String(v.description||''),previewUrl:String(v.preview_url||''),category:String(v.category||''),labels:v.labels||{},languages:(v.verified_languages||[]).slice(0,4).map(x=>x.locale||x.language).filter(Boolean),availableForTiers:Array.isArray(v.available_for_tiers)?v.available_for_tiers:[],liveModerated:!!v.sharing?.live_moderation_enabled
    }));
  voiceCache={at:Date.now(),key:cacheKey,voices,subscription:sub};return {voices,subscription:sub};
}

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event);const settings=await audioAiSettings();const pro=activePro(p),admin=p.role==='admin';
    const cycle=audioCycleWindow(p,settings.cycleDays);
    const {data:usage}=await sb(`/rest/v1/ai_audio_generations?user_id=eq.${encodeURIComponent(user.id)}&status=in.(ready,expired,deleted)&created_at=gte.${encodeURIComponent(cycle.start)}&created_at=lt.${encodeURIComponent(cycle.end)}&select=tokens_spent`);
    const tokensUsed=(usage||[]).reduce((n,x)=>n+Number(x.tokens_spent||0),0);
    const {data:stored}=await sb(`/rest/v1/ai_audio_generations?user_id=eq.${encodeURIComponent(user.id)}&status=eq.ready&select=file_size`);
    const storageBytes=(stored||[]).reduce((n,x)=>n+Number(x.file_size||0),0);
    const {data:history}=await sb(`/rest/v1/ai_audio_generations?user_id=eq.${encodeURIComponent(user.id)}&select=id,kind,provider,model_id,voice_id,prompt_preview,tokens_spent,file_size,duration_seconds,status,expires_at,created_at&order=created_at.desc&limit=30`);
    const {voices,subscription}=await loadVoices(settings.voiceLimit);
    return json(200,{
      plan:pro?'pro':'free',admin,enabled:settings.enabled,provider:settings.provider,providerConfigured:!!env('ELEVENLABS_API_KEY',false),providerPlan:subscription,
      tokens:{allowance:admin?null:settings.tokensPerCycle,used:tokensUsed,remaining:admin?null:Math.max(0,settings.tokensPerCycle-tokensUsed),cycleStart:cycle.start,cycleEnd:cycle.end},
      costs:{narrationHqPer1000Chars:settings.narrationHqPer1k,narrationFlashPer1000Chars:settings.narrationFlashPer1k,sfxPerSecond:settings.sfxPerSecond},
      limits:{storageDays:settings.storageDays,storageGb:settings.storageGb,maxNarrationChars:settings.maxNarrationChars,maxSfxSeconds:settings.maxSfxSeconds},
      storage:{usedBytes:storageBytes,maxBytes:Math.round(settings.storageGb*1024*1024*1024)},voices,history:history||[]
    });
  }catch(e){return errResponse(e)}
};
