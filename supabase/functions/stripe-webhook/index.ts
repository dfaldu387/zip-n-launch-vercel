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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
