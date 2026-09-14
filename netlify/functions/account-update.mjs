import { json,parseBody,requireProfile,errResponse,sb,supabaseUrl,serviceKey } from './_lib.mjs';

async function updateAuthUser(id,body){
  const r=await fetch(`${supabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'PUT',headers:{apikey:serviceKey(),Authorization:`Bearer ${serviceKey()}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(d?.message||d?.msg||'Não foi possível atualizar a conta.'),{status:r.status});
  return d;
}
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user}=await requireProfile(event),body=parseBody(event),action=String(body.action||'profile');
    if(action==='profile'){
      const name=String(body.displayName||'').trim().replace(/\s+/g,' ').slice(0,80);
      if(name.length<2)return json(400,{error:'Informe um nome válido.'});
      await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{display_name:name}});
      await updateAuthUser(user.id,{user_metadata:{...(user.user_metadata||{}),display_name:name}});
      return json(200,{ok:true,displayName:name});
    }
    if(action==='password'){
      const password=String(body.password||'');
      if(password.length<8)return json(400,{error:'A nova senha precisa ter pelo menos 8 caracteres.'});
      await updateAuthUser(user.id,{password});
      return json(200,{ok:true});
    }
    return json(400,{error:'Ação inválida.'});
  }catch(e){return errResponse(e)}
};
