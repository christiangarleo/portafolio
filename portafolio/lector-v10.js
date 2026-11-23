(() => {
  "use strict";

  const SOURCE_PDF = "https://gprhevdotoykofrxbufv.supabase.co/storage/v1/object/public/portafolio/Christian_Arleo_Portafolio.pdf";
  // Cache-busting per visit prevents older PDFs being reused after a replacement.
  // Keep the nonce constant within the current visit, allowing page-to-page reuse.
  const CACHE_NONCE = String(Date.now());
  // The reader and the download must consume the exact same response.
  // Download is retrieved with no-store, then passed directly to PDF.js.
  const DOWNLOAD_URL = SOURCE_PDF + "?download=Christian_Arleo_Portafolio.pdf&cacheNonce=" + CACHE_NONCE;
  let verifiedPdfBlobUrl = null;
  const BASE_URL = "https://christianarleo.com/portafolio/";
  const TITLE = "Portafolio profesional de Christian Gabriel Arleo";
  const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const byId = id => document.getElementById(id);
  const input = byId("pageNumber");
  const canvas = byId("pageCanvas");
  const links = byId("pageLinks");
  const viewportBox = byId("pageViewport");
  const pageStatus = byId("pageStatus");
  const pageContainer = byId("pageContainer");
  const pageStage = byId("pageStage");
  const zoomText = byId("zoomReadout");
  const viewerModeButton = byId("viewerMode");
  const nativeFallback = byId("nativeFallback");
  const totalPagesText = byId("totalPages");
  const previousButton = byId("previousPage");
  const nextButton = byId("nextPage");
  const sectionJumpLinks = Array.from(document.querySelectorAll(".sectionJump[data-page]"));
  const sidePrevious = byId("sidePrevious");
  const sideNext = byId("sideNext");
  const printButton = byId("printPdf");
  const downloadLink = document.querySelector("a.download");
  if (downloadLink) downloadLink.href = DOWNLOAD_URL;
  const shareMenu = byId("actionsMenu");
  const shareButton = byId("actionsToggle");
  let pdfDocument = null, activeRender = null, activePage = 1, totalPages = 55, ticket = 0, resizeTimer, toastTimer;
  let zoomMode = "page", manualZoom = 1, currentScale = 1, nativeMode = false;
  const MIN_ZOOM = 0.25, MAX_ZOOM = 3.0;
  const pageLink = page => BASE_URL + "?pagina=" + page;
  const validPage = value => /^\d+$/.test(String(value)) && Number(value) >= 1 && Number(value) <= totalPages;

  function showMessage(message) {
    const toast = byId("toast");
    toast.textContent = message;
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
  byId("sendWhatsApp").href = "https://wa.me/?text=" + encodeURIComponent(TITLE + "\n" + BASE_URL);
  byId("sendLinkedIn").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(BASE_URL);
  byId("sendEmail").href = "mailto:?subject=" + encodeURIComponent(TITLE) + "&body=" + encodeURIComponent("Te comparto este portafolio: " + BASE_URL);
  byId("copyLink").addEventListener("click", () => { menuOpen(false); copyText(BASE_URL); });
  nativeShare.addEventListener("click", async () => {
    menuOpen(false);
    try { await navigator.share({title: TITLE, url: BASE_URL}); }
    catch (error) { if (error.name !== "AbortError") copyText(BASE_URL); }
  });

  function updateToolbar() {
    totalPagesText.textContent = String(totalPages);
    previousButton.disabled = activePage <= 1;
    nextButton.disabled = activePage >= totalPages;
    sidePrevious.disabled = activePage <= 1;
    sideNext.disabled = activePage >= totalPages;
    input.max = String(totalPages);
    input.value = String(activePage);
    sectionJumpLinks.forEach(link => {
      const sectionStart = Number(link.dataset.page);
      const selected = sectionStart === 3 ? activePage === 3
        : sectionStart === 4 ? activePage === 4
        : sectionStart === 5 ? activePage === 5
        : sectionStart === 6 ? activePage >= 6 && activePage < 23
        : sectionStart === 23 ? activePage >= 23 && activePage <= totalPages : false;
      if (selected) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function setLoading(text) {
    pageStatus.textContent = text;
    pageStatus.hidden = false;
  }

  function resetView() {
    links.replaceChildren();
    pageContainer.hidden = true;
    pageStage.hidden = false;
  }

  async function drawPageLinks(pdfPage, cssViewport) {
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
      anchor.setAttribute("aria-label", "Abrir enlace del portafolio");
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
            if (!dest || !dest[0]) return;
            const index = typeof dest[0] === "number" ? dest[0] : await pdfDocument.getPageIndex(dest[0]);
            if (Number.isInteger(index)) navigate(index+1, true);
          } catch { showMessage("No se pudo abrir el enlace interno"); }
        });
      }
      links.appendChild(anchor);
    }
  }

  async function navigate(page, updateURL=true) {
    if (!validPage(page)) { showMessage("Elegí una página entre 1 y "+totalPages); return; }
    const id = ++ticket;
    activePage = Number(page);
    updateToolbar();
    resetView();
    setLoading("Cargando página " + page + "…");
    try {
      if (!pdfDocument) throw new Error("Lector PDF no disponible");
      if (nativeMode) {
        nativeMode = false;
        nativeFallback.hidden = true;
        pageStage.hidden = false;
        viewerModeButton.textContent = "Visor PDF clásico";
      }
      const pdfPage = await pdfDocument.getPage(Number(page));
      if (id !== ticket) return;
      if (activeRender) {
        const oldRender = activeRender;
        activeRender = null;
        oldRender.cancel();
        try { await oldRender.promise; } catch {}
      }
      if (id !== ticket) return;
      const unit = pdfPage.getViewport({scale:1});
      const narrowLayout = window.innerWidth <= 720;
      // Reserve room for the side navigation on larger screens.
      const horizontalPadding = narrowLayout ? 28 : (window.innerWidth <= 1050 ? 116 : 156);
      const verticalPadding = narrowLayout ? 24 : 44;
      const availableWidth = Math.max(180, viewportBox.clientWidth - horizontalPadding);
      const availableHeight = Math.max(150, viewportBox.clientHeight - verticalPadding);
      const fitWidth = availableWidth / unit.width;
      const fitPage = Math.min(fitWidth, availableHeight / unit.height);
      const scale = zoomMode === "page" ? fitPage : zoomMode === "width" ? fitWidth : manualZoom;
      currentScale = scale;
      zoomText.textContent = Math.round(scale * 100) + "%";
      byId("zoomOut").disabled = scale <= MIN_ZOOM;
      byId("zoomIn").disabled = scale >= MAX_ZOOM;
      const cssViewport = pdfPage.getViewport({scale});
      const maxCanvasPixels = 14000000;
      const safePixelRatio = Math.sqrt(maxCanvasPixels / (cssViewport.width * cssViewport.height));
      const pixelRatio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, safePixelRatio));
      const actualViewport = pdfPage.getViewport({scale:scale*pixelRatio});
      canvas.width = Math.ceil(actualViewport.width);
      canvas.height = Math.ceil(actualViewport.height);
      pageContainer.style.width = cssViewport.width + "px";
      pageContainer.style.height = cssViewport.height + "px";
      canvas.style.width = cssViewport.width + "px";
      canvas.style.height = cssViewport.height + "px";
      links.style.width = cssViewport.width + "px";
      links.style.height = cssViewport.height + "px";
      const context = canvas.getContext("2d", {alpha: false});
      activeRender = pdfPage.render({canvasContext:context,viewport:actualViewport});
      await activeRender.promise;
      if (id !== ticket) return;
      activeRender = null;
      await drawPageLinks(pdfPage, cssViewport);
      if (id !== ticket) return;
      pageContainer.hidden = false;
      pageStatus.hidden = true;
      viewportBox.scrollTop = 0;
      viewportBox.scrollLeft = 0;
      if (updateURL) history.replaceState(null, "", page === 1 ? "/portafolio/" : "/portafolio/?pagina="+page);
    } catch (error) {
      if (id !== ticket || error.name === "RenderingCancelledException") return;
      console.error("Falló renderizado de página", error);
      setLoading("No se pudo mostrar esa página. Usá el enlace de descarga o recargá el sitio.");
    }
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
  previousButton.addEventListener("click", () => navigate(activePage-1));
  nextButton.addEventListener("click", () => navigate(activePage+1));
  sidePrevious.addEventListener("click", () => navigate(activePage-1));
  sideNext.addEventListener("click", () => navigate(activePage+1));
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
        event.shiftKey || nativeMode || !pdfDocument) return;
    const focused = event.target;
    if (focused && (focused.closest("input,textarea,select,[contenteditable='true']") ||
                    focused.closest("[role='textbox']"))) return;
    if (event.key === "ArrowLeft" && activePage > 1) {
      event.preventDefault();
      navigate(activePage - 1);
    } else if (event.key === "ArrowRight" && activePage < totalPages) {
      event.preventDefault();
      navigate(activePage + 1);
    }
  });

  // Print the same PDF bytes as the reader, without navigating to a blob: URL.
  // Browsers such as Brave may use a built-in PDF plugin inside the print frame.
  let printFrame = null, printGuard = null;
  function removePrintFrame() {
    if (printGuard) { clearTimeout(printGuard); printGuard = null; }
    if (printFrame) { printFrame.remove(); printFrame = null; }
    printButton.disabled = false;
    printButton.textContent = "Imprimir";
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
    printButton.textContent = "Preparando…";
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
        showMessage("Si no se abre la impresión, usá «Visor PDF clásico» y Ctrl + P");
      } catch (error) {
        console.error("La impresión del PDF fue bloqueada:", error);
        showMessage("Brave bloqueó la impresión directa. Usá «Visor PDF clásico» y Ctrl + P");
      } finally {
        printButton.disabled = false;
        printButton.textContent = "Imprimir";
      }
    }, {once:true});
    frame.addEventListener("error", () => {
      removePrintFrame();
      showMessage("No se pudo iniciar la impresión. Usá «Visor PDF clásico»");
    }, {once:true});
    // Leave the print frame available until the browser finishes with it.
    // The following click replaces any prior frame rather than opening tabs.
    printGuard = setTimeout(removePrintFrame, 120000);
    document.body.appendChild(frame);
    frame.src = verifiedPdfBlobUrl + "#toolbar=0&navpanes=0";
  });
  function adjustZoom(factor) {
    zoomMode = "manual";
    manualZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentScale * factor));
    if (pdfDocument) navigate(activePage, false);
  }
  byId("zoomOut").addEventListener("click", () => adjustZoom(0.8));
  byId("zoomIn").addEventListener("click", () => adjustZoom(1.25));
  byId("fitPage").addEventListener("click", () => {
    zoomMode = "page"; if (pdfDocument) navigate(activePage, false);
  });
  byId("fitWidth").addEventListener("click", () => {
    zoomMode = "width"; if (pdfDocument) navigate(activePage, false);
  });
  viewerModeButton.addEventListener("click", () => {
    if (!nativeMode) {
      nativeMode = true;
      ticket++;
      if (activeRender) { activeRender.cancel(); activeRender = null; }
      pageStage.hidden = true;
      pageStatus.hidden = true;
      nativeFallback.hidden = false;
      if (!verifiedPdfBlobUrl) {
        nativeMode = false;
        nativeFallback.hidden = true;
        pageStage.hidden = false;
        showMessage("La versión actual del PDF todavía no está disponible");
        return;
      }
      nativeFallback.src = verifiedPdfBlobUrl + "#page=" + activePage + "&view=FitH";
      viewerModeButton.textContent = "Volver al lector";
      showMessage("Visor clásico: zoom, impresión, descarga y selección de texto desde el PDF");
    } else {
      nativeMode = false;
      nativeFallback.hidden = true;
      pageStage.hidden = false;
      viewerModeButton.textContent = "Visor PDF clásico";
      navigate(activePage, false);
    }
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
    if (!pdfDocument || nativeMode) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => navigate(activePage,false), 320);
  });
  document.addEventListener("fullscreenchange", () => {
    // Keep the controls accessible: request fullscreen on the whole application.
    const label = document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa";
    fullscreenButton.setAttribute("aria-label", label);
    fullscreenButton.setAttribute("title", label);
    fullscreenButton.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
  });

  window.addEventListener("popstate", () => {
    const fromURL = new URLSearchParams(location.search).get("pagina");
    navigate(validPage(fromURL) ? Number(fromURL) : 1, false);
  });

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
      const requested = new URLSearchParams(location.search).get("pagina");
      nativeFallback.hidden = true;
      await navigate(validPage(requested) ? Number(requested) : 1, false);
    } catch (error) {
      console.error("Error del visor PDF", error);
      pageStage.hidden = true;
      previousButton.disabled = true;
      nextButton.disabled = true;
      sidePrevious.disabled = true;
      sideNext.disabled = true;
      if (verifiedPdfBlobUrl) {
        setLoading("No se pudo iniciar el lector avanzado. Se muestra el PDF actualizado en el visor del navegador.");
        nativeFallback.hidden = false;
        nativeFallback.src = verifiedPdfBlobUrl + "#page=1";
        viewerModeButton.textContent = "Visor PDF clásico";
      } else {
        setLoading("No se pudo obtener la versión actual del PDF. Probá «Actualizar PDF» o «Descargar PDF».");
        nativeFallback.hidden = true;
        viewerModeButton.disabled = true;
      }
    }
  }

  window.addEventListener("pagehide", () => {
    if (verifiedPdfBlobUrl) URL.revokeObjectURL(verifiedPdfBlobUrl);
  });

  start();
})();