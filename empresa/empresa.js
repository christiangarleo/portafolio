(() => {
  "use strict";
  const endpoint = "https://gprhevdotoykofrxbufv.supabase.co/functions/v1/portfolio-cv-portal";
  const by = id => document.getElementById(id);
  const locale = window.CGALang?.current==="es"?"es":"en";
  const t = value => window.CGALang?.t(value) ?? value;
  const params = new URLSearchParams(location.search);
  const ruc = (params.get("ruc")||"").trim().replace(/\s+/g," ").toUpperCase();
  const selectedCV = params.get("cv") || "";
  const loading = by("loading");
  const message = by("downloadMessage");
  let items = [];
  let companyOnFile = "";
  let currentFilter="all";
  function updateCVFilters(){
    const search=by("companySearchInput").value.trim().toLocaleLowerCase();
    const cards=[...by("vacancies").querySelectorAll("article.card")];
    let visible=0;
    for(const card of cards){
      const isAvailable=!card.classList.contains("expired");
      const matches=!search||(card.querySelector("h3")?.textContent||"").toLocaleLowerCase().includes(search);
      const show=matches&&(currentFilter==="all"||isAvailable);
      card.hidden=!show;
      if(show)visible++;
    }
    by("filterAllCV").setAttribute("aria-pressed",String(currentFilter==="all"));
    by("filterActiveCV").setAttribute("aria-pressed",String(currentFilter==="active"));
    by("filteredCVCount").textContent=locale==="en"
      ? "Showing "+visible+" of "+cards.length+" positions"
      : "Mostrando "+visible+" de "+cards.length+" vacantes";
    by("emptyCVSearch").hidden=visible>0;
  }
  by("companySearchInput").addEventListener("input",updateCVFilters);
  by("filterAllCV").addEventListener("click",()=>{currentFilter="all";updateCVFilters();});
  by("filterActiveCV").addEventListener("click",()=>{currentFilter="active";updateCVFilters();});

  function show(section) {
    for (const id of ["loading","companySection","emptySection","invalidSection"]) by(id).hidden = id !== section;
  }
  function setMessage(where, text, error = false) {
    where.replaceChildren(document.createTextNode(t(text)));
    where.dataset.error = String(error);
  }
  function element(tag,text,cls) {
    const el=document.createElement(tag);
    if(text !== undefined)el.textContent=t(text);
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
    companyOnFile=data.company;
    by("companyDescription").textContent=locale==="en"
      ? "Christian Gabriel Arleo's CVs for positions at your company · Company ID: "+ruc
      : "Postulaciones de Christian Gabriel Arleo vinculadas al identificador de empresa "+ruc+". Consultá cada vacante y su CV correspondiente.";
    document.title=data.company+(locale==="en"?" | Applications":" | Portal de postulaciones");
    const wrap=by("vacancies");
    wrap.replaceChildren();
    items=data.items||[];
    const count=items.filter(x=>x.available).length;
    by("count").textContent=locale==="en"
      ? count+" "+(count===1?"active CV":"active CVs")+" · "+items.length+" "+(items.length===1?"position":"positions")
      : count+" "+(count===1?"CV vigente":"CV vigentes")+" · "+items.length+" "+(items.length===1?"vacante":"vacantes");
    for (const x of items) {
      const card=element("article",undefined,"card"+(x.available?"":" expired")+(selectedCV===x.id?" selectedCV":""));
      if(selectedCV===x.id)card.id="selected-cv";
      const top=element("div",undefined,"card-top");
      top.append(element("span",x.available?"CV disponible":"CV vencido","tag"+(x.available?" current":" expired")));
      const title=element("h3",x.position||"CV personalizado");
      const expiry=element("small",x.expires_at
        ? (locale==="en"?"Valid until: ":"Vigencia: ")+new Date(x.expires_at).toLocaleDateString(locale==="en"?"en-GB":"es-PE",{day:"2-digit",month:"short",year:"numeric"})
        : "Sin fecha de vencimiento");
      const button=element("button",x.available?"Descargar CV ↓":"Descarga no disponible","action");
      button.type="button";button.disabled=!x.available;
      button.dataset.cvId=x.id;
      card.append(top,title,expiry,button);wrap.append(card);
    }
    updateCVFilters();
    show("companySection");
    if(selectedCV){const featured=by("selected-cv");if(featured)requestAnimationFrame(()=>featured.scrollIntoView({behavior:"smooth",block:"center"}));}
    // El contacto comercial es accesible siempre, incluso si la empresa tiene CV vigentes.
    by("emptySection").hidden=false;
    by("requestHeading").textContent=t(count===0
      ? "¿Te interesa proponer una contratación?"
      : "¿Querés contratarme o conversar sobre un proyecto?");
    by("requestIntro").textContent=t("Elegí una opción y dejame los datos esenciales. Los detalles los conversamos después.");
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
  const titles={
    in_house:["Invitar a una entrevista","Dejame la vacante y tus datos de contacto."],
    proyecto:["Conversemos sobre tu proyecto","Contame qué necesitás con un par de clics."]
  };
  function formError(text){
    by("formError").textContent=t(text);
    if(text)by("formError").scrollIntoView({block:"nearest"});
  }
  function contactVisibility(){
    const pref=form.querySelector('input[name="contact_preference"]:checked')?.value;
    const showMethod=pref==="contactame";
    by("contactExtra").hidden=!showMethod;
    const method=form.querySelector('input[name="contact_method"]:checked')?.value;
    const showPhone=showMethod && ["whatsapp","llamada"].includes(method);
    by("phoneField").hidden=!showPhone;
    by("phone").required=showPhone;
    if(!showPhone)by("phone").value="";
  }
  by("choices").addEventListener("click",event=>{
    const button=event.target.closest("button[data-kind]");
    if(!button||!titles[button.dataset.kind])return;
    const kind=button.dataset.kind;
    form.reset();
    by("leadKind").value=kind;
    by("rucField").value=ruc;
    by("companyName").value=companyOnFile;
    by("inhouseFields").hidden=kind!=="in_house";
    by("projectFields").hidden=kind!=="proyecto";
    by("vacancyField").hidden=kind!=="in_house";
    by("jobRole").required=kind==="in_house";
    by("leadTitle").textContent=t(titles[kind][0]);
    by("leadSubtitle").textContent=t(titles[kind][1]);
    by("submitLead").textContent=t(kind==="in_house"?"Enviar invitación":"Proponer proyecto");
    by("moreInfo").open=false;
    for(const item of by("choices").querySelectorAll("button")){
      item.setAttribute("aria-pressed",String(item===button));
    }
    formError("");
    by("leadMessage").textContent="";
    contactVisibility();
    form.hidden=false;
    by("companyName").focus({preventScroll:true});
    form.scrollIntoView({block:"start",behavior:"smooth"});
  });
  form.querySelectorAll('input[name="contact_preference"],input[name="contact_method"]').forEach(
    radio=>radio.addEventListener("change",contactVisibility)
  );
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    formError("");
    const values=new FormData(form);
    const get=key=>String(values.get(key)||"").trim();
    const kind=get("kind");
    if(!titles[kind]){formError("Elegí el tipo de contratación.");return;}
    if(!form.reportValidity())return;
    let position="", intake={};
    if(kind==="in_house"){
      position=get("position");
      const dedication=get("dedication"), workMode=get("work_mode");
      if(!position || !dedication || !workMode){
        formError("Completá la vacante, la dedicación y la modalidad de trabajo.");
        return;
      }
      intake={position,dedication,work_mode:workMode};
    }else{
      const need=get("project_need"),timing=get("project_timing");
      if(!need || !timing){
        formError("Seleccioná qué necesitás resolver y para cuándo.");
        return;
      }
      intake={project_need:need,project_timing:timing};
    }
    const preference=get("contact_preference");
    if(!preference){formError("Elegí cómo preferís continuar el contacto.");return;}
    const method=preference==="contactame"?get("contact_method"):"";
    const phone=method==="whatsapp"||method==="llamada"?get("phone"):"";
    if(preference==="contactame" && (!method || ((method==="whatsapp"||method==="llamada")&&phone.length<6))){
      formError("Seleccioná cómo contactarte y completá el teléfono si corresponde.");return;
    }
    const payload={
      action:"lead_v3",kind,language:locale,
      website:get("website"),company_name:get("company_name"),ruc,
      contact_name:get("contact_name"),email:get("email"),phone,
      contact_preference:preference,contact_method:method,
      observations:get("observations"),intake
    };
    const submit=by("submitLead");submit.disabled=true;
    setMessage(by("leadMessage"),"Registrando propuesta…");
    try{
      const reply=await api(payload);
      if(reply.status!=="received")throw Error("No se pudo registrar la propuesta.");
      form.hidden=true;
      by("choices").hidden=true;
      by("requestHeading").textContent=t("Propuesta recibida");
      by("requestIntro").textContent=t("Gracias. Tu propuesta quedó registrada correctamente.");
      const contactMessage=preference==="contactame"
        ?"Voy a tener en cuenta el medio de contacto que seleccionaste."
        :"Quedó registrado que la empresa se comunicará por su cuenta.";
      const existing=by("requestSuccess");
      if(existing)existing.remove();
      const note=element("p",contactMessage,"sub");
      note.id="requestSuccess";
      by("emptySection").append(note);
      by("emptySection").scrollIntoView({block:"nearest",behavior:"smooth"});
    }catch(error){
      setMessage(by("leadMessage"),"",false);
      formError(error.message||"No se pudo enviar la propuesta. Intentá nuevamente.");
    }finally{
      submit.disabled=false;
    }
  });
  async function init(){
    if(!/^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]{0,63}$/u.test(ruc)){show("invalidSection");return;}
    by("rucField").value=ruc;
    try {
      const data=await api({action:"resolve",ruc});
      if(data.status==="company"&&Array.isArray(data.items)&&data.items.length)displayCompany(data);
      else if(data.status==="not_found") {
        by("companyDescription").textContent=t("Todavía no hay CV asociados a ese identificador.");
        show("emptySection");
      } else throw Error("Respuesta del servicio no reconocida");
    } catch(error) {
      loading.textContent=locale==="en"?"Could not load the portal. Please try again. ":"No pudimos cargar el portal. "+(error.message||"Volvé a intentarlo.")+" ";
      const retry=element("button","Reintentar","secondary");
      retry.type="button";retry.addEventListener("click",()=>{loading.textContent=locale==="en"?"Checking…":"Consultando…";init();});
      loading.append(retry);
      show("loading");
    }
  }
  init();
})();