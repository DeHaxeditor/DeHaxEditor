import crypto from 'node:crypto';
import { json,parseBody,errResponse,authAdminUser,profile,sb,supabaseUrl,env } from './_lib.mjs';

const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||'').trim());
const norm=e=>String(e||'').trim().toLowerCase();

async function findProfileByEmail(email){
  const {data}=await sb(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,display_name,role,plan,subscription_status,is_suspended&limit=1`);
  return data?.[0]||null;
}
async function createSession(userId){
  const raw=crypto.randomBytes(32).toString('base64url');
  const tokenHash=crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  await sb('/rest/v1/checkout_sessions',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:userId,token_hash:tokenHash,expires_at:expiresAt}});
  return {raw,expiresAt};
}
async function waitProfile(userId){
  for(let i=0;i<10;i++){
    const p=await profile(userId);
    if(p)return p;
    await new Promise(r=>setTimeout(r,350));
  }
  return null;
}
function requestOrigin(event){
  const proto=event.headers['x-forwarded-proto']||'https';
  const host=event.headers.host;
  return `${proto}://${host}`;
}
async function signup(email,password,name,event){
  const anon=env('SUPABASE_ANON_KEY');
  const redirectTo=`${requestOrigin(event)}/entrar/?confirmed=1`;
  const r=await fetch(`${supabaseUrl()}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:anon,Authorization:`Bearer ${anon}`},
    body:JSON.stringify({email,password,data:{display_name:name}})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const msg=data?.msg||data?.message||data?.error_description||data?.error||'Não foi possível criar a conta.';
    throw Object.assign(new Error(msg),{status:r.status});
  }
  // A API Auth REST retorna o usuário diretamente quando a confirmação de e-mail está ativa.
  // Em alguns modos/versões, ele pode vir dentro de `user` junto com uma sessão.
  const user=data?.user||data;
  const id=String(user?.id||'');
  if(!/^[0-9a-f-]{30,40}$/i.test(id))throw Object.assign(new Error('O Supabase não retornou o identificador da nova conta.'),{status:502});
  return {user,data};
}

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event),action=String(body.action||'prepare');
    const email=norm(body.email);
    if(!emailOk(email))return json(400,{error:'Informe um e-mail válido.'});

    if(action==='probe'){
      const p=await findProfileByEmail(email);
      // O probe revela somente a existência pedida pelo checkout, nunca nome, plano ou status do usuário.
      return json(200,{exists:!!p});
    }

    if(action!=='prepare')return json(400,{error:'Ação de checkout inválida.'});

    let p=await findProfileByEmail(email);
    let created=false,confirmed=false;

    if(p){
      if(body.confirmExisting!==true)return json(409,{error:'Este e-mail já possui uma conta. Confirme que o endereço é seu para prosseguir.',code:'ACCOUNT_EXISTS'});
      if(p.is_suspended)throw Object.assign(new Error('Esta conta está temporariamente suspensa.'),{status:403});
      const u=await authAdminUser(p.id);confirmed=!!u.email_confirmed_at;
    }else{
      const name=String(body.name||'').trim();
      const emailConfirm=norm(body.emailConfirm);
      const password=String(body.password||'');
      if(name.length<2)return json(400,{error:'Informe seu nome.'});
      if(emailConfirm!==email)return json(400,{error:'Os dois campos de e-mail precisam ser iguais.'});
      if(password.length<6)return json(400,{error:'A senha precisa ter pelo menos 6 caracteres.'});

      const made=await signup(email,password,name,event);
      p=await waitProfile(String(made.user.id));
      if(!p)throw Object.assign(new Error('A conta foi criada, mas o perfil ainda está sendo preparado. Aguarde alguns segundos e tente concluir o pagamento novamente.'),{status:409});
      created=true;
      confirmed=!!made.user.email_confirmed_at||!!made.data?.access_token;
    }

    const sess=await createSession(p.id);
    return json(200,{
      checkoutToken:sess.raw,
      expiresAt:sess.expiresAt,
      created,
      existing:!created,
      emailConfirmed:confirmed,
      user:{id:p.id,email:p.email||email,displayName:p.display_name||''}
    });
  }catch(e){return errResponse(e)}
};
