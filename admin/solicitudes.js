export const CRM_SENDERS=Object.freeze(["hola@christianarleo.com","correo@christianarleo.com"]);
export function crmSenderChoice(makeNode,message=null){
 const select=makeNode("select");select.required=true;
 const matches=message?CRM_SENDERS.filter(a=>(message.recipients||[]).includes(a)):[];
 if(message&&matches.length!==1){const placeholder=makeNode("option","Seleccioná una cuenta");placeholder.value="";placeholder.disabled=true;select.append(placeholder);}
 for(const address of CRM_SENDERS){const option=makeNode("option",address);option.value=address;select.append(option);}
 select.value=message?(matches.length===1?matches[0]:""):CRM_SENDERS[0];
 select.disabled=Boolean(message&&matches.length===1);
 return {select,locked:select.disabled};
}
/* CRM: correo directo con historial persistente; WhatsApp conserva confirmación manual. */
export function createLeadCRM({sb,el,node,notice,getDocuments,loadDocuments,bucket}){
 const root=el("leads"),filters=el("leadFilters"),summary=el("leadSummary"),searchInput=el("leadSearch");
 let leads=[],events=[],activeFilter="pendiente",firstLoad=true,loaded=false,selectedLeadId=null,page=0,mobileDetail=false;
 const meetingExpanded=new Set(), historyExpanded=new Set(), mailExpanded=new Set(), rejectionExpanded=new Set(), sending=new Set();
 let acceptedMail=new Map(),mailLoaded=false,unreadMail=new Map(),inboundLoaded=false;
 const mailKey=(lead,context)=>lead.id+":"+context;
 const currentContext=lead=>lead.decision_status==="rechazada"?"rejection":"followup";
 const latestMail=(lead,context=currentContext(lead))=>acceptedMail.get(mailKey(lead,context));
 function legacyMail(lead,context=currentContext(lead)){
   if(context==="followup")return lead.email_sent_at||null;
   const e=events.find(x=>x.lead_id===lead.id&&["rechazo_correo_confirmado","rechazo_correo_confirmacion_retirada"].includes(x.event_type));
   return e?.event_type==="rechazo_correo_confirmado"?e.created_at:null;
 }
 const labels={pendiente:"Por decidir",avanzar:"En seguimiento",rechazada:"Rechazada"};
 const kinds={in_house:"Contratación In-house",proyecto:"Contratación por proyecto",solicitud_cv:"Solicitud histórica"};
 const fieldNames={position:"Puesto",dedication:"Dedicación",work_mode:"Modalidad",work_days:"Días de trabajo",
  office_days:"Días presenciales",timezone:"Zona horaria",schedule_tbd:"Horario por definir",
  daily_start:"Inicio",daily_end:"Fin",responsibilities:"Responsabilidades",start_date:"Fecha de inicio",
  salary:"Remuneración",project_name:"Proyecto",project_area:"Área",problem:"Necesidad",outcome:"Resultado",
  deliverables:"Entregables",budget:"Presupuesto",project_need:"Necesidad",project_timing:"Plazo",
  due_date:"Entrega",hours:"Horas",hours_period:"Período",work_country:"País",work_city:"Ciudad",work_district:"Distrito"};
 const fieldValues={full_time:"Full Time",part_time:"Part Time",por_horas:"Por horas",
  remoto:"Remoto",presencial:"Presencial",hibrido:"Híbrido",mas_clientes:"Conseguir clientes",
  marketing_contenido:"Marketing y contenido",automatizacion_ia:"Automatización e IA",
  solucion_digital:"Solución digital",urgente:"Urgente",este_mes:"Este mes",mas_adelante:"Más adelante",a_definir:"A definir"};
 const n=(tag,text,cls)=>node(tag,text,cls);
 const filterIds=["leadKindFilter","leadStageFilter","leadModeFilter","leadAgeFilter","leadMailFilter","leadMeetingFilter","leadSort"];
 const advanced=Object.fromEntries(filterIds.map(id=>[id,el(id)]));
 const resetAdvanced=()=>{for(const id of filterIds)advanced[id].value=id==="leadSort"?"newest":"";};
 for(const control of Object.values(advanced))control.addEventListener("change",()=>{page=0;mobileDetail=false;render();});
 el("resetLeadAdvanced").addEventListener("click",()=>{resetAdvanced();searchInput.value="";page=0;mobileDetail=false;render();});
 function mailConfirmed(lead){return Boolean(latestMail(lead)||legacyMail(lead));}
 function filterAdvanced(lead){
   const f=id=>advanced[id].value,now=Date.now(),meeting=Date.parse(lead.meeting_at||""),created=Date.parse(lead.created_at||"");
   const kind=f("leadKindFilter"),stage=f("leadStageFilter"),mode=f("leadModeFilter"),age=f("leadAgeFilter"),mail=f("leadMailFilter"),mt=f("leadMeetingFilter");
   const actualMode=lead.intake_data?.work_mode;
   return (!kind||lead.kind===kind)&&(!stage||(lead.status||"nuevo")===stage)&&
    (!mode||(mode==="unknown"?!actualMode:actualMode===mode))&&
    (!age||(Number.isFinite(created)&&created>=now-Number(age)*86400000))&&
    (!mail||(mail==="unread"?inboundLoaded&&Boolean(unreadMail.get(lead.id)):mail==="blocked"?!allowed(lead):mail==="yes"?mailConfirmed(lead):allowed(lead)&&!mailConfirmed(lead)))&&
    (!mt||(mt==="none"?!Number.isFinite(meeting):mt==="future"?meeting>=now:meeting<now));
 }
 function sortAdvanced(rows){
   const date=x=>Date.parse(x.created_at)||0, meeting=x=>{const t=Date.parse(x.meeting_at||"");return Number.isFinite(t)&&t>=Date.now()?t:Infinity;};
   const cmp=(a,b)=>String(a||"").localeCompare(String(b||""),"es",{sensitivity:"base"});
   const sort=advanced.leadSort.value;
   return rows.sort((a,b)=>{
     const primary=sort==="oldest"?date(a)-date(b):sort==="company"?cmp(a.company_name,b.company_name):sort==="position"?cmp(a.position_or_project,b.position_or_project):sort==="meeting"?meeting(a)-meeting(b):date(b)-date(a);
     return primary||date(b)-date(a)||cmp(a.id,b.id);
   });
 }
 searchInput.addEventListener("input",()=>{page=0;mobileDetail=false;render();});
 function btn(text,cls){const x=n("button",text,cls);x.type="button";return x;}
 function row(cls="crmActions"){return n("div",undefined,cls);}
 function small(text,cls="crmHint"){return n("p",text,cls);}
 function when(v){return v?new Date(v).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"}):"—";}
 function value(v){if(Array.isArray(v))return v.map(x=>fieldValues[x]||x).join(", ");if(v===true)return "Sí";if(v===false)return "No";return fieldValues[v]||String(v??"");}
 function labeled(label,control){const wrap=n("div",undefined,"crmField"),lab=n("label",label);if(!control.id)control.id="crm-"+crypto.randomUUID();lab.htmlFor=control.id;wrap.append(lab,control);return wrap;}
 function action(button,work){button.addEventListener("click",async()=>{button.disabled=true;button.setAttribute("aria-busy","true");try{await work();}catch(e){notice(e.message||"No se pudo completar la acción.",true);}finally{button.disabled=false;button.removeAttribute("aria-busy");}});}
 function validDocs(lead){return getDocuments().filter(x=>x.ruc===lead.ruc&&x.is_active&&(!x.expires_at||Date.parse(x.expires_at)>Date.now()));}
 function doc(lead){return validDocs(lead).find(x=>x.id===lead.cv_document_id)||null;}
 function companyURL(lead){if(!/^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]{0,63}$/u.test(lead.ruc||""))return "";const u=new URL("/empresa/",location.origin);u.searchParams.set("ruc",lead.ruc);u.searchParams.set("lang",lead.language==="en"?"en":"es");if(doc(lead))u.searchParams.set("cv",lead.cv_document_id);return u.href;}
 function allowed(lead){return lead.contact_preference!=="empresa_contacta"||Boolean(lead.contact_override_at);}
 function waNumber(lead){let number=(lead.phone||"").replace(/\D/g,"");if(number.length===9&&number.startsWith("9"))number="51"+number;return number.length>=10&&number.length<=15?number:"";}
 async function audit(lead,type,detail={}){const {error}=await sb.from("portfolio_cv_lead_activities").insert({lead_id:lead.id,event_type:type,details:detail});if(error)console.warn("Historial:",error.message);}
 async function persist(lead,changes,type,detail={}){
  const {data,error}=await sb.from("portfolio_cv_leads").update(changes).eq("id",lead.id).select("id").single();
  if(error||!data)throw Error(error?.message||"No se pudo guardar.");
  if(type)await audit(lead,type,detail);
  await load();
 }
 function suggestion(lead){
  if(!lead.meeting_at)return "";
  const en=lead.language==="en";
  const local=new Date(lead.meeting_at).toLocaleString(en?"en-GB":"es-PE",{dateStyle:"medium",timeStyle:"short"});
  let text=en?"\n\nCould we meet on "+local+"?":"\n\n¿Podemos reunirnos el "+local+"?";
  if(lead.meeting_mode==="virtual")text+=en?" (online).":" (virtual).";
  else if(lead.meeting_mode==="presencial")text+=en?" (in person).":" (presencial).";
  else text+=".";
  if(lead.meeting_link)text+=(en?"\nMeeting link: ":"\nEnlace: ")+lead.meeting_link;
  if(lead.meeting_notes)text+=(en?"\nDetails: ":"\nDetalles: ")+lead.meeting_notes;
  return text+(en?"\nPlease confirm if this time works for you.":"\nConfirmame si te viene bien el horario.");
 }
 function draft(lead,rejection=false){
  const en=lead.language==="en",role=lead.position_or_project||(en?"your proposal":"tu propuesta");
  const contact=lead.contact_name||"",generic=/^Equipo de /i.test(contact);
  const hello=contact&&!generic?(en?"Hello ":"Hola ")+contact+",":en?"Hello "+lead.company_name+" team,":"Hola, equipo de "+lead.company_name+":";
  const subject=rejection?(en?"Regarding your proposal | Christian Gabriel Arleo":"Respuesta a tu propuesta | Christian Gabriel Arleo"):
   lead.kind==="in_house"?(en?"Following up: ":"Seguimiento: ")+role+" | Christian Gabriel Arleo":
   (en?"Project proposal | Christian Gabriel Arleo":"Propuesta de colaboración | Christian Gabriel Arleo");
  const intro=rejection?
    en?"Thank you for considering my profile. I won't be moving forward at this time.":"Gracias por considerar mi perfil. Por el momento, no voy a avanzar con la propuesta.":
    lead.kind==="in_house"?
     en?"Thank you for your interest in my profile for "+role+". I'd be glad to discuss this opportunity.":
        "Gracias por tu interés en mi perfil para "+role+". Me gustaría conversar sobre la oportunidad.":
     en?"Thanks for sharing your project proposal. I'd be happy to discuss the next steps.":
        "Gracias por compartir tu proyecto. Me gustaría conversar sobre los próximos pasos.";
  const cv= !rejection&&doc(lead)&&companyURL(lead)?
    (en?"\n\nYou can view and download my CV for this opportunity here:\n":"\n\nPodés consultar y descargar mi CV para esta oportunidad desde acá:\n")+companyURL(lead):"";
  const body=hello+"\n\n"+intro+cv+(rejection?"":suggestion(lead))+(en?"\n\nKind regards,\nChristian Gabriel Arleo":"\n\nQuedo atento.\nChristian Gabriel Arleo");
  return {subject,body};
 }
 function directMail(lead,subject,body,context,message=null){
  const box=n("div",undefined,"crmDirectMail");
  const send=btn("Enviar desde CRM","crmAccept");send.dataset.cgaIcon="send";send.dataset.mailLead=lead.id;
  const {select:sender,locked}=crmSenderChoice(n,message);
  const status=small("");status.setAttribute("role","status");
  let attemptId=null,attemptPayload=null;
  const canSend=()=>CRM_SENDERS.includes(sender.value)&&allowed(lead)&&/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(lead.email||""))&&!sending.has(lead.id);
  send.disabled=!canSend();sender.addEventListener("change",()=>{send.disabled=!canSend();});
  function showHistory(){
   mailExpanded.add(lead.id);
   if(selectedLeadId!==lead.id)return;
   const history=root.querySelector(".crmMailHistory");if(history){history.open=true;history.dispatchEvent(new Event("crm-refresh"));}
  }
  send.addEventListener("click",async()=>{
   if(!canSend()||send.disabled)return;
   const s=subject.value.trim(),b=body.value.trim(),from=sender.value;
   if(!s||!b){notice("Completá el asunto y el mensaje.",true);return;}
   sending.add(lead.id);send.disabled=true;sender.disabled=true;
   try{
    if(!await window.CGADialog.confirm("¿Enviar este mensaje a "+lead.email+" desde "+from+"?"))return;
    send.setAttribute("aria-busy","true");status.textContent="Enviando correo…";
    const payload={lead_id:lead.id,subject:s,body:b,context,sender:from,in_reply_to:message?.id||null};
    const signature=JSON.stringify(payload);
    if(attemptPayload!==signature){attemptId=crypto.randomUUID();attemptPayload=signature;}
    const {data,error}=await sb.functions.invoke("portfolio-crm-mail",{body:{id:attemptId,...payload}});
    if(error)throw Error("send_unconfirmed");
    if(data?.status==="accepted"){
      acceptedMail.set(mailKey(lead,context),{lead_id:lead.id,context,sender:from,accepted_at:new Date().toISOString()});
      mailExpanded.add(lead.id);rejectionExpanded.delete(lead.id);
      status.textContent="Correo enviado";
      notice("Correo enviado",false,{success:true,detail:"Registrado en el historial de la solicitud."});
      try{await load();}catch{render();}
      return;
    }
    const messages={invalid_sender:"Seleccioná una cuenta autorizada.",sender_mismatch:"La cuenta no coincide con la recepción original.",invalid_reply:"El mensaje original no corresponde a esta solicitud o destinatario.",conflict:"El intento no coincide con el envío registrado.",failed:"El proveedor rechazó el envío.",uncertain:"Resultado incierto. Revisá el historial antes de reenviar.",pending:"Envío pendiente de confirmar.",limit:"Alcanzaste el límite de 10 intentos de CRM por 24 h.",duplicate:"Ya se aceptó un mensaje idéntico recientemente.",uncertain_previous:"Hay un envío anterior sin resolver. No se enviará otro todavía.",contact_blocked:"La empresa no autorizó el contacto.",decision_changed:"La decisión cambió. Actualizá la solicitud.",sender_not_configured:"El remitente aún no está habilitado."};
    if(["failed","limit","duplicate","contact_blocked","decision_changed","invalid_sender","sender_mismatch","invalid_reply","sender_not_configured"].includes(data?.status)){attemptId=null;attemptPayload=null;}
    const code=Number.isInteger(data?.provider_http)?data.provider_http:null;
    const reason=code===401||code===403?"Revisá la autorización de la clave y el dominio en Resend.":code===422||code===400?"Revisá los datos del correo en los logs de Resend.":code===429?"Límite del proveedor; consultá la cuota antes de reintentar.":"";
    status.textContent=(messages[data?.status]||"No se pudo completar el envío.")+(code?" (HTTP "+code+"). "+reason:"");
    notice(status.textContent,true);showHistory();
   }catch{
    status.textContent="No se confirmó el resultado. Consultá el historial antes de reenviar.";notice(status.textContent,true);showHistory();
   }finally{sending.delete(lead.id);sender.disabled=locked;send.disabled=!canSend();send.removeAttribute("aria-busy");
    if(!send.isConnected&&selectedLeadId===lead.id){const current=leads.find(x=>x.id===lead.id);root.querySelectorAll(".crmDirectMail button").forEach(b=>{if(b.dataset.mailLead===lead.id)b.disabled=!current||!allowed(current)||!canSend();});}}
  });
  box.append(labeled("De",sender),send,status);return box;
 }
 function mailRecord(lead){
  const box=n("section",undefined,"crmStep crmMailRecord");
  box.append(n("h4","Estado del correo"));
  const context=currentContext(lead),sent=latestMail(lead,context),legacy=legacyMail(lead,context);
  const badge=n("div",undefined,"crmMailState");
  badge.dataset.state=sent?"sent":legacy?"legacy":mailLoaded?"pending":"unknown";
  const icon=n("span",sent||legacy?"✓":"·","crmMailStateIcon");icon.setAttribute("aria-hidden","true");
  const copy=n("div");
  copy.append(n("strong",sent?"Correo enviado":legacy?"Envío registrado anteriormente":mailLoaded?"Sin correo enviado para esta respuesta":"Estado no disponible"),
    small(sent?"Desde "+(sent.sender||"Cuenta no disponible")+" · "+when(sent.accepted_at):legacy?"Confirmación histórica · "+when(legacy):mailLoaded?"El estado se actualizará automáticamente cuando envíes un correo.":"No se pudo consultar el registro de envíos."));
  badge.append(icon,copy);box.append(badge);
  const details=n("details",undefined,"crmMailHistory");details.append(n("summary","Conversación por correo"));details.open=mailExpanded.has(lead.id);
  const list=n("div");details.append(list);let generation=0;
  async function refresh(){
   const g=++generation;list.replaceChildren(small("Consultando…"));
   try{
    const [outgoing,incoming]=await Promise.all([
     sb.from("portfolio_crm_mail").select("subject,body,recipient,sender,status,created_at,accepted_at,context").eq("lead_id",lead.id).order("created_at",{ascending:false}).limit(50),
     sb.from("portfolio_crm_inbound").select("id,subject,body,sender,recipients,body_limited,received_at,read_at").eq("lead_id",lead.id).order("received_at",{ascending:false}).limit(50)
    ]);
    if(g!==generation)return;list.replaceChildren();if(outgoing.error)throw outgoing.error;
    if(incoming.error)list.append(small("Recepción no disponible; se muestran los envíos."));
    const rows=[...(outgoing.data||[]).map(x=>({...x,direction:"out",at:x.accepted_at||x.created_at})),...(incoming.data||[]).map(x=>({...x,direction:"in",at:x.received_at}))].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    if(!rows.length){list.append(small("Todavía no hay correos registrados desde el CRM."));return;}
    const labels={accepted:"Enviado · entrega no verificada",failed:"Rechazado por proveedor",uncertain:"Sin confirmación",pending:"Pendiente"};
    for(const mail of rows){
     const received=mail.direction==="in",item=n("article",undefined,"crmMailItem crmConversationItem");
     item.dataset.direction=mail.direction;item.dataset.unread=String(received&&!mail.read_at);
     item.append(n("strong",mail.subject||"Sin asunto"),small(when(mail.at)+" · "+(received?"Recibido"+(!mail.read_at?" · Nuevo":""):labels[mail.status]||mail.status)),small(received?"De: "+mail.sender+" · Para: "+(mail.recipients||[]).join(", "):"De: "+mail.sender+" · Para: "+mail.recipient));
     const content=n("details");content.append(n("summary","Ver mensaje"),n("p",mail.body,"crmMailBody"));item.append(content);
     if(received){
      item.append(small("Remitente declarado; identidad no verificada de forma independiente."));
      if(mail.body_limited)item.append(small("Contenido parcial. Consultá el original en Resend."));
      if(!mail.read_at){const read=btn("Marcar como leído","cgaSoftButton");action(read,async()=>{
       const result=await sb.from("portfolio_crm_inbound").update({read_at:new Date().toISOString()}).eq("id",mail.id).is("read_at",null).select("id").maybeSingle();
       if(result.error)throw result.error;mailExpanded.add(lead.id);await load();
      });item.append(read);}
      if(allowed(lead)&&["avanzar","rechazada"].includes(lead.decision_status)&&String(lead.email||"").trim().toLowerCase()===String(mail.sender||"").trim().toLowerCase()){
       const respond=btn("Responder","cgaSoftButton");respond.dataset.cgaIcon="mail";
       respond.addEventListener("click",()=>{
        const editor=n("div",undefined,"crmReplyEditor"),subject=n("input"),body=n("textarea");
        subject.maxLength=180;subject.value=(/^re:/i.test(mail.subject)?mail.subject:"Re: "+mail.subject).slice(0,180);
        body.rows=6;body.maxLength=5000;const cancel=btn("Cancelar");
        cancel.addEventListener("click",()=>{editor.remove();respond.disabled=false;});
        editor.append(labeled("Para",Object.assign(n("input"),{readOnly:true,value:lead.email})),labeled("Asunto",subject),labeled("Mensaje",body),directMail(lead,subject,body,currentContext(lead),mail),cancel);
        item.append(editor);respond.disabled=true;window.CGAIcons?.decorate(editor);body.focus();
       });item.append(respond);
      }
     }
     list.append(item);
    }
    if((outgoing.data||[]).length===50||(incoming.data||[]).length===50)list.append(small("Se muestran hasta los últimos 50 mensajes por dirección."));
   }catch{if(g===generation)list.replaceChildren(small("Historial de correo no disponible."));}
  }
  details.addEventListener("toggle",()=>{if(details.open){mailExpanded.add(lead.id);void refresh();}else mailExpanded.delete(lead.id);});
  details.addEventListener("crm-refresh",()=>void refresh());box.append(details);return box;
 }
 function rejectionComposer(lead){
  const panel=n("div",undefined,"crmRejectionComposer");
  const to=String(lead.email||"").trim();
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
  const draftText=draft(lead,true);
  const subject=n("input");subject.type="text";subject.maxLength=180;subject.value=draftText.subject;
  const body=n("textarea");body.rows=6;body.maxLength=5000;body.value=draftText.body;
  panel.append(n("h4","Respuesta de rechazo"),labeled("Para",(()=>{
    const input=n("input");input.type="text";input.readOnly=true;input.value=to||"Sin correo registrado";return input;
  })()),labeled("Asunto",subject),labeled("Mensaje",body));
  if(!validEmail)panel.append(small("El contacto no tiene un correo válido. No es posible enviar un correo a esta empresa."));
  panel.append(directMail(lead,subject,body,"rejection"));
  return panel;
 }

 function original(lead,card){
  const details=n("details");details.append(n("summary","Ver información recibida"));
  const dl=n("dl",undefined,"leadData");
  const entries=Object.entries(lead.intake_data||{});
  for(const [key,v] of entries){
   const val=value(v);if(!fieldNames[key]||!val)continue;
   const pair=n("div",undefined,"leadDataRow");pair.append(n("dt",fieldNames[key]),n("dd",val));dl.append(pair);
  }
  if(lead.observations){const pair=n("div",undefined,"leadDataRow");pair.append(n("dt","Observaciones"),n("dd",lead.observations));dl.append(pair);}
  if(lead.intake_version<2&&lead.details){const pair=n("div",undefined,"leadDataRow");pair.append(n("dt","Detalle"),n("dd",lead.details));dl.append(pair);}
  details.append(dl);card.append(details);
 }
 function decision(lead,card){
  const box=n("section",undefined,"crmStep"),r=row();
  let rejectDraftPanel=null;
  if(lead.decision_status==="pendiente"){
   box.append(n("h4","¿Qué querés hacer?"));
   const accept=btn("Avanzar","crmAccept"),decline=btn("Rechazar","crmReject");
   accept.dataset.cgaIcon="check";decline.dataset.cgaIcon="close";
   action(accept,async()=>{activeFilter="avanzar";await persist(lead,{decision_status:"avanzar",decision_at:new Date().toISOString(),decision_reason:null,status:"en_evaluacion"},"decision_avanzar");notice("Solicitud habilitada para seguimiento.");});
   decline.addEventListener("click",()=>{
    const note=n("textarea");note.placeholder="Motivo interno (opcional)";note.maxLength=500;note.rows=2;
    const yes=btn("Confirmar rechazo","crmReject"),cancel=btn("Cancelar");
    r.replaceChildren(labeled("Motivo del rechazo",note),yes,cancel);
    action(yes,async()=>{if(!await window.CGADialog.confirm("¿Confirmás que querés rechazar esta solicitud?"))return;activeFilter="rechazada";
     await persist(lead,{decision_status:"rechazada",decision_at:new Date().toISOString(),decision_reason:note.value.trim()||null,status:"cerrado"},"decision_rechazada",{motivo:note.value.trim()});});
    cancel.addEventListener("click",()=>r.replaceChildren(accept,decline));
   });
   r.append(accept,decline);
  }else{
   box.append(small("Decisión: "+(labels[lead.decision_status]||lead.decision_status)+(lead.decision_at?" · "+when(lead.decision_at):"")));
   const reconsider=btn("Reconsiderar");reconsider.dataset.cgaIcon="refresh";
   action(reconsider,async()=>{if(!await window.CGADialog.confirm("¿Volver esta solicitud a Por decidir?"))return;activeFilter="pendiente";
    await persist(lead,{decision_status:"pendiente",decision_at:null,decision_reason:null,status:"nuevo"},"decision_reconsiderada");});
   r.append(reconsider);
   if(lead.decision_status==="rechazada"){
    if(lead.decision_reason)box.append(small("Motivo interno: "+lead.decision_reason));
    const draftLabel=mailConfirmed(lead)?"Redactar otro correo":"Redactar correo de rechazo";
    const respond=btn(draftLabel);respond.dataset.cgaIcon="mail";
    respond.disabled=!allowed(lead);
    const draftPanel=rejectionComposer(lead);draftPanel.hidden=!rejectionExpanded.has(lead.id);
    rejectDraftPanel=draftPanel;
    respond.setAttribute("aria-expanded",String(!draftPanel.hidden));
    if(!draftPanel.hidden)respond.textContent="Ocultar respuesta";
    respond.addEventListener("click",()=>{
      draftPanel.hidden=!draftPanel.hidden;
      respond.setAttribute("aria-expanded",String(!draftPanel.hidden));
      if(draftPanel.hidden)rejectionExpanded.delete(lead.id);else rejectionExpanded.add(lead.id);
      respond.textContent=draftPanel.hidden?draftLabel:"Ocultar respuesta";
      window.CGAIcons?.decorate(respond);
      if(!draftPanel.hidden)draftPanel.querySelector("input:not([readonly])")?.focus();
    });
    r.prepend(respond);
   }
  }
  box.append(r);
  if(rejectDraftPanel)box.append(rejectDraftPanel);
  card.append(box);
 }
 function cvSection(lead,parent){
  const section=n("section",undefined,"crmStep crmCompact");
  section.append(n("h4","1 · CV"));
  if(!/^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]{0,63}$/u.test(lead.ruc||"")){section.append(small("Esta empresa no tiene un identificador válido. No es posible asociar documentos automáticamente."));parent.append(section);return;}
  const docs=validDocs(lead),current=doc(lead);
  const r=row("crmLine");
  const select=n("select");select.setAttribute("aria-label","CV asociado a la propuesta");
  select.append(new Option("Elegir un CV existente…",""));
  for(const entry of docs)select.append(new Option(entry.role_name+" · "+entry.original_filename,entry.id));
  select.value=current?.id||"";
  select.addEventListener("change",async()=>{
   if(!select.value)return;
   select.disabled=true;select.setAttribute("aria-busy","true");
   try{await persist(lead,{cv_document_id:select.value},"cv_asociado",{cv_id:select.value});notice("CV asociado. Ya está disponible en el portal de esa empresa.");}
   catch(error){notice(error.message,true);await load();}
  });
  const inp=n("input");inp.type="file";inp.accept=".pdf,application/pdf";inp.hidden=true;
  const upload=btn("Subir PDF","crmAccent");upload.dataset.cgaIcon="upload";
  upload.addEventListener("click",()=>inp.click());
  inp.addEventListener("change",async()=>{
   const file=inp.files?.[0];if(!file)return;
   if(file.size>30*1024*1024||file.size<1024||!file.name.toLowerCase().endsWith(".pdf")){notice("Seleccioná un PDF de hasta 30 MB.",true);inp.value="";return;}
   const magic=new TextDecoder("latin1").decode(await file.slice(0,8).arrayBuffer());
   if(!magic.startsWith("%PDF-")){notice("El archivo no parece ser un PDF válido.",true);inp.value="";return;}
   upload.disabled=true;upload.setAttribute("aria-busy","true");upload.textContent="Subiendo…";
   const path="companies/"+crypto.randomUUID()+".pdf";
   try{
    const stored=await sb.storage.from(bucket).upload(path,file,{contentType:"application/pdf",cacheControl:"0",upsert:false});
    if(stored.error)throw stored.error;
    const added=await sb.from("portfolio_cv_documents").insert({
      ruc:lead.ruc,company_name:lead.company_name,role_name:lead.position_or_project||"CV personalizado",
      original_filename:file.name,storage_path:path,is_active:true,
      is_main:!getDocuments().some(x=>x.ruc===lead.ruc&&x.is_main),application_status:"preparado"
    }).select("id").single();
    if(added.error||!added.data){await sb.storage.from(bucket).remove([path]);throw Error(added.error?.message||"No se pudo registrar el PDF.");}
    const linked=await sb.from("portfolio_cv_leads").update({cv_document_id:added.data.id}).eq("id",lead.id).select("id").single();
    if(linked.error||!linked.data){await loadDocuments();await load();throw Error("CV subido, pero no se pudo asociar. Elegilo en la lista.");}
    await audit(lead,"cv_subido_asociado",{cv_id:added.data.id,filename:file.name});
    await loadDocuments();await load();notice("PDF subido y asociado. Ya podés compartirlo.");
   }catch(error){notice(error.message||"Error al subir el PDF.",true);}
   finally{upload.disabled=false;upload.removeAttribute("aria-busy");upload.textContent="+ Subir PDF";inp.value="";}
  });
  r.append(select,upload,inp);
  section.append(r);
  if(current){
   const links=row("crmInlineLinks");
   const portalLink=n("a","Ver portal");portalLink.dataset.cgaIcon="external";portalLink.href=companyURL(lead);portalLink.target="_blank";portalLink.rel="noopener noreferrer";
   const download=btn("Descargar PDF");download.dataset.cgaIcon="download";
   action(download,async()=>{
    const {data,error}=await sb.storage.from(bucket).createSignedUrl(current.storage_path,90,{download:current.original_filename});
    if(error||!data?.signedUrl)throw Error(error?.message||"No se pudo generar la descarga.");
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
   });
   links.append(n("span","✓ "+current.role_name,"crmLinked"),portalLink,download);section.append(links);
  }else section.append(small("Sin CV asociado."));
  parent.append(section);
 }

 function meetingSection(lead,parent){
  const details=n("details",undefined,"crmMeeting");
  details.open=meetingExpanded.has(lead.id);
  details.addEventListener("toggle",()=>{
   if(details.open)meetingExpanded.add(lead.id);else meetingExpanded.delete(lead.id);
  });
  details.append(n("summary",lead.meeting_at?"✓ Reunión: "+when(lead.meeting_at):"Proponer reunión"));
  const form=n("form"),grid=row("crmColumns"),date=n("input"),hour=n("select"),minute=n("select"),mode=n("select"),link=n("input");
  date.type="date";date.required=true;
  for(let h=0;h<24;h++)hour.append(new Option(String(h).padStart(2,"0"),String(h).padStart(2,"0")));
  // Selector explícito: ningún minuto fuera de múltiplos de cinco.
  for(let m=0;m<60;m+=5)minute.append(new Option(String(m).padStart(2,"0"),String(m).padStart(2,"0")));
  const local=lead.meeting_at?new Date(lead.meeting_at):null;
  if(local){
   const adjusted=new Date(local.getTime()-local.getTimezoneOffset()*60000);
   date.value=adjusted.toISOString().slice(0,10);
   hour.value=String(local.getHours()).padStart(2,"0");
   minute.value=String(Math.floor(local.getMinutes()/5)*5).padStart(2,"0");
  }else{
   const next=new Date(Date.now()+60*60*1000);
   next.setMinutes(Math.ceil(next.getMinutes()/5)*5,0,0);
   date.value=new Date(next.getTime()-next.getTimezoneOffset()*60000).toISOString().slice(0,10);
   hour.value=String(next.getHours()).padStart(2,"0");
   minute.value=String(next.getMinutes()).padStart(2,"0");
  }
  for(const [key,label] of [["a_definir","A definir"],["virtual","Virtual"],["presencial","Presencial"]])mode.append(new Option(label,key));
  mode.value=lead.meeting_mode||"a_definir";
  link.type="url";link.placeholder="Enlace de reunión (opcional)";link.maxLength=500;link.value=lead.meeting_link||"";
  const timeChoices=row("crmFiveMinute");
  timeChoices.append(labeled("Hora",hour),labeled("Minutos (de 5 en 5)",minute));
  grid.append(labeled("Fecha",date),timeChoices,labeled("Modalidad",mode));
  form.append(grid,labeled("Enlace (opcional)",link));
  const buttons=row();
  const save=btn("Guardar reunión");save.dataset.cgaIcon="calendar";save.type="submit";
  buttons.append(save);
  if(lead.meeting_at){
   const clear=btn("Quitar propuesta");
   clear.addEventListener("click",async()=>{
    if(!await window.CGADialog.confirm("¿Quitar la propuesta de reunión?"))return;
    try{await persist(lead,{meeting_at:null,meeting_mode:null,meeting_link:null},"reunion_propuesta_borrada");notice("Reunión retirada.");}
    catch(err){notice(err.message,true);}
   });
   buttons.append(clear);
  }
  form.append(buttons);
  form.addEventListener("submit",async event=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   const localStr=date.value+"T"+hour.value+":"+minute.value+":00";
   const at=new Date(localStr);
   if(!Number.isFinite(at.getTime())||at.getTime()<=Date.now()){notice("Elegí un horario futuro.",true);return;}
   if(at.getMinutes()%5!==0){notice("Los minutos deben ser múltiplos de cinco.",true);return;}
   save.disabled=true;
   try{
    await persist(lead,{meeting_at:at.toISOString(),meeting_mode:mode.value,meeting_link:link.value.trim()||null},
     "reunion_propuesta_guardada",{date:at.toISOString()});
    notice("Reunión propuesta. Aparecerá en el mensaje cuando vuelvas a abrirlo.");
   }catch(err){notice(err.message,true);}
   finally{save.disabled=false;}
  });
  details.append(form);parent.append(details);
 }
 function messageSection(lead,parent){
  const section=n("section",undefined,"crmStep crmCompact");
  section.append(n("h4","2 · Preparar y enviar respuesta"));
  if(!allowed(lead)){
   section.append(n("p","La empresa eligió «Nosotros te devolvemos la llamada». Necesitás autorización posterior para iniciar contacto.","crmWarning"));
   const authorize=btn("Registrar autorización posterior");
   action(authorize,async()=>{
    if(!await window.CGADialog.confirm("¿La empresa te autorizó después a contactarla? Registralo solo si ocurrió."))return;
    await persist(lead,{contact_override_at:new Date().toISOString()},"autorizacion_contacto_posterior");
    notice("Autorización registrada.");
   });
   section.append(authorize);parent.append(section);return;
  }
  const current=doc(lead);
  if(!current)section.append(small("Asociá un CV antes de responder si querés incluirlo en el enlace."));
  const data=draft(lead);
  const subject=n("input");subject.type="text";subject.maxLength=180;subject.value=data.subject;
  const body=n("textarea");body.rows=7;body.maxLength=5000;body.value=data.body;
  const recipient=n("input");recipient.type="text";recipient.readOnly=true;recipient.value=lead.email||"Sin correo registrado";
  section.append(labeled("Para",recipient),labeled("Asunto",subject),labeled("Mensaje (editable)",body));
  const actions=row("crmDeliveryButtons");
  const whatsapp=btn("WhatsApp","crmAccent");whatsapp.dataset.cgaIcon="chat";
  const number=waNumber(lead);whatsapp.disabled=!number;
  whatsapp.addEventListener("click",()=>{
   window.open("https://wa.me/"+number+"?text="+encodeURIComponent(body.value),"_blank","noopener,noreferrer");
   notice("WhatsApp se abrió con el mensaje preparado. Enviá allí y luego confirmá con el interruptor.");
   void audit(lead,"whatsapp_abierto",{cv_id:current?.id||null});

  });
  actions.append(whatsapp);
  section.append(directMail(lead,subject,body,"followup"),actions);
  if(!number){
   const add=n("details",undefined,"crmPhone");add.append(n("summary","Agregar teléfono para WhatsApp"));
   const phone=n("input");phone.type="tel";phone.inputMode="tel";phone.maxLength=65;phone.value=lead.phone||"";
   phone.placeholder="+51 999 999 999";
   const save=btn("Guardar teléfono");
   action(save,async()=>{
    let digits=phone.value.replace(/\D/g,"");if(digits.length===9&&digits.startsWith("9"))digits="51"+digits;
    if(digits.length<10||digits.length>15)throw Error("Ingresá un número internacional válido.");
    await persist(lead,{phone:phone.value.trim()},"telefono_contacto_actualizado");notice("Teléfono guardado.");
   });
   add.append(labeled("Número de WhatsApp",phone),save);section.append(add);
  }
  const confirmations=row("crmDeliveryStatuses");
  function deliverySwitch(kind,text,field,initial,confirmedEvent,undoEvent){
   const wrap=n("label",undefined,"crmSwitchRow");
   const control=n("input");control.type="checkbox";control.setAttribute("role","switch");
   control.checked=Boolean(initial);
   control.setAttribute("aria-label",text);
   const slider=n("span",undefined,"crmSwitchTrack");
   const content=n("span",text,"crmSwitchText");
   const status=n("small",initial?"Confirmado · "+when(initial):"Pendiente de confirmación","crmSwitchStatus");
   wrap.append(control,slider,content,status);
   control.addEventListener("change",async()=>{
    const checked=control.checked;
    // El switch constituye la confirmación expresa: no abrir un segundo popup nativo.
    control.disabled=true;control.setAttribute("aria-busy","true");
    try{
     await persist(lead,{[field]:checked?new Date().toISOString():null,
      ...(checked?{status:"contactado"}:{})},
      checked?confirmedEvent:undoEvent);
     notice(checked?"Envío confirmado.":"Confirmación retirada.");
    }catch(err){control.checked=!checked;notice(err.message,true);}
    finally{control.disabled=false;control.removeAttribute("aria-busy");}
   });
   return wrap;
  }
  const waStatus=deliverySwitch("el WhatsApp","Ya envié por WhatsApp","whatsapp_sent_at",lead.whatsapp_sent_at,
    "whatsapp_confirmado_enviado","whatsapp_confirmacion_retirada");
  // Siempre visibles, incluso si el número de teléfono aún no está registrado.
  // Abrir un proveedor no marca un mensaje como enviado.
  confirmations.append(waStatus);
  section.append(confirmations);
  if(!number)section.append(small("No hay un teléfono válido. Podés agregarlo arriba para abrir WhatsApp. Si ya lo enviaste por otra vía, registrá la confirmación manualmente."));
  section.append(small("Confirmá únicamente el envío de WhatsApp después de enviarlo desde su aplicación."));
  parent.append(section);
 }
 function archive(lead,card){
  const eventsOfLead=events.filter(x=>x.lead_id===lead.id),details=n("details",undefined,"crmHistory");
  details.open=historyExpanded.has(lead.id);
  details.addEventListener("toggle",()=>{if(details.open)historyExpanded.add(lead.id);else historyExpanded.delete(lead.id);});
  details.append(n("summary","Historial ("+eventsOfLead.length+")"));
  const eventNames={decision_avanzar:"Decisión: avanzar",decision_rechazada:"Decisión: rechazar",
   decision_reconsiderada:"Reconsiderada",cv_asociado:"CV asociado",cv_subido_asociado:"CV subido y asociado",
   reunion_propuesta_guardada:"Reunión propuesta guardada",reunion_propuesta_borrada:"Reunión eliminada",
   correo_abierto:"Correo preparado",whatsapp_abierto:"WhatsApp abierto",correo_confirmado_enviado:"Correo enviado (confirmado)",
   whatsapp_confirmado_enviado:"WhatsApp enviado (confirmado)",autorizacion_contacto_posterior:"Autorización posterior",
   telefono_contacto_actualizado:"Teléfono actualizado",seguimiento_actualizado:"Etapa actualizada",
   rechazo_zoho_abierto:"Respuesta de rechazo preparada en Zoho",
   rechazo_gmail_abierto:"Respuesta de rechazo preparada en Gmail",
   rechazo_correo_confirmado:"Respuesta de rechazo enviada (confirmada)",
   rechazo_correo_confirmacion_retirada:"Confirmación de rechazo retirada"};
  const ul=n("ul");
  for(const e of eventsOfLead.slice(0,30))ul.append(n("li",when(e.created_at)+" · "+(eventNames[e.event_type]||(e.event_type.startsWith("correo_crm_error_")?"Correo CRM: error del proveedor ("+e.event_type.slice("correo_crm_error_".length)+")":e.event_type))));
  if(!eventsOfLead.length)ul.append(n("li","Todavía no hay movimientos."));
  details.append(ul);card.append(details);
 }

 function leadCard(lead){
  // Solo la ficha seleccionada se construye; evitamos decenas de formularios simultáneos.
  const card=n("article",undefined,"crmCard crmSelectedDetail");
  card.id="crmActiveDetail";
  const head=n("div",undefined,"crmHeader"),title=n("div");
  title.append(n("strong",(kinds[lead.kind]||lead.kind)+" · "+lead.company_name));
  title.append(n("small",(lead.contact_name||"")+" · "+lead.email+" · "+(lead.phone||"Sin teléfono")+
    " · "+(lead.position_or_project||"Propuesta")+" · "+when(lead.created_at)));
  const companyId=String(lead.ruc||"").trim();
  const identifier=n("div",undefined,"crmCompanyIdentifier");
  identifier.append(n("span","Identificador de empresa:"),
    n("code",companyId||"No informado"));
  if(companyId){
    const copy=btn("Copiar","crmCopyIdentifier");
    copy.dataset.cgaIcon="files";
    copy.title="Copiar identificador de empresa";
    copy.addEventListener("click",async()=>{
      try{
        await navigator.clipboard.writeText(companyId);
        notice("Identificador copiado.");
      }catch{
        await window.CGADialog.copy("Copiá el identificador:",companyId);
      }
    });
    identifier.append(copy);
  }
  title.append(identifier);
  const badge=n("span",labels[lead.decision_status]||"Por decidir","crmBadge");
  badge.dataset.state=lead.decision_status;
  head.append(title,badge);card.append(head);
  original(lead,card);
  decision(lead,card);
  if(lead.decision_status==="avanzar"){
   const area=n("div",undefined,"crmWorkflow");
   cvSection(lead,area);
   meetingSection(lead,area);
   messageSection(lead,area);
   const select=n("select");
   for(const [key,text] of [["nuevo","Nueva"],["en_evaluacion","En evaluación"],
     ["contactado","Contactada"],["cerrado","Cerrada"]])select.append(new Option(text,key));
   select.value=lead.status||"nuevo";
   select.addEventListener("change",async()=>{
    select.disabled=true;select.setAttribute("aria-busy","true");
    try{
     await persist(lead,{status:select.value},"seguimiento_actualizado",{etapa:select.value});
     notice("Seguimiento actualizado.");
    }catch(e){notice(e.message,true);await load();}
   });
   const status=n("details",undefined,"crmStage");
   status.append(n("summary","Etapa: "+select.selectedOptions[0]?.textContent),
     labeled("Etapa interna",select));
   area.append(status);card.append(area);
  }
  card.append(mailRecord(lead));
  archive(lead,card);
  return card;
 }
 function compactRow(lead){
  const item=btn("","crmQueueItem");
  item.dataset.leadId=lead.id;
  item.dataset.state=lead.decision_status;
  item.setAttribute("aria-pressed",String(lead.id===selectedLeadId));
  item.setAttribute("aria-controls","crmDetailPane");
  item.setAttribute("aria-label","Abrir "+(kinds[lead.kind]||lead.kind)+
    " de "+lead.company_name+" para "+(lead.position_or_project||"la propuesta"));
  const top=n("span",undefined,"crmQueueTop");
  top.append(n("strong",lead.company_name||"Empresa sin nombre"));
  const badge=n("span",labels[lead.decision_status]||"Por decidir","crmQueueBadge");
  badge.dataset.state=lead.decision_status;
  top.append(badge);
  const position=n("span",lead.position_or_project||"Sin vacante indicada","crmQueuePosition");
  const queueId=n("span","ID empresa: "+(String(lead.ruc||"").trim()||"No informado"),"crmQueueIdentifier");
  const bottom=n("span",undefined,"crmQueueBottom");
  bottom.append(n("span",lead.kind==="proyecto"?"Proyecto":lead.kind==="in_house"?"In-house":"Solicitud"));
  const date=new Date(lead.created_at);
  bottom.append(n("time",Number.isNaN(date.getTime())?"Sin fecha":date.toLocaleDateString("es-PE",
    {day:"2-digit",month:"short",year:"numeric"})));
  const signals=[];
  if(lead.cv_document_id)signals.push("CV");
  if(latestMail(lead,"followup")||legacyMail(lead,"followup"))signals.push("Correo ✓");
  if(latestMail(lead,"rejection")||legacyMail(lead,"rejection"))signals.push("Rechazo ✓");
  if(inboundLoaded&&unreadMail.get(lead.id))signals.push("Nuevos "+unreadMail.get(lead.id));
  if(lead.whatsapp_sent_at)signals.push("WA ✓");
  if(signals.length)bottom.append(n("span",signals.join(" · "),"crmQueueSignals"));
  const openLabel=n("span","Ver detalle →","crmQueueOpen");
  item.append(top,position,queueId,bottom,openLabel);
  item.addEventListener("click",()=>{
   selectedLeadId=lead.id;
   mobileDetail=true;
   render();
   const heading=el("crmDetailTitle");
   heading?.focus({preventScroll:true});
   // En móvil el listado se oculta y la ficha ocupa la pantalla.
   if(matchMedia("(max-width: 820px)").matches)el("crmDetailPane")?.scrollIntoView({block:"start"});
  });
  return item;
 }
 function render(){
  const count={pendiente:leads.filter(x=>x.decision_status==="pendiente").length,
   avanzar:leads.filter(x=>x.decision_status==="avanzar").length,
   rechazada:leads.filter(x=>x.decision_status==="rechazada").length,todas:leads.length};
  filters.replaceChildren();
  for(const [key,label] of [["pendiente","Por decidir"],["avanzar","En seguimiento"],
   ["rechazada","Rechazadas"],["todas","Todas"]]){
   const x=btn(label+" · "+count[key]);x.setAttribute("aria-pressed",String(activeFilter===key));
   x.addEventListener("click",()=>{activeFilter=key;page=0;mobileDetail=false;render();});
   filters.append(x);
  }
  summary.textContent=count.pendiente+" por decidir · "+count.avanzar+
    " en seguimiento · "+count.rechazada+" rechazadas";
  root.replaceChildren();
  const query=searchInput.value.trim().toLocaleLowerCase();
  const subset=leads.filter(x=>activeFilter==="todas"||x.decision_status===activeFilter);
  const matches=subset.filter(x=>!query||[
   x.company_name,x.contact_name,x.email,x.position_or_project,x.ruc,x.phone,x.kind
  ].some(text=>String(text||"").toLocaleLowerCase().includes(query))).filter(filterAdvanced);
  sortAdvanced(matches);
  summary.textContent+=" · "+matches.length+" coincidencias";
  if(!matches.length){
   selectedLeadId=null;mobileDetail=false;
   const empty=small(query||filterIds.slice(0,-1).some(id=>advanced[id].value)?"No hay solicitudes con esos criterios.":"No hay solicitudes en esta bandeja.");
   root.append(empty);
   if(query){
    const reset=btn("Limpiar búsqueda");reset.dataset.cgaIcon="refresh";
    reset.addEventListener("click",()=>{searchInput.value="";page=0;render();searchInput.focus()});
    root.append(reset);
   }
   window.CGAIcons?.decorate(root);
   return;
  }
  const limit=15;
  const pages=Math.max(1,Math.ceil(matches.length/limit));
  page=Math.min(page,pages-1);
  const visible=matches.slice(page*limit,(page+1)*limit);
  // Conservamos selección si sigue visible; si cambian filtros o página elegimos la primera.
  if(!visible.some(x=>x.id===selectedLeadId))selectedLeadId=visible[0].id;
  const selected=visible.find(x=>x.id===selectedLeadId);
  const workspace=n("div",undefined,"crmInboxWorkspace");
  workspace.dataset.mobileDetail=String(mobileDetail);
  const list=n("div",undefined,"crmInboxList");
  list.setAttribute("aria-label","Lista de solicitudes");
  const listTitle=n("div",undefined,"crmInboxListTitle");
  listTitle.append(n("strong","Solicitudes ("+matches.length+")"));
  listTitle.append(n("small","Elegí una para gestionar"));
  list.append(listTitle);
  for(const lead of visible)list.append(compactRow(lead));
  if(pages>1){
   const nav=n("div",undefined,"crmInboxPagination");
   const previous=btn("← Anterior");previous.disabled=page===0;
   const next=btn("Siguiente →");next.disabled=page>=pages-1;
   previous.addEventListener("click",()=>{page--;mobileDetail=false;selectedLeadId=null;render();});
   next.addEventListener("click",()=>{page++;mobileDetail=false;selectedLeadId=null;render();});
   nav.append(previous,n("small",(page+1)+" / "+pages),next);
   list.append(nav);
  }
  const detail=n("section",undefined,"crmInboxDetail");
  detail.id="crmDetailPane";
  detail.setAttribute("aria-label","Solicitud seleccionada");
  const detailHeader=n("div",undefined,"crmInboxDetailHeader");
  const back=btn("Volver a solicitudes","crmInboxBack");
  back.dataset.cgaIcon="return";
  back.addEventListener("click",()=>{
   mobileDetail=false;render();
   const row=root.querySelector('[data-lead-id="'+selectedLeadId+'"]');
   row?.focus({preventScroll:true});
  });
  const title=n("h2","Gestionar solicitud");
  title.id="crmDetailTitle";title.tabIndex=-1;
  detailHeader.append(back,title);
  detail.append(detailHeader,leadCard(selected));
  workspace.append(list,detail);
  root.append(workspace);
  window.CGAIcons?.decorate(root);
 }
 async function load(){
  const {data,error}=await sb.from("portfolio_cv_leads").select("*").order("created_at",{ascending:false}).limit(200);
  if(error){notice("No se pudieron consultar las solicitudes: "+error.message,true);return;}
  leads=(data||[]).map(x=>({...x,decision_status:x.decision_status||"pendiente"}));events=[];
  if(firstLoad){
   firstLoad=false;
   const pending=leads.filter(x=>x.decision_status==="pendiente");
   const accepted=leads.filter(x=>x.decision_status==="avanzar");
   if(!pending.length&&accepted.length){
    activeFilter="avanzar";
   }else if(!pending.length&&leads.length)activeFilter="todas";
  }
  if(leads.length){
   const {data:activities,error:activityError}=await sb.from("portfolio_cv_lead_activities")
     .select("lead_id,event_type,created_at").in("lead_id",leads.map(x=>x.id))
     .order("created_at",{ascending:false}).limit(2000);
   if(!activityError)events=activities||[];
  }
  // Read the canonical mail ledger; do not depend on manual/auxiliary events.
  let nextMail=new Map(),complete=true;
  if(leads.length){
   try{
    for(let offset=0;;offset+=500){
     const {data:rows,error:mailError}=await sb.from("portfolio_crm_mail")
       .select("id,lead_id,context,sender,accepted_at").in("lead_id",leads.map(x=>x.id)).eq("status","accepted")
       .order("accepted_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+499);
     if(mailError){complete=false;break;}
     for(const m of rows||[]){const key=m.lead_id+":"+m.context;if(!nextMail.has(key))nextMail.set(key,m);}
     if((rows||[]).length<500)break;
    }
   }catch{complete=false;}
  }
  mailLoaded=complete;if(complete)acceptedMail=nextMail;
  let nextUnread=new Map();inboundLoaded=true;
  try{if(leads.length)for(let offset=0;;offset+=500){const {data:rows,error}=await sb.from("portfolio_crm_inbound").select("id,lead_id").in("lead_id",leads.map(x=>x.id)).is("read_at",null).order("id").range(offset,offset+499);if(error)throw error;for(const m of rows||[])nextUnread.set(m.lead_id,(nextUnread.get(m.lead_id)||0)+1);if((rows||[]).length<500)break;}}catch{inboundLoaded=false;}
  unreadMail=nextUnread;
  loaded=true;
  render();
 }
 function getSummary(){
   return {loaded,pending:leads.filter(x=>x.decision_status==="pendiente").length,
     active:leads.filter(x=>x.decision_status==="avanzar").length,
     rejected:leads.filter(x=>x.decision_status==="rechazada").length,
     total:leads.length};
 }
 return {load,getSummary};
}
