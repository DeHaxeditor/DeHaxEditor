(() => {
  const cfg = window.DEHAX_CONFIG || {};
  const FALLBACK = {
    manager_version: '1.1.0',
    manager_sha256: '00ff33ed53b84d876b3dd28f3462ec5980fcce7eb8c3394a761fa4a349765cd3',
    manager_file_size: '≈ 77 MB',
    manager_download_url: '',
    manager_cover_url: '',
    plugin_name: 'Gameplay Pack',
    plugin_version: '1.0.0',
    plugin_download_url: '',
    plugin_cover_url: ''
  };
  const setText=(sel,val)=>document.querySelectorAll(sel).forEach(el=>{el.textContent=String(val??'')});
  const setCover=(sel,url)=>{
    document.querySelectorAll(sel).forEach(img=>{
      const wrap=img.closest('.product-cover-wrap,.tool-cover');
      if(url){img.src=String(url);img.hidden=false;wrap?.classList.add('has-cover')}
      else{img.removeAttribute('src');img.hidden=true;wrap?.classList.remove('has-cover')}
    });
  };
  const setDownload=(sel,url,emptyLabel)=>{
    document.querySelectorAll(sel).forEach(el=>{
      const ready=!!String(url||'').trim();
      if(ready){el.href=String(url).trim();el.removeAttribute('aria-disabled');el.classList.remove('disabled');el.dataset.ready='1';}
      else{el.href='#';el.setAttribute('aria-disabled','true');el.classList.add('disabled');el.dataset.ready='0';el.onclick=e=>{e.preventDefault();};if(emptyLabel)el.textContent=emptyLabel;}
    });
  };
  function apply(raw={}){
    const s={...FALLBACK,...raw};
    setText('[data-manager-version]',s.manager_version);
    setText('[data-manager-sha]',s.manager_sha256);
    setText('[data-manager-size]',s.manager_file_size);
    setText('[data-manager-status]',s.manager_download_url?'Download disponível · Windows 10/11 · x64':'Instalador ainda não publicado.');
    setCover('[data-manager-cover]',s.manager_cover_url);
    setDownload('[data-manager-download]',s.manager_download_url,'DOWNLOAD AINDA NÃO PUBLICADO');

    setText('[data-plugin-name]',s.plugin_name);
    setText('[data-plugin-version]',s.plugin_version);
    setText('[data-plugin-status]',s.plugin_download_url?'Download direto disponível':'Download direto ainda não publicado.');
    setCover('[data-plugin-cover]',s.plugin_cover_url);
    setDownload('[data-plugin-download]',s.plugin_download_url,'DOWNLOAD AINDA NÃO PUBLICADO');
  }
  async function load(){
    apply(FALLBACK);
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
    try{
      const keys='manager_download_url,manager_version,manager_sha256,manager_file_size,manager_cover_url,plugin_name,plugin_version,plugin_download_url,plugin_cover_url';
      const url=cfg.supabaseUrl+'/rest/v1/app_settings?key=in.('+keys+')&select=key,value';
      const r=await fetch(url,{headers:{apikey:cfg.supabaseAnonKey},cache:'no-store'});
      if(!r.ok)return;
      const data={};
      for(const row of await r.json())data[row.key]=(row.value&&typeof row.value==='object'&&!Array.isArray(row.value)&&'value' in row.value)?row.value.value:row.value;
      apply(data);
    }catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
