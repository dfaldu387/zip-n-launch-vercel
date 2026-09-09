import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Starts (or resumes) Stripe Connect onboarding for the signed-in show
// manager, so their bookings can be split platform-fee / payout automatically
// (meeting 2026-09-07). One Express connected account per user, reused across
// every show they run — created lazily on first call, reused after.
//
// Returns a fresh Stripe-hosted onboarding URL every time: an Account Link is
// single-use and expires, so the frontend must call this again rather than
// caching the url from a previous call.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

async function stripePost(endpoint: string, params: Record<string, string>): Promise<any> {
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

interface OnboardingRequest {
  returnUrl: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "You must be signed in to set up payouts." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { returnUrl }: OnboardingRequest = await req.json();
    if (!returnUrl) throw new Error("Missing returnUrl");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .single();
    if (profileError) throw new Error(profileError.message);

    let accountId = profile?.stripe_connect_account_id;

    if (!accountId) {
      const account = await stripePost("accounts", {
        type: "express",
        email: user.email || "",
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "metadata[supabase_user_id]": user.id,
      });
      if (account.error) throw new Error(account.error.message);

      accountId = account.id;
      const { error: saveError } = await admin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);
      if (saveError) throw new Error(saveError.message);
    }

    const link = await stripePost("account_links", {
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    if (link.error) throw new Error(link.error.message);

    return new Response(JSON.stringify({ url: link.url, accountId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("stripe-connect-onboarding error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
