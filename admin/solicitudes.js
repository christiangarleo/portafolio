/* CRM 2: gestión simple por solicitud. El correo se prepara en el cliente configurado;
   WhatsApp requiere confirmación en su app. No se afirma envío automático. */
export function createLeadCRM({sb,el,node,notice,getDocuments,loadDocuments,bucket}){
 const root=el("leads"),filters=el("leadFilters"),summary=el("leadSummary"),searchInput=el("leadSearch");
 let leads=[],events=[],activeFilter="pendiente",firstLoad=true,loaded=false;
 const expanded=new Set(), meetingExpanded=new Set(), editExpanded=new Set(), historyExpanded=new Set();
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
 searchInput.addEventListener("input",()=>render());
 function btn(text,cls){const x=n("button",text,cls);x.type="button";return x;}
 function row(cls="crmActions"){return n("div",undefined,cls);}
 function small(text,cls="crmHint"){return n("p",text,cls);}
 function when(v){return v?new Date(v).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"}):"—";}
 function value(v){if(Array.isArray(v))return v.map(x=>fieldValues[x]||x).join(", ");if(v===true)return "Sí";if(v===false)return "No";return fieldValues[v]||String(v??"");}
 function labeled(label,control){const wrap=n("div",undefined,"crmField"),lab=n("label",label);if(!control.id)control.id="crm-"+crypto.randomUUID();lab.htmlFor=control.id;wrap.append(lab,control);return wrap;}
 function action(button,work){button.addEventListener("click",async()=>{button.disabled=true;try{await work();}catch(e){notice(e.message||"No se pudo completar la acción.",true);}finally{button.disabled=false;}});}
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
 function mailto(lead,subject,body){
  const to=String(lead.email||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw Error("El contacto no tiene un correo válido.");
  const a=n("a");a.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  document.body.append(a);a.click();a.remove();
  notice("Se abrió un borrador en tu correo predeterminado (Zoho, si está configurado). Revisá y enviá desde allí; todavía no consta como enviado.");
  void audit(lead,"correo_abierto",{cv_id:doc(lead)?.id||null});
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
  if(lead.decision_status==="pendiente"){
   box.append(n("h4","¿Qué querés hacer?"));
   const accept=btn("Avanzar","crmAccept"),decline=btn("Rechazar","crmReject");
   accept.dataset.cgaIcon="check";decline.dataset.cgaIcon="close";
   action(accept,async()=>{expanded.add(lead.id);activeFilter="avanzar";await persist(lead,{decision_status:"avanzar",decision_at:new Date().toISOString(),decision_reason:null,status:"en_evaluacion"},"decision_avanzar");notice("Solicitud habilitada para seguimiento.");});
   decline.addEventListener("click",()=>{
    const note=n("textarea");note.placeholder="Motivo interno (opcional)";note.maxLength=500;note.rows=2;
    const yes=btn("Confirmar rechazo","crmReject"),cancel=btn("Cancelar");
    r.replaceChildren(labeled("Motivo del rechazo",note),yes,cancel);
    action(yes,async()=>{if(!confirm("¿Confirmás que querés rechazar esta solicitud?"))return;activeFilter="rechazada";
     await persist(lead,{decision_status:"rechazada",decision_at:new Date().toISOString(),decision_reason:note.value.trim()||null,status:"cerrado"},"decision_rechazada",{motivo:note.value.trim()});});
    cancel.addEventListener("click",()=>r.replaceChildren(accept,decline));
   });
   r.append(accept,decline);
  }else{
   box.append(small("Decisión: "+(labels[lead.decision_status]||lead.decision_status)+(lead.decision_at?" · "+when(lead.decision_at):"")));
   const reconsider=btn("Reconsiderar");reconsider.dataset.cgaIcon="refresh";
   action(reconsider,async()=>{if(!confirm("¿Volver esta solicitud a Por decidir?"))return;activeFilter="pendiente";
    await persist(lead,{decision_status:"pendiente",decision_at:null,decision_reason:null,status:"nuevo"},"decision_reconsiderada");});
   r.append(reconsider);
   if(lead.decision_status==="rechazada"){
    if(lead.decision_reason)box.append(small("Motivo interno: "+lead.decision_reason));
    const respond=btn("Responder rechazo por correo");respond.disabled=!allowed(lead);
    respond.addEventListener("click",()=>{const text=draft(lead,true);mailto(lead,text.subject,text.body);});
    r.prepend(respond);
   }
  }
  box.append(r);card.append(box);
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
   select.disabled=true;
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
   upload.disabled=true;upload.textContent="Subiendo…";
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
   finally{upload.disabled=false;upload.textContent="+ Subir PDF";inp.value="";}
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
    if(!confirm("¿Quitar la propuesta de reunión?"))return;
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
    if(!confirm("¿La empresa te autorizó después a contactarla? Registralo solo si ocurrió."))return;
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
  // Primero el editor, siempre visible; luego los proveedores de envío.
  section.append(labeled("Asunto",subject),labeled("Mensaje (editable)",body));
  section.append(n("h4","Elegí cómo preparar el envío"));
  const actions=row("crmDeliveryButtons");
  // Enlace directo y verificable: NO usa mailto ni el cliente predeterminado.
  const zoho=n("a","Zoho Mail ↗","crmAccept");
  zoho.href="https://mail.zoho.com/zm/#mail/folder/inbox";
  zoho.target="_blank";zoho.rel="noopener noreferrer";
  zoho.dataset.cgaIcon="mail";
  zoho.title="Abrir mail.zoho.com en una pestaña nueva";
  const gmail=btn("Gmail","crmAccent");gmail.dataset.cgaIcon="mail";
  const whatsapp=btn("WhatsApp","crmAccent");whatsapp.dataset.cgaIcon="chat";
  const number=waNumber(lead),email=String(lead.email||"").trim();
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  gmail.disabled=!validEmail;
  whatsapp.disabled=!number;
  const zohoHelp=n("div",undefined,"crmZohoHelp");
  zohoHelp.hidden=true;
  const helpTitle=n("strong","Prepará el correo en Zoho Mail");
  const helpText=small("Se abre la bandeja de Zoho Mail en otra pestaña. Usá Nuevo mensaje y copiá los datos desde acá. Todavía no hay conexión con la API de Zoho.");
  const copyActions=row("crmCopyActions");
  async function copyValue(value,label){
    try{
      if(!navigator.clipboard?.writeText)throw Error("clipboard-unavailable");
      await navigator.clipboard.writeText(value);
      notice(label+" copiado.");
    }catch{
      window.prompt("Copiá "+label.toLowerCase()+":",value);
    }
  }
  for(const [label,getValue] of [
   ["Copiar destinatario",()=>email],
   ["Copiar asunto",()=>subject.value],
   ["Copiar mensaje",()=>body.value]
  ]){
   const copy=btn(label,"crmSoftCopy");copy.dataset.cgaIcon="files";
   copy.addEventListener("click",()=>void copyValue(getValue(),label.replace("Copiar ","")));
   copyActions.append(copy);
  }
  zohoHelp.append(helpTitle,helpText,copyActions);
  zoho.addEventListener("click",()=>{
   // Se navega por el href real del <a>, no por mailto ni window.open.
   zohoHelp.hidden=false;
   notice("Se abrió mail.zoho.com en otra pestaña. Desde Zoho, creá un correo y pegá los datos preparados.");
   void audit(lead,"zoho_abierto",{cv_id:current?.id||null});
  });
  gmail.addEventListener("click",()=>{
   const url="https://mail.google.com/mail/?view=cm&fs=1&to="+encodeURIComponent(email)+
     "&su="+encodeURIComponent(subject.value)+"&body="+encodeURIComponent(body.value);
   window.open(url,"_blank","noopener,noreferrer,width=1100,height=760");
   notice("Gmail se abrió aparte con el borrador preparado. Confirmá el envío desde Gmail.");
   void audit(lead,"gmail_abierto",{cv_id:current?.id||null});
  });
  whatsapp.addEventListener("click",()=>{
   window.open("https://wa.me/"+number+"?text="+encodeURIComponent(body.value),"_blank","noopener,noreferrer");
   notice("WhatsApp se abrió con el mensaje preparado. Enviá allí y luego confirmá con el interruptor.");
   void audit(lead,"whatsapp_abierto",{cv_id:current?.id||null});

  });
  actions.append(zoho,gmail,whatsapp);
  section.append(actions,zohoHelp);
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
    const prompt=checked?"¿Confirmás que enviaste realmente "+kind+"?":"¿Quitar la confirmación de envío de "+kind+"?";
    if(!confirm(prompt)){control.checked=!checked;return;}
    control.disabled=true;
    try{
     await persist(lead,{[field]:checked?new Date().toISOString():null,
      ...(checked?{status:"contactado"}:{})},
      checked?confirmedEvent:undoEvent);
     notice(checked?"Envío confirmado.":"Confirmación retirada.");
    }catch(err){control.checked=!checked;notice(err.message,true);}
    finally{control.disabled=false;}
   });
   return wrap;
  }
  const mailStatus=deliverySwitch("el correo","Ya envié el correo","email_sent_at",lead.email_sent_at,
    "correo_confirmado_enviado","correo_confirmacion_retirada");
  const waStatus=deliverySwitch("el WhatsApp","Ya envié por WhatsApp","whatsapp_sent_at",lead.whatsapp_sent_at,
    "whatsapp_confirmado_enviado","whatsapp_confirmacion_retirada");
  // Siempre visibles, incluso si el número de teléfono aún no está registrado.
  // Abrir un proveedor no marca un mensaje como enviado.
  confirmations.append(mailStatus,waStatus);
  section.append(confirmations);
  if(!number)section.append(small("No hay un teléfono válido. Podés agregarlo arriba para abrir WhatsApp. Si ya lo enviaste por otra vía, registrá la confirmación manualmente."));
  section.append(small("Abrir Zoho, Gmail o WhatsApp no envía mensajes automáticamente. Activá cada switch solo cuando hayas enviado el mensaje."));
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
   telefono_contacto_actualizado:"Teléfono actualizado",seguimiento_actualizado:"Etapa actualizada"};
  const ul=n("ul");
  for(const e of eventsOfLead.slice(0,30))ul.append(n("li",when(e.created_at)+" · "+(eventNames[e.event_type]||e.event_type)));
  if(!eventsOfLead.length)ul.append(n("li","Todavía no hay movimientos."));
  details.append(ul);card.append(details);
 }
 function leadCard(lead){
  const card=n("article",undefined,"crmCard"),head=n("div",undefined,"crmHeader"),title=n("div");
  title.append(n("strong",(kinds[lead.kind]||lead.kind)+" · "+lead.company_name));
  title.append(n("small",(lead.contact_name||"")+" · "+lead.email+" · "+(lead.phone||"Sin teléfono")+" · "+
   (lead.position_or_project||"Propuesta")+" · "+when(lead.created_at)));
  const badge=n("span",labels[lead.decision_status]||"Por decidir","crmBadge");badge.dataset.state=lead.decision_status;
  head.append(title,badge);card.append(head);
  original(lead,card);decision(lead,card);
  if(lead.decision_status==="avanzar"){
   const toggle=btn(expanded.has(lead.id)?"Ocultar":"Gestionar","crmManage");toggle.dataset.cgaIcon="arrow";
   const area=n("div",undefined,"crmWorkflow");area.hidden=!expanded.has(lead.id);
   toggle.setAttribute("aria-expanded",String(!area.hidden));
   toggle.addEventListener("click",()=>{
    area.hidden=!area.hidden;
    if(area.hidden)expanded.delete(lead.id);else expanded.add(lead.id);
    toggle.textContent=area.hidden?"Gestionar":"Ocultar";
    toggle.setAttribute("aria-expanded",String(!area.hidden));
   });
   cvSection(lead,area);meetingSection(lead,area);messageSection(lead,area);
   const select=n("select");
   for(const [key,text] of [["nuevo","Nueva"],["en_evaluacion","En evaluación"],["contactado","Contactada"],["cerrado","Cerrada"]])
    select.append(new Option(text,key));
   select.value=lead.status||"nuevo";
   select.addEventListener("change",async()=>{
    select.disabled=true;try{await persist(lead,{status:select.value},"seguimiento_actualizado",{etapa:select.value});notice("Seguimiento actualizado.");}
    catch(e){notice(e.message,true);await load();}
   });
   const status=n("details",undefined,"crmStage");status.append(n("summary","Estado: "+select.selectedOptions[0]?.textContent),labeled("Etapa interna",select));
   area.append(status);card.append(toggle,area);
  }
  archive(lead,card);return card;
 }
 function render(){
  const count={pendiente:leads.filter(x=>x.decision_status==="pendiente").length,
   avanzar:leads.filter(x=>x.decision_status==="avanzar").length,
   rechazada:leads.filter(x=>x.decision_status==="rechazada").length,todas:leads.length};
  filters.replaceChildren();
  for(const [key,label] of [["pendiente","Por decidir"],["avanzar","En seguimiento"],["rechazada","Rechazadas"],["todas","Todas"]]){
   const x=btn(label+" · "+count[key]);x.setAttribute("aria-pressed",String(activeFilter===key));
   x.addEventListener("click",()=>{activeFilter=key;render();});filters.append(x);
  }
  summary.textContent=count.pendiente+" pendientes · "+count.avanzar+" en seguimiento · "+count.rechazada+" rechazadas";
  root.replaceChildren();
  const query=searchInput.value.trim().toLocaleLowerCase();
  const subset=leads.filter(x=>activeFilter==="todas"||x.decision_status===activeFilter);
  const selected=subset.filter(x=>!query||[
    x.company_name,x.contact_name,x.email,x.position_or_project,x.ruc,x.phone,x.kind
  ].some(text=>String(text||"").toLocaleLowerCase().includes(query)));
  if(!selected.length){
    const empty=small(query?"No se encontraron solicitudes con esa búsqueda.":"No hay solicitudes en esta bandeja.");
    root.append(empty);
    if(query){const reset=btn("Limpiar búsqueda");reset.dataset.cgaIcon="refresh";
      reset.addEventListener("click",()=>{searchInput.value="";render();searchInput.focus();});root.append(reset);}
    window.CGAIcons?.decorate(root);
    return;
  }
  for(const lead of selected)root.append(leadCard(lead));
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
    if(accepted.length===1)expanded.add(accepted[0].id);
   }else if(!pending.length&&leads.length)activeFilter="todas";
  }
  if(leads.length){
   const {data:activities,error:activityError}=await sb.from("portfolio_cv_lead_activities")
     .select("lead_id,event_type,created_at").in("lead_id",leads.map(x=>x.id))
     .order("created_at",{ascending:false}).limit(2000);
   if(!activityError)events=activities||[];
  }
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
