import { json,requireProfile,sb,errResponse,mpSubscriptionsToken,mpError,addCalendarMonths } from './_lib.mjs';

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event);
    const subscriptionStatus=String(p.subscription_status||'').toLowerCase();
    if(p.plan!=='pro'||!p.subscription_id||!['authorized','active','trialing'].includes(subscriptionStatus))throw Object.assign(new Error('Não há assinatura recorrente PRO ativa vinculada a esta conta.'),{status:404});
    const id=String(p.subscription_id),headers={Authorization:`Bearer ${mpSubscriptionsToken()}`,'Content-Type':'application/json'};
    const currentRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers});
    const current=await currentRes.json().catch(()=>({}));if(!currentRes.ok)throw mpError(current,'Não foi possível consultar sua assinatura no Mercado Pago.');
    if(String(current.external_reference||'')!==String(user.id))throw Object.assign(new Error('A assinatura não corresponde a esta conta.'),{status:403});
    if(String(current.status||'').toLowerCase()==='canceled')return json(200,{ok:true,status:'canceled',alreadyCanceled:true,accessUntil:p.access_expires_at||null});

    // Política DeHax: cancelamos a renovação imediatamente, mas preservamos o acesso já pago
    // até a próxima data de cobrança informada pelo Mercado Pago. Isso evita retirar um período já pago.
    const nextDate=current.next_payment_date?new Date(current.next_payment_date):null;
    let accessUntil=nextDate&&Number.isFinite(nextDate.getTime())&&nextDate.getTime()>Date.now()?nextDate.toISOString():(p.access_expires_at&&new Date(p.access_expires_at).getTime()>Date.now()?p.access_expires_at:null);
    // Fallback defensivo: se o provedor não retornar next_payment_date, estima o fim do ciclo
    // a partir da primeira ativação, sem retirar imediatamente um período já pago.
    if(!accessUntil&&p.pro_started_at){let cycle=new Date(p.pro_started_at);if(Number.isFinite(cycle.getTime())){let guard=0;while(cycle.getTime()<=Date.now()&&guard++<60)cycle=addCalendarMonths(cycle,1);if(cycle.getTime()>Date.now())accessUntil=cycle.toISOString()}}
    const cancelRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{method:'PUT',headers,body:JSON.stringify({status:'canceled'})});
    const canceled=await cancelRes.json().catch(()=>({}));if(!cancelRes.ok)throw mpError(canceled,'Não foi possível cancelar a assinatura no Mercado Pago.');
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{subscription_status:'canceled',plan:accessUntil?'pro':'free',access_expires_at:accessUntil}});
    try{await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.subscription`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',raw:canceled}})}catch{}
    return json(200,{ok:true,status:'canceled',accessUntil});
  }catch(e){return errResponse(e)}
};
