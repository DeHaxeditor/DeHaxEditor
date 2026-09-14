import crypto from 'node:crypto';
import { json,parseBody,requireProfile,errResponse,getSetting,sb,mpOrdersToken,mpDebug,mpError } from './_lib.mjs';

const money=v=>Math.max(.01,Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0);
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event);
    const recurringActive=!!p.subscription_id&&['authorized','active','trialing'].includes(String(p.subscription_status||'').toLowerCase());
    if(recurringActive)return json(409,{error:'Você já possui renovação automática ativa no cartão. Cancele a recorrência em Minha Conta antes de mudar para Pix; o período já pago será preservado.'});
    const body=parseBody(event),planCode=String(body.planCode||'');
    if(!['monthly','semester'].includes(planCode))return json(400,{error:'Plano Pix inválido.'});
    const token=mpOrdersToken();
    const monthly=planCode==='monthly';
    const amount=money(await getSetting(monthly?'pro_monthly_price':'pro_semester_total',monthly?'19.90':'59.40'))||(monthly?19.90:59.40);
    const accessDays=monthly?Math.max(1,Math.round(Number(await getSetting('pix_access_days',30))||30)):null;
    const expiresAt=new Date(Date.now()+30*60*1000).toISOString(),localId=crypto.randomUUID();
    const payerEmail=mpDebug()?(process.env.MP_TEST_PIX_PAYER_EMAIL||'test_user_br@testuser.com'):user.email;
    const payload={type:'online',total_amount:amount.toFixed(2),external_reference:`dehax:${user.id}:${localId}`,processing_mode:'automatic',transactions:{payments:[{amount:amount.toFixed(2),payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT30M'}]},payer:{email:payerEmail}};
    const r=await fetch('https://api.mercadopago.com/v1/orders',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':localId},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw mpError(data,'Não foi possível gerar o Pix.');
    const payment=data.transactions?.payments?.[0]||{},pm=payment.payment_method||{};
    await sb('/rest/v1/payment_orders',{method:'POST',headers:{Prefer:'return=minimal'},body:{id:localId,user_id:user.id,provider_order_id:String(data.id||''),kind:'pix',status:String(data.status||'pending'),amount,access_days:accessDays,plan_code:planCode,payment_method:'pix',access_granted_at:null,raw:data}});
    return json(200,{orderId:data.id,localId,status:data.status,expiresAt,planCode,accessDays,qrCode:pm.qr_code||payment.qr_code||'',qrCodeBase64:pm.qr_code_base64||payment.qr_code_base64||'',ticketUrl:pm.ticket_url||payment.ticket_url||'',testMode:mpDebug()});
  }catch(e){return errResponse(e)}
};
