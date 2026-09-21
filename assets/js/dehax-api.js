(() => {
  const config = window.DEHAX_CONFIG || {};
  const SESSION_KEY = 'dehax_session_v1';
  const DEMO_KEY = 'dehax_demo_profile_v1';
  const isLocal = ['localhost','127.0.0.1',''].includes(location.hostname) || location.protocol === 'file:';
  const demoEnabled = !!config.demoMode || (!config.supabaseUrl && isLocal);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const jsonHeaders = { 'Content-Type': 'application/json' };

  function getSession(){
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function setSession(s){
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }
  function token(){ return getSession()?.access_token || ''; }

  let refreshPromise=null;
  function jwtExp(accessToken){
    try{
      const part=String(accessToken||'').split('.')[1];
      if(!part)return 0;
      const normalized=part.replace(/-/g,'+').replace(/_/g,'/');
      const padded=normalized+'='.repeat((4-normalized.length%4)%4);
      return Number(JSON.parse(atob(padded))?.exp||0);
    }catch{return 0}
  }
  function tokenNeedsRefresh(accessToken,skewSeconds=45){
    const exp=jwtExp(accessToken);
    return !!exp && exp <= Math.floor(Date.now()/1000)+skewSeconds;
  }
  async function refreshSession(force=false){
    const s=getSession();
    if(!s||s.access_token==='demo-token')return s;
    if(!s.refresh_token)return s;
    if(!force && s.access_token && !tokenNeedsRefresh(s.access_token))return s;
    if(refreshPromise)return refreshPromise;
    refreshPromise=(async()=>{
      const r=await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{
        method:'POST',
        headers:{...jsonHeaders,apikey:config.supabaseAnonKey},
        body:JSON.stringify({refresh_token:s.refresh_token})
      });
      const fresh=await r.json().catch(()=>({}));
      if(!r.ok){
        if(r.status===400||r.status===401)setSession(null);
        throw new Error(fresh.message||fresh.msg||fresh.error_description||fresh.error||'Sua sessão expirou. Entre novamente.');
      }
      const merged={...s,...fresh,user:fresh.user||s.user};
      setSession(merged);
      return merged;
    })();
    try{return await refreshPromise}finally{refreshPromise=null}
  }

  async function supabaseFetch(path, opts={}){
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase não configurado.');
    const current=getSession();
    if(current?.refresh_token && tokenNeedsRefresh(current.access_token))await refreshSession(true);
    const makeHeaders=()=>{
      const headers={apikey:config.supabaseAnonKey,...opts.headers};
      if(token())headers.Authorization=`Bearer ${token()}`;
      return headers;
    };
    let r=await fetch(`${config.supabaseUrl}${path}`,{...opts,headers:makeHeaders()});
    if(r.status===401 && getSession()?.refresh_token){
      try{
        await refreshSession(true);
        r=await fetch(`${config.supabaseUrl}${path}`,{...opts,headers:makeHeaders()});
      }catch{}
    }
    return r;
  }

  async function signIn(email,password){
    if (!config.supabaseUrl || !config.supabaseAnonKey) { if (!demoEnabled) throw new Error('A área de membros ainda não foi conectada ao Supabase.'); }
    if (demoEnabled && !config.supabaseUrl) {
      const role = /admin/i.test(email) ? 'admin' : 'member';
      const plan = /pro/i.test(email) ? 'pro' : 'free';
      const profile = {id:'demo-user',email,display_name:email.split('@')[0]||'Editor',role,plan,subscription_status:plan==='pro'?'authorized':'inactive',pro_started_at:plan==='pro'?new Date(Date.now()-2*86400000).toISOString():null,access_expires_at:null,created_at:new Date(Date.now()-30*86400000).toISOString()};
      localStorage.setItem(DEMO_KEY, JSON.stringify(profile));
      setSession({access_token:'demo-token',user:{id:'demo-user',email}});
      await sleep(250); return {user:{id:'demo-user',email},profile,demo:true};
    }
    const r = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email,password})});
    const data = await r.json();
    if(!r.ok) throw new Error(data.message || data.msg || data.error_description || data.error || 'Não foi possível entrar.');
    setSession(data);
    return data;
  }

  async function signUp(email,password,name){
    if (!config.supabaseUrl || !config.supabaseAnonKey) { if (!demoEnabled) throw new Error('A área de membros ainda não foi conectada ao Supabase.'); }
    if (demoEnabled && !config.supabaseUrl) return signIn(email,password);
    const r = await fetch(`${config.supabaseUrl}/auth/v1/signup`, {method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email,password,data:{display_name:name||''}})});
    const data = await r.json();
    if(!r.ok) throw new Error(data.message || data.msg || data.error_description || data.error || 'Não foi possível criar a conta.');
    if(data.access_token) setSession(data);
    return data;
  }

  async function verifyEmailOtp(email,otp){
    if(!config.supabaseUrl||!config.supabaseAnonKey)throw new Error('Supabase não configurado.');
    const tokenCode=String(otp||'').replace(/\D/g,'');
    if(!/^\d{6,8}$/.test(tokenCode))throw new Error('Digite o código recebido no e-mail.');
    const r=await fetch(`${config.supabaseUrl}/auth/v1/verify`,{method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email:String(email||'').trim().toLowerCase(),token:tokenCode,type:'email'})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||data.msg||data.error_description||data.error||'Código inválido ou expirado.');
    if(data.access_token)setSession(data);
    return data;
  }

  async function resendSignupConfirmation(email){
    if(!config.supabaseUrl||!config.supabaseAnonKey)throw new Error('Supabase não configurado.');
    const r=await fetch(`${config.supabaseUrl}/auth/v1/resend`,{method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({type:'signup',email:String(email||'').trim().toLowerCase()})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||data.msg||data.error_description||data.error||'Não foi possível reenviar o código.');
    return data;
  }

  async function requestPasswordRecovery(email){
    if(!config.supabaseUrl||!config.supabaseAnonKey)throw new Error('Supabase não configurado.');
    const target=String(email||'').trim().toLowerCase();if(!target)throw new Error('Informe seu e-mail.');
    const r=await fetch(`${config.supabaseUrl}/auth/v1/recover`,{method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email:target})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||data.msg||data.error_description||data.error||'Não foi possível enviar o código de recuperação.');
    return data;
  }

  async function verifyPasswordRecoveryOtp(email,otp){
    if(!config.supabaseUrl||!config.supabaseAnonKey)throw new Error('Supabase não configurado.');
    const tokenCode=String(otp||'').replace(/\D/g,'');if(!/^\d{6,8}$/.test(tokenCode))throw new Error('Digite o código recebido no e-mail.');
    const r=await fetch(`${config.supabaseUrl}/auth/v1/verify`,{method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email:String(email||'').trim().toLowerCase(),token:tokenCode,type:'recovery'})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||data.msg||data.error_description||data.error||'Código inválido ou expirado.');
    if(data.access_token)setSession(data);return data;
  }

  async function updateRecoveredPassword(password){
    const value=String(password||'');if(value.length<8)throw new Error('A nova senha precisa ter pelo menos 8 caracteres.');
    if(!token())throw new Error('Valide o código de recuperação antes de alterar a senha.');
    const r=await supabaseFetch('/auth/v1/user',{method:'PUT',headers:jsonHeaders,body:JSON.stringify({password:value})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||data.msg||data.error_description||data.error||'Não foi possível alterar a senha.');
    return data;
  }

  async function signOut(){
    if (demoEnabled && token()==='demo-token') {
      setSession(null); localStorage.removeItem(DEMO_KEY); return;
    }
    if (token()) {
      try { await supabaseFetch('/auth/v1/logout',{method:'POST'}); } catch {}
    }
    setSession(null);
  }

  async function currentUser(){
    const s = getSession(); if(!s) return null;
    if (s.access_token === 'demo-token') return s.user;
    let r = await supabaseFetch('/auth/v1/user');
    if(r.status===401 && s.refresh_token){
      const rr=await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({refresh_token:s.refresh_token})});
      if(rr.ok){ const fresh=await rr.json(); setSession(fresh); r=await supabaseFetch('/auth/v1/user'); }
    }
    if(!r.ok){ setSession(null); return null; }
    return r.json();
  }

  async function currentProfile(){
    const user = await currentUser(); if(!user) return null;
    if(token()==='demo-token') return JSON.parse(localStorage.getItem(DEMO_KEY)||'null');
    const r=await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,display_name,email,role,plan,subscription_status,subscription_id,is_suspended,pro_started_at,access_expires_at,attribution,created_at`);
    if(!r.ok) throw new Error('Não foi possível carregar o perfil.');
    const rows=await r.json();
    return {...(rows[0]||{}),email:user.email,user_metadata:user.user_metadata};
  }

  const DEMO_ASSETS = [
    {id:'a1',title:'Whoosh Impact 01',description:'Whoosh curto para cortes de gameplay.',category:'SFX',subcategory:'Whoosh',tags:['whoosh','impacto','corte'],media_type:'audio',file_format:'WAV',file_size:1480000,access_level:'free',status:'published',download_enabled:true,preview_enabled:true,featured:true,created_at:'2026-09-10T10:00:00Z'},
    {id:'a2',title:'Pack Transições Glitch',description:'12 transições rápidas para Premiere e After Effects.',category:'Transições',subcategory:'Glitch',tags:['glitch','gaming','transição'],media_type:'archive',file_format:'ZIP',file_size:82400000,access_level:'pro',status:'published',download_enabled:true,preview_enabled:true,featured:true,created_at:'2026-09-11T10:00:00Z'},
    {id:'a3',title:'Meme Reaction Pack 01',description:'Seleção de reactions prontas para cortes cômicos.',category:'Memes',subcategory:'Reaction',tags:['meme','reaction','humor'],media_type:'video',file_format:'MP4',file_size:29300000,access_level:'pro',status:'published',download_enabled:true,preview_enabled:true,featured:false,created_at:'2026-09-09T10:00:00Z'},
    {id:'a4',title:'Hit Bass Drop',description:'Impacto grave para transições e momentos de destaque.',category:'SFX',subcategory:'Impact',tags:['bass','hit','impacto'],media_type:'audio',file_format:'WAV',file_size:2100000,access_level:'free',status:'published',download_enabled:true,preview_enabled:true,featured:false,created_at:'2026-09-08T10:00:00Z'},
    {id:'a5',title:'Overlay HUD Gamer',description:'Elementos HUD com transparência para vídeos de gameplay.',category:'Overlays',subcategory:'HUD',tags:['hud','overlay','gaming'],media_type:'video',file_format:'MOV',file_size:118000000,access_level:'pro',status:'published',download_enabled:true,preview_enabled:true,featured:false,created_at:'2026-09-07T10:00:00Z'},
    {id:'a6',title:'Music Bed Cyber 01',description:'Trilha eletrônica para conteúdo gamer.',category:'Músicas',subcategory:'Electronic',tags:['cyber','eletrônica','gaming'],media_type:'audio',file_format:'WAV',file_size:39100000,access_level:'pro',status:'published',download_enabled:true,preview_enabled:true,featured:false,created_at:'2026-09-06T10:00:00Z'}
  ];
  const DEMO_TUTORIALS = [
    {id:'t1',title:'Ritmo de edição para gameplays',description:'Como remover tempo morto sem destruir a personalidade do criador.',category:'Edição',duration_label:'18 min',access_level:'free',status:'published',featured:true,order_index:1,thumbnail_url:''},
    {id:'t2',title:'Sound Design que segura atenção',description:'Camadas de SFX, impactos e silêncio na prática.',category:'Sound Design',duration_label:'26 min',access_level:'pro',status:'published',featured:true,order_index:2,thumbnail_url:''},
    {id:'t3',title:'Memes sem deixar a edição cansativa',description:'Timing, repetição e contraste para humor em gameplay.',category:'Storytelling',duration_label:'21 min',access_level:'pro',status:'published',featured:false,order_index:3,thumbnail_url:'',unlock_after_days:0},
    {id:'t4',title:'Workflow avançado: retenção e narrativa',description:'Tutorial bônus com liberação programada 7 dias após a primeira ativação do PRO.',category:'Workflow',duration_label:'34 min',access_level:'pro',status:'published',featured:true,order_index:4,thumbnail_url:'',unlock_after_days:7}
  ];

  const DEMO_CATEGORIES=[
    {id:'c-sfx',name:'SFX',slug:'sfx',status:'active',sort_order:10},{id:'c-memes',name:'Memes',slug:'memes',status:'active',sort_order:20},{id:'c-musicas',name:'Músicas',slug:'musicas',status:'active',sort_order:30},{id:'c-trans',name:'Transições',slug:'transicoes',status:'active',sort_order:40},{id:'c-over',name:'Overlays',slug:'overlays',status:'active',sort_order:50},{id:'c-presets',name:'Presets',slug:'presets',status:'active',sort_order:60}
  ];
  const DEMO_SUBCATEGORIES=[
    {id:'sc1',category_id:'c-sfx',name:'Gameplay Pack',slug:'gameplay-pack',status:'active',sort_order:10},{id:'sc2',category_id:'c-sfx',name:'Whoosh',slug:'whoosh',status:'active',sort_order:20},{id:'sc3',category_id:'c-sfx',name:'Interface',slug:'interface',status:'active',sort_order:30},{id:'sc4',category_id:'c-trans',name:'Glitch',slug:'glitch',status:'active',sort_order:10},{id:'sc5',category_id:'c-over',name:'HUD',slug:'hud',status:'active',sort_order:10}
  ];
  const DEMO_SUBCATEGORY_LINKS=[{id:'scl1',parent_subcategory_id:'sc1',child_subcategory_id:'sc2',sort_order:10},{id:'scl2',parent_subcategory_id:'sc1',child_subcategory_id:'sc3',sort_order:20}];
  const DEMO_CATEGORY_TAGS=[{id:'tag1',category_id:'c-sfx',name:'gameplay',slug:'gameplay',status:'active',sort_order:10},{id:'tag2',category_id:'c-sfx',name:'interface',slug:'interface',status:'active',sort_order:20}];
  // PostgREST/Supabase limits each REST response (commonly to 1,000 rows).
  // Always paginate collection reads so the library/admin never silently drops older assets.
  async function fetchAllRows(path,{pageSize=1000,maxPages=1000}={}){
    const all=[];
    for(let page=0;page<maxPages;page++){
      const offset=page*pageSize;
      const sep=path.includes('?')?'&':'?';
      const r=await supabaseFetch(`${path}${sep}limit=${pageSize}&offset=${offset}`);
      if(!r.ok)throw new Error(`Falha ao carregar dados (${r.status}).`);
      const rows=await r.json();
      if(!Array.isArray(rows))return all;
      all.push(...rows);
      if(rows.length<pageSize)return all;
    }
    throw new Error('A consulta excedeu o limite de paginação de segurança.');
  }

  async function getCategories({all=false}={}){if(demoEnabled&&!config.supabaseUrl)return DEMO_CATEGORIES;const filter=all?'':'&status=eq.active';try{return await fetchAllRows(`/rest/v1/asset_categories?select=*&order=sort_order.asc,name.asc${filter}`)}catch{return []}}
  async function getSubcategories({all=false}={}){if(demoEnabled&&!config.supabaseUrl)return DEMO_SUBCATEGORIES;const filter=all?'':'&status=eq.active';try{return await fetchAllRows(`/rest/v1/asset_subcategories?select=*&order=sort_order.asc,name.asc${filter}`)}catch{return []}}
  async function getSubcategoryLinks(){if(demoEnabled&&!config.supabaseUrl)return DEMO_SUBCATEGORY_LINKS;try{return await fetchAllRows('/rest/v1/asset_subcategory_links?select=*&order=sort_order.asc,created_at.asc')}catch{return []}}
  async function getCategoryTags({all=false}={}){if(demoEnabled&&!config.supabaseUrl)return DEMO_CATEGORY_TAGS;const filter=all?'':'&status=eq.active';try{return await fetchAllRows(`/rest/v1/asset_category_tags?select=*&order=sort_order.asc,name.asc${filter}`)}catch{return []}}

  async function getAssets({all=false}={}){
    if (demoEnabled && !config.supabaseUrl) return DEMO_ASSETS;
    const filter=all?'':'&status=eq.published',pageSize=1000;
    const base=`/rest/v1/assets?select=*&order=download_count.desc,created_at.desc,id.desc${filter}`;
    const first=await supabaseFetch(`${base}&limit=${pageSize}&offset=0`,{headers:{Prefer:'count=exact'}});
    if(!first.ok)throw new Error(`Falha ao carregar assets (${first.status}).`);
    const rows=await first.json();
    const range=String(first.headers.get('content-range')||''),m=range.match(/\/(\d+)$/),total=m?Number(m[1]):rows.length;
    if(!Number.isFinite(total)||total<=rows.length)return rows;
    const offsets=[];for(let offset=pageSize;offset<total;offset+=pageSize)offsets.push(offset);
    const pages=await Promise.all(offsets.map(async offset=>{const r=await supabaseFetch(`${base}&limit=${pageSize}&offset=${offset}`);if(!r.ok)throw new Error(`Falha ao carregar assets (${r.status}).`);return r.json()}));
    return rows.concat(...pages);
  }
  async function getTutorials({all=false}={}){
    if (demoEnabled && !config.supabaseUrl) return DEMO_TUTORIALS;
    const filter = all ? '' : '&status=eq.published';
    return fetchAllRows(`/rest/v1/tutorials?select=*&order=order_index.asc,created_at.desc,id.desc${filter}`);
  }
  async function getFavorites(){
    if (demoEnabled && !config.supabaseUrl) return JSON.parse(localStorage.getItem('dehax_demo_favs')||'[]');
    try{return (await fetchAllRows('/rest/v1/favorites?select=asset_id&order=created_at.desc')).map(x=>x.asset_id)}catch{return []}
  }
  async function toggleFavorite(assetId,on){
    if (demoEnabled && !config.supabaseUrl) {
      let a=JSON.parse(localStorage.getItem('dehax_demo_favs')||'[]');
      a=on?[...new Set([...a,assetId])]:a.filter(x=>x!==assetId); localStorage.setItem('dehax_demo_favs',JSON.stringify(a)); return;
    }
    const user=await currentUser(); if(!user) throw new Error('Entre para favoritar.');
    if(on){
      const r=await supabaseFetch('/rest/v1/favorites',{method:'POST',headers:{...jsonHeaders,Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:user.id,asset_id:assetId})}); if(!r.ok) throw new Error('Falha ao favoritar.');
    } else {
      const r=await supabaseFetch(`/rest/v1/favorites?user_id=eq.${encodeURIComponent(user.id)}&asset_id=eq.${encodeURIComponent(assetId)}`,{method:'DELETE'}); if(!r.ok) throw new Error('Falha ao remover favorito.');
    }
  }

  async function callFunction(name,body={}){
    if(token()==='demo-token') return {demo:true};
    const current=getSession();
    if(current?.refresh_token && tokenNeedsRefresh(current.access_token))await refreshSession(true);
    const makeHeaders=()=>{
      const headers={...jsonHeaders};
      // Guest checkout requests must NOT send an empty Authorization header.
      // Some runtimes normalize "Bearer " to "Bearer", which makes the backend
      // think there is a logged-in session and reject the temporary checkout token.
      if(token())headers.Authorization=`Bearer ${token()}`;
      return headers;
    };
    const payload=JSON.stringify(body);
    let r=await fetch(`/.netlify/functions/${name}`,{method:'POST',headers:makeHeaders(),body:payload});
    if(r.status===401 && getSession()?.refresh_token){
      try{
        await refreshSession(true);
        r=await fetch(`/.netlify/functions/${name}`,{method:'POST',headers:makeHeaders(),body:payload});
      }catch{}
    }
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(data.error||data.message||`Erro ${r.status}`);Object.assign(e,data,{status:r.status});throw e;}
    return data;
  }

  async function assetAccess(assetId,action='download'){
    if (demoEnabled && !config.supabaseUrl) throw new Error('No modo de demonstração não há arquivo real para baixar.');
    return callFunction('asset-access',{assetId,action});
  }
  async function tutorialAccess(tutorialId){
    if (demoEnabled && !config.supabaseUrl) return {demo:true,tutorialId};
    return callFunction('tutorial-access',{tutorialId});
  }
  async function probeCheckoutEmail(email){if(demoEnabled&&!config.supabaseUrl)return {demo:true,exists:/existente/i.test(email||''),emailConfirmed:true};return callFunction('checkout-session',{action:'probe',email})}
  async function prepareCheckoutIdentity(payload={}){if(demoEnabled&&!config.supabaseUrl)return {demo:true,checkoutToken:'demo-checkout',expiresAt:new Date(Date.now()+1800000).toISOString(),created:!payload.confirmExisting,existing:!!payload.confirmExisting,user:{id:'demo-user',email:payload.email,displayName:payload.name||'Editor Demo'},emailConfirmed:false};return callFunction('checkout-session',{action:'prepare',...payload})}
  async function createSubscription(card,checkoutToken=''){if(demoEnabled&&!config.supabaseUrl)return {demo:true,authorized:true,status:'authorized',subscriptionId:'demo-sub'};return callFunction('create-subscription',{card,checkoutToken})}
  async function createCardPayment(card,planCode='semester',checkoutToken=''){if(demoEnabled&&!config.supabaseUrl)return {demo:true,paid:true,status:'approved',paymentId:'demo-card',accessExpiresAt:new Date(Date.now()+183*86400000).toISOString()};return callFunction('create-card-payment',{card,planCode,checkoutToken})}
  async function createPix(planCode='semester',checkoutToken=''){if(demoEnabled&&!config.supabaseUrl)return {demo:true,orderId:'demo-pix',status:'action_required',qrCode:'00020126580014BR.GOV.BCB.PIX0136DEHAX-DEMO-PIX-NAO-PAGAR',qrCodeBase64:''};return callFunction('create-pix',{planCode,checkoutToken})}
  async function paymentStatus(orderId,checkoutToken=''){if(demoEnabled&&!config.supabaseUrl)return {status:'action_required',paid:false};return callFunction('payment-status',{orderId,checkoutToken})}
  async function cancelSubscription(reason){if(demoEnabled&&!config.supabaseUrl)return {demo:true,status:'canceled',accessUntil:null};return callFunction('cancel-subscription',{reason})}
  async function subscriptionRetention(action,reason){if(demoEnabled&&!config.supabaseUrl)return {demo:true,ok:true,offer:{planCode:'monthly',discountPercent:10,discountedAmount:17.91,cyclesTotal:3}};return callFunction('subscription-retention',{action,reason})}
  async function requestRefund(payload){if(demoEnabled&&!config.supabaseUrl)return {demo:true,ok:true,status:'pending',id:'demo-refund'};return callFunction('refund-request',payload)}
  async function audioAiStatus(){if(demoEnabled&&!config.supabaseUrl)return {plan:'pro',admin:false,enabled:false,provider:'elevenlabs',providerConfigured:false,providerPlan:{tier:'starter',status:'active'},tokens:{allowance:150,used:20,remaining:130,cycleStart:new Date().toISOString(),cycleEnd:new Date(Date.now()+30*86400000).toISOString()},costs:{narrationHqPer1000Chars:55,narrationFlashPer1000Chars:28,sfxPerSecond:1},limits:{storageDays:30,storageGb:1,maxNarrationChars:5000,maxSfxSeconds:30},storage:{usedBytes:0,maxBytes:1073741824},voices:[],history:[]};return callFunction('ai-audio-status',{})}
  async function generateAiAudio(payload={}){if(demoEnabled&&!config.supabaseUrl)throw new Error('A geração real de áudio não está ativa no modo demo.');return callFunction('ai-audio-generate',payload)}
  async function aiAudioFile(id,action='play'){if(demoEnabled&&!config.supabaseUrl)throw new Error('Arquivo indisponível no modo demo.');return callFunction('ai-audio-file',{id,action})}
  async function accountOverview(){if(demoEnabled&&!config.supabaseUrl)return {profile:{displayName:'Editor Demo',email:'demo@dehax.local',plan:'pro',subscriptionStatus:'authorized',createdAt:new Date().toISOString()},subscription:{status:'authorized',nextPaymentDate:new Date(Date.now()+20*86400000).toISOString(),amount:19.9,currency:'BRL'},payments:[],retention:{monthly:null,semester:null}};return callFunction('account-overview',{})}
  async function updateAccount(payload={}){if(demoEnabled&&!config.supabaseUrl)return {ok:true,...payload};return callFunction('account-update',payload)}

  async function adminFetch(table,{select='*',order='created_at.desc'}={}){
    try{
      return await fetchAllRows(`/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}`);
    }catch(err){
      throw new Error(`Falha ao carregar ${table}: ${err.message||'erro desconhecido'}`);
    }
  }
  async function adminInsert(table,row){
    const r=await supabaseFetch(`/rest/v1/${table}`,{method:'POST',headers:{...jsonHeaders,Prefer:'return=representation'},body:JSON.stringify(row)});
    const data=await r.json().catch(()=>[]); if(!r.ok) throw new Error(data.message||`Falha ao criar ${table}.`); return data[0]||data;
  }
  async function adminUpdate(table,id,patch){
    const r=await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...jsonHeaders,Prefer:'return=representation'},body:JSON.stringify(patch)});
    const data=await r.json().catch(()=>[]); if(!r.ok) throw new Error(data.message||`Falha ao atualizar ${table}.`); return data[0]||data;
  }
  async function adminDelete(table,id){
    const r=await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}); if(!r.ok) throw new Error(`Falha ao remover ${table}.`);
  }
  async function adminUpsert(table,row,onConflict){
    const r=await supabaseFetch(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,{method:'POST',headers:{...jsonHeaders,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
    const data=await r.json().catch(()=>[]); if(!r.ok) throw new Error(data.message||`Falha ao salvar ${table}.`); return data[0]||data;
  }

  window.DehaxAPI={config,demoEnabled,getSession,token,refreshSession,signIn,signUp,verifyEmailOtp,resendSignupConfirmation,requestPasswordRecovery,verifyPasswordRecoveryOtp,updateRecoveredPassword,signOut,currentUser,currentProfile,getAssets,getTutorials,getCategories,getSubcategories,getSubcategoryLinks,getCategoryTags,getFavorites,toggleFavorite,assetAccess,tutorialAccess,probeCheckoutEmail,prepareCheckoutIdentity,createSubscription,createCardPayment,createPix,paymentStatus,cancelSubscription,subscriptionRetention,requestRefund,audioAiStatus,generateAiAudio,aiAudioFile,accountOverview,updateAccount,callFunction,adminFetch,adminInsert,adminUpdate,adminDelete,adminUpsert,supabaseFetch};
})();
