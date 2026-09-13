(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function installCursorGlow(){
    if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if ($('.cursor-glow')) return;
    const glow=document.createElement('div'); glow.className='cursor-glow'; document.body.appendChild(glow);
    let tx=innerWidth*.5,ty=innerHeight*.4,x=tx,y=ty,raf=0;
    const tick=()=>{x+=(tx-x)*.14;y+=(ty-y)*.14;glow.style.left=x+'px';glow.style.top=y+'px';raf=requestAnimationFrame(tick)};
    addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY;glow.classList.add('visible')},{passive:true});
    addEventListener('pointerleave',()=>glow.classList.remove('visible'));
    raf=requestAnimationFrame(tick);
    addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
  }

  function enhanceSelect(select){
    if (!select || select.dataset.enhanced==='1' || select.multiple || select.size>1) return;
    select.dataset.enhanced='1';
    const wrap=document.createElement('div'); wrap.className='dh-select';
    const button=document.createElement('button'); button.type='button'; button.className='dh-select-trigger';
    button.setAttribute('aria-haspopup','listbox'); button.setAttribute('aria-expanded','false');
    const label=document.createElement('span'); label.className='dh-select-label';
    const chevron=document.createElement('span'); chevron.className='dh-select-chevron'; chevron.textContent='⌄';
    button.append(label,chevron);
    const menu=document.createElement('div'); menu.className='dh-select-menu'; menu.setAttribute('role','listbox');
    select.parentNode.insertBefore(wrap,select); wrap.append(select,button,menu); select.classList.add('dh-native-select');

    const rebuild=()=>{
      menu.innerHTML='';
      [...select.options].forEach((opt,i)=>{
        const item=document.createElement('button'); item.type='button'; item.className='dh-select-option'; item.setAttribute('role','option');
        item.dataset.value=opt.value; item.disabled=opt.disabled; item.textContent=opt.textContent;
        if(i===select.selectedIndex){item.classList.add('selected');item.setAttribute('aria-selected','true')}
        item.addEventListener('click',()=>{
          select.value=opt.value; select.dispatchEvent(new Event('change',{bubbles:true})); sync(); close();
        });
        menu.appendChild(item);
      });
      sync();
    };
    const sync=()=>{
      const opt=select.options[select.selectedIndex]; label.textContent=opt?.textContent||select.placeholder||'Selecionar';
      $$('.dh-select-option',menu).forEach(x=>{const on=x.dataset.value===select.value;x.classList.toggle('selected',on);x.setAttribute('aria-selected',on?'true':'false')});
      button.disabled=select.disabled;
    };
    const open=()=>{if(button.disabled)return; document.querySelectorAll('.dh-select.open').forEach(x=>x!==wrap&&x.classList.remove('open'));wrap.classList.add('open');button.setAttribute('aria-expanded','true')};
    const close=()=>{wrap.classList.remove('open');button.setAttribute('aria-expanded','false')};
    button.addEventListener('click',()=>wrap.classList.contains('open')?close():open());
    select.addEventListener('change',sync);
    const observer=new MutationObserver(rebuild); observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});
    wrap._dhRebuild=rebuild; rebuild();
  }
  function enhanceAll(root=document){$$('select',root).forEach(enhanceSelect)}
  addEventListener('click',e=>{if(!e.target.closest('.dh-select'))document.querySelectorAll('.dh-select.open').forEach(x=>x.classList.remove('open'))});
  addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.dh-select.open').forEach(x=>x.classList.remove('open'))});

  window.DehaxUI={enhanceAll,enhanceSelect,refreshSelect:select=>select?.closest('.dh-select')?._dhRebuild?.(),installCursorGlow};
  const boot=()=>{enhanceAll();installCursorGlow()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
