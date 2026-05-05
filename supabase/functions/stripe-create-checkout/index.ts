import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface CheckoutRequest {
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user via JWT
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const {
      priceId,
      mode,
      successUrl,
      cancelUrl,
      metadata,
    }: CheckoutRequest = await req.json();

    // Admin client for writing to profiles
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get or create Stripe customer
    const { data: profile } = await adminClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let stripeCustomerId = profile?.stripe_customer_id;

    // Verify existing customer is valid in current Stripe mode, create new if not
    if (stripeCustomerId) {
      const existing = await fetch(`https://api.stripe.com/v1/customers/${stripeCustomerId}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
      }).then(r => r.json());

      if (existing.error) {
        console.log("Existing Stripe customer invalid, creating new one:", existing.error.message);
        stripeCustomerId = null;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripePost("customers", {
        email: user.email || "",
        "metadata[supabase_user_id]": user.id,
      });

      if (customer.error) {
        throw new Error(customer.error.message);
      }

      stripeCustomerId = customer.id;

      await adminClient
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id);
    }

    // Build checkout session params
    const sessionParams: Record<string, string> = {
      customer: stripeCustomerId,
      mode,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      "metadata[supabase_user_id]": user.id,
    };

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        sessionParams[`metadata[${key}]`] = value;
      }
    }

    if (mode === "subscription") {
      sessionParams["allow_promotion_codes"] = "true";
    }

    const session = await stripePost("checkout/sessions", sessionParams);

    if (session.error) {
      throw new Error(session.error.message);
    }

    console.log("Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
