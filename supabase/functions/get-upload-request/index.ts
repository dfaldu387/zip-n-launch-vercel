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

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return "";
  const toLocal = (s: string) => {
    const [y, m, d] = String(s).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  const start = toLocal(startDate);
  if (!start) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const end = endDate ? toLocal(endDate) : null;
  if (!end || end.getTime() === start.getTime()) return `${startStr}, ${start.getFullYear()}`;
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

/**
 * The show classes that make up a pattern group, formatted the same way the
 * builder shows them (custom- prefix stripped, Go 1/Go 2 suffix). Lets the
 * uploader see exactly which classes a group covers.
 */
function groupClassNames(group: any): string[] {
  return ((group?.divisions || []) as any[])
    .map((d) => {
      let name = String(d?.customTitle || d?.division || "").trim();
      if (name.startsWith("custom-")) name = name.slice(7);
      if (d?.goNumber === 2) name += " (Go 2)";
      else if (d?.goNumber === 1 && d?.hasGo2) name += " (Go 1)";
      return name;
    })
    .filter(Boolean);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    const parsed = token ? parseToken(token) : null;
    if (!parsed) return json({ error: "This link is invalid or has expired." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: project, error } = await supabase
      .from("projects")
      .select("project_name, project_data, status")
      .eq("id", parsed.projectId)
      .maybeSingle();

    if (error || !project) return json({ error: "This link is invalid or has expired." }, 404);

    const pd = project.project_data || {};
    const disciplines: any[] = pd.disciplines || [];
    const selections = pd.patternSelections || {};
    const isPublished = project.status === "Final";

    const groups: any[] = [];
    let recipientName = "";
    let refused = 0;

    for (const discipline of disciplines) {
      const groupSels = selections[discipline.id] || {};
      for (const [groupId, sel] of Object.entries<any>(groupSels)) {
        if (sel?.type !== "customRequest" || !sel.customPatternRequested) continue;
        if ((sel.requestedFromEmail || "").trim().toLowerCase() !== parsed.email) continue;
        // Only through the link we issued for this request.
        if (!secretMatches(sel.requestSecret, parsed.secret)) { refused += 1; continue; }

        if (!recipientName && sel.requestedFromName) recipientName = sel.requestedFromName;
        const group = (discipline.patternGroups || []).find((g: any) => g.id === groupId);
        groups.push({
          disciplineId: discipline.id,
          disciplineName: (discipline.name || discipline.id || "Discipline").replace(" at Halter", ""),
          groupId,
          groupName: group?.name || `Group ${groupId}`,
          classes: groupClassNames(group),
          requestStatus: sel.requestStatus || null,
          uploadedFileName: sel.uploadedFileName || null,
          uploadedFileUrl: sel.uploadedFileUrl || null,
          notes: sel.requestNotes || "",
        });
      }
    }

    if (groups.length === 0) {
      // Separated so a superseded link reads as expired rather than "not found".
      if (refused > 0) {
        return json({ error: "This link is no longer valid. Please ask the show office to resend it." }, 403);
      }
      return json({ error: "No pattern requests were found for this link." }, 404);
    }

    // Single disciplineName when every group is the same discipline (back-compat
    // with the original per-discipline page header).
    const uniqueDisc = [...new Set(groups.map((g) => g.disciplineName))];

    return json({
      showName: pd.showName || project.project_name || "Untitled Show",
      showDates: formatDateRange(pd.startDate, pd.endDate),
      recipientName: recipientName || "there",
      disciplineName: uniqueDisc.length === 1 ? uniqueDisc[0] : `${uniqueDisc.length} disciplines`,
      status: project.status || "Draft",
      isPublished,
      groups,
    });
  } catch (e: any) {
    console.error("get-upload-request error:", e);
    return json({ error: e.message || "Something went wrong." }, 500);
  }
});
