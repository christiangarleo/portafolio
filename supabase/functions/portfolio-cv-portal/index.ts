import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(PROJECT_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const trustedOrigins = new Set(["https://christianarleo.com", "https://www.christianarleo.com"]);
function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": trustedOrigins.has(origin) ? origin : "https://christianarleo.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}
function reply(req: Request, data: object, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}
const digits = (v: unknown) => typeof v === "string" && /^[0-9]{11}$/.test(v);
const text = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return reply(req, { error: "Metodo no permitido" }, 405);
  const origin = req.headers.get("origin");
  if (origin && !trustedOrigins.has(origin)) return reply(req, { error: "Origen no permitido" }, 403);
  const length = Number(req.headers.get("content-length") || "0");
  if (length > 10000) return reply(req, { error: "Solicitud demasiado grande" }, 413);
  let input: Record<string, unknown>;
  try { input = await req.json(); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); }
  catch { return reply(req, { error: "Solicitud invalida" }, 400); }
  // El RUC identifica a la empresa; NO autentica al reclutador.
  // No exponer el estado interno de las postulaciones en este portal.
  const cvSelect = "id,company_name,role_name,storage_path,original_filename,expires_at,is_main";
  async function signedLink(row: { storage_path: string; original_filename: string }) {
    const { data, error } = await supabase.storage.from("cv-personalizados")
      .createSignedUrl(row.storage_path, 90, { download: row.original_filename });
    if (error || !data?.signedUrl) throw Error(error?.message || "Signed URL missing");
    return data.signedUrl;
  }
  if (input.action === "resolve") {
    if (!digits(input.ruc)) return reply(req, { error: "El RUC debe tener 11 digitos" }, 400);
    const { data, error } = await supabase.from("portfolio_cv_documents")
      .select(cvSelect)
      .eq("ruc", input.ruc as string).eq("is_active", true)
      .order("is_main", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (error) { console.error("cv_lookup", error.message); return reply(req, { error: "Error temporal de consulta" }, 503); }
    const now = Date.now();
    const rows = data || [];
    // El portal existe para cada empresa con CV registrados, incluso si hay uno solo.
    // También muestra vencidos como historial, sin permitir descargarlos.
    if (!rows.length) return reply(req, { status: "not_found" });
    const items = rows.map((row: any) => ({
      id: row.id, position: row.role_name, expires_at: row.expires_at,
      available: !row.expires_at || new Date(row.expires_at).getTime() > now
    })).sort((a: any,b: any) => Number(b.available) - Number(a.available));
    return reply(req, { status: "company", company: rows[0].company_name, items });
  }
  if (input.action === "download") {
    const id = text(input.id, 50);
    if (!digits(input.ruc) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return reply(req, { error: "Solicitud invalida" }, 400);
    const { data: row, error } = await supabase.from("portfolio_cv_documents")
      .select(cvSelect).eq("id", id).eq("ruc", input.ruc as string).eq("is_active", true).maybeSingle();
    if (error) { console.error("cv_download_lookup",error.message); return reply(req,{ error:"No se pudo consultar el archivo" },503); }
    if (!row || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()))
      return reply(req,{ error:"Este CV ya no está disponible" },404);
    try {
      const url = await signedLink(row);
      return reply(req, { status:"ready", url, company:row.company_name, position:row.role_name });
    } catch (error) {
      console.error("cv_download_sign",String(error));
      return reply(req,{ error:"No se pudo preparar el archivo" },503);
    }
  }
  if (input.action === "lead_v2") {
    if (text(input.website, 300)) return reply(req, { status: "received" });
    const kind = text(input.kind, 25);
    const company = text(input.company_name, 160);
    const ruc = text(input.ruc, 11);
    const name = text(input.contact_name, 140);
    const email = text(input.email, 200).toLowerCase();
    const phone = text(input.phone, 65);
    const contactPreference = text(input.contact_preference, 30);
    const contactMethod = text(input.contact_method, 30);
    const contactTime = text(input.contact_time, 30);
    const observations = text(input.observations, 1000);
    const data = input.intake;
    const obj = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const inList = (value: string, vals: string[]) => vals.includes(value);
    const whenDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T12:00:00Z").getTime());
    const daysValid = (val: unknown) => Array.isArray(val) && val.length <= 7 && val.every(x => typeof x === "string" &&
      ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"].includes(x)) && new Set(val).size === val.length;
    const clean = (key: string, max: number) => text(obj?.[key], max);
    const invalid = () => reply(req, { error: "Revisá los campos obligatorios y las condiciones seleccionadas." }, 400);
    if (!inList(kind, ["in_house","proyecto"]) || !digits(ruc) || company.length < 2 || name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !obj ||
      !inList(contactPreference, ["contactame","empresa_contacta"]) ||
      (contactPreference === "contactame" &&
        (!inList(contactMethod, ["whatsapp","llamada","email"]) ||
        ((contactMethod === "whatsapp" || contactMethod === "llamada") && phone.length < 6))) ||
      (contactPreference === "empresa_contacta" && (contactMethod !== "" || contactTime !== "")) ||
      !inList(contactTime, ["","manana","tarde","indistinto"]))
      return invalid();

    const workMode = clean("work_mode", 25);
    if (!inList(workMode, ["remoto","presencial","hibrido"])) return invalid();
    const needsLocation = workMode !== "remoto";
    const workCountry = clean("work_country", 80);
    const workCity = clean("work_city", 100);
    const workDistrict = clean("work_district", 100);
    if (needsLocation && (!workCountry || !workCity || !workDistrict)) return invalid();
    const intake: Record<string, unknown> = {
      work_mode: workMode,
      work_country: needsLocation ? workCountry : "",
      work_city: needsLocation ? workCity : "",
      work_district: needsLocation ? workDistrict : ""
    };
    let position = "";
    if (kind === "in_house") {
      position = clean("position", 180);
      const dedication = clean("dedication", 30);
      const hoursRequired = dedication === "part_time" || dedication === "por_horas";
      const hours = obj.hours;
      const hoursPeriod = clean("hours_period", 15);
      const workDays = obj.work_days;
      const officeDays = obj.office_days;
      const timezone = clean("timezone", 50);
      const scheduleTbd = obj.schedule_tbd === true;
      const start = clean("daily_start", 5), end = clean("daily_end", 5);
      const responsibilities = clean("responsibilities", 1500);
      const startDate = clean("start_date", 15);
      if (!position || !inList(dedication, ["full_time","part_time","por_horas"]) ||
        (hoursRequired && (typeof hours !== "number" || !Number.isInteger(hours) || hours < 1 || hours > 240 ||
          !inList(hoursPeriod, ["semana","mes","total"]))) ||
        !daysValid(workDays) || !(workDays as string[]).length || !daysValid(officeDays) ||
        (workMode === "hibrido" && !(officeDays as string[]).length) ||
        !inList(timezone, ["America/Lima","America/Bogota","America/Mexico_City","America/Santiago","America/Argentina/Buenos_Aires","UTC"]) ||
        (!scheduleTbd && (!/^\d\d:\d\d$/.test(start) || !/^\d\d:\d\d$/.test(end))) ||
        !responsibilities || !whenDate(startDate))
        return invalid();
      Object.assign(intake, {
        position, dedication, hours: hoursRequired ? hours : null,
        hours_period: hoursRequired ? hoursPeriod : "",
        work_days: workDays, office_days: workMode === "hibrido" ? officeDays : [],
        timezone, schedule_tbd: scheduleTbd,
        daily_start: scheduleTbd ? "" : start, daily_end: scheduleTbd ? "" : end,
        start_date: startDate, salary: clean("salary",100),
        responsibilities
      });
    } else {
      position = clean("project_name", 180);
      const area = clean("project_area", 30);
      const problem = clean("problem", 1800);
      const outcome = clean("outcome", 1200);
      const deliverables = clean("deliverables",1000);
      const startDate = clean("start_date", 15);
      const deadlineTbd = obj.deadline_tbd === true;
      const due = clean("due_date", 15);
      const ref = clean("reference_url", 400);
      if (!position || !inList(area, ["marketing","tecnologia_ia","datos","diseno","otro"]) ||
        !problem || !outcome || !whenDate(startDate) ||
        (!deadlineTbd && (!due || !whenDate(due))) ||
        (ref && !/^https?:\/\/[^\s]+$/i.test(ref)))
        return invalid();
      Object.assign(intake, {
        project_name: position, project_area: area, problem, outcome, deliverables,
        start_date: startDate, deadline_tbd: deadlineTbd, due_date: deadlineTbd ? "" : due,
        budget: clean("budget",100), reference_url: ref
      });
    }

    // Datos enviados por los formularios nuevos: se mantienen estructurados
    // sin romper registros históricos del endpoint "lead" anterior.
    const { error } = await supabase.from("portfolio_cv_leads").insert({
      kind, company_name: company, ruc, contact_name: name, email,
      phone: phone || null, position_or_project: position,
      details: kind === "in_house" ? String(intake.responsibilities || "") : String(intake.problem || ""),
      contact_preference: contactPreference,
      contact_method: contactPreference === "contactame" ? contactMethod : null,
      contact_time: contactPreference === "contactame" ? contactTime || null : null,
      observations: observations || null,
      intake_data: intake, intake_version: 2
    });
    if (error) {
      console.error("lead_v2_insert", error.message);
      return reply(req, { error: "No se pudo registrar la propuesta." }, 503);
    }
    return reply(req, { status: "received" });
  }
  if (input.action === "lead") {
    // Simple honeypot for automated form submissions.
    if (text(input.website, 500)) return reply(req, { status: "received" });
    const kind = text(input.kind, 30);
    const company = text(input.company_name, 160);
    const name = text(input.contact_name, 140);
    const email = text(input.email, 200).toLowerCase();
    const ruc = text(input.ruc, 11);
    if (!["solicitud_cv","in_house","proyecto"].includes(kind) || company.length < 2 ||
      name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (ruc && !digits(ruc))) {
      return reply(req, { error: "Revisa los datos obligatorios" }, 400);
    }
    const { error } = await supabase.from("portfolio_cv_leads").insert({
      kind, company_name: company, contact_name: name, email, ruc: ruc || null,
      phone: text(input.phone, 65), position_or_project: text(input.position_or_project, 180),
      details: text(input.details, 1600)
    });
    if (error) { console.error("cv_lead", error.message); return reply(req, { error: "No se pudo registrar la solicitud" }, 503); }
    return reply(req, { status: "received" });
  }
  return reply(req, { error: "Accion invalida" }, 400);
});