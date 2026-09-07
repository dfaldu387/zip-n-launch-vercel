-- barn_flat_rate() (added in 20260828120000) summed EVERY flat fee scoped to
-- a barn, including an "All Barns" facility-wide fee, even when that barn
-- ALSO carries a fee scoped to it specifically. That breaks the exclusivity
-- rule the rest of the app already follows (flatRateForBarn/barnHasOwnFee in
-- src/lib/extraStallFees.js, and the identical rule for RV areas): a barn
-- with its own fee is priced from that fee ALONE — "All Barns" is only the
-- default for barns that don't have one, never an add-on stacked on top.
--
-- Caught live: a show with a $100 "Circuit Fee" (All Barns, flat) and a $40
-- "Office Fee" (Barn A only, flat) showed the exhibitor $40 for Barn A's flat
-- line at checkout (correct, client-side), but get_public_booking() and
-- record_stall_booking_payment() — which is what Stripe actually charges for
-- a "Bill at booking" show — both computed $140, a real $100 overcharge.
--
-- Fix: barn_flat_rate() now checks whether the barn has ANY fee scoped
-- specifically to it (any unit type, mirroring barnHasOwnFee) before summing
-- flat fees, and skips "All Barns" flat fees when it does.

CREATE OR REPLACE FUNCTION public.barn_flat_rate(p_barn_id text, p_extra_stall_fees jsonb)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
    WITH has_own AS (
        SELECT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(p_extra_stall_fees, '[]'::jsonb)) fee
            WHERE (
                    (jsonb_typeof(fee->'appliesTo') = 'string' AND fee->>'appliesTo' = p_barn_id)
                    OR (jsonb_typeof(fee->'appliesTo') = 'array' AND fee->'appliesTo' ? p_barn_id)
                  )
        ) AS exclusive
    )
    SELECT COALESCE(SUM(COALESCE(NULLIF(fee->>'amount', '')::numeric, 0)), 0)
    FROM jsonb_array_elements(COALESCE(p_extra_stall_fees, '[]'::jsonb)) fee, has_own
    WHERE COALESCE(fee->>'unitType', 'per_stall') = 'flat'
      AND COALESCE(NULLIF(fee->>'amount', '')::numeric, 0) > 0
      AND (
            -- Scoped to this barn specifically (legacy single-string or an array of ids).
            (jsonb_typeof(fee->'appliesTo') = 'string' AND fee->>'appliesTo' = p_barn_id)
            OR (jsonb_typeof(fee->'appliesTo') = 'array' AND fee->'appliesTo' ? p_barn_id)
            -- Facility-wide "All Barns" fee — only counts when the barn has no fee of its own.
            OR (
                  NOT has_own.exclusive
                  AND (
                        NOT (fee ? 'appliesTo')
                        OR jsonb_typeof(fee->'appliesTo') = 'null'
                        OR (jsonb_typeof(fee->'appliesTo') = 'string' AND COALESCE(fee->>'appliesTo', '') IN ('', 'all'))
                        OR (jsonb_typeof(fee->'appliesTo') = 'array' AND jsonb_array_length(fee->'appliesTo') = 0)
                        OR (jsonb_typeof(fee->'appliesTo') = 'array' AND fee->'appliesTo' ? 'all')
                      )
                )
      );
$$;
