import { sb,mpSubscriptionsToken,mpError,getSetting } from './_lib.mjs';

const paidInvoice=x=>['approved','processed'].includes(String(x?.payment?.status||x?.status||x?.summarized||'').toLowerCase());
const invoiceDate=x=>new Date(x?.debit_date||x?.date_created||x?.payment?.date_approved||0).getTime();
export default async ()=>{
  const {data:offers}=await sb('/rest/v1/retention_offers?status=eq.active&plan_code=eq.monthly&select=*&limit=100');
  let restored=0,checked=0;
  for(const offer of offers||[]){
    checked++;
    try{
      if(!offer.subscription_id)continue;
      const token=mpSubscriptionsToken(),subRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(offer.subscription_id)}`,{headers:{Authorization:`Bearer ${token}`}}),sub=await subRes.json().catch(()=>({}));
      if(!subRes.ok)throw mpError(sub,'Falha ao consultar assinatura durante a manutenção do desconto.');
      if(['canceled','cancelled'].includes(String(sub.status||'').toLowerCase())){
        await sb(`/rest/v1/retention_offers?id=eq.${encodeURIComponent(offer.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',completed_at:new Date().toISOString()}});continue;
      }
      const u=new URL('https://api.mercadopago.com/authorized_payments/search');u.searchParams.set('preapproval_id',String(offer.subscription_id));
      const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json().catch(()=>({}));if(!r.ok)throw mpError(d,'Falha ao consultar cobranças da assinatura.');
      const start=new Date(offer.activated_at||offer.created_at).getTime(),seen=new Set(),count=(d.results||[]).filter(x=>paidInvoice(x)&&invoiceDate(x)>=start).filter(x=>{const id=String(x?.payment?.id||x?.id||invoiceDate(x));if(seen.has(id))return false;seen.add(id);return true}).length,total=Math.max(1,Number(offer.cycles_total||3));
      if(count>=total){
        const original=Number(offer.original_amount||Number(String(await getSetting('pro_monthly_price','19.90')).replace(',','.'))||19.9),currency=sub?.auto_recurring?.currency_id||'BRL';
        const ur=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(offer.subscription_id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({auto_recurring:{transaction_amount:original,currency_id:currency}})});const ud=await ur.json().catch(()=>({}));if(!ur.ok)throw mpError(ud,'Falha ao restaurar o valor original da assinatura.');
        await sb(`/rest/v1/retention_offers?id=eq.${encodeURIComponent(offer.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{cycles_used:count,status:'completed',completed_at:new Date().toISOString(),provider_snapshot:ud}});restored++;
      }else if(Number(offer.cycles_used||0)!==count){await sb(`/rest/v1/retention_offers?id=eq.${encodeURIComponent(offer.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{cycles_used:count}})}
    }catch(e){console.error('retention maintenance',offer.id,e?.message||e)}
  }
  console.log(`Retention discounts: ${checked} verificado(s), ${restored} restaurado(s).`);
};
export const config={schedule:'@daily'};
