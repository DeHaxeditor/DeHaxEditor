import crypto from 'node:crypto';
import { json,parseBody,requirePaymentProfile,errResponse,getSetting,sb,mpOrdersToken,mpDebug,mpError,grantFixedProForOrder } from './_lib.mjs';

const money=v=>Math.max(.01,Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0);
const paidOrder=data=>String(data?.status||'')==='processed'||data?.transactions?.payments?.some(p=>String(p?.status||'')==='processed'&&(!p?.status_detail||String(p.status_detail)==='accredited'));
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event);const {user,p}=await requirePaymentProfile(event,body);
    const recurringActive=!!p.subscription_id&&['authorized','active','trialing'].includes(String(p.subscription_status||'').toLowerCase());
    if(recurringActive)return json(409,{error:'Você já possui uma assinatura mensal recorrente ativa. Cancele a renovação mensal antes de contratar o semestral.'});
    const card=body.card||{};
    if(body.planCode!=='semester')return json(400,{error:'Plano de pagamento avulso inválido.'});
    if(!card.token)return json(400,{error:'Token do cartão ausente. Preencha os dados do cartão novamente.'});
    if(!card.payment_method_id)return json(400,{error:'Meio de pagamento do cartão ausente.'});
    const amount=money(await getSetting('pro_semester_total','59.40'))||59.40;
    const localId=crypto.randomUUID();
    const payerEmail=mpDebug()?'test@testuser.com':String(card.payer?.email||user.email||'');
    const paymentMethod={id:String(card.payment_method_id),type:'credit_card',token:String(card.token),installments:1};
    if(card.issuer_id)paymentMethod.issuer_id=String(card.issuer_id);
    const payer={email:payerEmail};
    if(card.payer?.identification?.type&&card.payer?.identification?.number)payer.identification={type:String(card.payer.identification.type),number:String(card.payer.identification.number)};
    const payload={
      type:'online',
      processing_mode:'automatic',
      total_amount:amount.toFixed(2),
      external_reference:`dehax:${user.id}:${localId}`,
      payer,
      transactions:{payments:[{amount:amount.toFixed(2),payment_method:paymentMethod}]}
    };
    if(mpDebug())console.info('MP Orders card diagnostic',{testMode:true,amount:amount.toFixed(2),payerEmail,paymentMethodId:paymentMethod.id,tokenLength:String(card.token).length,installments:1});
    const r=await fetch('https://api.mercadopago.com/v1/orders',{method:'POST',headers:{Authorization:`Bearer ${mpOrdersToken()}`,'Content-Type':'application/json','X-Idempotency-Key':localId},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){if(mpDebug())console.error('MP Orders card rejected',{httpStatus:r.status,response:data});throw mpError(data,'Não foi possível processar o pagamento semestral no cartão.');}
    if(!data.id)throw mpError(data,'O Mercado Pago não retornou o identificador da order.');
    const status=String(data.status||'pending');
    await sb('/rest/v1/payment_orders',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{id:localId,user_id:user.id,provider_order_id:String(data.id),kind:'card_once',status,amount,access_days:null,plan_code:'semester',payment_method:'card',access_granted_at:null,raw:data}});
    let accessExpiresAt=null;
    if(paidOrder(data))accessExpiresAt=await grantFixedProForOrder(localId);
    const payment=data.transactions?.payments?.[0]||{};
    const rejected=['failed','cancelled','canceled'].includes(status)||['rejected','failed','cancelled','canceled'].includes(String(payment.status||''));
    if(rejected)throw Object.assign(mpError(data,`Pagamento recusado${payment.status_detail?`: ${payment.status_detail}`:''}.`,422),{status:422});
    return json(200,{paymentId:data.id,status,statusDetail:payment.status_detail||'',paid:!!accessExpiresAt,accessExpiresAt,testMode:mpDebug()});
  }catch(e){return errResponse(e)}
};
