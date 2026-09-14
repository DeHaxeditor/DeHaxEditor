(() => {
  const $=s=>document.querySelector(s),q=new URLSearchParams(location.search),email=String(q.get('email')||'').trim().toLowerCase(),next=q.get('next')||'/app/';
  const form=$('#confirmEmailForm'),code=$('#confirmCode'),emailEl=$('#confirmEmail'),status=$('#confirmStatus'),submit=$('#confirmSubmit'),resend=$('#resendCode');
  emailEl.value=email;
  function setStatus(msg,type=''){status.textContent=msg;status.className=`auth-error ${msg?'show':''} ${type}`}
  code.addEventListener('input',()=>{code.value=code.value.replace(/\D/g,'').slice(0,8)});
  form.onsubmit=async e=>{e.preventDefault();setStatus('');submit.disabled=true;submit.textContent='CONFIRMANDO...';try{const target=String(emailEl.value||'').trim().toLowerCase();await DehaxAPI.verifyEmailOtp(target,code.value);setStatus('E-mail confirmado. Abrindo sua área DeHax...','ok');setTimeout(()=>location.href=next,650)}catch(err){setStatus(err.message||'Código inválido ou expirado.')}finally{submit.disabled=false;submit.textContent='CONFIRMAR E ENTRAR →'}};
  let timer=null;
  const key=()=>`dehax_signup_resend_after:${String(emailEl.value||'').trim().toLowerCase()}`;
  function startCooldown(seconds=60,force=false){
    clearInterval(timer);const k=key(),old=Number(localStorage.getItem(k)||0),until=force?Date.now()+seconds*1000:(old>Date.now()?old:Date.now()+seconds*1000);localStorage.setItem(k,String(until));
    const tick=()=>{const left=Math.max(0,Math.ceil((Number(localStorage.getItem(k)||0)-Date.now())/1000));resend.disabled=left>0;resend.textContent=left>0?`REENVIAR EM ${left}s`:'REENVIAR CÓDIGO';if(left<=0){clearInterval(timer);timer=null}};tick();timer=setInterval(tick,250);
  }
  resend.onclick=async()=>{if(resend.disabled)return;try{const target=String(emailEl.value||'').trim().toLowerCase();if(!target)throw new Error('Informe seu e-mail.');resend.disabled=true;await DehaxAPI.resendSignupConfirmation(target);setStatus('Novo código enviado. Verifique também a caixa de spam.','ok');startCooldown(60,true)}catch(err){setStatus(err.message||'Não foi possível reenviar o código.');resend.disabled=false}};
  const storedUntil=Number(localStorage.getItem(key())||0);
  if(q.get('sent')==='1'){
    startCooldown(60,true);q.delete('sent');const qs=q.toString();history.replaceState(null,'',`${location.pathname}${qs?'?'+qs:''}`);
  }else if(storedUntil>Date.now()){
    startCooldown(Math.max(1,Math.ceil((storedUntil-Date.now())/1000)),false);
  }else{
    resend.disabled=false;resend.textContent='REENVIAR CÓDIGO';
  }
  setTimeout(async()=>{try{if(await DehaxAPI.currentUser())location.href=next}catch{}},80);
})();
