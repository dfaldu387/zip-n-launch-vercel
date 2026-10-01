-- Fix compute_booking_stall_total (20260910120000): it paired an assigned
-- stall with a purchased unit by LIST POSITION (stall i <-> unit i, both in a
-- stable but otherwise arbitrary order) instead of by barn. On a booking
-- spanning two barns that was only PARTLY assigned, this could bill the
-- already-placed barn TWICE while never billing the barn that's still
-- unassigned — the same bug already fixed in src/lib/bookingPricing.js
-- (buildStallRows) and ported into HousingGroundsManagerPage.jsx's Analytics
-- math, but missed here and in the two Deno edge functions that charge
-- Stripe (stalls-create-invoice, stalls-create-checkout — fixed in the same
-- deploy as this migration).
--
-- This function is what get_public_booking() shows an exhibitor as their
-- live balance, and what record_stall_booking_payment() uses to decide
-- paid/partial when the Stripe webhook records a payment — so the bug could
-- make the public booking page and the webhook's own bookkeeping both wrong
-- for a partly-assigned multi-barn booking, independent of what Stripe
-- actually charged (that side was the two edge functions' own copy of the
-- same bug, fixed separately).
--
-- Fix: give each assigned stall to the purchased unit for ITS OWN barn
-- first (two passes — own-barn match, then whatever's left fills any
-- still-open unit, in order) — same rule as pairStallUnits() in
-- bookingPricing.js. The deficit/fallback section (for units nothing is
-- assigned to yet) is now counted per (refId, feeType) instead of one
-- shared counter consumed in item-declaration order, so a line whose stalls
-- are already placed is never billed a second time just because a
-- DIFFERENT line on the same order is still short.
--
-- Only this one function changes — get_public_booking() and
-- record_stall_booking_payment() already call it correctly and need no edits.

CREATE OR REPLACE FUNCTION public.compute_booking_stall_total(
    p_items         jsonb,
    p_project_data  jsonb,
    p_booking_id    text,
    p_default_nights numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_units          jsonb := '[]'::jsonb;
    v_item           jsonb;
    v_qty            int;
    v_item_nights    numeric;
    v_num_units      int;
    v_used           jsonb := '[]'::jsonb;
    v_used_count     int;
    v_moved          jsonb := '[]'::jsonb;
    v_stall          jsonb;
    v_found_idx      int;
    v_i              int;
    v_assigned_total numeric := 0;
    v_fallback_total numeric := 0;
BEGIN
    IF p_items IS NULL THEN
        RETURN 0;
    END IF;

    -- Unroll every 'stall' item into one unit per stall ORDERED, each
    -- carrying that item's own refId/feeType/nights/unitPrice. 'stallBarnId'
    -- null means this unit has no physical stall paired with it yet.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        IF v_item->>'type' = 'stall' THEN
            v_qty := COALESCE(NULLIF(v_item->>'qty', '')::int, 0);
            v_item_nights := COALESCE(NULLIF(v_item->>'nights', '')::numeric, p_default_nights);
            FOR i IN 1..GREATEST(v_qty, 0) LOOP
                v_units := v_units || jsonb_build_object(
                    'refId', v_item->>'refId',
                    'feeType', v_item->>'feeType',
                    'nights', v_item_nights,
                    'unitPrice', COALESCE(NULLIF(v_item->>'unitPrice', '')::numeric, 0),
                    'stallBarnId', NULL,
                    'stallPricePerNight', NULL
                );
            END LOOP;
        END IF;
    END LOOP;
    v_num_units := jsonb_array_length(v_units);

    -- Stalls actually physically assigned to this booking (any barn), capped
    -- to the total ordered, in a stable order so pairing is deterministic.
    IF v_num_units > 0 THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object('barnId', barn_id, 'pricePerNight', price_per_night)), '[]'::jsonb)
          INTO v_used
          FROM (
              SELECT barn->>'id' AS barn_id,
                     COALESCE(NULLIF(barn->>'pricePerNight', '')::numeric, 0) AS price_per_night
                FROM jsonb_array_elements(COALESCE(p_project_data->'stallingService'->'barns', '[]'::jsonb)) barn,
                     jsonb_array_elements(COALESCE(barn->'stalls', '[]'::jsonb)) stall
               WHERE stall->>'bookingId' = p_booking_id
               ORDER BY barn->>'name', stall->>'number'
               LIMIT v_num_units
          ) s;
    END IF;
    v_used_count := jsonb_array_length(v_used);

    -- Pass 1: a stall sitting in the barn a unit was ordered for fills THAT
    -- unit first. Anything that doesn't match any still-open unit's barn is
    -- set aside ("moved") for pass 2.
    FOR v_i IN 0..v_used_count - 1 LOOP
        v_stall := v_used->v_i;
        SELECT (idx - 1) INTO v_found_idx
          FROM jsonb_array_elements(v_units) WITH ORDINALITY AS t(elem, idx)
         WHERE elem->>'stallBarnId' IS NULL
           AND elem->>'refId' = v_stall->>'barnId'
         ORDER BY idx
         LIMIT 1;
        IF v_found_idx IS NOT NULL THEN
            v_units := jsonb_set(v_units, ARRAY[v_found_idx::text, 'stallBarnId'], v_stall->'barnId');
            v_units := jsonb_set(v_units, ARRAY[v_found_idx::text, 'stallPricePerNight'], v_stall->'pricePerNight');
        ELSE
            v_moved := v_moved || v_stall;
        END IF;
    END LOOP;

    -- Pass 2: a stall that moved to a different barn than any unit ordered
    -- takes whatever units are still open, in order.
    FOR v_i IN 0..jsonb_array_length(v_moved) - 1 LOOP
        v_stall := v_moved->v_i;
        SELECT (idx - 1) INTO v_found_idx
          FROM jsonb_array_elements(v_units) WITH ORDINALITY AS t(elem, idx)
         WHERE elem->>'stallBarnId' IS NULL
         ORDER BY idx
         LIMIT 1;
        IF v_found_idx IS NOT NULL THEN
            v_units := jsonb_set(v_units, ARRAY[v_found_idx::text, 'stallBarnId'], v_stall->'barnId');
            v_units := jsonb_set(v_units, ARRAY[v_found_idx::text, 'stallPricePerNight'], v_stall->'pricePerNight');
        END IF;
    END LOOP;

    -- Bill each (assigned barn, feeType) group at the assigned barn's
    -- CURRENT rate for exactly that fee type — never combining a
    -- Flat-bought stall with a Nightly-bought one just because they landed
    -- in the same barn.
    SELECT COALESCE(SUM(
        CASE
            WHEN g.fee_type = 'flat'      THEN g.cnt * public.barn_flat_rate(g.barn_id, p_project_data->'stallingService'->'extraStallFees')
            WHEN g.fee_type = 'per_night' THEN g.cnt * g.barn_nights * g.nightly_rate
            ELSE                             g.cnt * (g.barn_nights * g.nightly_rate + public.barn_flat_rate(g.barn_id, p_project_data->'stallingService'->'extraStallFees'))
        END
    ), 0)
      INTO v_assigned_total
      FROM (
          SELECT elem->>'stallBarnId' AS barn_id,
                 COALESCE(elem->>'feeType', '') AS fee_type,
                 count(*) AS cnt,
                 max(COALESCE(NULLIF(elem->>'stallPricePerNight', '')::numeric, 0)) AS nightly_rate,
                 max(COALESCE(NULLIF(elem->>'nights', '')::numeric, p_default_nights)) AS barn_nights
            FROM jsonb_array_elements(v_units) elem
           WHERE elem->>'stallBarnId' IS NOT NULL
           GROUP BY elem->>'stallBarnId', COALESCE(elem->>'feeType', '')
      ) g;

    -- Whatever isn't physically assigned yet: priced from each line's own
    -- originally-ordered barn (current flat rate if it has one, else the
    -- unitPrice frozen at booking time) — counted per (refId, feeType), so a
    -- line whose stalls are already placed is never billed a second time.
    SELECT COALESCE(SUM(
        CASE
            WHEN g.fee_type = 'flat'      THEN g.cnt * public.barn_flat_rate(g.ref_id, p_project_data->'stallingService'->'extraStallFees')
            WHEN g.fee_type = 'per_night' THEN g.cnt * g.item_nights * g.unit_price
            ELSE                             g.cnt * (g.item_nights * g.unit_price + public.barn_flat_rate(g.ref_id, p_project_data->'stallingService'->'extraStallFees'))
        END
    ), 0)
      INTO v_fallback_total
      FROM (
          SELECT elem->>'refId' AS ref_id,
                 COALESCE(elem->>'feeType', '') AS fee_type,
                 count(*) AS cnt,
                 max(COALESCE(NULLIF(elem->>'nights', '')::numeric, p_default_nights)) AS item_nights,
                 max(COALESCE(NULLIF(elem->>'unitPrice', '')::numeric, 0)) AS unit_price
            FROM jsonb_array_elements(v_units) elem
           WHERE elem->>'stallBarnId' IS NULL
           GROUP BY elem->>'refId', COALESCE(elem->>'feeType', '')
      ) g;

    RETURN v_assigned_total + v_fallback_total;
END;
$$;
