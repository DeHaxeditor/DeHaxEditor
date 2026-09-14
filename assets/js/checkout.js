(() => {
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const GUEST_KEY='dehax_checkout_guest_v2';
  let profile=null,currentUser=null,checkoutToken='',checkoutIdentity=null,guestCreated=false,needsEmailConfirmation=false;
  let settings={},retention={monthly:null,semester:null},selectedPlan=new URLSearchParams(location.search).get('plan')==='monthly'?'monthly':'semester',paymentMethod='card';
  let brickController=null,bricksBuilder=null,brickBuilderPublicKey='',brickEmail='',brickKey='',brickMountPromise=null,brickMountSeq=0,orderId='',orderPlan='',poll=null;
  let probeTimer=null,probeSeq=0,probeResolvedEmail='',probeExists=false,probeEmailConfirmed=true;

  const toast=(msg,type='ok')=>{const d=document.createElement('div');d.className=`toast ${type}`;d.textContent=msg;$('#toasts').appendChild(d);setTimeout(()=>d.remove(),4300)};
  const num=v=>Number(String(v??'').replace(',','.').replace(/[^0-9.]/g,''))||0;
  const money=v=>num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  const monthlyPrice=()=>num(settings.pro_monthly_price||settings.pro_price||'19.90')||19.9;
  const normalSemesterTotal=()=>num(settings.pro_semester_total||'59.40')||59.4;
  const semesterOffer=()=>retention?.semester&&String(retention.semester.status||'active')==='active'?retention.semester:null;
  const semesterTotal=()=>{const offer=semesterOffer(),discounted=num(offer?.discounted_amount??offer?.discountedAmount);return discounted>0?discounted:normalSemesterTotal()};
  const semesterMonthly=()=>num(settings.pro_semester_monthly_equiv||'9.90')||9.9;
  const pixDays=()=>Math.max(1,Math.round(num(settings.pix_access_days||30)||30));
  const selectedAmount=()=>selectedPlan==='monthly'?monthlyPrice():semesterTotal();
  const selectedCardProviderAmount=()=>selectedPlan==='semester'&&DehaxAPI.config.mpTestMode?50:selectedAmount();
  const selectedCardPublicKey=()=>selectedPlan==='monthly'?(DehaxAPI.config.mpSubscriptionsPublicKey||DehaxAPI.config.mpPublicKey||''):(DehaxAPI.config.mpOrdersPublicKey||'');
  const payerEmail=()=>String(currentUser?.email||checkoutIdentity?.email||$('#checkoutEmail')?.value||'').trim().toLowerCase();
  const recurringActive=()=>!!profile?.subscription_id&&['authorized','active','trialing'].includes(String(profile?.subscription_status||'').toLowerCase());
  const currentTier=()=>{
    if(!profile||profile.plan!=='pro')return 'free';
    const status=String(profile.subscription_status||'').toLowerCase();
    const expiry=profile.access_expires_at?new Date(profile.access_expires_at).getTime():null;
    if(expiry&&expiry<=Date.now())return 'free';
    if(status==='semester_active')return 'semester';
    if(['authorized','active','trialing','pix_active','manual','canceled'].includes(status))return 'monthly';
    return 'free';
  };
  const purchaseBlocked=()=>{const tier=currentTier();return tier==='semester'||(tier==='monthly'&&selectedPlan==='monthly')};
  const activeUntil=()=>profile?.access_expires_at&&new Date(profile.access_expires_at).getTime()>Date.now()?new Date(profile.access_expires_at):null;
  const accepted=()=>{if($('#legalAccept').checked)return true;toast('Confirme a leitura dos termos antes de continuar.','error');return false};
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  async function softTimeout(promise,ms,fallback){
    let timed=false;
    const timer=wait(ms).then(()=>{timed=true;return fallback});
    const result=await Promise.race([Promise.resolve(promise).catch(()=>fallback),timer]);
    return {result,timed};
  }

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
        ? (needsEmailConfirmation?'Sua conta foi criada para esta compra. <strong>Confirme o e-mail recebido antes do primeiro login.</strong>':'Sua conta foi criada para esta compra. <strong>O e-mail está liberado para testes; depois do pagamento, faça login normalmente.</strong>')
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
    const m=monthlyPrice(),s=semesterTotal(),normal=normalSemesterTotal(),offer=semesterOffer(),eq=offer?s/6:semesterMonthly(),regular=m*6,saving=Math.max(0,regular-s),pct=offer?Math.round((1-s/Math.max(.01,normal))*100):(regular?Math.round((saving/regular)*100):0);
    $('#monthlyPrice').textContent=money(m);$('#semesterMonthly').textContent=money(eq);$('#semesterTotalText').textContent=offer?`R$ ${money(s)} à vista · de R$ ${money(normal)}`:`R$ ${money(s)} à vista`;
    $('#semesterDiscount').textContent=offer?`BENEFÍCIO DE PERMANÊNCIA · ${pct}% OFF`:`ECONOMIZE R$ ${money(saving)} · ${pct}% OFF`;
    $('#planSemester')?.classList.toggle('retention-benefit',!!offer);
    renderPlan();
  }
  async function unmountBrick(){
    brickMountSeq++;
    const mounted=brickController;
    brickController=null;brickEmail='';brickKey='';brickMountPromise=null;
    if(mounted){try{await mounted.unmount()}catch{}}
    $('#cardPaymentBrick_container').innerHTML='';
    $('#cardBrickError').hidden=true;$('#cardBrickError').textContent='';
  }

  function brickErrorDetail(error){
    const parts=[];
    const push=v=>{if(v===undefined||v===null)return;if(typeof v==='string'||typeof v==='number')parts.push(String(v));};
    push(error?.type);push(error?.message);push(error?.cause);push(error?.error?.type);push(error?.error?.message);push(error?.error?.cause);
    if(Array.isArray(error?.cause))for(const item of error.cause){push(item?.code);push(item?.description);push(item?.message)}
    return [...new Set(parts.filter(Boolean))].join(' · ');
  }

  function showBrickError(error){
    const detail=brickErrorDetail(error);
    console.error('Mercado Pago Brick',error,detail||'sem detalhe');
    if(!detail)return;
    const el=$('#cardBrickError');
    el.hidden=false;el.textContent=`Mercado Pago: ${detail}`;
  }
  function renderPlan(){
    const tier=currentTier();
    if(tier==='monthly'&&selectedPlan==='monthly')selectedPlan='semester';
    if(tier==='semester')selectedPlan='semester';
    $$('[data-plan]').forEach(b=>{b.classList.toggle('active',b.dataset.plan===selectedPlan);b.disabled=tier==='semester'||(tier==='monthly'&&b.dataset.plan==='monthly');});
    const eligibility=$('#purchaseEligibility');
    if(tier==='monthly'){eligibility.hidden=false;eligibility.innerHTML='<b>VOCÊ JÁ É PRO MENSAL.</b> O mensal não pode ser comprado novamente. Seu upgrade disponível é o <strong>Semestral</strong>. Ao confirmar o upgrade, a renovação mensal é cancelada automaticamente e os 6 meses começam após o período mensal já pago.';}
    else if(tier==='semester'){eligibility.hidden=false;const until=profile?.access_expires_at?new Intl.DateTimeFormat('pt-BR').format(new Date(profile.access_expires_at)):'';eligibility.innerHTML=`<b>SEU PRO SEMESTRAL JÁ ESTÁ ATIVO.</b>${until?` Seu acesso vai até <strong>${until}</strong>.`:''} Não é necessário comprar o PRO novamente.`;}
    else eligibility.hidden=true;
    const sem=selectedPlan==='semester';
    $('#cardMethodText').textContent=sem?'Pagamento único · 1x sem parcelamento':'Assinatura mensal recorrente';
    $('#pixMethodText').textContent=sem?'Pagamento único · 6 meses':`Pagamento avulso · ${pixDays()} dias`;
    $('#cardBoxDescription').textContent=sem?`Pagamento único de R$ ${money(semesterTotal())}, em 1x. Acesso PRO por 6 meses.`:`R$ ${money(monthlyPrice())}/mês em cobrança recorrente. Você pode cancelar quando quiser; o período já pago é preservado.`;
    const cardTestHint=$('#cardTestHint');if(cardTestHint)cardTestHint.hidden=!(sem&&DehaxAPI.config.mpTestMode);
    const semOffer=semesterOffer();
    $('#planSummary').innerHTML=sem?(semOffer?`<b>SEMESTRAL COM BENEFÍCIO:</b> seu desconto de permanência está ativo. Pagamento único de <strong>R$ ${money(semesterTotal())}</strong> <s>R$ ${money(normalSemesterTotal())}</s> e 6 meses de PRO, sem renovação automática.`:`<b>SEMESTRAL:</b> pagamento integral de <strong>R$ ${money(semesterTotal())}</strong> e 6 meses de PRO, sem renovação automática.`):`<b>MENSAL:</b> cartão em <strong>R$ ${money(monthlyPrice())}/mês</strong> com renovação automática, ou Pix avulso de <strong>R$ ${money(monthlyPrice())}</strong> por ${pixDays()} dias.`;
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
    const amount=money(selectedAmount()),btn=$('#checkoutPay');
    if(purchaseBlocked()){btn.disabled=true;btn.textContent=currentTier()==='semester'?'PRO SEMESTRAL JÁ ATIVO':'MENSAL JÁ ATIVO';return}
    btn.disabled=false;
    btn.textContent=paymentMethod==='pix'?`GERAR PIX DE R$ ${amount} →`:(selectedPlan==='monthly'?`ASSINAR POR R$ ${amount}/MÊS →`:`PAGAR R$ ${amount} EM 1X →`);
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
    if(paymentMethod!=='card')return null;
    const email=payerEmail();
    const brickPayerEmail=(selectedPlan==='semester'&&DehaxAPI.config.mpTestMode)?'test@testuser.com':email;
    const readyIdentity=!!currentUser||!!checkoutToken||(validEmail(email)&&probeResolvedEmail===email);
    if(!validEmail(email)||!readyIdentity){await unmountBrick();$('#cardWaiting').hidden=false;$('#cardBrickLoading').hidden=true;return null}
    const publicKey=selectedCardPublicKey();
    if(!publicKey){
      $('#cardWaiting').hidden=false;
      $('#cardWaiting').textContent=selectedPlan==='monthly'
        ? 'MP_PUBLIC_KEY (ou MP_SUBSCRIPTIONS_PUBLIC_KEY) ainda não foi configurada no Netlify.'
        : 'MP_ORDERS_PUBLIC_KEY ainda não foi configurada no Netlify para o cartão semestral.';
      return null;
    }
    const key=`${email}|${selectedPlan}|${selectedAmount()}|${publicKey.slice(0,12)}`;
    if(brickController&&brickKey===key)return brickController;
    if(brickMountPromise&&brickKey===key)return brickMountPromise;

    const mountSeq=++brickMountSeq;
    const oldController=brickController;
    brickController=null;brickEmail=email;brickKey=key;
    $('#cardWaiting').hidden=true;$('#cardBrickLoading').hidden=false;$('#cardBrickError').hidden=true;$('#cardBrickError').textContent='';

    const promise=(async()=>{
      try{
        if(oldController){try{await oldController.unmount()}catch{}}
        $('#cardPaymentBrick_container').innerHTML='';
        if(!window.MercadoPago)throw new Error('SDK do Mercado Pago não carregou. Atualize a página e tente novamente.');
        if(!bricksBuilder||brickBuilderPublicKey!==publicKey){
          const mp=new MercadoPago(publicKey,{locale:'pt-BR'});
          bricksBuilder=mp.bricks();
          brickBuilderPublicKey=publicKey;
        }
        const amount=selectedCardProviderAmount();
        const controller=await bricksBuilder.create('cardPayment','cardPaymentBrick_container',{
          initialization:{amount,payer:{email:brickPayerEmail}},
          customization:{paymentMethods:{types:{excluded:['debit_card','prepaid_card']},minInstallments:1,maxInstallments:1},visual:{hidePaymentButton:true,style:{theme:'dark',customVariables:{baseColor:'#ff294d',buttonTextColor:'#ffffff',formBackgroundColor:'#080d13',inputBackgroundColor:'#0b1118',textPrimaryColor:'#f4f7fb',textSecondaryColor:'#7f8b98',outlinePrimaryColor:'#24313d',borderRadiusMedium:'12px'}}}},
          callbacks:{
            onReady:()=>{if(mountSeq===brickMountSeq){$('#cardBrickLoading').hidden=true;$('#cardBrickError').hidden=true}},
            onError:error=>showBrickError(error)
          }
        });
        if(mountSeq!==brickMountSeq||paymentMethod!=='card'||payerEmail()!==email||brickKey!==key){try{await controller.unmount()}catch{};return null}
        brickController=controller;
        return controller;
      }catch(e){
        if(mountSeq===brickMountSeq){brickEmail='';brickKey='';$('#cardBrickLoading').hidden=true;$('#cardWaiting').hidden=false;$('#cardWaiting').textContent=e?.message||'Não foi possível carregar o formulário seguro do cartão.';showBrickError(e)}
        return null;
      }
    })();
    brickMountPromise=promise;
    try{return await promise}finally{if(brickMountPromise===promise)brickMountPromise=null}
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
    if(confirm){
      $('#successTitle').textContent='PAGAMENTO APROVADO.';
      $('#successMessage').textContent=`${message} Enviamos a confirmação para ${email}. Confirme seu e-mail e depois entre na DeHax.`;
      action.hidden=false;action.textContent='CONFIRMAR E-MAIL COM CÓDIGO →';action.onclick=()=>location.href=`/confirmar-email/?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/app/')}&sent=1`;
      return;
    }
    if(created){
      $('#successTitle').textContent='PAGAMENTO APROVADO.';
      $('#successMessage').textContent=`${message} Sua conta foi criada e já pode ser usada para login.`;
      action.hidden=false;action.textContent='ENTRAR NA MINHA CONTA →';action.onclick=()=>location.href='/entrar/?next=%2Fapp%2F';
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
    if(recurringActive()&&selectedPlan!=='semester')throw new Error('Seu PRO mensal já está ativo. A opção disponível agora é o upgrade para o plano semestral.');
    orderPlan=selectedPlan;const d=await DehaxAPI.createPix(selectedPlan,checkoutToken);orderId=String(d.orderId||'');
    $('#pixBefore').hidden=true;$('#pixGenerated').hidden=false;$('#pixCode').value=d.qrCode||'';
    if(d.qrCodeBase64)$('#qrShell').innerHTML=`<img src="data:image/png;base64,${String(d.qrCodeBase64).replace(/^data:image\/\w+;base64,/, '')}" alt="QR Code Pix">`;else $('#qrShell').innerHTML='<div class="qr-demo">PIX</div>';
    $('#pixState').textContent=d.testMode?'Pix sandbox gerado':'Escaneie o QR ou use o Copia e Cola';$('#pixTestHint').hidden=!d.testMode;if(d.testMode)$('#pixTestHint').textContent='Ambiente de teste: o sandbox do Mercado Pago usa R$ 50,00 para validar o Pix. Em produção será cobrado o valor real do plano.';
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
    if(purchaseBlocked()){toast(currentTier()==='semester'?'Seu plano semestral já está ativo.':'Seu PRO mensal já está ativo. Faça upgrade para o semestral.','error');return}
    if(!accepted())return;
    const btn=$('#checkoutPay'),original=btn.textContent;btn.disabled=true;btn.textContent='PROCESSANDO...';
    try{
      if(paymentMethod==='card'){
        if(!brickController){await ensureCardBrick();if(!brickController)throw new Error('Preencha um e-mail válido e aguarde o formulário seguro do cartão carregar.')}
        let formData;
        try{formData=await brickController.getFormData()}catch(e){showBrickError(e);throw new Error(`Mercado Pago: ${brickErrorDetail(e)||e?.message||'não foi possível tokenizar o cartão.'}`)}
        if(!formData?.token)throw new Error('Mercado Pago não gerou o token do cartão. Revise os campos e tente novamente.');
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
      // Settings improve the checkout, but must never block the page forever.
      await softTimeout(loadSettings(),6000,null);
      const userState=await softTimeout(DehaxAPI.currentUser(),6000,null);currentUser=userState.result;
      if(currentUser){
        const profileState=await softTimeout(DehaxAPI.currentProfile(),6000,null);profile=profileState.result;clearGuestSession();
        const overviewState=await softTimeout(DehaxAPI.accountOverview(),6000,null);retention=overviewState.result?.retention||retention;
        if(currentTier()==='monthly')selectedPlan='semester';
        if(currentTier()==='semester')selectedPlan='semester';
      }else{
        // Uma nova visita ao checkout nunca deve ficar presa a uma tentativa anterior incompleta.
        // A conta eventualmente criada continua detectável pelo e-mail, mas o formulário volta a ficar utilizável.
        clearGuestSession();
      }
      renderIdentity();renderSettings();renderPaymentMethod();
      if(!currentUser&&!checkoutToken)resetGuestProbe();
      $('#checkoutLoading').hidden=true;$('#checkoutContent').hidden=false;
    }catch(e){
      console.error('Checkout init',e);
      // Fail visibly instead of leaving the customer trapped on “Preparando checkout...”.
      $('#checkoutLoading').textContent=e?.message||'Não foi possível preparar o checkout.';
    }
  }
  init();
})();
