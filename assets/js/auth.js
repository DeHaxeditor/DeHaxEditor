(() => {
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const err=$('#authError'),tabs=$('.tabs'),login=$('#loginForm'),signup=$('#signupForm'),recovery=$('#recoveryForm');
 const RECOVERY_PENDING='dehax_password_recovery_pending_v1',RECOVERY_EMAIL='dehax_password_recovery_email_v1';
 let recoveryEmail='',recoveryTimer=null;
 function setError(m='',type=''){err.textContent=m;err.className=`auth-error ${m?'show':''} ${type}`}
 function setHead(title,copy){$('#authTitle').textContent=title;$('#authCopy').textContent=copy}
 function mode(m){
   $$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===m));
   tabs.hidden=false;login.hidden=m!=='login';signup.hidden=m!=='signup';recovery.hidden=true;
   setHead(m==='login'?'Acesse sua conta':'Crie sua conta FREE',m==='login'?'Continue de onde parou e acesse sua biblioteca.':'Entre gratuitamente e veja tudo o que existe na DeHax.');setError('')
 }
 $$('.tab').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 async function go(){
   const p=new URLSearchParams(location.search),requested=p.get('next');if(requested){location.href=requested;return;}
   try{const profile=await DehaxAPI.currentProfile();if(profile?.role==='admin'){location.href='/admin/';return}}catch{}
   location.href='/app/';
 }
 login.onsubmit=async e=>{e.preventDefault();setError('');const b=e.submitter;b.disabled=true;b.textContent='ENTRANDO...';try{const f=new FormData(e.currentTarget);await DehaxAPI.signIn(f.get('email'),f.get('password'));await go()}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='ENTRAR NA DEHAX →'}};
 signup.onsubmit=async e=>{e.preventDefault();setError('');const b=e.submitter;b.disabled=true;b.textContent='CRIANDO...';try{const f=new FormData(e.currentTarget);const d=await DehaxAPI.signUp(f.get('email'),f.get('password'),f.get('name'));if(!d.access_token&&!DehaxAPI.token()){window.DehaxTracking?.send('signup_created',{confirmed:false});window.DehaxTracking?.meta?.('Lead',{content_name:'DeHax FREE'});location.href=`/confirmar-email/?email=${encodeURIComponent(f.get('email'))}&next=${encodeURIComponent('/app/')}&sent=1`;return}window.DehaxTracking?.send('signup_completed',{confirmed:true});window.DehaxTracking?.meta?.('Lead',{content_name:'DeHax FREE'});await go()}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='CRIAR CONTA GRATUITA →'}};

 function recoveryStep(step){
   $('#recoveryEmailStep').hidden=step!=='email';$('#recoveryCodeStep').hidden=step!=='code';$('#recoveryPasswordStep').hidden=step!=='password';
 }
 function openRecovery(step='email'){
   tabs.hidden=true;login.hidden=true;signup.hidden=true;recovery.hidden=false;setError('');
   setHead(step==='password'?'Crie uma nova senha':step==='code'?'Digite o código recebido':'Recupere sua senha',step==='password'?'O código foi validado. Agora defina a nova senha.':step==='code'?'Enviamos um código de uso único para seu e-mail.':'Informe o e-mail da sua conta para receber um código de recuperação.');
   recoveryStep(step);
 }
 function recoveryCooldownKey(email){return `dehax_recovery_resend_after:${String(email||'').toLowerCase()}`}
 function startRecoveryCooldown(email,seconds=60){
   clearInterval(recoveryTimer);const key=recoveryCooldownKey(email),stored=Number(localStorage.getItem(key)||0),base=Math.max(stored,Date.now()+seconds*1000);localStorage.setItem(key,String(base));
   const btn=$('#resendRecoveryCode');
   const tick=()=>{const left=Math.max(0,Math.ceil((Number(localStorage.getItem(key)||0)-Date.now())/1000));btn.disabled=left>0;btn.textContent=left>0?`REENVIAR EM ${left}s`:'REENVIAR CÓDIGO';if(left<=0){clearInterval(recoveryTimer);recoveryTimer=null}};
   tick();recoveryTimer=setInterval(tick,250);
 }
 async function sendRecovery(email,{resend=false}={}){
   const target=String(email||'').trim().toLowerCase();if(!target)throw new Error('Informe o e-mail da sua conta.');
   await DehaxAPI.requestPasswordRecovery(target);recoveryEmail=target;sessionStorage.setItem(RECOVERY_EMAIL,target);$('#recoveryEmailLocked').value=target;openRecovery('code');startRecoveryCooldown(target,60);setError(resend?'Novo código enviado. Verifique sua caixa de entrada.':'Código enviado. Verifique também a caixa de spam.','ok');
 }
 $('#forgotPassword').onclick=()=>{const email=login.querySelector('[name="email"]').value.trim();$('#recoveryEmail').value=email;openRecovery('email')};
 $('#sendRecoveryCode').onclick=async()=>{const b=$('#sendRecoveryCode');b.disabled=true;b.textContent='ENVIANDO...';setError('');try{await sendRecovery($('#recoveryEmail').value)}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='ENVIAR CÓDIGO →'}};
 $('#recoveryCode').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,8)});
 $('#verifyRecoveryCode').onclick=async()=>{const b=$('#verifyRecoveryCode');b.disabled=true;b.textContent='VALIDANDO...';setError('');try{const target=recoveryEmail||$('#recoveryEmailLocked').value;await DehaxAPI.verifyPasswordRecoveryOtp(target,$('#recoveryCode').value);sessionStorage.setItem(RECOVERY_PENDING,'1');sessionStorage.setItem(RECOVERY_EMAIL,target);openRecovery('password');setError('Código confirmado. Defina sua nova senha.','ok')}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='VALIDAR CÓDIGO →'}};
 $('#resendRecoveryCode').onclick=async()=>{const b=$('#resendRecoveryCode');if(b.disabled)return;setError('');b.disabled=true;try{await sendRecovery(recoveryEmail||$('#recoveryEmailLocked').value,{resend:true})}catch(x){setError(x.message);b.disabled=false}};
 $('#saveRecoveryPassword').onclick=async()=>{const b=$('#saveRecoveryPassword'),p1=$('#recoveryPassword').value,p2=$('#recoveryPasswordConfirm').value;setError('');if(p1.length<8){setError('A nova senha precisa ter pelo menos 8 caracteres.');return}if(p1!==p2){setError('As duas senhas precisam ser iguais.');return}b.disabled=true;b.textContent='ALTERANDO...';try{await DehaxAPI.updateRecoveredPassword(p1);await DehaxAPI.signOut();sessionStorage.removeItem(RECOVERY_PENDING);const email=recoveryEmail||sessionStorage.getItem(RECOVERY_EMAIL)||'';sessionStorage.removeItem(RECOVERY_EMAIL);mode('login');login.querySelector('[name="email"]').value=email;login.querySelector('[name="password"]').value='';setError('Senha alterada com sucesso. Entre com sua nova senha.','ok')}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='ALTERAR SENHA →'}};
 $('#backToLogin').onclick=async()=>{if(sessionStorage.getItem(RECOVERY_PENDING)==='1'){try{await DehaxAPI.signOut()}catch{}}sessionStorage.removeItem(RECOVERY_PENDING);sessionStorage.removeItem(RECOVERY_EMAIL);clearInterval(recoveryTimer);mode('login')};

 const q=new URLSearchParams(location.search);if(q.get('signup')==='1')mode('signup');
 const pending=sessionStorage.getItem(RECOVERY_PENDING)==='1';if(pending){recoveryEmail=sessionStorage.getItem(RECOVERY_EMAIL)||'';openRecovery('password')}
 setTimeout(()=>{if(DehaxAPI.demoEnabled){$('#demoLinks').classList.add('show');$$('[data-demo]').forEach(b=>b.onclick=async()=>{await DehaxAPI.signIn(b.dataset.demo,'demo123');go()})}},0);
 setTimeout(async()=>{if(sessionStorage.getItem(RECOVERY_PENDING)==='1')return;try{if(await DehaxAPI.currentUser())go()}catch{}},50);
})();
