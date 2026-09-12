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
      const profile = {id:'demo-user',email,display_name:email.split('@')[0]||'Editor',role,plan,subscription_status:plan==='pro'?'authorized':'inactive'};
      localStorage.setItem(DEMO_KEY, JSON.stringify(profile));
      setSession({access_token:'demo-token',user:{id:'demo-user',email}});
      await sleep(250); return {user:{id:'demo-user',email},profile,demo:true};
    }
    const r = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email,password})});
    const data = await r.json();
    if(!r.ok) throw new Error(data.msg || data.error_description || data.error || 'Não foi possível entrar.');
    setSession(data);
    return data;
  }

  async function signUp(email,password,name){
    if (!config.supabaseUrl || !config.supabaseAnonKey) { if (!demoEnabled) throw new Error('A área de membros ainda não foi conectada ao Supabase.'); }
    if (demoEnabled && !config.supabaseUrl) return signIn(email,password);
    const r = await fetch(`${config.supabaseUrl}/auth/v1/signup`, {method:'POST',headers:{...jsonHeaders,apikey:config.supabaseAnonKey},body:JSON.stringify({email,password,data:{display_name:name||''}})});
    const data = await r.json();
    if(!r.ok) throw new Error(data.msg || data.error_description || data.error || 'Não foi possível criar a conta.');
    if(data.access_token) setSession(data);
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
    const r=await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,display_name,email,role,plan,subscription_status,subscription_id,is_suspended,created_at`);
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
    {id:'t3',title:'Memes sem deixar a edição cansativa',description:'Timing, repetição e contraste para humor em gameplay.',category:'Storytelling',duration_label:'21 min',access_level:'pro',status:'published',featured:false,order_index:3,thumbnail_url:''}
  ];

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
    if(token()==='demo-token') return {demo:true};
    const r=await fetch(`/.netlify/functions/${name}`,{method:'POST',headers:{...jsonHeaders,Authorization:`Bearer ${token()}`},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||data.message||`Erro ${r.status}`);
    return data;
  }

  async function assetAccess(assetId,action='download'){
    if (demoEnabled && !config.supabaseUrl) throw new Error('No modo de demonstração não há arquivo real para baixar.');
    return callFunction('asset-access',{assetId,action});
  }
  async function tutorialAccess(tutorialId){
    if (demoEnabled && !config.supabaseUrl) throw new Error('Adicione o ID do vídeo no painel quando o Supabase estiver configurado.');
    return callFunction('tutorial-access',{tutorialId});
  }
  async function createSubscription(){
    if (demoEnabled && !config.supabaseUrl) throw new Error('Mercado Pago não está ativo no modo de demonstração.');
    return callFunction('create-subscription',{});
  }

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

  window.DehaxAPI={config,demoEnabled,getSession,token,signIn,signUp,signOut,currentUser,currentProfile,getAssets,getTutorials,getFavorites,toggleFavorite,assetAccess,tutorialAccess,createSubscription,callFunction,adminFetch,adminInsert,adminUpdate,adminDelete,adminUpsert,supabaseFetch};
})();
