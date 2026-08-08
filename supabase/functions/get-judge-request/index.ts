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
 * judge/uploader see exactly which classes a group covers.
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

/** Mirrors the builder/PDF pattern-number parsing. */
function extractPatternNumber(fileName?: string): number | null {
  if (!fileName) return null;
  const n = fileName.replace(/\.(pdf|PDF)$/, "");
  const m = n.match(/(\d+)(?:\.|$)/);
  if (m) return parseInt(m[1], 10) || null;
  const f = n.match(/(\d+)$/);
  return f ? (parseInt(f[1], 10) || null) : null;
}

/**
 * The association id(s) a discipline belongs to, derived the same way the
 * builder's pattern dropdown does: prefer the assoc ids on the grouped
 * divisions, then fall back to the discipline's own selected/association ids,
 * then the project-level associations.
 */
function disciplineAssocIds(discipline: any, pd: any): string[] {
  const ids = new Set<string>();
  for (const g of (discipline?.patternGroups || [])) {
    for (const d of (g?.divisions || [])) {
      if (d?.assocId) ids.add(d.assocId);
    }
  }
  if (ids.size === 0) {
    const selIds = Object.keys(discipline?.selectedAssociations || {})
      .filter((id) => discipline.selectedAssociations[id]);
    if (selIds.length) selIds.forEach((id) => ids.add(id));
    else if (discipline?.association_id) ids.add(discipline.association_id);
    else Object.keys(pd?.associations || {}).forEach((id) => { if (pd.associations[id]) ids.add(id); });
  }
  return Array.from(ids);
}

/** Mirrors the builder's association-name matching for the pattern dropdown. */
function patternMatchesAssoc(patternAssocName: string | null, associationNames: string[]): boolean {
  const patternAssocLower = String(patternAssocName || "").trim().toLowerCase();
  if (!patternAssocLower) return false;
  return associationNames.some((assocName) => {
    const assocNameLower = String(assocName || "").trim().toLowerCase();
    if (!assocNameLower) return false;
    if (patternAssocLower === assocNameLower) return true;
    if (patternAssocLower.startsWith(assocNameLower + " ") || patternAssocLower.startsWith(assocNameLower + "-")) return true;
    const patternFirstPart = patternAssocLower.split(/[\s-]+/)[0];
    if (patternFirstPart === assocNameLower) return true;
    if (assocNameLower.length > 3 && patternAssocLower.includes(assocNameLower)) return true;
    return false;
  });
}

/**
 * Candidate patterns a judge can pick for a discipline — same sources AND the
 * same association filter the builder dropdown uses (legacy tbl_patterns +
 * approved OP/CAPO uploads), each with a preview image. Service role, so it
 * works for anonymous judges.
 * Returns [{ id, label, patternName, patternNumber, imageUrl }].
 */
async function fetchPatternOptions(supabase: any, discipline: any, associationsData: any[], pd: any) {
  if (!discipline?.name) return [];
  const isOpenShow =
    discipline?.selectedAssociations?.["open-show"] ||
    discipline?.association_id === "open-show";

  const raw: any[] = [];

  let q = supabase.from("tbl_patterns").select("id, pdf_file_name, maneuvers_range, pattern_version, association_name");
  if (!isOpenShow) q = q.ilike("discipline", discipline.name);
  const { data, error } = await q;
  if (!error && Array.isArray(data)) {
    for (const p of data) raw.push({ id: p.id, pdf_file_name: p.pdf_file_name, maneuvers_range: p.maneuvers_range, pattern_version: p.pattern_version || null, association_name: p.association_name || null, patternNumber: null, imageUrl: null });
  }

  const legacyIds = raw.filter((r) => typeof r.id === "number").map((r) => r.id);
  if (legacyIds.length) {
    const { data: media } = await supabase.from("tbl_pattern_media").select("pattern_id, image_url").in("pattern_id", legacyIds);
    const imgMap = new Map<number, string>();
    (media || []).forEach((m: any) => { if (!imgMap.has(m.pattern_id)) imgMap.set(m.pattern_id, m.image_url); });
    raw.forEach((r) => { if (imgMap.has(r.id)) r.imageUrl = imgMap.get(r.id); });
  }

  try {
    let opq = supabase
      .from("patterns")
      .select("id, name, original_file_name, class_name, pattern_number, preview_image_url, tags, review_status, use_as_original, publication_status")
      .eq("use_as_original", true)
      .eq("review_status", "approved")
      .or("publication_status.eq.published,publication_status.is.null")
      .overlaps("tags", ["OP", "CAPO"]);
    if (!isOpenShow) opq = opq.ilike("class_name", discipline.name);
    const { data: opData } = await opq;
    if (Array.isArray(opData)) {
      for (const p of opData) {
        raw.push({ id: `op:${p.id}`, pdf_file_name: p.original_file_name || p.name || "Original Pattern", maneuvers_range: null, pattern_version: null, association_name: null, patternNumber: p.pattern_number || null, imageUrl: p.preview_image_url || null });
      }
    }
  } catch (_e) { /* OP fetch is non-fatal */ }

  // Keep only patterns whose association matches this discipline's association(s)
  // — same as the builder dropdown, so a judge picking for AQHA Western Riding
  // sees only AQHA Western Riding patterns (not APHA/NSBA or other disciplines).
  let finalList = raw;
  if (!isOpenShow) {
    const associationNames: string[] = [];
    for (const id of disciplineAssocIds(discipline, pd)) {
      const a = (associationsData || []).find((x: any) => x.id === id);
      if (a?.name) associationNames.push(a.name);
      if (a?.abbreviation) associationNames.push(a.abbreviation);
    }
    if (associationNames.length > 0) {
      finalList = raw.filter((p) => patternMatchesAssoc(p.association_name, associationNames));
    }
  }

  return finalList.map((p) => {
    const num = p.patternNumber ?? extractPatternNumber(p.pdf_file_name);
    const base = num !== null ? `Pattern ${num}` : (p.pdf_file_name || "Pattern");
    // Match the builder dropdown: distinguish variants with the version tag
    // (e.g. "L1"), so two patterns with the same number aren't shown identically.
    const version = p.pattern_version && p.pattern_version !== "ALL" ? p.pattern_version : null;
    const label = version ? `${base} · ${version}` : base;
    return { id: p.id, label, patternName: p.pdf_file_name || base, patternNumber: num, imageUrl: p.imageUrl || null };
  });
}

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

    const items: any[] = [];
    let recipientName = "";
    let refused = 0;

    for (const discipline of disciplines) {
      const groups = selections[discipline.id] || {};
      for (const [groupId, sel] of Object.entries<any>(groups)) {
        if (sel?.type !== "judgeAssigned") continue;
        if ((sel.judgeEmail || "").trim().toLowerCase() !== parsed.email) continue;
        // Only through the link we issued for this request.
        if (!secretMatches(sel.requestSecret, parsed.secret)) { refused += 1; continue; }

        if (!recipientName && sel.judgeName) recipientName = sel.judgeName;
        const group = (discipline.patternGroups || []).find((g: any) => g.id === groupId);
        items.push({
          disciplineId: discipline.id,
          disciplineName: (discipline.name || discipline.id || "Discipline").replace(" at Halter", ""),
          groupId,
          groupName: group?.name || `Group ${groupId}`,
          classes: groupClassNames(group),
          currentPatternId: sel.patternId || null,
          currentPatternName: sel.patternName || null,
          uploadedFileName: sel.uploadedFileName || null,
          uploadedFileUrl: sel.uploadedFileUrl || null,
          requestStatus: sel.requestStatus || null,
        });
      }
    }

    if (items.length === 0) {
      // Separated so a superseded link reads as expired rather than "not found".
      if (refused > 0) {
        return json({ error: "This link is no longer valid. Please ask the show office to resend it." }, 403);
      }
      return json({ error: "No pattern requests were found for this link." }, 404);
    }

    // Association lookup (id → name/abbreviation) for the dropdown's assoc filter.
    const { data: associationsData } = await supabase
      .from("associations")
      .select("id, name, abbreviation");

    const neededDisciplineIds = [...new Set(items.map((i) => i.disciplineId))];
    const patternsByDiscipline: Record<string, any[]> = {};
    for (const did of neededDisciplineIds) {
      const disc = disciplines.find((d) => d.id === did);
      patternsByDiscipline[did] = await fetchPatternOptions(supabase, disc, associationsData || [], pd);
    }

    return json({
      showName: pd.showName || project.project_name || "Untitled Show",
      showDates: formatDateRange(pd.startDate, pd.endDate),
      recipientName: recipientName || "Judge",
      status: project.status || "Draft",
      isPublished,
      items,
      patternsByDiscipline,
    });
  } catch (e: any) {
    console.error("get-judge-request error:", e);
    return json({ error: e.message || "Something went wrong." }, 500);
  }
});
