import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const POSTMARK_API_TOKEN = Deno.env.get("POSTMARK_API_TOKEN") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  name: string;
  amount: number;
}

// `kind` picks the email: 'receipt' when the order is placed, 'delivered' when
// the supply manager marks it delivered at the show.
//
// The caller names the order by bookingId only. The recipient, customer name,
// show name, stall and reference all come from the saved order — never from the
// request — so this cannot be used to send arbitrary mail to arbitrary people.
interface SupplyOrderEmailRequest {
  kind: "receipt" | "delivered";
  bookingId: string;
  // Only read for 'delivered', where staff may send a subset of the order
  // (one item marked delivered). Always escaped, never used as the recipient.
  items?: OrderItem[];
  total?: number;
}

interface EmailContent {
  customerName: string;
  showName: string;
  orderRef: string;
  items: OrderItem[];
  total: number;
  stableWith?: string;
  stallNumber?: string;
}

// A receipt is only sent right after an order is placed. The anonymous order
// page is the only caller of that kind, so older orders are refused — this caps
// how long anyone holding a booking id can re-trigger the customer's receipt.
const RECEIPT_WINDOW_MS = 30 * 60 * 1000;

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

const itemRows = (items: OrderItem[]) =>
  items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(it.name)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${money(it.amount)}</td>
        </tr>`,
    )
    .join("");

const shell = (accent: string, heading: string, body: string) => `
  <!DOCTYPE html>
  <html>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#333;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:${accent};color:white;padding:28px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:22px;">${heading}</h1>
        </div>
        <div style="background:#ffffff;padding:28px;border:1px solid #e5e7eb;">
          ${body}
        </div>
        <div style="background:#374151;color:#9ca3af;padding:18px;text-align:center;border-radius:0 0 8px 8px;font-size:12px;">
          <p style="margin:0;">This is an automated message from EquiPatterns.</p>
          <p style="margin:6px 0 0;">&copy; ${new Date().getFullYear()} EquiPatterns. All rights reserved.</p>
        </div>
      </div>
    </body>
  </html>
`;

const deliveryTarget = (r: EmailContent) =>
  `${escapeHtml(r.stableWith)}${r.stallNumber ? ` (Stall ${escapeHtml(r.stallNumber)})` : ""}`;

const receiptBody = (r: EmailContent) => `
  <p>Hi <strong>${escapeHtml(r.customerName)}</strong>,</p>
  <p>We've received your hay &amp; shavings order for <strong>${escapeHtml(r.showName)}</strong>. The facility team will deliver it to your stalls.</p>
  <div style="background:#f9fafb;border-radius:6px;padding:14px;margin:18px 0;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:bold;">Order Reference</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;font-family:monospace;">${escapeHtml(r.orderRef)}</div>
  </div>
  ${orderTable(r)}
  ${r.stableWith ? `<p style="color:#6b7280;font-size:13px;">Delivering to: <strong style="color:#333;">${deliveryTarget(r)}</strong></p>` : ""}
  <p style="font-size:13px;color:#6b7280;">Keep your order reference handy.</p>
`;

const deliveredBody = (r: EmailContent) => `
  <p>Hi <strong>${escapeHtml(r.customerName)}</strong>,</p>
  <p style="font-size:16px;">Your order was <strong style="color:#059669;">delivered</strong>${r.stableWith ? ` to <strong>${deliveryTarget(r)}</strong>` : ""}.</p>
  <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:14px;margin:18px 0;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:bold;">Order Reference</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;font-family:monospace;">${escapeHtml(r.orderRef)}</div>
  </div>
  ${orderTable(r)}
  <p style="font-size:13px;color:#6b7280;">If something is missing, find the show office at <strong>${escapeHtml(r.showName)}</strong> and quote your order reference.</p>
`;

const orderTable = (r: EmailContent) => `
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0;">
    ${itemRows(r.items || [])}
    <tr>
      <td style="padding:10px 0;font-weight:bold;">Total</td>
      <td style="padding:10px 0;text-align:right;font-weight:bold;">${money(r.total)}</td>
    </tr>
  </table>
`;

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

    const payload: SupplyOrderEmailRequest = await req.json();
    const { kind, bookingId } = payload;

    if (!bookingId || (kind !== "receipt" && kind !== "delivered")) {
      return refuse("Missing or invalid 'kind' or 'bookingId'", 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Find the saved order ────────────────────────────────────────────────
    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, project_name, project_data")
      .contains("project_data", { stallingService: { bookings: [{ id: bookingId }] } })
      .limit(1)
      .maybeSingle();
    if (projectError || !project) return refuse("Order not found", 404);

    const bookings = project.project_data?.stallingService?.bookings || [];
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) return refuse("Order not found", 404);

    const recipient = String(booking.email || "").trim();
    if (!recipient) return refuse("This order has no email on file", 400);

    // ── Who is asking ───────────────────────────────────────────────────────
    const isDelivered = kind === "delivered";
    if (isDelivered) {
      // Staff only: signed in AND able to manage the show this order belongs to
      // (same rule as send-booking-confirmed-email).
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token || token === anonKey) return refuse("You must be signed in to do that.", 401);

      const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await asCaller.auth.getUser();
      if (!userData?.user) return refuse("You must be signed in to do that.", 401);

      const { data: allowed, error: allowedError } = await asCaller.rpc("can_manage_show", {
        p_project_id: project.id,
      });
      if (allowedError || allowed !== true) return refuse("You do not have access to this show.", 403);
    } else {
      // Public receipt: only for a live supply order placed moments ago.
      // (Delivery notices above are staff-only, so they cover pre-show and
      // office-entered orders too.)
      if (booking.orderType !== "live-supply") return refuse("Not a supply order", 400);
      const created = Date.parse(booking.createdAt || "");
      if (!created || Date.now() - created > RECEIPT_WINDOW_MS) {
        return refuse("Receipt window has passed", 403);
      }
    }

    // ── What goes in the email ──────────────────────────────────────────────
    const savedItems: OrderItem[] = (Array.isArray(booking.items) ? booking.items : []).map(
      (it: any) => ({ name: it.name, amount: it.amount })
    );
    const savedTotal = Number(booking.totalAmount ?? booking.amount ?? 0);

    const content: EmailContent = {
      customerName: booking.exhibitorName || "there",
      showName: project.project_name || "the show",
      orderRef: String(bookingId).slice(0, 8).toUpperCase(),
      // Staff can send a delivery notice for just the item(s) they marked.
      items: isDelivered && Array.isArray(payload.items) ? payload.items : savedItems,
      total: isDelivered && payload.total !== undefined ? Number(payload.total) : savedTotal,
      stableWith: booking.stableWith || booking.trainerName || "",
      stallNumber: booking.stallNumber || "",
    };

    const subject = isDelivered
      ? `Delivered: your hay & shavings order - ${content.showName}`
      : `Order received - ${content.showName}`;
    const html = isDelivered
      ? shell("#059669", "Your Order Was Delivered", deliveredBody(content))
      : shell("#d97706", "Order Received", receiptBody(content));

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: recipient,
        Subject: subject,
        HtmlBody: html,
        MessageStream: "outbound",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Postmark error:", errorText);
      return refuse(`Email delivery failed: ${response.status}`, 500);
    }

    const result = await response.json();
    console.log("Supply order email sent:", kind, result.MessageID);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending supply order email:", error);
    return refuse(error.message, 500);
  }
};

serve(handler);
