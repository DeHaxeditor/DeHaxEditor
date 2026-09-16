import { json,parseBody,requireProfile,sb,getSetting,activePro,clientHash,errResponse,safeFilename,presignR2 } from './_lib.mjs';

const asResponse=result=>new Response(result.body,{status:result.statusCode,headers:result.headers});
const eventFromRequest=async req=>({httpMethod:req.method,headers:Object.fromEntries(req.headers.entries()),body:await req.text()});

export default async req=>{
  const event=await eventFromRequest(req);
  if(event.httpMethod!=='POST')return asResponse(json(405,{error:'Método não permitido.'}));
  try{
    const {assetId,action='download'}=parseBody(event);
    if(!assetId||!['download','preview','preview-file'].includes(action))return asResponse(json(400,{error:'Solicitação inválida.'}));
    const isPreview=action==='preview'||action==='preview-file';

    // Preview é público. Download continua exigindo conta e respeitando o plano.
    let user=null,p=null;
    if(action==='download')({user,p}=await requireProfile(event));

    const globalEnabled=await getSetting('global_downloads_enabled',true);
    if(action==='download'&&globalEnabled===false)throw Object.assign(new Error('Downloads estão temporariamente pausados pela administração.'),{status:503});

    const {data:rows}=await sb(`/rest/v1/assets?id=eq.${encodeURIComponent(assetId)}&select=*`);
    const a=rows?.[0];
    if(!a||a.status!=='published')throw Object.assign(new Error('Este asset não está disponível.'),{status:404});

    if(a.category_id){const {data:c}=await sb(`/rest/v1/asset_categories?id=eq.${encodeURIComponent(a.category_id)}&select=status`);if(c?.[0]?.status!=='active')throw Object.assign(new Error('Esta categoria está temporariamente indisponível.'),{status:404})}
    if(a.subcategory_id){const {data:sc}=await sb(`/rest/v1/asset_subcategories?id=eq.${encodeURIComponent(a.subcategory_id)}&select=status`);if(sc?.[0]?.status!=='active')throw Object.assign(new Error('Esta subcategoria está temporariamente indisponível.'),{status:404})}

    if(action==='download'&&a.access_level==='pro'&&!activePro(p))throw Object.assign(new Error('Este conteúdo é exclusivo para membros PRO.'),{status:403});
    if(action==='download'&&!a.download_enabled)throw Object.assign(new Error('O download deste item está temporariamente pausado.'),{status:423});
    if(isPreview&&!a.preview_enabled)throw Object.assign(new Error('O preview deste item está temporariamente pausado.'),{status:423});

    const {data:privateRows}=await sb(`/rest/v1/asset_files?asset_id=eq.${encodeURIComponent(assetId)}&select=file_key,preview_key`);
    const f=privateRows?.[0];
    const key=action==='preview-file'
      ? f?.preview_key
      : action==='preview'
        ? (f?.preview_key||((a.media_type==='audio'||a.media_type==='video'||a.media_type==='image')?f?.file_key:null))
        : f?.file_key;
    if(!key)throw Object.assign(new Error(isPreview?'Este item ainda não possui preview.':'Arquivo ainda não foi enviado.'),{status:404});

    if(action==='download'){
      const settingLimit=Number(await getSetting('download_daily_limit',Number(process.env.DOWNLOAD_DAILY_LIMIT||1000)))||1000;
      const since=new Date(Date.now()-864e5).toISOString();
      const {data:dls}=await sb(`/rest/v1/downloads?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(since)}&action=eq.download&select=id&limit=${settingLimit+1}`);
      if((dls?.length||0)>=settingLimit)throw Object.assign(new Error(`Limite de segurança atingido (${settingLimit} downloads em 24h). Entre em contato com o suporte se estiver em uso legítimo.`),{status:429});
    }

    const ext=(String(key).match(/\.([A-Za-z0-9]{1,8})$/)||[])[1]||String(a.file_format||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8);
    const filename=safeFilename(`${a.title||'dehax'}${ext?'.'+ext:''}`);
    const url=presignR2({method:'GET',key,expires:120,responseDisposition:action==='download'?`attachment; filename="${filename}"`:'inline'});

    // O player HTMLVideoElement do UXP pode falhar ao fazer streaming direto de uma URL
    // assinada do R2. Para o plugin, entregamos o preview ultraleve pelo próprio backend;
    // o plugin o grava em plugin-temp e reproduz localmente. O site continua usando a URL
    // assinada normal em action='preview'.
    if(action==='preview-file'){
      const upstream=await fetch(url,{method:'GET'});
      if(!upstream.ok)throw Object.assign(new Error(`Falha ao carregar preview (${upstream.status}).`),{status:502,expose:true});
      const headers=new Headers();
      headers.set('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');
      headers.set('Cache-Control','private, max-age=60');
      headers.set('Content-Disposition','inline');
      const length=upstream.headers.get('content-length');
      if(length)headers.set('Content-Length',length);
      return new Response(upstream.body,{status:200,headers});
    }

    if(action==='download'){
      await sb('/rest/v1/downloads',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:user.id,asset_id:a.id,action:'download',ip_hash:clientHash(event)}});
      try{await sb('/rest/v1/rpc/increment_asset_download',{method:'POST',body:{asset_uuid:a.id}})}catch{}
    }
    return asResponse(json(200,{url,expiresIn:120,action}));
  }catch(e){return asResponse(errResponse(e))}
};
