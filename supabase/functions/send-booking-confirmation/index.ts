import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;
const SITE_URL = "https://equipatterns.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Every field interpolated below comes from the booking record itself (line
// item names, the exhibitor's own name), not from free-typed caller input,
// but it's still customer-entered text landing in an email from our verified
// domain — escape it regardless.
const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (n: unknown): string => `$${(Number(n) || 0).toFixed(2)}`;

interface BookingConfirmationRequest {
  bookingId: string;
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

    const { bookingId }: BookingConfirmationRequest = await req.json();
    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: bookingId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── Load the real booking, don't trust caller-supplied line items ───────
    // get_public_booking is the same SECURITY DEFINER RPC the confirmation
    // page (/booking/:bookingId) uses, granted to anon — this function only
    // ever emails what's actually stored on the booking, not whatever the
    // request body happened to say.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await supabase.rpc("get_public_booking", { p_booking_id: bookingId });
    if (error || !data?.booking) {
      console.error("get_public_booking failed:", error);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const booking = data.booking;
    const showName = data.show?.name || "the show";
    const recipientEmail = booking.email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "This booking has no email on file" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const shortRef = String(bookingId).slice(0, 8).toUpperCase();
    const items: any[] = Array.isArray(booking.items) ? booking.items : [];
    const total = Number(booking.liveTotal ?? booking.totalAmount ?? booking.amount ?? 0);
    const bookingUrl = `${SITE_URL}/booking/${bookingId}`;

    const itemRows = items.map((item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e6ebf1;">
          <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">${escapeHtml(item.name)}</p>
          ${item.detail ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 12px;">${escapeHtml(item.detail)}</p>` : ""}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e6ebf1; text-align: right; white-space: nowrap;">
          <p style="margin: 0; color: #111827; font-size: 14px; font-weight: 600;">${money(item.amount)}</p>
        </td>
      </tr>`).join("");

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
        Subject: `Reservation Confirmed — ${showName} (#${shortRef})`,
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
              <h1 style="margin: 0; font-size: 26px; line-height: 34px; font-weight: 700; color: #ffffff;">Reservation Confirmed!</h1>
              <p style="margin: 10px 0 0; color: #dbeafe; font-size: 16px;">${escapeHtml(showName)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 30px 8px;">
              <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 16px;">
                Hi ${escapeHtml(booking.exhibitorName || "there")}, thanks for reserving with ${escapeHtml(showName)}. Keep this email — it has your reservation number.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 6px; margin: 0 0 20px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 2px; color: #1e3a8a; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Reservation Number</p>
                    <p style="margin: 0; color: #111827; font-size: 22px; font-weight: 700; letter-spacing: 1px;">${escapeHtml(shortRef)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${itemRows}
                <tr>
                  <td style="padding: 14px 0 0;"><p style="margin: 0; color: #111827; font-size: 16px; font-weight: 700;">Total</p></td>
                  <td style="padding: 14px 0 0; text-align: right;"><p style="margin: 0; color: #111827; font-size: 16px; font-weight: 700;">${money(total)}</p></td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 26px 30px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td bgcolor="#2563eb" style="border-radius: 8px;">
                    <a href="${bookingUrl}"
                       style="display: inline-block; padding: 15px 34px; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px;">
                      View Your Reservation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 8px 30px 30px;">
              <p style="color: #6b7280; font-size: 13px; line-height: 20px; margin: 0; text-align: center;">
                You can look this reservation up any time at ${SITE_URL}/find-booking using this email or reservation number.
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
    console.log("Booking confirmation sent:", result.MessageID, "to", recipientEmail);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending booking confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
