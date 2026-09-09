import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Refreshes the signed-in show manager's payout status straight from Stripe.
//
// account.updated (handled in stripe-webhook) normally keeps
// profiles.stripe_connect_payouts_enabled in sync, but that event can lag by
// a few seconds. The frontend calls this right after the user returns from
// Stripe's hosted onboarding so "Set up payouts" doesn't look stuck.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

async function stripeGet(endpoint: string): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return response.json();
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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

    if (!profile?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ payoutsEnabled: false, accountId: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const account = await stripeGet(`accounts/${profile.stripe_connect_account_id}`);
    if (account.error) throw new Error(account.error.message);

    const payoutsEnabled = !!(account.charges_enabled && account.payouts_enabled);

    await admin
      .from("profiles")
      .update({ stripe_connect_payouts_enabled: payoutsEnabled })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({ payoutsEnabled, accountId: profile.stripe_connect_account_id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("stripe-connect-status error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
