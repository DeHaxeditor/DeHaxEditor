import { json,parseBody,requireProfile,sb,errResponse,mpSubscriptionsToken,mpError,addCalendarMonths,activeRetentionOffer,recordExitFeedback,getSetting } from './_lib.mjs';

const REASONS=new Set(['price','low_usage','content_fit','ux','technical','other']);
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event),reason=String(body.reason||'');
    if(!REASONS.has(reason))return json(400,{error:'Selecione um motivo para continuar.'});
    const {user,p}=await requireProfile(event);
    const subscriptionStatus=String(p.subscription_status||'').toLowerCase();
    if(p.plan!=='pro'||!p.subscription_id||!['authorized','active','trialing'].includes(subscriptionStatus))throw Object.assign(new Error('Não há assinatura recorrente PRO ativa vinculada a esta conta.'),{status:404});
    const id=String(p.subscription_id),headers={Authorization:`Bearer ${mpSubscriptionsToken()}`,'Content-Type':'application/json'};
    const currentRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers});
    let current=await currentRes.json().catch(()=>({}));if(!currentRes.ok)throw mpError(current,'Não foi possível consultar sua assinatura no Mercado Pago.');
    if(String(current.external_reference||'')!==String(user.id))throw Object.assign(new Error('A assinatura não corresponde a esta conta.'),{status:403});
    if(String(current.status||'').toLowerCase()==='canceled')return json(200,{ok:true,status:'canceled',alreadyCanceled:true,accessUntil:p.access_expires_at||null});

    // Se o membro havia aceitado uma oferta temporária, restaura o valor normal antes de cancelar.
    const offer=await activeRetentionOffer(user.id,'monthly');
    if(offer){
      const original=Number(offer.original_amount||Number(String(await getSetting('pro_monthly_price','19.90')).replace(',','.'))||19.9),currency=current?.auto_recurring?.currency_id||'BRL';
      try{
        const rr=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{method:'PUT',headers,body:JSON.stringify({auto_recurring:{transaction_amount:original,currency_id:currency}})}),rd=await rr.json().catch(()=>({}));
        if(rr.ok)current=rd;
      }catch{}
      await sb(`/rest/v1/retention_offers?id=eq.${encodeURIComponent(offer.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',completed_at:new Date().toISOString()}}).catch(()=>{});
    }

    // Política DeHax: cancela a renovação, mas preserva o acesso já pago até o fim do ciclo atual.
    const nextDate=current.next_payment_date?new Date(current.next_payment_date):null;
    let accessUntil=nextDate&&Number.isFinite(nextDate.getTime())&&nextDate.getTime()>Date.now()?nextDate.toISOString():(p.access_expires_at&&new Date(p.access_expires_at).getTime()>Date.now()?p.access_expires_at:null);
    if(!accessUntil&&p.pro_started_at){let cycle=new Date(p.pro_started_at);if(Number.isFinite(cycle.getTime())){let guard=0;while(cycle.getTime()<=Date.now()&&guard++<60)cycle=addCalendarMonths(cycle,1);if(cycle.getTime()>Date.now())accessUntil=cycle.toISOString()}}
    const cancelRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{method:'PUT',headers,body:JSON.stringify({status:'canceled'})});
    const canceled=await cancelRes.json().catch(()=>({}));if(!cancelRes.ok)throw mpError(canceled,'Não foi possível cancelar a assinatura no Mercado Pago.');
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{subscription_status:'canceled',plan:accessUntil?'pro':'free',access_expires_at:accessUntil}});
    try{await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.subscription`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',raw:canceled}})}catch{}
    await recordExitFeedback({userId:user.id,subscriptionId:id,planCode:'monthly',reason,decision:'canceled'});
    return json(200,{ok:true,status:'canceled',accessUntil});
  }catch(e){return errResponse(e)}
};
