import crypto from 'node:crypto';
import { json,parseBody,requireProfile,activePro,errResponse,env,sb,getSetting,mpSubscriptionsToken,mpError,mpCardPayerEmail } from './_lib.mjs';

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event);
    if(activePro(p))return json(409,{error:p.access_expires_at?'Seu PRO já está ativo até o período informado na sua conta. Aguarde o término para iniciar o plano mensal.':'Sua assinatura recorrente PRO já está ativa.'});
    const body=parseBody(event),card=body.card||{};
    const token=mpSubscriptionsToken(),plan=env('MP_PLAN_ID');
    const planRes=await fetch(`https://api.mercadopago.com/preapproval_plan/${encodeURIComponent(plan)}`,{headers:{Authorization:`Bearer ${token}`}});
    const planData=await planRes.json().catch(()=>({}));if(!planRes.ok)throw mpError(planData,'Não foi possível validar o plano mensal no Mercado Pago.');
    const providerPrice=Number(planData?.auto_recurring?.transaction_amount),displayPrice=Number(String(await getSetting('pro_monthly_price','19.90')).replace(',','.'));
    if(Number.isFinite(providerPrice)&&Number.isFinite(displayPrice)&&Math.abs(providerPrice-displayPrice)>.009)return json(409,{error:`O preço mensal exibido (R$ ${displayPrice.toFixed(2).replace('.',',')}) está diferente do plano no Mercado Pago (R$ ${providerPrice.toFixed(2).replace('.',',')}). Ajuste antes de vender.`});
    if(!card.token) return json(400,{error:'Token do cartão ausente. Preencha os dados do cartão novamente.'});
    if(!card.payer?.email) return json(400,{error:'Informe o e-mail do pagador.'});
    const proto=event.headers['x-forwarded-proto']||'https',host=event.headers.host;
    const backUrl=`${proto}://${host}/checkout/?retorno=cartao`;
    const payload={
      preapproval_plan_id:plan,
      reason:'DeHax PRO — assinatura mensal',
      external_reference:user.id,
      payer_email:String(mpCardPayerEmail(card.payer.email)),
      card_token_id:String(card.token),
      back_url:backUrl,
      status:'authorized'
    };
    const r=await fetch('https://api.mercadopago.com/preapproval',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()},
      body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw mpError(data,'Não foi possível criar a assinatura mensal.');
    if(!data.id)throw mpError(data,'O Mercado Pago não retornou o identificador da assinatura.');
    await sb('/rest/v1/payment_orders',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{user_id:user.id,provider_order_id:String(data.id),kind:'subscription',status:String(data.status||'pending'),amount:null,access_days:null,plan_code:'monthly',payment_method:'card',raw:data}});
    if(String(data.status||'').toLowerCase()==='authorized'){
      await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{plan:'pro',subscription_status:'authorized',subscription_id:String(data.id),access_expires_at:null,pro_started_at:p.pro_started_at||new Date().toISOString()}});
    }
    return json(200,{subscriptionId:data.id,status:data.status||'pending',authorized:String(data.status||'').toLowerCase()==='authorized'});
  }catch(e){return errResponse(e)}
};
