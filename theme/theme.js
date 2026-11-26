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
  // Native SVG morph: the existing aria-checked state remains authoritative.
  const ns="http://www.w3.org/2000/svg";
  const svgNode=(name,attrs={})=>{
    const node=document.createElementNS(ns,name);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
    return node;
  };
  const icon=svgNode("svg",{class:"cgaThemeMorph",width:18,height:18,viewBox:"0 0 20 20",fill:"currentColor",stroke:"none","aria-hidden":"true",focusable:"false"});
  const defs=svgNode("defs");
  const mask=svgNode("mask",{id:"cgaThemeMoonMask",maskUnits:"userSpaceOnUse",maskContentUnits:"userSpaceOnUse",x:0,y:0,width:20,height:20});
  mask.append(svgNode("rect",{x:0,y:0,width:20,height:20,fill:"white"}),
    svgNode("circle",{class:"cgaThemeMoonCut",cx:11,cy:3,r:8,fill:"black"}));
  defs.append(mask);
  icon.append(defs,svgNode("circle",{class:"cgaThemeSunMoon",cx:10,cy:10,r:8,mask:"url(#cgaThemeMoonMask)"}));
  const rays=svgNode("g");
  for(const [index,[cx,cy]] of [[18,10],[14,16.928],[6,16.928],[2,10],[6,3.1718],[14,3.1718]].entries()){
    rays.append(svgNode("circle",{class:"cgaThemeRay cgaThemeRay"+(index+1),cx,cy,r:1.5}));
  }
  icon.append(rays);
  toggle.append(icon);
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
