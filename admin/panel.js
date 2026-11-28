import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";
import { createLeadCRM, CRM_SENDERS, crmSenderChoice } from "./solicitudes.js?v=25-admin-qa1";
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
let currentUser=null, isAdmin=false, documents=[],authGeneration=0,documentGeneration=0,portfolioGeneration=0,logoutBusy=false;
function show(screen){
  el("loginPanel").hidden=screen!=="login";
  el("pendingPanel").hidden=screen!=="pending";
  el("app").hidden=screen!=="app";
  el("adminLogoutHeader").hidden=screen!=="app";
  if(screen!=="app"){el("adminSettings").open=false;setAdminMore(false); }
  if(screen!=="app"){resetMailbox();leadCRM.reset();resetOperations();resetDocuments();}
}
async function verifyAdmin(){
  if(logoutBusy)return;
  const generation=++authGeneration;
  const {data:{user},error}=await sb.auth.getUser();
  if(generation!==authGeneration)return;
  if(error||!user){ currentUser=null;isAdmin=false;show("login");return; }
  currentUser=user;
  const found=await sb.from("portfolio_cv_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(generation!==authGeneration)return;
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
  if(generation!==authGeneration||!isAdmin)return;
  await loadDocuments();
  if(generation!==authGeneration||!isAdmin)return;
  await loadLeads();
  refreshOverview();
}
el("authForm").addEventListener("submit",async e=>{
  e.preventDefault();if(logoutBusy)return;const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;
  const email=el("email").value.trim(),password=el("password").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  el("password").value="";
  if(error)notice("No se pudo iniciar sesión. Revisá los datos o el estado de la cuenta.",true);
  else{clearTimeout(noticeTimer);status.hidden=true;status.replaceChildren();await verifyAdmin();}
  btn.disabled=false;
});
el("recheck").addEventListener("click",verifyAdmin);
document.querySelectorAll(".logout").forEach(x=>x.addEventListener("click",async()=>{
  if(logoutBusy)return;
  if(mailboxBusy||leadCRM.isSending?.()||documentBusy()){notice("Esperá a que termine la operación activa.",true);return;}
  logoutBusy=true;
  const loginButton=el("authForm").querySelector("button[type=submit]");
  try{
   if((mailboxDraftDirty||leadCRM.hasDrafts?.())&&!await window.CGADialog.confirm("Hay borradores de correo sin guardar. ¿Cerrar sesión y descartarlos?"))return;
   if(mailboxBusy||leadCRM.isSending?.()||documentBusy())return;
   ++authGeneration;currentUser=null;isAdmin=false;
   try{sessionStorage.removeItem("cga-admin-view")}catch{}
   show("login");el("password").value="";loginButton.disabled=true;
   const result=await sb.auth.signOut();
   if(result?.error){notice("La oficina se cerró localmente, pero no se pudo confirmar el cierre de sesión. Reintentá con conexión.",true);return;}
   notice("Sesión cerrada correctamente.");
  }catch{notice("No se pudo confirmar el cierre de sesión.",true);}
  finally{logoutBusy=false;loginButton.disabled=false;}
}));

let mailboxMode="received",mailboxAccount="",mailboxPage=0,mailboxGeneration=0,mailboxEpoch=0;
let mailboxSearch="",mailboxRows=[],mailboxSelected=null,mailboxOpened=false,mailboxBusy=false,mailboxDraftDirty=false;
let mailboxLeadId=null,mailboxIssues=false;
const mailIssueStatuses=["pending","uncertain","failed"];
const mailPageSize=30,mailWide=matchMedia("(min-width:1180px) and (min-height:551px)");
const adminViews=["overview","leads","mail","cv","portfolio"];
const adminNavigation=el("app").querySelector(".adminNavigation");
const adminWide=matchMedia("(min-width: 760px)");
let adminMoreOpen=false;
const adminMore=el("adminMoreToggle"),adminTabList=adminNavigation.querySelector(".adminTabList");
function setAdminMore(open){
 adminMoreOpen=Boolean(open&&!adminWide.matches);
 adminMore.hidden=adminWide.matches;adminMore.setAttribute("aria-expanded",String(adminMoreOpen));
 adminNavigation.dataset.moreOpen=String(adminMoreOpen);
 const selected=adminTabList.querySelector('[aria-selected="true"]');
 const extra=[el("adminTabCV"),el("adminTabPortfolio")];
 for(const tab of extra)tab.hidden=!adminWide.matches&&!adminMoreOpen;
 adminMore.dataset.active=String(!adminWide.matches&&extra.includes(selected));
 for(const tab of adminTabList.querySelectorAll('[role="tab"]'))tab.tabIndex=(!tab.hidden&&tab===selected)?0:-1;
 if(!selected||selected.hidden)el("adminTabOverview").tabIndex=0;
}
function focusAdminView(view){const tab=adminTabList.querySelector('button[data-admin-view="'+view+'"]');(tab?.hidden?adminMore:tab)?.focus();}
function syncAdminNavOrientation(){adminTabList.setAttribute("aria-orientation",adminWide.matches?"vertical":"horizontal");setAdminMore(false);}
adminMore.addEventListener("click",()=>{setAdminMore(!adminMoreOpen);if(adminMoreOpen){el("adminTabCV").tabIndex=0;el("adminTabCV").focus();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&adminMoreOpen){setAdminMore(false);adminMore.focus();}});
document.addEventListener("click",e=>{if(adminMoreOpen&&!adminNavigation.contains(e.target))setAdminMore(false);});
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
  setAdminMore(false);el("adminSettings").open=false;
  try{sessionStorage.setItem("cga-admin-view",view)}catch{}
  // List refresh is independent from the session-only composer.
  if(view==="mail")void loadMailbox();
  if(view==="overview"){refreshOverview();void refreshOverviewMail();}
}
el("app").addEventListener("click",event=>{
  const button=event.target.closest("button[data-admin-view],button[data-go-view]");
  if(!button)return;
  if(button.dataset.adminView){navigateAdmin(button.dataset.adminView);focusAdminView(button.dataset.adminView);}
  if(button.dataset.goView){
    if(!isAdmin)return;
    if(button.dataset.goView==="mail"&&button.dataset.mailFolder){openMailContext({mode:button.dataset.mailFolder,issues:button.dataset.mailIssues==="true"});return;}
    navigateAdmin(button.dataset.goView);
    if(button.dataset.goView==="leads"&&button.dataset.leadId){void openLeadContext(button.dataset.leadId);return;}
    if(button.dataset.goView==="leads"&&button.dataset.leadFilter)leadCRM.setFilter(button.dataset.leadFilter);
    if(button.dataset.composeMail==="true"){openMailboxComposer();return;}
    if(button.id==="quickUploadCV"||button.dataset.goUpload==="true")setCVFormOpen(true);
    else focusAdminView(button.dataset.goView);
  }
});
adminNavigation.addEventListener("keydown",event=>{
  const previous=adminWide.matches?"ArrowUp":"ArrowLeft",nextKey=adminWide.matches?"ArrowDown":"ArrowRight";
  if(![previous,nextKey,"Home","End"].includes(event.key))return;
  const visible=adminViews.filter(name=>!adminTabList.querySelector('button[data-admin-view="'+name+'"]').hidden);
  const current=visible.indexOf(event.target.dataset.adminView);
  if(current<0)return;
  event.preventDefault();
  const next=event.key==="Home"?0:event.key==="End"?visible.length-1:
    (current+(event.key===nextKey?1:-1)+visible.length)%visible.length;
  navigateAdmin(visible[next]);focusAdminView(visible[next]);
});
let documentsLoaded=false,portfoliosLoaded=false;
let opsUnread=null,opsIssues=null,opsGeneration=0;
function resetOperations(){
 ++opsGeneration;opsUnread=null;opsIssues=null;documentsLoaded=false;portfoliosLoaded=false;
 for(const id of ["statPending","statActive","statCV","statPortfolios","statUnreadMail","statMailIssues"])el(id).textContent="—";
 el("adminPriorities").replaceChildren();el("adminAgenda").replaceChildren();
 for(const id of ["adminNavLeadCount","adminNavUnreadCount"]){el(id).textContent="";el(id).hidden=true;}
 el("refreshOverviewMail").disabled=false;
}
async function refreshOverviewMail(){
 if(!isAdmin)return;
 const g=++opsGeneration,button=el("refreshOverviewMail");button.disabled=true;
 try{
  const [inbound,outbound]=await Promise.allSettled([
   sb.from("portfolio_crm_inbound").select("id",{count:"exact",head:true}).is("read_at",null),
   sb.from("portfolio_crm_mail").select("id",{count:"exact",head:true}).in("status",mailIssueStatuses)
  ]);
  if(g!==opsGeneration||!isAdmin)return;
  const count=r=>r.status==="fulfilled"&&!r.value.error&&typeof r.value.count==="number"?r.value.count:null;
  opsUnread=count(inbound);opsIssues=count(outbound);refreshOverview();
 }catch{if(g===opsGeneration&&isAdmin){opsUnread=null;opsIssues=null;refreshOverview();}}
 finally{if(g===opsGeneration)button.disabled=false;}
}
function refreshOverview(){
 if(!isAdmin)return;
 const totals=leadCRM.getSummary(),stats={statPending:totals.loaded?totals.pending:null,statActive:totals.loaded?totals.active:null,statCV:documentsLoaded?documents.length:null,statPortfolios:portfoliosLoaded?Object.values(publicPortfolioFiles).filter(name=>publishedPortfolios.has(name)).length:null,statUnreadMail:opsUnread,statMailIssues:opsIssues};
 for(const [id,v] of Object.entries(stats))el(id).textContent=v===null?"—":String(v);
 for(const [id,v] of [["adminNavLeadCount",stats.statPending],["adminNavUnreadCount",stats.statUnreadMail]]){el(id).textContent=v>0?String(v):"";el(id).hidden=!(v>0);}
 el("statMailIssues").closest("article").dataset.attention=String(opsIssues>0);
 const target=el("adminPriorities");target.replaceChildren();
 function suggestion(message,label,view,extra={}){
  const item=node("div",undefined,"adminPriorityItem"),copy=node("p",message),button=node("button",label);
  button.type="button";button.dataset.goView=view;button.dataset.cgaIcon="arrow";Object.assign(button.dataset,extra);item.append(copy,button);target.append(item);
 }




 if(documentsLoaded&&documents.length===0)suggestion("No hay CV cargados.","Nuevo CV","cv",{goUpload:"true"});
 if(portfoliosLoaded&&!publishedPortfolios.has("Christian_Arleo_Portfolio_EN.pdf"))suggestion("Falta el PDF en inglés.","Publicar","portfolio");
 const incomplete=!totals.loaded||!documentsLoaded||!portfoliosLoaded||opsUnread===null||opsIssues===null;
 if(incomplete)target.append(node("p","Hay indicadores sin datos. Actualizá los módulos.","cgaMeta"));
 else if(!target.children.length&&!opsIssues&&!opsUnread&&!totals.pending&&!totals.active)target.append(node("p","Sin pendientes en los registros consultados.","cgaMeta"));
 const agenda=el("adminAgenda");agenda.replaceChildren();
 if(!totals.loaded)agenda.append(node("p","Agenda no disponible.","cgaMeta"));
 else if(!totals.meetings.length)agenda.append(node("p","Sin propuestas en las solicitudes cargadas.","cgaMeta"));
 else for(const meeting of totals.meetings){
  const item=node("div",undefined,"adminAgendaItem"),copy=node("div"),title=node("strong",meeting.company||"Empresa"),when=node("p",mailDate(meeting.at,true)+" · "+({virtual:"Virtual",presencial:"Presencial",a_definir:"A definir"}[meeting.mode]||"A definir"),"cgaMeta");
  copy.append(title,node("p",meeting.position||"Propuesta","cgaMeta"),when);
  const button=node("button","Ver propuesta");button.type="button";button.dataset.goView="leads";button.dataset.leadId=meeting.id;button.dataset.cgaIcon="arrow";item.append(copy,button);agenda.append(item);
 }
 window.CGAIcons?.decorate(agenda);
}
el("refreshOverviewMail").onclick=()=>void refreshOverviewMail();
function documentBusy(){return el("uploadButton").disabled||Object.values(publicPortfolioDisplay).some(x=>el(x.button).disabled)||Boolean(el("documents").querySelector("button[data-id]:disabled,select[data-status-id]:disabled"));}
function resetDocuments(){
 ++documentGeneration;++portfolioGeneration;documents=[];publishedPortfolios.clear();documentsLoaded=false;portfoliosLoaded=false;
 el("documents").replaceChildren();el("documentsCount").textContent="—";el("documentsFilter").value="";el("uploadForm").reset();el("cvUploadForm").hidden=true;el("newCVToggle").setAttribute("aria-expanded","false");
 for(const [lang,d] of Object.entries(publicPortfolioDisplay)){const form=el("publicPortfolioForm"+portfolioSuffix[lang]);form.reset();form.hidden=true;el("editPublicPortfolio"+portfolioSuffix[lang]).setAttribute("aria-expanded","false");el(d.state).textContent="Consultando…";el(d.link).hidden=true;el(d.link).removeAttribute("href");}
 el("publicPortfolioStatus").textContent="";
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
  if(el("uploadButton").disabled)return;
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
  if(el(publicPortfolioDisplay[lang].button).disabled)return;
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
  const generation=++portfolioGeneration;
  const message=el("publicPortfolioStatus");
  portfoliosLoaded=false;refreshOverview();
  message.textContent="Consultando archivos publicados…";
  const {data,error}=await sb.storage.from(publicPortfolioBucket).list("",{limit:100});
  if(!isAdmin||generation!==portfolioGeneration)return;
  if(error){
    message.textContent="No se pudo comprobar qué archivos hay publicados: "+error.message;
    publishedPortfolios.clear();
    for(const d of Object.values(publicPortfolioDisplay)){el(d.state).textContent="Estado no disponible";el(d.link).hidden=true;el(d.link).removeAttribute("href");}
    refreshOverview();
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
    if(!portfoliosLoaded){notice("Actualizá el estado de publicación antes de guardar.",true);return;}
    const file=el(display.file).files[0];
    const path=publicPortfolioFiles[lang];
    if(!file||!path||file.size>45*1024*1024||file.size<1024||!file.name.toLowerCase().endsWith(".pdf")){
      notice("Elegí un PDF válido de hasta 45 MB para el portafolio en "+display.label+".",true);return;
    }
    const header=new TextDecoder("latin1").decode(await file.slice(0,8).arrayBuffer());
    if(!header.startsWith("%PDF-")){notice("El archivo seleccionado no es un PDF válido.",true);return;}
    const button=el(display.button);
    if(button.disabled||!isAdmin||!portfoliosLoaded)return;
    const exists=publishedPortfolios.has(path);
    if(!await window.CGADialog.confirm("¿"+(exists?"Reemplazar":"Publicar")+" el PDF en "+display.label+"? Solo cambiará esta edición. Si hay una copia anterior, guardala."))return;
    if(button.disabled||!isAdmin||!portfoliosLoaded)return;
    button.disabled=true;
    const previousText=button.textContent;
    button.textContent="Subiendo PDF…";
    notice((exists?"Reemplazando":"Publicando")+" únicamente el PDF en "+display.label+"…");
    try{
      const {error}=await sb.storage.from(publicPortfolioBucket).upload(path,file,{
        upsert:exists,contentType:"application/pdf",cacheControl:"0"
      });
      if(error)throw error;
      publishedPortfolios.add(path);
      setPublicPortfolioState(lang,true);
      button.disabled=false;togglePortfolioForm(lang,false);
      notice("PDF en "+display.label+" actualizado. Las demás ediciones no cambiaron.");
      await loadPublicPortfolios();
    }catch(error){
      notice("No se pudo actualizar el PDF en "+display.label+": "+(error.message||"Error desconocido"),true);
    }finally{
      button.disabled=false;
      button.textContent=previousText;
      window.CGAIcons?.decorate(button);
      if(isAdmin&&portfoliosLoaded&&publishedPortfolios.has(path))setPublicPortfolioState(lang,true);
    }
  });
}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
async function loadDocuments(){
 if(!isAdmin)return;
 const generation=++documentGeneration;
 const {data,error}=await sb.from("portfolio_cv_documents").select("*").order("created_at",{ascending:false}).limit(200);
 if(!isAdmin||generation!==documentGeneration)return;
 const target=el("documents");target.replaceChildren();
 if(error){documents=[];documentsLoaded=false;el("documentsCount").textContent="Estado no disponible";target.textContent="No se pudo consultar los CV.";refreshOverview();return;}
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
  const company=el("company").value.trim(),role=el("position").value.trim(),application=el("applicationStatus").value;
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
       company_name:company,ruc,role_name:role,
       original_filename:file.name,storage_path:path,is_active:true,is_main:main,
       application_status:application,
       expires_at:expiry?new Date(expiry).toISOString():null
    });
    if(added.error){await sb.storage.from(bucket).remove([path]);throw added.error;}
    e.target.reset();el("principal").checked=true;el("applicationStatus").value="preparado";
    notice("CV guardado y disponible para esta empresa.");
    btn.disabled=false;setCVFormOpen(false);
    await loadDocuments();
  } catch(err){notice("No se pudo subir: "+err.message,true);}
  finally{btn.disabled=false;}
});
el("documents").addEventListener("click",async e=>{
  const btn=e.target.closest("button[data-id]");if(!btn||!isAdmin)return;
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
const leadCRM=createLeadCRM({sb,el,node,notice,getDocuments:()=>documents,loadDocuments,bucket,onChange:refreshOverview,openMail:id=>openMailContext({leadId:id})});
async function loadLeads(){await leadCRM.load();refreshOverview();void refreshOverviewMail();}
async function openLeadContext(id){
 if(!isAdmin)return;
 const epoch=mailboxEpoch;
 if(!leadCRM.getSummary().loaded)await leadCRM.load();
 if(!isAdmin||epoch!==mailboxEpoch)return;
 if(!leadCRM.openLead(id))notice("La solicitud no está entre las últimas 200 cargadas. No se abrió otra solicitud por aproximación.",true);
}
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
 mailboxMode="received";mailboxAccount="";mailboxPage=0;mailboxSearch="";mailboxLeadId=null;mailboxIssues=false;mailboxRows=[];mailboxSelected=null;mailboxOpened=false;mailboxBusy=false;
 setMailDraftActive(false);
 el("mailComposerHost").replaceChildren();el("mailComposerHost").hidden=true;
 el("mailDraftBar").hidden=true;el("mailWorkspace").hidden=false;el("mailWorkspace").dataset.detail="false";
 el("mailList").replaceChildren();el("mailList").setAttribute("aria-busy","false");el("mailReader").replaceChildren();el("mailListStatus").textContent="";
 el("mailSearch").value="";el("mailAccount").value="";el("mailClearSearch").hidden=true;el("mailPagination").hidden=true;renderMailContext();
 for(const b of el("crmMailbox").querySelectorAll("[data-mail-mode]"))b.setAttribute("aria-pressed",String(b.dataset.mailMode==="received"));
 el("mailIssuesFilter").setAttribute("aria-pressed","false");el("mailBandejaTitle").textContent="Recibidos";el("mailFolderMobile").value="received";
}
function mailResetSelection(){mailboxSelected=null;mailboxOpened=false;renderMailReader();}
function mailApplyFilters(){mailboxPage=0;mailResetSelection();void loadMailbox();}
function renderMailContext(){
 const active=Boolean(mailboxLeadId||mailboxIssues);el("mailContextBar").hidden=!active;
 el("mailContextLabel").textContent=mailboxLeadId?"Correos de la solicitud seleccionada":mailboxIssues?"Envíos pendientes, sin confirmar o rechazados":"";
}
function openMailContext({mode="received",leadId=null,issues=false}={}){
 if(!isAdmin)return;
 if(mailboxBusy){notice("Terminá la operación de correo antes de cambiar de bandeja.",true);return;}
 if(el("mailComposerHost").querySelector("form"))setMailComposerVisible(false);
 mailboxMode=mode;mailboxLeadId=leadId;mailboxIssues=Boolean(issues&&mode==="sent");mailboxAccount="";mailboxSearch="";mailboxPage=0;el("mailSearch").value="";mailResetSelection();
 navigateAdmin("mail");el("mailTitle").scrollIntoView({block:"start"});
}
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
  const avatar=node("span",String(sent?m.recipient:m.sender).trim().slice(0,2).toUpperCase(),"mailAvatar");avatar.setAttribute("aria-hidden","true");const copy=node("span",undefined,"mailRowCopy");copy.append(top,subject,preview,meta);row.append(avatar,copy);
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
 back.onclick=()=>{mailboxOpened=false;el("mailWorkspace").dataset.detail="false";const row=[...el("mailList").children].find(x=>x.dataset.mailId===m.id);(row||el("mailSearch")).focus();};
 toolbar.append(back);
 if(!sent){
  const reply=mailButton("Responder","return","cgaSoftButton mailReplyAction");reply.onclick=()=>openMailboxComposer(m);
  const read=mailButton(m.read_at?"Marcar no leído":"Marcar leído",m.read_at?"mail":"check");read.onclick=()=>void toggleMailRead(m,read);
  toolbar.append(reply,read);
 }
 if(m.lead_id){const link=mailButton("Ver solicitud","briefcase");link.onclick=()=>{navigateAdmin("leads");void openLeadContext(m.lead_id);};toolbar.append(link);}
 const title=node("h2",m.subject||"Sin asunto","mailReaderTitle");title.id="mailReaderTitle";title.tabIndex=-1;
 const meta=node("dl",undefined,"mailReaderMeta");
 for(const [key,value] of [["De",m.sender],["Para",sent?m.recipient:(m.recipients||[]).join(", ")],["Fecha",mailDate(sent?m.created_at:m.received_at,true)],["Estado",sent?(mailStatusLabels[m.status]||"Estado desconocido"):(m.read_at?"Leído":"No leído")]]){
  const line=node("div");line.append(node("dt",key),node("dd",value||"—"));meta.append(line);
 }
 reader.append(toolbar,title,meta);
 if(!sent)reader.append(node("p",m.lead_id?"Solicitud asociada. Identidad no verificada.":"Sin solicitud. Identidad no verificada.","mailReaderNote"));
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
  void leadCRM.syncUnread(m.lead_id);void refreshOverviewMail();
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
 for(const b of el("crmMailbox").querySelectorAll("[data-mail-mode]"))b.setAttribute("aria-pressed",String(b.dataset.mailMode===mailboxMode&&!mailboxIssues));
 el("mailIssuesFilter").setAttribute("aria-pressed",String(mailboxIssues));el("mailFolderMobile").value=mailboxIssues?"issues":mailboxMode;el("mailBandejaTitle").textContent=mailboxIssues?"Por revisar":({received:"Recibidos",unread:"No leídos",sent:"Enviados",unassigned:"Sin solicitud"}[mailboxMode]||"Correo");
 el("mailAccount").value=mailboxAccount;el("mailClearSearch").hidden=!mailboxSearch;renderMailContext();
 let query=sent?sb.from("portfolio_crm_mail").select("id,lead_id,subject,body,recipient,sender,status,created_at",{count:"exact"}):sb.from("portfolio_crm_inbound").select("id,lead_id,sender,recipients,subject,body,body_limited,attachment_count,received_at,read_at",{count:"exact"});
 if(mailboxAccount)query=sent?query.eq("sender",mailboxAccount):query.contains("recipients",[mailboxAccount]);
 if(mailboxMode==="unread")query=query.is("read_at",null);
 if(mailboxMode==="unassigned")query=query.is("lead_id",null);
 if(mailboxLeadId)query=query.eq("lead_id",mailboxLeadId);
 if(mailboxIssues&&sent)query=query.in("status",mailIssueStatuses);
 if(mailboxSearch)query=query.or(mailSearchFilter(mailboxSearch,sent));
 try{
  const {data,error,count}=await query.order(sent?"created_at":"received_at",{ascending:false}).order("id",{ascending:false}).range(from,from+mailPageSize-1);
  if(generation!==mailboxGeneration||!isAdmin)return;
  if(error)throw error;
  if(typeof count!=="number")throw Error("count_unavailable");
  const total=count;
  if(mailboxPage>0&&from>=total){mailboxPage=Math.max(0,Math.ceil(total/mailPageSize)-1);return await loadMailbox({keepReader});}
  mailboxRows=data||[];
  if(mailboxSelected){const fresh=mailboxRows.find(x=>x.id===mailboxSelected.id);if(fresh)mailboxSelected=fresh;else if(!keepReader){mailboxSelected=null;mailboxOpened=false;}}
  status.textContent=total+" "+(total===1?"mensaje":"mensajes")+(mailboxSearch?" · búsqueda activa":"");
  renderMailList();renderMailReader();
  el("mailPrevious").disabled=mailboxPage===0;el("mailNext").disabled=from+mailPageSize>=total;
  el("mailPageInfo").textContent=total?(from+1)+"–"+Math.min(from+mailPageSize,total)+" de "+total:"";
  el("mailPagination").hidden=total<=mailPageSize;
 }catch{if(generation===mailboxGeneration&&isAdmin){status.textContent="Correo sin datos. Actualizá para reintentar.";list.append(node("p","La bandeja no está disponible temporalmente.","mailEmpty"));}}
 finally{if(generation===mailboxGeneration)list.setAttribute("aria-busy","false");}
}
function setMailComposerVisible(visible){
 const host=el("mailComposerHost"),hasForm=Boolean(host.querySelector("form"));
 host.hidden=!visible;el("mailWorkspace").hidden=visible;el("mailDraftBar").hidden=visible||!hasForm;
 if(visible){host.scrollIntoView({block:"start"});host.querySelector("h2")?.focus({preventScroll:true});}
 else if(hasForm)el("mailResumeDraft").focus();
}
function closeMailComposer({focus=true}={}){
 el("mailComposerHost").replaceChildren();setMailDraftActive(false);setMailComposerVisible(false);
 if(focus){const reader=el("mailReader"),target=mailboxOpened&&mailboxSelected?(reader.querySelector(".mailReplyAction")||reader.querySelector("h2")):el("mailCompose");target?.focus();}
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
 const status=node("p",message&&!locked?"Seleccioná la identidad desde la cual querés responder.":"Borrador temporal: se pierde al cerrar sesión.","mailComposeStatus");status.setAttribute("role","status");
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
   if(data?.status==="accepted"){closeMailComposer({focus:false});notice("Correo aceptado por Resend.",false,{success:true});mailboxMode="sent";mailboxAccount=from;mailboxPage=0;mailboxSearch="";mailboxLeadId=null;mailboxIssues=false;void refreshOverviewMail();el("mailSearch").value="";mailResetSelection();await loadMailbox();return;}
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
 for(const b of el("crmMailbox").querySelectorAll("[data-mail-mode]"))b.onclick=()=>{mailboxMode=b.dataset.mailMode;mailboxIssues=false;if(mailboxMode==="unassigned")mailboxLeadId=null;mailApplyFilters();};
 el("mailIssuesFilter").onclick=()=>{mailboxMode="sent";mailboxIssues=true;mailboxLeadId=null;mailApplyFilters();};
 el("mailFolderMobile").onchange=()=>{const mode=el("mailFolderMobile").value;if(mode==="issues"){el("mailIssuesFilter").click();return;}el("crmMailbox").querySelector('button[data-mail-mode="'+mode+'"]')?.click();};
 el("mailClearContext").onclick=()=>{mailboxLeadId=null;mailboxIssues=false;mailApplyFilters();};
 el("mailAccount").onchange=()=>{mailboxAccount=el("mailAccount").value;mailApplyFilters();};
 el("mailSearchForm").addEventListener("submit",e=>{e.preventDefault();mailboxSearch=normalizeMailSearch(el("mailSearch").value);el("mailSearch").value=mailboxSearch;mailApplyFilters();});
 el("mailClearSearch").onclick=()=>{mailboxSearch="";el("mailSearch").value="";mailApplyFilters();};
 el("mailPrevious").onclick=()=>{if(mailboxPage>0){mailboxPage--;mailResetSelection();void loadMailbox();}};
 el("mailNext").onclick=()=>{mailboxPage++;mailResetSelection();void loadMailbox();};
}
initMailbox();
verifyAdmin().catch(e=>notice(e.message,true));
