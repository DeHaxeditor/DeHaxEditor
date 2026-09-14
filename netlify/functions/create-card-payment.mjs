import crypto from 'node:crypto';
import { json,parseBody,requirePaymentProfile,errResponse,getSetting,sb,mpSubscriptionsToken,mpError,grantFixedProForOrder,mpCardPayerEmail } from './_lib.mjs';

const money=v=>Math.max(.01,Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0);
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event);const {user,p}=await requirePaymentProfile(event,body);const recurringActive=!!p.subscription_id&&['authorized','active','trialing'].includes(String(p.subscription_status||'').toLowerCase());if(recurringActive)return json(409,{error:'Você já possui uma assinatura mensal recorrente ativa. Cancele a renovação mensal antes de contratar o semestral.'});const card=body.card||{};
    if(body.planCode!=='semester')return json(400,{error:'Plano de pagamento avulso inválido.'});
    if(!card.token)return json(400,{error:'Token do cartão ausente. Preencha os dados do cartão novamente.'});
    if(!card.payment_method_id)return json(400,{error:'Meio de pagamento do cartão ausente.'});
    if(!card.payer?.email)return json(400,{error:'Informe o e-mail do pagador.'});
    const amount=money(await getSetting('pro_semester_total','59.40'))||59.40;
    const payload={
      transaction_amount:Number(amount.toFixed(2)),
      token:String(card.token),
      description:'DeHax PRO — acesso semestral (6 meses)',
      external_reference:user.id,
      installments:1,
      payment_method_id:String(card.payment_method_id),
      payer:{email:String(mpCardPayerEmail(card.payer.email))}
    };
    if(card.issuer_id)payload.issuer_id=String(card.issuer_id);
    if(card.payer?.identification?.type&&card.payer?.identification?.number)payload.payer.identification={type:String(card.payer.identification.type),number:String(card.payer.identification.number)};
    const localId=crypto.randomUUID();
    const r=await fetch('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:`Bearer ${mpSubscriptionsToken()}`,'Content-Type':'application/json','X-Idempotency-Key':localId},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw mpError(data,'Não foi possível processar o pagamento semestral no cartão.');
    if(!data.id)throw mpError(data,'O Mercado Pago não retornou o identificador do pagamento.');
    const status=String(data.status||'pending');
    await sb('/rest/v1/payment_orders',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{id:localId,user_id:user.id,provider_order_id:String(data.id||''),kind:'card_once',status,amount,access_days:null,plan_code:'semester',payment_method:'card',access_granted_at:null,raw:data}});
    let accessExpiresAt=null;
    if(status==='approved')accessExpiresAt=await grantFixedProForOrder(localId);
    if(status==='rejected')throw Object.assign(mpError(data,`Pagamento recusado${data.status_detail?`: ${data.status_detail}`:''}.`,422),{status:422});
    return json(200,{paymentId:data.id,status,statusDetail:data.status_detail||'',paid:!!accessExpiresAt,accessExpiresAt});
  }catch(e){return errResponse(e)}
};
