import crypto from 'node:crypto';
import { json,parseBody,errResponse,authAdminUser,profile,sb } from './_lib.mjs';

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event),userId=String(body.userId||''),email=String(body.email||'').trim().toLowerCase();
    if(!/^[0-9a-f-]{30,40}$/i.test(userId)||!email)return json(400,{error:'Cadastro de checkout inválido.'});
    const u=await authAdminUser(userId);
    if(String(u.email||'').trim().toLowerCase()!==email)throw Object.assign(new Error('Não foi possível validar o cadastro do checkout.'),{status:403});
    if(u.email_confirmed_at)throw Object.assign(new Error('Esta conta já está confirmada. Faça login para continuar o checkout.'),{status:409});
    const createdAt=new Date(u.created_at||0).getTime();
    if(!Number.isFinite(createdAt)||Date.now()-createdAt>20*60*1000)throw Object.assign(new Error('Por segurança, entre na sua conta para continuar o checkout.'),{status:403});
    const p=await profile(userId);if(!p)throw Object.assign(new Error('O perfil ainda está sendo preparado. Tente novamente em alguns segundos.'),{status:409});
    const raw=crypto.randomBytes(32).toString('base64url'),tokenHash=crypto.createHash('sha256').update(raw).digest('hex'),expiresAt=new Date(Date.now()+30*60*1000).toISOString();
    await sb('/rest/v1/checkout_sessions',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:userId,token_hash:tokenHash,expires_at:expiresAt}});
    return json(200,{checkoutToken:raw,expiresAt,user:{id:userId,email:u.email,displayName:p.display_name||u.user_metadata?.display_name||''},emailConfirmed:!!u.email_confirmed_at});
  }catch(e){return errResponse(e)}
};
