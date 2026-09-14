(() => {
  const $=s=>document.querySelector(s);
  let profile=null,orderId='',poll=null,settings={},selectedPlan='monthly',brickController=null,bricksBuilder=null;
  const toast=(msg,type='ok')=>{const d=document.createElement('div');d.className=`toast ${type}`;d.textContent=msg;$('#toasts').appendChild(d);setTimeout(()=>d.remove(),4200)};
  const num=v=>Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0;
  const money=v=>num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pro=p=>{if(p?.role==='admin')return true;if(p?.plan!=='pro')return false;const st=String(p.subscription_status||'').toLowerCase(),exp=p.access_expires_at?new Date(p.access_expires_at).getTime():null;if(st==='canceled')return Number.isFinite(exp)&&exp>Date.now();return ['authorized','active','manual','trialing','pix_active','semester_active'].includes(st)&&(!exp||exp>Date.now())};
  const accepted=()=>{if($('#legalAccept').checked)return true;toast('Confirme a leitura dos termos antes de continuar.','error');return false};
  const monthlyPrice=()=>num(settings.pro_monthly_price||settings.pro_price||'19.90')||19.9;
  const semesterTotal=()=>num(settings.pro_semester_total||'59.40')||59.4;
  const semesterMonthly=()=>num(settings.pro_semester_monthly_equiv||'9.90')||9.9;
  const pixDays=()=>Math.max(1,Math.round(num(settings.pix_access_days||30)||30));
  const recurringActive=()=>!!profile?.subscription_id&&['authorized','active','trialing'].includes(String(profile?.subscription_status||'').toLowerCase());
  const activeUntil=()=>profile?.access_expires_at&&new Date(profile.access_expires_at).getTime()>Date.now()?new Date(profile.access_expires_at):null;
  const selectedAmount=()=>selectedPlan==='monthly'?monthlyPrice():semesterTotal();
  const trackPurchase=(method,key='')=>{const amount=selectedAmount(),k=`dehax_purchase_track_${method}_${key||'latest'}`;try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1')}catch{}window.DehaxTracking?.send('purchase_confirmed',{method,plan:selectedPlan,value:amount,currency:'BRL'});window.DehaxTracking?.meta?.('Purchase',{value:amount,currency:'BRL',content_name:`DeHax PRO ${selectedPlan}`})};

  async function loadSettings(){
    if(!DehaxAPI.config.supabaseUrl)return;
    try{const r=await DehaxAPI.supabaseFetch('/rest/v1/app_settings?key=in.(pro_price,pro_monthly_price,pro_semester_monthly_equiv,pro_semester_total,pix_access_days)&select=key,value');if(r.ok)for(const row of await r.json())settings[row.key]=row.value}catch{}
  }
  function renderSettings(){
    const m=monthlyPrice(),s=semesterTotal(),eq=semesterMonthly(),regular=m*6,saving=Math.max(0,regular-s),pct=regular?Math.round((saving/regular)*100):0;
    $('#monthlyPrice').textContent=money(m);$('#semesterMonthly').textContent=money(eq);$('#semesterTotalText').textContent=`R$ ${money(s)} à vista`;$('#semesterDiscount').textContent=`ECONOMIZE R$ ${money(saving)} · ${pct}% OFF`;
    renderPlan();
  }
  function renderPlan(){
    document.querySelectorAll('[data-plan]').forEach(b=>b.classList.toggle('active',b.dataset.plan===selectedPlan));
    const sem=selectedPlan==='semester';$('#payPix').hidden=false;
    $('#cardMethodText').textContent=sem?'Pagamento único · 1x sem parcelamento':'Assinatura mensal recorrente';
    $('#pixMethodText').textContent=sem?'Pagamento único · 6 meses de acesso':`Pagamento avulso · ${pixDays()} dias de acesso`;
    $('#cardBoxDescription').textContent=sem?`Pagamento único de R$ ${money(semesterTotal())}, em 1x. Acesso PRO por 6 meses.`:`R$ ${money(monthlyPrice())}/mês em cobrança recorrente. Cancelamento sem multa, com acesso preservado até o fim do ciclo já pago.`;
    $('#submitCard').textContent=sem?'PAGAR R$ '+money(semesterTotal())+' EM 1X →':'ASSINAR POR R$ '+money(monthlyPrice())+'/MÊS →';
    $('#planSummary').innerHTML=sem?`<b>SEMESTRAL:</b> você paga <strong>R$ ${money(semesterTotal())}</strong> uma única vez e recebe 6 meses de PRO. Não há renovação automática.`:`<b>MENSAL:</b> no cartão, <strong>R$ ${money(monthlyPrice())}/mês</strong> com renovação automática. No Pix, <strong>R$ ${money(monthlyPrice())}</strong> em pagamento avulso para ${pixDays()} dias de PRO, sem renovação automática.`;
    const until=activeUntil(),carry=$('#renewalCarry');
    if(carry){if(until&&!recurringActive()){const dt=new Intl.DateTimeFormat('pt-BR').format(until);carry.hidden=false;carry.innerHTML=`<b>RENOVAÇÃO ANTECIPADA:</b> seu acesso atual vai até <strong>${dt}</strong>. Se pagar agora por Pix ou um plano avulso, o novo período começa somente depois dessa data — você não perde nenhum dia.`}else carry.hidden=true}
    closePaymentBoxes();
  }
  async function closePaymentBoxes(){
    $('#pixBox').hidden=true;$('#cardBox').hidden=true;clearInterval(poll);orderId='';
    if(brickController){try{await brickController.unmount()}catch{}brickController=null;$('#cardPaymentBrick_container').innerHTML=''}
  }
  document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',async()=>{selectedPlan=b.dataset.plan;await closePaymentBoxes();renderPlan()}));

  function cardPayload(formData){
    return {token:formData.token,payment_method_id:formData.payment_method_id,issuer_id:formData.issuer_id,installments:1,payer:{email:formData.payer?.email,identification:formData.payer?.identification||null}};
  }
  async function processCard(formData){
    if(!accepted())throw new Error('Confirme os termos para concluir.');
    const card=cardPayload(formData);const amount=selectedAmount();let d;
    const btn=$('#submitCard');btn.disabled=true;const original=btn.textContent;btn.textContent='PROCESSANDO...';
    try{
      $('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent='Processando com segurança no Mercado Pago...';
      window.DehaxTracking?.send('checkout_method',{method:'card',plan:selectedPlan});window.DehaxTracking?.meta?.('InitiateCheckout',{value:amount,currency:'BRL',content_name:`DeHax PRO ${selectedPlan}`,payment_method:'card'});
      if(selectedPlan==='monthly'){
        d=await DehaxAPI.createSubscription(card);
        if(d.demo||d.authorized){trackPurchase('card_recurring',d.subscriptionId||'subscription');$('#checkoutStatus').className='checkout-status good';$('#checkoutStatus').textContent='Assinatura confirmada. Seu acesso PRO foi liberado.';setTimeout(()=>location.href='/app/#home',1000)}
        else{$('#checkoutStatus').textContent='Assinatura criada e aguardando confirmação do Mercado Pago.'}
      }else{
        d=await DehaxAPI.createCardPayment(card,'semester');
        if(d.demo||d.paid){trackPurchase('card_semester',d.paymentId||'card');$('#checkoutStatus').className='checkout-status good';$('#checkoutStatus').textContent='Pagamento aprovado. Seus 6 meses de PRO já estão ativos.';setTimeout(()=>location.href='/app/#home',1000)}
        else if(d.paymentId){orderId=String(d.paymentId);$('#checkoutStatus').textContent='Pagamento em análise. Vamos verificar automaticamente.';clearInterval(poll);poll=setInterval(checkPayment,3000)}
      }
      return d;
    }finally{btn.disabled=false;btn.textContent=original}
  }

  async function renderCardBrick(){
    if(!accepted())return;
    if(!DehaxAPI.config.mpPublicKey){toast('MP_PUBLIC_KEY ainda não foi configurada no Netlify.','error');return}
    $('#pixBox').hidden=true;$('#cardBox').hidden=false;$('#checkoutStatus').textContent='';$('#cardBrickLoading').hidden=false;
    if(brickController){try{await brickController.unmount()}catch{}brickController=null;$('#cardPaymentBrick_container').innerHTML=''}
    try{
      if(!window.MercadoPago)throw new Error('SDK do Mercado Pago não carregou. Atualize a página e tente novamente.');
      if(!bricksBuilder){const mp=new MercadoPago(DehaxAPI.config.mpPublicKey,{locale:'pt-BR'});bricksBuilder=mp.bricks()}
      const amount=selectedAmount();
      brickController=await bricksBuilder.create('cardPayment','cardPaymentBrick_container',{
        initialization:{amount,payer:{email:profile?.email||''}},
        customization:{
          paymentMethods:{types:{excluded:['debit_card','prepaid_card']},minInstallments:1,maxInstallments:1},
          visual:{hidePaymentButton:true,style:{theme:'dark',customVariables:{baseColor:'#ff294d',buttonTextColor:'#ffffff',formBackgroundColor:'#080d13',inputBackgroundColor:'#0b1118',textPrimaryColor:'#f4f7fb',textSecondaryColor:'#7f8b98',outlinePrimaryColor:'#24313d',borderRadiusMedium:'12px'}}}
        },
        callbacks:{
          onReady:()=>{$('#cardBrickLoading').hidden=true},
          onError:error=>{console.error('Mercado Pago Brick',error);toast('O formulário seguro do Mercado Pago encontrou um erro.','error')}
        }
      });
    }catch(e){$('#cardBrickLoading').hidden=true;toast(e.message,'error')}
  }

  async function checkPayment(){
    if(!orderId)return;
    try{const d=await DehaxAPI.paymentStatus(orderId);if(d.paid){clearInterval(poll);const isPix=!$('#pixBox').hidden;if(isPix)$('#pixState').textContent='Pagamento confirmado ✓';$('#checkoutStatus').className='checkout-status good';const monthly=selectedPlan==='monthly';$('#checkoutStatus').textContent=monthly?`Pagamento confirmado. Seu PRO ganhou mais ${pixDays()} dias sem perder o período que já estava ativo.`:'Pagamento confirmado. Seus 6 meses de PRO foram adicionados ao seu acesso.';trackPurchase(isPix?(monthly?'pix_monthly':'pix_semester'):'card_semester',orderId);setTimeout(()=>location.href='/app/#home',1200)}else{if(!$('#pixBox').hidden)$('#pixState').textContent='Aguardando pagamento no Mercado Pago...';$('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent='Ainda não recebemos a confirmação. Se você acabou de pagar, aguarde alguns segundos.'}}catch(e){toast(e.message,'error')}
  }

  $('#submitCard').onclick=async()=>{if(!brickController){toast('Abra e preencha o formulário do cartão primeiro.','error');return}try{const formData=await brickController.getFormData();await processCard(formData)}catch(e){$('#checkoutStatus').className='checkout-status';$('#checkoutStatus').textContent='';toast(e?.message||'Revise os dados do cartão e tente novamente.','error')}};
  $('#payCard').onclick=renderCardBrick;
  $('#payPix').onclick=async()=>{
    if(!accepted())return;
    if(recurringActive()){toast('Sua cobrança mensal no cartão já está em renovação automática. Para mudar para Pix, cancele primeiro a recorrência em Minha Conta; o acesso já pago será preservado.','error');return}
    await closePaymentBoxes();$('#pixBox').hidden=false;$('#pixState').textContent='Gerando Pix...';$('#checkoutStatus').textContent='';
    try{const d=await DehaxAPI.createPix(selectedPlan);orderId=String(d.orderId||'');$('#pixCode').value=d.qrCode||'';if(d.qrCodeBase64)$('#qrShell').innerHTML=`<img src="data:image/png;base64,${String(d.qrCodeBase64).replace(/^data:image\/\w+;base64,/, '')}" alt="QR Code Pix">`;else $('#qrShell').innerHTML='<div class="qr-demo">PIX</div>';$('#pixState').textContent=d.testMode?'Pix sandbox gerado':'Escaneie o QR ou use o Copia e Cola';$('#pixTestHint').hidden=!d.testMode;clearInterval(poll);poll=setInterval(checkPayment,3000);window.DehaxTracking?.send('checkout_method',{method:'pix',plan:selectedPlan});window.DehaxTracking?.meta?.('InitiateCheckout',{value:selectedAmount(),currency:'BRL',content_name:`DeHax PRO ${selectedPlan}`,payment_method:'pix'});const until=activeUntil();if(until){$('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent=`Renovação antecipada: após a confirmação, o novo período começa depois de ${new Intl.DateTimeFormat('pt-BR').format(until)}. Você não perde nenhum dia.`}}catch(e){toast(e.message,'error');$('#pixState').textContent='Falha ao gerar Pix.'}
  };
  $('#copyPix').onclick=async()=>{const v=$('#pixCode').value;if(!v)return;try{await navigator.clipboard.writeText(v);toast('Pix Copia e Cola copiado.')}catch{$('#pixCode').select();document.execCommand('copy');toast('Código copiado.')}};
  $('#checkPix').onclick=checkPayment;

  async function init(){
    try{const u=await DehaxAPI.currentUser();if(!u){location.href='/entrar/?next=%2Fcheckout%2F';return}profile=await DehaxAPI.currentProfile();await loadSettings();renderSettings();$('#checkoutLoading').remove();$('#checkoutContent').hidden=false;if(pro(profile)){$('#checkoutStatus').className='checkout-status good';$('#checkoutStatus').innerHTML='Seu acesso PRO já está ativo. <a href="/app/">Voltar para a área de membros →</a>'}}
    catch(e){$('#checkoutLoading').textContent=e.message}
  }
  addEventListener('beforeunload',()=>{try{brickController?.unmount()}catch{}});
  setTimeout(init,0);
})();
