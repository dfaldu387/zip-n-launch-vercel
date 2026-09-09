-- Stripe Connect payout account per show manager (one account reused across
-- every show they run — see meeting 2026-09-07: commission split via Stripe
-- Connect, 5% platform fee, mandatory before a show can publish).
--
-- stripe_connect_account_id: the Express connected account id once onboarding
--   has started (created lazily by stripe-connect-onboarding).
-- stripe_connect_payouts_enabled: true only once Stripe confirms the account
--   can both accept charges and pay out (kept in sync by the account.updated
--   webhook event in stripe-webhook) — this, not "account exists", is what
--   gates publishing a show.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_stripe_connect_account_id_idx
  ON public.profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
