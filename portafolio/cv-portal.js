(() => {
  "use strict";
  const by = id => document.getElementById(id);
  const t = value => window.CGALang?.t(value) ?? value;
  const locale = window.CGALang?.current === "es" ? "es" : "en";
  const toggle = by("downloadToggle"), menu = by("downloadMenu");
  const dialog = by("cvDialog"), form = by("cvLookupForm"), ruc = by("cvRuc");
  const status = by("cvResult"), loader=by("cvLookupLoader"), submit=form.querySelector('button[type="submit"]');
  let navigating=false,viewportHeight=0;
  const vv=window.visualViewport;
  function fitDialog(){
    if(!dialog.open)return;
    const height=vv?.height||window.innerHeight,width=vv?.width||window.innerWidth;
    const compact=height<500||(width>height&&height<760);
    dialog.dataset.compact=String(compact);
    for(const [key,value] of Object.entries({top:vv?.offsetTop||0,left:vv?.offsetLeft||0,width,height}))dialog.style.setProperty('--cv-vv-'+key,value+'px');
    if(compact&&document.activeElement===ruc&&height<viewportHeight-4)requestAnimationFrame(()=>{if(dialog.open&&document.activeElement===ruc)ruc.scrollIntoView({block:'nearest',inline:'nearest'});});
    viewportHeight=height;
  }
  window.addEventListener('resize',fitDialog);
  vv?.addEventListener('resize',fitDialog);vv?.addEventListener('scroll',fitDialog);
  dialog.addEventListener('close',()=>{delete dialog.dataset.compact;viewportHeight=0;});
  function setLoading(active){
    navigating=active;
    form.setAttribute("aria-busy",String(active));
    loader.hidden=!active;
    submit.disabled=active;
  }
  function clearFeedback(){
    status.textContent="";
    delete status.dataset.error;
    ruc.removeAttribute("aria-invalid");
    setLoading(false);
  }
  function showError(message){
    setLoading(false);
    status.dataset.error="true";
    status.textContent=message;
    ruc.setAttribute("aria-invalid","true");
    ruc.focus({preventScroll:true});fitDialog();ruc.scrollIntoView({block:'nearest'});
  }
  ruc.addEventListener("input",()=>{
    if(!navigating){status.textContent="";delete status.dataset.error;ruc.removeAttribute("aria-invalid");}
  });
  window.addEventListener("pageshow",()=>{if(navigating)clearFeedback();});
  function closeMenu() { menu.hidden = true; toggle.setAttribute("aria-expanded","false"); }
  function positionMenu(){
    const rect=toggle.getBoundingClientRect();
    const width=228;
    menu.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width))+"px";
    menu.style.top=Math.min(window.innerHeight-110,rect.bottom+7)+"px";
  }
  toggle.addEventListener("click",()=>{
    const opening=menu.hidden;
    if(opening) positionMenu();
    menu.hidden=!opening;
    toggle.setAttribute("aria-expanded",String(opening));
  });
  document.addEventListener("pointerdown",event=>{
    if(!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target))closeMenu();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape")closeMenu();
  });
  window.addEventListener("resize",()=>{if(!menu.hidden)positionMenu();});
  window.addEventListener("scroll",()=>{if(!menu.hidden)positionMenu();},true);
  menu.querySelectorAll("a").forEach(link=>link.addEventListener("click",closeMenu));
  by("cvOpen").addEventListener("click",()=>{
    closeMenu();
    clearFeedback();
    dialog.showModal();fitDialog();
    if(!(navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches))ruc.focus({preventScroll:true});
  });
  by("cvClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  form.addEventListener("submit",event=>{
    event.preventDefault();
    if(navigating)return;
    const value=ruc.value.trim().replace(/\s+/g," ").toUpperCase();
    if(!/^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]{0,63}$/u.test(value)){showError(t("Ingresá un identificador de empresa válido (hasta 64 caracteres)."));return;}
    clearFeedback();
    status.textContent=t("Abriendo el portal de la empresa…");
    setLoading(true);
    try{window.location.assign("/empresa/?ruc="+encodeURIComponent(value)+"&lang="+locale);}
    catch{setLoading(false);status.dataset.error="true";status.textContent=locale==="en"?"Could not open the portal. Please try again.":"No se pudo abrir el portal. Volvé a intentar.";}
  });
})();