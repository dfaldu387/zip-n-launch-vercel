import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomPatternRequest {
  recipientEmail: string;
  recipientName: string;
  showName: string;
  discipline: string;
  groupName: string;
  notes: string;
  uploadLink: string;
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

    const { recipientEmail, recipientName, showName, discipline, groupName, notes, uploadLink }: CustomPatternRequest = await req.json();

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required field: recipientEmail" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending custom pattern request:", { recipientEmail, recipientName, showName, discipline, groupName });

    const notesHtml = notes
      ? `<div style="margin: 16px 0; padding: 16px; background: white; border-left: 4px solid #3b82f6; border-radius: 4px;">
           <p style="font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Notes from Show Manager</p>
           <p style="color: #333; margin: 0; white-space: pre-wrap;">${notes.replace(/\n/g, "<br>")}</p>
         </div>`
      : "";

    const uploadHtml = uploadLink
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
           <tr><td align="center">
             <a href="${uploadLink}" style="background-color: #2563eb; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 600; padding: 14px 32px; text-decoration: none;">Upload Your Pattern</a>
           </td></tr>
         </table>`
      : "";

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
        Subject: `Custom Pattern Request — ${showName} (${discipline})`,
        HtmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f9fc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Custom Pattern Request</h1>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${showName}</p>
            </td>
          </tr>
          <tr>
            <td style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">Hello ${recipientName},</p>
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">A custom pattern has been requested for the show <strong>${showName}</strong>. Please see the details below:</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;">
                <tr>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: #f9fafb; border-radius: 4px; padding: 12px;">
                      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Discipline</div>
                      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px;">${discipline}</div>
                    </div>
                  </td>
                  <td width="50%" style="padding: 6px;">
                    <div style="background: #f9fafb; border-radius: 4px; padding: 12px;">
                      <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Pattern Group</div>
                      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-top: 4px;">${groupName}</div>
                    </div>
                  </td>
                </tr>
              </table>

              ${notesHtml}
              ${uploadHtml}

              <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 24px 0 0;">If you have any questions, please reply to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background: #374151; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
              <p style="margin: 0;">EquiPatterns — Horse Show Management</p>
              <p style="margin: 8px 0 0;">&copy; ${new Date().getFullYear()} EquiPatterns. All rights reserved.</p>
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
    console.log("Custom pattern request email sent:", result.MessageID);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending custom pattern request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
