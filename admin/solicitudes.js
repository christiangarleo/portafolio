/* CRM operativo: una decisión, CV asociado, borradores y auditoría. No envía mensajes automáticamente. */
export function createLeadCRM({sb,el,node,notice,getDocuments,loadDocuments,bucket}){
 const list=el("leads"),filters=el("leadFilters"),summary=el("leadSummary");
 let leads=[],history=[],filter="pendiente";
 const open=new Set(),detailsOpen=new Set();
 const statuses={pendiente:"Por decidir",avanzar:"En seguimiento",rechazada:"Rechazada"};
 const names={in_house:"Contratación In-house",proyecto:"Contratación por proyecto",solicitud_cv:"Solicitud histórica"};
 const fields={position:"Puesto",dedication:"Dedicación",work_mode:"Modalidad",work_days:"Días",office_days:"Días presenciales",timezone:"Zona horaria",schedule_tbd:"Horario por definir",responsibilities:"Responsabilidades",start_date:"Fecha de inicio",salary:"Remuneración",project_name:"Proyecto",problem:"Necesidad",outcome:"Resultado",deliverables:"Entregables",budget:"Presupuesto",project_need:"Necesidad",project_timing:"Plazo",due_date:"Entrega",hours:"Horas",hours_period:"Período"};
 const translations={full_time:"Full Time",part_time:"Part Time",por_horas:"Por horas",remoto:"Remoto",presencial:"Presencial",hibrido:"Híbrido",mas_clientes:"Conseguir clientes",marketing_contenido:"Marketing/contenido",automatizacion_ia:"Automatización e IA",solucion_digital:"Solución digital",urgente:"Urgente",este_mes:"Este mes",mas_adelante:"Más adelante",a_definir:"A definir"};
 const n=(tag,text,cls)=>node(tag,text,cls);
 function b(text,cls){const x=n("button",text,cls);x.type="button";return x;}
 function stamp(v){return new Date(v).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"});}
 function msg(text){return n("p",text,"crmHint");}
 function row(){return n("div",undefined,"crmActions");}
 function block(label,field){const x=n("div",undefined,"crmField"),l=n("label",label);x.append(l,field);return x;}
 function value(v){return Array.isArray(v)?v.map(x=>translations[x]||x).join(", "):v===true?"Sí":v===false?"No":translations[v]||String(v||"");}
 function selectedCV(lead){return getDocuments().find(x=>x.id===lead.cv_document_id)||null;}
 function allCV(lead){return getDocuments().filter(x=>x.ruc===lead.ruc&&x.is_active&&(!x.expires_at||Date.parse(x.expires_at)>Date.now()));}
 function portal(lead){const p=new URL("/empresa/",location.origin);p.searchParams.set("ruc",lead.ruc);p.searchParams.set("lang",lead.language==="en"?"en":"es");if(lead.cv_document_id)p.searchParams.set("cv",lead.cv_document_id);return p.href;}
 function canContact(lead){return lead.contact_preference!=="empresa_contacta"||!!lead.contact_override_at;}
 function waNumber(lead){let v=(lead.phone||"").replace(/\D/g,"");if(v.length===9&&v[0]==="9")v="51"+v;return v.length>=10&&v.length<=15?v:"";}
 function meetingDetails(lead){
  if(!lead.meeting_at)return "";
  const en=lead.language==="en";
  const date=en?new Date(lead.meeting_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}):stamp(lead.meeting_at);
  const modes=en?{virtual:"online",presencial:"in person",a_definir:"to be determined"}:
    {virtual:"virtual",presencial:"presencial",a_definir:"por definir"};
  const mode=modes[lead.meeting_mode]||modes.a_definir;
  let s=en?"\n\nI would like to suggest a "+mode+" meeting on "+date+"."
    :"\n\nTe propongo conversar "+date+" ("+mode+").";
  if(lead.meeting_link)s+=(en?"\nMeeting link: ":"\nEnlace: ")+lead.meeting_link;
  if(lead.meeting_notes)s+=(en?"\nDetails: ":"\nNotas: ")+lead.meeting_notes;
  return s+(en?"\nThis is only a suggested time; please let me know if it works for you.":"\nEs una propuesta de horario; confirmame si te viene bien.");
 }
 function draft(lead,decline=false){
  const en=lead.language==="en",role=lead.position_or_project||(en?"your proposal":"tu propuesta");
  const contact=lead.contact_name||"";
  const greeting=contact&&!contact.startsWith("Equipo de")
    ?(en?"Hello ":"Hola ")+contact+","
    :en?"Hello "+lead.company_name+" team,":"Hola, equipo de "+lead.company_name+":";
  const subject=decline?(en?"Regarding your proposal | Christian Gabriel Arleo":"Respuesta a tu propuesta | Christian Gabriel Arleo")
    :lead.kind==="in_house"?(en?"Following up: ":"Seguimiento: ")+role+" | Christian Gabriel Arleo"
    :(en?"Project collaboration | Christian Gabriel Arleo":"Propuesta de colaboración | Christian Gabriel Arleo");
  const intro=decline
    ?en?"Thank you for considering me for "+role+". After reviewing the opportunity, I won't be moving forward at this time.":"Gracias por considerarme para "+role+". Por el momento, no voy a avanzar con esta oportunidad."
    :lead.kind==="in_house"
      ?en?"Thank you for your interest in my profile for "+role+". I'd be glad to discuss the position further.":"Gracias por tu interés en mi perfil para "+role+". Me gustaría conversar sobre la oportunidad."
      :en?"Thank you for sharing your proposal for "+role+". I'd welcome the chance to discuss the scope and next steps.":"Gracias por compartir la propuesta sobre "+role+". Me interesa conocer más detalles y próximos pasos.";
  const cv=!decline&&lead.cv_document_id
    ?en?"\n\nI've prepared a CV for this opportunity. You can view and download it from your company's portal:\n"+portal(lead)
      :"\n\nPreparé un CV relacionado con esta oportunidad, disponible para consultar y descargar desde el portal de tu empresa:\n"+portal(lead)
    :"";
  const closing=en?"\n\nKind regards,\nChristian Gabriel Arleo":"\n\nQuedo atento.\nChristian Gabriel Arleo";
  return {subject,body:greeting+"\n\n"+intro+cv+(decline?"":meetingDetails(lead))+closing};
 }
 async function audit(lead,event,details={}){
  const {error}=await sb.from("portfolio_cv_lead_activities").insert({lead_id:lead.id,event_type:event,details});
  if(error)console.warn("Historial no registrado:",error.message);
 }
 async function save(lead,changes,event,details={}){
  const {data,error}=await sb.from("portfolio_cv_leads").update(changes).eq("id",lead.id).select("id").single();
  if(error||!data)throw Error(error?.message||"El cambio no se guardó.");
  if(event)await audit(lead,event,details);
  await load();
 }
 function action(btn,fn){btn.addEventListener("click",async()=>{btn.disabled=true;try{await fn();}catch(e){notice(e.message||"Error al procesar la acción.",true);}finally{btn.disabled=false;}});}
 function ensureDecision(lead,card){
  const p=n("section",undefined,"crmStep");
  const controls=row();
  if(lead.decision_status==="pendiente"){
   p.append(n("h4","¿Querés avanzar o rechazar esta propuesta?"),msg("Primero tomá una decisión. Las acciones de contacto aparecen al avanzar."));
   const accept=b("✓ Avanzar con esta propuesta","crmAccept"),reject=b("✕ Rechazar","crmReject");
   action(accept,async()=>{await save(lead,{decision_status:"avanzar",decision_at:new Date().toISOString(),decision_reason:null,status:"en_evaluacion"},"decision_avanzar");filter="avanzar";open.add(lead.id);render();notice("Propuesta habilitada para gestionar.");});
   reject.addEventListener("click",()=>{
    controls.replaceChildren();
    const reason=n("textarea");reason.rows=2;reason.maxLength=500;reason.placeholder="Motivo del rechazo (opcional, interno)";
    const confirmBtn=b("Confirmar rechazo","crmReject"),cancel=b("Cancelar");
    controls.append(block("Motivo del rechazo",reason),confirmBtn,cancel);
    action(confirmBtn,async()=>{if(!confirm("¿Confirmás el rechazo de esta propuesta?"))return;
     await save(lead,{decision_status:"rechazada",decision_at:new Date().toISOString(),decision_reason:reason.value.trim()||null,status:"cerrado"},"decision_rechazada",{motivo:reason.value.trim()});filter="rechazada";render();notice("Propuesta movida a Rechazadas.");});
    cancel.addEventListener("click",()=>{controls.replaceChildren(accept,reject);});
   });
   controls.append(accept,reject);
  }else{
   p.append(msg("Decisión: "+(statuses[lead.decision_status]||lead.decision_status)+(lead.decision_at?" · "+stamp(lead.decision_at):"")));
   if(lead.decision_reason)p.append(msg("Motivo interno: "+lead.decision_reason));
   const reconsider=b("Reconsiderar decisión");
   action(reconsider,async()=>{if(!confirm("¿Volver esta propuesta a Por decidir?"))return;
    await save(lead,{decision_status:"pendiente",decision_at:null,decision_reason:null,status:"nuevo"},"decision_reconsiderada");filter="pendiente";render();});
   controls.append(reconsider);
   if(lead.decision_status==="rechazada"){
    const mail=b("Preparar respuesta de rechazo por correo");
    mail.addEventListener("click",()=>{
     if(!canContact(lead)&&!confirm("Esta empresa prefirió contactarte. ¿Confirmás que corresponde responder ahora?"))return;
     openMail(lead,true);
    });controls.append(mail);
   }
  }
  p.append(controls);card.append(p);
 }
 function cvStep(lead,part){
  const section=n("section",undefined,"crmStep");
  section.append(n("h4","1 · Asociar CV"),msg("Usá uno existente o subí un PDF. El reclutador lo descargará desde su portal por RUC."));
  if(!/^\d{11}$/.test(lead.ruc||"")){section.append(msg("Esta solicitud necesita un RUC válido antes de asociar un CV."));part.append(section);return;}
  const cv=selectedCV(lead),docs=allCV(lead);
  if(cv){
   section.append(n("p","CV asociado: "+cv.role_name+" · "+cv.original_filename,"crmHint"));
   if(cv.is_active&&(!cv.expires_at||Date.parse(cv.expires_at)>Date.now())){
    const link=n("a","Ver portal de la empresa ↗");link.href=portal(lead);link.target="_blank";link.rel="noopener noreferrer";section.append(link);
    const download=b("Descargar PDF para adjuntar");
    action(download,async()=>{
     const {data,error}=await sb.storage.from(bucket).createSignedUrl(cv.storage_path,90,{download:cv.original_filename});
     if(error||!data?.signedUrl)throw Error(error?.message||"No se pudo descargar el PDF.");
     window.open(data.signedUrl,"_blank","noopener,noreferrer");
    });section.append(download);
   }else section.append(n("p","El CV asociado está vencido o inactivo; elegí uno vigente antes de enviarlo.","crmWarning"));
  }
  const choose=n("select");choose.append(new Option("Seleccionar CV vigente…",""));
  for(const doc of docs)choose.append(new Option(doc.role_name+" · "+doc.original_filename,doc.id));
  if(cv&&docs.some(x=>x.id===cv.id))choose.value=cv.id;
  const bind=b("Asociar a esta solicitud");
  action(bind,async()=>{
   if(!docs.some(x=>x.id===choose.value))throw Error("Seleccioná un CV vigente del mismo RUC.");
   await save(lead,{cv_document_id:choose.value},"cv_asociado",{cv_id:choose.value});
   notice("CV asociado correctamente.");
  });
  const line=row();line.append(block("Seleccionar un CV existente",choose),bind);section.append(line);
  const more=n("details");more.append(n("summary","¿No está el CV? Subir PDF nuevo aquí"));
  const form=n("form"),role=n("input"),file=n("input"),submit=b("Subir y asociar CV","crmAccept");
  role.type="text";role.required=true;role.maxLength=180;role.value=lead.position_or_project||"CV personalizado";
  file.type="file";file.accept="application/pdf,.pdf";file.required=true;submit.type="submit";
  form.append(block("Puesto que identificará el CV",role),block("Archivo PDF (máximo 30 MB)",file),submit);
  form.addEventListener("submit",async e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const pdf=file.files[0];
   if(!pdf||pdf.size>30*1024*1024||pdf.size<1024||!pdf.name.toLowerCase().endsWith(".pdf")){notice("Elegí un PDF de hasta 30 MB.",true);return;}
   const sig=new TextDecoder("latin1").decode(await pdf.slice(0,8).arrayBuffer());
   if(!sig.startsWith("%PDF-")){notice("El archivo no tiene una cabecera PDF válida.",true);return;}
   const path=lead.ruc+"/"+crypto.randomUUID()+".pdf";submit.disabled=true;
   try{
    const stored=await sb.storage.from(bucket).upload(path,pdf,{contentType:"application/pdf",upsert:false,cacheControl:"0"});
    if(stored.error)throw stored.error;
    const added=await sb.from("portfolio_cv_documents").insert({company_name:lead.company_name,ruc:lead.ruc,
     role_name:role.value.trim(),original_filename:pdf.name,storage_path:path,is_active:true,is_main:docs.length===0,application_status:"preparado"}).select("id").single();
    if(added.error||!added.data){await sb.storage.from(bucket).remove([path]);throw Error(added.error?.message||"Error al registrar CV.");}
    const related=await sb.from("portfolio_cv_leads").update({cv_document_id:added.data.id}).eq("id",lead.id).select("id").single();
    if(related.error||!related.data){notice("CV subido. Falta asociarlo a la propuesta; usá el selector de CV.",true);await loadDocuments();await load();return;}
    await audit(lead,"cv_subido_asociado",{cv_id:added.data.id,filename:pdf.name});
    await loadDocuments();await load();notice("CV subido y asociado.");
   }catch(err){notice(err.message||"No se pudo subir el PDF.",true);}
   finally{submit.disabled=false;}
  });
  more.append(form);section.append(more);part.append(section);
 }
 function meetingStep(lead,part){
  const section=n("section",undefined,"crmStep");section.append(n("h4","2 · Proponer reunión (opcional)"),
   msg("Una propuesta de fecha no es una reunión confirmada. Podés incluirla en el correo o WhatsApp."));
  const date=n("input");date.type="datetime-local";
  if(lead.meeting_at){const z=new Date(lead.meeting_at);date.value=new Date(z.getTime()-z.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  const mode=n("select");
  for(const [v,label] of [["a_definir","Modalidad por definir"],["virtual","Virtual"],["presencial","Presencial"]])mode.append(new Option(label,v));
  mode.value=lead.meeting_mode||"a_definir";
  const link=n("input");link.type="url";link.maxLength=500;link.placeholder="https://meet.google.com/...";link.value=lead.meeting_link||"";
  const notes=n("input");notes.type="text";notes.maxLength=600;notes.value=lead.meeting_notes||"";
  const cols=n("div",undefined,"crmColumns");
  cols.append(block("Fecha y hora (zona de tu navegador)",date),block("Modalidad",mode),block("Enlace de videollamada (opcional)",link),block("Lugar o notas (opcional)",notes));section.append(cols);
  const saveBtn=b("Guardar propuesta de reunión");
  action(saveBtn,async()=>{
   if(link.value&&!link.checkValidity())throw Error("Ingresá una URL válida.");
   const at=date.value?new Date(date.value):null;
   if(at&&(!Number.isFinite(at.getTime())||at.getTime()<=Date.now()))throw Error("Elegí una fecha futura.");
   await save(lead,{meeting_at:at?at.toISOString():null,meeting_mode:at?mode.value:null,
    meeting_link:at?link.value.trim()||null:null,meeting_notes:at?notes.value.trim()||null:null},
    at?"reunion_propuesta_guardada":"reunion_propuesta_borrada",at?{fecha:at.toISOString()}:{});notice("Propuesta guardada. Todavía no fue enviada.");
  });section.append(saveBtn);part.append(section);
 }
 function openMail(lead,rejected=false,subject,body){
  const draftText=draft(lead,rejected),to=lead.email;
  if(!to||!to.includes("@")){notice("No hay correo válido.",true);return;}
  const a=n("a");a.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(subject||draftText.subject)+"&body="+encodeURIComponent(body||draftText.body);
  document.body.append(a);a.click();a.remove();
  notice("Borrador abierto. Si querés adjuntar el PDF, descargalo y agregalo manualmente. Confirmá el envío después.");
  audit(lead,rejected?"rechazo_correo_abierto":"correo_abierto",{cv_id:lead.cv_document_id||null});
 }
 function contactStep(lead,part){
  const section=n("section",undefined,"crmStep");section.append(n("h4","3 · Correo y WhatsApp"),
   msg("Se preparan mensajes editables con el enlace al CV. No se envían automáticamente; abrir el borrador no significa que esté enviado."));
  if(lead.contact_preference==="empresa_contacta"){
   section.append(n("p","La empresa eligió «Nosotros te devolvemos la llamada». Por defecto no iniciamos el contacto.","crmWarning"));
   if(!lead.contact_override_at){
    const allow=b("Registrar autorización posterior para contactarlo");
    action(allow,async()=>{
     if(!confirm("¿La empresa te autorizó después a iniciar contacto? Registralo únicamente si realmente ocurrió."))return;
     await save(lead,{contact_override_at:new Date().toISOString()},"autorizacion_contacto_posterior");notice("Autorización registrada.");
    });section.append(allow);
   }else section.append(msg("Autorización posterior registrada: "+stamp(lead.contact_override_at)));
  }
  const can=canContact(lead),doc=selectedCV(lead);
  if(doc&&(!doc.is_active||(doc.expires_at&&Date.parse(doc.expires_at)<=Date.now())))
   section.append(n("p","El CV asociado no está vigente; seleccioná otro antes de enviar el enlace.","crmWarning"));
  const d0=draft(lead);
  const subject=n("input");subject.type="text";subject.maxLength=180;subject.value=d0.subject;
  const body=n("textarea");body.rows=7;body.maxLength=5000;body.value=d0.body;
  section.append(block("Asunto de correo",subject),block("Mensaje por correo (editable)",body));
  const buttons=row();
  const mail=b("Abrir correo preparado","crmAccept");
  mail.disabled=!can||!lead.email;mail.addEventListener("click",()=>openMail(lead,false,subject.value,body.value));
  const copy=b("Copiar correo");
  copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText("Asunto: "+subject.value+"\n\n"+body.value);notice("Mensaje copiado.");}catch{notice("No se pudo copiar al portapapeles.",true);}});
  const confirmMail=b(lead.email_sent_at?"✓ Correo enviado ("+stamp(lead.email_sent_at)+")":"Confirmar que envié el correo");
  confirmMail.disabled=!can||Boolean(lead.email_sent_at);
  action(confirmMail,async()=>{
   if(!confirm("¿Confirmás que ya enviaste el correo desde tu aplicación?"))return;
   await save(lead,{email_sent_at:new Date().toISOString(),status:"contactado"},"correo_confirmado_enviado");notice("Correo marcado como enviado.");
  });
  buttons.append(mail,copy,confirmMail);section.append(buttons);
  const wa=n("textarea");wa.rows=5;wa.maxLength=5000;wa.value=d0.body;
  section.append(block("Mensaje de WhatsApp (editable)",wa));
  const waButtons=row(),num=waNumber(lead);
  const waOpen=b("Abrir WhatsApp");waOpen.disabled=!can||!num;
  waOpen.addEventListener("click",()=>{
   window.open("https://wa.me/"+num+"?text="+encodeURIComponent(wa.value),"_blank","noopener,noreferrer");
   notice("WhatsApp abierto con mensaje preparado. Confirmá el envío dentro de WhatsApp.");
   audit(lead,"whatsapp_abierto",{cv_id:lead.cv_document_id||null});
  });
  const markWA=b(lead.whatsapp_sent_at?"✓ WhatsApp enviado ("+stamp(lead.whatsapp_sent_at)+")":"Confirmar que envié WhatsApp");
  markWA.disabled=!can||!num||Boolean(lead.whatsapp_sent_at);
  action(markWA,async()=>{
   if(!confirm("¿Confirmás que ya enviaste el WhatsApp?"))return;
   await save(lead,{whatsapp_sent_at:new Date().toISOString(),status:"contactado"},"whatsapp_confirmado_enviado");notice("WhatsApp marcado como enviado.");
  });
  waButtons.append(waOpen,markWA);section.append(waButtons);
  if(!num)section.append(msg("No hay teléfono válido para WhatsApp. El correo sigue disponible."));
  part.append(section);
 }
 function historyBlock(lead,card){
  const evt=history.filter(x=>x.lead_id===lead.id);
  const details=n("details",undefined,"crmHistory");details.open=detailsOpen.has(lead.id);
  details.addEventListener("toggle",()=>{if(details.open)detailsOpen.add(lead.id);else detailsOpen.delete(lead.id);});
  details.append(n("summary","Historial de acciones ("+evt.length+")"));
  const labels={decision_avanzar:"Decisión: avanzar",decision_rechazada:"Decisión: rechazar",decision_reconsiderada:"Reconsiderada",
   cv_asociado:"CV asociado",cv_subido_asociado:"CV subido y asociado",reunion_propuesta_guardada:"Reunión propuesta (sin enviar)",
   reunion_propuesta_borrada:"Reunión eliminada",correo_abierto:"Correo abierto (sin confirmar envío)",
   rechazo_correo_abierto:"Rechazo por correo abierto",whatsapp_abierto:"WhatsApp abierto (sin confirmar envío)",
   correo_confirmado_enviado:"Correo enviado (confirmación manual)",whatsapp_confirmado_enviado:"WhatsApp enviado (confirmación manual)",
   seguimiento_actualizado:"Etapa actualizada",autorizacion_contacto_posterior:"Autorización de contacto posterior"};
  const ul=n("ul");for(const e of evt.slice(0,40))ul.append(n("li",stamp(e.created_at)+" · "+(labels[e.event_type]||e.event_type)));
  if(!evt.length)ul.append(n("li","Sin movimientos todavía."));
  details.append(ul);card.append(details);
 }
 function card(lead){
  const div=n("article",undefined,"crmCard"),head=n("div",undefined,"crmHeader"),intro=n("div");
  intro.append(n("strong",(names[lead.kind]||lead.kind)+" · "+lead.company_name));
  intro.append(n("small",(lead.contact_name||"")+" · "+lead.email+" · "+(lead.phone||"Sin teléfono")+" · RUC "+(lead.ruc||"sin dato")+
   (lead.position_or_project?" · "+lead.position_or_project:"")+" · "+(lead.language==="en"?"🇬🇧 English":"🇪🇸 Español")+" · "+stamp(lead.created_at)));
  const badge=n("span",statuses[lead.decision_status]||"Por decidir","crmBadge");badge.dataset.state=lead.decision_status;
  head.append(intro,badge);div.append(head);
  if(lead.contact_preference==="empresa_contacta")div.append(msg("Contacto: la empresa prefirió comunicarse por su cuenta."));
  if(lead.observations)div.append(msg("Observaciones: "+lead.observations));
  const original=n("details");original.append(n("summary","Ver condiciones recibidas"));
  const data=n("dl",undefined,"leadData");
  for(const [key,v] of Object.entries(lead.intake_data||{})){
   if(!fields[key]||!value(v))continue;
   const pair=n("div",undefined,"leadDataRow");pair.append(n("dt",fields[key]),n("dd",value(v)));data.append(pair);
  }
  if(lead.intake_version<2&&lead.details){const pair=n("div",undefined,"leadDataRow");pair.append(n("dt","Detalle"),n("dd",lead.details));data.append(pair);}
  original.append(data);div.append(original);
  ensureDecision(lead,div);
  if(lead.decision_status==="avanzar"){
   const toggle=b(open.has(lead.id)?"Ocultar gestión":"Gestionar CV, correo, WhatsApp y reunión","crmManage");
   const workflow=n("div",undefined,"crmWorkflow");workflow.hidden=!open.has(lead.id);
   toggle.setAttribute("aria-expanded",String(!workflow.hidden));
   toggle.addEventListener("click",()=>{workflow.hidden=!workflow.hidden;if(workflow.hidden)open.delete(lead.id);else open.add(lead.id);toggle.textContent=workflow.hidden?"Gestionar CV, correo, WhatsApp y reunión":"Ocultar gestión";toggle.setAttribute("aria-expanded",String(!workflow.hidden));});
   cvStep(lead,workflow);meetingStep(lead,workflow);contactStep(lead,workflow);
   div.append(toggle,workflow);
   const stage=n("select");for(const [value,label] of [["nuevo","Nueva"],["en_evaluacion","En evaluación"],["contactado","Contactada"],["cerrado","Cerrada"]])stage.append(new Option(label,value));
   stage.value=lead.status||"nuevo";stage.addEventListener("change",async()=>{
    stage.disabled=true;try{await save(lead,{status:stage.value},"seguimiento_actualizado",{stage:stage.value});notice("Etapa de seguimiento actualizada.");}
    catch(e){notice(e.message,true);await load();}finally{stage.disabled=false;}
   });div.append(block("Etapa de seguimiento",stage));
  }
  historyBlock(lead,div);return div;
 }
 function render(){
  filters.replaceChildren();
  const counts={pendiente:leads.filter(x=>x.decision_status==="pendiente").length,
    avanzar:leads.filter(x=>x.decision_status==="avanzar").length,
    rechazada:leads.filter(x=>x.decision_status==="rechazada").length,todas:leads.length};
  for(const [key,label] of [["pendiente","Por decidir"],["avanzar","En seguimiento"],["rechazada","Rechazadas"],["todas","Todas"]]){
   const btn=b(label+" · "+counts[key]);btn.setAttribute("aria-pressed",String(filter===key));
   btn.addEventListener("click",()=>{filter=key;render();});filters.append(btn);
  }
  summary.textContent=counts.pendiente+" pendientes · "+counts.avanzar+" en seguimiento · "+counts.rechazada+" rechazadas";
  list.replaceChildren();const subset=leads.filter(x=>filter==="todas"||x.decision_status===filter);
  if(!subset.length){list.append(msg("No hay propuestas en esta categoría."));return;}
  for(const lead of subset)list.append(card(lead));
 }
 async function load(){
  const {data,error}=await sb.from("portfolio_cv_leads").select("*").order("created_at",{ascending:false}).limit(200);
  if(error){notice("No se pudieron cargar las solicitudes: "+error.message,true);return;}
  leads=(data||[]).map(x=>({...x,decision_status:x.decision_status||"pendiente"}));history=[];
  if(leads.length){
   const result=await sb.from("portfolio_cv_lead_activities").select("lead_id,event_type,created_at")
    .in("lead_id",leads.map(x=>x.id)).order("created_at",{ascending:false}).limit(2000);
   if(!result.error)history=result.data||[];
  }
  render();
 }
 return {load};
}
