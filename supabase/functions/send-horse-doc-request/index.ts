// send-horse-doc-request — emails exhibitors their private link to upload horse health
// papers (Health Certificate / CVI and Coggins). Staff only.
//
// Deploy by pasting this ONE file into the Supabase dashboard (Edge Functions ->
// Create function -> name: send-horse-doc-request). No imports from _shared.
//
// Body: { projectId, bookingIds: string[], origin }
//
// * The caller must be signed in AND able to manage the show (can_manage_show), the
//   same rule as send-booking-confirmed-email.
// * Recipients, names and the link secret all come from the SAVED booking, never from
//   the request, so this cannot be used to send mail to arbitrary people.
// * It does not write to the show. The app creates each booking's link secret
//   (project_data.horseDocSecrets) before calling; a booking without one is skipped
//   rather than risk overwriting a save made at the same moment.
// * A booking whose horses all have both papers is skipped, and so is a cancelled one
//   or one with no email.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BOOKINGS = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Same token as src/lib/horseDocLink.js: base64url of `${showId}:${bookingId}:${secret}`.
const makeToken = (showId: string, bookingId: string, secret: string) =>
  btoa(`${showId}:${bookingId}:${secret}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// The horses on a booking, same rule as src/lib/horseDocs.js getHorseSlots.
const horseNamesOf = (b: any): string[] => {
  if (Array.isArray(b?.horseNames)) return b.horseNames.filter((n: unknown) => typeof n === "string" && n.trim() !== "");
  if (typeof b?.horseNames === "string") return b.horseNames.split(",").map((s: string) => s.trim()).filter(Boolean);
  if (b?.horseName) return [String(b.horseName)];
  return [];
};

const hasDoc = (d: any) => !!(d && typeof d === "object" && (d.path || d.file));

const slotsOf = (b: any) => {
  const names = horseNamesOf(b);
  const docs = Array.isArray(b?.horseDocs) ? b.horseDocs : [];
  const count = Math.max(typeof b?.horseCount === "number" ? b.horseCount : 0, names.length, docs.length);
  return Array.from({ length: count }, (_, i) => ({
    name: names[i] || docs[i]?.name || `Horse ${i + 1}`,
    certificate: hasDoc(docs[i]?.certificate),
    coggins: hasDoc(docs[i]?.coggins),
  }));
};

const emailHtml = (opts: { name: string; showName: string; link: string; lines: string[] }) => `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#333;">
    <div style="max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#2563eb;color:white;padding:28px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Horse Health Papers Needed</h1>
      </div>
      <div style="background:#ffffff;padding:28px;border:1px solid #e5e7eb;">
        <p>Hi <strong>${escapeHtml(opts.name)}</strong>,</p>
        <p>To keep check-in quick at <strong>${escapeHtml(opts.showName)}</strong>, please upload a
          <strong>Health Certificate (CVI)</strong> and a <strong>Coggins test</strong> for each horse you are bringing.</p>
        <div style="background:#f9fafb;border-radius:6px;padding:14px;margin:18px 0;font-size:14px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:bold;margin-bottom:6px;">Still needed</div>
          ${opts.lines.map((l) => `<div style="padding:2px 0;">${escapeHtml(l)}</div>`).join("")}
        </div>
        <p style="text-align:center;margin:26px 0;">
          <a href="${escapeHtml(opts.link)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:bold;display:inline-block;">Upload Health Papers</a>
        </p>
        <p style="font-size:13px;color:#6b7280;">You can type each horse's name and upload a PDF or a clear photo from your phone. No account is needed. This link is private to your booking.</p>
      </div>
      <div style="background:#374151;color:#9ca3af;padding:18px;text-align:center;border-radius:0 0 8px 8px;font-size:12px;">
        <p style="margin:0;">This is an automated message from EquiPatterns.</p>
        <p style="margin:6px 0 0;">&copy; ${new Date().getFullYear()} EquiPatterns. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!POSTMARK_API_TOKEN) return json({ error: "Email service not configured" }, 500);

    const { projectId, bookingIds, origin } = await req.json();
    if (!projectId || !Array.isArray(bookingIds) || bookingIds.length === 0 || !origin) {
      return json({ error: "Missing request data." }, 400);
    }
    if (bookingIds.length > MAX_BOOKINGS) return json({ error: "Too many bookings at once." }, 400);
    if (!/^https?:\/\/[^\s/]+$/.test(String(origin))) return json({ error: "Invalid site address." }, 400);

    // ── Who is asking: signed in AND able to manage this show ─────────────────
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || token === anonKey) return json({ error: "You must be signed in to do that." }, 401);

    const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await asCaller.auth.getUser();
    if (!userData?.user) return json({ error: "You must be signed in to do that." }, 401);

    const { data: allowed, error: allowedError } = await asCaller.rpc("can_manage_show", { p_project_id: projectId });
    if (allowedError || allowed !== true) return json({ error: "You do not have access to this show." }, 403);

    // ── The saved show ─────────────────────────────────────────────────────────
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, project_name, project_data")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json({ error: "Show not found." }, 404);

    const bookings: any[] = project.project_data?.stallingService?.bookings || [];
    const secrets = project.project_data?.horseDocSecrets || {};

    const sent: { bookingId: string; to: string }[] = [];
    const skipped: { bookingId: string; reason: string }[] = [];

    for (const bookingId of bookingIds.map(String)) {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) { skipped.push({ bookingId, reason: "not_found" }); continue; }
      if (booking.status === "cancelled") { skipped.push({ bookingId, reason: "cancelled" }); continue; }

      const to = String(booking.email || "").trim();
      if (!to) { skipped.push({ bookingId, reason: "no_email" }); continue; }

      const slots = slotsOf(booking);
      if (slots.length === 0) { skipped.push({ bookingId, reason: "no_horses" }); continue; }

      const missing: string[] = [];
      for (const s of slots) {
        const parts = [!s.certificate ? "Health Certificate" : "", !s.coggins ? "Coggins" : ""].filter(Boolean);
        if (parts.length) missing.push(`${s.name}: ${parts.join(" and ")}`);
      }
      if (missing.length === 0) { skipped.push({ bookingId, reason: "complete" }); continue; }

      const secret = String(secrets[bookingId] || "");
      if (!secret) { skipped.push({ bookingId, reason: "no_link" }); continue; }

      const link = `${origin}/horse-docs/${makeToken(project.id, bookingId, secret)}`;
      const trainer = String(booking.trainerEmail || "").trim();

      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
        },
        body: JSON.stringify({
          From: "EquiPatterns <Info@equipatterns.com>",
          To: to,
          ...(trainer && trainer.toLowerCase() !== to.toLowerCase() ? { Cc: trainer } : {}),
          Subject: `Horse health papers needed - ${project.project_name || "your show"}`,
          HtmlBody: emailHtml({
            name: booking.exhibitorName || "there",
            showName: project.project_name || "the show",
            link,
            lines: missing,
          }),
          MessageStream: "outbound",
        }),
      });

      if (!response.ok) {
        console.error("Postmark error:", bookingId, await response.text());
        skipped.push({ bookingId, reason: "send_failed" });
        continue;
      }
      sent.push({ bookingId, to });
    }

    return json({ success: true, sent, skipped });
  } catch (error: any) {
    console.error("send-horse-doc-request error:", error);
    return json({ error: error.message }, 500);
  }
};

serve(handler);
