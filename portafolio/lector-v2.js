(() => {
  "use strict";

  const PDF_URL = "https://gprhevdotoykofrxbufv.supabase.co/storage/v1/object/public/portafolio/Christian_Arleo_Portafolio.pdf";
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
  const nativeFallback = byId("nativeFallback");
  const currentPageText = byId("currentPage");
  const totalPagesText = byId("totalPages");
  const previousButton = byId("previousPage");
  const nextButton = byId("nextPage");
  const shareMenu = byId("shareMenu");
  const shareButton = byId("shareToggle");
  let pdfDocument = null, activeRender = null, activePage = 1, totalPages = 55, ticket = 0, resizeTimer, toastTimer;
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
    if (!byId("shareWrap").contains(event.target)) menuOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") menuOpen(false);
  });

  const nativeShare = byId("nativeShare");
  nativeShare.hidden = typeof navigator.share !== "function";
  byId("shareWhatsApp").href = "https://wa.me/?text=" + encodeURIComponent(TITLE + "\n" + BASE_URL);
  byId("shareLinkedIn").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(BASE_URL);
  byId("shareEmail").href = "mailto:?subject=" + encodeURIComponent(TITLE) + "&body=" + encodeURIComponent("Te comparto este portafolio: " + BASE_URL);
  byId("copyLink").addEventListener("click", () => { menuOpen(false); copyText(BASE_URL); });
  nativeShare.addEventListener("click", async () => {
    menuOpen(false);
    try { await navigator.share({title: TITLE, url: BASE_URL}); }
    catch (error) { if (error.name !== "AbortError") copyText(BASE_URL); }
  });

  function updateToolbar() {
    totalPagesText.textContent = String(totalPages);
    currentPageText.textContent = String(activePage);
    previousButton.disabled = activePage <= 1;
    nextButton.disabled = activePage >= totalPages;
    input.max = String(totalPages);
    input.value = String(activePage);
  }

  function setLoading(text) {
    pageStatus.textContent = text;
    pageStatus.hidden = false;
  }

  function resetView() {
    links.replaceChildren();
    pageContainer.hidden = true;
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
      const available = Math.max(240, viewportBox.clientWidth - 34);
      const scale = Math.min(1.7, available / unit.width);
      const cssViewport = pdfPage.getViewport({scale});
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const actualViewport = pdfPage.getViewport({scale:scale*pixelRatio});
      canvas.width = Math.ceil(actualViewport.width);
      canvas.height = Math.ceil(actualViewport.height);
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
      if (updateURL) history.replaceState(null, "", page === 1 ? "/portafolio/" : "/portafolio/?pagina="+page);
    } catch (error) {
      if (id !== ticket || error.name === "RenderingCancelledException") return;
      console.error("Falló renderizado de página", error);
      setLoading("No se pudo mostrar esa página. Usá el enlace de descarga o recargá el sitio.");
    }
  }

  byId("gotoForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!validPage(input.value)) { showMessage("Ingresá un número entre 1 y "+totalPages); return; }
    navigate(Number(input.value));
  });
  previousButton.addEventListener("click", () => navigate(activePage-1));
  nextButton.addEventListener("click", () => navigate(activePage+1));
  byId("sharePage").addEventListener("click", async () => {
    const page = validPage(input.value) ? Number(input.value) : activePage;
    const link = pageLink(page);
    if (typeof navigator.share === "function") {
      try { await navigator.share({title: TITLE+" · página "+page,url:link}); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    await copyText(link);
  });

  const reader = byId("readerPanel");
  const fullscreenButton = byId("fullscreen");
  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (reader.requestFullscreen) await reader.requestFullscreen();
      else showMessage("Tu navegador no admite pantalla completa");
    } catch { showMessage("No se pudo activar pantalla completa"); }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa ⛶";
  });

  window.addEventListener("resize", () => {
    if (!pdfDocument) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => navigate(activePage,false), 320);
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
      pdfDocument = await library.getDocument({url:PDF_URL,withCredentials:false}).promise;
      totalPages = pdfDocument.numPages;
      const requested = new URLSearchParams(location.search).get("pagina");
      nativeFallback.hidden = true;
      await navigate(validPage(requested) ? Number(requested) : 1, false);
    } catch (error) {
      console.error("Error del visor PDF", error);
      setLoading("El lector avanzado no está disponible en este navegador. Se muestra el visor alternativo.");
      nativeFallback.hidden = false;
      nativeFallback.src = PDF_URL + "#page=1";
      previousButton.disabled = true;
      nextButton.disabled = true;
      byId("goToPage").disabled = true;
    }
  }

  start();
})();