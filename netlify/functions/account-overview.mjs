import { json,requireProfile,errResponse,sb,mpSubscriptionsToken,activeRetentionOffer } from './_lib.mjs';

function invoiceRow(x){
  const payment=x?.payment||{};
  return {
    id:`mp-invoice-${x?.id||payment?.id||Math.random().toString(36).slice(2)}`,
    provider_order_id:String(payment?.id||x?.id||''),
    purchase_code:null,
    kind:'subscription_invoice',
    status:String(payment?.status||x?.summarized||x?.status||'pending'),
    amount:Number(x?.transaction_amount||0)||null,
    access_days:null,
    plan_code:'monthly',
    payment_method:'card',
    access_granted_at:payment?.status==='approved'?(x?.debit_date||x?.date_created||null):null,
    created_at:x?.debit_date||x?.date_created||new Date().toISOString(),
    source:'mercadopago'
  };
}

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event);
    const {data:localPayments}=await sb(`/rest/v1/payment_orders?user_id=eq.${encodeURIComponent(user.id)}&select=id,provider_order_id,purchase_code,kind,status,amount,access_days,plan_code,payment_method,access_granted_at,created_at&order=created_at.desc&limit=30`);
    let subscription=null,recurringInvoices=[];
    const hasRecurring=p.subscription_id&&['authorized','active','trialing','canceled','paused'].includes(String(p.subscription_status||'').toLowerCase());
    if(hasRecurring){
      const token=mpSubscriptionsToken();
      try{
        const r=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(p.subscription_id)}`,{headers:{Authorization:`Bearer ${token}`}});
        if(r.ok){
          const d=await r.json();
          subscription={id:d.id,status:d.status,nextPaymentDate:d.next_payment_date||null,amount:Number(d.auto_recurring?.transaction_amount||0)||null,currency:d.auto_recurring?.currency_id||'BRL',paymentMethod:d.payment_method_id||null,lastChargedDate:d.summarized?.last_charged_date||null};
        }
      }catch(e){console.warn('account subscription overview',e?.message||e)}
      // O histórico local registra a contratação inicial. As renovações automáticas são
      // faturas do Mercado Pago, então consultamos o endpoint oficial de authorized payments.
      try{
        const u=new URL('https://api.mercadopago.com/authorized_payments/search');
        u.searchParams.set('preapproval_id',String(p.subscription_id));
        const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});
        if(r.ok){const d=await r.json().catch(()=>({}));recurringInvoices=(d.results||[]).map(invoiceRow)}
      }catch(e){console.warn('account recurring invoices',e?.message||e)}
    }
    const payments=[...(localPayments||[]),...recurringInvoices]
      .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))
      .slice(0,30);
    const retention={monthly:await activeRetentionOffer(user.id,'monthly'),semester:await activeRetentionOffer(user.id,'semester')};
    return json(200,{profile:{id:p.id,displayName:p.display_name||'',email:user.email||p.email||'',plan:p.plan,subscriptionStatus:p.subscription_status,accessExpiresAt:p.access_expires_at,proStartedAt:p.pro_started_at,createdAt:p.created_at},subscription,payments,retention});
  }catch(e){return errResponse(e)}
};
