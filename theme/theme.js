/* Selector global de apariencia. No requiere autenticación ni conexión externa. */
(() => {
  "use strict";
  const key = "cga-appearance";
  const root = document.documentElement;
  const modes = ["system","light","dark"];
  const labels = {system:"Automático",light:"Claro",dark:"Oscuro"};
  const icons = {system:"◐",light:"☀",dark:"☾"};
  const prefersDark = matchMedia("(prefers-color-scheme: dark)");
  const menu = document.createElement("div");
  menu.id = "cgaThemeMenu";
  menu.className = "cgaThemeMenu";
  menu.hidden = true;
  menu.setAttribute("role","group");
  menu.setAttribute("aria-label","Elegir apariencia");
  const control = document.createElement("div");
  control.className = "cgaThemeControl";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "cgaThemeButton";
  toggle.id = "cgaThemeToggle";
  toggle.title = "Apariencia de la página";
  toggle.setAttribute("aria-haspopup","true");
  toggle.setAttribute("aria-controls","cgaThemeMenu");
  toggle.setAttribute("aria-expanded","false");
  const icon = document.createElement("span");
  icon.className = "cgaThemeIcon";
  icon.setAttribute("aria-hidden","true");
  toggle.append(icon);
  control.append(toggle);
  const buttons = new Map();
  for(const mode of modes){
    const option = document.createElement("button");
    option.type = "button";
    option.setAttribute("role","checkbox");
    option.setAttribute("aria-checked","false");
    const name = document.createElement("span");
    name.textContent = icons[mode] + "  " + labels[mode];
    const check = document.createElement("span");
    check.className = "cgaSelected";
    check.setAttribute("aria-hidden","true");
    option.append(name,check);
    option.addEventListener("click", () => {
      save(mode);
      apply();
      setOpen(false);
      toggle.focus();
    });
    menu.append(option);
    buttons.set(mode,{option,check});
  }
  function stored(){
    try {const value = localStorage.getItem(key);return modes.includes(value)?value:"system";}
    catch{return "system";}
  }
  function save(mode){
    try{localStorage.setItem(key,mode);}catch{}
  }
  function resolve(mode){return mode==="system"?(prefersDark.matches?"dark":"light"):mode;}
  function apply(){
    const mode=stored(),effective=resolve(mode);
    root.dataset.theme=effective;
    root.dataset.themePreference=mode;
    root.style.colorScheme=effective;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=effective==="dark"?"#111317":"#ffffff";
    icon.textContent=icons[mode];
    toggle.setAttribute("aria-label","Apariencia: "+labels[mode]+". Cambiar tema");
    toggle.title="Apariencia: "+labels[mode];
    for(const [value,parts] of buttons){
      const active=value===mode;
      parts.option.setAttribute("aria-checked",String(active));
      parts.check.textContent=active?"✓":"";
    }
  }
  function locate(){
    const b=toggle.getBoundingClientRect();
    menu.style.left=Math.max(8,Math.min(innerWidth-178,b.right-170))+"px";
    menu.style.top=Math.min(innerHeight-menu.offsetHeight-8,b.bottom+8)+"px";
  }
  function setOpen(open){
    menu.hidden=!open;
    toggle.setAttribute("aria-expanded",String(open));
    if(open)locate();
  }
  function insert(){
    const actions=document.querySelector(".siteActions");
    const header=document.querySelector("header");
    if(actions)actions.prepend(control);
    else if(header)header.append(control);
    else document.body.prepend(control);
    document.body.append(menu);
    apply();
  }
  toggle.addEventListener("click",()=>setOpen(menu.hidden));
  document.addEventListener("pointerdown",event=>{
    if(!menu.hidden&&!menu.contains(event.target)&&!control.contains(event.target))setOpen(false);
  });
  document.addEventListener("keydown",event=>{
    if(!menu.hidden&&event.key==="Escape"){setOpen(false);toggle.focus();}
  });
  window.addEventListener("resize",()=>{if(!menu.hidden)locate();});
  window.addEventListener("scroll",()=>{if(!menu.hidden)locate();},true);
  window.addEventListener("storage",event=>{if(event.key===key)apply();});
  if(prefersDark.addEventListener)prefersDark.addEventListener("change",()=>{if(stored()==="system")apply();});
  else if(prefersDark.addListener)prefersDark.addListener(()=>{if(stored()==="system")apply();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",insert,{once:true});
  else insert();
})();