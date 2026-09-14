(() => {
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const GUEST_KEY='dehax_checkout_guest_v2';
  let profile=null,currentUser=null,checkoutToken='',checkoutIdentity=null,guestCreated=false,needsEmailConfirmation=false;
  let settings={},selectedPlan=new URLSearchParams(location.search).get('plan')==='monthly'?'monthly':'semester',paymentMethod='card';
  let brickController=null,bricksBuilder=null,brickEmail='',orderId='',orderPlan='',poll=null;
  let probeTimer=null,probeSeq=0,probeResolvedEmail='',probeExists=false,probeEmailConfirmed=true;

  const toast=(msg,type='ok')=>{const d=document.createElement('div');d.className=`toast ${type}`;d.textContent=msg;$('#toasts').appendChild(d);setTimeout(()=>d.remove(),4300)};
  const num=v=>Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0;
  const money=v=>num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  const monthlyPrice=()=>num(settings.pro_monthly_price||settings.pro_price||'19.90')||19.9;
  const semesterTotal=()=>num(settings.pro_semester_total||'59.40')||59.4;
  const semesterMonthly=()=>num(settings.pro_semester_monthly_equiv||'9.90')||9.9;
  const pixDays=()=>Math.max(1,Math.round(num(settings.pix_access_days||30)||30));
  const selectedAmount=()=>selectedPlan==='monthly'?monthlyPrice():semesterTotal();
  const payerEmail=()=>String(currentUser?.email||checkoutIdentity?.email||$('#checkoutEmail')?.value||'').trim().toLowerCase();
  const recurringActive=()=>!!profile?.subscription_id&&['authorized','active','trialing'].includes(String(profile?.subscription_status||'').toLowerCase());
  const activeUntil=()=>profile?.access_expires_at&&new Date(profile.access_expires_at).getTime()>Date.now()?new Date(profile.access_expires_at):null;
  const accepted=()=>{if($('#legalAccept').checked)return true;toast('Confirme a leitura dos termos antes de continuar.','error');return false};

  function trackPurchase(method,key=''){
    const amount=selectedAmount(),k=`dehax_purchase_track_${method}_${key||'latest'}`;
    try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1')}catch{}
    window.DehaxTracking?.send('purchase_confirmed',{method,plan:orderPlan||selectedPlan,value:amount,currency:'BRL'});
    window.DehaxTracking?.meta?.('Purchase',{value:amount,currency:'BRL',content_name:`DeHax PRO ${orderPlan||selectedPlan}`});
  }

  function saveGuestSession(data){
    checkoutToken=data.checkoutToken||'';checkoutIdentity=data.user||null;guestCreated=!!data.created;needsEmailConfirmation=!data.emailConfirmed;
    try{sessionStorage.setItem(GUEST_KEY,JSON.stringify({checkoutToken,expiresAt:data.expiresAt,user:checkoutIdentity,created:guestCreated,emailConfirmed:!!data.emailConfirmed}))}catch{}
  }
  function restoreGuestSession(){
    try{
      const d=JSON.parse(sessionStorage.getItem(GUEST_KEY)||'null');
      if(!d?.checkoutToken||!d?.expiresAt||new Date(d.expiresAt).getTime()<=Date.now()){sessionStorage.removeItem(GUEST_KEY);return false}
      checkoutToken=d.checkoutToken;checkoutIdentity=d.user||null;guestCreated=!!d.created;needsEmailConfirmation=!d.emailConfirmed;return true;
    }catch{return false}
  }
  function clearGuestSession(){try{sessionStorage.removeItem(GUEST_KEY)}catch{}checkoutToken='';checkoutIdentity=null;guestCreated=false;needsEmailConfirmation=false}

  function setIdentityInputs({name='',email='',locked=false}={}){
    $('#checkoutName').value=name||'';$('#checkoutEmail').value=email||'';
    $('#checkoutName').disabled=locked;$('#checkoutEmail').readOnly=!!currentUser;
    $('#checkoutEmailConfirm').disabled=locked;$('#checkoutPassword').disabled=locked;
  }
  function resetGuestProbe(){
    probeResolvedEmail='';probeExists=false;probeEmailConfirmed=true;$('#confirmExistingEmail').checked=false;
    $('#existingAccountNotice').hidden=true;$('#newAccountNotice').hidden=false;$('#newAccountFields').hidden=false;
    $('#checkoutName').disabled=false;$('#checkoutEmailConfirm').disabled=false;$('#checkoutPassword').disabled=false;
    $('#emailCheckState').className='identity-check-line';$('#emailCheckState').textContent='Digite seu e-mail para verificarmos sua conta.';
  }
  function renderIdentity(){
    const logged=!!currentUser,prepared=!logged&&!!checkoutToken&&!!checkoutIdentity;
    $('#loggedAccountNotice').hidden=!logged;
    if(logged){
      const name=profile?.display_name||currentUser?.user_metadata?.display_name||'';
      setIdentityInputs({name,email:currentUser.email||'',locked:true});
      $('#checkoutEmail').readOnly=true;$('#existingAccountNotice').hidden=true;$('#newAccountNotice').hidden=true;$('#newAccountFields').hidden=true;
      $('#emailCheckState').className='identity-check-line ok';$('#emailCheckState').textContent='Dados vinculados à sua conta autenticada.';
      return;
    }
    if(prepared){
      setIdentityInputs({name:checkoutIdentity.displayName||$('#checkoutName').value,email:checkoutIdentity.email||'',locked:true});
      $('#checkoutEmail').readOnly=true;$('#existingAccountNotice').hidden=true;$('#newAccountNotice').hidden=false;$('#newAccountFields').hidden=true;
      $('#newAccountNotice').innerHTML=guestCreated
        ? 'Sua conta foi criada para esta compra. <strong>Confirme o e-mail recebido antes do primeiro login.</strong>'
        : 'A compra será aplicada à conta já cadastrada. Depois do pagamento, faça login para acessar o PRO.';
      $('#emailCheckState').className='identity-check-line ok';$('#emailCheckState').textContent=guestCreated?'Conta preparada para o pagamento.':'Conta existente vinculada a este checkout.';
      return;
    }
    $('#checkoutEmail').readOnly=false;
  }

  async function loadSettings(){
    if(!DehaxAPI.config.supabaseUrl)return;
    try{const r=await DehaxAPI.supabaseFetch('/rest/v1/app_settings?key=in.(pro_price,pro_monthly_price,pro_semester_monthly_equiv,pro_semester_total,pix_access_days)&select=key,value');if(r.ok)for(const row of await r.json())settings[row.key]=row.value}catch{}
  }
  function renderSettings(){
    const m=monthlyPrice(),s=semesterTotal(),eq=semesterMonthly(),regular=m*6,saving=Math.max(0,regular-s),pct=regular?Math.round((saving/regular)*100):0;
    $('#monthlyPrice').textContent=money(m);$('#semesterMonthly').textContent=money(eq);$('#semesterTotalText').textContent=`R$ ${money(s)} à vista`;$('#semesterDiscount').textContent=`ECONOMIZE R$ ${money(saving)} · ${pct}% OFF`;
    renderPlan();
  }
  async function unmountBrick(){
    if(brickController){try{await brickController.unmount()}catch{}brickController=null}
    brickEmail='';$('#cardPaymentBrick_container').innerHTML='';
  }
  function renderPlan(){
    $$('[data-plan]').forEach(b=>b.classList.toggle('active',b.dataset.plan===selectedPlan));
    const sem=selectedPlan==='semester';
    $('#cardMethodText').textContent=sem?'Pagamento único · 1x sem parcelamento':'Assinatura mensal recorrente';
    $('#pixMethodText').textContent=sem?'Pagamento único · 6 meses':`Pagamento avulso · ${pixDays()} dias`;
    $('#cardBoxDescription').textContent=sem?`Pagamento único de R$ ${money(semesterTotal())}, em 1x. Acesso PRO por 6 meses.`:`R$ ${money(monthlyPrice())}/mês em cobrança recorrente. Você pode cancelar quando quiser; o período já pago é preservado.`;
    $('#planSummary').innerHTML=sem?`<b>SEMESTRAL:</b> pagamento integral de <strong>R$ ${money(semesterTotal())}</strong> e 6 meses de PRO, sem renovação automática.`:`<b>MENSAL:</b> cartão em <strong>R$ ${money(monthlyPrice())}/mês</strong> com renovação automática, ou Pix avulso de <strong>R$ ${money(monthlyPrice())}</strong> por ${pixDays()} dias.`;
    const until=activeUntil(),carry=$('#renewalCarry');
    if(until&&!recurringActive()){const dt=new Intl.DateTimeFormat('pt-BR').format(until);carry.hidden=false;carry.innerHTML=`<b>RENOVAÇÃO ANTECIPADA:</b> seu acesso atual vai até <strong>${dt}</strong>. No pagamento avulso, o novo período começa depois dessa data — você não perde nenhum dia.`}else carry.hidden=true;
    const url=new URL(location.href);url.searchParams.set('plan',selectedPlan);history.replaceState(null,'',url.pathname+url.search);
    updatePayButton();
  }
  function renderPaymentMethod(){
    $$('.payment-tab').forEach(b=>b.classList.toggle('active',b.dataset.method===paymentMethod));
    $('#cardBox').hidden=paymentMethod!=='card';$('#pixBox').hidden=paymentMethod!=='pix';
    updatePayButton();
    if(paymentMethod==='card')ensureCardBrick();
  }
  function updatePayButton(){
    const amount=money(selectedAmount());
    $('#checkoutPay').textContent=paymentMethod==='pix'?`GERAR PIX DE R$ ${amount} →`:(selectedPlan==='monthly'?`ASSINAR POR R$ ${amount}/MÊS →`:`PAGAR R$ ${amount} EM 1X →`);
  }

  async function probeEmailNow(force=false){
    if(currentUser||checkoutToken)return;
    const email=String($('#checkoutEmail').value||'').trim().toLowerCase();
    if(!validEmail(email)){resetGuestProbe();await unmountBrick();$('#cardWaiting').hidden=false;return null}
    if(!force&&probeResolvedEmail===email)return {exists:probeExists,emailConfirmed:probeEmailConfirmed};
    const seq=++probeSeq;$('#emailCheckState').className='identity-check-line checking';$('#emailCheckState').textContent='Verificando este e-mail...';
    try{
      const d=await DehaxAPI.probeCheckoutEmail(email);
      if(seq!==probeSeq||String($('#checkoutEmail').value||'').trim().toLowerCase()!==email)return null;
      probeResolvedEmail=email;probeExists=!!d.exists;probeEmailConfirmed=d.emailConfirmed!==false;
      if(probeExists){
        $('#checkoutName').value='';$('#checkoutEmailConfirm').value='';$('#checkoutPassword').value='';
        $('#checkoutName').disabled=true;$('#checkoutEmailConfirm').disabled=true;$('#checkoutPassword').disabled=true;
        $('#existingAccountNotice').hidden=false;$('#newAccountNotice').hidden=true;
        $('#existingConfirmationHint').textContent='Se o endereço for realmente seu, confirme abaixo e prossiga. Após o pagamento, você será direcionado ao login.';
        $('#emailCheckState').className='identity-check-line warn';$('#emailCheckState').textContent='Conta já cadastrada encontrada.';
      }else{
        $('#checkoutName').disabled=false;$('#checkoutEmailConfirm').disabled=false;$('#checkoutPassword').disabled=false;
        $('#existingAccountNotice').hidden=true;$('#newAccountNotice').hidden=false;
        $('#emailCheckState').className='identity-check-line ok';$('#emailCheckState').textContent='E-mail disponível. Sua conta será criada junto com o pagamento.';
      }
      if(paymentMethod==='card')await ensureCardBrick();
      return d;
    }catch(e){
      if(seq!==probeSeq)return null;
      $('#emailCheckState').className='identity-check-line warn';$('#emailCheckState').textContent='Não foi possível verificar o e-mail agora. Tentaremos novamente ao pagar.';
      return null;
    }
  }
  function scheduleProbe(){
    if(currentUser||checkoutToken)return;
    clearTimeout(probeTimer);resetGuestProbe();
    probeTimer=setTimeout(()=>probeEmailNow(),500);
  }

  async function ensureCardBrick(){
    if(paymentMethod!=='card')return;
    const email=payerEmail();
    const readyIdentity=!!currentUser||!!checkoutToken||(validEmail(email)&&probeResolvedEmail===email);
    if(!validEmail(email)||!readyIdentity){await unmountBrick();$('#cardWaiting').hidden=false;$('#cardBrickLoading').hidden=true;return}
    if(!DehaxAPI.config.mpPublicKey){$('#cardWaiting').hidden=false;$('#cardWaiting').textContent='MP_PUBLIC_KEY ainda não foi configurada no Netlify.';return}
    if(brickController&&brickEmail===email)return;
    await unmountBrick();$('#cardWaiting').hidden=true;$('#cardBrickLoading').hidden=false;
    try{
      if(!window.MercadoPago)throw new Error('SDK do Mercado Pago não carregou. Atualize a página e tente novamente.');
      if(!bricksBuilder){const mp=new MercadoPago(DehaxAPI.config.mpPublicKey,{locale:'pt-BR'});bricksBuilder=mp.bricks()}
      const amount=selectedAmount();brickEmail=email;
      brickController=await bricksBuilder.create('cardPayment','cardPaymentBrick_container',{
        initialization:{amount,payer:{email}},
        customization:{paymentMethods:{types:{excluded:['debit_card','prepaid_card']},minInstallments:1,maxInstallments:1},visual:{hidePaymentButton:true,style:{theme:'dark',customVariables:{baseColor:'#ff294d',buttonTextColor:'#ffffff',formBackgroundColor:'#080d13',inputBackgroundColor:'#0b1118',textPrimaryColor:'#f4f7fb',textSecondaryColor:'#7f8b98',outlinePrimaryColor:'#24313d',borderRadiusMedium:'12px'}}}},
        callbacks:{onReady:()=>{$('#cardBrickLoading').hidden=true},onError:error=>{console.error('Mercado Pago Brick',error);toast('O formulário seguro do Mercado Pago encontrou um erro.','error')}}
      });
    }catch(e){brickEmail='';$('#cardBrickLoading').hidden=true;$('#cardWaiting').hidden=false;$('#cardWaiting').textContent=e.message;toast(e.message,'error')}
  }

  async function ensureGuestIdentity(){
    if(currentUser)return '';
    if(checkoutToken)return checkoutToken;
    const email=String($('#checkoutEmail').value||'').trim().toLowerCase();
    if(!validEmail(email))throw new Error('Informe um e-mail válido.');
    if(probeResolvedEmail!==email)await probeEmailNow(true);
    const payload={email};
    if(probeExists){
      if(!$('#confirmExistingEmail').checked)throw new Error('Confirme que o e-mail informado pertence a você.');
      payload.confirmExisting=true;
    }else{
      const name=String($('#checkoutName').value||'').trim(),emailConfirm=String($('#checkoutEmailConfirm').value||'').trim().toLowerCase(),password=String($('#checkoutPassword').value||'');
      if(name.length<2)throw new Error('Informe seu nome.');
      if(emailConfirm!==email)throw new Error('Os dois campos de e-mail precisam ser iguais.');
      if(password.length<6)throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      Object.assign(payload,{name,emailConfirm,password});
    }
    let d;
    try{d=await DehaxAPI.prepareCheckoutIdentity(payload)}catch(e){
      if(/já possui uma conta/i.test(String(e.message||''))){await probeEmailNow(true);throw new Error('Este e-mail já possui uma conta. Confirme que o endereço é seu e clique em pagar novamente.')}throw e;
    }
    saveGuestSession(d);renderIdentity();
    return checkoutToken;
  }

  function cardPayload(formData){return {token:formData.token,payment_method_id:formData.payment_method_id,issuer_id:formData.issuer_id,installments:1,payer:{email:formData.payer?.email||payerEmail(),identification:formData.payer?.identification||null}}}

  function showSuccess(message){
    clearInterval(poll);const created=guestCreated,confirm=needsEmailConfirmation,email=payerEmail();
    $('#checkoutMain').hidden=true;$('#checkoutSuccess').hidden=false;$('#successMessage').textContent=message;
    const action=$('#successAction');action.hidden=true;
    if(currentUser){
      $('#successTitle').textContent='PRO LIBERADO.';$('#successMessage').textContent=`${message} Você será direcionado para a área de membros.`;
      setTimeout(()=>location.href='/app/#home',1200);return;
    }
    if(created||confirm){
      $('#successTitle').textContent='PAGAMENTO APROVADO.';
      $('#successMessage').textContent=`${message} Enviamos a confirmação para ${email}. Confirme seu e-mail e depois entre na DeHax.`;
      action.hidden=false;action.textContent='JÁ CONFIRMEI MEU E-MAIL →';action.onclick=()=>location.href='/entrar/?next=%2Fapp%2F';
      return;
    }
    $('#successTitle').textContent='PAGAMENTO APROVADO.';$('#successMessage').textContent=`${message} Agora entre na sua conta para acessar o conteúdo PRO.`;
    action.hidden=false;action.textContent='ENTRAR NA MINHA CONTA →';action.onclick=()=>location.href='/entrar/?next=%2Fapp%2F';
    setTimeout(()=>location.href='/entrar/?next=%2Fapp%2F',1800);
  }

  async function processCard(formData){
    const card=cardPayload(formData);const amount=selectedAmount();orderPlan=selectedPlan;let d;
    $('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent='Processando com segurança no Mercado Pago...';
    window.DehaxTracking?.send('checkout_method',{method:'card',plan:selectedPlan});window.DehaxTracking?.meta?.('InitiateCheckout',{value:amount,currency:'BRL',content_name:`DeHax PRO ${selectedPlan}`,payment_method:'card'});
    if(selectedPlan==='monthly'){
      d=await DehaxAPI.createSubscription(card,checkoutToken);
      if(d.demo||d.authorized){trackPurchase('card_recurring',d.subscriptionId||'subscription');showSuccess('Sua assinatura mensal foi confirmada e o acesso PRO já está vinculado à sua conta.')}else $('#checkoutStatus').textContent='Assinatura criada e aguardando confirmação do Mercado Pago.';
    }else{
      d=await DehaxAPI.createCardPayment(card,'semester',checkoutToken);
      if(d.demo||d.paid){trackPurchase('card_semester',d.paymentId||'card');showSuccess('Pagamento aprovado. Seus 6 meses de PRO já estão vinculados à sua conta.')}else if(d.paymentId){orderId=String(d.paymentId);$('#checkoutStatus').textContent='Pagamento em análise. Vamos verificar automaticamente.';clearInterval(poll);poll=setInterval(checkPayment,3000)}
    }
    return d;
  }

  async function startPix(){
    if(recurringActive())throw new Error('Sua cobrança mensal no cartão já está em renovação automática. Cancele primeiro a recorrência em Minha Conta; o acesso já pago será preservado.');
    orderPlan=selectedPlan;const d=await DehaxAPI.createPix(selectedPlan,checkoutToken);orderId=String(d.orderId||'');
    $('#pixBefore').hidden=true;$('#pixGenerated').hidden=false;$('#pixCode').value=d.qrCode||'';
    if(d.qrCodeBase64)$('#qrShell').innerHTML=`<img src="data:image/png;base64,${String(d.qrCodeBase64).replace(/^data:image\/\w+;base64,/, '')}" alt="QR Code Pix">`;else $('#qrShell').innerHTML='<div class="qr-demo">PIX</div>';
    $('#pixState').textContent=d.testMode?'Pix sandbox gerado':'Escaneie o QR ou use o Copia e Cola';$('#pixTestHint').hidden=!d.testMode;
    clearInterval(poll);poll=setInterval(checkPayment,3000);
    window.DehaxTracking?.send('checkout_method',{method:'pix',plan:selectedPlan});window.DehaxTracking?.meta?.('InitiateCheckout',{value:selectedAmount(),currency:'BRL',content_name:`DeHax PRO ${selectedPlan}`,payment_method:'pix'});
    const until=activeUntil();if(until){$('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent=`Renovação antecipada: o novo período começa depois de ${new Intl.DateTimeFormat('pt-BR').format(until)}. Você não perde nenhum dia.`}
  }

  async function checkPayment(){
    if(!orderId)return;
    try{
      const d=await DehaxAPI.paymentStatus(orderId,checkoutToken);
      if(d.paid){
        clearInterval(poll);if(paymentMethod==='pix')$('#pixState').textContent='Pagamento confirmado ✓';
        const monthly=orderPlan==='monthly',message=monthly?`Pagamento confirmado. Seu PRO ganhou mais ${pixDays()} dias sem perder nenhum período já ativo.`:'Pagamento confirmado. Seus 6 meses de PRO foram adicionados ao acesso.';
        trackPurchase(paymentMethod==='pix'?(monthly?'pix_monthly':'pix_semester'):'card_semester',orderId);showSuccess(message);
      }else if(paymentMethod==='pix'){$('#pixState').textContent='Aguardando pagamento no Mercado Pago...';$('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent='Ainda não recebemos a confirmação. Se você acabou de pagar, aguarde alguns segundos.'}
    }catch(e){toast(e.message,'error')}
  }

  $('#identityForm').addEventListener('submit',e=>e.preventDefault());
  $('#checkoutEmail').addEventListener('input',scheduleProbe);$('#checkoutEmail').addEventListener('blur',()=>probeEmailNow());
  $('#checkoutEmailConfirm').addEventListener('paste',()=>setTimeout(()=>{},0));
  $$('[data-plan]').forEach(b=>b.addEventListener('click',async()=>{selectedPlan=b.dataset.plan;clearInterval(poll);orderId='';orderPlan='';$('#pixGenerated').hidden=true;$('#pixBefore').hidden=false;await unmountBrick();renderPlan();if(paymentMethod==='card')ensureCardBrick()}));
  $$('.payment-tab').forEach(b=>b.addEventListener('click',async()=>{paymentMethod=b.dataset.method;renderPaymentMethod()}));
  $('#copyPix').onclick=async()=>{const v=$('#pixCode').value;if(!v)return;try{await navigator.clipboard.writeText(v);toast('Pix Copia e Cola copiado.')}catch{$('#pixCode').select();document.execCommand('copy');toast('Código copiado.')}};
  $('#checkPix').onclick=checkPayment;

  $('#checkoutPay').onclick=async()=>{
    if(!accepted())return;
    const btn=$('#checkoutPay'),original=btn.textContent;btn.disabled=true;btn.textContent='PROCESSANDO...';
    try{
      if(paymentMethod==='card'){
        if(!brickController){await ensureCardBrick();if(!brickController)throw new Error('Preencha um e-mail válido e aguarde o formulário seguro do cartão carregar.')}
        const formData=await brickController.getFormData();
        if(!formData?.token)throw new Error('Revise os dados do cartão antes de continuar.');
        await ensureGuestIdentity();
        await processCard(formData);
      }else{
        await ensureGuestIdentity();
        $('#checkoutStatus').className='checkout-status warn';$('#checkoutStatus').textContent='Preparando seu Pix...';
        await startPix();
      }
    }catch(e){$('#checkoutStatus').className='checkout-status';$('#checkoutStatus').textContent='';toast(e?.message||'Não foi possível concluir. Revise os dados e tente novamente.','error')}
    finally{btn.disabled=false;updatePayButton()}
  };

  async function init(){
    try{
      await loadSettings();currentUser=await DehaxAPI.currentUser();
      if(currentUser){profile=await DehaxAPI.currentProfile();clearGuestSession()}else restoreGuestSession();
      renderIdentity();renderSettings();renderPaymentMethod();
      if(!currentUser&&!checkoutToken)resetGuestProbe();
      if(currentUser||checkoutToken)ensureCardBrick();
      $('#checkoutLoading').hidden=true;$('#checkoutContent').hidden=false;
    }catch(e){$('#checkoutLoading').textContent=e.message||'Não foi possível preparar o checkout.'}
  }
  init();
})();
