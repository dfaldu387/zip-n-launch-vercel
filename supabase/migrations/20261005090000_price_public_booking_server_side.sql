-- append_public_booking used to trust the browser for every price. Stall lines
-- are re-priced live at checkout, but RV, support-space, supply and fee lines
-- were charged at whatever "amount" the request carried — so a hand-made request
-- with an RV price of $0 was charged $0, and there was no stock check on the
-- server (two people could buy the last bag).
--
-- Now every line is priced here, from the show's own saved rates, inside the
-- same row lock that appends the booking:
--   stall       qty x flat rate  |  qty x barn price/night x nights
--   rv          qty x flat rate  |  qty x area price/night x nights   (extraRvFees)
--   support     qty x price/night x nights
--   supply      qty x price, and refused if it would pass the supply's stock
--   stall_fee   rate checked against the show's fee list (amount never below qty x rate)
--   fee         display-only estimate from the browser, dropped (checkout adds its own)
-- Any other line type, or a line pointing at something the show doesn't have, is
-- refused. The formulas mirror buildBarnStallOptionItems() / the booking page.
-- booking.nights is rebuilt from the arrival / departure dates.
--
-- Builds on 20261003090000 (server owns status / payment fields).

CREATE OR REPLACE FUNCTION public.append_public_booking(
    p_project_id uuid,
    p_booking jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking_id uuid;
    v_current_data jsonb;
    v_svc jsonb;
    v_clean jsonb;
    v_enriched jsonb;
    v_is_supply boolean;

    v_nights int;
    v_new_items jsonb := '[]'::jsonb;
    v_total numeric := 0;

    v_it jsonb;
    v_obj jsonb;
    v_type text;
    v_ref text;
    v_qty numeric;
    v_client numeric;
    v_item_nights int;
    v_unit numeric;
    v_amt numeric;
    v_fee_type text;
    v_stock numeric;
    v_sold numeric;
BEGIN
    IF p_project_id IS NULL THEN
        RAISE EXCEPTION 'project_id is required' USING ERRCODE = '22023';
    END IF;
    IF p_booking IS NULL OR jsonb_typeof(p_booking) <> 'object' THEN
        RAISE EXCEPTION 'booking must be a JSON object' USING ERRCODE = '22023';
    END IF;

    v_booking_id := COALESCE(NULLIF(p_booking->>'id','')::uuid, gen_random_uuid());
    v_is_supply  := p_booking->>'orderType' = 'live-supply';

    -- Fields only the office or the Stripe webhook may set.
    v_clean := p_booking
        - 'paidAmount' - 'paidAt'
        - 'assignedStalls' - 'assignedRvSpots'
        - 'fulfillmentStatus';

    SELECT project_data INTO v_current_data
    FROM public.projects
    WHERE id = p_project_id
    FOR UPDATE;

    IF v_current_data IS NULL THEN
        RAISE EXCEPTION 'Show not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_current_data->'stallingService' IS NULL OR jsonb_typeof(v_current_data->'stallingService') <> 'object' THEN
        v_current_data := jsonb_set(v_current_data, '{stallingService}', '{}'::jsonb, true);
    END IF;
    IF v_current_data->'stallingService'->'bookings' IS NULL OR jsonb_typeof(v_current_data->'stallingService'->'bookings') <> 'array' THEN
        v_current_data := jsonb_set(v_current_data, '{stallingService,bookings}', '[]'::jsonb, true);
    END IF;
    v_svc := v_current_data->'stallingService';

    -- ── Nights: from the dates, never from the request ─────────────────────
    BEGIN
        IF COALESCE(v_clean->>'arrivalDate', '') <> '' AND COALESCE(v_clean->>'departureDate', '') <> '' THEN
            v_nights := GREATEST(1, ((v_clean->>'departureDate')::date - (v_clean->>'arrivalDate')::date));
        END IF;
    EXCEPTION WHEN others THEN
        v_nights := NULL;
    END;
    IF v_nights IS NULL THEN
        v_nights := GREATEST(1, COALESCE(NULLIF(v_clean->>'nights', '')::numeric, 1)::int);
    END IF;

    -- ── Price every line from the show's own rates ──────────────────────────
    IF jsonb_typeof(v_clean->'items') <> 'array' OR jsonb_array_length(v_clean->'items') = 0 THEN
        RAISE EXCEPTION 'Please select at least one item.' USING ERRCODE = '22023';
    END IF;

    FOR v_it IN SELECT value FROM jsonb_array_elements(v_clean->'items') LOOP
        v_type := v_it->>'type';
        v_ref  := COALESCE(v_it->>'refId', '');

        -- Display-only estimate; checkout applies the real processing fee.
        IF v_type = 'fee' THEN
            CONTINUE;
        END IF;

        v_qty := COALESCE(NULLIF(v_it->>'qty', '')::numeric, 0);
        IF v_qty < 1 OR v_qty <> trunc(v_qty) OR v_qty > 1000 THEN
            RAISE EXCEPTION 'Invalid quantity for %', COALESCE(v_it->>'name', 'an item') USING ERRCODE = '22023';
        END IF;
        v_client   := COALESCE(NULLIF(v_it->>'amount', '')::numeric, 0);
        v_fee_type := v_it->>'feeType';
        -- A per-barn night pick can only be shorter than the stay, never longer.
        v_item_nights := LEAST(
            v_nights,
            GREATEST(1, COALESCE(NULLIF(v_it->>'nights', '')::numeric, v_nights)::int)
        );

        IF v_type = 'stall' THEN
            SELECT x INTO v_obj FROM jsonb_array_elements(COALESCE(v_svc->'barns', '[]'::jsonb)) x
             WHERE x->>'id' = v_ref LIMIT 1;
            IF v_obj IS NULL THEN
                RAISE EXCEPTION 'The stall prices for this show changed. Please reload the page and try again.' USING ERRCODE = '22023';
            END IF;
            IF v_fee_type = 'flat' THEN
                v_unit := public.barn_flat_rate(v_ref, v_svc->'extraStallFees');
                v_amt  := v_qty * v_unit;
            ELSIF v_fee_type = 'per_night' THEN
                v_unit := COALESCE(NULLIF(v_obj->>'pricePerNight', '')::numeric, 0);
                v_amt  := v_qty * v_unit * v_item_nights;
            ELSE
                v_unit := COALESCE(NULLIF(v_obj->>'pricePerNight', '')::numeric, 0);
                v_amt  := v_qty * (v_unit * v_item_nights + public.barn_flat_rate(v_ref, v_svc->'extraStallFees'));
            END IF;

        ELSIF v_type = 'rv' THEN
            SELECT x INTO v_obj FROM jsonb_array_elements(COALESCE(v_svc->'rvAreas', '[]'::jsonb)) x
             WHERE x->>'id' = v_ref LIMIT 1;
            IF v_obj IS NULL THEN
                RAISE EXCEPTION 'The RV prices for this show changed. Please reload the page and try again.' USING ERRCODE = '22023';
            END IF;
            IF v_fee_type = 'flat' THEN
                v_unit := public.barn_flat_rate(v_ref, v_svc->'extraRvFees');
                v_amt  := v_qty * v_unit;
            ELSIF v_fee_type = 'per_night' THEN
                v_unit := COALESCE(NULLIF(v_obj->>'pricePerNight', '')::numeric, 0);
                v_amt  := v_qty * v_unit * v_item_nights;
            ELSE
                v_unit := COALESCE(NULLIF(v_obj->>'pricePerNight', '')::numeric, 0);
                v_amt  := v_qty * (v_unit * v_item_nights + public.barn_flat_rate(v_ref, v_svc->'extraRvFees'));
            END IF;

        ELSIF v_type = 'support' THEN
            SELECT x INTO v_obj FROM jsonb_array_elements(COALESCE(v_svc->'supportSpaces', '[]'::jsonb)) x
             WHERE x->>'id' = v_ref LIMIT 1;
            IF v_obj IS NULL THEN
                RAISE EXCEPTION 'The prices for this show changed. Please reload the page and try again.' USING ERRCODE = '22023';
            END IF;
            v_unit := COALESCE(NULLIF(v_obj->>'pricePerNight', '')::numeric, 0);
            v_amt  := v_qty * v_unit * v_nights;
            v_item_nights := v_nights;

        ELSIF v_type = 'supply' THEN
            SELECT x INTO v_obj FROM jsonb_array_elements(COALESCE(v_svc->'supplies', '[]'::jsonb)) x
             WHERE COALESCE(NULLIF(x->>'id', ''), x->>'name') = v_ref LIMIT 1;
            IF v_obj IS NULL THEN
                RAISE EXCEPTION 'That item is no longer available. Please reload the page and try again.' USING ERRCODE = '22023';
            END IF;
            v_unit := COALESCE(NULLIF(v_obj->>'price', '')::numeric, 0);
            v_amt  := v_qty * v_unit;

            -- Stock (0 = no limit). Counted under the row lock taken above, so two
            -- people ordering the last bag at once cannot both succeed.
            v_stock := COALESCE(NULLIF(v_obj->>'stockQty', '')::numeric, 0);
            IF v_stock > 0 THEN
                SELECT COALESCE(SUM(COALESCE(NULLIF(i->>'qty', '')::numeric, 0)), 0) INTO v_sold
                FROM jsonb_array_elements(COALESCE(v_svc->'bookings', '[]'::jsonb)) b,
                     jsonb_array_elements(COALESCE(b->'items', '[]'::jsonb)) i
                WHERE COALESCE(b->>'status', '') <> 'cancelled'
                  AND i->>'type' = 'supply'
                  AND i->>'refId' = v_ref;
                IF v_sold + v_qty > v_stock THEN
                    RAISE EXCEPTION 'Not enough % left in stock (% available).',
                        COALESCE(v_obj->>'name', 'of that item'), GREATEST(v_stock - v_sold, 0)
                        USING ERRCODE = '22023';
                END IF;
            END IF;

        ELSIF v_type = 'stall_fee' THEN
            SELECT x INTO v_obj FROM jsonb_array_elements(COALESCE(v_svc->'extraStallFees', '[]'::jsonb)) x
             WHERE x->>'id' = v_ref LIMIT 1;
            IF v_obj IS NULL THEN
                RAISE EXCEPTION 'The fees for this show changed. Please reload the page and try again.' USING ERRCODE = '22023';
            END IF;
            v_unit := COALESCE(NULLIF(v_obj->>'amount', '')::numeric, 0);
            -- The quantity depends on stall counts and horses; the rate is what must
            -- not be lowered, so the amount is never less than qty x the show's rate.
            v_amt  := GREATEST(v_client, v_qty * v_unit);

        ELSE
            RAISE EXCEPTION 'Unknown item type: %', COALESCE(v_type, '(none)') USING ERRCODE = '22023';
        END IF;

        v_amt := ROUND(v_amt, 2);
        v_total := v_total + v_amt;

        v_it := jsonb_set(v_it, '{amount}', to_jsonb(v_amt), true);
        v_it := jsonb_set(v_it, '{unitPrice}', to_jsonb(ROUND(v_unit, 2)), true);
        IF v_type IN ('stall', 'rv') AND v_fee_type IS DISTINCT FROM 'flat' THEN
            v_it := jsonb_set(v_it, '{nights}', to_jsonb(v_item_nights), true);
        END IF;
        v_new_items := v_new_items || jsonb_build_array(v_it);
    END LOOP;

    IF jsonb_array_length(v_new_items) = 0 THEN
        RAISE EXCEPTION 'Please select at least one item.' USING ERRCODE = '22023';
    END IF;

    v_enriched := v_clean || jsonb_build_object(
        'id', v_booking_id::text,
        'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source', CASE WHEN v_is_supply THEN 'live_supply' ELSE 'public_booking' END,
        'status', 'pending',
        'paymentStatus', 'unpaid',
        'items', v_new_items,
        'amount', ROUND(v_total, 2),
        'totalAmount', ROUND(v_total, 2)
    );
    IF v_is_supply THEN
        v_enriched := v_enriched || jsonb_build_object('fulfillmentStatus', 'new');
    ELSE
        v_enriched := v_enriched || jsonb_build_object('nights', v_nights);
    END IF;

    v_current_data := jsonb_set(
        v_current_data,
        '{stallingService,bookings}',
        (v_current_data->'stallingService'->'bookings') || jsonb_build_array(v_enriched),
        true
    );

    UPDATE public.projects
    SET project_data = v_current_data
    WHERE id = p_project_id;

    RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_public_booking(uuid, jsonb) TO anon, authenticated;
