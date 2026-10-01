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

// Platform commission on stall/RV bookings once a show manager has Connect
// payouts enabled (meeting 2026-09-07: 5% to start, adjustable any time —
// change this one constant, no other code needs to move).
const PLATFORM_COMMISSION_RATE = 0.05;

// Estimated US card rate, used only to gross up the charge when a show has
// chosen "customer pays the processing fee" (project_data.stallingService.
// processingFeeMode === 'customer'). Stripe's real fee varies by card/country
// and is only known after the charge settles — this is a standard estimate,
// same approach other marketplaces use. Duplicated in stalls-create-invoice
// (Deno functions can't share src/lib imports).
const STRIPE_PCT = 0.029;
const STRIPE_FLAT_CENTS = 30;

// Gross up `amountCents` so that after Stripe takes its estimated cut, the
// original `amountCents` still lands in full for the platform to split.
function grossUpForCustomerFee(amountCents: number): number {
  return Math.ceil((amountCents + STRIPE_FLAT_CENTS) / (1 - STRIPE_PCT));
}

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

// Does `barnId` carry a fee scoped specifically to it (as opposed to "All
// Barns")? A barn with its own fee is priced from that fee alone — mirrors
// barnHasOwnFee() in src/lib/extraStallFees.js and the fixed barn_flat_rate()
// Postgres function (see 20260907120000_fix_barn_flat_rate_exclusivity.sql).
function feeAppliesTo(fee: any, barnId: string): { scoped: boolean; facilityWide: boolean } {
  const applies = fee?.appliesTo;
  if (Array.isArray(applies)) {
    if (applies.length === 0 || applies.includes("all")) return { scoped: false, facilityWide: true };
    return { scoped: applies.includes(barnId), facilityWide: false };
  }
  if (!applies || applies === "all") return { scoped: false, facilityWide: true };
  return { scoped: applies === barnId, facilityWide: false };
}

function barnHasOwnFee(barnId: string, extraStallFees: any[]): boolean {
  return (extraStallFees || []).some((fee) => feeAppliesTo(fee, barnId).scoped);
}

// A barn's flat-rate total, live from today's fees — same exclusivity rule as
// flatRateForBarn() in src/lib/extraStallFees.js: "All Barns" only counts when
// the barn has no fee of its own.
function barnFlatRate(barnId: string, extraStallFees: any[]): number {
  const exclusive = barnHasOwnFee(barnId, extraStallFees);
  return (extraStallFees || []).reduce((sum, fee) => {
    if ((fee.unitType || "per_stall") !== "flat") return sum;
    const amount = Number(fee.amount) || 0;
    if (amount <= 0) return sum;
    const { scoped, facilityWide } = feeAppliesTo(fee, barnId);
    if (scoped) return sum + amount;
    if (facilityWide && !exclusive) return sum + amount;
    return sum;
  }, 0);
}

// The per-stall price for one unit — mirrors stallUnitPrice() in
// src/lib/bookingPricing.js.
function stallUnitPrice(feeType: string | null, nightlyRate: number, flatRate: number, nights: number): number {
  if (feeType === "flat") return flatRate;
  if (feeType === "per_night") return nightlyRate * nights;
  return nightlyRate * nights + flatRate;
}

// Pair each stall item with the stalls actually assigned to it — mirrors
// pairStallUnits() in src/lib/bookingPricing.js (Deno functions can't share
// src/lib imports, so this is a deliberate duplicate — keep both in sync). A
// stall fills the unit for ITS OWN barn first; only a stall moved to a
// different barn than any item ordered spills into whatever units are still
// open. Replaces "every item for a barn re-reads ALL of that barn's assigned
// stalls" — the bug where a partly-assigned multi-barn order could bill one
// barn twice while never billing the other barn at all.
function pairStallUnits(stallItems: any[], assignedStalls: Array<{ barnId: string; pricePerNight: number }>, nights: number) {
  const orderedTotal = stallItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const used = (assignedStalls || []).slice(0, orderedTotal);

  type Unit = { item: any; feeType: string | null; nights: number; stall: { barnId: string; pricePerNight: number } | null };
  const units: Unit[] = [];
  for (const it of stallItems) {
    const qty = Number(it.qty) || 0;
    const unitNights = it.nights != null ? (Number(it.nights) || nights) : nights;
    for (let i = 0; i < qty; i++) units.push({ item: it, feeType: it.feeType || null, nights: unitNights, stall: null });
  }

  const moved: typeof used = [];
  for (const stall of used) {
    const unit = units.find((u) => !u.stall && u.item.refId === stall.barnId);
    if (unit) unit.stall = stall; else moved.push(stall);
  }
  for (const stall of moved) {
    const unit = units.find((u) => !u.stall);
    if (unit) unit.stall = stall;
  }
  return units;
}

// Live total = each assigned stall priced at whichever option it was bought
// under (Flat Fee once per stall, Nightly Fee × nights), plus non-stall
// items. Mirrors buildLineItems()/computeBookingTotal() in
// src/lib/bookingPricing.js.
function computeBookingTotal(projectData: any, booking: any): number {
  const nights = Number(booking?.nights) || 1;
  const assigned = assignedStallsForBooking(projectData, booking?.id);
  const extraStallFees = projectData?.stallingService?.extraStallFees || [];
  const items = Array.isArray(booking?.items) ? booking.items : [];
  let total = 0;

  if (items.length > 0) {
    const stallItems = items.filter((it: any) => it.type === "stall");
    const otherItems = items.filter((it: any) => it.type !== "stall");

    if (stallItems.length > 0) {
      const units = pairStallUnits(stallItems, assigned, nights);
      for (const unit of units) {
        if (!unit.stall) continue;
        const nightlyRate = unit.stall.pricePerNight ?? 0;
        const flatRate = barnFlatRate(unit.stall.barnId, extraStallFees);
        total += stallUnitPrice(unit.feeType, nightlyRate, flatRate, unit.nights);
      }
      // Whatever isn't physically assigned yet, priced from each line's own
      // originally-ordered barn/rate — only units no stall was paired with are
      // still open, counted PER ITEM, so an item whose stalls are already
      // placed is never billed a second time.
      const openByItem = new Map<any, number>();
      for (const u of units) {
        if (!u.stall) openByItem.set(u.item, (openByItem.get(u.item) || 0) + 1);
      }
      for (const it of stallItems) {
        const take = openByItem.get(it) || 0;
        if (take <= 0) continue;
        const barnNights = it.nights != null ? (Number(it.nights) || nights) : nights;
        const nightlyRate = Number(it.unitPrice) || 0;
        const flatRate = barnFlatRate(it.refId, extraStallFees);
        total += take * stallUnitPrice(it.feeType, nightlyRate, flatRate, barnNights);
      }
    }
    for (const it of otherItems) {
      total += Number(it.amount) || 0;
    }
  } else {
    total += Number(booking?.amount) || 0;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────

// Where Stripe may send an exhibitor after they pay.
//
// success_url and cancel_url came from the browser and went to Stripe unchecked,
// so anyone could build a REAL checkout session on this account — genuine Stripe
// page, genuine show name and amount — that dropped the payer on a site of their
// choosing afterwards. "Payment failed, try your card again" is very convincing
// straight after a real Stripe checkout.
//
// This one has no login by design (exhibitors have no account), which makes the
// destination check the only thing standing in the way.
const ALLOWED_ORIGINS = [
  "https://equipatterns.com",
  "https://www.equipatterns.com",
  "https://zip-n-launch-vercel.vercel.app",   // the Vercel domain, also live
  "http://localhost:3000",   // local development
  "http://localhost:3001",   // npm run preview
];

const isAllowedRedirect = (url: unknown): boolean => {
  if (typeof url !== "string" || url === "") return false;
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;   // not a URL at all
  }
};

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
    if (!isAllowedRedirect(successUrl) || !isAllowedRedirect(cancelUrl)) {
      throw new Error("Invalid return address.");
    }

    // Service-role client — read the booking to price it server-side.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project, error } = await admin
      .from("projects")
      .select("project_name, project_data, user_id")
      .eq("id", showId)
      .single();

    if (error || !project) {
      throw new Error("Show not found");
    }

    // Split the payment if the show's owner has Connect payouts enabled —
    // shows onboarded before this feature keep going 100% to the platform
    // account exactly as before (no retroactive gating, per 2026-09-07 call).
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

    // "Stalls for X" reads oddly on a hay & shavings order that has no stall
    // or RV items — use a neutral "Order for X" label for those instead.
    const items = Array.isArray(booking.items) ? booking.items : [];
    const isStalling = items.some((it: any) => it.type === "stall" || it.type === "rv");
    const label =
      `${project.project_name || "Show"} — ${isStalling ? "Stalls" : "Order"} for ` +
      `${booking.exhibitorName || "exhibitor"}`;

    // Who covers Stripe's card-processing fee: the show's payout (default,
    // matches every show's behavior before this setting existed) or the
    // customer, charged extra on top at checkout.
    const processingFeeMode = project.project_data?.stallingService?.processingFeeMode || "show";
    const chargeCents =
      connectedAccountId && processingFeeMode === "customer"
        ? grossUpForCustomerFee(amountCents)
        : amountCents;

    const params: Record<string, string> = {
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": label,
      "line_items[0][price_data][unit_amount]": String(chargeCents),
      "line_items[0][quantity]": "1",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      "metadata[type]": "stall_booking",
      "metadata[showId]": showId,
      "metadata[bookingId]": bookingId,
    };

    const email = customerEmail || booking.email;
    if (email) params["customer_email"] = email;

    // Destination charge: platform still collects the payment, then Stripe
    // automatically moves (amount − fee) to the show manager's connected
    // account. The exhibitor never sees any of this — same checkout page either way.
    // application_fee_amount is always 5% of the ORIGINAL due amount (not the
    // grossed-up charge), so the show's net payout is the same 95% of what's
    // actually owed either way — only who fronts Stripe's own cut changes.
    if (connectedAccountId) {
      params["payment_intent_data[application_fee_amount]"] = String(
        Math.round(amountCents * PLATFORM_COMMISSION_RATE)
      );
      params["payment_intent_data[transfer_data][destination]"] = connectedAccountId;
    }

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
