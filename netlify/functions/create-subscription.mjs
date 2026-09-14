import crypto from 'node:crypto';
import { json,parseBody,requirePaymentProfile,errResponse,env,sb,getSetting,mpSubscriptionsToken,mpError,mpCardPayerEmail,purchaseGuard } from './_lib.mjs';

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event);const {user,p}=await requirePaymentProfile(event,body);
    purchaseGuard(p,'monthly');
    const card=body.card||{};
    const token=mpSubscriptionsToken(),plan=env('MP_PLAN_ID');
    const planRes=await fetch(`https://api.mercadopago.com/preapproval_plan/${encodeURIComponent(plan)}`,{headers:{Authorization:`Bearer ${token}`}});
    const planData=await planRes.json().catch(()=>({}));if(!planRes.ok)throw mpError(planData,'Não foi possível validar o plano mensal no Mercado Pago.');
    const providerPrice=Number(planData?.auto_recurring?.transaction_amount),displayPrice=Number(String(await getSetting('pro_monthly_price','19.90')).replace(',','.'));
    if(Number.isFinite(providerPrice)&&Number.isFinite(displayPrice)&&Math.abs(providerPrice-displayPrice)>.009)return json(409,{error:`O preço mensal exibido (R$ ${displayPrice.toFixed(2).replace('.',',')}) está diferente do plano no Mercado Pago (R$ ${providerPrice.toFixed(2).replace('.',',')}). Ajuste antes de vender.`});
    if(!card.token) return json(400,{error:'Token do cartão ausente. Preencha os dados do cartão novamente.'});
    if(!card.payer?.email) return json(400,{error:'Informe o e-mail do pagador.'});
    const payerEmail=String(mpCardPayerEmail(card.payer.email)).trim();
    const payload={
      preapproval_plan_id:String(plan),
      external_reference:String(user.id),
      payer_email:payerEmail,
      card_token_id:String(card.token),
      status:'authorized'
    };
    if(String(process.env.MP_TEST_MODE||'').toLowerCase()==='true'){
      const maskedEmail=payerEmail.replace(/^(.{1,2}).*(@.*)$/,'$1***$2');
      console.info('MP subscription diagnostic',{
        testMode:true,
        planId:String(plan),
        planStatus:planData?.status||null,
        planApplicationId:planData?.application_id||null,
        planCollectorId:planData?.collector_id||null,
        planAmount:planData?.auto_recurring?.transaction_amount??null,
        planCurrency:planData?.auto_recurring?.currency_id||null,
        payerEmail:maskedEmail,
        cardTokenLength:String(card.token).length,
        paymentMethodId:card.payment_method_id||null,
        issuerId:card.issuer_id||null
      });
    }
    const r=await fetch('https://api.mercadopago.com/preapproval',{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':crypto.randomUUID()},
      body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      if(String(process.env.MP_TEST_MODE||'').toLowerCase()==='true')console.error('MP preapproval rejected',{httpStatus:r.status,response:data});
      throw mpError(data,'Não foi possível criar a assinatura mensal.');
    }
    if(!data.id)throw mpError(data,'O Mercado Pago não retornou o identificador da assinatura.');
    await sb('/rest/v1/payment_orders',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{user_id:user.id,provider_order_id:String(data.id),kind:'subscription',status:String(data.status||'pending'),amount:null,access_days:null,plan_code:'monthly',payment_method:'card',raw:data}});
    if(String(data.status||'').toLowerCase()==='authorized'){
      await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{plan:'pro',subscription_status:'authorized',subscription_id:String(data.id),access_expires_at:null,pro_started_at:p.pro_started_at||new Date().toISOString()}});
    }
    return json(200,{subscriptionId:data.id,status:data.status||'pending',authorized:String(data.status||'').toLowerCase()==='authorized'});
  }catch(e){return errResponse(e)}
};
