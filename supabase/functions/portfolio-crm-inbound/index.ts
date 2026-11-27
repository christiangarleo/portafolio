import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routePattern=/^reply-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@respuestas\.christianarleo\.com$/;
const enc=new TextEncoder();
const decode=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function validSignature(raw:Uint8Array,h:Headers,secret:string){
 const id=h.get("svix-id")||"",ts=h.get("svix-timestamp")||"",signatures=h.get("svix-signature")||"";
 if(!id||id.length>250||!/^[0-9]{10,12}$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300||!signatures||signatures.length>4096||!secret.startsWith("whsec_"))return false;
 try{
  const bytes=decode(secret.slice(6));if(bytes.length<16)return false;
  const key=await crypto.subtle.importKey("raw",bytes,{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  const prefix=enc.encode(id+"."+ts+".");
  const message=new Uint8Array(prefix.length+raw.length);message.set(prefix);message.set(raw,prefix.length);
  for(const s of signatures.split(/\s+/)){if(!s.startsWith("v1,"))continue;try{if(await crypto.subtle.verify("HMAC",key,decode(s.slice(3)),message))return true;}catch{}}
 }catch{}
 return false;
}
async function boundedBody(stream:ReadableStream<Uint8Array>|null,max:number){
 if(!stream)return new Uint8Array();
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw Error("size");}chunks.push(value);}}
 finally{reader.releaseLock();}
 const all=new Uint8Array(length);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return all;
}
function mailbox(value:unknown){
 if(typeof value!=="string"||value.length>1000)return "";
 const m=value.trim().match(/<([^<>]+)>$/);const a=(m?m[1]:value).trim().toLowerCase();
 return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(a)&&a.length<=320?a:"";
}
function addresses(value:unknown){return Array.isArray(value)?[...new Set(value.map(mailbox).filter(Boolean))]:[];}
function routes(value:unknown){return addresses(value).filter(x=>routePattern.test(x));}
const fixed=new Set(["hola@christianarleo.com","correo@christianarleo.com","hola@respuestas.christianarleo.com","correo@respuestas.christianarleo.com"]);
const reply=(status:number,result:string)=>new Response(JSON.stringify({status:result}),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return reply(405,"method");
 const secret=Deno.env.get("RESEND_CRM_INBOUND_WEBHOOK_SECRET")||"";
 if(!secret)return reply(503,"not_configured");
 let raw;try{raw=await boundedBody(req.body,262144);}catch{return reply(413,"too_large");}
 if(!await validSignature(raw,req.headers,secret))return reply(401,"invalid_signature");
 let event;try{event=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw));}catch{return reply(400,"invalid");}
 if(event?.type!=="email.received")return reply(200,"ignored");
 const data=event?.data,emailId=data?.email_id;
 if(typeof emailId!=="string"||!uuid.test(emailId))return reply(400,"invalid_event");
 const route=routes(data?.to),direct=addresses(data?.to).filter(x=>fixed.has(x));
 if(route.length===0&&direct.length===0)return reply(200,"unmatched");
 const existing=await db.from("portfolio_crm_inbound").select("id").eq("provider_email_id",emailId).maybeSingle();
 if(existing.error)return reply(503,"storage_unavailable");
 if(existing.data)return reply(200,"duplicate");
 let outboundId:string|null=null,leadId:string|null=null;
 if(route.length===1){
  const out=await db.from("portfolio_crm_mail").select("id,lead_id,recipient,status").eq("reply_address",route[0]).maybeSingle();
  if(out.error)return reply(503,"storage_unavailable");
  if(out.data&&["pending","uncertain"].includes(out.data.status)&&direct.length===0)return reply(503,"outbound_pending");
  if(out.data?.status==="accepted"&&mailbox(data?.from)&&mailbox(data.from)===mailbox(out.data.recipient)){outboundId=out.data.id;leadId=out.data.lead_id;}
  else if(direct.length===0)return reply(200,"unmatched");
 }else if(direct.length===0)return reply(200,"unmatched");
 const apiKey=Deno.env.get("RESEND_CRM_INBOUND_API_KEY")||"";
 if(!apiKey)return reply(503,"reader_not_configured");
 let received;
 try{
  const response=await fetch("https://api.resend.com/emails/receiving/"+emailId,{headers:{Authorization:"Bearer "+apiKey},signal:AbortSignal.timeout(10000)});
  if(!response.ok){console.warn("crm_inbound_provider_http",response.status);return reply(503,"provider_unavailable");}
  received=JSON.parse(new TextDecoder().decode(await boundedBody(response.body,2097152)));
 }catch{console.warn("crm_inbound_provider_read_failed");return reply(503,"provider_unavailable");}
 const sender=mailbox(received?.from), recipients=addresses(received?.to);
 if(received?.id!==emailId||!sender||sender!==mailbox(data?.from)||!recipients.some(x=>direct.includes(x)||(outboundId!==null&&route.includes(x))))return reply(422,"routing_mismatch");
 // An exact single match is only a routing hint, never authentication of the sender.
 if(!leadId&&direct.length){
  const candidates=await db.from("portfolio_cv_leads").select("id,email").ilike("email",sender.replace(/[\\%_]/g,c=>"\\"+c)).limit(2);
  if(candidates.error)return reply(503,"storage_unavailable");
  const exact=(candidates.data||[]).filter(x=>mailbox(x.email)===sender);
  if(exact.length===1)leadId=exact[0].id;
 }
 const plain=typeof received.text==="string"?received.text:"";
 const limited=plain.length>20000||(!plain.trim()&&Boolean(received.html));
 const body=plain.trim()?plain.replace(/\x00/g,"").slice(0,20000):"[Mensaje sin texto plano disponible. Revisar en Resend.]";
 const subject=typeof received.subject==="string"?received.subject.replace(/[\r\n\x00]/g," ").slice(0,500):"Sin asunto";
 const inserted=await db.from("portfolio_crm_inbound").insert({provider_email_id:emailId,outbound_id:outboundId,lead_id:leadId,sender,recipients:recipients.filter(x=>fixed.has(x)||(outboundId!==null&&route.includes(x))).slice(0,100),attachment_count:Array.isArray(received.attachments)?received.attachments.length:Array.isArray(data?.attachments)?data.attachments.length:0,subject,body,body_limited:limited});
 if(inserted.error?.code==="23505")return reply(200,"duplicate");
 if(inserted.error){console.warn("crm_inbound_store_failed");return reply(503,"storage_unavailable");}
 return reply(200,"stored");
});
