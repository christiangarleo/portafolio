(() => {
  "use strict";
  const by = id => document.getElementById(id);
  const toggle = by("downloadToggle"), menu = by("downloadMenu");
  const dialog = by("cvDialog"), form = by("cvLookupForm"), ruc = by("cvRuc");
  const status = by("cvResult");
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
    status.textContent="";
    dialog.showModal();ruc.focus();
  });
  by("cvClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const value=ruc.value.replace(/\D/g,"");
    if(!/^\d{11}$/.test(value)){status.textContent="Ingresá un RUC de 11 dígitos.";return;}
    status.textContent="Abriendo el portal de la empresa…";
    window.location.assign("/empresa/?ruc="+encodeURIComponent(value));
  });
})();