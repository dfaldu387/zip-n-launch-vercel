import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Guest-friendly Stripe checkout for HOUSING/STALL bookings.
//
// Unlike stripe-create-checkout (fixed price, requires a logged-in user), this one:
//   • needs NO auth — a public exhibitor booking online is usually not signed in
//   • charges a DYNAMIC amount (stalls × price × nights + supplies) via price_data
//   • looks the booking up SERVER-SIDE from project_data and computes the amount here,
//     so the client can never tamper with what gets charged
//
// It charges the OUTSTANDING balance (total − already paid), priced LIVE from the
// barn's CURRENT price/night — NOT the stored booking.totalAmount, which is $0 for
// bookings made before the stall fee was set.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

// ───── Live booking pricing (mirrors src/lib/invoiceGenerator.js) ─────

// Stalls assigned to a booking, each stamped with its barn's CURRENT price/night.
function assignedStallsForBooking(projectData: any, bookingId: string) {
  const barns = projectData?.stallingService?.barns || [];
  const result: Array<{ barnId: string; pricePerNight: number }> = [];
  for (const barn of barns) {
    for (const stall of barn.stalls || []) {
      if (stall.bookingId === bookingId) {
        result.push({ barnId: barn.id, pricePerNight: Number(barn.pricePerNight) || 0 });
      }
    }
  }
  return result;
}

// Live total = assigned stalls × nights × current price/night, plus non-stall items.
function computeBookingTotal(projectData: any, booking: any): number {
  const nights = Number(booking?.nights) || 1;
  const assigned = assignedStallsForBooking(projectData, booking?.id);
  const items = Array.isArray(booking?.items) ? booking.items : [];
  let total = 0;

  if (items.length > 0) {
    for (const it of items) {
      if (it.type === "stall") {
        const stallsInThisBarn = assigned.filter((s) => s.barnId === it.refId);
        const count = stallsInThisBarn.length || Number(it.qty) || 0;
        const price = stallsInThisBarn[0]?.pricePerNight ?? Number(it.unitPrice) ?? 0;
        total += count * nights * price;
      } else {
        total += Number(it.amount) || 0;
      }
    }
  } else {
    total += Number(booking?.amount) || 0;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────

async function stripePost(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  return response.json();
}

interface CheckoutRequest {
  showId: string;
  bookingId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      showId,
      bookingId,
      successUrl,
      cancelUrl,
      customerEmail,
    }: CheckoutRequest = await req.json();

    if (!showId || !bookingId) {
      throw new Error("Missing showId or bookingId");
    }
    if (!successUrl || !cancelUrl) {
      throw new Error("Missing successUrl or cancelUrl");
    }

    // Service-role client — read the booking to price it server-side.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project, error } = await admin
      .from("projects")
      .select("project_name, project_data")
      .eq("id", showId)
      .single();

    if (error || !project) {
      throw new Error("Show not found");
    }

    const bookings = project.project_data?.stallingService?.bookings || [];
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Outstanding balance in cents (total − already paid), priced LIVE.
    const total = computeBookingTotal(project.project_data, booking);
    const paid = Number(
      booking.paidAmount ?? (booking.paymentStatus === "paid" ? total : 0)
    );
    const due = Math.max(0, total - paid);
    const amountCents = Math.round(due * 100);
    if (amountCents <= 0) {
      throw new Error("Nothing is due on this booking");
    }

    const label =
      `${project.project_name || "Show"} — Stalls for ` +
      `${booking.exhibitorName || "exhibitor"}`;

    const params: Record<string, string> = {
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": label,
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][quantity]": "1",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      "metadata[type]": "stall_booking",
      "metadata[showId]": showId,
      "metadata[bookingId]": bookingId,
    };

    const email = customerEmail || booking.email;
    if (email) params["customer_email"] = email;

    const session = await stripePost("checkout/sessions", params);
    if (session.error) {
      throw new Error(session.error.message);
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id, amount: due }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err: any) {
    console.error("stalls-create-checkout error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
