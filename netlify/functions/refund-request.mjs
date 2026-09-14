import { json,parseBody,requireProfile,errResponse,sb,retentionSettings } from './_lib.mjs';

const digits=v=>String(v||'').replace(/\D/g,'');
const validCpf=v=>{const cpf=digits(v);if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;const calc=len=>{let sum=0;for(let i=0;i<len;i++)sum+=Number(cpf[i])*(len+1-i);const r=(sum*10)%11;return r===10?0:r};return calc(9)===Number(cpf[9])&&calc(10)===Number(cpf[10])};
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event),{user}=await requireProfile(event),purchaseCode=String(body.purchaseCode||'').trim().toUpperCase();
    if(!/^DHX-[A-Z0-9-]{8,}$/i.test(purchaseCode))return json(400,{error:'Informe um ID de compra válido.'});
    const phone=digits(body.phone),cpf=digits(body.cpf),address=body.address||{};
    if(phone.length<10||phone.length>13)return json(400,{error:'Informe um telefone válido com DDD.'});
    if(!validCpf(cpf))return json(400,{error:'Informe um CPF válido.'});
    const street=String(address.street||'').trim(),number=String(address.number||'').trim(),neighborhood=String(address.neighborhood||'').trim(),city=String(address.city||'').trim(),state=String(address.state||'').trim().toUpperCase(),cep=digits(address.cep),complement=String(address.complement||'').trim();
    if(!street||!number||!neighborhood||!city||state.length!==2||cep.length!==8)return json(400,{error:'Preencha o endereço completo, incluindo CEP e UF.'});
    const {data:orders}=await sb(`/rest/v1/payment_orders?user_id=eq.${encodeURIComponent(user.id)}&purchase_code=eq.${encodeURIComponent(purchaseCode)}&select=*&limit=1`);const order=orders?.[0];
    if(!order)return json(404,{error:'ID de compra não encontrado para esta conta.'});
    const okStatus=['approved','processed','authorized','active'].includes(String(order.status||'').toLowerCase());
    if(!okStatus)return json(409,{error:'Esta compra ainda não está em um status elegível para análise de reembolso.'});
    const purchaseDate=new Date(order.access_granted_at||order.created_at);if(!Number.isFinite(purchaseDate.getTime()))return json(409,{error:'Não foi possível determinar a data desta compra.'});
    const cfg=await retentionSettings(),deadline=new Date(purchaseDate.getTime()+cfg.refundDays*86400000);
    if(Date.now()>deadline.getTime())return json(410,{error:`O prazo de ${cfg.refundDays} dias para enviar a solicitação referente a esta compra já encerrou.`,deadline:deadline.toISOString()});
    const {data:dupes}=await sb(`/rest/v1/refund_requests?payment_order_id=eq.${encodeURIComponent(order.id)}&status=in.(pending,reviewing,approved)&select=id,status&limit=1`);
    if(dupes?.length)return json(409,{error:'Já existe uma solicitação de reembolso em andamento para este ID de compra.',requestId:dupes[0].id,status:dupes[0].status});
    const payload={user_id:user.id,payment_order_id:order.id,purchase_code:purchaseCode,purchase_date:purchaseDate.toISOString(),eligibility_deadline:deadline.toISOString(),phone,cpf,address:{street,number,complement,neighborhood,city,state,cep},status:'pending'};
    const {data:created}=await sb('/rest/v1/refund_requests',{method:'POST',headers:{Prefer:'return=representation'},body:payload});
    return json(200,{ok:true,id:created?.[0]?.id||null,status:'pending',deadline:deadline.toISOString(),message:'Solicitação enviada para análise do suporte DeHax.'});
  }catch(e){return errResponse(e)}
};
