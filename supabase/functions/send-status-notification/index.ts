import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Every field below is written by the caller and dropped into the HTML body.
// Unescaped, a name containing markup becomes markup inside an email sent from
// our own verified domain.
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface StatusNotificationRequest {
  staffEmail: string;
  staffName: string;
  staffRole: string;
  projectName: string;
  newStatus: string;
  changedBy: string;
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
    // The caller picks the recipient and every word of the message, and it goes
    // out from Info@equipatterns.com. Nothing in the app calls this function
    // today, which makes it the quietest of the open doors rather than a safe
    // one — a signed-in check costs nothing and closes it either way.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token || token === anonKey) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to send a notification." }),
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
        JSON.stringify({ error: "You must be signed in to send a notification." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { staffEmail, staffName, staffRole, projectName, newStatus, changedBy }: StatusNotificationRequest = await req.json();

    console.log("Sending status notification:", { staffEmail, staffName, staffRole, projectName, newStatus, changedBy });

    const statusDisplay = newStatus === 'draft' ? 'Draft, Build, Review' :
                          newStatus === 'approval' ? 'Approval and Locked' :
                          newStatus === 'publication' ? 'Publication' : newStatus;

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: staffEmail,
        Subject: `Pattern Book Status Updated - ${escapeHtml(projectName)}`,
        HtmlBody: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .status-badge { display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
              .footer { background: #374151; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
              .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
              .label { font-weight: bold; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Pattern Book Status Update</h1>
              </div>
              <div class="content">
                <p>Hello <strong>${escapeHtml(staffName)}</strong>,</p>

                <p>The status of a pattern book you're assigned to has been updated.</p>

                <div class="info-row">
                  <span class="label">Pattern Book:</span> ${escapeHtml(projectName)}
                </div>

                <div class="info-row">
                  <span class="label">Your Role:</span> ${escapeHtml(staffRole)}
                </div>

                <div class="info-row">
                  <span class="label">New Status:</span>
                  <span class="status-badge">${escapeHtml(statusDisplay)}</span>
                </div>

                <div class="info-row">
                  <span class="label">Changed By:</span> ${escapeHtml(changedBy)}
                </div>

                <p style="margin-top: 20px;">Please log in to EquiPatterns to review the changes and take any necessary action.</p>

                <p>Thank you,<br>The EquiPatterns Team</p>
              </div>
              <div class="footer">
                <p>This is an automated notification from EquiPatterns.</p>
                <p>&copy; ${new Date().getFullYear()} EquiPatterns. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
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
    console.log("Status notification sent successfully:", result.MessageID);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending status notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
