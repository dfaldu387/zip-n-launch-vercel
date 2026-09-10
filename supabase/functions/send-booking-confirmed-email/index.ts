import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Sent when the show organizer changes a booking's status to "Confirmed" in
// Horse Show Manager. Separate from send-booking-confirmation, which fires
// the moment the exhibitor submits (while the booking is still Pending) —
// this one tells them the organizer has actually reviewed and approved it.

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;
const SITE_URL = "https://equipatterns.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (n: unknown): string => `$${(Number(n) || 0).toFixed(2)}`;

interface BookingConfirmedEmailRequest {
  showId: string;
  bookingId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const refuse = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    if (!POSTMARK_API_TOKEN) {
      console.error("POSTMARK_API_TOKEN not found");
      return refuse("Email service not configured", 500);
    }

    const { showId, bookingId }: BookingConfirmedEmailRequest = await req.json();
    if (!showId || !bookingId) {
      return refuse("Missing required field: showId or bookingId", 400);
    }

    // ── Who is asking ───────────────────────────────────────────────────────
    // This makes EquiPatterns email a real exhibitor saying their reservation is
    // confirmed. Only whoever runs the show should be able to trigger that, so
    // the caller must be signed in and able to manage this show — the same rule
    // the invoice sender uses.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token || token === anonKey) {
      return refuse("You must be signed in to do that.", 401);
    }

    const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await asCaller.auth.getUser();
    if (!userData?.user) {
      return refuse("You must be signed in to do that.", 401);
    }

    const { data: allowed, error: allowedError } = await asCaller.rpc(
      "can_manage_show",
      { p_project_id: showId }
    );
    if (allowedError || allowed !== true) {
      return refuse("You do not have access to this show.", 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project, error } = await admin
      .from("projects")
      .select("project_name, project_data")
      .eq("id", showId)
      .single();
    if (error || !project) return refuse("Show not found", 404);

    const bookings = project.project_data?.stallingService?.bookings || [];
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) return refuse("Booking not found", 404);

    const recipientEmail = booking.email;
    if (!recipientEmail) return refuse("This booking has no email on file", 400);

    const showName = project.project_name || "the show";
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
        Subject: `You're Confirmed — ${showName} (#${shortRef})`,
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
            <td bgcolor="#059669" style="background-color: #059669; background-image: linear-gradient(135deg, #047857, #10b981); padding: 36px 30px; text-align: center;">
              <p style="margin: 0 0 6px; color: #a7f3d0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">EquiPatterns</p>
              <h1 style="margin: 0; font-size: 26px; line-height: 34px; font-weight: 700; color: #ffffff;">You're Confirmed!</h1>
              <p style="margin: 10px 0 0; color: #d1fae5; font-size: 16px;">${escapeHtml(showName)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px 30px 8px;">
              <p style="color: #374151; font-size: 16px; line-height: 26px; margin: 0 0 16px;">
                Hi ${escapeHtml(booking.exhibitorName || "there")}, good news — ${escapeHtml(showName)} has reviewed and confirmed your reservation.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ecfdf5; border-left: 4px solid #059669; border-radius: 6px; margin: 0 0 20px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 2px; color: #065f46; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Reservation Number</p>
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
                  <td bgcolor="#059669" style="border-radius: 8px;">
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
      return refuse(`Email delivery failed: ${response.status}`, 500);
    }

    const result = await response.json();
    console.log("Booking confirmed email sent:", result.MessageID, "to", recipientEmail);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageID }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending booking confirmed email:", error);
    return refuse(error.message, 500);
  }
};

serve(handler);
