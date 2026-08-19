import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailWithAttachmentsRequest {
  to: string[];
  subject: string;
  body: string;
  patternIds: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!POSTMARK_API_TOKEN) {
      console.error("POSTMARK_API_TOKEN not found");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── Who is asking ───────────────────────────────────────────────────────
    // This function takes the recipients, the subject AND the message body from
    // whoever calls it, then sends from Info@equipatterns.com — a verified domain
    // that passes SPF and DKIM. With no check at all it was an open mail relay:
    // anyone who guessed the URL could email anybody, in bulk, with attachments,
    // and it would arrive looking exactly like genuine EquiPatterns mail.
    //
    // Only two admin screens use it (EmailSenderModal, ReviewEmailModal), so the
    // bar is a signed-in admin. The UI was already locked down; the function was
    // the unlocked back door.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    const refuse = (message: string, status: number) =>
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    if (!token || token === anonKey) {
      return refuse("You must be signed in to send email.", 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) {
      return refuse("You must be signed in to send email.", 401);
    }

    // Admins only. Read with the service key so this does not depend on the
    // profiles read policy.
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (String(callerProfile?.role ?? "").toLowerCase() !== "admin") {
      return refuse("Only administrators can send email from this address.", 403);
    }

    const { to, subject, body, patternIds }: EmailWithAttachmentsRequest = await req.json();

    if (!to || to.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required field: to" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending email with attachments:", { to, subject, patternCount: patternIds?.length });

    // Fetch pattern files from storage
    const attachments: Array<{ Name: string; Content: string; ContentType: string }> = [];

    if (patternIds && patternIds.length > 0) {
      // Get pattern metadata from DB
      const { data: patterns, error: patternsError } = await supabaseAdmin
        .from("patterns")
        .select("id, name, file_url")
        .in("id", patternIds);

      if (patternsError) {
        console.error("Error fetching patterns:", patternsError);
      } else if (patterns) {
        for (const pattern of patterns) {
          if (!pattern.file_url) continue;

          try {
            // Extract storage path from file_url
            const urlParts = pattern.file_url.split("/storage/v1/object/public/");
            if (urlParts.length < 2) continue;

            const fullPath = urlParts[1];
            const bucketEnd = fullPath.indexOf("/");
            const bucket = fullPath.substring(0, bucketEnd);
            const filePath = fullPath.substring(bucketEnd + 1);

            const { data: fileData, error: fileError } = await supabaseAdmin
              .storage
              .from(bucket)
              .download(filePath);

            if (fileError || !fileData) {
              console.error(`Failed to download pattern ${pattern.name}:`, fileError);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            attachments.push({
              Name: `${pattern.name}.pdf`,
              Content: base64,
              ContentType: "application/pdf",
            });
          } catch (downloadErr) {
            console.error(`Error processing attachment for ${pattern.name}:`, downloadErr);
          }
        }
      }
    }

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${body.replace(/\n/g, "<br>")}
  <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 32px 0;">
  <p style="color: #8898aa; font-size: 12px; text-align: center;">
    Sent via <a href="https://equipatterns.com" style="color: #2563eb;">EquiPatterns</a>
  </p>
</body>
</html>`;

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: to.join(", "),
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: body,
        MessageStream: "outbound",
        ...(attachments.length > 0 ? { Attachments: attachments } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Postmark error:", errorText);
      return new Response(
        JSON.stringify({ error: `Email delivery failed: ${response.status}` }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await response.json();
    console.log("Email with attachments sent successfully:", result.MessageID);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email with attachments:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
