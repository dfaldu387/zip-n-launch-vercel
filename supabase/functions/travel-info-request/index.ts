import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// One function, three actions:
//   send   - the show manager (signed in) emails a staff member a link asking for travel details
//   get    - the staff member's page loads what was asked (link only, no login)
//   submit - the staff member sends one travel item (flight, hotel, ...) plus receipts
//
// The link is base64url(`${projectId}:${memberId}:${secret}`). The secret is stored on the show at
// project_data.travelRequests[memberId] and re-sending issues a new one (the old link stops working).
// Answers are saved to project_data.travelSubmissions, NOT straight into travelData, so a manager who has
// the Travel page open cannot overwrite them with a stale copy; the Travel page folds them in when it loads.

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const ITEMS: Record<string, { label: string; fields: string[]; dateFields: string[]; moneyFields: string[] }> = {
  flight: {
    label: "Flight",
    fields: ["airline", "flightNumber", "departureAirport", "arrivalAirport", "departureTime", "arrivalTime", "returnDepartureTime", "returnArrivalTime", "confirmation", "actualCost"],
    dateFields: ["departureTime", "arrivalTime", "returnDepartureTime", "returnArrivalTime"],
    moneyFields: ["actualCost"],
  },
  hotel: {
    label: "Hotel",
    fields: ["hotelName", "checkIn", "checkOut", "confirmation", "roomType", "actualCost"],
    dateFields: ["checkIn", "checkOut"],
    moneyFields: ["actualCost"],
  },
  rentalCar: {
    label: "Rental Car",
    fields: ["company", "pickupTime", "returnTime", "pickupLocation", "vehicleType", "confirmation", "actualCost"],
    dateFields: ["pickupTime", "returnTime"],
    moneyFields: ["actualCost"],
  },
  mileage: {
    label: "Mileage",
    fields: ["origin", "destination", "startDate", "endDate", "miles", "purpose"],
    dateFields: ["startDate", "endDate"],
    moneyFields: ["miles"],
  },
  // Personal details the show needs to book travel in the person's name. The attached files are the
  // driver license photo (stored under licenses/, same private bucket).
  profile: {
    label: "Traveler Profile",
    fields: ["legalName", "email", "mobile", "homeAirport", "knownTravelerNumber", "frequentFlyers"],
    dateFields: [],
    moneyFields: [],
  },
};

// Longer free-text fields (frequent flyer list is one "Airline: number" per line).
const LONG_FIELDS = ["frequentFlyers"];

const ALLOWED_FILES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

function makeToken(projectId: string, memberId: string, secret: string): string {
  return btoa(`${projectId}:${memberId}:${secret}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseToken(token: string): { projectId: string; memberId: string; secret: string } | null {
  try {
    const raw = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const first = raw.indexOf(":");
    const last = raw.lastIndexOf(":");
    if (first === -1 || last <= first) return null;
    const secret = raw.slice(last + 1);
    if (!secret) return null;
    return { projectId: raw.slice(0, first), memberId: raw.slice(first + 1, last), secret };
  } catch {
    return null;
  }
}

function secretMatches(a: unknown, b: unknown): boolean {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (!x || !y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function makeSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "SHOW_MANAGER" -> "Show Manager". Custom role names the manager typed are left alone.
const prettyRole = (role: string) =>
  /^[A-Z0-9_]+$/.test(role) ? role.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : role;

function findMember(pd: any, memberId: string): { name: string; email: string; role: string; phone: string } | null {
  const officials = pd?.showDetails?.officials || {};
  for (const roles of Object.values<any>(officials)) {
    for (const [roleId, members] of Object.entries<any>(roles || {})) {
      for (const m of members || []) {
        if (m?.id === memberId) {
          return { name: m.name || "", email: (m.email || "").trim(), role: m.custom_role_name || roleId, phone: (m.phone || "").trim() };
        }
      }
    }
  }
  const rostered = (pd?.staffSchedule?.roster || []).find((e: any) => e?.id === memberId);
  if (rostered) return { name: rostered.name || "", email: (rostered.email || "").trim(), role: "Staff", phone: (rostered.phone || "").trim() };
  return null;
}

// Copies a submitted profile's email / mobile onto the person's staff card (Officials & Staff list, or the
// hand-added roster), but only into fields that are still empty: what the manager typed is never replaced.
// Returns the names of the fields that were filled.
function fillStaffContact(pd: any, memberId: string, email: string, mobile: string): string[] {
  const filled: string[] = [];
  const fill = (m: any) => {
    if (email && !String(m.email || "").trim()) { m.email = email; filled.push("email"); }
    if (mobile && !String(m.phone || "").trim()) { m.phone = mobile; filled.push("phone"); }
  };
  const officials = pd?.showDetails?.officials || {};
  for (const roles of Object.values<any>(officials)) {
    for (const members of Object.values<any>(roles || {})) {
      for (const m of members || []) if (m?.id === memberId) fill(m);
    }
  }
  for (const e of pd?.staffSchedule?.roster || []) if (e?.id === memberId) fill(e);
  return Array.from(new Set(filled));
}

// Activity log kept on the show (project_data.travelActivity): one line per email sent and per answer received.
const MAX_ACTIVITY = 200;
function addActivity(pd: any, entry: Record<string, unknown>) {
  pd.travelActivity = [...(pd.travelActivity || []), entry].slice(-MAX_ACTIVITY);
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Resolve a link to its show, person and request, or null when the link is not (or no longer) valid. */
async function openLink(token: string) {
  const parsed = token ? parseToken(token) : null;
  if (!parsed) return null;
  const supabase = adminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, project_name, project_data")
    .eq("id", parsed.projectId)
    .maybeSingle();
  if (!project) return null;
  const request = project.project_data?.travelRequests?.[parsed.memberId];
  if (!request || !secretMatches(request.secret, parsed.secret)) return null;
  return { supabase, project, parsed, request };
}

const pick = (card: any, fields: string[]) => {
  const out: Record<string, string> = {};
  for (const f of fields) if (card?.[f] !== undefined && card?.[f] !== null) out[f] = String(card[f]);
  return out;
};

async function handleSend(req: Request, body: any) {
  if (!POSTMARK_API_TOKEN) return json({ error: "Email service not configured" }, 500);
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Please sign in and try again." }, 401);

  const { projectId, memberId, items, origin } = body;
  if (!projectId || !memberId || !Array.isArray(items) || !origin) return json({ error: "Missing request data." }, 400);
  const types = items.filter((t: string) => ITEMS[t]);
  if (types.length === 0) return json({ error: "Choose at least one item to request." }, 400);
  if (!/^https?:\/\/[^\s/]+$/.test(String(origin))) return json({ error: "Invalid site address." }, 400);

  // Read the show as the caller: row-level security decides whether they may see (and so manage) it.
  const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: visible } = await asUser.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!visible) return json({ error: "You do not have access to this show." }, 403);

  const supabase = adminClient();
  const { data: project } = await supabase.from("projects").select("project_name, project_data").eq("id", projectId).maybeSingle();
  if (!project) return json({ error: "Show not found." }, 404);

  const pd = project.project_data || {};
  const member = findMember(pd, memberId);
  if (!member) return json({ error: "Staff member not found." }, 404);
  if (!member.email) return json({ error: `${member.name || "This person"} has no email address on the Officials & Staff page.` }, 400);

  const secret = makeSecret();
  const link = `${origin}/travel-info/${makeToken(projectId, memberId, secret)}`;
  const showName = project.project_name || pd.showName || "the show";
  // A Traveler Profile request is the show asking for the details it needs to book travel in their name.
  const askingProfile = types.includes("profile");
  const heading = askingProfile ? "Travel Information Needed" : "Travel Details Needed";
  const intro = askingProfile
    ? `We need your travel information for <strong>${esc(showName)}</strong>, so the show can book your travel in your name. We are asking for:`
    : `Please send us your travel details for <strong>${esc(showName)}</strong>, so we can plan the show and match your receipts. We are asking for:`;
  const itemList = types.map((t: string) => `<li style="margin: 4px 0;">${esc(ITEMS[t].label)}</li>`).join("");

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": POSTMARK_API_TOKEN },
    body: JSON.stringify({
      From: "EquiPatterns <Info@equipatterns.com>",
      To: member.email,
      Subject: `${heading} — ${showName}`,
      HtmlBody: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f9fc;padding:40px 20px;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
<h1 style="margin:0;font-size:24px;font-weight:700;">${heading}</h1><p style="margin:8px 0 0;opacity:.9;font-size:14px;">${esc(showName)}</p></td></tr>
<tr><td style="background:#fff;padding:30px;border:1px solid #e5e7eb;border-top:none;">
<p style="color:#333;font-size:16px;line-height:26px;margin:0 0 16px;">Hello ${esc(member.name || "there")},</p>
<p style="color:#333;font-size:16px;line-height:26px;margin:0 0 8px;">${intro}</p>
<ul style="color:#333;font-size:16px;line-height:24px;margin:0 0 16px;padding-left:22px;">${itemList}</ul>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;"><tr><td align="center">
<a href="${link}" style="background:#2563eb;border-radius:8px;color:#fff;display:inline-block;font-size:16px;font-weight:600;padding:14px 32px;text-decoration:none;">Enter Travel Details</a></td></tr></table>
<p style="color:#6b7280;font-size:13px;text-align:center;margin:24px 0 0;">No login needed. If you have any questions, reply to this email.</p>
</td></tr>
<tr><td style="background:#374151;color:#9ca3af;padding:20px;text-align:center;border-radius:0 0 8px 8px;font-size:12px;"><p style="margin:0;">EquiPatterns — Horse Show Management</p></td></tr>
</table></td></tr></table></body></html>`,
      MessageStream: "outbound",
    }),
  });
  if (!res.ok) {
    console.error("Postmark error:", await res.text());
    return json({ error: `Email delivery failed (${res.status}).` }, 500);
  }

  // Save the request on the newest copy of the show, touching only this person's entry.
  const { data: fresh } = await supabase.from("projects").select("project_data").eq("id", projectId).maybeSingle();
  const latest = fresh?.project_data || pd;
  const sentAt = new Date().toISOString();
  latest.travelRequests = { ...(latest.travelRequests || {}), [memberId]: { secret, email: member.email, items: types, sentAt } };
  const { data: sender } = await asUser.auth.getUser();
  addActivity(latest, {
    type: "email_sent",
    at: sentAt,
    memberId,
    name: member.name,
    email: member.email,
    items: types.map((t: string) => ITEMS[t].label),
    by: sender?.user?.email || "",
  });
  const { error } = await supabase.from("projects").update({ project_data: latest }).eq("id", projectId);
  if (error) {
    console.error("travel-info-request save error:", error);
    return json({ error: "The email went out but the request could not be saved. Please send it again." }, 500);
  }
  return json({ success: true, sentAt, email: member.email });
}

async function handleGet(body: any) {
  const link = await openLink(body.token);
  if (!link) return json({ error: "This link is invalid or has expired. Please ask the show office to resend it." }, 403);
  const { project, parsed, request } = link;
  const pd = project.project_data || {};
  const member = findMember(pd, parsed.memberId);
  const entry = pd.travelData?.[parsed.memberId] || {};
  const submitted = pd.travelSubmissions?.[parsed.memberId] || {};

  const items = (request.items || []).filter((t: string) => ITEMS[t]).map((t: string) => ({
    type: t,
    label: ITEMS[t].label,
    submittedAt: submitted[t]?.submittedAt || null,
    // What is already on file (or sent earlier), so the person corrects it instead of retyping.
    values: {
      ...(t === "profile" ? { legalName: member?.name || "", email: member?.email || "", mobile: member?.phone || "" } : {}),
      ...pick(entry[t], ITEMS[t].fields),
      ...(submitted[t]?.values || {}),
    },
    datesLocked: !!entry[t]?.datesLocked,
    receipts: (submitted[t]?.receipts || []).map((r: any) => ({ id: r.id, name: r.name })),
  }));
  return json({
    showName: project.project_name || pd.showName || "",
    memberName: member?.name || "",
    role: prettyRole(member?.role || ""),
    items,
  });
}

async function handleSubmit(body: any) {
  const link = await openLink(body.token);
  if (!link) return json({ error: "This link is invalid or has expired. Please ask the show office to resend it." }, 403);
  const { supabase, project, parsed, request } = link;
  return processSubmit(body, { supabase, project, parsed, allowedTypes: request.items || [] });
}

// Shared by the email link (handleSubmit) and the Staff Portal (handlePortalSubmit): validate one item,
// store its receipts, and save the answer to project_data.travelSubmissions.
async function processSubmit(
  body: any,
  ctx: { supabase: any; project: any; parsed: { projectId: string; memberId: string }; allowedTypes: string[] },
) {
  const { supabase, project, parsed, allowedTypes } = ctx;

  const type = String(body.type || "");
  const spec = ITEMS[type];
  if (!spec || !allowedTypes.includes(type)) return json({ error: "That item was not requested." }, 400);

  const values: Record<string, string> = {};
  for (const f of spec.fields) {
    const raw = body.values?.[f];
    if (raw === undefined || raw === null) continue;
    const v = String(raw).trim().slice(0, LONG_FIELDS.includes(f) ? 800 : 200);
    if (!v) continue;
    if (f === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return json({ error: "The email address is not valid." }, 400);
    if (spec.dateFields.includes(f) && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v)) return json({ error: "A date was not in the right format." }, 400);
    if (spec.moneyFields.includes(f) && !/^\d{1,7}(\.\d{1,2})?$/.test(v)) return json({ error: "An amount was not in the right format." }, 400);
    values[f] = v;
  }
  if (Object.keys(values).length === 0) return json({ error: "Please fill in at least one field." }, 400);

  const files: any[] = Array.isArray(body.files) ? body.files : [];
  if (files.length > MAX_FILES) return json({ error: `Please send up to ${MAX_FILES} receipts at a time.` }, 400);

  const newReceipts: { id: string; name: string; path: string }[] = [];
  for (const f of files) {
    if (!ALLOWED_FILES.includes(f?.type)) return json({ error: "Receipts must be PDF, JPG, PNG or WEBP files." }, 400);
    const b64 = String(f.base64 || "").includes(",") ? String(f.base64).split(",")[1] : String(f.base64 || "");
    if (!b64 || Math.floor((b64.length * 3) / 4) > MAX_FILE_BYTES) return json({ error: "A receipt is too large. Please use files under 10 MB." }, 400);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      return json({ error: "Could not read a receipt file." }, 400);
    }
    const ext = (String(f.name || "").split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "pdf";
    const id = crypto.randomUUID();
    // Same folder layout the manager's page uses: <owner id>/<show id>/receipts/<uuid>.<ext>
    // (driver license photos go in licenses/ instead)
    const path = `${project.user_id}/${parsed.projectId}/${type === "profile" ? "licenses" : "receipts"}/${id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("travel-receipts").upload(path, bytes, { contentType: f.type, upsert: false });
    if (upErr) {
      console.error("receipt upload error:", upErr);
      return json({ error: "Could not store a receipt. Please try again." }, 500);
    }
    newReceipts.push({ id, name: String(f.name || `receipt.${ext}`).slice(0, 120), path });
  }

  const { data: fresh } = await supabase.from("projects").select("project_data").eq("id", parsed.projectId).maybeSingle();
  const pd = fresh?.project_data || project.project_data || {};
  const mine = { ...(pd.travelSubmissions?.[parsed.memberId] || {}) };
  mine[type] = {
    values,
    receipts: [...(mine[type]?.receipts || []), ...newReceipts],
    submittedAt: new Date().toISOString(),
  };
  pd.travelSubmissions = { ...(pd.travelSubmissions || {}), [parsed.memberId]: mine };
  const syncedFields = type === "profile" ? fillStaffContact(pd, parsed.memberId, values.email || "", values.mobile || "") : [];
  addActivity(pd, {
    type: "details_submitted",
    at: mine[type].submittedAt,
    memberId: parsed.memberId,
    name: findMember(pd, parsed.memberId)?.name || "",
    item: spec.label,
    receipts: newReceipts.length,
    ...(syncedFields.length > 0 ? { addedToStaffCard: syncedFields } : {}),
  });

  const { error } = await supabase.from("projects").update({ project_data: pd }).eq("id", parsed.projectId);
  if (error) {
    console.error("travel-info-request submit error:", error);
    return json({ error: "Could not save your details. Please try again." }, 500);
  }
  return json({ success: true, submittedAt: mine[type].submittedAt, receipts: mine[type].receipts.map((r: any) => ({ id: r.id, name: r.name })) });
}

// ── Staff Portal (signed in, no emailed link) ─────────────────────────────────────────────────────────
// A signed-in person may answer for a show only when a contract was sent to their email
// (the judge_notifications row of type 'contract_sent'), and only for the staff card with their email.
const PORTAL_TYPES = ["flight", "hotel", "rentalCar", "mileage"];

// Which expense in the person's contract (Officials & Staff > reimbursable_expenses) each travel item belongs to.
const EXPENSE_KEY: Record<string, string> = { flight: "airfare", hotel: "hotel", rentalCar: "rentalCar", mileage: "mileage" };

// What the Staff Portal shows one person: only the items that are in THEIR contract, each marked
//   "reimbursement" (they pay, then enter the details and receipts) or
//   "direct" (the show books it; they only see what was booked).
// The Traveler Profile (legal name, ID) is offered only when at least one item is direct.
function portalPlan(expenses: any): { modes: Record<string, "reimbursement" | "direct">; wantsProfile: boolean } {
  const modes: Record<string, "reimbursement" | "direct"> = {};
  for (const t of PORTAL_TYPES) {
    const exp = expenses?.[EXPENSE_KEY[t]];
    if (!exp?.reimbursed) continue;
    modes[t] = exp.expense_type === "direct" ? "direct" : "reimbursement";
  }
  return { modes, wantsProfile: Object.values(modes).includes("direct") };
}

function findMemberByEmail(pd: any, email: string): { id: string; name: string; email: string; role: string; phone: string; expenses: any } | null {
  const want = email.trim().toLowerCase();
  if (!want) return null;
  const officials = pd?.showDetails?.officials || {};
  for (const roles of Object.values<any>(officials)) {
    for (const [roleId, members] of Object.entries<any>(roles || {})) {
      for (const m of members || []) {
        if (m?.id && String(m.email || "").trim().toLowerCase() === want) {
          return { id: m.id, name: m.name || "", email: String(m.email).trim(), role: m.custom_role_name || roleId, phone: (m.phone || "").trim(), expenses: m.reimbursable_expenses || {} };
        }
      }
    }
  }
  const rostered = (pd?.staffSchedule?.roster || []).find((e: any) => e?.id && String(e.email || "").trim().toLowerCase() === want);
  if (rostered) return { id: rostered.id, name: rostered.name || "", email: String(rostered.email).trim(), role: "Staff", phone: (rostered.phone || "").trim(), expenses: {} };
  return null;
}

async function portalContext(req: Request, body: any) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return { error: json({ error: "Please sign in and try again." }, 401) };
  const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  const email = (who?.user?.email || "").trim().toLowerCase();
  if (!email) return { error: json({ error: "Please sign in and try again." }, 401) };

  const projectId = String(body.projectId || "");
  if (!projectId) return { error: json({ error: "Missing show." }, 400) };

  const supabase = adminClient();
  const { data: project } = await supabase.from("projects").select("id, user_id, project_name, project_data").eq("id", projectId).maybeSingle();
  if (!project) return { error: json({ error: "Show not found." }, 404) };

  const { data: sent } = await supabase
    .from("judge_notifications")
    .select("id")
    .eq("project_id", projectId)
    .eq("notification_type", "contract_sent")
    .eq("judge_email", email)
    .limit(1);
  if (!sent || sent.length === 0) return { error: json({ error: "No contract has been sent to you for this show." }, 403) };

  const member = findMemberByEmail(project.project_data, email);
  if (!member) return { error: json({ error: "Your email is not on this show's staff list." }, 404) };

  return { supabase, project, member, projectId };
}

async function handlePortalGet(req: Request, body: any) {
  const ctx = await portalContext(req, body);
  if (ctx.error) return ctx.error;
  const { project, member } = ctx as any;
  const pd = project.project_data || {};
  const entry = pd.travelData?.[member.id] || {};
  const submitted = pd.travelSubmissions?.[member.id] || {};

  const { modes, wantsProfile } = portalPlan(member.expenses);
  const items: any[] = Object.keys(modes).map((t) => ({
    type: t,
    mode: modes[t],
    label: ITEMS[t].label,
    submittedAt: submitted[t]?.submittedAt || null,
    // Direct: what the show booked (read-only for the person). Reimbursement: what they sent before.
    values: modes[t] === "direct"
      ? pick(entry[t], ITEMS[t].fields.filter((f) => f !== "actualCost"))
      : { ...pick(entry[t], ITEMS[t].fields), ...(submitted[t]?.values || {}) },
    datesLocked: !!entry[t]?.datesLocked,
    receipts: (submitted[t]?.receipts || []).map((r: any) => ({ id: r.id, name: r.name })),
  }));
  if (wantsProfile) {
    items.push({
      type: "profile",
      mode: "profile",
      label: ITEMS.profile.label,
      submittedAt: submitted.profile?.submittedAt || null,
      values: {
        legalName: member.name || "",
        email: member.email || "",
        mobile: member.phone || "",
        ...pick(entry.profile, ITEMS.profile.fields),
        ...(submitted.profile?.values || {}),
      },
      datesLocked: false,
      receipts: (submitted.profile?.receipts || []).map((r: any) => ({ id: r.id, name: r.name })),
    });
  }
  return json({
    showName: project.project_name || pd.showName || "",
    memberName: member.name || "",
    role: prettyRole(member.role || ""),
    items,
  });
}

async function handlePortalSubmit(req: Request, body: any) {
  const ctx = await portalContext(req, body);
  if (ctx.error) return ctx.error;
  const { supabase, project, member, projectId } = ctx as any;
  // Only reimbursement items can be answered by the person; direct items are the show's to fill in.
  const { modes, wantsProfile } = portalPlan(member.expenses);
  const allowedTypes = Object.keys(modes).filter((t) => modes[t] === "reimbursement");
  if (wantsProfile) allowedTypes.push("profile");
  return processSubmit(body, { supabase, project, parsed: { projectId, memberId: member.id }, allowedTypes });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    if (body.action === "send") return await handleSend(req, body);
    if (body.action === "get") return await handleGet(body);
    if (body.action === "submit") return await handleSubmit(body);
    if (body.action === "portal_get") return await handlePortalGet(req, body);
    if (body.action === "portal_submit") return await handlePortalSubmit(req, body);
    return json({ error: "Unknown action." }, 400);
  } catch (e: any) {
    console.error("travel-info-request error:", e);
    return json({ error: e.message || "Something went wrong." }, 500);
  }
});
