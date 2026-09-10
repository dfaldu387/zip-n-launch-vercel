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

// Same rate as stalls-create-checkout — keep the two in sync if this changes.
const PLATFORM_COMMISSION_RATE = 0.05;

// ───── Live booking pricing (mirrors src/lib/bookingPricing.js) ─────
//
// Ported from the same fix applied to bookingPricing.js and the
// get_public_booking / record_stall_booking_payment database functions
// (20260910120000_fix_stall_pricing_after_barn_reassignment.sql) — a stall
// bought under the Flat Fee option (or Nightly Fee — see the split selector
// in extraStallFees.js) must stay priced at that option even after the
// organizer physically assigns it to a DIFFERENT barn than it was ordered
// in. Tracking feeType per ORDERED UNIT (one per stall ordered) instead of
// per barn is what keeps that straight; the old per-barn tracking here also
// multiplied Flat items by nights unconditionally, which this replaces too.

const feeScope = (fee: any): string | string[] => {
  const raw = fee?.appliesTo;
  if (Array.isArray(raw)) {
    if (raw.length === 0 || raw.includes("all")) return "all";
    return raw;
  }
  if (!raw || raw === "all") return "all";
  return [raw];
};

const feeAppliesToBarn = (fee: any, barnId: string): boolean => {
  const scope = feeScope(fee);
  return scope === "all" || (scope as string[]).includes(barnId);
};

const barnHasOwnFee = (barnId: string, stallFees: any[] = []): boolean =>
  (stallFees || []).some((fee) => {
    const scope = feeScope(fee);
    return scope !== "all" && (scope as string[]).includes(barnId);
  });

// A barn's flat-rate total = every Flat stall fee scoped to it. A barn with
// its own named fee is priced from that fee alone — "All Barns" fees are the
// default for barns that don't have one, not an add-on stacked on top.
function flatRateForBarn(barnId: string, stallFees: any[] = []): number {
  const exclusive = barnHasOwnFee(barnId, stallFees);
  return (stallFees || []).reduce((sum, fee) => {
    if ((fee.unitType || "per_stall") !== "flat") return sum;
    const scope = feeScope(fee);
    if (exclusive && scope === "all") return sum;
    if (!feeAppliesToBarn(fee, barnId)) return sum;
    return sum + (Number(fee.amount) || 0);
  }, 0);
}

// Invoice line items with LIVE amounts. Each ordered stall unit keeps the
// feeType/nights it was bought under; pairing it with whichever physical
// stall fulfilled it (capped at the ordered total, same as before) and
// grouping by (real assigned barn, feeType) prices Flat-bought stalls at
// their Flat rate and Nightly-bought stalls at their Nightly rate, wherever
// they actually ended up. Other items keep their stored amount.
function buildBookingLineItems(projectData: any, booking: any) {
  const rows: Array<{ description: string; total: number }> = [];
  const extraStallFees = projectData?.stallingService?.extraStallFees || [];
  const bookingNights = Number(booking?.nights) || 1;
  const items = Array.isArray(booking?.items) ? booking.items : [];
  const stallItems = items.filter((it: any) => it.type === "stall");
  const otherItems = items.filter((it: any) => it.type !== "stall");

  if (stallItems.length > 0) {
    const orderedTotal = stallItems.reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0);

    const units: Array<{ feeType: string | null; nights: number }> = [];
    for (const it of stallItems) {
      const qty = Number(it.qty) || 0;
      const unitNights = it.nights != null ? (Number(it.nights) || bookingNights) : bookingNights;
      for (let i = 0; i < qty; i++) units.push({ feeType: it.feeType || null, nights: unitNights });
    }

    const barns = projectData?.stallingService?.barns || [];
    const assignedStalls: Array<{ barnId: string; pricePerNight: number }> = [];
    for (const barn of barns) {
      for (const stall of barn.stalls || []) {
        if (stall.bookingId === booking?.id) {
          assignedStalls.push({ barnId: barn.id, pricePerNight: Number(barn.pricePerNight) || 0 });
        }
      }
    }
    const used = assignedStalls.slice(0, orderedTotal);

    const groups = new Map<string, { barnId: string; feeType: string | null; nights: number; count: number; pricePerNight: number }>();
    for (let i = 0; i < used.length; i++) {
      const stall = used[i];
      const unit = units[i];
      const key = `${stall.barnId}::${unit?.feeType || ""}`;
      const g = groups.get(key);
      if (g) {
        g.count += 1;
      } else {
        groups.set(key, { barnId: stall.barnId, feeType: unit?.feeType || null, nights: unit?.nights ?? bookingNights, count: 1, pricePerNight: stall.pricePerNight });
      }
    }

    for (const { barnId, feeType, nights, count, pricePerNight } of groups.values()) {
      const flatRate = flatRateForBarn(barnId, extraStallFees);
      const total = feeType === "flat" ? count * flatRate
        : feeType === "per_night" ? count * nights * pricePerNight
          : count * (nights * pricePerNight + flatRate);
      rows.push({ description: `Stalls × ${count}`, total });
    }

    // Whatever isn't physically assigned yet, priced from each line's own
    // originally-ordered barn (current flat rate if it has one, else the
    // unitPrice frozen at booking time).
    let deficit = Math.max(0, orderedTotal - used.length);
    for (const it of stallItems) {
      if (deficit <= 0) break;
      const take = Math.min(Number(it.qty) || 0, deficit);
      if (take <= 0) continue;
      deficit -= take;

      const itNights = it.nights != null ? (Number(it.nights) || bookingNights) : bookingNights;
      const nightlyRate = Number(it.unitPrice) || 0;
      const flatRate = flatRateForBarn(it.refId, extraStallFees);
      const total = it.feeType === "flat" ? take * flatRate
        : it.feeType === "per_night" ? take * itNights * nightlyRate
          : take * (itNights * nightlyRate + flatRate);
      rows.push({ description: it.name || "Stalls", total });
    }
  } else if (items.length === 0) {
    rows.push({ description: "Stall reservation", total: Number(booking?.amount) || 0 });
  }

  for (const it of otherItems) {
    rows.push({ description: it.name || it.type || "Booking item", total: Number(it.amount) || 0 });
  }

  return rows;
}

function computeBookingTotal(projectData: any, booking: any): number {
  return buildBookingLineItems(projectData, booking)
    .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────

// stripeAccount, when set, runs the call ON that connected account (a
// "direct charge") instead of the platform account — the standard pattern
// for Invoicing + Connect, since invoices don't support destination charges.
async function stripePost(
  endpoint: string,
  params: Record<string, string>,
  stripeAccount?: string | null
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;

  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers,
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

    // ── Who is asking ───────────────────────────────────────────────────────
    // This function makes Stripe EMAIL a real exhibitor. It had no check at all:
    // a request with nothing but the public key got as far as looking the
    // booking up, so anyone holding a show id and a booking id could have Stripe
    // invoice that exhibitor, from your account, as many times as they liked.
    //
    // Sending an invoice is the show office's job, so the caller must be signed
    // in and able to manage this show — its owner, an admin, or an assigned
    // judge or staff member. can_manage_show() decides that, the same rule the
    // score-sheet posting policy uses.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token || token === anonKey) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to send an invoice." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Runs as the caller, so auth.uid() inside can_manage_show is really them.
    const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await asCaller.auth.getUser();
    if (!userData?.user) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to send an invoice." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: allowed, error: allowedError } = await asCaller.rpc(
      "can_manage_show",
      { p_project_id: showId }
    );

    if (allowedError || allowed !== true) {
      return new Response(
        JSON.stringify({ error: "You do not have access to this show." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project, error } = await admin
      .from("projects")
      .select("project_name, project_data, user_id")
      .eq("id", showId)
      .single();
    if (error || !project) throw new Error("Show not found");

    // Same Connect split as stalls-create-checkout — no retroactive gating for
    // shows onboarded before this existed, they keep billing on the platform
    // account exactly as before.
    let connectedAccountId: string | null = null;
    if (project.user_id) {
      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("stripe_connect_account_id, stripe_connect_payouts_enabled")
        .eq("id", project.user_id)
        .single();
      if (ownerProfile?.stripe_connect_payouts_enabled && ownerProfile.stripe_connect_account_id) {
        connectedAccountId = ownerProfile.stripe_connect_account_id;
      }
    }

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
    //    Direct charge: when the show has payouts enabled, the customer and
    //    invoice live ON the connected account, not the platform account, so
    //    money is collected straight into the show manager's Stripe balance.
    const customer = await stripePost("customers", {
      email,
      name: booking.exhibitorName || email,
      "metadata[showId]": showId,
      "metadata[bookingId]": bookingId,
    }, connectedAccountId);
    if (customer.error) throw new Error(customer.error.message);

    // 2) Create the invoice FIRST (draft), then attach line items by id (step 3).
    const invoiceParams: Record<string, string> = {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: "14",
      auto_advance: "false",
      "metadata[type]": "stall_booking",
      "metadata[showId]": showId,
      "metadata[bookingId]": bookingId,
    };
    if (connectedAccountId) {
      invoiceParams["application_fee_amount"] = String(
        Math.round(amountCents * PLATFORM_COMMISSION_RATE)
      );
    }
    const invoice = await stripePost("invoices", invoiceParams, connectedAccountId);
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
        }, connectedAccountId);
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
      }, connectedAccountId);
      if (r.error) throw new Error(r.error.message);
    }

    // 4) Finalize + email it. Returns the hosted invoice URL for reference.
    const sent = await stripePost(`invoices/${invoice.id}/send`, {}, connectedAccountId);
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
