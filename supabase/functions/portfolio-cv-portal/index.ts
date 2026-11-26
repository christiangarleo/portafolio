import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(PROJECT_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const trustedOrigins = new Set(["https://christianarleo.com", "https://www.christianarleo.com"]);
function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": trustedOrigins.has(origin) ? origin : "https://christianarleo.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}
function reply(req: Request, data: object, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}
// La columna histórica "ruc" almacena cualquier identificador empresarial.
const companyId = (v: unknown) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").toUpperCase() : "";
const validCompanyId = (id: string) => id.length >= 1 && id.length <= 64 &&
  /^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]*$/u.test(id);
const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
// Internal notifications: fixed recipient, no private CV or contact details in email.
type NotificationLead = { id: string; kind: string; company_name: string; created_at: string };
// Confirmation email: only for server-verified new submissions. No historical replay.
type ConfirmationLead = NotificationLead & { email: string; contact_name: string; language: string };
function confirmationPayload(lead: ConfirmationLead) {
  const en = lead.language === "en";
  const clean = (s: string, max: number) => String(s || "").replace(/[\r\n\t\u0000-\u001f\u007f]/g, " ").trim().slice(0,max);
  const esc = (s: string) => s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] || c));
  const name = clean(lead.contact_name,140);
  const company = clean(lead.company_name,160);
  // v3 may supply a synthetic contact name when the visitor omits their name.
  const greeting = !name || name === "Equipo de " + company.slice(0,120) ? (en ? "Hello:" : "Hola:") : (en ? "Hello, " : "Hola, ") + name + ":";
  const category = (en ? {solicitud_cv:"CV request",in_house:"in-house hiring",proyecto:"project-based hiring"} : {solicitud_cv:"solicitud de CV",in_house:"contratación In-house",proyecto:"contratación por proyecto"})[lead.kind] || (en ? "professional inquiry" : "contacto profesional");
  const subject = en ? "I received your request | Christian Gabriel Arleo" : "Recibí la solicitud | Christian Gabriel Arleo";
  const receipt = lead.kind === "solicitud_cv" ? (en ? "I received your CV request on behalf of " + company + "." : "Recibí correctamente tu solicitud de CV en representación de " + company + ".") : (en ? "I received your request for " + category + " on behalf of " + company + "." : "Recibí correctamente tu solicitud de " + category + " en representación de " + company + ".");
  const thanks = en ? "Thank you for contacting me and for your interest in my professional profile." : "Gracias por contactarme y por tu interés en mi perfil profesional.";
  const next = en ? "I will personally review your proposal and, depending on the nature of the opportunity, we will coordinate the next steps." : "Revisaré personalmente tu propuesta y, según las características de la oportunidad, coordinaremos los próximos pasos.";
  const before = en ? "In the meantime, you can continue exploring my portfolio at " : "Mientras tanto, podés seguir explorando mi portafolio en ";
  const after = en ? " and share it if you wish." : " y compartirlo si gusta.";
  const regards = en ? "Kind regards," : "Saludos cordiales,";
  const role = en ? "Marketing 360 | Growth | Commercial Strategy | Applied AI" : "Marketing 360 | Growth | Estrategia Comercial | IA aplicada";
  const note = en ? "This message automatically confirms receipt of your request." : "Este mensaje confirma automáticamente la recepción de tu solicitud.";
  const portfolio = "https://christianarleo.com/portafolio/?lang=" + (en ? "en" : "es");
  const whatsapp = "https://wa.me/51902163225?text=Hola%2C%20Christian.%20Vi%20tu%20portafolio%20y%20quisiera%20contactarte.";
  const linkedin = "https://www.linkedin.com/in/christianarleo/";
  const link = (url: string,label: string) => '<a href="'+esc(url)+'" style="color:#0000bb;text-decoration:underline">'+esc(label)+'</a>';
  const colors = ["#DF3E89","#E14682","#E24E7B","#E45573","#E55D6C","#E76565","#E86D5E","#EA7557","#EB7C4F","#ED8448","#EE8C41","#F0943A","#F19B32","#F3A32B","#F4AB24","#F6B31D","#F7BB16","#F9C20E","#FACA07","#FCD200"];
  const gradient = colors.map(c=>'<td bgcolor="'+c+'" width="5%" height="2" style="height:2px;font-size:0;line-height:2px;">&nbsp;</td>').join("");
  const paragraph = (s: string) => '<p style="margin:0 0 16px">'+esc(s)+'</p>';
  const html = '<!doctype html><html lang="'+(en?"en":"es")+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>:root{color-scheme:light dark;supported-color-schemes:light dark}@media(prefers-color-scheme:dark){.email-text,.signature-name{color:#ededed!important}.signature-role,.auto-note{color:#b7b7b7!important}a{color:#b9b9ff!important}}</style></head><body><div class="email-text" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#161616;overflow-wrap:break-word;">'
    + [greeting,thanks,receipt,next].map(paragraph).join("")
    + '<p style="margin:0 0 16px">'+esc(before)+link("https://christianarleo.com/","christianarleo.com")+esc(after)+'</p>'
    + '<p style="margin:0 0 28px">'+esc(regards)+'</p>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="500" style="width:100%;max-width:500px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;"><tr><td class="signature-name" style="font-size:23px;font-weight:400;color:#161616;line-height:1.3;padding:0 0 10px">Christian Gabriel Arleo</td></tr><tr><td style="padding:0 0 6px"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:linear-gradient(90deg,#DF3E89,#FCD200);"><tr>'+gradient+'</tr></table></td></tr>'
    + '<tr><td class="signature-role" style="font-size:15px;line-height:1.45;color:#666666;padding:0">'+esc(role)+'</td></tr><tr><td style="font-size:15px;line-height:1.6;padding:0">'+link(whatsapp,"WhatsApp")+" | "+link(linkedin,"LinkedIn")+" | "+link(portfolio,en?"Professional portfolio":"Portafolio profesional")+'</td></tr><tr><td style="font-size:15px;line-height:1.6;padding:0">'+link("mailto:hola@christianarleo.com","hola@christianarleo.com")+'</td></tr></table><p class="auto-note" style="font-size:12px;line-height:1.5;color:#666666;font-style:italic;margin:28px 0 0">'+esc(note)+'</p></div></body></html>';
  const plain = [greeting,thanks,receipt,next,before+"christianarleo.com"+after,regards,"Christian Gabriel Arleo\n"+role+"\nWhatsApp: "+whatsapp+"\nLinkedIn: "+linkedin+"\n"+portfolio+"\nhola@christianarleo.com",note].join("\n\n");
  // Keep the private mailbox out of this public repository. Never duplicate To in BCC.
  const personal=(Deno.env.get("PORTFOLIO_PERSONAL_BCC_EMAIL")||"").trim().toLowerCase();
  const validAddress=(value:string)=>/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
  const bcc=[...new Set(["hola@christianarleo.com",personal].filter(value=>validAddress(value)&&value!==lead.email.trim().toLowerCase()))];
  // Root-domain sender requires verified domain and a compatible Resend API key.
  const fromAddress=Deno.env.get("PORTFOLIO_FROM_EMAIL")==="hola@christianarleo.com"
    ?"hola@christianarleo.com":"alertas@notificaciones.christianarleo.com";
  return {from:"Christian Gabriel Arleo <"+fromAddress+">",to:[lead.email],...(bcc.length?{bcc}:{}),reply_to:"hola@christianarleo.com",subject,html,text:plain};
}
async function notifyRequester(lead: ConfirmationLead): Promise<void> {
  const id = lead.id;
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(lead.email)) { console.warn("lead_confirmation_skipped",id,"invalid_recipient"); return; }
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.error("lead_confirmation_failed",id,"missing_secret"); return; }
  // Count persisted submissions in the rolling window; fail closed on query error.
  const {count,error} = await supabase.from("portfolio_cv_leads").select("id",{count:"exact",head:true}).eq("email",lead.email).gte("created_at",new Date(Date.now()-24*60*60*1000).toISOString());
  if(error || count === null || count > 2) { console.warn("lead_confirmation_skipped",id,error?"rate_check_error":"recipient_rate_limit"); return; }
  const body = JSON.stringify(confirmationPayload(lead));
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const res = await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"portfolio-confirmation/"+id},body,signal:AbortSignal.timeout(8000)});
      if(res.ok){
        const accepted=await res.json().catch(()=>null);
        if(typeof accepted?.id==="string"&&accepted.id){console.log("lead_confirmation_accepted",id,accepted.id,attempt);return;}
      }else{
        console.warn("lead_confirmation_http",id,attempt,res.status);
        if(res.status!==408&&res.status!==429&&res.status<500){console.error("lead_confirmation_failed",id,"permanent_http",res.status);return;}
      }
    }catch{console.warn("lead_confirmation_retry",id,attempt,"network_or_timeout");}
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*1000));
  }
  console.error("lead_confirmation_failed",id,"retry_exhausted");
}


type SecurityResult = "verified" | "required" | "unavailable" | "legacy";
async function verifyTurnstile(input: Record<string, unknown>,expectedAction="portfolio_lead"): Promise<SecurityResult> {
  // During rollout cached clients may save leads, but no unverified submission may send mail.
  if (input.turnstile_token === undefined) return "legacy";
  const token=input.turnstile_token;
  if(typeof token!=="string"||!token||token.length>2048)return "required";
  const secret=Deno.env.get("TURNSTILE_SECRET_KEY");
  if(!secret){console.error("lead_security_unavailable","missing_secret");return "unavailable";}
  try{
    const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
      method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:"secret="+encodeURIComponent(secret)+"&response="+encodeURIComponent(token),signal:AbortSignal.timeout(8000)
    });
    if(!response.ok){console.error("lead_security_unavailable","http",response.status);return "unavailable";}
    const result=await response.json();
    if(result?.success===true && ["christianarleo.com","www.christianarleo.com"].includes(result.hostname) && result.action===expectedAction)return "verified";
    const codes=Array.isArray(result?.["error-codes"])?result["error-codes"]:[];
    if(codes.some((c: string)=>["missing-input-secret","invalid-input-secret","internal-error"].includes(c))){console.error("lead_security_unavailable","provider_config");return "unavailable";}
    console.warn("lead_security_rejected","invalid_challenge");return "required";
  }catch{console.error("lead_security_unavailable","network_or_parse");return "unavailable";}
}
async function dispatchLeadNotifications(lead: ConfirmationLead,security: SecurityResult) {
  if(security!=="verified"){console.warn("lead_notifications_skipped",lead.id,"legacy_unverified");return;}
  const now=Date.now();
  const [daily,burst]=await Promise.all([
    supabase.from("portfolio_cv_leads").select("id",{count:"exact",head:true}).gte("created_at",new Date(now-86400000).toISOString()),
    supabase.from("portfolio_cv_leads").select("id",{count:"exact",head:true}).gte("created_at",new Date(now-900000).toISOString())
  ]);
  if(daily.error||burst.error||daily.count===null||burst.count===null||daily.count>30||burst.count>8){
    console.warn("lead_notifications_skipped",lead.id,daily.error||burst.error?"rate_check_error":"global_rate_limit");return;
  }
  await notifyRequester(lead).catch(()=>console.error("lead_confirmation_failed",lead.id,"unexpected"));
}
function scheduleLeadNotification(lead: ConfirmationLead,security: SecurityResult) {
  if (!lead?.id) { console.error("lead_notification_failed", "missing_lead_id"); return; }
  try {EdgeRuntime.waitUntil(dispatchLeadNotifications(lead,security).catch(()=>console.error("lead_notifications_failed",lead.id,"unexpected")));}
  catch {console.error("lead_notification_failed",lead.id,"schedule_error");}
}


// Tracking grants are separate from admin Auth. They are signed, short-lived and only emailed
// to a mailbox already associated with the exact company identifier. No public lead lookup.
const trackingUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const trackingEmail=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const trackingEncoder=new TextEncoder();
async function trackingKey(){
  const secret=Deno.env.get("PORTFOLIO_TRACKING_SECRET")||"";
  if(secret.length<32)throw Error("tracking_not_configured");
  return crypto.subtle.importKey("raw",trackingEncoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
const toHex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
async function trackingSignature(value:string){
  return toHex(await crypto.subtle.sign("HMAC",await trackingKey(),trackingEncoder.encode(value)));
}
async function trackingScope(identifier:string,email:string){
  return trackingSignature("company-tracking-scope-v1:"+JSON.stringify([identifier,email]));
}
async function createTrackingToken(id:string,identifier:string,email:string){
  if(!trackingUUID.test(id))throw Error("invalid_anchor");
  const data=id+"."+String(Math.floor(Date.now()/1000)+3600)+"."+await trackingScope(identifier,email);
  return data+"."+await trackingSignature("company-tracking-v1:"+data);
}
async function verifyTrackingToken(token:string){
  const [id,expires,scope,signature,...extra]=token.split(".");
  if(extra.length||!trackingUUID.test(id||"")||!/^\d{10}$/.test(expires||"")||! /^[a-f0-9]{64}$/.test(scope||"")||! /^[a-f0-9]{64}$/.test(signature||""))return null;
  const expiry=Number(expires),now=Math.floor(Date.now()/1000);
  if(expiry<=now||expiry>now+3600)return null;
  const bytes=Uint8Array.from(signature.match(/../g)!,x=>parseInt(x,16));
  return await crypto.subtle.verify("HMAC",await trackingKey(),bytes,trackingEncoder.encode("company-tracking-v1:"+id+"."+expires+"."+scope))?{id,scope}:null;
}
async function sendTrackingLink(identifier:string,email:string,language:string){
  const {data,error}=await supabase.from("portfolio_cv_leads").select("id").eq("ruc",identifier).eq("email",email).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error||!data?.id)return;
  const token=await createTrackingToken(data.id,identifier,email);
  const url=new URL("https://christianarleo.com/empresa/");
  url.searchParams.set("ruc",identifier);url.searchParams.set("lang",language);
  url.hash=new URLSearchParams({seguimiento:token}).toString();
  const en=language==="en";
  const from=Deno.env.get("PORTFOLIO_FROM_EMAIL")==="hola@christianarleo.com"?"hola@christianarleo.com":"alertas@notificaciones.christianarleo.com";
  const key=Deno.env.get("RESEND_API_KEY");
  if(!key)throw Error("tracking_mail_unavailable");
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({
    from:"Christian Gabriel Arleo <"+from+">",to:[email],reply_to:"hola@christianarleo.com",
    subject:en?"Private access to your requests":"Acceso privado a tus solicitudes",
    text:(en?"Use this private link to view your requests. It expires in one hour. Do not share it. If you did not request it, ignore this email.":"Usá este enlace privado para consultar tus solicitudes. Vence en una hora. No lo compartas. Si no lo solicitaste, ignorá este correo.")+"\n\n"+url.toString()
  }),signal:AbortSignal.timeout(8000)});
  if(!response.ok)console.warn("tracking_mail_failed",response.status);
}
function trackingPublicState(row:Record<string,unknown>){
  // Do not disclose a rejection or internal reason before a response is communicated.
  if(row.email_sent_at||row.whatsapp_sent_at||row.rejection_confirmed===true)return row.status==="cerrado"?"closed":"responded";
  return row.decision_status==="avanzar"?"reviewing":"received";
}
function trackingPublicRow(row:Record<string,unknown>){
  const intake=row.intake_data&&typeof row.intake_data==="object"?row.intake_data as Record<string,unknown>:{};
  const pick=(key:string,values:string[])=>typeof intake[key]==="string"&&values.includes(intake[key] as string)?intake[key]:undefined;
  return {kind:row.kind,position:row.position_or_project,created_at:row.created_at,state:trackingPublicState(row),
    dedication:pick("dedication",["full_time","part_time","por_horas"]),
    work_mode:pick("work_mode",["remoto","presencial","hibrido"]),
    project_need:pick("project_need",["mas_clientes","marketing_contenido","automatizacion_ia","solucion_digital","otro"]),
    project_timing:pick("project_timing",["urgente","este_mes","mas_adelante","a_definir"])};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return reply(req, { error: "Metodo no permitido" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !trustedOrigins.has(origin)) return reply(req, { error: "Origen no permitido" }, 403);
  const length = Number(req.headers.get("content-length") || "0");
  if (length > 10000) return reply(req, { error: "Solicitud demasiado grande" }, 413);
  let input: Record<string, unknown>;
  try { input = await req.json(); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); }
  catch { return reply(req, { error: "Solicitud invalida" }, 400); }
  if(input.action==="tracking_access"){
    const identifier=companyId(input.ruc),email=text(input.email,200).toLowerCase(),language=input.language==="en"?"en":"es";
    if(!validCompanyId(identifier)||!trackingEmail.test(email))return reply(req,{error:"Solicitud inválida"},400);
    const security=await verifyTurnstile(input,"portfolio_tracking");
    if(security!=="verified")return reply(req,{error:"Verificación requerida",code:security==="unavailable"?"security_unavailable":"security_required"},security==="unavailable"?503:400);
    try{
      if(!Deno.env.get("RESEND_API_KEY"))throw Error("tracking_mail_unavailable");
      const recipientKey=await trackingSignature("company-tracking-rate-v1:"+email);
      // Atomic rate budget; deny by default if the dedicated server-only RPC is absent.
      const {data:reserved,error}=await supabase.rpc("portfolio_tracking_access_reserve",{recipient_key:recipientKey});
      if(error||typeof reserved!=="boolean")throw Error("tracking_rate_unavailable");
      if(reserved)EdgeRuntime.waitUntil(sendTrackingLink(identifier,email,language).catch(()=>console.warn("tracking_mail_failed")));
      // Identical public response for unknown email, unknown company, and exhausted quota.
      return reply(req,{status:"accepted"});
    }catch{return reply(req,{error:"Servicio temporalmente no disponible"},503);}
  }
  if(input.action==="tracking_list"){
    const identifier=companyId(input.ruc),token=text(input.token,180);
    if(!validCompanyId(identifier))return reply(req,{error:"Acceso privado inválido"},403);
    try{
      const grant=await verifyTrackingToken(token);
      if(!grant)return reply(req,{error:"Acceso privado inválido"},403);
      const {data:anchor,error:anchorError}=await supabase.from("portfolio_cv_leads").select("ruc,email").eq("id",grant.id).maybeSingle();
      if(anchorError)throw Error("tracking_lookup");
      if(!anchor||anchor.ruc!==identifier||!trackingEmail.test(anchor.email||"")||grant.scope!==await trackingScope(anchor.ruc,anchor.email))return reply(req,{error:"Acceso privado inválido"},403);
      const {data,error}=await supabase.from("portfolio_cv_leads").select("id,kind,position_or_project,created_at,decision_status,status,email_sent_at,whatsapp_sent_at,intake_data").eq("ruc",identifier).eq("email",anchor.email).order("created_at",{ascending:false}).limit(101);
      if(error)throw Error("tracking_lookup");
      const rows=data||[],visible=rows.slice(0,100);
      const rejected=visible.filter(row=>row.decision_status==="rechazada").map(row=>row.id);
      const confirmed=new Set<string>();
      if(rejected.length){
        const {data:activity,error:activityError}=await supabase.from("portfolio_cv_lead_activities").select("lead_id,event_type").in("lead_id",rejected).in("event_type",["rechazo_correo_confirmado","rechazo_correo_confirmacion_retirada"]).order("created_at",{ascending:false}).limit(1000);
        if(!activityError){
          const seen=new Set<string>();
          for(const event of activity||[]){
            if(seen.has(event.lead_id))continue;seen.add(event.lead_id);
            if(event.event_type==="rechazo_correo_confirmado")confirmed.add(event.lead_id);
          }
        }
      }
      return reply(req,{status:"verified",requests:visible.map(row=>trackingPublicRow({...row,rejection_confirmed:confirmed.has(row.id)})),truncated:rows.length>100});
    }catch{return reply(req,{error:"Servicio temporalmente no disponible"},503);}
  }
  // El identificador de empresa es público y NO autentica al reclutador.
  // El campo ruc conserva su nombre por compatibilidad con versiones anteriores.
  // No exponer el estado interno de las postulaciones en este portal.
  const cvSelect = "id,company_name,role_name,storage_path,original_filename,expires_at,is_main";
  async function signedLink(row: { storage_path: string; original_filename: string }) {
    const { data, error } = await supabase.storage.from("cv-personalizados")
      .createSignedUrl(row.storage_path, 90, { download: row.original_filename });
    if (error || !data?.signedUrl) throw Error(error?.message || "Signed URL missing");
    return data.signedUrl;
  }
  if (input.action === "resolve") {
    const identifier = companyId(input.ruc);
    if (!validCompanyId(identifier)) return reply(req, { error: "Ingresá un identificador de empresa válido (hasta 64 caracteres)." }, 400);
    const { data, error } = await supabase.from("portfolio_cv_documents")
      .select(cvSelect)
      .eq("ruc", identifier).eq("is_active", true)
      .order("is_main", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) { console.error("cv_lookup", error.message); return reply(req, { error: "Error temporal de consulta" }, 503); }
    const now = Date.now();
    const rows = data || [];
    // El portal existe para cada empresa con CV registrados, incluso si hay uno solo.
    // También muestra vencidos como historial, sin permitir descargarlos.
    if (!rows.length) return reply(req, { status: "not_found" });
    const items = rows.map((row: any) => ({
      id: row.id, position: row.role_name, expires_at: row.expires_at,
      available: !row.expires_at || new Date(row.expires_at).getTime() > now
    })).sort((a: any,b: any) => Number(b.available) - Number(a.available));
    return reply(req, { status: "company", company: rows[0].company_name, items });
  }
  if (input.action === "download") {
    const id = text(input.id, 50);
    const identifier = companyId(input.ruc);
    if (!validCompanyId(identifier) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return reply(req, { error: "Solicitud invalida" }, 400);
    const { data: row, error } = await supabase.from("portfolio_cv_documents")
      .select(cvSelect).eq("id", id).eq("ruc", identifier).eq("is_active", true).maybeSingle();
    if (error) { console.error("cv_download_lookup",error.message); return reply(req,{ error:"No se pudo consultar el archivo" },503); }
    if (!row || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()))
      return reply(req,{ error:"Este CV ya no está disponible" },404);
    try {
      const url = await signedLink(row);
      return reply(req, { status:"ready", url, company:row.company_name, position:row.role_name });
    } catch (error) {
      console.error("cv_download_sign",String(error));
      return reply(req,{ error:"No se pudo preparar el archivo" },503);
    }
  }
  // Formulario breve por buyer persona. La v2 se conserva para sesiones cacheadas.
  if (input.action === "lead_v3") {
    if (text(input.website, 100)) return reply(req, { status: "received" });
    const kind = text(input.kind, 25);
    const language = text(input.language, 2) === "en" ? "en" : "es";
    const company = text(input.company_name, 160);
    const ruc = companyId(input.ruc);
    const email = text(input.email, 200).toLowerCase();
    const contactName = text(input.contact_name, 140);
    const phone = text(input.phone, 65);
    const preference = text(input.contact_preference, 30);
    const method = text(input.contact_method, 25);
    const observations = text(input.observations, 1000);
    const data = input.intake;
    const values = data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown> : null;
    const pick = (k: string, n: number) => text(values?.[k], n);
    const bad = () => reply(req, { error: "Revisá los campos obligatorios antes de enviar." }, 400);
    if (!["in_house","proyecto"].includes(kind) || !validCompanyId(ruc) || company.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !values ||
      !["contactame","empresa_contacta"].includes(preference) ||
      (preference === "contactame" && (!["email","whatsapp","llamada"].includes(method) ||
        ((method === "whatsapp" || method === "llamada") && phone.length < 6))) ||
      (preference === "empresa_contacta" && method !== ""))
      return bad();
    let position = "";
    const intake: Record<string, string> = {};
    if (kind === "in_house") {
      position = pick("position", 180);
      const dedication = pick("dedication", 20);
      const workMode = pick("work_mode", 20);
      if (!position || !["full_time","part_time","por_horas"].includes(dedication) ||
        !["remoto","presencial","hibrido"].includes(workMode)) return bad();
      Object.assign(intake, { position, dedication, work_mode: workMode });
    } else {
      const need = pick("project_need", 30);
      const timing = pick("project_timing", 20);
      if (!["mas_clientes","marketing_contenido","automatizacion_ia","solucion_digital","otro"].includes(need) ||
        !["urgente","este_mes","mas_adelante","a_definir"].includes(timing)) return bad();
      Object.assign(intake, { project_need: need, project_timing: timing });
      position = {
        mas_clientes:"Conseguir más clientes", marketing_contenido:"Mejorar marketing y contenido",
        automatizacion_ia:"Automatización e IA", solucion_digital:"Solución digital",
        otro:"Otro proyecto / asesoramiento"
      }[need] || "Propuesta de proyecto";
    }
    const security=await verifyTurnstile(input);
    if(security==="required")return reply(req,{error:"No se pudo verificar la seguridad. Reintentá la verificación.",code:"security_required"},400);
    if(security==="unavailable")return reply(req,{error:"La verificación no está disponible temporalmente.",code:"security_unavailable"},503);
    const { data: savedLead, error } = await supabase.from("portfolio_cv_leads").insert({
      kind, company_name: company, ruc, contact_name: contactName || "Equipo de " + company.slice(0, 120),
      email, phone: phone || null, position_or_project: position,
      details: observations,
      contact_preference: preference,
      contact_method: preference === "contactame" ? method : null,
      contact_time: null,
      observations: observations || null,
      intake_data: intake, intake_version: 3, language
    }).select("id,kind,company_name,created_at,email,contact_name,language").single();
    if (error) { console.error("lead_v3_insert", error.message); return reply(req, { error: "No se pudo registrar la propuesta." }, 503); }
    scheduleLeadNotification(savedLead as ConfirmationLead,security);
    return reply(req, { status: "received",receipt:{kind,position,created_at:savedLead.created_at,state:"received",dedication:intake.dedication,work_mode:intake.work_mode,project_need:intake.project_need,project_timing:intake.project_timing} });
  }
  if (input.action === "lead_v2") {
    if (text(input.website, 300)) return reply(req, { status: "received" });
    const kind = text(input.kind, 25);
    const company = text(input.company_name, 160);
    const ruc = companyId(input.ruc);
    const name = text(input.contact_name, 140);
    const email = text(input.email, 200).toLowerCase();
    const phone = text(input.phone, 65);
    const contactPreference = text(input.contact_preference, 30);
    const contactMethod = text(input.contact_method, 30);
    const contactTime = text(input.contact_time, 30);
    const observations = text(input.observations, 1000);
    const data = input.intake;
    const obj = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const inList = (value: string, vals: string[]) => vals.includes(value);
    const whenDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T12:00:00Z").getTime());
    const daysValid = (val: unknown) => Array.isArray(val) && val.length <= 7 && val.every(x => typeof x === "string" &&
      ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"].includes(x)) && new Set(val).size === val.length;
    const clean = (key: string, max: number) => text(obj?.[key], max);
    const invalid = () => reply(req, { error: "Revisá los campos obligatorios y las condiciones seleccionadas." }, 400);
    if (!inList(kind, ["in_house","proyecto"]) || !validCompanyId(ruc) || company.length < 2 || name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !obj ||
      !inList(contactPreference, ["contactame","empresa_contacta"]) ||
      (contactPreference === "contactame" &&
        (!inList(contactMethod, ["whatsapp","llamada","email"]) ||
        ((contactMethod === "whatsapp" || contactMethod === "llamada") && phone.length < 6))) ||
      (contactPreference === "empresa_contacta" && (contactMethod !== "" || contactTime !== "")) ||
      !inList(contactTime, ["","manana","tarde","indistinto"]))
      return invalid();

    const workMode = clean("work_mode", 25);
    if (!inList(workMode, ["remoto","presencial","hibrido"])) return invalid();
    const needsLocation = workMode !== "remoto";
    const workCountry = clean("work_country", 80);
    const workCity = clean("work_city", 100);
    const workDistrict = clean("work_district", 100);
    if (needsLocation && (!workCountry || !workCity || !workDistrict)) return invalid();
    const intake: Record<string, unknown> = {
      work_mode: workMode,
      work_country: needsLocation ? workCountry : "",
      work_city: needsLocation ? workCity : "",
      work_district: needsLocation ? workDistrict : ""
    };
    let position = "";
    if (kind === "in_house") {
      position = clean("position", 180);
      const dedication = clean("dedication", 30);
      const hoursRequired = dedication === "part_time" || dedication === "por_horas";
      const hours = obj.hours;
      const hoursPeriod = clean("hours_period", 15);
      const workDays = obj.work_days;
      const officeDays = obj.office_days;
      const timezone = clean("timezone", 50);
      const scheduleTbd = obj.schedule_tbd === true;
      const start = clean("daily_start", 5), end = clean("daily_end", 5);
      const responsibilities = clean("responsibilities", 1500);
      const startDate = clean("start_date", 15);
      if (!position || !inList(dedication, ["full_time","part_time","por_horas"]) ||
        (hoursRequired && (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 240 ||
          !inList(hoursPeriod, ["semana","mes","total"]))) ||
        !daysValid(workDays) || !(workDays as string[]).length || !daysValid(officeDays) ||
        (workMode === "hibrido" && !(officeDays as string[]).length) ||
        !inList(timezone, ["America/Lima","America/Bogota","America/Mexico_City","America/Santiago","America/Argentina/Buenos_Aires","UTC"]) ||
        (!scheduleTbd && (!/^\d\d:\d\d$/.test(start) || !/^\d\d:\d\d$/.test(end))) ||
        !responsibilities || !whenDate(startDate))
        return invalid();
      Object.assign(intake, {
        position, dedication, hours: hoursRequired ? hours : null,
        hours_period: hoursRequired ? hoursPeriod : "",
        work_days: workDays, office_days: workMode === "hibrido" ? officeDays : [],
        timezone, schedule_tbd: scheduleTbd,
        daily_start: scheduleTbd ? "" : start, daily_end: scheduleTbd ? "" : end,
        start_date: startDate, salary: clean("salary",100),
        responsibilities
      });
    } else {
      position = clean("project_name", 180);
      const area = clean("project_area", 30);
      const problem = clean("problem", 1800);
      const outcome = clean("outcome", 1200);
      const deliverables = clean("deliverables",1000);
      const startDate = clean("start_date", 15);
      const deadlineTbd = obj.deadline_tbd === true;
      const due = clean("due_date", 15);
      const ref = clean("reference_url", 400);
      if (!position || !inList(area, ["marketing","tecnologia_ia","datos","diseno","otro"]) ||
        !problem || !outcome || !whenDate(startDate) ||
        (!deadlineTbd && (!due || !whenDate(due))) ||
        (ref && !/^https?:\/\/[^\s]+$/i.test(ref)))
        return invalid();
      Object.assign(intake, {
        project_name: position, project_area: area, problem, outcome, deliverables,
        start_date: startDate, deadline_tbd: deadlineTbd, due_date: deadlineTbd ? "" : due,
        budget: clean("budget",100), reference_url: ref
      });
    }

    // Datos enviados por los formularios nuevos: se mantienen estructurados
    // sin romper registros históricos del endpoint "lead" anterior.
    const security=await verifyTurnstile(input);
    if(security==="required")return reply(req,{error:"No se pudo verificar la seguridad. Reintentá la verificación.",code:"security_required"},400);
    if(security==="unavailable")return reply(req,{error:"La verificación no está disponible temporalmente.",code:"security_unavailable"},503);
    const { data: savedLead, error } = await supabase.from("portfolio_cv_leads").insert({
      kind, company_name: company, ruc, contact_name: name, email,
      phone: phone || null, position_or_project: position,
      details: kind === "in_house" ? String(intake.responsibilities || "") : String(intake.problem || ""),
      contact_preference: contactPreference,
      contact_method: contactPreference === "contactame" ? contactMethod : null,
      contact_time: contactPreference === "contactame" ? contactTime || null : null,
      observations: observations || null,
      intake_data: intake, intake_version: 2
    }).select("id,kind,company_name,created_at,email,contact_name,language").single();
    if (error) {
      console.error("lead_v2_insert", error.message);
      return reply(req, { error: "No se pudo registrar la propuesta." }, 503);
    }
    scheduleLeadNotification(savedLead as ConfirmationLead,security);
    return reply(req, { status: "received" });
  }
  if (input.action === "lead") {
    // Simple honeypot for automated form submissions.
    if (text(input.website, 500)) return reply(req, { status: "received" });
    const kind = text(input.kind, 30);
    const company = text(input.company_name, 160);
    const name = text(input.contact_name, 140);
    const email = text(input.email, 200).toLowerCase();
    const ruc = companyId(input.ruc);
    if (!["solicitud_cv","in_house","proyecto"].includes(kind) || company.length < 2 ||
      name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (ruc && !validCompanyId(ruc))) {
      return reply(req, { error: "Revisa los datos obligatorios" }, 400);
    }
    const security=await verifyTurnstile(input);
    if(security==="required")return reply(req,{error:"No se pudo verificar la seguridad. Reintentá la verificación.",code:"security_required"},400);
    if(security==="unavailable")return reply(req,{error:"La verificación no está disponible temporalmente.",code:"security_unavailable"},503);
    const { data: savedLead, error } = await supabase.from("portfolio_cv_leads").insert({
      kind, company_name: company, contact_name: name, email, ruc: ruc || null,
      phone: text(input.phone, 65), position_or_project: text(input.position_or_project, 180),
      details: text(input.details, 1600)
    }).select("id,kind,company_name,created_at,email,contact_name,language").single();
    if (error) { console.error("cv_lead", error.message); return reply(req, { error: "No se pudo registrar la solicitud" }, 503); }
    scheduleLeadNotification(savedLead as ConfirmationLead,security);
    return reply(req, { status: "received" });
  }
  return reply(req, { error: "Accion invalida" }, 400);
});