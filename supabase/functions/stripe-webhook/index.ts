import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const signatures = parts
      .filter((p) => p.startsWith("v1="))
      .map((p) => p.split("=")[1]);

    if (!timestamp || signatures.length === 0) {
      console.error("Signature parsing failed - timestamp:", timestamp, "sigs:", signatures.length);
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload)
    );
    const expectedSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const match = signatures.some((s) => s === expectedSig);
    if (!match) {
      console.error("Signature mismatch. Expected:", expectedSig.substring(0, 20) + "...");
    }
    return match;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

async function stripeGet(endpoint: string): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return response.json();
}

// Add a payment to a housing booking and flip its paymentStatus. Additive, so a
// later top-up (pay-the-difference) adds on. Shared by both the checkout (pay
// now) and invoice (pay later) flows.
//
// The read-modify-write used to happen here, on the whole project_data blob, with
// nothing holding the row in between. A save from the Housing page landing in the
// same moment overwrote it and the payment vanished — exhibitor charged, office
// still showing "unpaid". record_stall_booking_payment() does the same work
// behind SELECT ... FOR UPDATE, so the two writers queue instead of racing. The
// live-total rule (assigned stalls × nights × current price) lives there now.
async function markStallBookingPaid(
  adminClient: any,
  showId: string,
  bookingId: string,
  paidDollars: number
): Promise<void> {
  if (!showId || !bookingId) return;

  const { data, error } = await adminClient.rpc("record_stall_booking_payment", {
    p_show_id: showId,
    p_booking_id: bookingId,
    p_paid: paidDollars,
  });

  // Thrown, not swallowed: the caller turns it into a 500 so Stripe re-sends the
  // event. Logging and returning 200 would lose the payment for good.
  if (error) {
    throw new Error(
      `record_stall_booking_payment failed for booking ${bookingId}: ${error.message}`
    );
  }
  console.log(`Booking ${bookingId} payment recorded (+$${paidDollars})`, data);
}

serve(async (req: Request): Promise<Response> => {
  // Log all headers for debugging
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = key.toLowerCase().includes("secret") ? "[REDACTED]" : value;
  });
  console.log("Webhook request headers:", JSON.stringify(headers));

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  console.log("Webhook body length:", body.length);

  // Try both header casing variants
  const signature =
    req.headers.get("stripe-signature") ||
    req.headers.get("Stripe-Signature");

  if (!signature) {
    console.error("No stripe-signature header found. Available headers:", Object.keys(headers).join(", "));
    return new Response(JSON.stringify({ error: "Missing signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("Signature header found, length:", signature.length);
  console.log("Webhook secret configured:", STRIPE_WEBHOOK_SECRET ? "yes" : "NO");

  const isValid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error("Invalid webhook signature - returning 400");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = JSON.parse(body);
  console.log("Stripe webhook event:", event.type, "id:", event.id);

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Process each Stripe event once ──────────────────────────────────────────
  // Stripe re-sends an event whenever it does not get a clean reply, and can also
  // deliver the same one more than once by design. Recording a payment is
  // additive, so a repeat used to add the money a second time: a $300 payment
  // could end up stored as $600. The insert below is the guard — event_id is the
  // primary key, so the second attempt fails and we stop here.
  if (event.id) {
    const { error: seenError } = await adminClient
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type });

    if (seenError) {
      // 23505 = unique violation: this event has already been handled.
      if (seenError.code === "23505") {
        console.log("Duplicate Stripe event ignored:", event.id);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Any other problem (for example the table is missing) must not silently
      // drop a real payment — carry on and let the event be processed.
      console.error("Could not record webhook event id:", seenError);
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // ── Housing / stall booking payment (guest checkout, no supabase user) ──
        if (session.metadata?.type === "stall_booking") {
          const paidDollars = (session.amount_total || 0) / 100;
          console.log(`stall_booking checkout paid: +$${paidDollars}`);
          await markStallBookingPaid(
            adminClient,
            session.metadata.showId,
            session.metadata.bookingId,
            paidDollars
          );
          break;
        }

        const userId = session.metadata?.supabase_user_id;

        console.log("checkout.session.completed - userId:", userId, "mode:", session.mode, "subscription:", session.subscription);

        if (!userId) {
          console.error("No supabase_user_id in session metadata");
          break;
        }

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripeGet(
            `subscriptions/${session.subscription}`
          );
          console.log("Fetched subscription:", subscription.id, "status:", subscription.status);

          if (subscription.error) {
            console.error("Stripe API error fetching subscription:", subscription.error);
            break;
          }

          const tier = session.metadata?.tier || "standard";

          // Period dates are on subscription items in newer Stripe API versions
          const subItem = subscription.items?.data?.[0];
          const periodStart = subItem?.current_period_start || subscription.current_period_start;
          const periodEnd = subItem?.current_period_end || subscription.current_period_end;

          const { error: subError } = await adminClient.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: session.customer,
              stripe_price_id: subItem?.price?.id || "unknown",
              status: subscription.status,
              tier,
              current_period_start: periodStart
                ? new Date(periodStart * 1000).toISOString()
                : null,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "stripe_subscription_id" }
          );

          if (subError) {
            console.error("Error upserting subscription:", subError);
          }

          const { error: profError } = await adminClient
            .from("profiles")
            .update({
              subscription_status: subscription.status,
              subscription_tier: tier,
              subscription_current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("id", userId);

          if (profError) {
            console.error("Error updating profile:", profError);
          } else {
            console.log(`Profile updated for user ${userId} - tier: ${tier}, status: ${subscription.status}`);
          }
        }

        if (session.mode === "payment") {
          const { error: purchaseError } = await adminClient.from("purchases").insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            product_type: session.metadata?.product_type || "other",
            amount_cents: session.amount_total,
            currency: session.currency,
            status: "completed",
            metadata: session.metadata || {},
          });

          if (purchaseError) {
            console.error("Error inserting purchase:", purchaseError);
          } else {
            console.log(`Purchase recorded for user ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          const isActive = ["active", "trialing"].includes(subscription.status);
          const tier = subscription.metadata?.tier || "standard";

          // --- Plan change tracking ---
          const newSubItem = subscription.items?.data?.[0];
          const newPriceId = newSubItem?.price?.id || "unknown";

          const { data: existingSub } = await adminClient
            .from("subscriptions")
            .select("tier, stripe_price_id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          if (existingSub && existingSub.tier !== tier) {
            await adminClient.from("plan_changes").insert({
              user_id: profile.id,
              old_tier: existingSub.tier,
              new_tier: tier,
              old_price_id: existingSub.stripe_price_id,
              new_price_id: newPriceId,
              changed_at: new Date().toISOString(),
            });
            console.log(`Plan change logged for user ${profile.id}: ${existingSub.tier} -> ${tier}`);
          }
          // --- End plan change tracking ---

          // Period dates are on subscription items in newer Stripe API versions
          const subItem = subscription.items?.data?.[0];
          const periodStart = subItem?.current_period_start || subscription.current_period_start;
          const periodEnd = subItem?.current_period_end || subscription.current_period_end;

          await adminClient.from("subscriptions").upsert(
            {
              user_id: profile.id,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              stripe_price_id: subItem?.price?.id || "unknown",
              status: subscription.status,
              tier,
              current_period_start: periodStart
                ? new Date(periodStart * 1000).toISOString()
                : null,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
              cancel_at_period_end: subscription.cancel_at_period_end,
              canceled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "stripe_subscription_id" }
          );

          await adminClient
            .from("profiles")
            .update({
              subscription_status: subscription.status,
              subscription_tier: isActive ? tier : null,
              subscription_current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("id", profile.id);

          console.log(`Subscription ${event.type} for user ${profile.id}`);
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        // Only our housing invoices carry this metadata; subscription invoices don't.
        if (invoice.metadata?.type === "stall_booking") {
          const paidDollars = (invoice.amount_paid || 0) / 100;
          console.log(`stall_booking invoice paid: +$${paidDollars}`);
          await markStallBookingPaid(
            adminClient,
            invoice.metadata.showId,
            invoice.metadata.bookingId,
            paidDollars
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: profile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await adminClient
            .from("profiles")
            .update({ subscription_status: "past_due" })
            .eq("id", profile.id);

          console.log(`Payment failed for user ${profile.id}`);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook processing error:", error.message, error.stack);

    // The event id was recorded before processing, so leaving it there would make
    // Stripe's retry look like a duplicate and the payment would never be
    // recorded. Take it back out so the re-send is allowed to do the work.
    if (event.id) {
      const { error: undoError } = await adminClient
        .from("stripe_webhook_events")
        .delete()
        .eq("event_id", event.id);
      if (undoError) {
        console.error("Could not release webhook event id for retry:", undoError);
      }
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
