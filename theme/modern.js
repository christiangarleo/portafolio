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
  function decorateFields(under=document){
    if(!under?.querySelectorAll)return;
    const selector='.cgaFormControls label[for]';
    const labels=[...(under.matches?.(selector)?[under]:[]),...under.querySelectorAll(selector)];
    for(const label of labels){
      const control=label.control;
      if(!control||label.classList.contains('srOnly')||control.closest('.cgaFormField,.adminSearchWrap')||control.id==='website'||control.id==='pageNumber'||control.hidden||['hidden','radio','checkbox','range'].includes(control.type))continue;
      if(label.querySelector(':scope > svg.cgaIcon')||control.closest('.cgaFieldShell'))continue;
      const name=({email:'mail',password:'lock',tel:'chat',url:'external',search:'search',file:'upload',date:'calendar','datetime-local':'calendar',number:'clock',textarea:'edit','select-one':'filter'})[control.type]||({companyName:'briefcase',company:'briefcase',jobRole:'briefcase',position:'briefcase',contactName:'user',ruc:'file',missingCVNewId:'file'})[control.id]||'edit';
      const icon=makeIcon(name);if(!icon)continue;
      icon.classList.add('cgaFieldIcon');
      if((control.matches('textarea,input:not([type]),input:is([type=text],[type=email],[type=password],[type=tel],[type=url],[type=search])'))&&label.parentElement===control.parentElement){
        const shell=document.createElement('div');shell.className='cgaFieldShell';
        control.before(shell);shell.append(icon,control);
      }else{label.classList.add('cgaFieldLabel');label.prepend(icon);}
    }
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
    decorateFields(under);
  }
  function start(){
    decorate();
    // Los CV y las propuestas se crean dinámicamente; decorar solo los nodos añadidos.
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.target.matches?.('[data-cga-icon],label[for]'))decorate(record.target);
        for(const added of record.addedNodes){
          if(added.nodeType===1)decorate(added);
        }
      }
    });
    for(const target of ["documents","leads","adminPriorities","vacancies","publicPortfolioStatus","leadForm","missingCVEditForm"]){
      const node=document.getElementById(target);
      if(node)observer.observe(node,{childList:true,subtree:true});
    }
  }
  window.CGAIcons={makeIcon,decorate};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();