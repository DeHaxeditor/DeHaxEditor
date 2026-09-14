import { json,parseBody,requirePaymentProfile,errResponse,sb,mpOrdersToken,mpError,grantFixedProForOrder } from './_lib.mjs';

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event);const {user}=await requirePaymentProfile(event,body);const {orderId}=body;
    if(!orderId)return json(400,{error:'Pedido ausente.'});
    const {data:orders}=await sb(`/rest/v1/payment_orders?provider_order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}&select=*`);
    const local=orders?.[0];if(!local)throw Object.assign(new Error('Pedido não encontrado para esta conta.'),{status:404});
    let data,status='',paid=false,accessExpiresAt=null;
    if(local.kind==='pix'||local.kind==='card_once'){
      const r=await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,{headers:{Authorization:`Bearer ${mpOrdersToken()}`}});data=await r.json().catch(()=>({}));if(!r.ok)throw mpError(data,local.kind==='pix'?'Não foi possível consultar o Pix.':'Não foi possível consultar o pagamento no cartão.');
      status=String(data.status||'pending');paid=status==='processed'||data.transactions?.payments?.some(p=>String(p.status)==='processed'&&(!p.status_detail||String(p.status_detail)==='accredited'));
    }else return json(400,{error:'Este pedido não usa consulta de pagamento avulso.'});
    if(paid&&['monthly','semester'].includes(String(local.plan_code||'')))accessExpiresAt=await grantFixedProForOrder(local.id);
    await sb(`/rest/v1/payment_orders?id=eq.${encodeURIComponent(local.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status,raw:data}});
    return json(200,{status,paid,accessExpiresAt,planCode:local.plan_code,accessDays:local.access_days});
  }catch(e){return errResponse(e)}
};
