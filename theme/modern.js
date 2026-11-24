/* Interfaz CGA — iconos SVG locales y mejoras progresivas.
   No toca los datos, el PDF, los permisos ni la navegación de negocio. */
(() => {
  "use strict";
  const ns="http://www.w3.org/2000/svg";
  const root=document.documentElement;
  root.classList.add("cgaModern");
  function makeIcon(name){
    if(typeof name!=="string"||!/^[a-z-]{2,30}$/.test(name))return null;
    const svg=document.createElementNS(ns,"svg");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("aria-hidden","true");
    svg.setAttribute("focusable","false");
    svg.classList.add("cgaIcon");
    const use=document.createElementNS(ns,"use");
    use.setAttribute("href","/theme/icons.svg#"+name);
    svg.append(use);
    return svg;
  }
  function decorate(under=document){
    if(!under?.querySelectorAll)return;
    const targets=[];
    if(under.matches?.("[data-cga-icon]"))targets.push(under);
    targets.push(...under.querySelectorAll("[data-cga-icon]"));
    for(const target of targets){
      if(target.querySelector(":scope > svg.cgaIcon"))continue;
      const icon=makeIcon(target.dataset.cgaIcon);
      if(!icon)continue;
      target.prepend(icon);
      target.classList.add("cgaWithIcon");
    }
  }
  function start(){
    decorate();
    // Los CV y las propuestas se crean dinámicamente; decorar solo los nodos añadidos.
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const added of record.addedNodes){
          if(added.nodeType===1)decorate(added);
        }
      }
    });
    for(const target of ["documents","leads","adminPriorities","vacancies","publicPortfolioStatus"]){
      const node=document.getElementById(target);
      if(node)observer.observe(node,{childList:true,subtree:true});
    }
  }
  window.CGAIcons={makeIcon,decorate};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();