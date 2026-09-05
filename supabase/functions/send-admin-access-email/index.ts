import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;
const SITE_URL = "https://equipatterns.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Every field below is written by the caller (the show owner, via Manage
// Access) and dropped into the HTML body. Unescaped, a show name or invited
// name containing markup becomes markup inside an email sent from our own
// verified domain.
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface AdminAccessEmailRequest {
  recipientEmail: string;
  recipientName?: string | null;
  role: "full_admin" | "section_admin";
  sectionTitles?: string[];
  showId: string;
  showName: string;
  grantedByName?: string;
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
    // Only a signed-in show owner uses Manage Access, so require a real
    // session token here too rather than trusting the anon key.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token || token === anonKey) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to send this notification." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to send this notification." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { recipientEmail, recipientName, role, sectionTitles, showId, showName, grantedByName }: AdminAccessEmailRequest = await req.json();

    if (!recipientEmail || !showId || !showName) {
      return new Response(
        JSON.stringify({ error: "Missing required field: recipientEmail, showId, or showName" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── Does this email already have an account? ────────────────────────────
    // There is no publicly queryable users table, so this has to paginate the
    // admin API the same way send-welcome-email does — an early version of
    // another function only checked the first page and missed accounts
    // further down the list.
    const target = String(recipientEmail).trim().toLowerCase();
    let hasAccount = false;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      if (data.users.some((u) => (u.email ?? "").toLowerCase() === target)) { hasAccount = true; break; }
      if (data.users.length < 200) break;
    }

    const roleLabel = role === "section_admin"
      ? `Section Admin — ${(sectionTitles && sectionTitles.length > 0) ? sectionTitles.join(", ") : "no sections selected yet"}`
      : "Full Admin";

    const ctaUrl = hasAccount
      ? `${SITE_URL}/horse-show-manager/show/${showId}`
      : `${SITE_URL}/membership?invite_email=${encodeURIComponent(recipientEmail)}&show=${encodeURIComponent(showId)}&showName=${encodeURIComponent(showName)}`;
    const ctaLabel = hasAccount ? "Open Horse Show Manager" : "Create Your Free Account";

    const subject = hasAccount
      ? `You've been added as a show manager for ${showName}`
      : `You've been invited to help manage ${showName} on EquiPatterns`;

    const introLine = hasAccount
      ? `${escapeHtml(grantedByName || "The show owner")} has given you access to help manage <strong>${escapeHtml(showName)}</strong> on EquiPatterns.`
      : `${escapeHtml(grantedByName || "The show owner")} wants your help managing <strong>${escapeHtml(showName)}</strong> on EquiPatterns. Create a free account to get access — no paid plan needed for show-manager access.`;

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: recipientEmail,
        Subject: subject,
        HtmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eef2f7; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; max-width: 600px; overflow: hidden; box-shadow: 0 1px 3px rgba(16,24,40,0.08);">

          <tr>
            <td bgcolor="#2563eb" style="background-color: #2563eb; background-image: linear-gradient(135deg, #1d4ed8, #3b82f6); padding: 36px 30px; text-align: center;">
              <p style="margin: 0 0 6px; color: #bfdbfe; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">EquiPatterns</p>
              <h1 style="margin: 0; font-size: 26px; line-height: 34px; font-weight: 700; color: #ffffff;">
                ${recipientName ? `Hi ${escapeHtml(recipientName)},` : "You've been added as a show manager"}
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 30px 8px;">
              <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 16px;">
                ${introLine}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 6px; margin: 0 0 16px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 2px; color: #1e3a8a; font-size: 15px; font-weight: 700;">Your access level</p>
                    <p style="margin: 0; color: #475569; font-size: 14px; line-height: 21px;">${escapeHtml(roleLabel)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 8px 30px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td bgcolor="#2563eb" style="border-radius: 8px;">
                    <a href="${ctaUrl}"
                       style="display: inline-block; padding: 15px 34px; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 30px 30px;">
              <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 0 0 20px;">
              <p style="color: #374151; font-size: 14px; line-height: 22px; margin: 0;">
                Any questions, just reply to this email — a real person reads it.
              </p>
            </td>
          </tr>

          <tr>
            <td bgcolor="#111827" style="background-color: #111827; color: #9ca3af; padding: 22px 30px; text-align: center; font-size: 12px; line-height: 20px;">
              <p style="margin: 0 0 6px;">
                <a href="${SITE_URL}" style="color: #93c5fd; text-decoration: none; font-weight: 600;">EquiPatterns.com</a>
              </p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} EquiPatterns. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        MessageStream: "outbound",
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
    console.log("Admin access email sent:", result.MessageID, "hasAccount:", hasAccount);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID, hasAccount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending admin access email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
