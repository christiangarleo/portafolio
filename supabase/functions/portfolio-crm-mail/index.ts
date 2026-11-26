import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(["https://christianarleo.com","https://www.christianarleo.com"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const headers={"Access-Control-Allow-Origin":origins.has(origin)?origin:"https://christianarleo.com","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store","Content-Type":"application/json","Vary":"Origin"};
 const reply=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST"||(origin&&!origins.has(origin)))return reply(403,{status:"forbidden"});
 const token=req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return reply(401,{status:"unauthorized"});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user?.email)return reply(401,{status:"unauthorized"});
 const member=await db.from("portfolio_cv_admins").select("approved_email").eq("user_id",user.id).maybeSingle();
 if(member.error||!member.data||member.data.approved_email.toLowerCase()!==user.email.toLowerCase())return reply(403,{status:"forbidden"});
 const key=Deno.env.get("RESEND_API_KEY");
 // Never silently switch to an alternate From address.
 if(!key||Deno.env.get("PORTFOLIO_CRM_MAIL_ENABLED")!=="true")return reply(200,{status:"sender_not_configured"});
 let input;
 try{const raw=await req.text();if(raw.length>24000)return reply(413,{status:"invalid"});input=JSON.parse(raw);}catch{return reply(400,{status:"invalid"});}
 const id=input?.id,lead=input?.lead_id,subject=typeof input?.subject==="string"?input.subject.trim():"",body=typeof input?.body==="string"?input.body.trim():"",context=input?.context;
 if(typeof id!=="string"||typeof lead!=="string"||!uuid.test(id)||!uuid.test(lead)||!subject||subject.length>180||/[\r\n\x00]/.test(subject)||!body||body.length>5000||!["rejection","followup"].includes(context))return reply(400,{status:"invalid"});
 const reserve=await db.rpc("reserve_portfolio_crm_mail",{p_id:id,p_lead:lead,p_actor:user.id,p_subject:subject,p_body:body,p_context:context});
 if(reserve.error||!reserve.data)return reply(503,{status:"storage_unavailable"});
 if(reserve.data.status!=="reserved")return reply(200,{status:reserve.data.status});
 let status="uncertain",providerId:string|null=null;
 try{
   const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"portfolio-crm/"+id},body:JSON.stringify({from:"Christian Gabriel Arleo <hola@christianarleo.com>",to:[reserve.data.recipient],reply_to:"hola@christianarleo.com",subject,text:body}),signal:AbortSignal.timeout(10000)});
   if(r.ok){const result=await r.json().catch(()=>null);if(typeof result?.id==="string"&&result.id){status="accepted";providerId=result.id;}}
   else if(r.status>=400&&r.status<500&&![408,409,429].includes(r.status))status="failed";
 }catch{/* ambiguous outcome: never retry automatically */}
 const acceptedAt=status==="accepted"?new Date().toISOString():null;
 const result=await db.from("portfolio_crm_mail").update({status,provider_id:providerId,accepted_at:acceptedAt}).eq("id",id).eq("status","pending").select("id").maybeSingle();
 if(result.error||!result.data)return reply(503,{status:"uncertain"});
 if(status==="accepted"){
   // Authoritative history is portfolio_crm_mail; legacy indicators are best-effort.
   if(context==="followup")await db.from("portfolio_cv_leads").update({email_sent_at:acceptedAt,status:"contactado"}).eq("id",lead).eq("decision_status","avanzar");
   await db.from("portfolio_cv_lead_activities").insert({lead_id:lead,event_type:context==="rejection"?"rechazo_correo_confirmado":"correo_confirmado_enviado",details:{channel:"email",source:"crm_resend",message_id:id}});
 }
 return reply(200,{status});
});
