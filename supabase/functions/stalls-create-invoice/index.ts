import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Create + send a Stripe HOSTED INVOICE for a housing/stall booking.
//
// This is the "invoice after confirmation" billing mode: the admin confirms the
// booking, then generates an invoice that Stripe EMAILS to the exhibitor with a
// "Pay online" button. When they pay, the stripe-webhook (invoice.paid) marks the
// booking paid — the same way checkout does.
//
// The amount is computed SERVER-SIDE, LIVE (assigned stalls × nights × the barn's
// CURRENT price/night) so it matches the UI and can't be tampered with. We do NOT
// use the stored booking.totalAmount — that is $0 for bookings made before the
// stall fee was set, which used to wrongly report "Nothing is due".

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

// Invoice line items with LIVE amounts. Stall lines are recomputed from the
// current price × assigned count × nights; other items keep their stored amount.
function buildBookingLineItems(projectData: any, booking: any) {
  const rows: Array<{ description: string; total: number }> = [];
  const nights = Number(booking?.nights) || 1;
  const assigned = assignedStallsForBooking(projectData, booking?.id);
  const items = Array.isArray(booking?.items) ? booking.items : [];

  if (items.length > 0) {
    for (const it of items) {
      if (it.type === "stall") {
        const stallsInThisBarn = assigned.filter((s) => s.barnId === it.refId);
        const count = stallsInThisBarn.length || Number(it.qty) || 0;
        const price = stallsInThisBarn[0]?.pricePerNight ?? Number(it.unitPrice) ?? 0;
        rows.push({ description: it.name || "Stalls", total: count * nights * price });
      } else {
        rows.push({ description: it.name || it.type || "Booking item", total: Number(it.amount) || 0 });
      }
    }
  } else {
    rows.push({ description: "Stall reservation", total: Number(booking?.amount) || 0 });
  }
  return rows;
}

function computeBookingTotal(projectData: any, booking: any): number {
  return buildBookingLineItems(projectData, booking)
    .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
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

interface InvoiceRequest {
  showId: string;
  bookingId: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { showId, bookingId }: InvoiceRequest = await req.json();
    if (!showId || !bookingId) {
      throw new Error("Missing showId or bookingId");
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
    if (error || !project) throw new Error("Show not found");

    const bookings = project.project_data?.stallingService?.bookings || [];
    const booking = bookings.find((b: any) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    const email = booking.email;
    if (!email) throw new Error("This booking has no email to send an invoice to");

    // Price LIVE, not from the stale stored totalAmount.
    const total = computeBookingTotal(project.project_data, booking);
    const paid = Number(
      booking.paidAmount ?? (booking.paymentStatus === "paid" ? total : 0)
    );
    const due = Math.max(0, total - paid);
    const amountCents = Math.round(due * 100);
    if (amountCents <= 0) throw new Error("Nothing is due on this booking");

    // 1) Customer (create fresh per invoice — guests have no stored customer).
    const customer = await stripePost("customers", {
      email,
      name: booking.exhibitorName || email,
      "metadata[showId]": showId,
      "metadata[bookingId]": bookingId,
    });
    if (customer.error) throw new Error(customer.error.message);

    // 2) Create the invoice FIRST (draft), then attach line items by id (step 3).
    const invoice = await stripePost("invoices", {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: "14",
      auto_advance: "false",
      "metadata[type]": "stall_booking",
      "metadata[showId]": showId,
      "metadata[bookingId]": bookingId,
    });
    if (invoice.error) throw new Error(invoice.error.message);

    // 3) Attach line items with LIVE amounts (never the stale $0 stored on
    //    pre-fee bookings); fall back to one lump line for a partial balance.
    const liveItems = buildBookingLineItems(project.project_data, booking)
      .filter((it) => Number(it.total) > 0);
    if (paid <= 0 && liveItems.length > 0) {
      for (const it of liveItems) {
        const r = await stripePost("invoiceitems", {
          customer: customer.id,
          invoice: invoice.id,
          amount: String(Math.round(Number(it.total) * 100)),
          currency: "usd",
          description: it.description || "Booking item",
        });
        if (r.error) throw new Error(r.error.message);
      }
    } else {
      const r = await stripePost("invoiceitems", {
        customer: customer.id,
        invoice: invoice.id,
        amount: String(amountCents),
        currency: "usd",
        description:
          `${project.project_name || "Show"} — Stalls balance for ` +
          `${booking.exhibitorName || "exhibitor"}`,
      });
      if (r.error) throw new Error(r.error.message);
    }

    // 4) Finalize + email it. Returns the hosted invoice URL for reference.
    const sent = await stripePost(`invoices/${invoice.id}/send`, {});
    if (sent.error) throw new Error(sent.error.message);

    return new Response(
      JSON.stringify({
        invoiceId: sent.id,
        hostedInvoiceUrl: sent.hosted_invoice_url,
        amount: due,
        email,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err: any) {
    console.error("stalls-create-invoice error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
