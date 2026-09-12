const DEFAULT_CONTENT={
  site_name:"DeHax Editor",logo:"",status:"Disponível para novos projetos",hero_line_1:"DEHAX",hero_line_2:"VIDEO",hero_line_3:"EDITOR",hero_text:"Edição para YouTube, gameplays e conteúdo gamer. Ritmo, impacto visual e narrativa para transformar gravações em vídeos que seguram atenção.",hero_primary:"Ver trabalhos",hero_secondary:"Vamos trabalhar juntos",preview_image:"/assets/preview-placeholder.svg",timeline_image:"/assets/timeline-placeholder.svg",
  marquee:["PREMIERE PRO","AFTER EFFECTS","DAVINCI RESOLVE","CAPCUT","I.A.","MOTION","STORYTELLING","GAMEPLAY","YOUTUBE","SHORTS"],
  work_title:"Vídeos que\nfalam por mim.",work_text:"Seleção de trabalhos para YouTube, gameplays, shorts e conteúdo digital.",
  projects:[
    {title:"Gameplay Edit 01",meta:"Gameplay • Long-form • Storytelling",category:"Gameplay",youtube_url:"",thumbnail:"",featured:true},
    {title:"Challenge Edit",meta:"Gaming • YouTube",category:"Gameplay",youtube_url:"",thumbnail:"",featured:false},
    {title:"Action Cut",meta:"Motion • Fast paced",category:"Motion",youtube_url:"",thumbnail:"",featured:false},
    {title:"Shorts Pack",meta:"Short-form • Vertical",category:"Shorts",youtube_url:"",thumbnail:"",featured:false},
    {title:"Gameplay Edit 05",meta:"Gaming • Retention",category:"Gameplay",youtube_url:"",thumbnail:"",featured:false}
  ],
  skills_title:"Ferramentas.\nSem enrolação.",skills_text:"O software é ferramenta. O foco é ritmo, timing, retenção, clareza e acabamento.",skills:[
    {name:"Adobe Premiere Pro",use:"Edição • ritmo • narrativa"},{name:"After Effects",use:"Motion • VFX • composição"},{name:"DaVinci Resolve",use:"Color • finishing • áudio"},{name:"CapCut",use:"Shorts • social • agilidade"},{name:"Inteligência Artificial",use:"Workflow • criação • apoio visual"}
  ],
  about_title:"Sobre mim.",about_image:"",about_paragraphs:["Sou editor de vídeo focado em conteúdo digital, YouTube e entretenimento. Meu trabalho combina edição, motion, acabamento e novas ferramentas para construir vídeos mais dinâmicos sem apagar a identidade de quem está na frente da câmera.","Para gameplays, o objetivo é simples: tirar o tempo morto e valorizar os momentos que fazem o público continuar assistindo."],stats:[{value:"YouTube",label:"Long-form"},{value:"Gaming",label:"Foco principal"},{value:"Remote",label:"Disponível"}],
  contact_title:"Seu próximo vídeo\npode começar aqui.",contact_text:"Gameplay, vlog gamer, vídeo longo, shorts ou pacote recorrente para canal.",email:"contato@dehaxeditor.com",instagram:"",whatsapp:"",footer_tools:"Premiere • After Effects • DaVinci • CapCut • AI"
};

const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function nlTitle(text){return esc(text).replace(/\n/g,'<br>')}
function youtubeId(url){if(!url)return'';const s=String(url).trim();const m=s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);return m?m[1]:(/^[A-Za-z0-9_-]{6,}$/.test(s)?s:'')}
function pathFix(p){if(!p)return'';return p.startsWith('/')?p.slice(1):p}
function setImage(img,empty,path){if(path){img.src=pathFix(path);img.hidden=false;if(empty)empty.hidden=true}else{img.hidden=true;if(empty)empty.hidden=false}}

async function getContent(){try{const r=await fetch('content/site.json',{cache:'no-store'});if(!r.ok)throw 0;return {...DEFAULT_CONTENT,...await r.json()}}catch(e){return DEFAULT_CONTENT}}

function render(content){
  document.title=`${content.site_name||'DeHax Editor'} — Video Editor`;
  $('#statusText').textContent=content.status||''; $('#heroLine1').textContent=content.hero_line_1||''; $('#heroLine2').textContent=content.hero_line_2||''; $('#heroLine3').textContent=content.hero_line_3||''; $('#heroCopy').textContent=content.hero_text||'';
  $('#heroPrimary').childNodes[0].nodeValue=(content.hero_primary||'Ver trabalhos')+' '; $('#heroSecondary').childNodes[0].nodeValue=(content.hero_secondary||'Vamos trabalhar juntos')+' ';
  const brandLogo=$('#brandLogo'),fallback=$('.brand-fallback'); if(content.logo){brandLogo.src=pathFix(content.logo);brandLogo.hidden=false;fallback.hidden=true}else{brandLogo.hidden=true;fallback.hidden=false}
  setImage($('#previewImage'),$('#previewEmpty'),content.preview_image); setImage($('#timelineImage'),$('#timelineEmpty'),content.timeline_image);
  const mar=(content.marquee||DEFAULT_CONTENT.marquee).map((x,i)=>`<b>${esc(x)}</b> ✦ `).join(''); $('#marquee').innerHTML=`<span>${mar}&nbsp;</span><span>${mar}&nbsp;</span>`;
  $('#workTitle').innerHTML=nlTitle(content.work_title||''); $('#workCopy').textContent=content.work_text||'';
  renderProjects(content.projects||[]);
  const skillsTitle=(content.skills_title||'').split('\n'); $('#skillsTitle').innerHTML=skillsTitle.map((t,i)=>i?`<span class="stroke-soft">${esc(t)}</span>`:esc(t)).join('<br>'); $('#skillsCopy').textContent=content.skills_text||'';
  $('#skillsList').innerHTML=(content.skills||[]).map((s,i)=>`<div class="skill-row"><span class="skill-num">${String(i+1).padStart(2,'0')}</span><span class="skill-name">${esc(s.name)}</span><span class="skill-use">${esc(s.use)}</span></div>`).join('');
  $('#aboutTitle').textContent=content.about_title||'Sobre mim.'; const about=$('#aboutText'); about.innerHTML=(content.about_paragraphs||[]).map((p,i)=>`<p>${esc(p)}</p>`).join(''); if(content.about_image){$('#aboutImage').src=pathFix(content.about_image);$('#aboutImage').hidden=false;$('.avatar-placeholder').hidden=true;$('#avatarBox small').hidden=true}
  $('#statsList').innerHTML=(content.stats||[]).map(s=>`<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join('');
  $('#contactTitle').innerHTML=nlTitle(content.contact_title||''); $('#contactCopy').textContent=content.contact_text||''; const actions=[]; if(content.email)actions.push(`<a class="btn primary magnetic" href="mailto:${esc(content.email)}">Falar por e-mail <span>↗</span></a>`); if(content.whatsapp)actions.push(`<a class="btn secondary magnetic" target="_blank" rel="noopener" href="${esc(content.whatsapp)}">WhatsApp <span>↗</span></a>`); if(content.instagram)actions.push(`<a class="btn secondary magnetic" target="_blank" rel="noopener" href="${esc(content.instagram)}">Instagram <span>↗</span></a>`); $('#contactActions').innerHTML=actions.join('');
  $('#footerName').textContent=`© ${new Date().getFullYear()} ${content.site_name||'DeHax Editor'}`; $('#footerTools').textContent=content.footer_tools||'';
  initDynamicInteractions();
}

function renderProjects(projects){
  const cats=['Todos',...new Set(projects.map(p=>p.category).filter(Boolean))]; $('#filters').innerHTML=cats.map((c,i)=>`<button class="filter ${i===0?'active':''}" data-filter="${esc(c.toLowerCase())}">${esc(c)}</button>`).join('');
  $('#projects').innerHTML=projects.map((p,i)=>{const id=youtubeId(p.youtube_url);const thumb=p.thumbnail?pathFix(p.thumbnail):(id?`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`:'');const style=thumb?`style="background-image:url('${esc(thumb)}')"`:'';return `<article class="project reveal ${p.featured?'wide':''} ${id?'':'no-video'}" data-cat="${esc((p.category||'Outros').toLowerCase())}" data-video="${esc(id)}"><div class="thumb ${thumb?'':'placeholder'}" ${style}></div><div class="project-content"><div><div class="meta">${esc(p.meta||p.category||'')}</div><h3>${esc(p.title||`Projeto ${i+1}`)}</h3></div><div class="play"></div></div></article>`}).join('');
}

function initDynamicInteractions(){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.12}); $$('.reveal').forEach(el=>io.observe(el));
  $$('.filter').forEach(f=>f.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));f.classList.add('active');const cat=f.dataset.filter;$$('.project').forEach(p=>p.style.display=cat==='todos'||p.dataset.cat===cat?'block':'none')});
  $$('.project').forEach(card=>{card.addEventListener('mousemove',e=>{if(innerWidth<851)return;const r=card.getBoundingClientRect(),rx=((e.clientY-r.top)/r.height-.5)*-3.5,ry=((e.clientX-r.left)/r.width-.5)*4.5;card.style.transform=`perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`});card.addEventListener('mouseleave',()=>card.style.transform='');card.onclick=()=>{if(!card.dataset.video)return;openVideo(card.dataset.video)}});
  $$('.magnetic').forEach(btn=>{btn.addEventListener('mousemove',e=>{if(innerWidth<851)return;const r=btn.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;btn.style.transform=`translate(${x*.09}px,${y*.13}px) translateY(-2px)`});btn.addEventListener('mouseleave',()=>btn.style.transform='')});
}

const header=$('#header'),progress=$('#progress'); addEventListener('scroll',()=>{header.classList.toggle('scrolled',scrollY>30);const d=document.documentElement,den=d.scrollHeight-d.clientHeight;progress.style.width=(den?d.scrollTop/den*100:0)+'%'}); const glow=$('#cursorGlow'); addEventListener('pointermove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px'});
$('#mobileToggle').onclick=()=>{const m=$('#menu'),b=$('#mobileToggle');m.classList.toggle('open');b.setAttribute('aria-expanded',m.classList.contains('open'))}; $$('#menu a').forEach(a=>a.onclick=()=>$('#menu').classList.remove('open'));
const modal=$('#modal'),frame=$('#videoFrame'); function openVideo(id){frame.src=`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'} function closeVideo(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');frame.src='';document.body.style.overflow=''} $('#closeModal').onclick=closeVideo;modal.addEventListener('click',e=>{if(e.target===modal)closeVideo()});addEventListener('keydown',e=>{if(e.key==='Escape')closeVideo()});
const card=$('#editorCard'); card.addEventListener('mousemove',e=>{if(innerWidth<851)return;const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`rotate(4deg) perspective(900px) rotateX(${-y*4}deg) rotateY(${x*5}deg)`});card.addEventListener('mouseleave',()=>card.style.transform='rotate(4deg)');
getContent().then(render);
