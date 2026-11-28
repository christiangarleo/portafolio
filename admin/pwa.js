/* CGA ADMIN install helper: progressive enhancement, no data access or persistence. */
(()=>{
 "use strict";
 const button=document.getElementById("adminInstall"),panel=document.getElementById("adminInstallHelp"),copy=document.getElementById("adminInstallMessage"),close=document.getElementById("adminInstallClose");
 if(!button||!panel||!copy||!close)return;
 const mode=window.matchMedia("(display-mode: standalone)");
 let deferred=null,busy=false,installed=false;
 const standalone=()=>installed||mode.matches||navigator.standalone===true;
 function hideHelp(restore=false){panel.hidden=true;button.setAttribute("aria-expanded","false");if(restore&&!button.hidden)button.focus();}
 function sync(){button.hidden=standalone();if(button.hidden)hideHelp();}
 function help(text){copy.textContent=text;panel.hidden=false;button.setAttribute("aria-expanded","true");panel.scrollIntoView({block:"nearest"});close.focus();}
 function guidance(){
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  return ios?"En iPhone o iPad, abrí CGA ADMIN en Safari, tocá Compartir y elegí Agregar a pantalla de inicio. Si la opción no aparece, seguí usando la web.":"En un navegador compatible, abrí su menú y buscá Instalar aplicación o Agregar a pantalla de inicio. La opción depende del navegador y del dispositivo. Si no aparece, podés seguir usando la web.";
 }
 window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();if(!standalone())deferred=event;sync();});
 window.addEventListener("appinstalled",()=>{installed=true;deferred=null;sync();});
 if(mode.addEventListener)mode.addEventListener("change",sync);
 else if(mode.addListener)mode.addListener(sync);
 close.addEventListener("click",()=>hideHelp(true));
 button.addEventListener("click",async()=>{
  if(busy||standalone())return;
  if(!deferred){help(guidance());return;}
  const prompt=deferred;deferred=null;busy=true;button.disabled=true;
  try{await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==="accepted"){if(!standalone())help("Instalación solicitada. El navegador confirmará si se completó.");}else hideHelp();}
  catch{help(guidance());}
  finally{busy=false;button.disabled=false;sync();}
 });
 sync();
 if(window.isSecureContext&&"serviceWorker" in navigator&&["/admin/","/admin/index.html"].includes(location.pathname)){
  navigator.serviceWorker.register("/admin/sw.js",{scope:"/admin/",updateViaCache:"none"}).catch(()=>{/* Web remains usable. No installation success is inferred. */});
 }
})();
