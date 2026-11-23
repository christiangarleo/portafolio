import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";
const sb = createClient("https://gprhevdotoykofrxbufv.supabase.co", "sb_publishable_vTBBhrnC-kevNf9AJeZiyw_zGG4AB_I", { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const el=id=>document.getElementById(id);
const status=el("status");
function notice(msg,error=false){status.textContent=msg;status.dataset.error=String(error);status.hidden=false;}
const bucket="cv-personalizados";
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
  isAdmin=Boolean(found.data && !found.error);
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
  const {error}=await sb.auth.signUp({email,password});
  notice(error?error.message:"Cuenta solicitada. Verificá tu correo y luego autorizá la cuenta en Supabase.",Boolean(error));
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
   const actions=node("div",undefined,"itemActions");
   for(const [action,label] of [["download","Ver CV"],["main","Marcar principal"],["toggle",x.is_active?"Desactivar":"Activar"],["delete","Eliminar"]]){
     const b=node("button",label);b.type="button";b.dataset.id=x.id;b.dataset.action=action;actions.append(b);
   }
   box.append(actions);target.append(box);
 }
}
el("reloadDocuments").addEventListener("click",loadDocuments);
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
       expires_at:expiry?new Date(expiry).toISOString():null
    });
    if(added.error){await sb.storage.from(bucket).remove([path]);throw added.error;}
    e.target.reset();el("principal").checked=true;notice("CV guardado. Ya estará disponible por RUC si está activo y vigente.");await loadDocuments();
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
async function loadLeads(){
  const {data,error}=await sb.from("portfolio_cv_leads").select("*").order("created_at",{ascending:false}).limit(150);
  const target=el("leads");target.replaceChildren();
  if(error){target.textContent=error.message;return;}
  if(!data?.length){target.textContent="Todavía no hay solicitudes.";return;}
  for(const x of data){
    const box=node("article",undefined,"item");
    const kind={solicitud_cv:"Solicitud de CV",in_house:"In-house",proyecto:"Proyecto"}[x.kind]||x.kind;
    box.append(node("strong",kind+" · "+x.company_name),node("small",
      (x.contact_name||"")+" · "+x.email+" · "+(x.phone||"")+" · "+(x.ruc||"")+" · "+new Date(x.created_at).toLocaleString("es-PE")));
    if(x.position_or_project)box.append(node("small",x.position_or_project));
    if(x.details)box.append(node("p",x.details));
    const row=node("div",undefined,"row");const state=node("span",x.status,"pill");row.append(state);
    if(x.status==="nuevo"){
      const b=node("button","Marcar contactado");b.type="button";
      b.addEventListener("click",async()=>{
         b.disabled=true;const {error}=await sb.from("portfolio_cv_leads").update({status:"contactado"}).eq("id",x.id);
         if(error){notice(error.message,true);b.disabled=false;}else await loadLeads();
      });row.append(b);
    }
    box.append(row);target.append(box);
  }
}
el("reloadLeads").addEventListener("click",loadLeads);
verifyAdmin().catch(e=>notice(e.message,true));