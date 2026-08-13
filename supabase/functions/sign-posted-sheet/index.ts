import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Hand out a short-lived link to a completed score sheet.
//
// Posted sheets used to be written to a PUBLIC bucket, so every one of them had
// a permanent web address that opened for anybody who had it — no account, no
// publish check. The page hid the button; the file did not care. New sheets go
// to a private bucket instead, and this is the only way to reach one.
//
// It has to be a function rather than the browser calling createSignedUrl: a
// rider scanning a QR code has no account, so they have no permission to sign
// anything. The service key here does the signing, but only after the same
// publish rule the pages use has been checked — so "no account" still means
// "yes, if the show is published", which is exactly what Robert asked for.

const LINK_TTL_SECONDS = 60 * 60; // an hour: long enough to read, short enough that a forwarded link dies
const BUCKET = "posted-scoresheets";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let qrId: string | null = null;
  try {
    const body = await req.json();
    qrId = body?.qrId ?? null;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!qrId) return json({ error: "Missing qrId." }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: record, error: recordError } = await admin
    .from("score_sheet_qr_codes")
    .select("id, project_id, posted_sheet_url, posted_sheet_path")
    .eq("id", qrId)
    .maybeSingle();

  if (recordError) return json({ error: recordError.message }, 500);
  if (!record) return json({ error: "Score sheet not found." }, 404);

  // Sheets posted before the private bucket still carry their original address.
  // Nothing was moved, so those keep working untouched.
  if (record.posted_sheet_url) return json({ url: record.posted_sheet_url });

  if (!record.posted_sheet_path) return json({ error: "No completed sheet has been posted." }, 404);

  // ── The same rule the pages apply, applied again here ────────────────────
  // Whoever is asking may be signed in (show staff checking their own work) or
  // nobody at all (a rider at the arena). Staff always pass; everyone else only
  // once the office has published the show.
  let isSignedIn = false;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data: userData } = await admin.auth.getUser(token);
    isSignedIn = !!userData?.user;
  }

  if (!isSignedIn) {
    const { data: project } = await admin
      .from("projects")
      .select("status, project_data")
      .eq("id", record.project_id)
      .maybeSingle();

    const status = String(project?.status ?? "").toLowerCase();
    const published =
      ["published", "final", "publication"].includes(status) ||
      project?.project_data?.moduleStatuses?.results === "published";

    if (!published) {
      return json({ error: "Results are not published yet." }, 403);
    }
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(record.posted_sheet_path, LINK_TTL_SECONDS);

  if (signError) return json({ error: signError.message }, 500);

  return json({ url: signed?.signedUrl ?? null });
});
