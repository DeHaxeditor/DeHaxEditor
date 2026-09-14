import crypto from 'node:crypto';
import { json,parseBody,sb,errResponse,mpSubscriptionsToken,mpOrdersToken,grantFixedProForOrder } from './_lib.mjs';

function queryParams(event){
  if(event.queryStringParameters)return new URLSearchParams(Object.entries(event.queryStringParameters).filter(([,v])=>v!=null));
  return new URLSearchParams(event.rawQuery||'');
}
function signatureSecret(type){
  if(type==='order'||type.includes('order'))return process.env.MP_ORDERS_WEBHOOK_SECRET||process.env.MP_WEBHOOK_SECRET||'';
  return process.env.MP_SUBSCRIPTIONS_WEBHOOK_SECRET||process.env.MP_WEBHOOK_SECRET||'';
}
function validateSignature(event,type,dataId){
  const secret=signatureSecret(type);if(!secret)return true;
  const sig=String(event.headers['x-signature']||event.headers['X-Signature']||''),requestId=String(event.headers['x-request-id']||event.headers['X-Request-Id']||'');
  const parts=Object.fromEntries(sig.split(',').map(x=>x.split('=').map(v=>v.trim())).filter(x=>x.length===2));
  if(!parts.ts||!parts.v1)return false;
  let manifest='';if(dataId)manifest+=`id:${dataId};`;if(requestId)manifest+=`request-id:${requestId};`;manifest+=`ts:${parts.ts};`;
  const calc=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
  try{return crypto.timingSafeEqual(Buffer.from(calc,'hex'),Buffer.from(parts.v1,'hex'))}catch{return false}
}
async function handleSubscription(id){
  const r=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${mpSubscriptionsToken()}`}});if(!r.ok)return {ignored:'subscription-not-found'};
  const sub=await r.json();if(process.env.MP_PLAN_ID&&sub.preapproval_plan_id&&sub.preapproval_plan_id!==process.env.MP_PLAN_ID)return {ignored:'different-plan'};
  const userId=String(sub.external_reference||'');if(!/^[0-9a-f-]{30,40}$/i.test(userId))return {ignored:'no-user-reference'};
  const status=String(sub.status||'pending'),isActive=status==='authorized';
  const {data:pr}=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=pro_started_at,access_expires_at`);const current=pr?.[0]||{};
  const candidate=status==='canceled'&&sub.next_payment_date?new Date(sub.next_payment_date):null,providerUntil=candidate&&Number.isFinite(candidate.getTime())&&candidate.getTime()>Date.now()?candidate.toISOString():null,existingUntil=status==='canceled'&&current.access_expires_at&&new Date(current.access_expires_at).getTime()>Date.now()?current.access_expires_at:null,accessUntil=providerUntil||existingUntil,keepCanceledAccess=status==='canceled'&&!!accessUntil;
  await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{plan:(isActive||keepCanceledAccess)?'pro':'free',subscription_status:status,subscription_id:sub.id,access_expires_at:keepCanceledAccess?accessUntil:null,pro_started_at:isActive?(current.pro_started_at||new Date().toISOString()):current.pro_started_at||null}});
  try{await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.subscription`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,raw:sub}})}catch{};return {status};
}
async function handleOrder(id){
  const r=await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${mpOrdersToken()}`}});if(!r.ok)return {ignored:'order-not-found'};
  const order=await r.json();const {data:rows}=await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.pix&select=*`);const local=rows?.[0];if(!local)return {ignored:'unknown-order'};
  const paid=String(order.status)==='processed'||order.transactions?.payments?.some(p=>String(p.status)==='processed'&&String(p.status_detail||'')==='accredited');
  if(paid&&['monthly','semester'].includes(String(local.plan_code||'')))await grantFixedProForOrder(local.id);
  await sb(`/rest/v1/payment_orders?id=eq.${encodeURIComponent(local.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:String(order.status||'pending'),raw:order}});return {status:order.status,paid};
}
async function handlePayment(id){
  const r=await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${mpSubscriptionsToken()}`}});if(!r.ok)return {ignored:'payment-not-found'};
  const payment=await r.json();const {data:rows}=await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(id)}&kind=eq.card_once&select=*`);const local=rows?.[0];if(!local)return {ignored:'unknown-payment'};
  const paid=String(payment.status)==='approved';if(paid&&['monthly','semester'].includes(String(local.plan_code||'')))await grantFixedProForOrder(local.id);
  await sb(`/rest/v1/payment_orders?id=eq.${encodeURIComponent(local.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:String(payment.status||'pending'),raw:payment}});return {status:payment.status,paid};
}
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(200,{ok:true});
  try{
    const body=parseBody(event),q=queryParams(event),type=String(body.type||body.topic||q.get('type')||q.get('topic')||''),id=String(q.get('data.id')||body.data?.id||body.id||q.get('id')||'');
    if(!id)return json(200,{ok:true,ignored:'missing-id'});
    if(!validateSignature(event,type,id))return json(401,{ok:false,error:'Assinatura do webhook inválida.'});
    if(type==='subscription_preapproval'||type.includes('preapproval'))return json(200,{ok:true,...await handleSubscription(id)});
    if(type==='order'||type.includes('order'))return json(200,{ok:true,...await handleOrder(id)});
    if(type==='payment'||type.includes('payment'))return json(200,{ok:true,...await handlePayment(id)});
    return json(200,{ok:true,ignored:type||'unknown'});
  }catch(e){return errResponse(e)}
};
