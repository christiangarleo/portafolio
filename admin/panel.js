import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";
const sb = createClient("https://gprhevdotoykofrxbufv.supabase.co", "sb_publishable_vTBBhrnC-kevNf9AJeZiyw_zGG4AB_I", { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const el=id=>document.getElementById(id);
const status=el("status");
function notice(msg,error=false){status.textContent=msg;status.dataset.error=String(error);status.hidden=false;}
const bucket="cv-personalizados";
const authRedirect="https://christianarleo.com/admin/";
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
  el("serviceHint").hidden=true;
  el("pendingTitle").textContent="Cuenta autenticada, pendiente de autorización";
  el("pendingMessage").textContent="La consulta funciona, pero tu cuenta todavía no aparece habilitada como administradora.";
  show(isAdmin?"app":"pending");
  if(isAdmin){await loadDocuments();await loadLeads();}
}
el("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;
  const email=el("email").value.trim(),password=el("password").value;
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error)notice(error.message,true);else{notice("Sesión iniciada.");await verifyAdmin();}
  btn.disabled=false;
});
el("signUp").addEventListener("click",async()=>{
  const email=el("email").value.trim(),password=el("password").value;
  if(!email||password.length<8){notice("Completá correo y contraseña (mínimo 8 caracteres).",true);return;}
  const {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:authRedirect}});
  notice(error?error.message:"Cuenta solicitada. Verificá tu correo y luego autorizá la cuenta en Supabase.",Boolean(error));
});
el("resendConfirmation").addEventListener("click", async () => {
  const email=el("email").value.trim();
  if(!email || !el("email").checkValidity()){
    notice("Escribí un correo válido para reenviar la confirmación.",true);
    el("email").focus();
    return;
  }
  const btn=el("resendConfirmation");
  btn.disabled=true;
  try {
    const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:authRedirect}});
    notice(error?error.message:"Si el correo todavía necesita confirmación, recibirás un enlace nuevo. Revisá el mensaje más reciente.",Boolean(error));
  } catch(e) { notice(e.message || "No se pudo enviar el correo.",true); }
  finally {btn.disabled=false;}
});
el("recheck").addEventListener("click",verifyAdmin);
document.querySelectorAll(".logout").forEach(x=>x.addEventListener("click",async()=>{await sb.auth.signOut();notice("Sesión cerrada.");show("login");}));
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
async function loadDocuments(){
 const {data,error}=await sb.from("portfolio_cv_documents").select("*").order("created_at",{ascending:false}).limit(200);
 const target=el("documents");target.replaceChildren();
 if(error){target.textContent=error.message;return;}
 documents=data||[];
 if(!documents.length){target.textContent="Todavía no hay CV cargados.";return;}
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
   portal.style.cssText="display:inline-flex;align-items:center;border:1px solid #d3d3d3;padding:7px 9px;border-radius:4px;color:#191919;text-decoration:none;font-size:13px";
   actions.append(portal);
   const availableActions=[["download","Ver CV"],["edit","Editar vacante"],["toggle",x.is_active?"Desactivar":"Activar"],["delete","Eliminar"]];
   if(!x.is_main) availableActions.splice(2,0,["main","Marcar principal"]);
   for(const [action,label] of availableActions){
     const b=node("button",label);b.type="button";b.dataset.id=x.id;b.dataset.action=action;actions.append(b);
   }
   box.append(actions);target.append(box);
 }
}
el("reloadDocuments").addEventListener("click",loadDocuments);
el("documents").addEventListener("change", async e => {
  const control=e.target.closest("select[data-status-id]");
  if(!control || !isAdmin) return;
  const id=control.dataset.statusId;
  const selected=control.value;
  if(!["preparado","postulado","en_proceso","finalizado"].includes(selected))return;
  control.disabled=true;
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
  const file=el("pdf").files[0],ruc=el("ruc").value.trim();
  if(!file||!/^[0-9]{11}$/.test(ruc)||!file.name.toLowerCase().endsWith(".pdf")||file.size>30*1024*1024){notice("Revisá RUC y PDF (máximo 30 MB).",true);return;}
  const main=el("principal").checked;const expiry=el("expires").value;
  const path=ruc+"/"+crypto.randomUUID()+".pdf";const btn=el("uploadButton");btn.disabled=true;
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
    notice("CV guardado. Ya estará disponible por RUC si está activo y vigente.");await loadDocuments();
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
      const newName=prompt("Nombre de la vacante o puesto",x.role_name);
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
      if(!confirm("¿Eliminar definitivamente este CV y su archivo?"))return;
      const a=await sb.storage.from(bucket).remove([x.storage_path]);if(a.error)throw a.error;
      const b=await sb.from("portfolio_cv_documents").delete().eq("id",x.id);if(b.error)throw b.error;
      notice("CV eliminado.");await loadDocuments();
    }
  }catch(err){notice(err.message,true);}finally{btn.disabled=false;}
});
const leadFieldLabels = {
  position:"Puesto o cargo",dedication:"Dedicación",hours:"Cantidad de horas",
  hours_period:"Período",work_mode:"Modalidad de trabajo",
  work_country:"País",work_city:"Ciudad",work_district:"Distrito o zona",
  work_days:"Días de trabajo",office_days:"Días presenciales",
  timezone:"Zona horaria",schedule_tbd:"Horario por definir",daily_start:"Hora de inicio",
  daily_end:"Hora de finalización",start_date:"Fecha de inicio",salary:"Remuneración",
  responsibilities:"Responsabilidades",
  project_name:"Proyecto",project_area:"Área de proyecto",problem:"Necesidad o problema",
  outcome:"Resultado esperado",deliverables:"Entregables",
  due_date:"Fecha objetivo",deadline_tbd:"Fecha por definir",
  budget:"Presupuesto",reference_url:"Enlace al brief",
  project_need:"Qué necesita resolver",project_timing:"Cuándo lo necesita"
};
const leadFieldValues = {
  full_time:"Full Time",part_time:"Part Time",por_horas:"Por horas",
  remoto:"Remoto",presencial:"Presencial",hibrido:"Híbrido",
  semana:"Por semana",mes:"Por mes",total:"En total",
  marketing:"Marketing",tecnologia_ia:"Tecnología e IA",datos:"Datos",
  diseno:"Diseño",otro:"Otro / Necesita asesoramiento",
  mas_clientes:"Conseguir más clientes",marketing_contenido:"Mejorar marketing y contenido",
  automatizacion_ia:"Automatización e IA",solucion_digital:"Crear una solución digital",
  urgente:"Urgente",este_mes:"Este mes",mas_adelante:"Más adelante",a_definir:"A definir"
};
function leadValue(v){
  if(Array.isArray(v))return v.length?v.map(x=>leadFieldValues[x]||x).join(", "):"";
  if(v===true)return "Sí";if(v===false)return "No";
  if(v===null||v===undefined||v==="")return "";
  return leadFieldValues[v]||String(v);
}
async function loadLeads(){
  const {data,error}=await sb.from("portfolio_cv_leads").select("*").order("created_at",{ascending:false}).limit(150);
  const target=el("leads");target.replaceChildren();
  if(error){target.textContent=error.message;return;}
  if(!data?.length){target.textContent="Todavía no hay solicitudes.";return;}
  for(const x of data){
    const box=node("article",undefined,"item");
    const kind={solicitud_cv:"Solicitud anterior de CV",in_house:"Contratación In-house",proyecto:"Contratación por proyecto"}[x.kind]||x.kind;
    box.append(node("strong",kind+" · "+x.company_name),node("small",
      (x.contact_name||"")+" · "+x.email+" · "+(x.phone||"Sin teléfono")+
      " · RUC "+(x.ruc||"Sin RUC")+" · "+new Date(x.created_at).toLocaleString("es-PE")));
    if(x.position_or_project)box.append(node("small","Vacante/proyecto: "+x.position_or_project));

    if(x.intake_version>=2){
      const pref=x.contact_preference==="contactame"
        ? "Solicita contacto de Christian"
        : x.contact_preference==="empresa_contacta"
          ? "La empresa se comunicará por su cuenta"
          : "Sin preferencia registrada";
      const methods={whatsapp:"WhatsApp",llamada:"Llamada",email:"E-mail"};
      const times={manana:"Mañana",tarde:"Tarde",indistinto:"Indistinto"};
      const when=x.contact_method
        ? " · Medio: "+(methods[x.contact_method]||x.contact_method)
          +(x.contact_time?" · Horario: "+(times[x.contact_time]||x.contact_time):"") : "";
      box.append(node("small","Contacto: "+pref+when));
      if(x.observations)box.append(node("p","Observaciones: "+x.observations));
      const detail=node("details");
      const summary=node("summary","Ver condiciones de la propuesta");
      summary.style.cssText="font-size:13px;cursor:pointer;padding:9px 0;font-weight:700";
      detail.append(summary);
      const dl=node("dl",undefined,"leadData");
      const intake=x.intake_data&&typeof x.intake_data==="object"?x.intake_data:{};
      for(const [key,value] of Object.entries(intake)){
        const label=leadFieldLabels[key],formatted=leadValue(value);
        if(!label||!formatted)continue;
        const item=node("div",undefined,"leadDataRow");
        item.append(node("dt",label),node("dd",formatted));
        dl.append(item);
      }
      detail.append(dl);box.append(detail);
    }else if(x.details){
      box.append(node("p",x.details));
    }

    const row=node("div",undefined,"row");
    const stateLabel=node("label","Seguimiento:");
    stateLabel.style.margin="0";
    const state=node("select");
    state.setAttribute("aria-label","Estado de seguimiento de la solicitud de "+x.company_name);
    const states=[["nuevo","Nueva"],["contactado","Contactada"],["en_evaluacion","En evaluación"],["cerrado","Cerrada"]];
    for(const [value,label] of states){
      const option=node("option",label);option.value=value;state.append(option);
    }
    state.value=x.status||"nuevo";
    state.style.width="auto";state.style.minWidth="160px";
    state.addEventListener("change",async()=>{
      state.disabled=true;
      const {error}=await sb.from("portfolio_cv_leads").update({status:state.value}).eq("id",x.id);
      if(error){notice("No se pudo actualizar: "+error.message,true);await loadLeads();}
      else{notice("Seguimiento actualizado.");await loadLeads();}
    });
    row.append(stateLabel,state);box.append(row);target.append(box);
  }
}
el("reloadLeads").addEventListener("click",loadLeads);
verifyAdmin().catch(e=>notice(e.message,true));