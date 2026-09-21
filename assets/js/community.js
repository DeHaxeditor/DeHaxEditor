(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const header=$('#header'), progress=$('#progress');let communitySettings={},proPlan='semester';
  function onScroll(){header?.classList.toggle('scrolled',scrollY>20);const d=document.documentElement,max=d.scrollHeight-d.clientHeight;if(progress)progress.style.width=(max?d.scrollTop/max*100:0)+'%';if(innerWidth>950){$$('.parallax').forEach(el=>{const r=el.getBoundingClientRect(),speed=Number(el.dataset.speed||.03);el.style.transform=`perspective(1000px) rotateY(-4deg) rotateX(2deg) translateY(${r.top*speed}px)`})}}
  addEventListener('scroll',onScroll,{passive:true});onScroll();
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.12});$$('.reveal').forEach(x=>io.observe(x));

  function initEditorParallax(){
    const card=$('#communityEditorCard');
    if(!card||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let raf=0,targetX=0,targetY=0,currentX=0,currentY=0;
    const monitor=card.querySelector('.editor-monitor'),timeline=card.querySelector('.editor-timeline');
    const draw=()=>{currentX+=(targetX-currentX)*.11;currentY+=(targetY-currentY)*.11;card.style.transform=`rotateX(${(-currentY*4).toFixed(2)}deg) rotateY(${(currentX*6).toFixed(2)}deg) translate3d(${(currentX*5).toFixed(1)}px,${(currentY*4).toFixed(1)}px,0)`;if(monitor)monitor.style.transform=`translate3d(${(currentX*3).toFixed(1)}px,${(currentY*2).toFixed(1)}px,28px)`;if(timeline)timeline.style.transform=`translate3d(${(-currentX*2.5).toFixed(1)}px,${(-currentY*1.8).toFixed(1)}px,28px)`;if(Math.abs(targetX-currentX)>.002||Math.abs(targetY-currentY)>.002)raf=requestAnimationFrame(draw);else raf=0};
    const kick=()=>{if(!raf)raf=requestAnimationFrame(draw)};
    addEventListener('pointermove',e=>{targetX=Math.max(-1,Math.min(1,e.clientX/Math.max(1,innerWidth)*2-1));targetY=Math.max(-1,Math.min(1,e.clientY/Math.max(1,innerHeight)*2-1));kick()},{passive:true});
    addEventListener('blur',()=>{targetX=0;targetY=0;kick()});
  }

  async function getFallback(){try{const r=await fetch('/content/community.json',{cache:'no-store'});return r.ok?await r.json():{}}catch{return {}}}
  const cleanId=v=>{const m=String(v||'').match(/(?:youtu\.be\/|v=|embed\/)?([A-Za-z0-9_-]{6,})/);return m?m[1]:''};
  const money=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const benefitList=(v,fallback)=>Array.isArray(v)&&v.length?v:fallback;
  function renderProPlan(){
    const monthly=Number(String(communitySettings.pro_monthly_price||communitySettings.pro_price||'19.90').replace(',','.'))||19.9,semTotal=Number(String(communitySettings.pro_semester_total||'59.40').replace(',','.'))||59.4,semEq=Number(String(communitySettings.pro_semester_monthly_equiv||'9.90').replace(',','.'))||9.9,pixDays=Math.max(1,Number(communitySettings.pix_access_days||30)||30),regular=monthly*6,saving=Math.max(0,regular-semTotal),pct=regular?Math.round(saving/regular*100):0,sem=proPlan==='semester';
    const sw=$('#proPlanSwitch');if(sw){sw.dataset.plan=proPlan;sw.querySelectorAll('[data-pro-plan]').forEach(b=>b.classList.toggle('active',b.dataset.proPlan===proPlan))}
    $('#proPlanCard')?.classList.toggle('plan-semester-active',sem);$('#proPlanCard')?.classList.toggle('plan-monthly-active',!sem);
    if($('#proPrice'))$('#proPrice').textContent=money(sem?semEq:monthly);if($('#proPriceSuffix'))$('#proPriceSuffix').textContent='/ mês';
    if($('#proSaving'))$('#proSaving').textContent=sem?`Economize R$ ${money(saving)} no período · ${pct}% de vantagem em relação a 6 mensalidades`:`Plano flexível de R$ ${money(monthly)}/mês`;
    if($('#proPlanNote'))$('#proPlanNote').innerHTML=sem?`<strong>Pagamento integral de R$ ${money(semTotal)}.</strong> O acesso PRO é liberado por 6 meses. O valor não é parcelado e não há cobrança mensal durante esse período.`:`<strong>R$ ${money(monthly)}/mês.</strong> No cartão, a assinatura é recorrente e pode ser cancelada quando quiser. No Pix, o pagamento é avulso por ${Math.round(pixDays)} dias e pode ser renovado antes sem perder dias.`;
    const benefits=benefitList(sem?communitySettings.semester_plan_benefits:communitySettings.monthly_plan_benefits,sem?['Todo o biblioteca de assets','Todos os tutoriais PRO','Novos conteúdos adicionados','Preview + download direto','6 meses de acesso com maior economia']:['Todo o biblioteca de assets','Todos os tutoriais PRO','Novos conteúdos adicionados','Preview + download direto','Renovação mensal flexível']);if($('#proBenefits'))$('#proBenefits').innerHTML=benefits.map(x=>`<li>${String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]))}</li>`).join('');
    if($('#proCta'))$('#proCta').href=`/checkout/?plan=${sem?'semester':'monthly'}`;
  }
  async function loadSettings(){
    let s=await getFallback();
    if(window.DehaxAPI?.config?.supabaseUrl){try{const r=await window.DehaxAPI.supabaseFetch('/rest/v1/app_settings?select=key,value');if(r.ok){for(const row of await r.json())s[row.key]=typeof row.value==='string'?row.value:(row.value?.value??row.value)}}catch{}}
    communitySettings=s;const portfolio=(s.public_site_content&&typeof s.public_site_content==='object')?s.public_site_content:{};const setImg=(id,url)=>{const img=$(id);if(!img)return;if(url){img.src=String(url);img.hidden=false;img.closest('.editor-monitor,.editor-timeline')?.classList.add('media-ready')}};setImg('#communityPreviewImage',portfolio.preview_image);setImg('#communityTimelineImage',portfolio.timeline_image);
    const free=benefitList(s.free_plan_benefits,['Conta na plataforma','Assets e aulas gratuitas','Visualização do biblioteca PRO']);if($('#freeBenefits'))$('#freeBenefits').innerHTML=free.map(x=>`<li>${String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#39;'}[c]))}</li>`).join('');
    renderProPlan();
    const txt=(id,val)=>{if($(id)&&val)$(id).textContent=String(val)};txt('#landingEyebrow',s.landing_eyebrow);txt('#landingCopy',s.landing_copy);txt('#landingCtaText',s.landing_cta_text);txt('#showcaseHeading',s.showcase_heading);for(let i=1;i<=3;i++)txt(`#showcaseTitle${i}`,s[`showcase_title_${i}`]);
    if(s.landing_title&&$('#landingTitle'))$('#landingTitle').innerHTML=String(s.landing_title).replace(/\n/g,'<br>');
    const setLink=(id,url)=>{const a=$(id);if(url){a.href=url;a.target='_blank';a.rel='noopener';a.classList.remove('disabled')}};setLink('#discordLink',s.discord_url);setLink('#whatsappLink',s.whatsapp_url);
    const embed=(sel,val,title)=>{const id=cleanId(val);if(id&&$(sel))$(sel).innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`};
    embed('#heroVideo',s.hero_youtube_id,'Apresentação Comunidade DeHax');for(let i=1;i<=3;i++)embed(`#showcaseVideo${i}`,s[`showcase_youtube_${i}`],`DeHax na prática ${i}`);
    if(s.brand_red)document.documentElement.style.setProperty('--red',String(s.brand_red));if(s.brand_cyan)document.documentElement.style.setProperty('--cyan',String(s.brand_cyan));
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-pro-plan]');if(!b)return;proPlan=b.dataset.proPlan;renderProPlan()});
  function preserveAttribution(){const p=new URLSearchParams(location.search),keep=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'];const a={};keep.forEach(k=>{if(p.get(k))a[k]=p.get(k)});if(Object.keys(a).length)sessionStorage.setItem('dehax_attribution',JSON.stringify(a));$$('a[href^="/entrar/"],a[href^="/checkout/"]').forEach(link=>{const u=new URL(link.href,location.origin);for(const [k,v] of Object.entries(a))u.searchParams.set(k,v);link.href=u.pathname+u.search})}
  addEventListener('DOMContentLoaded',()=>{preserveAttribution();initEditorParallax();setTimeout(loadSettings,0)});
})();
