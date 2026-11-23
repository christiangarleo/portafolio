(() => {
  "use strict";
  const endpoint = "https://gprhevdotoykofrxbufv.supabase.co/functions/v1/portfolio-cv-portal";
  const by = id => document.getElementById(id);
  const button = by("downloadToggle"), menu = by("downloadMenu"), dialog = by("cvDialog");
  const lookup = by("cvLookupForm"), rucField = by("cvRuc"), result = by("cvResult");
  const leadBox = by("cvLeadBox"), leadForm = by("cvLeadForm"), leadKind = by("cvLeadKind");
  const companyPanel = by("cvCompanyPanel"), documentList = by("cvDocumentList");
  let lastRuc = "";
  function closeMenu() { menu.hidden = true; button.setAttribute("aria-expanded", "false"); }
  function locateMenu() {
    const rect = button.getBoundingClientRect();
    const width = 228;
    menu.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)) + "px";
    menu.style.top = Math.min(window.innerHeight - 110, rect.bottom + 7) + "px";
  }
  button.addEventListener("click", () => {
    const open = menu.hidden;
    if (open) locateMenu();
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("pointerdown", evt => {
    if (!menu.hidden && !menu.contains(evt.target) && !button.contains(evt.target)) closeMenu();
  });
  document.addEventListener("keydown", evt => { if (evt.key === "Escape") closeMenu(); });
  window.addEventListener("resize", () => { if (!menu.hidden) locateMenu(); });
  window.addEventListener("scroll", () => { if (!menu.hidden) locateMenu(); }, true);
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));
  by("cvOpen").addEventListener("click", () => {
    closeMenu();
    leadBox.hidden = true;
    by("cvChoices").hidden = true;
    companyPanel.hidden = true;
    documentList.replaceChildren();
    result.textContent = "";
    dialog.showModal();
    rucField.focus();
  });
  by("cvClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", evt => { if (evt.target === dialog) dialog.close(); });
  async function send(payload) {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || "No se pudo procesar la solicitud");
    return data;
  }
  function setResult(value, error) {
    result.textContent = value;
    result.setAttribute("data-error", String(Boolean(error)));
  }
  function beginDownload(data) {
    setResult("CV " + (data.position || "") + " disponible. Iniciando descarga…", false);
    const link = document.createElement("a");
    link.href = data.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Descargar ahora";
    link.className = "cvManualLink";
    result.append(document.createTextNode(" "), link);
    link.click();
  }
  function displayCompanyPortal(data) {
    by("cvCompanyHeading").textContent = "CV disponibles para " + data.company;
    documentList.replaceChildren();
    for (const item of data.items) {
      const card = document.createElement("article");
      card.className = "cvDocCard";
      const heading = document.createElement("h4");
      heading.textContent = item.position || "CV personalizado";
      const badge = document.createElement("span");
      badge.className = "cvDocStatus" + (item.available ? "" : " cvDocStatus--expired");
      badge.textContent = item.available ? "Vigente" : "Vencido";
      const expiry = document.createElement("small");
      expiry.textContent = item.expires_at
        ? "Vigencia hasta: " + new Date(item.expires_at).toLocaleString("es-PE",{dateStyle:"medium"})
        : "Sin fecha de vencimiento";
      const download = document.createElement("button");
      download.type = "button";
      download.dataset.cvId = item.id;
      download.disabled = !item.available;
      download.textContent = item.available ? "Descargar este CV ↓" : "No disponible";
      card.append(badge, heading, expiry, download);
      documentList.append(card);
    }
    const count = data.items.filter(item => item.available).length;
    by("cvCompanySub").textContent =
      count + (count === 1 ? " CV vigente" : " CV vigentes") + " para este RUC. Elegí la vacante que te interesa.";
    companyPanel.hidden = false;
  }
  documentList.addEventListener("click", async event => {
    const action = event.target.closest("button[data-cv-id]");
    if (!action || action.disabled) return;
    action.disabled = true;
    setResult("Preparando CV seleccionado…", false);
    try {
      const data = await send({ action: "download", ruc: lastRuc, id: action.dataset.cvId });
      if (data.status === "ready" && data.url) beginDownload(data);
      else setResult("No se pudo generar la descarga.", true);
    } catch(error) {
      setResult(error.message || "No se pudo descargar el CV.", true);
    } finally {
      action.disabled = false;
    }
  });
  lookup.addEventListener("submit", async evt => {
    evt.preventDefault();
    lastRuc = rucField.value.replace(/\D/g, "");
    if (!/^\d{11}$/.test(lastRuc)) { setResult("Ingresá un RUC de 11 dígitos.", true); return; }
    leadBox.hidden = true;
    by("cvChoices").hidden = true;
    companyPanel.hidden = true;
    documentList.replaceChildren();
    const submit = lookup.querySelector("button[type=submit]");
    submit.disabled = true;
    setResult("Buscando un CV disponible…", false);
    try {
      const data = await send({ action: "resolve", ruc: lastRuc });
      if (data.status === "ready" && data.url) {
        beginDownload(data);
      } else if (data.status === "multiple" && Array.isArray(data.items)) {
        setResult("", false);
        displayCompanyPortal(data);
      } else if (data.status === "not_found") {
        setResult("No hay CV vigentes asociados a ese RUC. ¿Cómo querés contactarme?", false);
        by("cvChoices").hidden = false;
      } else {
        setResult("No pudimos obtener los CV. Intentá nuevamente.", true);
      }
    } catch (e) { setResult(e.message || "Ocurrió un error al consultar.", true); }
    finally { submit.disabled = false; }
  });
  const headings = {
    solicitud_cv: ["Solicitar un CV", "Puesto o vacante"],
    in_house: ["Contratar servicios in-house", "Puesto o modalidad de trabajo"],
    proyecto: ["Proponer un proyecto", "Proyecto o servicio requerido"]
  };
  by("cvChoices").addEventListener("click", evt => {
    const choice = evt.target.closest("[data-kind]");
    if (!choice) return;
    const kind = choice.dataset.kind;
    if (!headings[kind]) return;
    leadKind.value = kind;
    by("cvInhouseFields").hidden = kind !== "in_house";
    by("cvProjectFields").hidden = kind !== "proyecto";
    by("cvLeadTitle").textContent = headings[kind][0];
    by("cvLeadPositionLabel").textContent = headings[kind][1];
    by("cvLeadRuc").value = lastRuc;
    leadBox.hidden = false;
    by("cvLeadStatus").textContent = "";
    by("cvLeadCompany").focus();
  });
  leadForm.addEventListener("submit", async evt => {
    evt.preventDefault();
    const form = new FormData(leadForm);
    const data = Object.fromEntries(form.entries());
    const extra = [];
    if (data.kind === "in_house" && data.modalidad) extra.push("Modalidad: " + data.modalidad);
    if (data.kind === "proyecto") {
      if (data.presupuesto) extra.push("Presupuesto: " + data.presupuesto);
      if (data.plazo) extra.push("Plazo: " + data.plazo);
    }
    data.details = [data.details, ...extra].filter(Boolean).join("\n");
    const submit = leadForm.querySelector("button[type=submit]");
    submit.disabled = true;
    by("cvLeadStatus").textContent = "Enviando solicitud…";
    try {
      await send({action:"lead", ...data});
      leadBox.hidden = true;
      by("cvChoices").hidden = true;
      setResult("Solicitud registrada. Gracias, te responderé por los datos proporcionados.", false);
      leadForm.reset();
    } catch(e) { by("cvLeadStatus").textContent = e.message || "No se pudo enviar."; }
    finally { submit.disabled = false; }
  });
})();