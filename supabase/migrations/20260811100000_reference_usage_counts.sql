-- Tell an admin what a discipline / division / level / association is being used
-- by, before they delete it.
--
-- These four tables are the shared building blocks every customer's show is made
-- from, but shows keep their copy of the id INSIDE project_data, not as a
-- database link. So Postgres cannot refuse the delete, nothing errors, and the
-- show is simply left pointing at something that no longer exists — a blank
-- discipline in the builder, an untitled section in the book PDF, patterns that
-- vanish from a division. Nothing connects the symptom back to the deletion, and
-- there is no undo.
--
-- These functions only COUNT. The delete still goes ahead if the admin confirms;
-- they just get to see what they are about to affect.

-- Count rows in one table whose column matches a value, skipping tables that do
-- not exist in this database. Identifiers go through %I, the value through USING,
-- so nothing here is string-concatenated into SQL.
CREATE OR REPLACE FUNCTION public.count_rows_referencing(
    p_table  text,
    p_column text,
    p_value  text
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_n bigint;
BEGIN
    IF p_value IS NULL OR p_value = '' THEN
        RETURN 0;
    END IF;
    IF to_regclass('public.' || quote_ident(p_table)) IS NULL THEN
        RETURN 0;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text = $1', p_table, p_column)
       INTO v_n
      USING p_value;

    RETURN COALESCE(v_n, 0);
EXCEPTION WHEN undefined_column THEN
    -- The table exists but not that column (older database) — nothing to report.
    RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.count_rows_referencing(text, text, text) FROM PUBLIC;

-- How many shows mention this id anywhere in their data.
--
-- A containment test on the text of project_data, because the id can sit in any
-- of several places (disciplines[], patternSelections keys, division lists) and
-- the shape differs between the two builders. A rare false positive here is the
-- safe direction to be wrong in: it warns about one show too many, never one too
-- few.
CREATE OR REPLACE FUNCTION public.count_shows_referencing(p_id text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)
    FROM public.projects p
    WHERE p_id IS NOT NULL
      AND p_id <> ''
      AND p.project_data::text LIKE '%' || p_id || '%';
$$;

REVOKE ALL ON FUNCTION public.count_shows_referencing(text) FROM PUBLIC;

-- What is using one piece of reference data.
--
-- Returns [{ "label": "shows", "count": 3 }, …] with zero counts dropped, ready
-- for the confirmation dialog to list. p_kind is 'discipline', 'division',
-- 'division_level' or 'association'; p_name is the display name, needed because
-- some older tables store the name rather than the id.
CREATE OR REPLACE FUNCTION public.reference_usage(
    p_kind text,
    p_id   text,
    p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_out jsonb := '[]'::jsonb;
BEGIN
    IF p_id IS NULL OR p_id = '' THEN
        RETURN v_out;
    END IF;

    IF p_kind = 'discipline' THEN
        v_out := jsonb_build_array(
            jsonb_build_object('label', 'shows',            'count', public.count_shows_referencing(p_id)),
            jsonb_build_object('label', 'patterns',         'count', public.count_rows_referencing('tbl_patterns', 'discipline', p_name)),
            jsonb_build_object('label', 'class templates',  'count', public.count_rows_referencing('class_templates', 'discipline_id', p_id)),
            jsonb_build_object('label', 'equipment rules',  'count', public.count_rows_referencing('discipline_equipment', 'discipline_id', p_id)),
            jsonb_build_object('label', 'judge favourites', 'count', public.count_rows_referencing('judge_favorites', 'discipline_id', p_id)),
            jsonb_build_object('label', 'distribution plans','count', public.count_rows_referencing('distribution_plan', 'discipline_id', p_id)),
            jsonb_build_object('label', 'association links','count', public.count_rows_referencing('discipline_associations', 'discipline_id', p_id))
        );

    ELSIF p_kind = 'division' THEN
        v_out := jsonb_build_array(
            jsonb_build_object('label', 'shows',    'count', public.count_shows_referencing(p_id)),
            jsonb_build_object('label', 'levels',   'count', public.count_rows_referencing('division_levels', 'division_id', p_id)),
            jsonb_build_object('label', 'patterns', 'count', public.count_rows_referencing('tbl_patterns', 'division', p_name))
        );

    ELSIF p_kind = 'division_level' THEN
        v_out := jsonb_build_array(
            jsonb_build_object('label', 'shows',    'count', public.count_shows_referencing(p_id)),
            jsonb_build_object('label', 'patterns', 'count', public.count_rows_referencing('tbl_patterns', 'division_level', p_name))
        );

    ELSIF p_kind = 'association' THEN
        v_out := jsonb_build_array(
            jsonb_build_object('label', 'shows',       'count', public.count_shows_referencing(p_id)),
            jsonb_build_object('label', 'disciplines', 'count', public.count_rows_referencing('disciplines', 'association_id', p_id)),
            jsonb_build_object('label', 'divisions',   'count', public.count_rows_referencing('divisions', 'association_id', p_id)),
            jsonb_build_object('label', 'classes',     'count', public.count_rows_referencing('classes', 'association_id', p_id)),
            jsonb_build_object('label', 'patterns',    'count', public.count_rows_referencing('pattern_associations', 'association_id', p_id)),
            jsonb_build_object('label', 'score sheets','count', public.count_rows_referencing('ep_scoresheet_templates', 'association_id', p_id)),
            jsonb_build_object('label', 'assets',      'count', public.count_rows_referencing('association_assets', 'association_id', p_id))
        );
    END IF;

    -- Drop the zeros so the dialog only lists what actually exists.
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
      INTO v_out
      FROM jsonb_array_elements(v_out) e
     WHERE (e->>'count')::bigint > 0;

    RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reference_usage(text, text, text) TO authenticated;
