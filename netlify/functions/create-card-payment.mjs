import crypto from 'node:crypto';
import { json,parseBody,requirePaymentProfile,errResponse,getSetting,sb,mpOrdersToken,mpDebug,mpError,grantFixedProForOrder,purchaseGuard,cancelRecurringForSemesterUpgrade,profile,semesterRetentionPrice,redeemSemesterRetentionForOrder,sendPurchaseConfirmation } from './_lib.mjs';

const money=v=>Math.max(.01,Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0);
const paidOrder=data=>String(data?.status||'')==='processed'||data?.transactions?.payments?.some(p=>String(p?.status||'')==='processed'&&(!p?.status_detail||String(p.status_detail)==='accredited'));
const safeOrderRef=id=>`dhx_${String(id||'').replace(/[^a-zA-Z0-9_-]/g,'').replace(/-/g,'_').slice(0,56)}`.slice(0,64);
const logJson=(label,value,method='error')=>{try{console[method](label,JSON.stringify(value,null,2))}catch{console[method](label,value)}};

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event);const {user,p}=await requirePaymentProfile(event,body);
    if(body.planCode!=='semester')return json(400,{error:'Plano de pagamento avulso inválido.'});
    purchaseGuard(p,'semester');
    const card=body.card||{};
    if(!card.token)return json(400,{error:'Token do cartão ausente. Preencha os dados do cartão novamente.'});
    if(!card.payment_method_id)return json(400,{error:'Meio de pagamento do cartão ausente.'});

    const normalPlanAmount=money(await getSetting('pro_semester_total','59.40'))||59.40;
    const retention=await semesterRetentionPrice(user.id,normalPlanAmount),planAmount=money(retention.amount)||normalPlanAmount;
    // A documentação de sandbox da Orders API usa R$ 50,00 nos exemplos oficiais.
    // Mantemos o preço comercial no banco/UI e usamos o valor técnico somente quando MP_TEST_MODE=true.
    const providerAmount=mpDebug()?50:planAmount;
    const localId=crypto.randomUUID();
    const externalReference=safeOrderRef(localId);
    const payerEmail=mpDebug()?'test@testuser.com':String(card.payer?.email||user.email||'');

    const paymentMethod={id:String(card.payment_method_id),type:'credit_card',token:String(card.token),installments:1};
    const payer={email:payerEmail};
    // No sandbox, enviar apenas os campos do exemplo oficial reduz rejeições por propriedades extras.
    if(!mpDebug()){
      if(card.issuer_id)paymentMethod.issuer_id=String(card.issuer_id);
      if(card.payer?.identification?.type&&card.payer?.identification?.number){
        payer.identification={type:String(card.payer.identification.type),number:String(card.payer.identification.number)};
      }
    }

    const payload={
      type:'online',
      processing_mode:'automatic',
      total_amount:providerAmount.toFixed(2),
      external_reference:externalReference,
      payer,
      transactions:{payments:[{amount:providerAmount.toFixed(2),payment_method:paymentMethod}]}
    };

    if(mpDebug())logJson('MP Orders card diagnostic',{
      testMode:true,
      planAmount:planAmount.toFixed(2),
      providerAmount:providerAmount.toFixed(2),
      payerEmail,
      externalReference,
      externalReferenceLength:externalReference.length,
      paymentMethodId:paymentMethod.id,
      tokenLength:String(card.token).length,
      installments:1
    },'info');

    const r=await fetch('https://api.mercadopago.com/v1/orders',{
      method:'POST',
      headers:{Authorization:`Bearer ${mpOrdersToken()}`,'Content-Type':'application/json','X-Idempotency-Key':localId},
      body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      if(mpDebug())logJson('MP Orders card rejected',{httpStatus:r.status,response:data});
      throw mpError(data,'Não foi possível processar o pagamento semestral no cartão.');
    }
    if(!data.id)throw mpError(data,'O Mercado Pago não retornou o identificador da order.');

    const status=String(data.status||'pending');
    const {data:orders}=await sb('/rest/v1/payment_orders',{
      method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},
      body:{id:localId,user_id:user.id,provider_order_id:String(data.id),kind:'card_once',status,amount:planAmount,access_days:null,plan_code:'semester',payment_method:'card',access_granted_at:null,raw:data}
    });
    const order=orders?.[0]||{id:localId,purchase_code:null};
    let accessExpiresAt=null;
    if(paidOrder(data)){
      await cancelRecurringForSemesterUpgrade(user.id,p);
      accessExpiresAt=await grantFixedProForOrder(localId);
      if(retention.offer)await redeemSemesterRetentionForOrder(user.id,localId);
      await sendPurchaseConfirmation(localId,{accessUntil:accessExpiresAt});
    }
    const payment=data.transactions?.payments?.[0]||{};
    const rejected=['failed','cancelled','canceled'].includes(status)||['rejected','failed','cancelled','canceled'].includes(String(payment.status||''));
    if(rejected)throw Object.assign(mpError(data,`Pagamento recusado${payment.status_detail?`: ${payment.status_detail}`:''}.`,422),{status:422});
    return json(200,{paymentId:data.id,status,statusDetail:payment.status_detail||'',paid:!!accessExpiresAt,accessExpiresAt,testMode:mpDebug(),providerAmount:providerAmount.toFixed(2),purchaseCode:order?.purchase_code||null,retentionDiscount:retention.offer?Number(retention.offer.discount_percent||10):0});
  }catch(e){return errResponse(e)}
};
