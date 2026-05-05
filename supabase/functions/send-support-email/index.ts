import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupportEmailRequest {
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
}

const ADMIN_EMAIL = "frontrangehay@gmail.com";

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

    const { userName, userEmail, subject, message }: SupportEmailRequest = await req.json();

    if (!userEmail || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userEmail, subject, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending support email:", { userName, userEmail, subject });

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: ADMIN_EMAIL,
        ReplyTo: userEmail,
        Subject: `[Support] ${subject}`,
        HtmlBody: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .footer { background: #374151; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
              .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
              .label { font-weight: bold; color: #6b7280; }
              .message-box { background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; margin: 16px 0; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Support Request</h1>
              </div>
              <div class="content">
                <div class="info-row">
                  <span class="label">From:</span> ${userName} (${userEmail})
                </div>
                <div class="info-row">
                  <span class="label">Subject:</span> ${subject}
                </div>
                <p><strong>Message:</strong></p>
                <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
                <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
                  You can reply directly to this email to respond to the user.
                </p>
              </div>
              <div class="footer">
                <p>EquiPatterns Support System</p>
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
    console.log("Support email sent successfully:", result.MessageID);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending support email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
