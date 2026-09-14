import { sb,presignR2 } from './_lib.mjs';
export default async ()=>{
  const now=new Date().toISOString();
  const stuckBefore=new Date(Date.now()-30*60*1000).toISOString();
  try{await sb(`/rest/v1/ai_audio_generations?status=eq.processing&created_at=lt.${encodeURIComponent(stuckBefore)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'failed'}})}catch(e){console.error('AI audio stale reservation cleanup',e?.message||e)}
  const {data:rows}=await sb(`/rest/v1/ai_audio_generations?status=eq.ready&expires_at=lt.${encodeURIComponent(now)}&file_key=not.is.null&select=id,file_key&limit=100`);
  let cleaned=0;
  for(const row of rows||[]){
    try{
      const url=presignR2({method:'DELETE',key:row.file_key,expires:120});const r=await fetch(url,{method:'DELETE'});if(!r.ok)continue;
      await sb(`/rest/v1/ai_audio_generations?id=eq.${encodeURIComponent(row.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{status:'expired',file_key:null,file_size:0}});cleaned++;
    }catch(e){console.error('AI audio cleanup',row.id,e?.message||e)}
  }
  console.log(`AI audio cleanup: ${cleaned} arquivo(s) removido(s).`);
};
export const config={schedule:'@daily'};
