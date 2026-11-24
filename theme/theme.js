/* CGA | Switch global de apariencia claro/oscuro; sin dependencias externas. */
(() => {
  "use strict";
  const key = "cga-appearance";
  const root = document.documentElement;
  const prefersDark = matchMedia("(prefers-color-scheme: dark)");
  const modes = ["system","light","dark"];
  let fallback = "system";
  function stored(){
    try {const value=localStorage.getItem(key);return modes.includes(value)?value:"system";}
    catch{return fallback;}
  }
  function save(mode){
    fallback=mode;
    try{localStorage.setItem(key,mode);}catch{}
  }
  function resolve(mode){return mode==="system"?(prefersDark.matches?"dark":"light"):mode;}

  const control=document.createElement("div");
  control.className="cgaThemeControl";
  const toggle=document.createElement("button");
  toggle.type="button";
  toggle.id="cgaThemeToggle";
  toggle.className="cgaThemeSwitch";
  toggle.setAttribute("role","switch");
  const track=document.createElement("span");
  track.className="cgaThemeTrack";
  track.setAttribute("aria-hidden","true");
  const thumb=document.createElement("span");
  thumb.className="cgaThemeThumb";
  track.append(thumb);
  for(const [name,icon] of [["sun","☀︎"],["moon","☾"]]){
    const symbol=document.createElement("span");
    symbol.className="cgaThemeSymbol cgaThemeSymbol--"+name;
    symbol.textContent=icon;
    track.append(symbol);
  }
  toggle.append(track);
  control.append(toggle);

  function apply(){
    const mode=stored(), effective=resolve(mode), dark=effective==="dark";
    root.dataset.theme=effective;
    root.dataset.themePreference=mode;
    root.style.colorScheme=effective;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=dark?"#111317":"#ffffff";
    const en=root.lang.toLowerCase().startsWith("en");
    toggle.setAttribute("aria-checked",String(dark));
    toggle.setAttribute("aria-label",en?"Dark mode":"Modo oscuro");
    toggle.title=en?(dark?"Switch to light mode":"Switch to dark mode"):(dark?"Cambiar a modo claro":"Cambiar a modo oscuro");
  }
  toggle.addEventListener("click",()=>{save(resolve(stored())==="dark"?"light":"dark");apply();});
  function insert(){
    const actions=document.querySelector(".siteActions");
    const adminTools=document.querySelector(".adminHeaderTools");
    const header=document.querySelector("header");
    if(actions)actions.prepend(control);
    else if(adminTools)adminTools.prepend(control);
    else if(header)header.append(control);
    else document.body.prepend(control);
    apply();
  }
  window.addEventListener("storage",event=>{if(event.key===key||event.key===null)apply();});
  const systemChanged=()=>{if(stored()==="system")apply();};
  if(prefersDark.addEventListener)prefersDark.addEventListener("change",systemChanged);
  else if(prefersDark.addListener)prefersDark.addListener(systemChanged);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",insert,{once:true});
  else insert();
})();
