-- Housing & Grounds Manager Terms & Conditions: recorded once per user, so the
-- approval pop-up is shown only the first time. The version lets us ask again
-- later if the terms text changes (compare against HOUSING_TERMS_VERSION in
-- src/lib/housingTerms.js).
--
-- Users already update their own profile row, so no new policy is needed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS housing_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS housing_terms_version text;
