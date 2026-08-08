import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Decode a base64url `${projectId}:${email}:${secret}` token.
 * See supabase/functions/_token for why the secret exists.
 */
function parseToken(token: string): { projectId: string; email: string; secret: string } | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const first = raw.indexOf(":");
    if (first === -1) return null;
    const rest = raw.slice(first + 1);
    const second = rest.lastIndexOf(":");
    if (second === -1) return null;
    const secret = rest.slice(second + 1);
    if (!secret) return null;
    return { projectId: raw.slice(0, first), email: rest.slice(0, second).toLowerCase(), secret };
  } catch {
    return null;
  }
}

/** Constant-time compare, so a wrong secret cannot be found one character at a time. */
function secretMatches(a: unknown, b: unknown): boolean {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (!x || !y || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
// A pattern is one page or one photo. Anything larger is a mistake or an abuse,
// and the whole file is held in memory here as base64 while it is decoded.
const MAX_FILE_BYTES = 15 * 1024 * 1024;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, disciplineId, groupId, fileBase64, fileName, fileType } = await req.json();
    const parsed = token ? parseToken(token) : null;
    if (!parsed) return json({ error: "This link is invalid or has expired." }, 400);
    if (!groupId || !fileBase64 || !fileName) return json({ error: "Missing upload data." }, 400);
    if (fileType && !ALLOWED.includes(fileType)) {
      return json({ error: "Only PDF, JPG, and PNG files are accepted." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: project, error } = await supabase
      .from("projects")
      .select("project_data, status")
      .eq("id", parsed.projectId)
      .maybeSingle();

    if (error || !project) return json({ error: "This link is invalid or has expired." }, 404);
    if (project.status === "Final") {
      return json({ error: "This pattern book has been published; uploads are closed." }, 403);
    }

    const pd = project.project_data || {};
    const ps = pd.patternSelections || {};

    // Resolve the target group. disciplineId is preferred; fall back to scanning.
    let targetDisciplineId = disciplineId;
    let sel = targetDisciplineId ? ps[targetDisciplineId]?.[groupId] : null;
    if (!sel) {
      for (const [dId, groups] of Object.entries<any>(ps)) {
        if (groups?.[groupId]) { targetDisciplineId = dId; sel = groups[groupId]; break; }
      }
    }

    // Accept both custom-pattern requests AND judge-assigned groups (a judge can
    // upload their own pattern when there's nothing to pick from the library).
    const isCustom = sel?.type === "customRequest";
    const isJudge = sel?.type === "judgeAssigned";
    if (!sel || (!isCustom && !isJudge)) {
      return json({ error: "This upload slot was not found." }, 404);
    }
    // Only the person the request was sent to may upload.
    const rawOwner = isJudge ? sel.judgeEmail : sel.requestedFromEmail;
    if ((rawOwner || "").trim().toLowerCase() !== parsed.email) {
      return json({ error: "You are not authorized to upload for this request." }, 403);
    }
    // …and only through the link we issued for this request.
    if (!secretMatches(sel.requestSecret, parsed.secret)) {
      return json({ error: "This link is no longer valid. Please ask the show office to resend it." }, 403);
    }

    // Decode the base64 payload (strip a data: URL prefix if present).
    const b64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
    // base64 carries 3 bytes per 4 characters — check before decoding, not after.
    if (Math.floor((b64.length * 3) / 4) > MAX_FILE_BYTES) {
      return json({ error: "That file is too large. Please upload a file under 15 MB." }, 400);
    }
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      return json({ error: "Could not read the uploaded file." }, 400);
    }

    const ext = (fileName.split(".").pop() || "pdf").toLowerCase();
    const filePath = `${parsed.projectId}/custom-patterns/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("project_files")
      .upload(filePath, bytes, { contentType: fileType || "application/octet-stream", upsert: false });
    if (upErr) {
      console.error("storage upload error:", upErr);
      return json({ error: "Could not store the file. Please try again." }, 500);
    }

    const { data: pub } = supabase.storage.from("project_files").getPublicUrl(filePath);
    const publicUrl = pub?.publicUrl || "";

    // Write the file onto the selection — same fields the builder uses. For a
    // judge upload, clear any previously-picked library pattern (their upload is
    // now the chosen pattern) and mark 'responded'; custom uploads use 'uploaded'.
    ps[targetDisciplineId][groupId] = {
      ...sel,
      uploadedFileUrl: publicUrl,
      uploadedFilePath: filePath,
      uploadedFileName: fileName,
      uploadedFileType: fileType || "",
      requestStatus: isJudge ? "responded" : "uploaded",
      respondedAt: new Date().toISOString(),
      ...(isJudge ? { patternId: null, patternName: null } : {}),
    };
    pd.patternSelections = ps;

    const { error: updateError } = await supabase
      .from("projects")
      .update({ project_data: pd })
      .eq("id", parsed.projectId);

    if (updateError) {
      console.error("submit-pattern-upload update error:", updateError);
      return json({ error: "Could not save your upload. Please try again." }, 500);
    }

    return json({ success: true, uploadedFileName: fileName, uploadedFileUrl: publicUrl });
  } catch (e: any) {
    console.error("submit-pattern-upload error:", e);
    return json({ error: e.message || "Something went wrong." }, 500);
  }
});
