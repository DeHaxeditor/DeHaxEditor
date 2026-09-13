import json, os, re, shutil, subprocess, tempfile, threading, time, uuid
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
import boto3
from botocore.client import Config

app = FastAPI(title="DeHax VOD Worker", version="1.0")
INTERNAL_TOKEN=os.getenv("VOD_INTERNAL_TOKEN","")
JOBS={}
LOCK=threading.Lock()
ALLOWED={"youtube.com","youtu.be","twitch.tv","kick.com"}

def auth(x_internal_token:str|None):
    if not INTERNAL_TOKEN or x_internal_token != INTERNAL_TOKEN: raise HTTPException(401,"Unauthorized")

def validate_url(u:str):
    try: h=urlparse(u).hostname or ""
    except: raise HTTPException(400,"URL inválida")
    h=h.lower().removeprefix("www.").removeprefix("m.")
    if not any(h==d or h.endswith("."+d) for d in ALLOWED): raise HTTPException(400,"A versão web aceita links do YouTube, Twitch e Kick.")
    return u

def r2():
    return boto3.client("s3",endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],config=Config(signature_version="s3v4"),region_name="auto")

def fmt_selector(quality, mode, platform):
    h={"2160p":2160,"1440p":1440,"1080p":1080,"720p":720,"480p":480}.get(quality)
    if mode=="mp3": return "bestaudio/best"
    if platform in {"Twitch","Kick"}: return f"best[height<={h}]/best" if h else "best"
    if mode=="best": return f"bv*[height<={h}]+ba/b[height<={h}]/b" if h else "bv*+ba/b"
    if h: return f"bv*[height<={h}][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[height<={h}][ext=mp4]/bv*[height<={h}]+ba/b[height<={h}]/b"
    return "bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b"

def platform_for(u):
    h=(urlparse(u).hostname or '').lower()
    return 'YouTube' if 'youtu' in h else ('Twitch' if 'twitch' in h else ('Kick' if 'kick' in h else 'Auto'))

class AnalyzeIn(BaseModel):
    url:str
    playlist:bool=False
class DownloadIn(BaseModel):
    url:str
    user_id:str
    quality:str="1080p"
    format:str=Field(default="mp4", pattern="^(mp4|best|mp3)$")
    playlist:bool=False
    subtitles:bool=False
    thumbnail:bool=False
    cut_enabled:bool=False
    cut_start:float|None=None
    cut_end:float|None=None
    precise_cut:bool=False

@app.get('/health')
def health(): return {'ok':True,'jobs':len(JOBS)}

@app.post('/analyze')
def analyze(data:AnalyzeIn, x_internal_token:str|None=Header(default=None)):
    auth(x_internal_token); validate_url(data.url)
    cmd=['yt-dlp','--dump-single-json','--no-warnings']
    if not data.playlist: cmd.append('--no-playlist')
    cmd.append(data.url)
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=90)
    if p.returncode: raise HTTPException(422,(p.stderr or p.stdout or 'Falha ao analisar')[-1000:])
    try: info=json.loads(p.stdout.strip().splitlines()[-1])
    except: raise HTTPException(502,'Resposta inválida do analisador.')
    return {'id':info.get('id'),'title':info.get('title'),'uploader':info.get('uploader') or info.get('channel'),'duration':info.get('duration'),'thumbnail':info.get('thumbnail'),'webpage_url':info.get('webpage_url'),'platform':platform_for(data.url)}

def run_job(job_id,data:dict):
    work=Path(tempfile.mkdtemp(prefix='dehax-vod-'))
    try:
        with LOCK: JOBS[job_id].update(status='downloading',progress=0,message='Preparando download…')
        out=str(work/'%(title).180B [%(id)s].%(ext)s')
        platform=platform_for(data['url']); cmd=['yt-dlp','--newline','--no-warnings','--progress','--concurrent-fragments','4','-o',out,'-f',fmt_selector(data['quality'],data['format'],platform),'--max-filesize',os.getenv('VOD_MAX_FILESIZE','25G')]
        if not data.get('playlist'): cmd.append('--no-playlist')
        if data['format']=='mp4': cmd += ['--merge-output-format','mp4']
        elif data['format']=='mp3': cmd += ['-x','--audio-format','mp3']
        if data.get('subtitles'): cmd += ['--write-subs','--write-auto-subs','--sub-langs','pt,pt-BR,en','--sub-format','srt/best']
        if data.get('thumbnail'): cmd += ['--write-thumbnail']
        if data.get('cut_enabled'):
            a=float(data.get('cut_start') or 0); b=float(data.get('cut_end') or 0)
            if b<=a: raise RuntimeError('O fim do recorte precisa ser maior que o início.')
            def ts(s):
                h=int(s//3600);m=int((s%3600)//60);sec=int(s%60);return f'{h:02d}:{m:02d}:{sec:02d}'
            cmd += ['--download-sections',f'*{ts(a)}-{ts(b)}']
            if data.get('precise_cut'): cmd.append('--force-keyframes-at-cuts')
        cmd.append(data['url'])
        proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,errors='replace')
        pct=re.compile(r'(\d+(?:\.\d+)?)%'); eta=re.compile(r'ETA\s+([0-9:]+)'); speed=re.compile(r'at\s+([^\s]+)')
        for raw in proc.stdout:
            line=raw.strip(); m=pct.search(line)
            patch={'message':line[-220:] if line else 'Baixando…'}
            if m: patch['progress']=min(99,float(m.group(1)))
            e=eta.search(line); s=speed.search(line)
            if e: patch['eta']=e.group(1)
            if s: patch['speed']=s.group(1)
            with LOCK: JOBS[job_id].update(patch)
        if proc.wait()!=0: raise RuntimeError('Falha no download. Verifique se o conteúdo está disponível e autorizado.')
        files=[p for p in work.iterdir() if p.is_file()]
        if not files: raise RuntimeError('Nenhum arquivo final foi gerado.')
        # Package multiple outputs (video + subtitles + thumbnail) into zip.
        if len(files)>1:
            archive_base=Path(tempfile.gettempdir())/f'dehax-vod-{job_id}'
            archive_path=Path(shutil.make_archive(str(archive_base),'zip',work))
            final=archive_path
        else: final=files[0]
        key=f"vod/{data['user_id']}/{job_id}/{final.name}"
        client=r2(); client.upload_file(str(final),os.environ['R2_BUCKET'],key)
        url=client.generate_presigned_url('get_object',Params={'Bucket':os.environ['R2_BUCKET'],'Key':key,'ResponseContentDisposition':f'attachment; filename="{final.name}"'},ExpiresIn=3600)
        with LOCK: JOBS[job_id].update(status='done',progress=100,message='Arquivo pronto.',download_url=url,filename=final.name,key=key,finished_at=time.time())
    except Exception as e:
        with LOCK: JOBS[job_id].update(status='error',message=str(e),error=str(e),finished_at=time.time())
    finally:
        shutil.rmtree(work,ignore_errors=True)
        try:
            ap=Path(tempfile.gettempdir())/f'dehax-vod-{job_id}.zip'
            if ap.exists(): ap.unlink()
        except: pass

@app.post('/download')
def start(data:DownloadIn, x_internal_token:str|None=Header(default=None)):
    auth(x_internal_token); validate_url(data.url)
    jid=str(uuid.uuid4()); payload=data.model_dump()
    with LOCK: JOBS[jid]={'id':jid,'status':'queued','progress':0,'message':'Na fila…','created_at':time.time(),'user_id':data.user_id}
    threading.Thread(target=run_job,args=(jid,payload),daemon=True).start()
    return JOBS[jid]

@app.get('/jobs/{job_id}')
def status(job_id:str, user_id:str, x_internal_token:str|None=Header(default=None)):
    auth(x_internal_token)
    with LOCK: job=JOBS.get(job_id)
    if not job or job.get('user_id')!=user_id: raise HTTPException(404,'Job não encontrado.')
    return job
