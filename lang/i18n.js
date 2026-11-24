/* CGA | ES/EN. English is default; user selection is authoritative. */
(() => {
  "use strict";
  const KEY="cga-site-language";
  const requested=new URLSearchParams(location.search).get("lang");
  let saved=null;
  try{saved=localStorage.getItem(KEY);}catch{}
  let locale=requested==="en"||requested==="es"?requested:saved==="es"?"es":"en";
  try{localStorage.setItem(KEY,locale);}catch{}
  document.documentElement.lang=locale;
  document.documentElement.dataset.lang=locale;

  // Source strings are the approved Spanish UI copy; data/document content is never machine-translated.
  const en={
    "Portafolio profesional | Christian Gabriel Arleo":"Professional Portfolio | Christian Gabriel Arleo",
    "Christian Gabriel Arleo | Portafolio profesional":"Christian Gabriel Arleo | Professional Portfolio",
    "· Portafolio":"· Portfolio",
    "Christian Gabriel Arleo · Portafolio":"Christian Gabriel Arleo · Portfolio",
    "Portafolio profesional":"Professional Portfolio",
    "El trabajo detrás de los resultados.":"The work behind the results.",
    "Conocé mi experiencia, proyectos y trabajo en growth marketing, performance digital y negocios.":"Explore my experience and projects in growth marketing, digital performance and business.",
    "Ver portafolio ↗":"View portfolio ↗",
    "Christian Gabriel Arleo · Lima, Perú ·":"Christian Gabriel Arleo · Lima, Peru ·",
    "LinkedIn":"LinkedIn",
    "WhatsApp":"WhatsApp",
    "E-mail":"E-mail",
    "Llamar":"Call",
    "☰ Menú":"☰ Menu",
    "Visor PDF clásico":"Classic PDF viewer",
    "Volver al lector":"Return to reader",
    "Compartir desde el dispositivo":"Share from your device",
    "Copiar enlace":"Copy link",
    "Compartir por WhatsApp":"Share via WhatsApp",
    "Compartir en LinkedIn":"Share on LinkedIn",
    "Compartir por correo":"Share by e-mail",
    "Descargar portafolio PDF":"Download portfolio PDF",
    "Acceder a CV por empresa":"Company CV portal",
    "Cargando portafolio…":"Loading portfolio…",
    "Volver al índice":"Back to contents",
    "Presentación":"Introduction",
    "Resumen":"Summary",
    "← Anterior":"← Previous",
    "Página":"Page",
    "de":"of",
    "Siguiente →":"Next →",
    "Proyectos de autor":"Personal projects",
    "Experiencias profesionales":"Professional experience",
    "Portal de postulaciones por empresa":"Company application portal",
    "Portal de postulaciones | Christian Gabriel Arleo":"Application portal | Christian Gabriel Arleo",
    "Abrir enlace del portafolio":"Open portfolio link",
    "Ingresá el RUC de la empresa (11 dígitos) para acceder a su página con todas las vacantes asociadas y sus respectivos CV.":"Enter your company's 11-digit Peruvian tax ID (RUC) to see the positions and CVs linked to your organization.",
    "RUC de la empresa":"Company tax ID (RUC)",
    "Ingresá el identificador de tu empresa (RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF, ABN, etc.). Puede contener letras y números y no tiene una longitud fija.":"Enter your company's identifier (RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF, ABN, etc.). It can contain letters and numbers; no fixed length is required.",
    "Identificador de empresa (RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF, ABN…)":"Company identifier (RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF, ABN…)",
    "Buscando las postulaciones asociadas al identificador de empresa…":"Looking up applications for this company identifier…",
    "Identificador de empresa no válido":"Invalid company identifier",
    "Volvé al portafolio e ingresá el identificador de tu empresa (RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF, ABN, etc.).":"Return to the portfolio and enter your company's identifier (RUC, RFC, NIT, RUT, CUIT, CNPJ, EIN, VAT ID, NIF/CIF, ABN, etc.).",
    "Ingresá un identificador de empresa válido (hasta 64 caracteres).":"Enter a valid company identifier (up to 64 characters).",
    "Todavía no hay CV asociados a ese identificador.":"No CVs are associated with that company identifier yet.",
    "Ingresar al portal":"Open company portal",
    "← Volver al portafolio":"← Back to portfolio",
    "Acceso por empresa":"Company access",
    "Portal de postulaciones":"Application portal",
    "Consultá los CV que preparé para las vacantes de tu organización.":"Explore the CVs prepared for roles at your company.",
    "Buscando las postulaciones asociadas al RUC…":"Looking up applications for this tax ID…",
    "Vacantes y CV":"Positions and CVs",
    "Buscar por vacante":"Search by position",
    "Ej.: Marketing, Coordinador…":"e.g. Marketing, Coordinator…",
    "Todos":"All",
    "Disponibles":"Available",
    "No hay vacantes que coincidan con la búsqueda.":"No matching positions found.",
    "Cada CV corresponde a una vacante específica. Los documentos vencidos permanecen visibles, pero no se pueden descargar.":"Each CV is tailored to a specific role. Expired documents remain listed but cannot be downloaded.",
    "¿Te interesa trabajar conmigo?":"Interested in working with me?",
    "Elegí qué necesitás. Es un formulario breve; los detalles los conversamos después.":"Choose what you need. This form is brief; we can discuss the details later.",
    "Contratación In-house":"In-house hiring",
    "Contratación por proyecto":"Project-based collaboration",
    "Invitar a una entrevista":"Invite me to an interview",
    "Solo lo esencial. Podés completar el resto en una conversación.":"Just the essentials. We can discuss the rest in a conversation.",
    "No completar":"Do not fill in",
    "Nombre de la empresa *":"Company name *",
    "¿Para qué vacante? *":"Which position? *",
    "¿Qué dedicación necesitás? *":"What commitment do you need? *",
    "Full Time":"Full-time",
    "Part Time":"Part-time",
    "Por horas":"Hourly",
    "¿Cómo sería el trabajo? *":"Work arrangement *",
    "Remoto":"Remote",
    "Híbrido":"Hybrid",
    "Presencial":"On-site",
    "¿Qué necesitás resolver? *":"What would you like to solve? *",
    "Conseguir más clientes":"Acquire more customers",
    "Mejorar marketing y contenido":"Improve marketing and content",
    "Automatización e IA":"Automation and AI",
    "Crear una solución digital":"Build a digital solution",
    "Otro / Necesito asesoramiento":"Other / I need advice",
    "¿Para cuándo lo necesitás? *":"When do you need it? *",
    "Urgente":"As soon as possible",
    "Este mes":"This month",
    "Más adelante":"Later",
    "A definir":"To be determined",
    "Correo corporativo *":"Work e-mail *",
    "¿Querés que me comunique con vos? *":"Would you like me to contact you? *",
    "Sí, contactame.":"Yes, please contact me.",
    "No, nosotros te devolvemos la llamada.":"No, we'll reach out to you.",
    "¿Por dónde preferís que te contacte?":"How would you like me to contact you?",
    "Por e-mail":"By e-mail",
    "Por WhatsApp":"Via WhatsApp",
    "Por llamada":"By phone",
    "Teléfono de contacto *":"Contact phone number *",
    "Agregar una observación o dato adicional (opcional)":"Add a note or extra detail (optional)",
    "Observaciones":"Additional notes",
    "Nombre de la persona de contacto (opcional)":"Contact person's name (optional)",
    "Enviar invitación":"Send interview invitation",
    "Proponer proyecto":"Submit project proposal",
    "Tus datos se utilizan únicamente para gestionar la propuesta y respetar la preferencia de contacto que elijas.":"Your information is used only to manage your proposal and respect your contact preference.",
    "RUC no válido":"Invalid tax ID",
    "Volvé al portafolio e ingresá los 11 dígitos del RUC de tu empresa.":"Return to the portfolio and enter your company's 11-digit RUC.",
    "Volver al portafolio":"Back to portfolio",
    "Christian Gabriel Arleo · Postulaciones profesionales":"Christian Gabriel Arleo · Professional applications",
    "Contacto por correo":"Contact by e-mail",
    "Ej.: Nombre de tu empresa":"e.g. Your company name",
    "Ej.: 20564321657 / DE123456789":"e.g. 20564321657 / DE123456789",
    "Ej.: Coordinador de Marketing":"e.g. Marketing Coordinator",
    "¿Hay algún detalle importante que debería conocer?":"Is there anything else I should know?",
    "Tu nombre":"Your name",
    "Perfil y contacto":"Profile and contact",
    "Navegación de contacto":"Contact navigation",
    "Abrir menú de perfil y contacto":"Open profile and contact menu",
    "Cerrar menú de perfil y contacto":"Close profile and contact menu",
    "Herramientas del visor PDF":"PDF reader tools",
    "Alternar con las herramientas nativas del navegador":"Switch to the browser's native PDF tools",
    "Reducir zoom":"Zoom out",
    "Aumentar zoom":"Zoom in",
    "Ajustes de visualización":"View options",
    "Ajustar página":"Fit page",
    "Ajustar ancho":"Fit width",
    "Pantalla completa":"Full screen",
    "Salir de pantalla completa":"Exit full screen",
    "Acciones del portafolio":"Portfolio actions",
    "Compartir":"Share",
    "Copiar enlace de la página actual":"Copy current page link",
    "Imprimir portafolio":"Print portfolio",
    "Opciones de descarga":"Download options",
    "Descargar portafolio o CV":"Download portfolio or CV",
    "Lector del portafolio PDF":"Portfolio PDF reader",
    "Página actual del portafolio":"Current portfolio page",
    "Lector PDF clásico":"Classic PDF reader",
    "Página anterior":"Previous page",
    "Página siguiente":"Next page",
    "Navegación del portafolio":"Portfolio navigation",
    "Índice, presentación y resumen":"Contents, introduction and summary",
    "Ver el índice del portafolio":"View portfolio contents",
    "Ir a la presentación":"Go to introduction",
    "Ir al resumen":"Go to summary",
    "Elegí una página y presioná Enter":"Choose a page and press Enter",
    "Secciones del portafolio":"Portfolio sections",
    "Ir a los proyectos de autor":"Go to personal projects",
    "Ir a experiencias profesionales":"Go to professional experience",
    "Cerrar":"Close",
    "English":"English",
    "Español":"Español",
    "Enlace copiado":"Link copied",
    "No se pudo abrir el enlace interno":"Could not open the internal link",
    "Visor clásico: zoom, impresión, descarga y selección de texto desde el PDF":"Classic viewer: zoom, print, download and text selection from the PDF",
    "Tu navegador no admite pantalla completa":"Your browser does not support full-screen mode",
    "No se pudo activar pantalla completa":"Could not enter full-screen mode",
    "Primero debe terminar de cargarse el PDF":"Wait for the PDF to finish loading first",
    "La versión actual del PDF todavía no está disponible":"The current PDF is not available yet",
    "Preparando impresión…":"Preparing to print…",
    "No se pudo iniciar la impresión. Usá «Visor PDF clásico»":"Could not start printing. Try the classic PDF viewer.",
    "Brave no permitió imprimir directamente. Usá el visor PDF clásico":"Direct printing was blocked. Try the classic PDF viewer.",
    "Si no se abre la impresión, usá «Visor PDF clásico» y Ctrl + P":"If the print dialog doesn't appear, use the classic PDF viewer and Ctrl + P.",
    "Brave bloqueó la impresión directa. Usá «Visor PDF clásico» y Ctrl + P":"Direct printing was blocked. Use the classic PDF viewer and Ctrl + P.",
    "Preparando el portafolio…":"Preparing the portfolio…",
    "Descargando la última versión del portafolio…":"Downloading the latest portfolio…",
    "Preparando la última versión…":"Preparing the latest version…",
    "No se pudo iniciar el lector avanzado. Se muestra el PDF actualizado en el visor del navegador.":"Advanced reader unavailable. Showing the current PDF in your browser.",
    "No se pudo obtener la versión actual del PDF. Probá «Actualizar PDF» o «Descargar PDF».":"Could not load the current PDF. Try again or download the file.",
    "No se pudo mostrar esa página. Usá el enlace de descarga o recargá el sitio.":"Could not show this page. Use the download link or reload the site.",
    "English portfolio not published yet. Please check back soon or switch to Español.":"English portfolio not published yet. Please check back soon or switch to Español.",
    "No pudimos cargar el portal. ":"We couldn't load the portal. ",
    "Volvé a intentarlo.":"Please try again.",
    "Reintentar":"Try again",
    "CV personalizado":"Tailored CV",
    "CV disponible":"CV available",
    "CV vencido":"CV expired",
    "Descargar CV ↓":"Download CV ↓",
    "Descarga no disponible":"Download unavailable",
    "Sin fecha de vencimiento":"No expiration date",
    "¿Te interesa proponer una contratación?":"Interested in discussing a role?",
    "¿Querés contratarme o conversar sobre un proyecto?":"Looking to hire me or discuss a project?",
    "Elegí una opción y dejame los datos esenciales. Los detalles los conversamos después.":"Choose an option and share the essentials. We can discuss details later.",
    "Invitar a una entrevista":"Invite me to an interview",
    "Dejame la vacante y tus datos de contacto.":"Share the role and your contact details.",
    "Conversemos sobre tu proyecto":"Let's discuss your project",
    "Contame qué necesitás con un par de clics.":"Tell me what you need in just a few clicks.",
    "Elegí el tipo de contratación.":"Choose a hiring option.",
    "Completá la vacante, la dedicación y la modalidad de trabajo.":"Enter the position, commitment and work arrangement.",
    "Seleccioná qué necesitás resolver y para cuándo.":"Select what you need and when.",
    "Elegí cómo preferís continuar el contacto.":"Choose how you'd like to stay in touch.",
    "Seleccioná cómo contactarte y completá el teléfono si corresponde.":"Choose your contact method and provide a phone number if needed.",
    "Registrando propuesta…":"Submitting proposal…",
    "No se pudo registrar la propuesta.":"Could not submit the proposal.",
    "Propuesta recibida":"Proposal received",
    "Gracias. Tu propuesta quedó registrada correctamente.":"Thank you. Your proposal was received.",
    "Voy a tener en cuenta el medio de contacto que seleccionaste.":"I'll use your preferred contact method.",
    "Quedó registrado que la empresa se comunicará por su cuenta.":"We've noted that your company prefers to reach out on its own.",
    "No se pudo enviar la propuesta. Intentá nuevamente.":"Could not send the proposal. Please try again.",
    "Ingresá un RUC de 11 dígitos.":"Enter an 11-digit RUC.",
    "Abriendo el portal de la empresa…":"Opening the company portal…",
    "Todavía no hay CV asociados a ese RUC.":"There are no CVs associated with this RUC yet.",
    "Este CV ya no está disponible":"This CV is no longer available",
    "No hay un CV":"No CV",
    "Automático":"Automatic",
    "Claro":"Light",
    "Oscuro":"Dark"
  };
  const prefix=[
    [/^(\s*)Cargando página (\d+)(…?)(\s*)$/,(m,a,n,b,c)=>a+"Loading page "+n+b+c],
    [/^(\s*)Elegí una página entre 1 y (\d+)(\s*)$/,(m,a,n,c)=>a+"Choose a page between 1 and "+n+c],
    [/^(\s*)Ingresá un número entre 1 y (\d+)(\s*)$/,(m,a,n,c)=>a+"Enter a number between 1 and "+n+c],
    [/^(\s*)Vigencia: (.*)$/,(m,a,date)=>"Valid until: "+date],
    [/^(\s*)CV vigentes · (.*)$/,(m,a,rest)=>"Active CVs · "+rest]
  ];
  function t(source){
    if(typeof source!=="string"||locale!=="en")return source;
    const match=source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if(match&&Object.prototype.hasOwnProperty.call(en,match[2]))
      return match[1]+en[match[2]]+match[3];
    for(const [re,convert] of prefix)if(re.test(source))return source.replace(re,convert);
    return source;
  }
  function urlFor(lang){
    const url=new URL(location.href);
    url.searchParams.set("lang",lang);
    if(lang!==locale && url.pathname.startsWith("/portafolio/")) url.searchParams.delete("pagina");
    return url.pathname+url.search+url.hash;
  }
  function go(lang){
    if(lang!=="en"&&lang!=="es")return;
    try{localStorage.setItem(KEY,lang);}catch{}
    location.assign(urlFor(lang));
  }
  function translateDOM(){
    const targets=[document.body,document.title?document.head:null].filter(Boolean);
    for(const parent of targets){
      const walker=document.createTreeWalker(parent,NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      for(const node of nodes){
        if(node.parentElement?.closest("script,style,svg"))continue;
        const translation=t(node.nodeValue);
        if(translation!==node.nodeValue)node.nodeValue=translation;
      }
      if(parent===document.body){
        for(const node of parent.querySelectorAll("[placeholder],[aria-label],[title]")){
          for(const attr of ["placeholder","aria-label","title"]){
            if(node.hasAttribute(attr)){
              const translated=t(node.getAttribute(attr));
              if(translated!==node.getAttribute(attr))node.setAttribute(attr,translated);
            }
          }
        }
      }
    }
    for(const meta of document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]')){
      const old=meta.content;
      if(locale==="en"){
        const extra={
          "Portafolio profesional de Christian Gabriel Arleo: proyectos, experiencia y resultados en marketing, tecnología y negocios.":"Professional portfolio of Christian Gabriel Arleo: projects, experience, marketing, technology and business.",
          "El trabajo detrás de los resultados. Conocé mi experiencia y proyectos profesionales.":"The work behind the results. Explore my experience and professional projects.",
          "Portafolio profesional de Christian Gabriel Arleo. Growth marketing, performance digital y proyectos.":"Christian Gabriel Arleo's professional portfolio. Growth marketing, digital performance and projects."
        };
        meta.content=extra[old]||t(old);
      }
    }
  }
  function insertSwitch(){
    if(document.querySelector("#cgaLangPicker"))return;
    // Home always presents both languages as the primary entry.
    if(location.pathname==="/"||location.pathname==="/index.html")return;
    const container=document.createElement("div");
    container.id="cgaLangPicker";
    container.style.cssText="display:flex;align-items:center;gap:5px;flex:0 0 auto;white-space:nowrap;";
    const enButton=document.createElement("button"),esButton=document.createElement("button");
    for(const [button,mode,label] of [[enButton,"en","🇬🇧 EN"],[esButton,"es","🇪🇸 ES"]]){
      button.type="button";
      button.textContent=label;
      button.setAttribute("lang",mode);
      button.setAttribute("aria-label",mode==="en"?"Switch to English":"Cambiar a español");
      button.setAttribute("aria-pressed",String(mode===locale));
      button.style.cssText="border:1px solid var(--cga-border,#ddd);border-radius:5px;background:var(--cga-surface,#fff);color:var(--cga-text,#222);font:inherit;font-size:12px;padding:7px 8px;min-height:35px;cursor:pointer;";
      if(mode===locale){button.style.fontWeight="700";button.style.borderColor="var(--cga-border-strong,#555)";}
      button.addEventListener("click",()=>go(mode));
      container.append(button);
    }
    const actions=document.querySelector(".siteActions");
    if(actions)actions.prepend(container);
    else document.querySelector("header")?.append(container);
  }
  function init(){
    translateDOM();
    if(location.pathname.startsWith("/portafolio/")){
      const base="https://christianarleo.com/portafolio/?lang="+locale;
      const canonical=document.querySelector('link[rel="canonical"]');
      if(canonical)canonical.href=base;
      const og=document.querySelector('meta[property="og:url"]');
      if(og)og.content=base;
      const ogLocale=document.querySelector('meta[property="og:locale"]');
      if(ogLocale)ogLocale.content=locale==="en"?"en_GB":"es_PE";
    }
    insertSwitch();
    for(const button of document.querySelectorAll("[data-lang-choice]")){
      button.addEventListener("click",()=>{
        const mode=button.dataset.langChoice;
        if(mode==="en"||mode==="es"){try{localStorage.setItem(KEY,mode);}catch{}}
      });
    }
  }
  window.CGALang={get current(){return locale;},t,go,urlFor};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();