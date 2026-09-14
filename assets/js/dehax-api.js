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

  async function supabaseFetch(path, opts={}){
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase não configurado.');
    const headers = {
      apikey: config.supabaseAnonKey,
      ...opts.headers
    };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    return fetch(`${config.supabaseUrl}${path}`, {...opts, headers});
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
    {id:'sc1',category_id:'c-sfx',name:'Whoosh',slug:'whoosh',status:'active',sort_order:10},{id:'sc2',category_id:'c-sfx',name:'Impact',slug:'impact',status:'active',sort_order:20},{id:'sc3',category_id:'c-memes',name:'Reaction',slug:'reaction',status:'active',sort_order:10},{id:'sc4',category_id:'c-musicas',name:'Electronic',slug:'electronic',status:'active',sort_order:10},{id:'sc5',category_id:'c-trans',name:'Glitch',slug:'glitch',status:'active',sort_order:10},{id:'sc6',category_id:'c-over',name:'HUD',slug:'hud',status:'active',sort_order:10}
  ];
  async function getCategories({all=false}={}){if(demoEnabled&&!config.supabaseUrl)return DEMO_CATEGORIES;const filter=all?'':'&status=eq.active';const r=await supabaseFetch(`/rest/v1/asset_categories?select=*&order=sort_order.asc,name.asc${filter}`);if(!r.ok)return [];return r.json()}
  async function getSubcategories({all=false}={}){if(demoEnabled&&!config.supabaseUrl)return DEMO_SUBCATEGORIES;const filter=all?'':'&status=eq.active';const r=await supabaseFetch(`/rest/v1/asset_subcategories?select=*&order=sort_order.asc,name.asc${filter}`);if(!r.ok)return [];return r.json()}

  async function getAssets({all=false}={}){
    if (demoEnabled && !config.supabaseUrl) return DEMO_ASSETS;
    const filter = all ? '' : '&status=eq.published';
    const r=await supabaseFetch(`/rest/v1/assets?select=*&order=created_at.desc${filter}`);
    if(!r.ok) throw new Error('Falha ao carregar assets.');
    return r.json();
  }
  async function getTutorials({all=false}={}){
    if (demoEnabled && !config.supabaseUrl) return DEMO_TUTORIALS;
    const filter = all ? '' : '&status=eq.published';
    const r=await supabaseFetch(`/rest/v1/tutorials?select=*&order=order_index.asc,created_at.desc${filter}`);
    if(!r.ok) throw new Error('Falha ao carregar tutoriais.');
    return r.json();
  }
  async function getFavorites(){
    if (demoEnabled && !config.supabaseUrl) return JSON.parse(localStorage.getItem('dehax_demo_favs')||'[]');
    const r=await supabaseFetch('/rest/v1/favorites?select=asset_id');
    if(!r.ok) return [];
    return (await r.json()).map(x=>x.asset_id);
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
    const accessToken=token();
    if(accessToken==='demo-token') return {demo:true};
    const headers={...jsonHeaders};
    // Guest checkout requests must NOT send an empty Authorization header.
    // Some runtimes normalize "Bearer " to "Bearer", which makes the backend
    // think there is a logged-in session and reject the temporary checkout token.
    if(accessToken) headers.Authorization=`Bearer ${accessToken}`;
    const r=await fetch(`/.netlify/functions/${name}`,{method:'POST',headers,body:JSON.stringify(body)});
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
  async function cancelSubscription(){if(demoEnabled&&!config.supabaseUrl)return {demo:true,status:'canceled',accessUntil:null};return callFunction('cancel-subscription',{})}
  async function audioAiStatus(){if(demoEnabled&&!config.supabaseUrl)return {plan:'pro',admin:false,enabled:false,provider:'elevenlabs',providerConfigured:false,tokens:{allowance:1000,used:120,remaining:880,cycleStart:new Date().toISOString(),cycleEnd:new Date(Date.now()+30*86400000).toISOString()},costs:{narrationPer1000Chars:50,sfxPerSecond:10},limits:{storageDays:30,storageGb:1,maxNarrationChars:5000,maxSfxSeconds:30},storage:{usedBytes:0,maxBytes:1073741824},voices:[],history:[]};return callFunction('ai-audio-status',{})}
  async function generateAiAudio(payload={}){if(demoEnabled&&!config.supabaseUrl)throw new Error('A geração real de áudio não está ativa no modo demo.');return callFunction('ai-audio-generate',payload)}
  async function aiAudioFile(id,action='play'){if(demoEnabled&&!config.supabaseUrl)throw new Error('Arquivo indisponível no modo demo.');return callFunction('ai-audio-file',{id,action})}

  async function vodAnalyze(payload){if(demoEnabled&&!config.supabaseUrl){await sleep(500);return {demo:true,title:'Gameplay de demonstração — DeHax',uploader:'Canal Demo',duration:754,platform:/twitch/i.test(payload.url)?'Twitch':/kick/i.test(payload.url)?'Kick':'YouTube',thumbnail:''}}return callFunction('vod-analyze',payload)}
  async function vodStart(payload){if(demoEnabled&&!config.supabaseUrl)return {demo:true,id:'demo-job-'+Date.now(),status:'queued',progress:0};return callFunction('vod-start',payload)}
  async function vodStatus(jobId){if(demoEnabled&&!config.supabaseUrl)return {demo:true,id:jobId,status:'done',progress:100,message:'Arquivo pronto no modo de demonstração.',download_url:'#',filename:'dehax-demo.mp4'};return callFunction('vod-status',{jobId})}

  async function adminFetch(table,{select='*',order='created_at.desc'}={}){
    const r=await supabaseFetch(`/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}`);
    if(!r.ok) throw new Error(`Falha ao carregar ${table}.`); return r.json();
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

  window.DehaxAPI={config,demoEnabled,getSession,token,signIn,signUp,verifyEmailOtp,resendSignupConfirmation,signOut,currentUser,currentProfile,getAssets,getTutorials,getCategories,getSubcategories,getFavorites,toggleFavorite,assetAccess,tutorialAccess,probeCheckoutEmail,prepareCheckoutIdentity,createSubscription,createCardPayment,createPix,paymentStatus,cancelSubscription,audioAiStatus,generateAiAudio,aiAudioFile,vodAnalyze,vodStart,vodStatus,callFunction,adminFetch,adminInsert,adminUpdate,adminDelete,adminUpsert,supabaseFetch};
})();
