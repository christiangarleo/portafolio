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
  for(const id of ["returnPortfolio","invalidBackPortfolio","missingCVBack"]){
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
      ++historyGeneration;historyToken="";historyVerified=false;receipt=null;ruc=proposed;
      history.replaceState(null,"",url.pathname+url.search);
      by("rucField").value=ruc;
      by("companyDescription").textContent=t("Todavía no hay CV asociados a ese identificador.");
      show("emptySection");
      showRequests();
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

  const lang=(es,en)=>locale==="es"?es:en;
  const receiptKey=()=> "cga:received:"+ruc, tokenKey=()=> "cga:history:"+ruc;
  const store=(key,value)=>{try{sessionStorage.setItem(key,value);}catch{}};
  const getStored=key=>{try{return sessionStorage.getItem(key)||"";}catch{return "";}};
  const removeStored=key=>{try{sessionStorage.removeItem(key);}catch{}};
  let historyToken="",historyVerified=false,receipt=null,receivedHere=false,accessWidget=null,accessChallenge="",accessPending=false,historyGeneration=0;
  const incoming=new URLSearchParams(location.hash.slice(1)).get("request_access");
  if(incoming){history.replaceState(null,"",location.pathname+location.search);if(incoming.length<=2048)historyToken=incoming;}
  function compactProposal(){
    if(by("emptySection").classList.contains("cgaRequestComplete"))return;
    by("emptySection").classList.add("cgaRequestCompact");
    by("requestHeading").textContent=lang("¿Querés enviar una nueva solicitud?","Would you like to submit another request?");
    by("requestIntro").textContent=lang("Podés iniciar otra propuesta cuando lo necesites.","You can submit another proposal whenever you need to.");
    by("choices").hidden=true;by("leadForm").hidden=true;by("newRequestToggle").hidden=false;by("newRequestToggle").setAttribute("aria-expanded","false");
  }
  function regularProposal(){
    by("emptySection").classList.remove("cgaRequestCompact");
    by("requestHeading").textContent=t("¿Querés contratarme o conversar sobre un proyecto?");
    by("requestIntro").textContent=t("Elegí una opción y dejame los datos esenciales. Los detalles los conversamos después.");
    by("newRequestToggle").hidden=true;by("choices").hidden=false;
  }
  function renderRequests(rows,verified){
    const list=by("companyRequestsList");list.replaceChildren();
    const states={pending:lang("Pendiente de revisión","Pending review"),review:lang("En revisión","Under review"),contacted:lang("Contactada","Contacted"),closed:lang("Cerrada","Closed"),received:lang("Solicitud recibida","Request received")};
    const labels={full_time:"Full-time",part_time:"Part-time",por_horas:lang("Por horas","Hourly"),remoto:lang("Remoto","Remote"),presencial:lang("Presencial","On-site"),hibrido:lang("Híbrido","Hybrid"),mas_clientes:lang("Conseguir más clientes","Acquire more customers"),marketing_contenido:lang("Marketing y contenido","Marketing and content"),automatizacion_ia:lang("Automatización e IA","Automation and AI"),solucion_digital:lang("Solución digital","Digital solution"),otro:lang("Otro proyecto","Other project"),urgente:lang("Urgente","Urgent"),este_mes:lang("Este mes","This month"),mas_adelante:lang("Más adelante","Later"),a_definir:lang("A definir","To be defined")};
    for(const x of rows){
      const card=document.createElement("article");card.className="cgaRequestReceipt";
      const head=document.createElement("div");head.className="cgaRequestReceiptTop";
      const title=document.createElement("h3");title.textContent=(x.kind==="proyecto"&&labels[x.intake?.project_need])||x.position||lang("Propuesta","Proposal");
      const badge=document.createElement("span");badge.className="cgaRequestState";badge.dataset.state=x.state;badge.textContent=states[x.state]||states.received;
      head.append(title,badge);card.append(head);
      const meta=document.createElement("p");meta.className="sub";
      const date=Date.parse(x.created_at||"");const kind=x.kind==="in_house"?lang("Contratación In-house","In-house hiring"):x.kind==="proyecto"?lang("Contratación por proyecto","Project-based hiring"):lang("Solicitud de CV","CV request");
      meta.textContent=[kind,Number.isFinite(date)?new Date(date).toLocaleDateString(locale==="es"?"es-PE":"en-GB"):"",...["dedication","work_mode","project_timing"].map(k=>labels[x.intake?.[k]]||"")].filter(Boolean).join(" · ");card.append(meta);
      if(x.observations){const detail=document.createElement("details"),summary=document.createElement("summary"),p=document.createElement("p");summary.textContent=lang("Ver observaciones enviadas","View submitted notes");p.textContent=x.observations;detail.append(summary,p);card.append(detail);}
      list.append(card);
    }
    by("companyRequestsIntro").textContent=verified?lang("Solicitudes registradas con tu correo. Estado actualizado al consultar.","Requests registered with your email. Status updated when checked."):lang("Consultá el historial actualizado mediante un enlace privado.","View the current history using a private link.");
    if(verified&&!rows.length)list.textContent=lang("No hay solicitudes disponibles.","No requests available.");
  }
  async function refreshHistory(){
    if(!historyToken)return;
    const generation=++historyGeneration,identifier=ruc,token=historyToken;
    try{
      const result=await api({action:"request_history",ruc:identifier,token});
      if(generation!==historyGeneration||identifier!==ruc)return;
      if(result.status!=="verified"||!Array.isArray(result.requests))throw Error("invalid");
      historyVerified=true;store(tokenKey(),token);renderRequests(result.requests,true);
      by("requestAccessToggle").hidden=true;by("requestAccessForm").hidden=true;by("requestAccessLogout").hidden=false;by("requestAccessStatus").textContent="";
      if(result.requests.length&&by("leadForm").hidden)compactProposal();
    }catch{if(generation!==historyGeneration)return;historyToken="";historyVerified=false;removeStored(tokenKey());renderRequests(receipt?[receipt]:[],false);by("requestAccessToggle").hidden=false;by("requestAccessLogout").hidden=true;by("requestAccessStatus").textContent=lang("No pudimos verificar el acceso. Solicitá un nuevo enlace.","Could not verify access. Request a new link.");}
  }
  function showRequests(){
    by("companyRequests").hidden=false;receivedHere=getStored(receiptKey())==="1";
    if(receivedHere){compactProposal();by("requestAccessStatus").textContent=lang("Registraste una solicitud en esta sesión. Verificá tu correo para ver el historial.","You submitted a request in this session. Verify your email to see the history.");}
    if(!historyToken)historyToken=getStored(tokenKey());
    if(historyToken)void refreshHistory();
  }
  by("newRequestToggle").addEventListener("click",()=>{
    if(leadSubmitting)return;
    if(by("emptySection").classList.contains("cgaRequestComplete")){
      by("requestSuccessVideo").pause();by("requestSuccessLayout").hidden=true;by("requestSuccessActions").hidden=true;by("requestNextSteps").hidden=true;
      by("emptySection").classList.remove("cgaRequestComplete");by("requestHeading").classList.remove("requestConfirmed");by("requestIntro").classList.remove("requestConfirmed");
      compactProposal();
    }
    const toggle=by("newRequestToggle"),open=toggle.getAttribute("aria-expanded")!=="true";
    toggle.setAttribute("aria-expanded",String(open));by("choices").hidden=!open;
    if(!open){by("leadForm").hidden=true;++securityGeneration;if(securityWidget!==null){try{window.turnstile?.remove(securityWidget);}catch{}securityWidget=null;}securityToken="";}
    else by("choices").querySelector("button")?.focus();
  });
  by("requestAccessLogout").addEventListener("click",()=>{
    ++historyGeneration;historyToken="";historyVerified=false;removeStored(tokenKey());renderRequests(receipt?[receipt]:[],false);
    by("requestAccessToggle").hidden=false;by("requestAccessLogout").hidden=true;by("requestAccessStatus").textContent=lang("Acceso privado cerrado.","Private access closed.");
    if(!receivedHere&&!by("emptySection").classList.contains("cgaRequestComplete"))regularProposal();
  });
  function clearAccessChallenge(){accessChallenge="";if(accessWidget!==null){try{window.turnstile?.remove(accessWidget);}catch{}accessWidget=null;}}
  async function prepareAccessChallenge(){
    clearAccessChallenge();by("requestAccessTurnstile").replaceChildren();
    try{const ts=await loadSecurity();if(by("requestAccessForm").hidden)return;
      accessWidget=ts.render(by("requestAccessTurnstile"),{sitekey:securitySiteKey,action:"portfolio_lead",language:locale,theme:document.documentElement.dataset.theme==="dark"?"dark":"light",size:"flexible",appearance:"interaction-only",callback:token=>{accessChallenge=token;},"expired-callback":()=>{accessChallenge="";},"error-callback":()=>{accessChallenge="";}});
    }catch{by("requestAccessStatus").textContent=lang("No se pudo cargar la verificación. Volvé a intentarlo.","Verification could not load. Try again.");}
  }
  by("requestAccessToggle").addEventListener("click",()=>{
    if(accessPending)return;
    const f=by("requestAccessForm"),open=f.hidden;f.hidden=!open;by("requestAccessToggle").setAttribute("aria-expanded",String(open));
    if(open){by("requestAccessEmail").focus();void prepareAccessChallenge();}else clearAccessChallenge();
  });
  by("requestAccessForm").addEventListener("submit",async event=>{
    event.preventDefault();if(accessPending)return;
    if(!accessChallenge){by("requestAccessStatus").textContent=lang("Completá la verificación de seguridad.","Complete security verification.");void prepareAccessChallenge();return;}
    accessPending=true;by("requestAccessSend").disabled=true;
    try{const result=await api({action:"request_history_link",ruc,email:by("requestAccessEmail").value.trim(),language:locale,turnstile_token:accessChallenge});
      if(result.status!=="accepted")throw Error("unavailable");
      by("requestAccessStatus").textContent=lang("Si existen solicitudes con ese correo, recibirás un enlace privado. Revisá también Spam.","If requests exist for that email, you will receive a private link. Check spam too.");
      by("requestAccessForm").reset();by("requestAccessForm").hidden=true;by("requestAccessToggle").setAttribute("aria-expanded","false");clearAccessChallenge();
    }catch{by("requestAccessStatus").textContent=lang("No pudimos procesar el acceso. Intentá más tarde.","We could not process access. Try again later.");}
    finally{accessPending=false;by("requestAccessSend").disabled=false;if(!by("requestAccessForm").hidden)void prepareAccessChallenge();}
  });
  for(const [id,es,en] of [["companyRequestsTitle","Mis solicitudes","My requests"],["companyRequestsIntro","Consultá tus propuestas de forma privada.","Check your proposals privately."],["requestAccessToggle","Consultar solicitudes","View requests"],["requestAccessLogout","Cerrar acceso","Close private access"],["requestAccessEmailLabel","Correo utilizado en la solicitud","Email used for the request"],["requestAccessSend","Enviar enlace privado","Send private link"],["newRequestToggle","Enviar nueva solicitud","Submit another request"]])by(id).textContent=lang(es,en);
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
    const resultCount=by("filteredCVCount");
    const nextCount=locale==="en"
      ? "Showing "+visible+" of "+cards.length+" positions"
      : "Mostrando "+visible+" de "+cards.length+" vacantes";
    if(resultCount.textContent!==nextCount){
      resultCount.textContent=nextCount;
      if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&resultCount.animate){
        resultCount.getAnimations?.().forEach(animation=>animation.cancel());
        resultCount.animate([{opacity:.55},{opacity:1}],{duration:200,easing:"ease-out"});
      }
    }
    by("emptyCVSearch").hidden=visible>0;
  }
  by("companySearchInput").addEventListener("input",updateCVFilters);
  by("filterAllCV").addEventListener("click",()=>{currentFilter="all";updateCVFilters();});
  by("filterActiveCV").addEventListener("click",()=>{currentFilter="active";updateCVFilters();});

  function show(section) {
    by("companyRequests").hidden=true;
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
      const button=element("button",undefined,"cgaGlassCTA cvDownloadCTA");
      const label=element("span",x.available?"Descargar CV ↓":"Descarga no disponible");
      if(x.available){label.textContent=label.textContent.replace(/\s*↓\s*$/,"");button.dataset.cgaIcon="download";}
      button.append(label);
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
    button.disabled=true;button.setAttribute("aria-busy","true");
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
    finally{button.disabled=false;button.removeAttribute("aria-busy");}
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
    by("submitLeadLabel").textContent=t(kind==="in_house"?"Enviar invitación":"Proponer proyecto");
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
      receivedHere=true;store(receiptKey(),"1");receipt={position:position||lang("Propuesta de proyecto","Project proposal"),kind,intake,created_at:new Date().toISOString(),state:"received"};
      by("companyRequests").hidden=false;renderRequests([receipt],false);
      if(historyVerified)void refreshHistory();
      by("newRequestToggle").hidden=false;by("newRequestToggle").setAttribute("aria-expanded","false");
      const copy=successCopy(locale,preference,method);
      for(const [id,value] of Object.entries(copy))by(id).textContent=value;
      by("emptySection").classList.add("cgaRequestComplete");
      by("requestHeading").classList.add("requestConfirmed");
      by("requestIntro").classList.add("requestConfirmed");
      by("requestHeading").setAttribute("tabindex","-1");
      by("requestNextSteps").hidden=false;
      const actions=by("requestSuccessActions");
      const successLayout=by("requestSuccessLayout");
      by("requestHeading").focus({preventScroll:true});
      by("successWhatsApp").textContent=locale==="es"?"Contacta por WhatsApp":"Contact me on WhatsApp";
      by("successLinkedIn").textContent=locale==="es"?"Sígueme en LinkedIn":"Follow me on LinkedIn";
      if(locale==="en"){
        const wa=new URL(by("successWhatsApp").href);
        wa.searchParams.set("text","Hi, Christian. I saw your portfolio and would like to contact you.");
        by("successWhatsApp").href=wa.toString();
      }
      actions.hidden=false;
      successLayout.hidden=false;
      try{window.CGAMessageVideo?.mount({locale,submitted:true});}catch{ /* The saved request remains confirmed even if video initialization fails. */ }
      by("emptySection").scrollIntoView({block:"start",behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth"});
    }catch(error){
      setMessage(by("leadMessage"),"",false);
      formError(error.message||securityText("No se pudo enviar la propuesta. Intentá nuevamente.","Could not submit your proposal. Please try again."));
      void prepareSecurity();
    }finally{
      leadSubmitting=false;submit.disabled=false;
    }
  });


  function successCopy(locale,preference,method){
    const en=locale==="en";
    const pick=(es,eng)=>en?eng:es;
    const channels={email:pick("por correo electrónico","by email"),whatsapp:pick("por WhatsApp","on WhatsApp"),llamada:pick("por teléfono","by phone")};
    const contact=preference==="contactame"
      ?pick("Revisaré tu propuesta y te contactaré "+(channels[method]||"por el medio que elegiste")+".","I'll review your proposal and get in touch "+(channels[method]||"using your preferred contact method")+".")
      :pick("Revisaré tu propuesta y quedaré a la espera de tu contacto.","I'll review your proposal and wait to hear from you.");
    return {
      requestHeading:pick("¡Gracias! Recibí tu propuesta.","Thank you! I've received your proposal."),
      requestIntro:contact,
      requestEmailText:pick("Deberías recibir una confirmación por correo. Revisá también Spam.","You should receive a confirmation email. Please check your spam folder too."),
      requestVideoIntro:pick("Un mensaje para vos","A personal message")
    };
  }

  async function init(){
    if(!companyIdValid(ruc)){show("invalidSection");return;}
    by("rucField").value=ruc;
    try {
      const data=await api({action:"resolve",ruc});
      if(data.status==="company"&&Array.isArray(data.items)&&data.items.length)displayCompany(data);
      else if(data.status==="not_found") {
        by("companyDescription").textContent=t("Todavía no hay CV asociados a ese identificador.");
        show("emptySection");
        if(!historyToken&&!getStored(tokenKey())&&!getStored(receiptKey()))showNoCVDialog();
      } else throw Error("Respuesta del servicio no reconocida");
      showRequests();
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