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
export async function getSetting(key,def=null){try{const{data}=await sb(`/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=value`);return data?.[0]?.value??def}catch{return def}}
export function activePro(p){if(p?.role==='admin')return true;if(p?.plan!=='pro')return false;const status=String(p.subscription_status||'').toLowerCase(),expiry=p.access_expires_at?new Date(p.access_expires_at).getTime():null;if(status==='canceled')return Number.isFinite(expiry)&&expiry>Date.now();const ok=['authorized','active','manual','trialing','pix_active'].includes(status);if(!ok)return false;if(expiry&&expiry<=Date.now())return false;return true}
export function bucket(){return env('R2_BUCKET')}
export function safeFilename(name='arquivo'){return String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,120)||'arquivo'}
export function clientHash(event){const ip=(event.headers['x-nf-client-connection-ip']||event.headers['x-forwarded-for']||'unknown').split(',')[0].trim();return crypto.createHash('sha256').update(`${env('DOWNLOAD_HASH_SALT',false)||'dehax'}:${ip}`).digest('hex').slice(0,24)}
export function errResponse(e){console.error(e);return json(Number(e.status)||500,{error:Number(e.status)>=500?'Erro interno da plataforma.':e.message,detail:process.env.CONTEXT==='dev'?e.message:undefined})}

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
