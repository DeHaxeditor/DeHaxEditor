import crypto from 'node:crypto';
import { json,parseBody,requirePaymentProfile,errResponse,getSetting,sb,mpOrdersToken,mpDebug,mpError,purchaseGuard } from './_lib.mjs';

const money=v=>Math.max(.01,Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0);
const safeOrderRef=id=>`dhx_${String(id||'').replace(/[^a-zA-Z0-9_-]/g,'').replace(/-/g,'_').slice(0,56)}`.slice(0,64);
const logJson=(label,value,method='error')=>{try{console[method](label,JSON.stringify(value,null,2))}catch{console[method](label,value)}};

export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const body=parseBody(event);const {user,p}=await requirePaymentProfile(event,body);
    const planCode=String(body.planCode||'');
    if(!['monthly','semester'].includes(planCode))return json(400,{error:'Plano Pix inválido.'});
    purchaseGuard(p,planCode);

    const token=mpOrdersToken();
    const monthly=planCode==='monthly';
    const planAmount=money(await getSetting(monthly?'pro_monthly_price':'pro_semester_total',monthly?'19.90':'59.40'))||(monthly?19.90:59.40);
    const providerAmount=mpDebug()?50:planAmount;
    const accessDays=monthly?Math.max(1,Math.round(Number(await getSetting('pix_access_days',30))||30)):null;
    const expiresAt=new Date(Date.now()+30*60*1000).toISOString(),localId=crypto.randomUUID();
    const externalReference=safeOrderRef(localId);
    const payerEmail=mpDebug()?(process.env.MP_TEST_PIX_PAYER_EMAIL||'test_user_br@testuser.com'):user.email;

    let payload;
    if(mpDebug()){
      // O teste oficial do Pix via Orders exige valores predefinidos.
      payload={
        type:'online',
        external_reference:externalReference,
        total_amount:providerAmount.toFixed(2),
        payer:{email:payerEmail,first_name:'APRO'},
        transactions:{payments:[{amount:providerAmount.toFixed(2),payment_method:{id:'pix',type:'bank_transfer'}}]}
      };
      logJson('MP Orders Pix diagnostic',{
        testMode:true,
        planCode,
        planAmount:planAmount.toFixed(2),
        providerAmount:providerAmount.toFixed(2),
        payerEmail,
        firstName:'APRO',
        externalReference,
        externalReferenceLength:externalReference.length
      },'info');
    }else{
      payload={
        type:'online',
        total_amount:providerAmount.toFixed(2),
        external_reference:externalReference,
        processing_mode:'automatic',
        transactions:{payments:[{amount:providerAmount.toFixed(2),payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT30M'}]},
        payer:{email:payerEmail}
      };
    }

    const r=await fetch('https://api.mercadopago.com/v1/orders',{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':localId},body:JSON.stringify(payload)
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      if(mpDebug())logJson('MP Orders Pix rejected',{httpStatus:r.status,response:data});
      throw mpError(data,'Não foi possível gerar o Pix.');
    }
    const payment=data.transactions?.payments?.[0]||{},pm=payment.payment_method||{};
    await sb('/rest/v1/payment_orders',{
      method:'POST',headers:{Prefer:'return=minimal'},
      body:{id:localId,user_id:user.id,provider_order_id:String(data.id||''),kind:'pix',status:String(data.status||'pending'),amount:planAmount,access_days:accessDays,plan_code:planCode,payment_method:'pix',access_granted_at:null,raw:data}
    });
    return json(200,{orderId:data.id,localId,status:data.status,expiresAt,planCode,accessDays,qrCode:pm.qr_code||payment.qr_code||'',qrCodeBase64:pm.qr_code_base64||payment.qr_code_base64||'',ticketUrl:pm.ticket_url||payment.ticket_url||'',testMode:mpDebug(),providerAmount:providerAmount.toFixed(2)});
  }catch(e){return errResponse(e)}
};
