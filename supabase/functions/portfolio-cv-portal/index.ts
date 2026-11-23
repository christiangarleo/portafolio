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
  if (input.action === "resolve") {
    if (!digits(input.ruc)) return reply(req, { error: "El RUC debe tener 11 digitos" }, 400);
    const { data, error } = await supabase.from("portfolio_cv_documents")
      .select("id,company_name,role_name,storage_path,original_filename,expires_at,is_main")
      .eq("ruc", input.ruc as string).eq("is_active", true)
      .order("is_main", { ascending: false }).order("created_at", { ascending: false }).limit(25);
    if (error) { console.error("cv_lookup", error.message); return reply(req, { error: "Error temporal de consulta" }, 503); }
    const now = Date.now();
    // Si el CV principal esta vencido, no enviar un alternativo de otro puesto.
    const rows = data || [];
    const selected = rows.find((row: any) => row.is_main) || rows[0] || null;
    const item = selected && (!selected.expires_at || new Date(selected.expires_at).getTime() > now) ? selected : null;
    if (!item) return reply(req, { status: "not_found" });
    const { data: signed, error: signError } = await supabase.storage.from("cv-personalizados")
      .createSignedUrl(item.storage_path, 90, { download: item.original_filename });
    if (signError || !signed?.signedUrl) {
      console.error("cv_sign", signError?.message || "signed URL missing");
      return reply(req, { error: "No se pudo preparar el archivo" }, 503);
    }
    return reply(req, { status: "ready", url: signed.signedUrl, company: item.company_name, position: item.role_name });
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