(() => {
  "use strict";
  const endpoint = "https://gprhevdotoykofrxbufv.supabase.co/functions/v1/portfolio-cv-portal";
  const by = id => document.getElementById(id);
  const ruc = new URLSearchParams(location.search).get("ruc") || "";
  const loading = by("loading");
  const message = by("downloadMessage");
  let items = [];
  function show(section) {
    for (const id of ["loading","companySection","emptySection","invalidSection"]) by(id).hidden = id !== section;
  }
  function setMessage(where, text, error = false) {
    where.replaceChildren(document.createTextNode(text));
    where.dataset.error = String(error);
  }
  function element(tag,text,cls) {
    const el=document.createElement(tag);
    if(text !== undefined)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  }
  async function api(body) {
    const response = await fetch(endpoint,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),cache:"no-store"
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||"No se pudo consultar el servicio");
    return data;
  }
  function displayCompany(data) {
    by("companyTitle").textContent=data.company;
    by("companyDescription").textContent=
      "Postulaciones de Christian Gabriel Arleo vinculadas al RUC " + ruc + ". Consultá cada vacante y su CV correspondiente.";
    document.title=data.company+" | Portal de postulaciones";
    const wrap=by("vacancies");
    wrap.replaceChildren();
    items=data.items||[];
    const count=items.filter(x=>x.available).length;
    by("count").textContent=count+" "+(count===1?"CV vigente":"CV vigentes")+" · "+items.length+" "+(items.length===1?"vacante":"vacantes");
    for (const x of items) {
      const card=element("article",undefined,"card"+(x.available?"":" expired"));
      const top=element("div",undefined,"card-top");
      top.append(element("span",x.available?"CV disponible":"CV vencido","tag"+(x.available?" current":" expired")));
      const title=element("h3",x.position||"CV personalizado");
      const expiry=element("small",x.expires_at
        ? "Vigencia: "+new Date(x.expires_at).toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"})
        : "Sin fecha de vencimiento");
      const button=element("button",x.available?"Descargar CV ↓":"Descarga no disponible","action");
      button.type="button";button.disabled=!x.available;
      button.dataset.cvId=x.id;
      card.append(top,title,expiry,button);wrap.append(card);
    }
    show("companySection");
    if (count === 0) {
      // Conservar el historial de vacantes vencidas, y ofrecer contacto sin abandonar el portal.
      by("emptySection").hidden = false;
      by("emptySection").querySelector("h2").textContent = "Los CV de esta empresa están vencidos";
    }
  }
  async function downloadCv(button) {
    if(button.disabled)return;
    button.disabled=true;
    setMessage(message,"Preparando descarga del CV…");
    try {
      const data=await api({action:"download",ruc,id:button.dataset.cvId});
      if(data.status!=="ready" || !data.url) throw Error("El CV no está disponible");
      const a=document.createElement("a");
      a.href=data.url;a.target="_blank";a.rel="noopener noreferrer";
      a.textContent="Descargar CV ahora";
      message.replaceChildren(document.createTextNode("CV preparado. "),a);
      // El enlace manual permanece visible si el navegador bloquea la apertura.
      a.click();
    }catch(error){setMessage(message,error.message||"No se pudo obtener el CV.",true);}
    finally{button.disabled=false;}
  }
  by("vacancies").addEventListener("click",event=>{
    const button=event.target.closest("button[data-cv-id]");
    if(button)downloadCv(button);
  });
  const form=by("leadForm");
  const headingByKind={in_house:"Contratación In-house",proyecto:"Contratación por proyecto"};
  function setMessageForForm(text,isError=false){
    const status=by("formError");
    status.textContent=isError?text:"";
    status.dataset.error=String(isError);
    setMessage(by("leadMessage"),isError?"":text);
  }
  function sectionVisible(id,visible){
    const block=by(id);block.hidden=!visible;
    // Los campos condicionales no se envían ni validan mientras están ocultos.
    for(const control of block.querySelectorAll("input,select,textarea"))control.disabled=!visible;
  }
  function require(id,required){by(id).required=required;}
  function updateHours(){
    const show=["part_time","por_horas"].includes(by("dedication").value);
    sectionVisible("hoursFields",show);require("hours",show);
  }
  function updateLocation(prefix){
    const mode=by(prefix==="ih"?"ihWorkMode":"pjWorkMode").value;
    const loc=mode==="presencial"||mode==="hibrido";
    sectionVisible(prefix+"Location",loc);
    for(const id of prefix==="ih"?["ihCountry","ihCity","ihDistrict"]:["pjCountry","pjCity","pjDistrict"])require(id,loc);
    if(prefix==="ih")sectionVisible("ihHybridDays",mode==="hibrido");
  }
  function updateSchedule(){
    const specified=!by("scheduleTbd").checked;
    sectionVisible("scheduleFields",specified);
    require("dailyStart",specified);require("dailyEnd",specified);
  }
  function updateDeadline(){
    const specified=!by("deadlineTbd").checked;
    by("dueDate").disabled=!specified;
    by("dueDate").required=specified;
    if(!specified)by("dueDate").value="";
  }
  function updateContact(){
    const preference=form.querySelector('input[name="contact_preference"]:checked')?.value;
    const shouldContact=preference==="contactame";
    sectionVisible("contactExtra",shouldContact);
    require("contactMethod",shouldContact);
    const phoneNeeded=shouldContact&&["whatsapp","llamada"].includes(by("contactMethod").value);
    by("phoneHint").hidden=!phoneNeeded;
  }
  function stage(stageIndex){
    by("stepContact").hidden=stageIndex!==1;
    by("stepDetails").hidden=stageIndex!==2;
    by("stageLabel1").classList.toggle("active",stageIndex===1);
    by("stageLabel2").classList.toggle("active",stageIndex===2);
    by("formError").textContent="";
  }
  by("choices").addEventListener("click",event=>{
    const button=event.target.closest("button[data-kind]");
    if(!button)return;
    const kind=button.dataset.kind;
    if(!headingByKind[kind])return;
    form.reset();
    by("rucField").value=ruc;
    by("leadKind").value=kind;
    by("leadTitle").textContent=headingByKind[kind];
    by("inhouseFields").hidden=kind!=="in_house";
    by("projectFields").hidden=kind!=="proyecto";
    by("inhouseFields").disabled=kind!=="in_house";
    by("projectFields").disabled=kind!=="proyecto";
    updateHours();updateLocation("ih");updateLocation("pj");
    updateSchedule();updateDeadline();updateContact();
    for(const choice of by("choices").querySelectorAll("button"))choice.setAttribute("aria-pressed",String(choice===button));
    form.hidden=false;
    stage(1);
    by("companyName").focus();
  });
  by("dedication").addEventListener("change",updateHours);
  by("ihWorkMode").addEventListener("change",()=>updateLocation("ih"));
  by("pjWorkMode").addEventListener("change",()=>updateLocation("pj"));
  by("scheduleTbd").addEventListener("change",updateSchedule);
  by("deadlineTbd").addEventListener("change",updateDeadline);
  form.querySelectorAll('input[name="contact_preference"]').forEach(x=>x.addEventListener("change",updateContact));
  by("contactMethod").addEventListener("change",updateContact);
  by("nextStep").addEventListener("click",()=>{
    const fields=[...by("stepContact").querySelectorAll("input,select,textarea")];
    for(const field of fields)if(!field.checkValidity()){field.reportValidity();field.focus();return;}
    stage(2);by("stepDetails").scrollIntoView({block:"nearest",behavior:"instant"});
  });
  by("prevStep").addEventListener("click",()=>{stage(1);by("stepContact").scrollIntoView({block:"nearest",behavior:"instant"});});
  function collect(){
    const fd=new FormData(form),get=k=>String(fd.get(k)||"").trim(),multi=k=>fd.getAll(k).map(String);
    const kind=get("kind");
    const payload={
      action:"lead_v2",
      kind,website:get("website"),
      company_name:get("company_name"),ruc,contact_name:get("contact_name"),
      email:get("email"),phone:get("phone"),
      position_or_project:kind==="in_house"?get("position_or_project"):get("project_name"),
      contact_preference:get("contact_preference"),
      contact_method:get("contact_method"),contact_time:get("contact_time"),
      observations:get("observations"),
      intake:kind==="in_house"?{
        position:get("position_or_project"),dedication:get("dedication"),
        hours:get("hours")?Number(get("hours")):null,hours_period:get("hours_period"),
        work_mode:get("work_mode"),work_country:get("work_country"),
        work_city:get("work_city"),work_district:get("work_district"),
        work_days:multi("work_days"),office_days:multi("office_days"),
        timezone:get("timezone"),schedule_tbd:get("schedule_tbd")==="true",
        daily_start:get("daily_start"),daily_end:get("daily_end"),
        start_date:get("start_date"),salary:get("salary"),responsibilities:get("responsibilities")
      }:{
        project_name:get("project_name"),project_area:get("project_area"),
        problem:get("problem"),outcome:get("outcome"),deliverables:get("deliverables"),
        start_date:get("start_date"),due_date:get("due_date"),
        deadline_tbd:get("deadline_tbd")==="true",budget:get("budget"),
        work_mode:get("work_mode"),work_country:get("work_country"),
        work_city:get("work_city"),work_district:get("work_district"),
        reference_url:get("reference_url")
      }
    };
    return payload;
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(by("stepDetails").hidden){stage(2);return;}
    const payload=collect();
    if(payload.kind==="in_house"){
      if(!payload.intake.work_days.length){setMessageForForm("Seleccioná al menos un día de trabajo.",true);by("workDays").scrollIntoView({block:"nearest"});return;}
      if(payload.intake.work_mode==="hibrido"&&!payload.intake.office_days.length){
        setMessageForForm("Seleccioná los días en que se requiere presencialidad.",true);
        by("officeDays").scrollIntoView({block:"nearest"});return;
      }
    }
    if(payload.contact_preference==="contactame" && ["whatsapp","llamada"].includes(payload.contact_method) && !payload.phone){
      setMessageForForm("Para recibir una llamada o WhatsApp, completá tu teléfono en el primer paso.",true);
      stage(1);by("phone").required=true;by("phone").focus();return;
    }
    // La preferencia es si desea que Christian contacte; la segunda opción
    // indica que la empresa tomará la iniciativa. No se presupone autorización.
    if(!form.reportValidity())return;
    const btn=by("submitLead");btn.disabled=true;
    setMessageForForm("Enviando propuesta…");
    try{
      const response=await api(payload);
      if(response.status!=="received")throw Error("No se pudo registrar tu propuesta.");
      form.hidden=true;by("choices").hidden=true;
      by("requestHeading").textContent="Propuesta recibida";
      by("requestIntro").textContent="Gracias por tu interés. Tu propuesta quedó registrada correctamente.";
      const responseText=payload.contact_preference==="contactame"
        ?"Tomaré en cuenta el medio de contacto y el horario que elegiste."
        :"Queda registrado que la empresa prefiere comunicarse conmigo por su cuenta.";
      const success=element("p",responseText,"sub");
      by("emptySection").append(success);
    }catch(error){setMessageForForm(error.message||"No se pudo enviar la propuesta.",true);}
    finally{btn.disabled=false;}
  });
  async function init(){
    if(!/^\d{11}$/.test(ruc)){show("invalidSection");return;}
    by("rucField").value=ruc;
    try {
      const data=await api({action:"resolve",ruc});
      if(data.status==="company"&&Array.isArray(data.items)&&data.items.length)displayCompany(data);
      else if(data.status==="not_found") {
        by("companyDescription").textContent="Todavía no hay CV asociados a ese RUC.";
        show("emptySection");
      } else throw Error("Respuesta del servicio no reconocida");
    } catch(error) {
      loading.textContent="No pudimos cargar el portal. "+(error.message||"Volvé a intentarlo.")+" ";
      const retry=element("button","Reintentar","secondary");
      retry.type="button";retry.addEventListener("click",()=>{loading.textContent="Consultando…";init();});
      loading.append(retry);
      show("loading");
    }
  }
  init();
})();