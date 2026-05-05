import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FieldBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  found: boolean;
};

type FieldKey = "show" | "class" | "date" | "judge";

type FieldsPayload = {
  fields: Record<FieldKey, FieldBox>;
  imageWidth: 1;
  imageHeight: 1;
  units: "normalized";
  debug?: unknown;
};

const blankField = (): FieldBox => ({ x: 0, y: 0, width: 0, height: 0, found: false });

const buildEmptyPayload = (): FieldsPayload => ({
  fields: {
    show: blankField(),
    class: blankField(),
    date: blankField(),
    judge: blankField(),
  },
  imageWidth: 1,
  imageHeight: 1,
  units: "normalized",
});

const stripCodeFences = (s: string) => {
  let out = s.trim();
  if (out.startsWith("```json")) out = out.slice(7);
  if (out.startsWith("```")) out = out.slice(3);
  if (out.endsWith("```")) out = out.slice(0, -3);
  return out.trim();
};

const normalizeToLegacyFields = (parsed: any): FieldsPayload => {
  // Newer format (optional): { lines: [{ label, box: {x,y,width,height,found}}] }
  if (parsed?.lines && Array.isArray(parsed.lines)) {
    const payload = buildEmptyPayload();

    for (const item of parsed.lines) {
      const rawLabel = String(item?.label ?? "").toLowerCase().trim();
      const box = item?.box;
      if (!box) continue;

      // Normalize synonyms into the 4 keys we support on the client
      const label =
        rawLabel === "group" || rawLabel === "class_group" ? "class" :
        rawLabel;

      if (label === "show" || label === "class" || label === "date" || label === "judge") {
        payload.fields[label] = {
          x: Number(box.x) || 0,
          y: Number(box.y) || 0,
          width: Number(box.width) || 0,
          height: Number(box.height) || 0,
          found: Boolean(box.found),
        };
      }
    }

    payload.debug = { lines: parsed.lines };
    return payload;
  }

  // Legacy format: { fields: { show: {...}, ... }, imageWidth, imageHeight, units }
  if (parsed?.fields) {
    const payload = buildEmptyPayload();
    for (const key of ["show", "class", "date", "judge"] as FieldKey[]) {
      const f = parsed.fields?.[key];
      payload.fields[key] = {
        x: Number(f?.x) || 0,
        y: Number(f?.y) || 0,
        width: Number(f?.width) || 0,
        height: Number(f?.height) || 0,
        found: Boolean(f?.found),
      };
    }
    payload.debug = parsed?.debug;
    return payload;
  }

  return buildEmptyPayload();
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing scoresheet image for field positions...", { imageUrl });

    const systemPrompt = `You analyze horse-show scoresheets and return where text should be WRITTEN.

IMPORTANT: The layout varies.
- Sometimes the blank writing area is to the RIGHT of the label (inline: \"Show: ______\").
- Sometimes the label is ABOVE a long horizontal line, and the writing area is the rectangle JUST ABOVE/AROUND that line.

Your job: for each label, find the correct writing area that belongs to THAT label.

MATCHING RULES (critical):
1) Identify the label first, then find its writing area.
2) Do NOT assign by row order alone.
3) JUDGE is NOT SIGNATURE. Never use any signature line for judge.

LABELS & SYNONYMS:
- show: \"SHOW\", \"Show\", \"SHOW NAME\"
- class: \"CLASS\", \"Group\", \"GROUP\" (some templates do NOT have class/group)
- date: \"DATE\", \"DATES\", \"DATE(S)\"
- judge: \"JUDGE\", \"JUDGES\", \"Judge's Name\", \"JUDGE'S NAME\"

OUTPUT RULES:
- Return NORMALIZED coordinates (0..1) (fractions), not pixels.
- x,y = TOP-LEFT of the writing area rectangle
- width,height = size of the writing area rectangle
- If a field does NOT exist on the image, set found=false and x=y=width=height=0.
- Return ONLY JSON, no markdown.`;

    const userPrompt = `Return this EXACT JSON structure:
{
  \"fields\": {
    \"show\": { \"x\": number, \"y\": number, \"width\": number, \"height\": number, \"found\": boolean },
    \"class\": { \"x\": number, \"y\": number, \"width\": number, \"height\": number, \"found\": boolean },
    \"date\": { \"x\": number, \"y\": number, \"width\": number, \"height\": number, \"found\": boolean },
    \"judge\": { \"x\": number, \"y\": number, \"width\": number, \"height\": number, \"found\": boolean }
  },
  \"imageWidth\": 1,
  \"imageHeight\": 1,
  \"units\": \"normalized\"
}

DEFINITIONS:
- For inline fields (e.g., \"Show: Test A2\"), the writing area is the region containing the value to the RIGHT of the colon.
- For underline fields (label above a line), the writing area is the long rectangle where text would be written (centered on / just above the line), NOT the label itself.

Double-check that SHOW, CLASS/GROUP, DATE are not shifted (each must align to its own label).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Use a stronger vision model for better label-to-field matching.
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    console.log("AI Response (raw):", content);

    let payload: FieldsPayload;
    try {
      const cleaned = stripCodeFences(content);
      const parsed = JSON.parse(cleaned);
      payload = normalizeToLegacyFields(parsed);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      payload = { ...buildEmptyPayload(), debug: { parseError: true } };
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in detect-scoresheet-fields:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
