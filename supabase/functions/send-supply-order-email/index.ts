import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
interface SupplyOrderEmailRequest {
  kind: "receipt" | "delivered";
  to: string;
  customerName: string;
  showName: string;
  orderRef: string;
  items: OrderItem[];
  total: number;
  stableWith?: string;
}

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

const itemRows = (items: OrderItem[]) =>
  items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${it.name}</td>
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

const receiptBody = (r: SupplyOrderEmailRequest) => `
  <p>Hi <strong>${r.customerName}</strong>,</p>
  <p>We've received your hay &amp; shavings order for <strong>${r.showName}</strong>. The facility team will deliver it to your stalls.</p>
  <div style="background:#f9fafb;border-radius:6px;padding:14px;margin:18px 0;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:bold;">Order Reference</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;font-family:monospace;">${r.orderRef}</div>
  </div>
  ${orderTable(r)}
  ${r.stableWith ? `<p style="color:#6b7280;font-size:13px;">Delivering to: <strong style="color:#333;">${r.stableWith}</strong></p>` : ""}
  <p style="font-size:13px;color:#6b7280;">Payment is arranged on-site. Keep your order reference handy.</p>
`;

const deliveredBody = (r: SupplyOrderEmailRequest) => `
  <p>Hi <strong>${r.customerName}</strong>,</p>
  <p style="font-size:16px;">Your order was <strong style="color:#059669;">delivered</strong>${r.stableWith ? ` to <strong>${r.stableWith}</strong>` : ""}.</p>
  <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:14px;margin:18px 0;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:bold;">Order Reference</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;font-family:monospace;">${r.orderRef}</div>
  </div>
  ${orderTable(r)}
  <p style="font-size:13px;color:#6b7280;">If something is missing, find the show office at <strong>${r.showName}</strong> and quote your order reference.</p>
`;

const orderTable = (r: SupplyOrderEmailRequest) => `
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

  try {
    if (!POSTMARK_API_TOKEN) {
      console.error("POSTMARK_API_TOKEN not found");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: SupplyOrderEmailRequest = await req.json();
    const { kind, to, showName } = payload;

    if (!to || !kind) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'kind'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const isDelivered = kind === "delivered";
    const subject = isDelivered
      ? `Delivered: your hay & shavings order - ${showName}`
      : `Order received - ${showName}`;
    const html = isDelivered
      ? shell("#059669", "Your Order Was Delivered", deliveredBody(payload))
      : shell("#d97706", "Order Received", receiptBody(payload));

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: "EquiPatterns <Info@equipatterns.com>",
        To: to,
        Subject: subject,
        HtmlBody: html,
        MessageStream: "outbound",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Postmark error:", errorText);
      return new Response(JSON.stringify({ error: `Email delivery failed: ${response.status}` }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const result = await response.json();
    console.log("Supply order email sent:", kind, result.MessageID);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending supply order email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
