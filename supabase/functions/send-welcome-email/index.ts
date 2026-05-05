import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userName: string;
  userEmail: string;
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

    const { userName, userEmail }: WelcomeEmailRequest = await req.json();

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required field: userEmail" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending welcome email to:", userEmail);

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: userEmail,
        Subject: "Welcome to EquiPatterns!",
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
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; max-width: 600px;">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Welcome to EquiPatterns!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">Hello ${userName || "there"},</p>

              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">Thank you for joining EquiPatterns! We're excited to have you as part of our growing community.</p>

              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">Our goal is to simplify how patterns and score sheets are selected, organized, and accessed — whether for practice, shows, or judging.</p>

              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 16px;">With EquiPatterns you can:</p>

              <ul style="color: #333; font-size: 16px; line-height: 28px; margin: 0 0 16px; padding-left: 24px;">
                <li>Browse and select patterns across all major disciplines</li>
                <li>Build professional pattern books for your shows</li>
                <li>Manage horse show events, staff, and contracts</li>
                <li>Access association-compliant materials</li>
              </ul>

              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 24px;">We're here to help and look forward to supporting you.</p>

              <p style="color: #333; font-size: 16px; line-height: 26px; margin: 0 0 4px;">Sincerely,</p>
              <p style="color: #333; font-size: 16px; font-weight: 600; margin: 0 0 24px;">The EquiPatterns Team</p>

              <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 24px 0;">

              <p style="color: #8898aa; font-size: 12px; line-height: 20px; text-align: center; margin: 0;">
                <a href="https://equipatterns.com" style="color: #2563eb; text-decoration: underline;">EquiPatterns.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #374151; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
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
    console.log("Welcome email sent successfully:", result.MessageID);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
