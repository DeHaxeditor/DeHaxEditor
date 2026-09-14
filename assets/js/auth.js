(() => {
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const err=$('#authError');
 function setError(m=''){err.textContent=m;err.classList.toggle('show',!!m)}
 function mode(m){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===m));$('#loginForm').hidden=m!=='login';$('#signupForm').hidden=m!=='signup';$('#authTitle').textContent=m==='login'?'Acesse sua conta':'Crie sua conta FREE';$('#authCopy').textContent=m==='login'?'Continue de onde parou e acesse sua biblioteca.':'Entre gratuitamente e veja tudo o que existe na DeHax.';setError('')}
 $$('.tab').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
 async function go(){
   const p=new URLSearchParams(location.search);
   const requested=p.get('next');
   if(requested){location.href=requested;return;}
   try{
     const profile=await DehaxAPI.currentProfile();
     if(profile?.role==='admin'){location.href='/admin/';return;}
   }catch{}
   location.href='/app/';
 }
 $('#loginForm').onsubmit=async e=>{e.preventDefault();setError('');const b=e.submitter;b.disabled=true;b.textContent='ENTRANDO...';try{const f=new FormData(e.currentTarget);await DehaxAPI.signIn(f.get('email'),f.get('password'));await go()}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='ENTRAR NA DEHAX →'}};
 $('#signupForm').onsubmit=async e=>{e.preventDefault();setError('');const b=e.submitter;b.disabled=true;b.textContent='CRIANDO...';try{const f=new FormData(e.currentTarget);const d=await DehaxAPI.signUp(f.get('email'),f.get('password'),f.get('name'));if(!d.access_token && !DehaxAPI.token()){window.DehaxTracking?.send('signup_created',{confirmed:false});window.DehaxTracking?.meta?.('Lead',{content_name:'DeHax FREE'});location.href=`/confirmar-email/?email=${encodeURIComponent(f.get('email'))}&next=${encodeURIComponent('/app/')}`;return}window.DehaxTracking?.send('signup_completed',{confirmed:true});window.DehaxTracking?.meta?.('Lead',{content_name:'DeHax FREE'});await go()}catch(x){setError(x.message)}finally{b.disabled=false;b.textContent='CRIAR CONTA GRATUITA →'}};
 const q=new URLSearchParams(location.search); if(q.get('signup')==='1') mode('signup');
 setTimeout(()=>{if(DehaxAPI.demoEnabled){$('#demoLinks').classList.add('show');$$('[data-demo]').forEach(b=>b.onclick=async()=>{await DehaxAPI.signIn(b.dataset.demo,'demo123');go()})}},0);
 setTimeout(async()=>{try{if(await DehaxAPI.currentUser()) go()}catch{}},50);
})();
