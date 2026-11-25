(() => {
  "use strict";

  const locale=window.CGALang?.current === "es" ? "es" : "en";
  const manifest=window.CGAPortfolioFiles?.[locale];
  if (!manifest) throw Error("Portfolio language manifest missing");
  const t=value=>window.CGALang?.t(value) ?? value;
  const SOURCE_PDF=manifest.url;
  // Cache-busting per visit prevents older PDFs being reused after a replacement.
  // Keep the nonce constant within the current visit, allowing page-to-page reuse.
  const CACHE_NONCE = String(Date.now());
  // The reader and the download must consume the exact same response.
  // Download is retrieved with no-store, then passed directly to PDF.js.
  const DOWNLOAD_URL = SOURCE_PDF + "?download=" + encodeURIComponent(manifest.filename) + "&cacheNonce=" + CACHE_NONCE;
  let verifiedPdfBlobUrl = null;
  const BASE_URL = "https://christianarleo.com/portafolio/";
  const TITLE=manifest.title;
  const SHARE_URL=BASE_URL+"?lang="+locale;
  const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const byId = id => document.getElementById(id);
  const input = byId("pageNumber");
  const spreads=window.CGAMagazine;
  const viewportBox = byId("pageViewport");
  const pageStatus = byId("pageStatus");
  const pageContainer = byId("pageContainer");
  const pageStage = byId("pageStage");
  const focusButton=byId("focusMode"),focusDialog=byId("focusDialog"),focusScroll=byId("focusScroll"),focusPageNode=byId("focusPage"),focusStatus=byId("focusStatus");
  focusButton.textContent=locale==="en"?"Reading mode":"Modo lectura";
  byId("focusTitle").textContent=focusButton.textContent;
  byId("focusClose").textContent=locale==="en"?"← Back":"← Volver";
  focusScroll.setAttribute("aria-label",locale==="en"?"Page in reading mode":"Página en modo lectura");
  const viewerModeButton = byId("viewerMode");
  const nativeFallback = byId("nativeFallback");
  const magazineButton=byId("magazineMode"), magazineStage=byId("magazineStage");
  let magazine=null, magazineActive=false, magazineOpening=false, magazineNav=null;
  const magazineLabel=active=>locale==="en"?(active?"Exit magazine":"Magazine view"):(active?"Salir de revista":"Vista revista");
  magazineButton.textContent=magazineLabel(false); magazineStage.setAttribute("aria-label",locale==="en"?"Magazine view":"Vista revista");
  const totalPagesText = byId("totalPages");
  const previousButton = byId("previousPage");
  const nextButton = byId("nextPage");
  const sectionJumpLinks = Array.from(document.querySelectorAll(".sectionJump[data-page]"));
  // Nunca ocultar los enlaces del inglés. Se actualizan tras leer las secciones del PDF.
  const sections={...(manifest.sections||{})};
  function refreshSectionLinks(){
    sectionJumpLinks.forEach(link=>{
      const page=sections[link.dataset.section];
      const valid=Number.isInteger(page)&&page>0&&(!totalPages||page<=totalPages);
      link.hidden=false;
      link.dataset.page=valid?String(page):"";
      link.setAttribute("aria-disabled",String(!valid));
      link.href=valid?"?lang="+locale+"&pagina="+page:"#";
      if(!valid)link.title=locale==="en"?"Locating section in the English PDF":"Sección no localizada";
    });
  }
  async function discoverEnglishSections(){
    if(locale!=="en"||!pdfDocument)return;
    const rules={
      index:/^(?:index|contents|content|table of contents)$/,
      intro:/^(?:presentation|introduction|about me|about|who i am)$/,
      summary:/^(?:summary|executive summary|professional summary|profile summary)$/,
      projects:/^(?:projects|my projects|personal projects|author projects|selected projects|featured projects|portfolio projects)$/,
      experience:/^(?:experience|professional experience|professional experiences|work experience|career history|employment history)$/
    };
    const found={};
    function examine(title,page){
      if(!Number.isInteger(page)||page<1||page>totalPages)return;
      const cleaned=String(title||"").toLowerCase().replace(/[^a-z\s]/g," ").replace(/\s+/g," ").trim();
      for(const [key,rule] of Object.entries(rules)){
        // Nunca confundir entradas del índice (página 3) con el inicio de cada capítulo.
        if(key!=="index" && page<=3 && locale==="en")continue;
        if(!found[key]&&rule.test(cleaned))found[key]=page;
      }
    }
    try{
      // Preferir los marcadores estructurados de InDesign/PDF, si existen.
      const outline=await pdfDocument.getOutline();
      const queue=[...(outline||[])];
      while(queue.length){
        const item=queue.shift();
        if(item.items?.length)queue.push(...item.items);
        let dest=typeof item.dest==="string"?await pdfDocument.getDestination(item.dest):item.dest;
        if(!Array.isArray(dest)||!dest[0])continue;
        try{examine(item.title,(await pdfDocument.getPageIndex(dest[0]))+1);}catch{}
      }
      // Si el PDF no contiene bookmarks, extraer títulos desde sus propias páginas.
      if(Object.keys(found).length<5){
        const limit=Math.min(totalPages,35);
        for(let page=2;page<=limit;page++){
          const pdfPage=await pdfDocument.getPage(page);
          const content=await pdfPage.getTextContent();
          const texts=(content.items||[]).slice(0,42)
            .map(item=>typeof item.str==="string"?item.str.trim():"").filter(Boolean);
          for(const label of texts)examine(label,page);
          if(Object.keys(found).length===5)break;
        }
      }
    }catch(error){console.warn("No se pudieron detectar todos los apartados del PDF inglés:",error);}
    Object.assign(sections,found);
    refreshSectionLinks();
    updateToolbar();
  }
  const sidePrevious = byId("sidePrevious");
  const sideNext = byId("sideNext");
  const printButton = byId("printPdf");
  const downloadLink = byId("downloadPortfolio");
  if(downloadLink) {
    // EN download stays disabled until the correct PDF is successfully fetched.
    downloadLink.href=locale==="es"?DOWNLOAD_URL:"#";
    if(locale==="en")downloadLink.setAttribute("aria-disabled","true");
    downloadLink.addEventListener("click",event=>{
      if(locale==="en"&&!verifiedPdfBlobUrl){
        event.preventDefault();
        showMessage("English portfolio not published yet. Please check back soon or switch to Español.");
      }
    });
  }
  const shareMenu = byId("actionsMenu");
  const shareButton = byId("actionsToggle");
  let pdfDocument = null, activeRender = null, activePage = 1, totalPages = locale==="es"?55:0, ticket = 0, resizeTimer, toastTimer;
  refreshSectionLinks();
  let nativeMode=false,ratioPromise=null;
  const classicStart=page=>spreads.spreadStart(page,spreads.singlePage());
  function getRatio(){return ratioPromise ||= spreads.pageRatio(pdfDocument);}
  const pageLink = page => SHARE_URL + "&pagina=" + page;
  const validPage = value => /^\d+$/.test(String(value)) && Number(value) >= 1 && Number(value) <= totalPages;

  function showMessage(message) {
    const toast = byId("toast");
    toast.textContent = t(message);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  async function copyText(value) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("clipboard");
      await navigator.clipboard.writeText(value);
      showMessage("Enlace copiado");
    } catch {
      const copyBox = document.createElement("textarea");
      copyBox.value = value;
      copyBox.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.append(copyBox);
      copyBox.select();
      let succeeded = false;
      try { succeeded = document.execCommand("copy"); } catch {}
      copyBox.remove();
      if (succeeded) showMessage("Enlace copiado");
      else window.prompt("Copiá este enlace:", value);
    }
  }

  function menuOpen(open) {
    shareMenu.hidden = !open;
    shareButton.setAttribute("aria-expanded", String(open));
  }

  shareButton.addEventListener("click", () => menuOpen(shareMenu.hidden));
  document.addEventListener("click", event => {
    if (!byId("actionsWrap").contains(event.target)) menuOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") menuOpen(false);
  });

  const nativeShare = byId("deviceSend");
  nativeShare.hidden = typeof navigator.share !== "function";
  byId("sendWhatsApp").href = "https://wa.me/?text=" + encodeURIComponent(TITLE + "\n" + SHARE_URL);
  byId("sendLinkedIn").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(SHARE_URL);
  byId("sendEmail").href = "mailto:?subject=" + encodeURIComponent(TITLE) + "&body=" + encodeURIComponent((locale==="en"?"I'm sharing this portfolio: ":"Te comparto este portafolio: ") + SHARE_URL);
  byId("copyLink").addEventListener("click", () => { menuOpen(false); copyText(SHARE_URL); });
  nativeShare.addEventListener("click", async () => {
    menuOpen(false);
    try { await navigator.share({title: TITLE, url: SHARE_URL}); }
    catch (error) { if (error.name !== "AbortError") copyText(SHARE_URL); }
  });

  function updateToolbar() {
    totalPagesText.textContent = totalPages>0?String(totalPages):"—";
    const back=magazineActive&&magazineNav?!magazineNav.previous:activePage<=1;
    const forward=magazineActive&&magazineNav?!magazineNav.next:spreads.spreadStep(activePage,1,totalPages,spreads.singlePage())===classicStart(activePage);
    focusButton.disabled=!pdfDocument||nativeMode||magazineOpening;
    previousButton.disabled=sidePrevious.disabled=back;
    nextButton.disabled=sideNext.disabled=forward;
    input.max = String(totalPages);
    input.value = String(activePage);
    sectionJumpLinks.forEach(link => {
      const sectionStart = Number(link.dataset.page);
      // Section boundaries are language-specific; never reuse Spanish page numbers for English.
      const starts=Object.values(sections||{}).filter(Number.isInteger).sort((a,b)=>a-b);
      const current=starts.filter(page=>page<=activePage).pop();
      const selected=Number.isInteger(current) && current===sectionStart;
      if (selected) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function setLoading(text) {
    pageStatus.textContent = t(text);
    pageStatus.hidden = false;
  }

  function resetView() {
    pageContainer.hidden = true;
    pageStage.hidden = false;
  }

  async function drawPageLinks(pdfPage, cssViewport, links, onInternal=page=>navigate(page,true)) {
    links.replaceChildren();
    let annotations;
    try { annotations = await pdfPage.getAnnotations({ intent:"display" }); }
    catch { return; }
    for (const item of annotations) {
      if (item.subtype !== "Link" || !item.rect || (!item.url && !item.dest)) continue;
      const rect = cssViewport.convertToViewportRectangle(item.rect);
      const x = Math.min(rect[0], rect[2]), y = Math.min(rect[1], rect[3]);
      const width = Math.abs(rect[2]-rect[0]), height = Math.abs(rect[3]-rect[1]);
      if (width <= 1 || height <= 1) continue;
      const anchor = document.createElement("a");
      anchor.style.cssText = "left:"+x+"px;top:"+y+"px;width:"+width+"px;height:"+height+"px;";
      anchor.setAttribute("aria-label", t("Abrir enlace del portafolio"));
      if (item.url) {
        anchor.href = item.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      } else {
        anchor.href = "#";
        anchor.addEventListener("click", async event => {
          event.preventDefault();
          try {
            const dest = typeof item.dest === "string" ? await pdfDocument.getDestination(item.dest) : item.dest;
            if (!dest || dest[0]==null) return;
            const index = typeof dest[0] === "number" ? dest[0] : await pdfDocument.getPageIndex(dest[0]);
            if (Number.isInteger(index)) onInternal(index+1);
          } catch { showMessage("No se pudo abrir el enlace interno"); }
        });
      }
      links.appendChild(anchor);
    }
  }

  async function renderSheet(pdfPage,geometry,group,onInternal){
    const sheet=document.createElement("div");sheet.className="cgaClassicSheet";
    sheet.style.width=geometry.width+"px";sheet.style.height=geometry.height+"px";
    if(!pdfPage){sheet.classList.add("cgaClassicSheet--blank");sheet.setAttribute("aria-hidden","true");return sheet;}
    sheet.dataset.readerPage=String(pdfPage.pageNumber);
    const unit=pdfPage.getViewport({scale:1});
    const scale=Math.min(geometry.width/unit.width,geometry.height/unit.height);
    const cssViewport=pdfPage.getViewport({scale});
    const pixelRatio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(8000000/(cssViewport.width*cssViewport.height)));
    const actualViewport=pdfPage.getViewport({scale:scale*pixelRatio});
    const paper=document.createElement("div");paper.className="cgaClassicPaper";
    paper.style.width=cssViewport.width+"px";paper.style.height=cssViewport.height+"px";
    const canvas=document.createElement("canvas");canvas.setAttribute("role","img");canvas.setAttribute("aria-label",locale==="en"?"Page "+pdfPage.pageNumber:"Página "+pdfPage.pageNumber);
    canvas.width=Math.ceil(actualViewport.width);canvas.height=Math.ceil(actualViewport.height);canvas.style.width=cssViewport.width+"px";canvas.style.height=cssViewport.height+"px";
    const links=document.createElement("div");links.className="cgaClassicLinks";paper.append(canvas,links);sheet.append(paper);
    if(group.cancelled)return sheet;
    const task=pdfPage.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport:actualViewport});
    group.tasks.push(task);await task.promise;
    if(!group.cancelled)await drawPageLinks(pdfPage,cssViewport,links,onInternal);
    return sheet;
  }
  async function navigate(page, updateURL=true) {
    if(magazineOpening)return;
    if(magazineActive&&magazine){if(validPage(page))magazine.go(Number(page));else showMessage("Elegí una página entre 1 y "+totalPages);return;}
    if(!validPage(page)){showMessage("Elegí una página entre 1 y "+totalPages);return;}
    const id=++ticket;
    activePage=Number(page);updateToolbar();
    if(updateURL)history.replaceState(null,"","/portafolio/?lang="+locale+(activePage===1?"":"&pagina="+activePage));
    resetView();setLoading("Cargando página "+page+"…");
    if(activeRender){activeRender.cancel();activeRender=null;}
    const group={tasks:[],cancelled:false,promise:null,cancel(){this.cancelled=true;for(const t of this.tasks)t.cancel();}};
    activeRender=group;
    try{
      if(!pdfDocument)throw Error("Lector PDF no disponible");
      if(nativeMode){nativeMode=false;nativeFallback.hidden=true;}
      const single=spreads.singlePage();
      const slots=spreads.spreadSlots(activePage,totalPages,single);
      const [ratio,pdfPages]=await Promise.all([getRatio(),Promise.all(slots.map(p=>p?pdfDocument.getPage(p):null))]);
      if(id!==ticket||group.cancelled)return;
      const geometry=spreads.applyViewportLayout(viewportBox,pageStage,ratio,single);
      group.promise=Promise.all(pdfPages.map(p=>renderSheet(p,geometry,group)));
      const sheets=await group.promise;
      if(id!==ticket||group.cancelled)return;
      pageContainer.replaceChildren(...sheets);pageContainer.hidden=false;pageStatus.hidden=true;
      viewportBox.scrollTop=viewportBox.scrollLeft=0;updateToolbar();
    }catch(error){
      if(id!==ticket||group.cancelled||error.name==="RenderingCancelledException")return;
      console.error("Falló renderizado de pliego",error);setLoading("No se pudo mostrar esa página. Usá el enlace de descarga o recargá el sitio.");
    }finally{if(activeRender===group)activeRender=null;}
  }

  function jumpToSelectedPage() {
    if (!validPage(input.value)) {
      showMessage("Ingresá un número entre 1 y " + totalPages);
      input.value = String(activePage);
      return;
    }
    const requested = Number(input.value);
    if (requested !== activePage) navigate(requested);
  }

  byId("gotoForm").addEventListener("submit", event => {
    event.preventDefault();
    jumpToSelectedPage();
    input.blur();
  });
  // Allow selecting a page without the redundant “Ir a página” button.
  input.addEventListener("change", jumpToSelectedPage);
  function stepPage(delta){if(magazineOpening)return;if(magazineActive&&magazine)magazine.step(delta);else{const next=spreads.spreadStep(activePage,delta,totalPages,spreads.singlePage());if(next!==classicStart(activePage))navigate(next);}}
  previousButton.addEventListener("click", () => stepPage(-1));
  nextButton.addEventListener("click", () => stepPage(1));
  sidePrevious.addEventListener("click", () => stepPage(-1));
  sideNext.addEventListener("click", () => stepPage(1));
  // Section anchors retain working deep links when JavaScript is disabled.
  sectionJumpLinks.forEach(link => link.addEventListener("click", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !pdfDocument) return;
    event.preventDefault();
    const target = Number(link.dataset.page);
    if (validPage(target) && (activePage !== target || nativeMode)) navigate(target);
  }));

  // Keyboard navigation mirrors the side arrows, but never hijacks form fields.
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        event.shiftKey || nativeMode || !pdfDocument || focusDialog.open) return;
    const focused = event.target;
    if (focused && (focused.closest("input,textarea,select,[contenteditable='true']") ||
                    focused.closest("[role='textbox']"))) return;
    if (event.key === "ArrowLeft" && activePage > 1) {
      event.preventDefault();
      stepPage(-1);
    } else if (event.key === "ArrowRight" && !nextButton.disabled) {
      event.preventDefault();
      stepPage(1);
    }
  });

  // Print the same PDF bytes as the reader, without navigating to a blob: URL.
  // Browsers such as Brave may use a built-in PDF plugin inside the print frame.
  let printFrame = null, printGuard = null;
  function removePrintFrame() {
    if (printGuard) { clearTimeout(printGuard); printGuard = null; }
    if (printFrame) { printFrame.remove(); printFrame = null; }
    printButton.disabled = false;
    printButton.title = t("Imprimir portafolio");
  }
  printButton.addEventListener("click", () => {
    if (!verifiedPdfBlobUrl) {
      showMessage("Primero debe terminar de cargarse el PDF");
      return;
    }
    if (printFrame) {
      try { printFrame.contentWindow.focus(); printFrame.contentWindow.print(); }
      catch { showMessage("Brave no permitió imprimir directamente. Usá el visor PDF clásico"); }
      return;
    }
    printButton.disabled = true;
    printButton.title = t("Preparando impresión…");
    const frame = document.createElement("iframe");
    printFrame = frame;
    frame.title = "Impresión del portafolio PDF";
    frame.setAttribute("aria-hidden", "true");
    // display:none prevents printing in some PDF viewers.
    frame.style.cssText = "position:fixed;width:1px;height:1px;bottom:0;left:0;border:0;opacity:0;pointer-events:none";
    frame.addEventListener("load", () => {
      if (printFrame !== frame) return;
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        showMessage(locale==="en"?"If printing fails, download the PDF and print it from your PDF application.":"Si no se abre la impresión, descargá el PDF e imprimilo desde tu aplicación de PDF.");
      } catch (error) {
        console.error("La impresión del PDF fue bloqueada:", error);
        showMessage(locale==="en"?"Direct printing was blocked. Download the PDF and print it separately.":"Brave bloqueó la impresión directa. Descargá el PDF para imprimirlo.");
      } finally {
        printButton.disabled = false;
        printButton.title = t("Imprimir portafolio");
      }
    }, {once:true});
    frame.addEventListener("error", () => {
      removePrintFrame();
      showMessage(locale==="en"?"Printing failed. Download the PDF to print it.":"No se pudo iniciar la impresión. Descargá el PDF para imprimirlo.");
    }, {once:true});
    // Leave the print frame available until the browser finishes with it.
    // The following click replaces any prior frame rather than opening tabs.
    printGuard = setTimeout(removePrintFrame, 120000);
    document.body.appendChild(frame);
    frame.src = verifiedPdfBlobUrl + "#toolbar=0&navpanes=0";
  });
  // Focus mode has its own native vertical scroll and fresh PDF.js render.
  // It never changes activePage, the magazine engine, or the URL on entry/exit.
  let focusNumber=0,focusRender=null,focusTicket=0,focusResizeTimer=0;
  function cancelFocus(){
    focusTicket++;
    if(focusRender){focusRender.cancel();focusRender=null;}
    clearTimeout(focusResizeTimer);
  }
  async function renderFocus(preserveScroll=false){
    if(!focusDialog.open||!validPage(focusNumber))return;
    cancelFocus();const id=focusTicket,top=focusScroll.scrollTop;
    const group={tasks:[],cancelled:false,cancel(){this.cancelled=true;for(const t of this.tasks)t.cancel();}};
    focusRender=group;
    focusStatus.hidden=false;focusStatus.textContent=locale==="en"?"Loading page…":"Cargando página…";
    try{
      const p=await pdfDocument.getPage(focusNumber);
      if(id!==focusTicket||!focusDialog.open)return;
      const unit=p.getViewport({scale:1});
      const width=Math.max(1,Math.min(980,focusScroll.clientWidth-(focusScroll.clientWidth<=600?8:32)));
      const height=width*unit.height/unit.width;
      const sheet=await renderSheet(p,{width,height},group,page=>{focusDialog.close();void navigate(page,true);});
      if(id!==focusTicket||!focusDialog.open||group.cancelled)return;
      focusPageNode.replaceChildren(sheet);focusStatus.hidden=true;
      focusScroll.scrollTop=preserveScroll?top:0;
    }catch(error){
      if(id!==focusTicket||group.cancelled)return;
      console.warn("Reading mode",error);focusStatus.textContent=locale==="en"?"Page could not load. Close and try again.":"No se pudo cargar la página. Cerrá y volvé a intentar.";
    }finally{if(focusRender===group)focusRender=null;}
  }
  function openFocus(page){
    if(!pdfDocument||nativeMode||magazineOpening||!validPage(page)||focusDialog.open)return;
    focusNumber=Number(page);focusPageNode.replaceChildren();
    byId("focusPageLabel").textContent=focusNumber+" / "+totalPages;
    focusDialog.showModal();void renderFocus();
  }
  focusButton.addEventListener("click",()=>openFocus(activePage));
  byId("focusClose").addEventListener("click",()=>focusDialog.close());
  focusDialog.addEventListener("close",()=>{cancelFocus();focusPageNode.replaceChildren();focusButton.focus({preventScroll:true});});
  // One gesture owner: a horizontal swipe turns pages, a tap opens focus.
  // Multi-touch stays native; no custom zoom, no wheel interception.
  let swipe=null,suppressClickUntil=0;
  const touches=new Set();
  viewportBox.addEventListener("pointerdown",e=>{
    if(!pdfDocument||nativeMode||magazineOpening||focusDialog.open||e.button!==0)return;
    touches.add(e.pointerId);
    if(touches.size!==1){swipe=null;return;}
    swipe={id:e.pointerId,x:e.clientX,y:e.clientY};
  },true);
  window.addEventListener("pointermove",e=>{
    if(!swipe||swipe.id!==e.pointerId)return;
    const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
    if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.4){try{viewportBox.setPointerCapture(e.pointerId);}catch{}}
  },true);
  function endSwipe(e){
    touches.delete(e.pointerId);
    if(!swipe||swipe.id!==e.pointerId)return;
    const g=swipe;swipe=null;
    if(e.type!=="pointerup")return;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){
      suppressClickUntil=performance.now()+400;e.preventDefault();stepPage(dx<0?1:-1);
    }
  }
  window.addEventListener("pointerup",endSwipe,true);
  window.addEventListener("pointercancel",endSwipe,true);
  viewportBox.addEventListener("click",e=>{
    if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.target.closest?.("a,button")||nativeMode||magazineOpening)return;
    const leaf=e.target.closest?.("[data-reader-page],[data-magazine-page]");
    if(!leaf)return;
    const page=Number(leaf.dataset.readerPage||leaf.dataset.magazinePage);
    const visible=spreads.spreadSlots(activePage,totalPages,spreads.singlePage());
    if(visible.includes(page))openFocus(page);
  },true);
  viewerModeButton.addEventListener("click",()=>{
    if(magazineOpening||!pdfDocument)return;
    if(magazineActive)closeMagazine();
    else if(nativeMode){nativeMode=false;nativeFallback.hidden=true;void navigate(activePage,false);}
  });
  // Copy the page actually displayed, not an unconfirmed value typed in the page selector.
  byId("sendPage").addEventListener("click", async () => {
    await copyText(pageLink(activePage));
  });

  const reader = byId("readerPanel");
  const fullscreenButton = byId("fullscreen");
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showMessage("Tu navegador no admite pantalla completa");
    } catch { showMessage("No se pudo activar pantalla completa"); }
  });

  window.addEventListener("resize", () => {
    if (!pdfDocument || nativeMode || magazineOpening) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {if(magazineActive)magazine?.resize();else void navigate(activePage,false);},180);
    if(focusDialog.open){clearTimeout(focusResizeTimer);focusResizeTimer=setTimeout(()=>void renderFocus(true),220);}
  });
  document.addEventListener("fullscreenchange", () => {
    // Keep the controls accessible: request fullscreen on the whole application.
    const label = document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa";
    fullscreenButton.setAttribute("aria-label", t(label));
    fullscreenButton.setAttribute("title", t(label));
    fullscreenButton.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
  });

  window.addEventListener("popstate", () => {
    const fromURL = new URLSearchParams(location.search).get("pagina");
    navigate(validPage(fromURL) ? Number(fromURL) : 1, false);
  });

  function syncMagazineURL(){
    const params=new URLSearchParams(location.search);params.set("lang",locale);params.set("pagina",String(activePage));
    if(magazineActive)params.set("vista","revista");else params.delete("vista");
    history.replaceState(null,"","/portafolio/?"+params.toString());
  }
  function setMagazineControls(active){
    magazineButton.setAttribute("aria-pressed",String(active));magazineButton.textContent=magazineLabel(active);
    viewerModeButton.setAttribute("aria-pressed",String(!active));
    viewerModeButton.title=locale==="en"?"Classic reader":"Lectura convencional";
  }
  function closeMagazine(render=true){
    magazineActive=false;magazineNav=null;magazine?.close();magazineStage.hidden=true;
    pageStage.hidden=false;setMagazineControls(false);syncMagazineURL();updateToolbar();
    if(render&&pdfDocument)void navigate(activePage,false);
  }
  async function openMagazine(){
    if(!pdfDocument||magazineOpening||magazineActive)return;
    if(!window.CGAMagazine){showMessage(locale==="en"?"Magazine unavailable":"Vista revista no disponible");void navigate(activePage,false);return;}
    magazineOpening=true;magazineButton.disabled=true;viewerModeButton.disabled=true;
    const initial=activePage;
    try{
      ticket++; // Cancel pending getPage/render work before switching modes.
      if(activeRender){const task=activeRender;activeRender=null;task.cancel();try{await task.promise;}catch{}}
      nativeMode=false;nativeFallback.hidden=true;pageStage.hidden=true;pageStatus.hidden=true;
      viewerModeButton.textContent=t("Visor PDF clásico");magazineStage.hidden=false;magazineActive=true;
      magazine ||= window.CGAMagazine.create({pdf:pdfDocument,host:byId("magazineBook"),viewport:viewportBox,locale,
        onPage:(page,nav)=>{if(!magazineActive)return;activePage=page;magazineNav=nav;updateToolbar();syncMagazineURL();},
        onInternal:page=>{if(validPage(page))magazine.go(page);},
        onError:error=>{console.warn("Magazine page",error);showMessage(locale==="en"?"Page could not load. Exit magazine to retry.":"No se pudo cargar la página. Salí de revista para reintentar.");}
      });
      await magazine.open(initial);if(magazineActive){setMagazineControls(true);viewportBox.scrollLeft=Math.max(0,(viewportBox.scrollWidth-viewportBox.clientWidth)/2);viewportBox.scrollTop=0;}
    }catch(error){
      magazineOpening=false;
      console.warn("Magazine unavailable",error);closeMagazine();showMessage(locale==="en"?"Magazine unavailable. PDF reader restored.":"Vista revista no disponible. Se restauró el lector PDF.");
    }finally{magazineOpening=false;magazineButton.disabled=false;viewerModeButton.disabled=false;updateToolbar();}
  }
  magazineButton.addEventListener("click",()=>{if(magazineActive)closeMagazine();else void openMagazine();});
  async function start() {
    setLoading("Preparando el portafolio…");
    updateToolbar();
    try {
      const library = await new Promise((resolve,reject) => {
        if (window.pdfjsLib) {resolve(window.pdfjsLib);return;}
        const script = document.createElement("script");
        script.src = PDFJS_CDN + "pdf.min.js";
        script.onload = () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error("Falta PDF.js"));
        script.onerror = () => reject(new Error("No se pudo cargar PDF.js"));
        document.head.appendChild(script);
      });
      library.GlobalWorkerOptions.workerSrc = PDFJS_CDN + "pdf.worker.min.js";
      // Fetching the same URL used for the confirmed-correct download
      // avoids serving an older cached PDF from the plain public URL.
      setLoading("Descargando la última versión del portafolio…");
      const response = await fetch(DOWNLOAD_URL, { cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error("HTTP " + response.status + " al descargar el PDF");
      const pdfBytes = await response.arrayBuffer();
      if (pdfBytes.byteLength < 1024) throw new Error("Respuesta PDF vacía o incompleta");
      const signature = new TextDecoder("latin1").decode(pdfBytes.slice(0, 1024));
      if (!signature.includes("%PDF-")) throw new Error("La descarga no es un documento PDF");
      verifiedPdfBlobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
      setLoading("Preparando la última versión…");
      pdfDocument = await library.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
      totalPages = pdfDocument.numPages;
      if(locale==="en"){
        // El PDF inglés publicado tiene 55 páginas: mostrar navegación de inmediato.
        // Los títulos reales detectados en el PDF reemplazan este mapa provisional.
        if(totalPages===55)Object.assign(sections,manifest.fallback55||{});
        refreshSectionLinks();
        // Escaneo posterior al primer render para evitar retrasar la portada.
        setTimeout(()=>{void discoverEnglishSections();},0);
      }
      if(locale==="en" && downloadLink){
        downloadLink.href=DOWNLOAD_URL;
        downloadLink.removeAttribute("aria-disabled");
      }
      const requested = new URLSearchParams(location.search).get("pagina");
      nativeFallback.hidden = true;
      // Shorter editions retain the nearest valid page instead of resetting.
      const target=requested&&/^\d+$/.test(requested)?Math.max(1,Math.min(totalPages,Number(requested))):1;
      if(requested&&String(target)!==requested){const url=new URL(location.href);url.searchParams.set("pagina",String(target));history.replaceState(null,"",url.pathname+url.search+url.hash);}
      magazineButton.disabled=false;
      if(new URLSearchParams(location.search).get("vista")==="revista"){
        activePage=target;updateToolbar();await openMagazine();
      }else await navigate(target,false);
    } catch (error) {
      console.error("Error del visor PDF", error);
      pageStage.hidden = true;
      focusButton.disabled=true;
      previousButton.disabled = true;
      nextButton.disabled = true;
      sidePrevious.disabled = true;
      sideNext.disabled = true;
      if (verifiedPdfBlobUrl) {
        nativeMode=true;
        viewportBox.style.overflowX="hidden";viewportBox.style.overflowY="hidden";
        setLoading("No se pudo iniciar el lector avanzado. Se muestra el PDF actualizado en el visor del navegador.");
        nativeFallback.hidden = false;
        nativeFallback.src = verifiedPdfBlobUrl + "#page=1";
        viewerModeButton.textContent = t("Visor PDF clásico");
      } else {
        const missingEnglish=locale==="en" && /(?:HTTP 404|HTTP 400)/.test(String(error.message));
        setLoading(missingEnglish
          ? "English portfolio not published yet. Please check back soon or switch to Español."
          : "No se pudo obtener la versión actual del PDF. Probá «Actualizar PDF» o «Descargar PDF».");
        nativeFallback.hidden = true;
        viewerModeButton.disabled = true;
      }
    }
  }

  window.addEventListener("pagehide", event => {
    if(event.persisted)return;
    cancelFocus();magazine?.dispose();
    if (verifiedPdfBlobUrl) URL.revokeObjectURL(verifiedPdfBlobUrl);
  });

  start();
})();