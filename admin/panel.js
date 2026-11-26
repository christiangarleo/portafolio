import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";
import { createLeadCRM } from "./solicitudes.js?v=20-crm-mail-ux";
const sb = createClient("https://gprhevdotoykofrxbufv.supabase.co", "sb_publishable_vTBBhrnC-kevNf9AJeZiyw_zGG4AB_I", { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const el=id=>document.getElementById(id);
const status=el("status");
let noticeTimer;
function notice(msg,error=false,options={}){
  clearTimeout(noticeTimer);
  status.replaceChildren();
  const success=options.success===true&&!error;
  status.dataset.success=String(success);
  if(success){
    const check=document.createElementNS("http://www.w3.org/2000/svg","svg");
    check.setAttribute("viewBox","0 0 36 36");check.setAttribute("aria-hidden","true");check.classList.add("crmToastCheck");
    const ring=document.createElementNS(check.namespaceURI,"circle");ring.setAttribute("cx","18");ring.setAttribute("cy","18");ring.setAttribute("r","15");
    const mark=document.createElementNS(check.namespaceURI,"path");mark.setAttribute("d","M10 18 l5 5 l11 -11");check.append(ring,mark);
    const copy=document.createElement("div");copy.className="crmToastCopy";
    const title=document.createElement("strong");title.textContent=msg;copy.append(title);
    if(options.detail){const detail=document.createElement("small");detail.textContent=options.detail;copy.append(detail);}
    status.append(check,copy);
  }else status.append(document.createTextNode(msg));
  const close=document.createElement("button");
  close.type="button";close.textContent="×";close.setAttribute("aria-label","Cerrar mensaje");
  close.style.cssText="float:right;margin:-6px -7px -6px 10px;padding:3px 8px;font-size:21px;background:transparent;border:0;color:inherit;cursor:pointer;";
  close.addEventListener("click",()=>{clearTimeout(noticeTimer);status.hidden=true;});
  status.append(close);status.dataset.error=String(error);status.hidden=false;
  if(success)noticeTimer=setTimeout(()=>{status.hidden=true;},4000);
}
const bucket="cv-personalizados";
const publicPortfolioBucket="portafolio";
const publicPortfolioFiles={
  en:"Christian_Arleo_Portfolio_EN.pdf",
  es:"Christian_Arleo_Portafolio.pdf",
  es_a3:"Christian_Arleo_Portafolio_ES_A3.pdf",
  en_a3:"Christian_Arleo_Portfolio_EN_A3.pdf"
};
const portfolioSuffix={es:"Es",en:"En",es_a3:"EsA3",en_a3:"EnA3"};
let publishedPortfolios=new Set();

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
if (hashParams.get("error_code")) {
  const code=hashParams.get("error_code");
  notice(code === "otp_expired"
    ? "El enlace de confirmación venció o ya fue utilizado. Si tu cuenta ya está confirmada, ingresá con tu correo y contraseña; si no, solicitá un correo nuevo."
    : "No se completó la confirmación. Intentá ingresar o reenviar el correo.", true);
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
}
let currentUser=null, isAdmin=false, documents=[];
function show(screen){
  el("loginPanel").hidden=screen!=="login";
  el("pendingPanel").hidden=screen!=="pending";
  el("app").hidden=screen!=="app";
  el("adminLogoutHeader").hidden=screen!=="app";
}
async function verifyAdmin(){
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user){ currentUser=null;isAdmin=false;show("login");return; }
  currentUser=user;
  const found=await sb.from("portfolio_cv_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if (found.error) {
    isAdmin=false;
    show("pending");
    const dataApiDown=found.error.code==="PGRST002" || found.status===503 || found.error.code==="3F000";
    el("pendingTitle").textContent=dataApiDown?"Servicio de datos no disponible":"No se pudo comprobar tu permiso";
    el("pendingMessage").textContent=dataApiDown
      ? "Tu cuenta está autenticada, pero Supabase no puede consultar la base de datos. Esto no significa que tu usuario carezca de autorización."
      : "Supabase devolvió un error al consultar los permisos. Podés reintentar o revisar el servicio.";
    el("serviceHint").hidden=!dataApiDown;
    notice("Error de consulta: "+(found.error.message||found.error.code||"desconocido"),true);
    return;
  }
  isAdmin=Boolean(found.data);
  if(!isAdmin){
    // A Supabase Auth session is NOT enough. Revoke this browser session
    // immediately unless the approved owner membership is visible by RLS.
    await sb.auth.signOut();
    currentUser=null;
    show("login");
    notice("Acceso exclusivo de la cuenta autorizada.",true);
    return;
  }
  el("serviceHint").hidden=true;
  show("app");
  navigateAdmin(readAdminView());
  await loadPublicPortfolios();
  await loadDocuments();
  await loadLeads();
  refreshOverview();
}
el("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;
  const email=el("email").value.trim(),password=el("password").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  el("password").value="";
  if(error)notice("No se pudo iniciar sesión. Revisá los datos o el estado de la cuenta.",true);
  else await verifyAdmin();
  btn.disabled=false;
});
el("recheck").addEventListener("click",verifyAdmin);
document.querySelectorAll(".logout").forEach(x=>x.addEventListener("click",async()=>{
  await sb.auth.signOut();
  currentUser=null;isAdmin=false;
  try{sessionStorage.removeItem("cga-admin-view")}catch{}
  show("login");
  notice("Sesión cerrada correctamente.");
}));

const adminViews=["overview","leads","cv","portfolio"];
function readAdminView(){
  try{const v=sessionStorage.getItem("cga-admin-view");return adminViews.includes(v)?v:"overview"}
  catch{return "overview"}
}
function navigateAdmin(view){
  if(!adminViews.includes(view))view="overview";
  for(const name of adminViews){
    const selected=name===view;
    const pane=el({overview:"adminPaneOverview",leads:"adminPaneLeads",cv:"adminPaneCV",portfolio:"adminPanePortfolio"}[name]);
    const tab=document.querySelector('button[data-admin-view="'+name+'"]');
    pane.hidden=!selected;
    tab.setAttribute("aria-selected",String(selected));
    tab.tabIndex=selected?0:-1;
  }
  try{sessionStorage.setItem("cga-admin-view",view)}catch{}
}
el("app").addEventListener("click",event=>{
  const button=event.target.closest("button[data-admin-view],button[data-go-view]");
  if(!button)return;
  if(button.dataset.adminView)navigateAdmin(button.dataset.adminView);
  if(button.dataset.goView){
    navigateAdmin(button.dataset.goView);
    if(button.id==="quickUploadCV"||button.dataset.goUpload==="true")setCVFormOpen(true);
    else document.querySelector('button[data-admin-view="'+button.dataset.goView+'"]')?.focus();
  }
});
el("app").querySelector(".adminNavigation").addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  const current=adminViews.indexOf(event.target.dataset.adminView);
  if(current<0)return;
  event.preventDefault();
  const next=event.key==="Home"?0:event.key==="End"?adminViews.length-1:
    (current+(event.key==="ArrowRight"?1:-1)+adminViews.length)%adminViews.length;
  navigateAdmin(adminViews[next]);
  document.querySelector('button[data-admin-view="'+adminViews[next]+'"]').focus();
});
let documentsLoaded=false,portfoliosLoaded=false;
function refreshOverview(){
  const totals=leadCRM.getSummary();
  el("statPending").textContent=totals.loaded?String(totals.pending):"—";
  el("statActive").textContent=totals.loaded?String(totals.active):"—";
  el("statCV").textContent=documentsLoaded?String(documents.length):"—";
  el("statPortfolios").textContent=portfoliosLoaded?String(Object.values(publicPortfolioFiles).filter(name=>publishedPortfolios.has(name)).length):"—";
  const target=el("adminPriorities");
  target.replaceChildren();
  function suggestion(message,label,view){
    const item=node("div",undefined,"adminPriorityItem");
    const text=node("p",message);
    const button=node("button",label);
    button.type="button";button.dataset.goView=view;button.dataset.cgaIcon="arrow";
    if(label==="Nuevo CV")button.dataset.goUpload="true";
    item.append(text,button);target.append(item);
  }
  if(totals.loaded&&totals.pending>0)suggestion(
    (totals.pending===1?"1 solicitud por decidir.":totals.pending+" solicitudes por decidir."),
    "Revisar","leads"
  );
  if(totals.loaded&&totals.active>0)suggestion(
    (totals.active===1?"1 solicitud en seguimiento.":totals.active+" solicitudes en seguimiento."),
    "Ver","leads"
  );
  if(documentsLoaded&&documents.length===0)suggestion(
    "No hay CV cargados.",
    "Nuevo CV","cv"
  );
  if(portfoliosLoaded&&!publishedPortfolios.has("Christian_Arleo_Portfolio_EN.pdf"))suggestion(
    "Falta el PDF en inglés.",
    "Publicar","portfolio"
  );
  if(!target.children.length){
    const p=node("p",totals.loaded?"No hay tareas urgentes pendientes en el panel.":"Consultando datos de la oficina…");
    target.append(p);
  }
}
function applyDocumentFilter(){
  const query=el("documentsFilter").value.toLocaleLowerCase().trim();
  const cards=[...el("documents").querySelectorAll("article.item")];
  let visible=0;
  for(const card of cards){
    const fits=!query||card.textContent.toLocaleLowerCase().includes(query);
    card.hidden=!fits;
    if(fits)visible++;
  }
  const label=el("documentsCount");
  if(!documentsLoaded)label.textContent="Consultando documentos…";
  else label.textContent=visible===documents.length
    ?documents.length+" CV registrados"
    :"Mostrando "+visible+" de "+documents.length+" CV";
}
el("documentsFilter").addEventListener("input",applyDocumentFilter);

/* Formularios por demanda: nunca se abre una carga sin decisión del titular. */
function setCVFormOpen(open){
  const panel=el("cvUploadForm");
  panel.hidden=!open;
  el("newCVToggle").setAttribute("aria-expanded",String(open));
  if(open){
    el("company").focus();
    panel.scrollIntoView({block:"nearest",behavior:"smooth"});
  }else{
    el("uploadForm").reset();
    el("newCVToggle").focus();
  }
}
el("newCVToggle").addEventListener("click",()=>setCVFormOpen(el("cvUploadForm").hidden));
el("cancelCVUpload").addEventListener("click",()=>setCVFormOpen(false));
function togglePortfolioForm(lang,open){
  const form=el("publicPortfolioForm"+portfolioSuffix[lang]);
  const toggle=el("editPublicPortfolio"+portfolioSuffix[lang]);
  form.hidden=!open;
  toggle.setAttribute("aria-expanded",String(open));
  if(open){
    el("publicPortfolioFile"+portfolioSuffix[lang]).focus();
  }else{
    form.reset();
    toggle.focus();
  }
}
for(const lang of Object.keys(portfolioSuffix)){
  el("editPublicPortfolio"+portfolioSuffix[lang])
    .addEventListener("click",()=>{
      const form=el("publicPortfolioForm"+portfolioSuffix[lang]);
      togglePortfolioForm(lang,form.hidden);
    });
}
el("publicPortfolios").addEventListener("click",event=>{
  const cancel=event.target.closest("button[data-cancel-portfolio]");
  if(cancel)togglePortfolioForm(cancel.dataset.cancelPortfolio,false);
});

const publicPortfolioDisplay={
  es:{label:"español · A4 web",state:"publicPortfolioStateEs",link:"publicPortfolioLinkEs",button:"publicPortfolioButtonEs",file:"publicPortfolioFileEs"},
  en:{label:"inglés · A4 web",state:"publicPortfolioStateEn",link:"publicPortfolioLinkEn",button:"publicPortfolioButtonEn",file:"publicPortfolioFileEn"},
  es_a3:{label:"español · A3 descarga",state:"publicPortfolioStateEsA3",link:"publicPortfolioLinkEsA3",button:"publicPortfolioButtonEsA3",file:"publicPortfolioFileEsA3"},
  en_a3:{label:"inglés · A3 descarga",state:"publicPortfolioStateEnA3",link:"publicPortfolioLinkEnA3",button:"publicPortfolioButtonEnA3",file:"publicPortfolioFileEnA3"}
};
function setPublicPortfolioState(lang,exists){
  const display=publicPortfolioDisplay[lang];
  if(!display)return;
  const badge=el(display.state);
  badge.textContent=exists?"PDF publicado":"Pendiente de publicar";
  const link=el(display.link);
  link.hidden=!exists;
  if(exists){
    const url=sb.storage.from(publicPortfolioBucket).getPublicUrl(publicPortfolioFiles[lang]).data.publicUrl;
    link.href=url+"?v="+Date.now();
  }else{
    link.removeAttribute("href");
  }
  const toggle=el("editPublicPortfolio"+portfolioSuffix[lang]);
  const text=exists?"Reemplazar PDF":"Publicar PDF";
  toggle.replaceChildren(document.createTextNode(text));
  window.CGAIcons?.decorate(toggle);
}
async function loadPublicPortfolios(){
  if(!isAdmin)return;
  const message=el("publicPortfolioStatus");
  message.textContent="Consultando archivos publicados…";
  const {data,error}=await sb.storage.from(publicPortfolioBucket).list("",{limit:100});
  if(error){
    message.textContent="No se pudo comprobar qué archivos hay publicados: "+error.message;
    for(const lang of Object.keys(publicPortfolioDisplay))el(publicPortfolioDisplay[lang].state).textContent="Estado no disponible";
    return;
  }
  publishedPortfolios=new Set((data||[]).map(x=>x.name));
  portfoliosLoaded=true;
  refreshOverview();
  for(const [lang,filename] of Object.entries(publicPortfolioFiles)){
    setPublicPortfolioState(lang,publishedPortfolios.has(filename));
  }
  message.textContent="";
}
el("refreshPublicPortfolios").addEventListener("click",loadPublicPortfolios);
for(const lang of Object.keys(publicPortfolioDisplay)){
  const display=publicPortfolioDisplay[lang];
  const form=el("publicPortfolioForm"+portfolioSuffix[lang]);
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!isAdmin){notice("No autorizado.",true);return;}
    const file=el(display.file).files[0];
    const path=publicPortfolioFiles[lang];
    if(!file||!path||file.size>45*1024*1024||file.size<1024||!file.name.toLowerCase().endsWith(".pdf")){
      notice("Elegí un PDF válido de hasta 45 MB para el portafolio en "+display.label+".",true);return;
    }
    const header=new TextDecoder("latin1").decode(await file.slice(0,8).arrayBuffer());
    if(!header.startsWith("%PDF-")){notice("El archivo seleccionado no es un PDF válido.",true);return;}
    const exists=publishedPortfolios.has(path);
    if(exists&&!await window.CGADialog.confirm("¿Reemplazar el PDF en "+display.label+"? Solo cambiará esta edición. Guardá una copia del anterior.")){
      return;
    }
    const button=el(display.button);
    button.disabled=true;
    const previousText=button.textContent;
    button.textContent="Subiendo PDF…";
    notice((exists?"Reemplazando":"Publicando")+" únicamente el PDF en "+display.label+"…");
    try{
      const {error}=await sb.storage.from(publicPortfolioBucket).upload(path,file,{
        upsert:true,contentType:"application/pdf",cacheControl:"0"
      });
      if(error)throw error;
      publishedPortfolios.add(path);
      setPublicPortfolioState(lang,true);
      togglePortfolioForm(lang,false);
      notice("PDF en "+display.label+" actualizado. Las demás ediciones no cambiaron.");
      await loadPublicPortfolios();
    }catch(error){
      notice("No se pudo actualizar el PDF en "+display.label+": "+(error.message||"Error desconocido"),true);
    }finally{
      button.disabled=false;
      button.textContent=previousText;
      window.CGAIcons?.decorate(button);
      if(publishedPortfolios.has(path))setPublicPortfolioState(lang,true);
    }
  });
}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
async function loadDocuments(){
 const {data,error}=await sb.from("portfolio_cv_documents").select("*").order("created_at",{ascending:false}).limit(200);
 const target=el("documents");target.replaceChildren();
 if(error){target.textContent=error.message;return;}
 documents=data||[];
 documentsLoaded=true;
 refreshOverview();
 if(!documents.length){
   target.textContent="";
   const empty=node("div",undefined,"adminEmptyState");
   const title=node("h3","Tu biblioteca está vacía");
   const subtitle=node("p","Agregá el primer CV personalizado.");
   const button=node("button","Nuevo CV");
   button.type="button";button.dataset.cgaIcon="plus";
   button.addEventListener("click",()=>setCVFormOpen(true));
   empty.append(title,subtitle,button);target.append(empty);
   window.CGAIcons?.decorate(empty);
   applyDocumentFilter();return;
 }
 for(const x of documents){
   const box=node("article",undefined,"item");const title=node("strong",x.company_name+" · "+x.ruc+" · "+x.role_name);
   const tags=node("div");
   for(const label of [x.is_active?"Activo":"Desactivado",x.is_main?"Principal":"Alternativo",x.expires_at? (new Date(x.expires_at)>new Date()?"Vence "+new Date(x.expires_at).toLocaleString("es-PE"):"Vencido"):"Sin vencimiento"]){
     tags.append(node("span",label,"pill"));
   }
   box.append(title,tags,node("small",x.original_filename+" · Subido "+new Date(x.created_at).toLocaleString("es-PE")));
   const stateRow=node("div",undefined,"itemStatus");
   const stateLabel=node("label","Estado interno: ");
   stateLabel.htmlFor="state-"+x.id;
   const stateSelect=node("select");
   stateSelect.id="state-"+x.id;
   stateSelect.dataset.statusId=x.id;
   const statuses=[["preparado","Preparado"],["postulado","Postulado"],["en_proceso","En proceso"],["finalizado","Finalizado"]];
   for(const [value,label] of statuses) {
     const option=node("option",label);option.value=value;
     stateSelect.append(option);
   }
   stateSelect.value=x.application_status||"preparado";
   stateRow.append(stateLabel,stateSelect);
   box.append(stateRow);
   const actions=node("div",undefined,"itemActions");
   const portal=node("a","Abrir portal de la empresa ↗");
   portal.href="/empresa/?ruc="+encodeURIComponent(x.ruc);
   portal.target="_blank";
   portal.rel="noopener noreferrer";
   portal.dataset.cgaIcon="external";
   actions.append(portal);
   const availableActions=[["download","Ver PDF"],["edit","Editar"],["toggle",x.is_active?"Desactivar":"Activar"],["delete","Eliminar"]];
   if(!x.is_main) availableActions.splice(2,0,["main","Marcar principal"]);
   for(const [action,label] of availableActions){
     const b=node("button",label);b.type="button";b.dataset.id=x.id;b.dataset.action=action;
     b.dataset.cgaIcon={download:"eye",edit:"edit",main:"check",toggle:x.is_active?"close":"check",delete:"trash"}[action];
     if(action==="delete")b.title="Eliminar definitivamente este CV";
     actions.append(b);
   }
   box.append(actions);target.append(box);
 }
 applyDocumentFilter();
}
el("reloadDocuments").addEventListener("click",loadDocuments);
el("documents").addEventListener("change", async e => {
  const control=e.target.closest("select[data-status-id]");
  if(!control || !isAdmin) return;
  const id=control.dataset.statusId;
  const selected=control.value;
  if(!["preparado","postulado","en_proceso","finalizado"].includes(selected))return;
  control.disabled=true;control.setAttribute("aria-busy","true");
  const {error}=await sb.from("portfolio_cv_documents").update({application_status:selected}).eq("id",id);
  if(error) {
    notice("No se pudo actualizar el estado: "+error.message,true);
    await loadDocuments();
  } else {
    notice("Estado de postulación actualizado (visible solo en administración).");
    await loadDocuments();
  }
});
el("uploadForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!isAdmin){notice("Sin autorización",true);return;}
  const file=el("pdf").files[0],ruc=el("ruc").value.trim().replace(/\s+/g," ").toUpperCase();
  if(!file||!/^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]{0,63}$/u.test(ruc)||!file.name.toLowerCase().endsWith(".pdf")||file.size>30*1024*1024){notice("Revisá el identificador de empresa y el PDF (máximo 30 MB).",true);return;}
  const main=el("principal").checked;const expiry=el("expires").value;
  const path="companies/"+crypto.randomUUID()+".pdf";const btn=el("uploadButton");btn.disabled=true;
  notice("Subiendo archivo privado…");
  try {
    const upload=await sb.storage.from(bucket).upload(path,file,{cacheControl:"0",upsert:false,contentType:"application/pdf"});
    if(upload.error)throw upload.error;
    if(main){
      const {error:offError}=await sb.from("portfolio_cv_documents").update({is_main:false}).eq("ruc",ruc).eq("is_main",true);
      if(offError)throw offError;
    }
    const added=await sb.from("portfolio_cv_documents").insert({
       company_name:el("company").value.trim(),ruc,role_name:el("position").value.trim(),
       original_filename:file.name,storage_path:path,is_active:true,is_main:main,
       application_status:el("applicationStatus").value,
       expires_at:expiry?new Date(expiry).toISOString():null
    });
    if(added.error){await sb.storage.from(bucket).remove([path]);throw added.error;}
    e.target.reset();el("principal").checked=true;el("applicationStatus").value="preparado";
    notice("CV guardado y disponible para esta empresa.");
    setCVFormOpen(false);
    await loadDocuments();
  } catch(err){notice("No se pudo subir: "+err.message,true);}
  finally{btn.disabled=false;}
});
el("documents").addEventListener("click",async e=>{
  const btn=e.target.closest("button[data-id]");if(!btn)return;
  const x=documents.find(v=>v.id===btn.dataset.id);if(!x)return;
  const action=btn.dataset.action;btn.disabled=true;
  try{
    if(action==="download"){
      const {data,error}=await sb.storage.from(bucket).createSignedUrl(x.storage_path,60,{download:x.original_filename});
      if(error)throw error;window.open(data.signedUrl,"_blank","noopener");
    }else if(action==="edit"){
      const newName=await window.CGADialog.edit("Nombre de la vacante o puesto",x.role_name);
      if(newName===null)return;
      const value=newName.trim();
      if(!value || value.length>180){notice("Ingresá una vacante de 1 a 180 caracteres.",true);return;}
      const {error}=await sb.from("portfolio_cv_documents").update({role_name:value}).eq("id",x.id);
      if(error)throw error;
      notice("Vacante actualizada.");await loadDocuments();
    }else if(action==="main"){
      const a=await sb.from("portfolio_cv_documents").update({is_main:false}).eq("ruc",x.ruc).eq("is_main",true);
      if(a.error)throw a.error;
      const b=await sb.from("portfolio_cv_documents").update({is_main:true}).eq("id",x.id);
      if(b.error)throw b.error;
      notice("CV principal actualizado.");await loadDocuments();
    }else if(action==="toggle"){
      const a=await sb.from("portfolio_cv_documents").update({is_active:!x.is_active}).eq("id",x.id);
      if(a.error)throw a.error;notice(x.is_active?"CV desactivado.":"CV activado.");await loadDocuments();
    }else if(action==="delete"){
      if(!await window.CGADialog.confirm("¿Eliminar definitivamente este CV y su archivo?",{danger:true}))return;
      const a=await sb.storage.from(bucket).remove([x.storage_path]);if(a.error)throw a.error;
      const b=await sb.from("portfolio_cv_documents").delete().eq("id",x.id);if(b.error)throw b.error;
      notice("CV eliminado.");await loadDocuments();
    }
  }catch(err){notice(err.message,true);}finally{btn.disabled=false;}
});
const leadCRM=createLeadCRM({sb,el,node,notice,getDocuments:()=>documents,loadDocuments,bucket});
async function loadLeads(){await leadCRM.load();refreshOverview();}
el("reloadLeads").addEventListener("click",loadLeads);
verifyAdmin().catch(e=>notice(e.message,true));