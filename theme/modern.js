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
  // One reusable, accessible confirmation/text dialog; no business actions here.
  let activeDialog=null;
  function askDialog(message,{mode="confirm",value="",danger=false}={}){
    if(activeDialog)return Promise.resolve(mode==="confirm"?false:null);
    return new Promise(resolve=>{
      const previous=document.activeElement;
      const dialog=document.createElement("dialog");
      dialog.className="cgaGlassForm cgaFormControls cgaAdminDialog";
      dialog.setAttribute("aria-labelledby","cgaAdminDialogTitle");
      dialog.setAttribute("aria-describedby","cgaAdminDialogMessage");
      const form=document.createElement("form");
      const heading=document.createElement("h2");
      heading.id="cgaAdminDialogTitle";
      heading.textContent=mode==="confirm"?"Confirmar acción":mode==="copy"?"Copiar información":"Editar información";
      const text=document.createElement("p");text.id="cgaAdminDialogMessage";text.textContent=message;
      form.append(heading,text);
      let field;
      if(mode!=="confirm"){
        field=document.createElement(mode==="copy"?"textarea":"input");
        field.value=String(value??"");field.setAttribute("aria-label",message);
        if(mode==="copy"){field.readOnly=true;field.rows=5;}
        else{field.type="text";field.maxLength=180;field.required=true;}
        form.append(field);
      }
      const actions=document.createElement("div");actions.className="cgaDialogActions";
      const cancel=document.createElement("button");cancel.type="button";cancel.className="cgaFormButton";cancel.textContent=mode==="copy"?"Cerrar":"Cancelar";
      cancel.autofocus=true;
      const ok=document.createElement("button");ok.type=mode==="copy"?"button":"submit";ok.className="cgaFormButton cgaDialogConfirm";
      ok.textContent=mode==="copy"?"Seleccionar texto":mode==="edit"?"Guardar":danger?"Confirmar eliminación":"Confirmar";
      if(danger)ok.classList.add("cgaDialogDanger");
      actions.append(cancel,ok);form.append(actions);dialog.append(form);document.body.append(dialog);activeDialog=dialog;
      let result=mode==="confirm"?false:null;
      const close=()=>dialog.close();
      cancel.addEventListener("click",close);
      form.addEventListener("submit",event=>{event.preventDefault();if(mode==="copy")return;if(mode==="edit"&&!form.reportValidity())return;result=mode==="confirm"?true:field.value;close();});
      if(mode==="copy")ok.addEventListener("click",()=>{field.focus();field.select();});
      dialog.addEventListener("cancel",event=>{event.preventDefault();close();});
      dialog.addEventListener("close",()=>{dialog.remove();activeDialog=null;if(previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});resolve(result);},{once:true});
      try{dialog.showModal();if(field){field.focus();field.select();}else cancel.focus();}
      catch{dialog.remove();activeDialog=null;resolve(result);}
    });
  }
  window.CGADialog={
    confirm:(message,options={})=>askDialog(message,{...options,mode:"confirm"}),
    edit:(message,value)=>askDialog(message,{mode:"edit",value}),
    copy:(message,value)=>askDialog(message,{mode:"copy",value})
  };
  window.CGAIcons={makeIcon,decorate};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();