import { json,parseBody,requireProfile,errResponse,sb,presignR2,safeFilename } from './_lib.mjs';
export const handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Método não permitido.'});
  try{
    const {user,p}=await requireProfile(event),body=parseBody(event),id=String(body.id||'');
    const {data:rows}=await sb(`/rest/v1/ai_audio_generations?id=eq.${encodeURIComponent(id)}&select=*`);const row=rows?.[0];
    if(!row||String(row.user_id)!==String(user.id)&&p.role!=='admin')return json(404,{error:'Áudio não encontrado.'});
    if(row.status!=='ready'||!row.file_key)return json(410,{error:'Este áudio não está mais disponível.'});
    if(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now())return json(410,{error:'O período de armazenamento deste áudio expirou.'});
    const action=body.action==='download'?'download':'play',filename=safeFilename(`dehax-${row.kind==='narration'?'narracao':'sfx'}-${row.id.slice(0,8)}.mp3`);
    return json(200,{url:presignR2({method:'GET',key:row.file_key,expires:300,responseDisposition:`${action==='download'?'attachment':'inline'}; filename="${filename}"`}),filename});
  }catch(e){return errResponse(e)}
};
