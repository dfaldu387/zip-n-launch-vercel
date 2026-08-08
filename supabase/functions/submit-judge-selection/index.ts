import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Decode a base64url `${projectId}:${email}:${secret}` token.
 *
 * The token used to be `${projectId}:${email}` with no secret. Base64 is
 * encoding, not encryption — anyone holding one link could read the show id out
 * of it, write a token for a different email, and overwrite that judge's pattern
 * choices. The secret is generated when the request email is sent and stored on
 * the selection, and every function checks it. See supabase/functions/_token.
 *
 * The email is split on the LAST colon so an address containing one still works.
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

interface Selection {
  disciplineId: string;
  groupId: string;
  patternId: string | number;
  patternName?: string;
  patternNumber?: number | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, selections } = await req.json();
    const parsed = token ? parseToken(token) : null;
    if (!parsed) return json({ error: "This link is invalid or has expired." }, 400);
    if (!Array.isArray(selections) || selections.length === 0) {
      return json({ error: "No selections were provided." }, 400);
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
      return json({ error: "This pattern book has been published; selections are closed." }, 403);
    }

    const pd = project.project_data || {};
    const ps = pd.patternSelections || {};
    const now = new Date().toISOString();
    let applied = 0;
    let refused = 0;

    for (const s of selections as Selection[]) {
      const group = ps[s.disciplineId]?.[s.groupId];
      // Only let the judge modify groups that were actually assigned to THEM.
      if (!group || group.type !== "judgeAssigned") continue;
      if ((group.judgeEmail || "").trim().toLowerCase() !== parsed.email) continue;
      // …and only through the link we issued for this request.
      if (!secretMatches(group.requestSecret, parsed.secret)) { refused += 1; continue; }

      group.patternId = s.patternId;
      group.patternName = s.patternName || group.patternName || "";
      if (s.patternNumber != null) group.patternNumber = s.patternNumber;
      group.requestStatus = "responded";
      group.respondedAt = now;
      applied += 1;
    }

    if (applied === 0) {
      // Separated so a stale link reads as expired rather than "nothing matched".
      if (refused > 0) {
        return json({ error: "This link is no longer valid. Please ask the show office to resend it." }, 403);
      }
      return json({ error: "None of the selections matched your requests." }, 400);
    }

    pd.patternSelections = ps;

    const { error: updateError } = await supabase
      .from("projects")
      .update({ project_data: pd })
      .eq("id", parsed.projectId);

    if (updateError) {
      console.error("submit-judge-selection update error:", updateError);
      return json({ error: "Could not save your selections. Please try again." }, 500);
    }

    return json({ success: true, applied });
  } catch (e: any) {
    console.error("submit-judge-selection error:", e);
    return json({ error: e.message || "Something went wrong." }, 500);
  }
});
