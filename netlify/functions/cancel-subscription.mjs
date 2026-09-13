import { json,requireProfile,sb,env,errResponse } from './_lib.mjs';

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event);
    if(!p.subscription_id)throw Object.assign(new Error('Não há assinatura recorrente vinculada a esta conta.'),{status:404});
    const id=String(p.subscription_id);
    const headers={Authorization:`Bearer ${env('MP_ACCESS_TOKEN')}`,'Content-Type':'application/json'};
    const currentRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers});
    if(!currentRes.ok)throw Object.assign(new Error('Não foi possível consultar sua assinatura no Mercado Pago.'),{status:502});
    const current=await currentRes.json();
    if(String(current.external_reference||'')!==String(user.id))throw Object.assign(new Error('A assinatura não corresponde a esta conta.'),{status:403});
    if(process.env.MP_PLAN_ID&&current.preapproval_plan_id&&current.preapproval_plan_id!==process.env.MP_PLAN_ID)throw Object.assign(new Error('A assinatura pertence a outro plano.'),{status:403});
    if(String(current.status||'').toLowerCase()==='canceled')return json(200,{ok:true,status:'canceled',alreadyCanceled:true,accessUntil:p.access_expires_at||null});

    const nextDate=current.next_payment_date?new Date(current.next_payment_date):null;
    const accessUntil=nextDate&&Number.isFinite(nextDate.getTime())&&nextDate.getTime()>Date.now()?nextDate.toISOString():null;
    const cancelRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{method:'PUT',headers,body:JSON.stringify({status:'canceled'})});
    const canceled=await cancelRes.json().catch(()=>({}));
    if(!cancelRes.ok)throw Object.assign(new Error(canceled?.message||'Não foi possível cancelar a assinatura no Mercado Pago.'),{status:502});

    const keepAccess=!!accessUntil;
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{subscription_status:'canceled',plan:keepAccess?'pro':'free',access_expires_at:accessUntil}});
    try{await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.subscription`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',raw:canceled}})}catch{}
    return json(200,{ok:true,status:'canceled',accessUntil});
  }catch(e){return errResponse(e)}
};
