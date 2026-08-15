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
        // The welcome email is the first thing a new customer sees, so it earns a
        // bit of design. Built the way email has to be built: tables, inline
        // styles, no flexbox. The header uses a SOLID colour with the gradient
        // layered on top — Outlook ignores gradients and would otherwise render
        // white text on a white block.
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

          <!-- Header -->
          <tr>
            <td bgcolor="#2563eb" style="background-color: #2563eb; background-image: linear-gradient(135deg, #1d4ed8, #3b82f6); padding: 40px 30px; text-align: center;">
              <p style="margin: 0 0 6px; color: #bfdbfe; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">EquiPatterns</p>
              <h1 style="margin: 0; font-size: 30px; line-height: 38px; font-weight: 700; color: #ffffff;">Welcome aboard, ${userName || "rider"}!</h1>
              <p style="margin: 10px 0 0; color: #dbeafe; font-size: 16px; line-height: 24px;">Patterns, score sheets and shows — all in one place.</p>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding: 32px 30px 8px;">
              <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 16px;">
                Thank you for joining EquiPatterns. We built it to take the fiddly part out of
                running and judging a show — choosing patterns, formatting score sheets, and
                getting everything to the right people on the day.
              </p>
            </td>
          </tr>

          <!-- What you can do — coloured tiles instead of a plain bullet list -->
          <tr>
            <td style="padding: 8px 30px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 0 0 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 6px;">
                      <tr>
                        <td style="padding: 14px 16px;">
                          <p style="margin: 0 0 2px; color: #1e3a8a; font-size: 15px; font-weight: 700;">Browse curated patterns</p>
                          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 21px;">Every major discipline, association-compliant and ready to use.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 6px;">
                      <tr>
                        <td style="padding: 14px 16px;">
                          <p style="margin: 0 0 2px; color: #14532d; font-size: 15px; font-weight: 700;">Build a pattern book in minutes</p>
                          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 21px;">Pick your classes, and the book and score sheets come out formatted.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border-left: 4px solid #d97706; border-radius: 6px;">
                      <tr>
                        <td style="padding: 14px 16px;">
                          <p style="margin: 0 0 2px; color: #78350f; font-size: 15px; font-weight: 700;">Run the whole show</p>
                          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 21px;">Stalls, staff, contracts, awards and results — from one place.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Call to action -->
          <tr>
            <td align="center" style="padding: 24px 30px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td bgcolor="#2563eb" style="border-radius: 8px;">
                    <a href="https://equipatterns.com/pattern-book-builder"
                       style="display: inline-block; padding: 15px 34px; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
                      Start your first pattern book
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding: 24px 30px 30px;">
              <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 0 0 20px;">
              <p style="color: #374151; font-size: 15px; line-height: 24px; margin: 0 0 4px;">
                Any questions, just reply to this email — a real person reads it.
              </p>
              <p style="color: #374151; font-size: 15px; margin: 16px 0 2px;">Sincerely,</p>
              <p style="color: #111827; font-size: 15px; font-weight: 700; margin: 0;">The EquiPatterns Team</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#111827" style="background-color: #111827; color: #9ca3af; padding: 22px 30px; text-align: center; font-size: 12px; line-height: 20px;">
              <p style="margin: 0 0 6px;">
                <a href="https://equipatterns.com" style="color: #93c5fd; text-decoration: none; font-weight: 600;">EquiPatterns.com</a>
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
