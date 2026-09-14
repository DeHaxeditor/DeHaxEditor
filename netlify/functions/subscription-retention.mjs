import { json,parseBody,requireProfile,errResponse,sb,getSetting,mpSubscriptionsToken,mpError,membershipTier,activeRetentionOffer,retentionSettings,recordExitFeedback } from './_lib.mjs';

const REASONS=new Set(['price','low_usage','content_fit','ux','technical','other']);
const round2=n=>Math.round(Number(n||0)*100)/100;

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event),action=String(body.action||''),reason=String(body.reason||'');
    if(!REASONS.has(reason))return json(400,{error:'Selecione um motivo para continuar.'});
    if(!['accept','decline'].includes(action))return json(400,{error:'Ação de retenção inválida.'});
    const {user,p}=await requireProfile(event);const tier=membershipTier(p);
    if(!['monthly','semester'].includes(tier))return json(409,{error:'Esta conta não possui um plano elegível para esta ação.'});
    const cfg=await retentionSettings();

    if(action==='decline'){
      if(tier==='semester'){
        const reserved=await activeRetentionOffer(user.id,'semester');
        if(reserved)await sb(`/rest/v1/retention_offers?id=eq.${encodeURIComponent(reserved.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'canceled',completed_at:new Date().toISOString()}});
        await recordExitFeedback({userId:user.id,subscriptionId:null,planCode:'semester',reason,decision:'will_not_renew'});
        return json(200,{ok:true,decision:'will_not_renew'});
      }
      return json(400,{error:'Use a confirmação de cancelamento para encerrar a recorrência mensal.'});
    }

    const existing=await activeRetentionOffer(user.id,tier);
    if(existing)return json(200,{ok:true,alreadyActive:true,offer:{planCode:tier,discountPercent:Number(existing.discount_percent||cfg.discountPercent),discountedAmount:existing.discounted_amount,cyclesTotal:existing.cycles_total,cyclesUsed:existing.cycles_used}});

    if(tier==='semester'){
      const normal=round2(Number(String(await getSetting('pro_semester_total','59.40')).replace(',','.'))||59.4),discounted=round2(normal*(1-cfg.discountPercent/100));
      const {data:rows}=await sb('/rest/v1/retention_offers',{method:'POST',headers:{Prefer:'return=representation'},body:{user_id:user.id,subscription_id:null,plan_code:'semester',discount_percent:cfg.discountPercent,original_amount:normal,discounted_amount:discounted,cycles_total:1,status:'active'}});
      await recordExitFeedback({userId:user.id,subscriptionId:null,planCode:'semester',reason,decision:'kept_with_offer'});
      return json(200,{ok:true,offer:{id:rows?.[0]?.id||null,planCode:'semester',discountPercent:cfg.discountPercent,originalAmount:normal,discountedAmount:discounted,cyclesTotal:1,message:'Seu desconto fica reservado para a próxima renovação semestral.'}});
    }

    const status=String(p.subscription_status||'').toLowerCase();
    if(!p.subscription_id||!['authorized','active','trialing'].includes(status))return json(409,{error:'O desconto automático de permanência está disponível apenas para o PRO Mensal com recorrência ativa no cartão.'});
    const headers={Authorization:`Bearer ${mpSubscriptionsToken()}`,'Content-Type':'application/json'},id=String(p.subscription_id);
    const currentRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{headers});const current=await currentRes.json().catch(()=>({}));
    if(!currentRes.ok)throw mpError(current,'Não foi possível consultar sua assinatura para aplicar o benefício.');
    if(String(current.external_reference||'')!==String(user.id))throw Object.assign(new Error('A assinatura informada não pertence a esta conta.'),{status:403,expose:true});
    const normal=round2(Number(String(await getSetting('pro_monthly_price',current?.auto_recurring?.transaction_amount||'19.90')).replace(',','.'))||Number(current?.auto_recurring?.transaction_amount)||19.9),discounted=round2(normal*(1-cfg.discountPercent/100)),currency=current?.auto_recurring?.currency_id||'BRL';
    const updateRes=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`,{method:'PUT',headers,body:JSON.stringify({auto_recurring:{transaction_amount:discounted,currency_id:currency}})});const updated=await updateRes.json().catch(()=>({}));
    if(!updateRes.ok)throw mpError(updated,'Não foi possível aplicar o desconto na assinatura.');
    const {data:rows}=await sb('/rest/v1/retention_offers',{method:'POST',headers:{Prefer:'return=representation'},body:{user_id:user.id,subscription_id:id,plan_code:'monthly',discount_percent:cfg.discountPercent,original_amount:normal,discounted_amount:discounted,cycles_total:cfg.monthlyCycles,status:'active',provider_snapshot:updated}});
    await recordExitFeedback({userId:user.id,subscriptionId:id,planCode:'monthly',reason,decision:'kept_with_offer'});
    return json(200,{ok:true,offer:{id:rows?.[0]?.id||null,planCode:'monthly',discountPercent:cfg.discountPercent,originalAmount:normal,discountedAmount:discounted,cyclesTotal:cfg.monthlyCycles,message:`Desconto aplicado às próximas ${cfg.monthlyCycles} cobranças mensais.`}});
  }catch(e){return errResponse(e)}
};
