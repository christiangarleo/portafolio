import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";
import { createLeadCRM, CRM_SENDERS, crmSenderChoice } from "./solicitudes.js?v=23-admin-shell1";
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
  if(screen!=="app")resetMailbox();
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
  if(mailboxBusy){notice("Esperá a que termine la operación de correo.",true);return;}
  if(mailboxDraftDirty&&!await window.CGADialog.confirm("Hay un borrador de correo sin guardar. ¿Cerrar sesión y descartarlo?"))return;
  if(mailboxBusy)return;
  await sb.auth.signOut();
  currentUser=null;isAdmin=false;
  try{sessionStorage.removeItem("cga-admin-view")}catch{}
  show("login");
  notice("Sesión cerrada correctamente.");
}));

let mailboxMode="received",mailboxAccount="",mailboxPage=0,mailboxGeneration=0,mailboxEpoch=0;
let mailboxSearch="",mailboxRows=[],mailboxSelected=null,mailboxOpened=false,mailboxBusy=false,mailboxDraftDirty=false;
const mailPageSize=30,mailWide=matchMedia("(min-width:1180px)");
const adminViews=["overview","leads","mail","cv","portfolio"];
const adminNavigation=el("app").querySelector(".adminNavigation");
const adminWide=matchMedia("(min-width: 760px)");
function syncAdminNavOrientation(){adminNavigation.setAttribute("aria-orientation",adminWide.matches?"vertical":"horizontal");}
syncAdminNavOrientation();
adminWide.addEventListener("change",syncAdminNavOrientation);
function readAdminView(){
  try{const v=sessionStorage.getItem("cga-admin-view");return adminViews.includes(v)?v:"overview"}
  catch{return "overview"}
}
function navigateAdmin(view){
  if(!adminViews.includes(view))view="overview";
  for(const name of adminViews){
    const selected=name===view;
    const pane=el({overview:"adminPaneOverview",leads:"adminPaneLeads",mail:"adminPaneMail",cv:"adminPaneCV",portfolio:"adminPanePortfolio"}[name]);
    const tab=document.querySelector('button[data-admin-view="'+name+'"]');
    pane.hidden=!selected;
    tab.setAttribute("aria-selected",String(selected));
    tab.tabIndex=selected?0:-1;
  }
  try{sessionStorage.setItem("cga-admin-view",view)}catch{}
  // List refresh is independent from the session-only composer.
  if(view==="mail")void loadMailbox();
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
adminNavigation.addEventListener("keydown",event=>{
  const previous=adminWide.matches?"ArrowUp":"ArrowLeft",nextKey=adminWide.matches?"ArrowDown":"ArrowRight";
  if(![previous,nextKey,"Home","End"].includes(event.key))return;
  const current=adminViews.indexOf(event.target.dataset.adminView);
  if(current<0)return;
  event.preventDefault();
  const next=event.key==="Home"?0:event.key==="End"?adminViews.length-1:
    (current+(event.key===nextKey?1:-1)+adminViews.length)%adminViews.length;
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
// Private general mailbox: text-only reading, server-side filters, one session-only draft.
const mailStatusLabels={accepted:"Aceptado por Resend",pending:"Pendiente",uncertain:"Sin confirmar",failed:"Rechazado",reserved:"Reservado"};
function mailButton(label,icon,cls="cgaSoftButton"){
 const b=node("button",undefined,cls+" cgaWithIcon");b.type="button";
 const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");svg.classList.add("cgaIcon");
 const use=document.createElementNS(svg.namespaceURI,"use");use.setAttribute("href","/theme/icons.svg#"+icon);svg.append(use);b.append(svg,document.createTextNode(label));return b;
}
function warnMailUnload(e){if(mailboxDraftDirty||mailboxBusy){e.preventDefault();e.returnValue="";}}
function setMailDraftActive(active){
 mailboxDraftDirty=active;
 window.removeEventListener("beforeunload",warnMailUnload);
 if(active)window.addEventListener("beforeunload",warnMailUnload);
}
function resetMailbox(){
 ++mailboxGeneration;++mailboxEpoch;
 mailboxMode="received";mailboxAccount="";mailboxPage=0;mailboxSearch="";mailboxRows=[];mailboxSelected=null;mailboxOpened=false;mailboxBusy=false;
 setMailDraftActive(false);
 el("mailComposerHost").replaceChildren();el("mailComposerHost").hidden=true;
 el("mailDraftBar").hidden=true;el("mailWorkspace").hidden=false;el("mailWorkspace").dataset.detail="false";
 el("mailList").replaceChildren();el("mailReader").replaceChildren();el("mailListStatus").textContent="";
 el("mailSearch").value="";el("mailAccount").value="";el("mailClearSearch").hidden=true;el("mailPagination").hidden=true;
 for(const b of el("crmMailbox").querySelectorAll("[data-mail-mode]"))b.setAttribute("aria-pressed",String(b.dataset.mailMode==="received"));
}
function mailResetSelection(){mailboxSelected=null;mailboxOpened=false;renderMailReader();}
function mailApplyFilters(){mailboxPage=0;mailResetSelection();void loadMailbox();}
function mailSearchFilter(term,sent){
 // Quote the value for PostgREST's OR grammar and escape SQL LIKE metacharacters.
 // Asterisks are treated as the PostgREST alias for a wildcard; normalize to space
 // in the search box instead of permitting implicit wildcards.
 const literal=term.replace(/[\\%_]/g,"\\$&");
 const quoted='"'+("%"+literal+"%").replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
 return ["sender","subject","body",...(sent?["recipient"]:[])].map(field=>field+".ilike."+quoted).join(",");
}
function normalizeMailSearch(value){return String(value).replace(/[\u0000-\u001f\u007f*]/g," ").trim().slice(0,100);}
function mailDate(value,full=false){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return "Fecha no disponible";
 return full?date.toLocaleString("es-PE"):date.toDateString()===new Date().toDateString()?date.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}):date.toLocaleDateString("es-PE",{day:"numeric",month:"short",...(date.getFullYear()!==new Date().getFullYear()?{year:"numeric"}:{})});
}
function mailAccountsLabel(m,sent){
 const addresses=sent?[m.sender]:(m.recipients||[]);
 const roots=CRM_SENDERS.filter(a=>addresses.includes(a));
 return roots.length?roots.map(a=>a.split("@")[0]+"@").join(" · "):"Otra ruta";
}
function renderMailList(){
 const list=el("mailList"),sent=mailboxMode==="sent";list.replaceChildren();
 if(!mailboxRows.length){list.append(node("p",mailboxSearch?"No encontramos mensajes con esta búsqueda.":"No hay mensajes en esta bandeja.","mailEmpty"));return;}
 for(const m of mailboxRows){
  const row=node("button",undefined,"mailRow");row.type="button";row.dataset.mailId=m.id;
  row.dataset.unread=String(!sent&&!m.read_at);row.setAttribute("aria-pressed",String(mailboxSelected?.id===m.id));
  const top=node("span",undefined,"mailRowTop"),who=node("span",sent?"Para: "+m.recipient:m.sender,"mailRowWho"),date=node("time",mailDate(sent?m.created_at:m.received_at),"mailRowDate");
  date.dateTime=sent?m.created_at:m.received_at;top.append(who,date);
  const subject=node("strong",m.subject||"Sin asunto","mailRowSubject");
  const preview=node("span",String(m.body||"").replace(/\s+/g," ").trim().slice(0,180)||"Sin contenido de texto","mailRowPreview");
  const meta=node("span",undefined,"mailRowMeta");meta.append(node("span",mailAccountsLabel(m,sent),"mailAccountTag"));
  if(!sent&&!m.read_at)meta.append(node("span","No leído","mailUnreadLabel"));
  if(sent)meta.append(node("span",mailStatusLabels[m.status]||"Estado desconocido","mailRowState"));
  if(!sent&&m.attachment_count)meta.append(node("span",m.attachment_count+" adj.","mailRowState"));
  row.append(top,subject,preview,meta);
  row.onclick=()=>{mailboxSelected=m;mailboxOpened=true;renderMailList();renderMailReader();el("mailReaderTitle")?.focus({preventScroll:true});if(!mailWide.matches)el("mailReader").scrollIntoView({block:"start"});};
  list.append(row);
 }
}
function renderMailReader(){
 const reader=el("mailReader");reader.replaceChildren();el("mailWorkspace").dataset.detail=String(mailboxOpened&&Boolean(mailboxSelected));
 const m=mailboxSelected,sent=mailboxMode==="sent";
 if(!m){reader.append(node("p","Seleccioná un mensaje para leerlo.","mailReaderEmpty"));return;}
 const toolbar=node("div",undefined,"mailReaderToolbar");
 const back=mailButton("Bandeja","return","cgaSoftButton mailReaderBack");
 back.onclick=()=>{mailboxOpened=false;el("mailWorkspace").dataset.detail="false";const row=[...el("mailList").children].find(x=>x.dataset.mailId===m.id);(row||el("mailSearch")).focus({preventScroll:true});};
 toolbar.append(back);
 if(!sent){
  const reply=mailButton("Responder","return","cgaSoftButton mailReplyAction");reply.onclick=()=>openMailboxComposer(m);
  const read=mailButton(m.read_at?"Marcar no leído":"Marcar leído",m.read_at?"mail":"check");read.onclick=()=>void toggleMailRead(m,read);
  toolbar.append(reply,read);
 }
 const title=node("h2",m.subject||"Sin asunto","mailReaderTitle");title.id="mailReaderTitle";title.tabIndex=-1;
 const meta=node("dl",undefined,"mailReaderMeta");
 for(const [key,value] of [["De",m.sender],["Para",sent?m.recipient:(m.recipients||[]).join(", ")],["Fecha",mailDate(sent?m.created_at:m.received_at,true)],["Estado",sent?(mailStatusLabels[m.status]||"Estado desconocido"):(m.read_at?"Leído":"No leído")]]){
  const line=node("div");line.append(node("dt",key),node("dd",value||"—"));meta.append(line);
 }
 reader.append(toolbar,title,meta);
 if(!sent)reader.append(node("p",m.lead_id?"Solicitud asociada por ruta o correo coincidente. Identidad no verificada.":"Sin solicitud asociada. Identidad no verificada.","mailReaderNote"));
 if(!sent&&(m.body_limited||m.attachment_count))reader.append(node("p","Contenido parcial o adjuntos ("+(m.attachment_count||0)+"). Consultá el original en Resend.","mailReaderNote"));
 reader.append(node("div",m.body||"Sin contenido de texto.","crmMailBody mailReaderBody"));
}
async function toggleMailRead(m,button){
 if(!isAdmin||button.disabled)return;
 const epoch=mailboxEpoch;button.disabled=true;
 try{
  const next=m.read_at?null:new Date().toISOString();
  let query=sb.from("portfolio_crm_inbound").update({read_at:next}).eq("id",m.id);
  query=m.read_at?query.eq("read_at",m.read_at):query.is("read_at",null);
  const r=await query.select("id,read_at").maybeSingle();
  if(epoch!==mailboxEpoch||!isAdmin)return;
  if(r.error)throw r.error;
  if(!r.data){notice("El estado cambió. Actualizá el correo.",true);await loadMailbox();return;}
  if(mailboxSelected?.id===m.id)mailboxSelected={...mailboxSelected,read_at:r.data.read_at};
  await loadMailbox({keepReader:true});
 }catch{if(epoch===mailboxEpoch&&isAdmin)notice("No se pudo actualizar el estado de lectura.",true);}
 finally{button.disabled=false;}
}
async function loadMailbox({keepReader=false}={}){
 if(!isAdmin)return;
 const generation=++mailboxGeneration,sent=mailboxMode==="sent",from=mailboxPage*mailPageSize;
 const list=el("mailList"),status=el("mailListStatus");
 status.textContent="Consultando…";list.setAttribute("aria-busy","true");
 el("mailPagination").hidden=true;mailboxRows=[];list.replaceChildren();
 for(const b of el("crmMailbox").querySelectorAll("[data-mail-mode]"))b.setAttribute("aria-pressed",String(b.dataset.mailMode===mailboxMode));
 el("mailAccount").value=mailboxAccount;el("mailClearSearch").hidden=!mailboxSearch;
 let query=sent?sb.from("portfolio_crm_mail").select("id,subject,body,recipient,sender,status,created_at",{count:"exact"}):sb.from("portfolio_crm_inbound").select("id,lead_id,sender,recipients,subject,body,body_limited,attachment_count,received_at,read_at",{count:"exact"});
 if(mailboxAccount)query=sent?query.eq("sender",mailboxAccount):query.contains("recipients",[mailboxAccount]);
 if(mailboxMode==="unread")query=query.is("read_at",null);
 if(mailboxMode==="unassigned")query=query.is("lead_id",null);
 if(mailboxSearch)query=query.or(mailSearchFilter(mailboxSearch,sent));
 try{
  const {data,error,count}=await query.order(sent?"created_at":"received_at",{ascending:false}).order("id",{ascending:false}).range(from,from+mailPageSize-1);
  if(generation!==mailboxGeneration||!isAdmin)return;
  if(error)throw error;
  const total=count??0;
  if(mailboxPage>0&&from>=total){mailboxPage=Math.max(0,Math.ceil(total/mailPageSize)-1);return await loadMailbox({keepReader});}
  mailboxRows=data||[];
  if(mailboxSelected){const fresh=mailboxRows.find(x=>x.id===mailboxSelected.id);if(fresh)mailboxSelected=fresh;else if(!keepReader){mailboxSelected=null;mailboxOpened=false;}}
  status.textContent=total+" "+(total===1?"mensaje":"mensajes")+(mailboxSearch?" · búsqueda activa":"");
  renderMailList();renderMailReader();
  el("mailPrevious").disabled=mailboxPage===0;el("mailNext").disabled=from+mailPageSize>=total;
  el("mailPageInfo").textContent=total?(from+1)+"–"+Math.min(from+mailPageSize,total)+" de "+total:"";
  el("mailPagination").hidden=total<=mailPageSize;
 }catch{if(generation===mailboxGeneration&&isAdmin){status.textContent="No se pudo consultar el correo. Presioná Actualizar para reintentar.";list.append(node("p","La bandeja no está disponible temporalmente.","mailEmpty"));}}
 finally{if(generation===mailboxGeneration)list.setAttribute("aria-busy","false");}
}
function setMailComposerVisible(visible){
 const host=el("mailComposerHost"),hasForm=Boolean(host.querySelector("form"));
 host.hidden=!visible;el("mailWorkspace").hidden=visible;el("mailDraftBar").hidden=visible||!hasForm;
 if(visible)host.querySelector("h2")?.focus({preventScroll:true});
 else if(hasForm)el("mailResumeDraft").focus({preventScroll:true});
}
function closeMailComposer({focus=true}={}){
 el("mailComposerHost").replaceChildren();setMailDraftActive(false);setMailComposerVisible(false);
 if(focus){const reply=el("mailReader").querySelector(".mailReplyAction");(mailboxOpened&&reply?reply:el("mailCompose")).focus({preventScroll:true});}
}
function openMailboxComposer(message=null){
 if(!isAdmin)return;
 const host=el("mailComposerHost");
 if(host.querySelector("form")){setMailComposerVisible(true);if(message)notice("Ya tenés un borrador abierto. Terminá o descartalo antes de responder otro correo.",true);return;}
 const form=node("form",undefined,"crmReplyEditor crmGeneralComposer cgaGlassForm cgaFormControls");
 const heading=node("h2",message?"Responder":"Nuevo correo");heading.tabIndex=-1;heading.id="mailComposerTitle";form.setAttribute("aria-labelledby",heading.id);
 const header=node("div",undefined,"mailComposerHeader"),minimize=mailButton("Minimizar","chevron");
 minimize.onclick=()=>{if(!mailboxBusy)setMailComposerVisible(false);};header.append(heading,minimize);
 const {select:sender,locked}=crmSenderChoice(node,message);
 const to=node("input"),subject=node("input"),body=node("textarea");
 to.type="email";to.required=true;to.maxLength=254;to.value=message?.sender||"";to.readOnly=Boolean(message);to.autocomplete="off";
 subject.required=true;subject.maxLength=180;subject.value=message?(/^re:/i.test(message.subject||"")?message.subject:"Re: "+(message.subject||"Sin asunto")).slice(0,180):"";
 body.required=true;body.maxLength=5000;body.rows=10;
 function field(label,control){const wrap=node("div",undefined,"crmField"),lab=node("label",label);control.id="mail-"+crypto.randomUUID();lab.htmlFor=control.id;wrap.append(lab,control);return wrap;}
 const submit=mailButton("Enviar","send","cgaFormButton");submit.type="submit";
 const cancel=mailButton("Descartar","trash");
 let attemptId=null;
 const status=node("p",message&&!locked?"Seleccioná la identidad desde la cual querés responder.":"El borrador se conserva mientras esta sesión esté abierta.","mailComposeStatus");status.setAttribute("role","status");
 const count=node("small","0 / 5000","mailCharacterCount");body.addEventListener("input",()=>{count.textContent=body.value.length+" / 5000";});
 const actions=node("div",undefined,"mailComposerActions");actions.append(cancel,submit);
 form.append(header,field("De",sender),field("Para",to),field("Asunto",subject),field("Mensaje",body),count,status,actions);
 function setLocked(value){sender.disabled=value||locked;to.disabled=value;subject.disabled=value;body.disabled=value;}
 cancel.onclick=async()=>{
  if(mailboxBusy)return;
  const epoch=mailboxEpoch;mailboxBusy=true;cancel.disabled=true;submit.disabled=true;minimize.disabled=true;
  try{if(await window.CGADialog.confirm(attemptId?"El resultado del envío puede no estar confirmado. ¿Descartar el borrador sin reenviar?":"¿Descartar este borrador?")){if(epoch===mailboxEpoch)closeMailComposer();}}
  finally{if(epoch===mailboxEpoch){mailboxBusy=false;cancel.disabled=false;submit.disabled=false;minimize.disabled=false;}}
 };
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(mailboxBusy||!isAdmin||!CRM_SENDERS.includes(sender.value))return;
  const epoch=mailboxEpoch,from=sender.value;
  mailboxBusy=true;submit.disabled=true;cancel.disabled=true;minimize.disabled=true;setLocked(true);
  try{
   if(!await window.CGADialog.confirm("¿Enviar este correo a "+to.value+" desde "+from+"?")){if(!attemptId)setLocked(false);return;}
   if(epoch!==mailboxEpoch||!isAdmin)return;
   attemptId=attemptId||crypto.randomUUID();status.textContent="Enviando…";submit.setAttribute("aria-busy","true");
   const {data,error}=await sb.functions.invoke("portfolio-crm-mail",{body:{id:attemptId,context:"general",recipient:to.value,subject:subject.value,body:body.value,sender:from,in_reply_to:message?.id||null}});
   if(epoch!==mailboxEpoch||!isAdmin)return;
   if(error)throw error;
   if(data?.status==="accepted"){closeMailComposer({focus:false});notice("Correo aceptado por Resend.",false,{success:true});mailboxMode="sent";mailboxAccount=from;mailboxPage=0;mailboxSearch="";el("mailSearch").value="";mailResetSelection();await loadMailbox();return;}
   const labels={invalid_sender:"Seleccioná una cuenta autorizada.",sender_mismatch:"La cuenta no coincide con el correo original.",conflict:"El intento no coincide con el envío registrado.",contact_blocked:"Contacto no autorizado.",decision_changed:"Revisá la decisión de la solicitud.",limit:"Límite de 10 intentos de CRM por 24 horas.",duplicate:"Ya se envió un mensaje idéntico recientemente.",uncertain_previous:"Existe un envío sin confirmar. Consultá Enviados.",failed:"El proveedor rechazó el envío.",invalid_reply:"El destinatario no coincide con el mensaje.",sender_not_configured:"Remitente no habilitado."};
   status.textContent=labels[data?.status]||"Resultado no confirmado. Consultá Enviados antes de repetir.";
   if(["contact_blocked","decision_changed","limit","duplicate","failed","invalid_reply","sender_not_configured","invalid_sender","sender_mismatch"].includes(data?.status)){attemptId=null;setLocked(false);}
  }catch{if(epoch===mailboxEpoch&&isAdmin)status.textContent="Resultado no confirmado. Consultá Enviados antes de repetir.";}
  finally{if(epoch===mailboxEpoch){mailboxBusy=false;submit.disabled=false;cancel.disabled=false;minimize.disabled=false;submit.removeAttribute("aria-busy");}}
 });
 host.append(form);setMailDraftActive(true);setMailComposerVisible(true);
}
function initMailbox(){
 for(const address of CRM_SENDERS){const option=node("option",address);option.value=address;el("mailAccount").append(option);}
 el("mailCompose").onclick=()=>openMailboxComposer();
 el("mailResumeDraft").onclick=()=>setMailComposerVisible(true);
 el("mailRefresh").onclick=()=>void loadMailbox();
 for(const b of el("crmMailbox").querySelectorAll("[data-mail-mode]"))b.onclick=()=>{mailboxMode=b.dataset.mailMode;mailApplyFilters();};
 el("mailAccount").onchange=()=>{mailboxAccount=el("mailAccount").value;mailApplyFilters();};
 el("mailSearchForm").addEventListener("submit",e=>{e.preventDefault();mailboxSearch=normalizeMailSearch(el("mailSearch").value);el("mailSearch").value=mailboxSearch;mailApplyFilters();});
 el("mailClearSearch").onclick=()=>{mailboxSearch="";el("mailSearch").value="";mailApplyFilters();};
 el("mailPrevious").onclick=()=>{if(mailboxPage>0){mailboxPage--;mailResetSelection();void loadMailbox();}};
 el("mailNext").onclick=()=>{mailboxPage++;mailResetSelection();void loadMailbox();};
}
initMailbox();
verifyAdmin().catch(e=>notice(e.message,true));
