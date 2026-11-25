(() => {
  "use strict";
  const endpoint = "https://gprhevdotoykofrxbufv.supabase.co/functions/v1/portfolio-cv-portal";
  const by = id => document.getElementById(id);
  const locale = window.CGALang?.current==="es"?"es":"en";
  const t = value => window.CGALang?.t(value) ?? value;
  const params = new URLSearchParams(location.search);
  let ruc = (params.get("ruc")||"").trim().replace(/\s+/g," ").toUpperCase();
  const selectedCV = params.get("cv") || "";
  const loading = by("loading");
  const message = by("downloadMessage");
  const portfolioBack="/portafolio/?lang="+locale;
  for(const id of ["returnPortfolio","invalidBackPortfolio","missingCVBack","successBackPortfolio"]){
    const link=by(id);if(link)link.href=portfolioBack;
  }
  const missingDialog=by("missingCVDialog");
  const missingEdit=by("missingCVEdit");
  const missingInput=by("missingCVNewId");
  const companyIdValid=id=>/^[\p{L}\p{N}][\p{L}\p{N} ._/#&()-]{0,63}$/u.test(id);
  by("missingCVContinue").addEventListener("click",()=>{
    missingDialog.close();
    by("choices").querySelector("button")?.focus();
  });
  by("missingCVModify").addEventListener("click",()=>{
    missingEdit.hidden=false;
    missingInput.value=ruc;
    missingInput.focus();
    missingInput.select();
  });
  by("missingCVEditForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const proposed=missingInput.value.trim().replace(/\s+/g," ").toUpperCase();
    if(!companyIdValid(proposed)){
      by("missingCVError").textContent=t("Ingresá un identificador de empresa válido (hasta 64 caracteres).");return;
    }
    const submit=by("missingCVEditForm").querySelector('[type="submit"]');
    submit.disabled=true;
    by("missingCVError").textContent="";
    try{
      // Verificar cada nuevo identificador antes de salir del diálogo; incluso
      // en el segundo o tercer intento se vuelve a mostrar el aviso.
      const found=await api({action:"resolve",ruc:proposed});
      const url=new URL("/empresa/",location.origin);
      url.searchParams.set("ruc",proposed);
      url.searchParams.set("lang",locale);
      if(found.status==="company"&&Array.isArray(found.items)&&found.items.length){
        window.location.assign(url.pathname+url.search);
        return;
      }
      if(found.status!=="not_found")throw Error(t("No pudimos verificar ese identificador."));
      ruc=proposed;
      history.replaceState(null,"",url.pathname+url.search);
      by("rucField").value=ruc;
      by("companyDescription").textContent=t("Todavía no hay CV asociados a ese identificador.");
      show("emptySection");
      showNoCVDialog();
      by("missingCVContinue").focus();
    }catch(error){
      by("missingCVError").textContent=error.message||t("No pudimos verificar ese identificador.");
    }finally{submit.disabled=false;}
  });
  function showNoCVDialog(){
    by("missingCVIdentifier").textContent=ruc;
    missingEdit.hidden=true;
    by("missingCVError").textContent="";
    if(!missingDialog.open)missingDialog.showModal();
  }

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
    if(!response.ok) throw new Error(data.code==="security_required"?securityText("No se pudo verificar la seguridad. Reintentá la verificación.","Security verification failed. Please retry."):(data.code==="security_unavailable"?securityText("La verificación no está disponible temporalmente. Reintentá o contactame por correo.","Security verification is temporarily unavailable. Retry or contact me by email."):(data.error||"No se pudo consultar el servicio")));
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

  const securitySiteKey="0x4AAAAAAGS2dS2Weiufk6-5";
  const securityStatus=by("leadSecurityStatus"),securityRetry=by("leadSecurityRetry"),securityContainer=by("leadTurnstile");
  const securityText=(es,en)=>locale==="es"?es:en;
  securityRetry.textContent=securityText("Reintentar verificación","Retry verification");
  securityContainer.setAttribute("aria-label",securityText("Verificación de seguridad","Security verification"));
  let securityLoad=null,securityWidget=null,securityToken="",securityGeneration=0,leadSubmitting=false;
  function loadSecurity(){
    if(window.turnstile?.render)return Promise.resolve(window.turnstile);
    if(securityLoad)return securityLoad;
    securityLoad=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
      const timer=setTimeout(fail,15000);
      function fail(){clearTimeout(timer);script.remove();reject(Error("turnstile_load"));}
      script.onload=()=>{clearTimeout(timer);if(window.turnstile?.render)resolve(window.turnstile);else fail();};
      script.onerror=fail;document.head.append(script);
    }).catch(error=>{securityLoad=null;throw error;});
    return securityLoad;
  }
  function securityPending(message,retry=false){securityToken="";securityStatus.textContent=message;securityRetry.hidden=!retry;}
  async function prepareSecurity(){
    const generation=++securityGeneration;
    securityPending(securityText("Cargando verificación de seguridad…","Loading security verification…"));
    if(securityWidget!==null){try{window.turnstile?.remove(securityWidget);}catch{}securityWidget=null;}
    securityContainer.replaceChildren();
    try{
      const ts=await loadSecurity();
      if(generation!==securityGeneration||form.hidden)return;
      securityWidget=ts.render(securityContainer,{
        sitekey:securitySiteKey,action:"portfolio_lead",language:locale,
        theme:document.documentElement.dataset.theme==="dark"?"dark":"light",
        size:"flexible",appearance:"interaction-only",retry:"never",
        callback:token=>{if(generation!==securityGeneration)return;securityToken=token;securityStatus.textContent="";securityRetry.hidden=true;},
        "error-callback":()=>{if(generation!==securityGeneration)return;securityPending(securityText("No pudimos verificar la seguridad. Volvé a intentarlo.","Security verification failed. Please retry."),true);},
        "expired-callback":()=>{if(generation!==securityGeneration)return;securityPending(securityText("La verificación venció. Volvé a intentarlo.","Verification expired. Please retry."),true);},
        "timeout-callback":()=>{if(generation!==securityGeneration)return;securityPending(securityText("La verificación tardó demasiado. Volvé a intentarlo.","Verification timed out. Please retry."),true);}
      });
    }catch{if(generation===securityGeneration)securityPending(securityText("No se pudo cargar la verificación. Reintentá o contactame por correo.","Could not load verification. Retry or contact me by email."),true);}
  }
  securityRetry.addEventListener("click",()=>{if(!leadSubmitting)void prepareSecurity();});

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
    if(!button||!titles[button.dataset.kind]||leadSubmitting)return;
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
    void prepareSecurity();
    by("companyName").focus({preventScroll:true});
    form.scrollIntoView({block:"start",behavior:"smooth"});
  });
  form.querySelectorAll('input[name="contact_preference"],input[name="contact_method"]').forEach(
    radio=>radio.addEventListener("change",contactVisibility)
  );
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(leadSubmitting)return;
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
    if(!securityToken){
      formError(securityText("Completá la verificación de seguridad antes de enviar.","Complete the security verification before submitting."));
      if(!securityRetry.hidden||securityWidget===null)void prepareSecurity();
      return;
    }
    const payload={
      action:"lead_v3",kind,language:locale,turnstile_token:securityToken,
      website:get("website"),company_name:get("company_name"),ruc,
      contact_name:get("contact_name"),email:get("email"),phone,
      contact_preference:preference,contact_method:method,
      observations:get("observations"),intake
    };
    const submit=by("submitLead");submit.disabled=true;leadSubmitting=true;securityToken="";
    setMessage(by("leadMessage"),"Registrando propuesta…");
    try{
      const reply=await api(payload);
      if(reply.status!=="received")throw Error("No se pudo registrar la propuesta.");
      form.hidden=true;
      ++securityGeneration;
      if(securityWidget!==null){try{window.turnstile?.remove(securityWidget);}catch{}securityWidget=null;}
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
      const actions=by("requestSuccessActions");
      by("emptySection").insertBefore(note,actions);
      by("successBackPortfolio").textContent=t("Volver al portafolio");
      by("successWhatsApp").textContent=locale==="es"?"Contacta por WhatsApp":"Contact me on WhatsApp";
      by("successLinkedIn").textContent=locale==="es"?"Sígueme en LinkedIn":"Follow me on LinkedIn";
      if(locale==="en"){
        const wa=new URL(by("successWhatsApp").href);
        wa.searchParams.set("text","Hi, Christian. I saw your portfolio and would like to contact you.");
        by("successWhatsApp").href=wa.toString();
      }
      actions.hidden=false;
      by("emptySection").scrollIntoView({block:"nearest",behavior:"smooth"});
    }catch(error){
      setMessage(by("leadMessage"),"",false);
      formError(error.message||securityText("No se pudo enviar la propuesta. Intentá nuevamente.","Could not submit your proposal. Please try again."));
      void prepareSecurity();
    }finally{
      leadSubmitting=false;submit.disabled=false;
    }
  });
  async function init(){
    if(!companyIdValid(ruc)){show("invalidSection");return;}
    by("rucField").value=ruc;
    try {
      const data=await api({action:"resolve",ruc});
      if(data.status==="company"&&Array.isArray(data.items)&&data.items.length)displayCompany(data);
      else if(data.status==="not_found") {
        by("companyDescription").textContent=t("Todavía no hay CV asociados a ese identificador.");
        show("emptySection");
        showNoCVDialog();
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