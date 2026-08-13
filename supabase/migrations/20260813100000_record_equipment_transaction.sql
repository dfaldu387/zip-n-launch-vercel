-- Do the stock check and the write together, instead of in the browser.
--
-- useEquipmentCheckInOut.js read the on-hand figure from data already loaded in
-- the page, compared the typed quantity against it, and then inserted. Two crew
-- members checking the same item out at the same moment both passed that check
-- and both saved, so 30 poles could leave an arena that held 20 — with no error
-- shown to either of them. A page left open for an hour had the same effect on
-- its own.
--
-- The count never comes back. It surfaces weeks later in Reconciliation as
-- equipment "missing" that was never really there, and somebody spends an
-- afternoon looking for it.
--
-- SELECT ... FOR UPDATE on the item is the fix: the second request waits, then
-- counts the rows the first one just wrote.

CREATE OR REPLACE FUNCTION public.record_equipment_transaction(
    p_show_id       uuid,
    p_equipment_id  uuid,
    p_type          text,
    p_quantity      integer,
    p_arena_id      uuid DEFAULT NULL,
    p_from_arena_id uuid DEFAULT NULL,
    p_to_arena_id   uuid DEFAULT NULL,
    p_assigned_to   text DEFAULT NULL,
    p_crew_name     text DEFAULT NULL,
    p_notes         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item_owner uuid;
    v_show_owner uuid;
    v_owned      integer;
    v_deployed   integer;
    v_available  integer;
    v_on_hand    integer;
    v_src_arena  uuid;
    v_id         uuid;
BEGIN
    -- ── Cheap checks first ──────────────────────────────────────────────────
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'You must be signed in.');
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Quantity must be greater than zero.');
    END IF;

    IF p_type NOT IN ('check_in', 'check_out', 'transfer') THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Unknown transaction type.');
    END IF;

    IF p_type = 'check_out' AND COALESCE(p_assigned_to, '') = '' AND COALESCE(p_crew_name, '') = '' THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Please specify who this is assigned to.');
    END IF;

    IF p_type = 'transfer' AND (p_to_arena_id IS NULL OR p_from_arena_id IS NULL) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'A transfer needs both arenas.');
    END IF;

    IF p_type = 'transfer' AND p_from_arena_id = p_to_arena_id THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Cannot transfer to the same arena.');
    END IF;

    IF NOT public.can_manage_show(p_show_id::text) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'You do not have access to this show.');
    END IF;

    SELECT p.user_id INTO v_show_owner FROM public.projects p WHERE p.id = p_show_id;

    -- ── The lock ────────────────────────────────────────────────────────────
    -- Anyone else touching this item waits here until we are done.
    SELECT ei.user_id, COALESCE(ei.total_qty_owned, 0)
      INTO v_item_owner, v_owned
      FROM public.equipment_items ei
     WHERE ei.id = p_equipment_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Equipment item not found.');
    END IF;

    -- Staff assigned to a show may move its owner's equipment, but not equipment
    -- belonging to somebody else entirely.
    IF v_item_owner IS DISTINCT FROM v_show_owner THEN
        RETURN jsonb_build_object('ok', false, 'message', 'That equipment belongs to a different account.');
    END IF;

    -- ── Counts, read fresh under the lock ───────────────────────────────────
    IF p_type = 'check_in' THEN
        -- Warehouse stock. Scoped to this show, exactly as the page counts it
        -- today; whether it should count the owner's other shows too is a
        -- separate question and deliberately not changed here.
        SELECT COALESCE(sum(t.quantity), 0)
          INTO v_deployed
          FROM public.equipment_transactions t
         WHERE t.equipment_id = p_equipment_id
           AND t.show_id = p_show_id
           AND t.transaction_type = 'check_in';

        v_available := v_owned - v_deployed;

        IF p_quantity > v_available THEN
            RETURN jsonb_build_object(
                'ok', false,
                'message', format('Only %s available in the warehouse.', GREATEST(v_available, 0)),
                'available', GREATEST(v_available, 0));
        END IF;

    ELSE
        -- What the source arena is actually holding.
        v_src_arena := CASE WHEN p_type = 'transfer' THEN p_from_arena_id ELSE p_arena_id END;

        IF v_src_arena IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'message', 'No arena selected.');
        END IF;

        SELECT COALESCE(sum(
                   CASE
                       WHEN t.transaction_type = 'check_in'  AND t.arena_id      = v_src_arena THEN  t.quantity
                       WHEN t.transaction_type = 'check_out' AND t.arena_id      = v_src_arena THEN -t.quantity
                       WHEN t.transaction_type = 'transfer'  AND t.to_arena_id   = v_src_arena THEN  t.quantity
                       WHEN t.transaction_type = 'transfer'  AND t.from_arena_id = v_src_arena THEN -t.quantity
                       ELSE 0
                   END), 0)
          INTO v_on_hand
          FROM public.equipment_transactions t
         WHERE t.equipment_id = p_equipment_id
           AND t.show_id = p_show_id;

        IF p_quantity > v_on_hand THEN
            RETURN jsonb_build_object(
                'ok', false,
                'message', format('Only %s on hand at this arena.', GREATEST(v_on_hand, 0)),
                'onHand', GREATEST(v_on_hand, 0));
        END IF;
    END IF;

    -- ── Write ───────────────────────────────────────────────────────────────
    INSERT INTO public.equipment_transactions (
        user_id, show_id, equipment_id, transaction_type, quantity,
        arena_id, from_arena_id, to_arena_id, assigned_to, crew_name, notes
    ) VALUES (
        auth.uid(), p_show_id, p_equipment_id, p_type, p_quantity,
        CASE WHEN p_type = 'transfer' THEN NULL ELSE p_arena_id END,
        CASE WHEN p_type = 'transfer' THEN p_from_arena_id ELSE NULL END,
        CASE WHEN p_type = 'transfer' THEN p_to_arena_id   ELSE NULL END,
        NULLIF(p_assigned_to, ''), NULLIF(p_crew_name, ''), NULLIF(p_notes, '')
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_equipment_transaction(
    uuid, uuid, text, integer, uuid, uuid, uuid, text, text, text
) TO authenticated;
