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
  const headings={
    solicitud_cv:["Solicitar un CV personalizado","Vacante o puesto"],
    in_house:["Contratación in-house","Puesto o modalidad de trabajo"],
    proyecto:["Contratación por proyecto","Proyecto o servicio requerido"]
  };
  by("choices").addEventListener("click",event=>{
    const button=event.target.closest("button[data-kind]");
    if(!button)return;
    const kind=button.dataset.kind;
    if(!headings[kind])return;
    by("leadKind").value=kind;
    by("leadTitle").textContent=headings[kind][0];
    document.querySelector('label[for="position"]').textContent=headings[kind][1];
    by("inhouseFields").hidden=kind!=="in_house";
    by("projectFields").hidden=kind!=="proyecto";
    by("leadForm").hidden=false;
    for(const choice of by("choices").querySelectorAll("button"))choice.setAttribute("aria-pressed",String(choice===button));
    by("companyName").focus();
  });
  by("leadForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const data=Object.fromEntries(new FormData(form).entries());
    const details=[data.details];
    if(data.kind==="in_house"&&data.modalidad)details.push("Modalidad: "+data.modalidad);
    if(data.kind==="proyecto") {
      if(data.presupuesto)details.push("Presupuesto: "+data.presupuesto);
      if(data.plazo)details.push("Plazo: "+data.plazo);
    }
    data.details=details.filter(Boolean).join("\n");
    const btn=form.querySelector('button[type="submit"]');
    btn.disabled=true;
    setMessage(by("leadMessage"),"Enviando solicitud…");
    try{
      const reply=await api({action:"lead",...data});
      if(reply.status!=="received")throw Error("No se pudo registrar tu solicitud");
      form.hidden=true;by("choices").hidden=true;
      const heading=by("emptySection").querySelector("h2");
      heading.textContent="Solicitud recibida";
      setMessage(by("leadMessage"),"Solicitud registrada. Gracias por contactarme.");
      const success=element("p","Gracias por tu interés. Tu mensaje quedó registrado y podré revisarlo en mi panel de administración.","sub");
      by("emptySection").append(success);
    }catch(error){setMessage(by("leadMessage"),error.message||"No se pudo enviar.",true);}
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