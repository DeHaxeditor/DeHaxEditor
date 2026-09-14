(() => {
  const $=s=>document.querySelector(s);
  const q=new URLSearchParams(location.search);
  const email=String(q.get('email')||'').trim().toLowerCase();
  const next=q.get('next')||'/app/';
  const form=$('#confirmEmailForm'),code=$('#confirmCode'),emailEl=$('#confirmEmail'),status=$('#confirmStatus'),submit=$('#confirmSubmit'),resend=$('#resendCode');
  emailEl.value=email;
  function setStatus(msg,type=''){status.textContent=msg;status.className=`auth-error ${msg?'show':''} ${type}`}
  code.addEventListener('input',()=>{code.value=code.value.replace(/\D/g,'').slice(0,8)});
  form.onsubmit=async e=>{
    e.preventDefault();setStatus('');submit.disabled=true;submit.textContent='CONFIRMANDO...';
    try{
      const target=String(emailEl.value||'').trim().toLowerCase();
      await DehaxAPI.verifyEmailOtp(target,code.value);
      setStatus('E-mail confirmado. Abrindo sua área DeHax...','ok');
      setTimeout(()=>location.href=next,650);
    }catch(err){setStatus(err.message||'Código inválido ou expirado.');}
    finally{submit.disabled=false;submit.textContent='CONFIRMAR E ENTRAR →'}
  };
  let cooldown=0,timer=null;
  resend.onclick=async()=>{
    if(cooldown>0)return;
    try{
      const target=String(emailEl.value||'').trim().toLowerCase();
      if(!target)throw new Error('Informe seu e-mail.');
      resend.disabled=true;await DehaxAPI.resendSignupConfirmation(target);setStatus('Novo código enviado. Verifique também a caixa de spam.','ok');
      cooldown=60;resend.textContent=`REENVIAR EM ${cooldown}s`;
      timer=setInterval(()=>{cooldown--;resend.textContent=cooldown>0?`REENVIAR EM ${cooldown}s`:'REENVIAR CÓDIGO';if(cooldown<=0){clearInterval(timer);resend.disabled=false}},1000);
    }catch(err){setStatus(err.message||'Não foi possível reenviar o código.');resend.disabled=false}
  };
  setTimeout(async()=>{try{if(await DehaxAPI.currentUser())location.href=next}catch{}},80);
})();
