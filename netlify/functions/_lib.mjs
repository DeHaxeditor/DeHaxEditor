import crypto from 'node:crypto';

export const env=(name,required=true)=>{const v=process.env[name];if(required&&!v)throw new Error(`Variável ${name} não configurada.`);return v||''};
export const json=(status,body,headers={})=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers},body:JSON.stringify(body)});
export const parseBody=event=>{try{return JSON.parse(event.body||'{}')}catch{return {}}};
export const supabaseUrl=()=>env('SUPABASE_URL');
export const serviceKey=()=>env('SUPABASE_SERVICE_ROLE_KEY');
export async function sb(path,{method='GET',body,headers={}}={}){const r=await fetch(`${supabaseUrl()}${path}`,{method,headers:{apikey:serviceKey(),Authorization:`Bearer ${serviceKey()}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok){const e=new Error(data?.message||data?.msg||`Supabase ${r.status}`);e.status=r.status;throw e}return{data,headers:r.headers,status:r.status}}
export async function authUser(event){const auth=event.headers.authorization||event.headers.Authorization||'';const token=auth.replace(/^Bearer\s+/i,'');if(!token)throw Object.assign(new Error('Faça login para continuar.'),{status:401});const r=await fetch(`${supabaseUrl()}/auth/v1/user`,{headers:{apikey:serviceKey(),Authorization:`Bearer ${token}`}});if(!r.ok)throw Object.assign(new Error('Sessão inválida ou expirada.'),{status:401});return r.json()}
export async function profile(userId){const {data}=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`);return data?.[0]||null}
export async function requireProfile(event,{admin=false}={}){const user=await authUser(event);const p=await profile(user.id);if(!p)throw Object.assign(new Error('Perfil não encontrado.'),{status:403});if(p.is_suspended)throw Object.assign(new Error('Esta conta está temporariamente suspensa.'),{status:403});if(admin&&p.role!=='admin')throw Object.assign(new Error('Acesso restrito ao administrador.'),{status:403});return{user,p}}

export async function authAdminUser(userId){
  const r=await fetch(`${supabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{headers:{apikey:serviceKey(),Authorization:`Bearer ${serviceKey()}`}});
  if(!r.ok)throw Object.assign(new Error('Usuário de checkout não encontrado.'),{status:404});
  return r.json();
}
export async function requirePaymentProfile(event,body={}){
  const auth=event.headers.authorization||event.headers.Authorization||'';
  const bearer=auth.replace(/^Bearer\s+/i,'').trim();
  if(bearer)return requireProfile(event);
  const raw=String(body.checkoutToken||'').trim();
  if(!raw)throw Object.assign(new Error('Crie sua conta ou entre antes de continuar o pagamento.'),{status:401});
  const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
  const now=new Date().toISOString();
  const {data:sessions}=await sb(`/rest/v1/checkout_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=*&limit=1`);
  const session=sessions?.[0];
  if(!session)throw Object.assign(new Error('Sua sessão de checkout expirou. Entre ou crie a conta novamente.'),{status:401});
  const p=await profile(session.user_id);
  if(!p)throw Object.assign(new Error('Perfil do checkout não encontrado.'),{status:403});
  if(p.is_suspended)throw Object.assign(new Error('Esta conta está temporariamente suspensa.'),{status:403});
  const u=await authAdminUser(session.user_id);
  return {user:{id:u.id,email:u.email,user_metadata:u.user_metadata||{}},p,checkoutSession:session};
}
export async function getSetting(key,def=null){try{const{data}=await sb(`/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=value`);return data?.[0]?.value??def}catch{return def}}
export function activePro(p){if(p?.role==='admin')return true;if(p?.plan!=='pro')return false;const status=String(p.subscription_status||'').toLowerCase(),expiry=p.access_expires_at?new Date(p.access_expires_at).getTime():null;if(status==='canceled')return Number.isFinite(expiry)&&expiry>Date.now();const ok=['authorized','active','manual','trialing','pix_active','semester_active'].includes(status);if(!ok)return false;if(expiry&&expiry<=Date.now())return false;return true}
export function bucket(){return env('R2_BUCKET')}
export function safeFilename(name='arquivo'){return String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,120)||'arquivo'}
export function clientHash(event){const ip=(event.headers['x-nf-client-connection-ip']||event.headers['x-forwarded-for']||'unknown').split(',')[0].trim();return crypto.createHash('sha256').update(`${env('DOWNLOAD_HASH_SALT',false)||'dehax'}:${ip}`).digest('hex').slice(0,24)}
export function errResponse(e){console.error(e);const status=Number(e.status)||500;const show=e.expose||status<500||String(process.env.MP_TEST_MODE||'').toLowerCase()==='true';return json(status,{error:show?e.message:'Erro interno da plataforma.',detail:(process.env.CONTEXT==='dev'||String(process.env.MP_TEST_MODE||'').toLowerCase()==='true')?e.message:undefined})}

const enc=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const hmac=(key,data,encoding)=>crypto.createHmac('sha256',key).update(data).digest(encoding);
const amzDate=d=>d.toISOString().replace(/[:-]|\.\d{3}/g,'');
const dateStamp=d=>amzDate(d).slice(0,8);
const canonicalPath=key=>'/'+String(key).split('/').map(enc).join('/');
export function presignR2({method='GET',key,expires=120,responseDisposition,bucketName}){
  const account=env('R2_ACCOUNT_ID'),access=env('R2_ACCESS_KEY_ID'),secret=env('R2_SECRET_ACCESS_KEY'),b=bucketName||bucket();
  const now=new Date(),stamp=dateStamp(now),date=amzDate(now),region='auto',service='s3',scope=`${stamp}/${region}/${service}/aws4_request`;
  const host=`${b}.${account}.r2.cloudflarestorage.com`,path=canonicalPath(key);
  const params={
    'X-Amz-Algorithm':'AWS4-HMAC-SHA256',
    'X-Amz-Credential':`${access}/${scope}`,
    'X-Amz-Date':date,
    'X-Amz-Expires':String(Math.max(1,Math.min(604800,Number(expires)||120))),
    'X-Amz-SignedHeaders':'host'
  };
  if(responseDisposition)params['response-content-disposition']=responseDisposition;
  const canonicalQuery=Object.keys(params).sort().map(k=>`${enc(k)}=${enc(params[k])}`).join('&');
  const canonicalHeaders=`host:${host}\n`,signedHeaders='host';
  const canonicalRequest=[method.toUpperCase(),path,canonicalQuery,canonicalHeaders,signedHeaders,'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign=['AWS4-HMAC-SHA256',date,scope,sha(canonicalRequest)].join('\n');
  const kDate=hmac(Buffer.from('AWS4'+secret),stamp),kRegion=hmac(kDate,region),kService=hmac(kRegion,service),kSigning=hmac(kService,'aws4_request');
  const signature=hmac(kSigning,stringToSign,'hex');
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Mercado Pago helpers — V2.2.1
export function mpSubscriptionsToken(){return env('MP_SUBSCRIPTIONS_ACCESS_TOKEN',false)||env('MP_ACCESS_TOKEN')}
export function mpOrdersToken(){const token=env('MP_ORDERS_ACCESS_TOKEN',false);if(token)return token;if(String(process.env.MP_TEST_MODE||'').toLowerCase()==='true')throw Object.assign(new Error('MP_ORDERS_ACCESS_TOKEN não foi configurado. Use o Access Token de TESTE da aplicação Orders.'),{status:500,expose:true});return env('MP_ACCESS_TOKEN')}
export function mpDebug(){return String(process.env.MP_TEST_MODE||'').toLowerCase()==='true'}
export function mpCardPayerEmail(fallback=''){return mpDebug()?(process.env.MP_TEST_SUBSCRIPTION_PAYER_EMAIL||fallback):fallback}
export function mpError(data,fallback='O Mercado Pago recusou a operação.',status=502){
  const parts=[];
  const add=v=>{if(v!==undefined&&v!==null&&String(v).trim())parts.push(String(v).trim())};
  add(data?.message);add(data?.error);
  if(Array.isArray(data?.cause))for(const x of data.cause||[]){add(x?.code);add(x?.description);add(x?.message)}
  if(Array.isArray(data?.errors))for(const x of data.errors||[]){
    add(x?.code);add(x?.message);add(x?.description);
    const details=Array.isArray(x?.details)?x.details:(x?.details?[x.details]:[]);
    for(const d of details){
      const where=d?.field||d?.path||d?.property||d?.name||'';
      const text=d?.message||d?.description||d?.detail||d?.error||'';
      if(where&&text)add(`${where}: ${text}`);else{add(where);add(text)}
    }
  }
  const msg=String([...new Set(parts)].join(' · ')||fallback).slice(0,800);
  const e=new Error(msg);e.status=status;e.expose=true;e.provider='mercadopago';e.providerData=mpDebug()?data:undefined;return e;
}
export function addCalendarMonths(base,months){
  const src=new Date(base||Date.now());
  const day=src.getUTCDate();
  const d=new Date(Date.UTC(src.getUTCFullYear(),src.getUTCMonth(),1,src.getUTCHours(),src.getUTCMinutes(),src.getUTCSeconds(),src.getUTCMilliseconds()));
  d.setUTCMonth(d.getUTCMonth()+Number(months||0));
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));
  return d;
}
export async function grantFixedPro(userId,{months=6,status='semester_active'}={}){
  const {data:rows}=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=pro_started_at,access_expires_at`);
  const p=rows?.[0]||{};
  const existing=p.access_expires_at?new Date(p.access_expires_at):null;
  const base=existing&&Number.isFinite(existing.getTime())&&existing.getTime()>Date.now()?existing:new Date();
  const until=addCalendarMonths(base,months).toISOString();
  await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{plan:'pro',subscription_status:status,subscription_id:null,pro_started_at:p.pro_started_at||new Date().toISOString(),access_expires_at:until}});
  return until;
}

export async function grantFixedProForOrder(orderId){const {data}=await sb('/rest/v1/rpc/grant_fixed_pro_for_order',{method:'POST',body:{p_order_id:orderId}});return typeof data==='string'?data:(Array.isArray(data)?data[0]:data)||null}

// Membership / upgrade helpers — V2.3.0
export function membershipTier(p){
  if(!activePro(p))return 'free';
  const status=String(p?.subscription_status||'').toLowerCase();
  if(status==='semester_active')return 'semester';
  if(p?.subscription_id&&['authorized','active','trialing'].includes(status))return 'monthly';
  if(status==='pix_active')return 'monthly';
  if(status==='canceled'&&p?.access_expires_at&&new Date(p.access_expires_at).getTime()>Date.now())return 'monthly';
  if(status==='manual')return 'monthly';
  return 'monthly';
}
export function purchaseGuard(p,planCode){
  const tier=membershipTier(p);
  if(tier==='semester')throw Object.assign(new Error('Seu plano PRO semestral já está ativo. Não é necessário comprar o PRO novamente.'),{status:409,expose:true,code:'SEMESTER_ALREADY_ACTIVE'});
  if(tier==='monthly'&&planCode==='monthly')throw Object.assign(new Error('Seu PRO mensal já está ativo. A única opção disponível agora é fazer upgrade para o plano semestral.'),{status:409,expose:true,code:'MONTHLY_ALREADY_ACTIVE'});
  return tier;
}
export async function cancelRecurringForSemesterUpgrade(userId,p){
  const status=String(p?.subscription_status||'').toLowerCase();
  if(!p?.subscription_id||!['authorized','active','trialing'].includes(status))return {cancelled:false,accessUntil:p?.access_expires_at||null};
  const id=String(p.subscription_id),headers={Authorization:`Bearer ${mpSubscriptionsToken()}`,'Content-Type':'application/json'};
  const currentRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers});
  const current=await currentRes.json().catch(()=>({}));
  if(!currentRes.ok)throw mpError(current,'O pagamento semestral foi aprovado, mas não foi possível consultar a assinatura mensal para concluir o upgrade. Tente novamente em alguns segundos.');
  if(String(current.external_reference||'')!==String(userId))throw Object.assign(new Error('A assinatura mensal vinculada não corresponde a esta conta.'),{status:403,expose:true});
  let accessUntil=null;
  const nextDate=current.next_payment_date?new Date(current.next_payment_date):null;
  if(nextDate&&Number.isFinite(nextDate.getTime())&&nextDate.getTime()>Date.now())accessUntil=nextDate.toISOString();
  if(!accessUntil&&p.access_expires_at&&new Date(p.access_expires_at).getTime()>Date.now())accessUntil=p.access_expires_at;
  if(!accessUntil&&p.pro_started_at){
    let cycle=new Date(p.pro_started_at),guard=0;
    if(Number.isFinite(cycle.getTime())){while(cycle.getTime()<=Date.now()&&guard++<60)cycle=addCalendarMonths(cycle,1);if(cycle.getTime()>Date.now())accessUntil=cycle.toISOString()}
  }
  const cancelRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{method:'PUT',headers,body:JSON.stringify({status:'canceled'})});
  const canceled=await cancelRes.json().catch(()=>({}));
  if(!cancelRes.ok)throw mpError(canceled,'O pagamento semestral foi aprovado, mas não foi possível cancelar a renovação mensal automaticamente. Tente novamente em alguns segundos.');
  await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{subscription_status:'canceled',plan:'pro',access_expires_at:accessUntil,subscription_id:id}});
  try{await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.subscription`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',raw:canceled}})}catch{}
  return {cancelled:true,accessUntil,subscriptionId:id};
}

// IA de áudio — quotas internas DeHax. Os tokens abaixo são unidades da plataforma,
// independentes dos créditos/custos do provedor de IA.
export async function audioAiSettings(){
  const keys=['ai_audio_enabled','ai_audio_provider','ai_audio_pro_tokens_per_cycle','ai_audio_token_cycle_days','ai_audio_narration_tokens_per_1000_chars','ai_audio_sfx_tokens_per_second','ai_audio_storage_days','ai_audio_storage_gb_per_user','ai_audio_max_narration_chars','ai_audio_max_sfx_seconds','ai_audio_voice_limit'];
  const out={};
  for(const k of keys)out[k]=await getSetting(k,null);
  return {
    enabled:out.ai_audio_enabled===true||String(out.ai_audio_enabled)==='true',
    provider:String(out.ai_audio_provider||'elevenlabs'),
    tokensPerCycle:Math.max(0,Number(out.ai_audio_pro_tokens_per_cycle??1000)||0),
    cycleDays:Math.max(1,Number(out.ai_audio_token_cycle_days??30)||30),
    narrationPer1k:Math.max(1,Number(out.ai_audio_narration_tokens_per_1000_chars??50)||50),
    sfxPerSecond:Math.max(1,Number(out.ai_audio_sfx_tokens_per_second??10)||10),
    storageDays:Math.max(1,Number(out.ai_audio_storage_days??30)||30),
    storageGb:Math.max(.1,Number(out.ai_audio_storage_gb_per_user??1)||1),
    maxNarrationChars:Math.max(100,Number(out.ai_audio_max_narration_chars??5000)||5000),
    maxSfxSeconds:Math.max(.5,Math.min(30,Number(out.ai_audio_max_sfx_seconds??30)||30)),
    voiceLimit:Math.max(1,Math.min(50,Number(out.ai_audio_voice_limit??12)||12))
  };
}
export function audioCycleWindow(p,cycleDays=30){
  const ms=Math.max(1,Number(cycleDays)||30)*86400000;
  let anchor=new Date(p?.pro_started_at||p?.created_at||Date.now());
  if(!Number.isFinite(anchor.getTime())||anchor.getTime()>Date.now())anchor=new Date();
  const elapsed=Math.max(0,Date.now()-anchor.getTime()),idx=Math.floor(elapsed/ms);
  const start=new Date(anchor.getTime()+idx*ms),end=new Date(start.getTime()+ms);
  return {start:start.toISOString(),end:end.toISOString()};
}
export function audioTokenCost(kind,text,settings,durationSeconds=5){
  if(kind==='narration')return Math.max(1,Math.ceil(Math.max(1,String(text||'').length)/1000)*settings.narrationPer1k);
  return Math.max(1,Math.ceil(Math.max(.5,Number(durationSeconds)||5)*settings.sfxPerSecond));
}
