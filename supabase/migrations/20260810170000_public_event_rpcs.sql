-- The last public pages that still read the projects table directly.
--
-- Home, /events, /event-detail, /event-results and the two score-sheet pages all
-- pull project_data with no login, which means an anonymous visitor receives
-- every exhibitor's booking (name, email, phone, notes, amounts), the staff list
-- and the show's billing — none of which any of those pages display.
--
-- Two functions cover all six:
--
--   list_public_events()      the home + events listings
--   get_public_project(id)    one project, with the private branches removed
--
-- get_public_project deliberately REDACTS rather than whitelists. These pages
-- read many different corners of project_data (event detail alone reaches into
-- stallingService.supplies, disciplines, patternSelections, marketing…), so
-- listing every allowed key would be long and would break quietly whenever a
-- page started reading something new. The private branches, by contrast, are
-- short and known.

-- ── One project, private parts stripped ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_project(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row  public.projects%ROWTYPE;
    v_pd   jsonb;
BEGIN
    IF p_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_row FROM public.projects WHERE id = p_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_pd := COALESCE(v_row.project_data, '{}'::jsonb);

    -- Exhibitor bookings are the sensitive part of stallingService; the rest
    -- (barns, supplies, prices) is what the public pages actually draw.
    IF v_pd ? 'stallingService' AND jsonb_typeof(v_pd->'stallingService') = 'object' THEN
        v_pd := jsonb_set(v_pd, '{stallingService,bookings}', '[]'::jsonb, true);
    END IF;

    -- Staff contacts, billing and sponsor deals are internal.
    v_pd := v_pd - 'staff' - 'showBill' - 'sponsors' - 'sponsorLevels';

    RETURN jsonb_build_object(
        'id',          v_row.id,
        'name',        v_row.project_name,
        'projectType', v_row.project_type,
        'status',      v_row.status,
        'createdAt',   v_row.created_at,
        'projectData', v_pd
    );
END;
$$;

-- ── The published-events listing ────────────────────────────────────────────
-- Returns one descriptor per published project. The pages still do their own
-- grouping and de-duplication (two records can be the same real show); this
-- only replaces the raw fetch, so that logic is untouched.
CREATE OR REPLACE FUNCTION public.list_public_events()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
    SELECT p.id,
           p.project_name,
           p.project_type,
           p.status,
           p.created_at,
           COALESCE(p.project_data, '{}'::jsonb) AS pd
    FROM public.projects p
    WHERE p.project_type IN ('show', 'pattern_book')
),
shaped AS (
    SELECT b.*,
           COALESCE(b.pd->'showDetails'->'general', '{}'::jsonb) AS gen,
           COALESCE(b.pd->'showDetails'->'venue',   '{}'::jsonb) AS venue,
           (b.pd->'moduleStatuses'->>'housing') = 'published' AS housing_published,
           (COALESCE(b.status, '') IN ('Final', 'Publication', 'published')
            OR (b.pd->'moduleStatuses'->>'patternBook') = 'published')   AS pattern_published
    FROM base b
),
dated AS (
    SELECT s.*,
           COALESCE(NULLIF(s.gen->>'startDate', ''), s.pd->>'startDate') AS start_date,
           COALESCE(NULLIF(s.gen->>'endDate', ''),   s.pd->>'endDate')   AS end_date
    FROM shaped s
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',                d.id,
    'projectName',       d.project_name,
    'projectType',       d.project_type,
    'status',            d.status,
    'createdAt',         d.created_at,
    'showName',          d.gen->>'showName',
    'startDate',         d.start_date,
    'endDate',           d.end_date,
    'location', COALESCE(
        NULLIF(d.venue->>'facilityName', ''),
        NULLIF(d.venue->>'address', ''),
        NULLIF(d.pd->>'venueName', ''),
        NULLIF(d.pd->>'venueAddress', ''),
        ''),
    'linkedProjectId', COALESCE(
        NULLIF(d.pd->>'linkedProjectId', ''),
        NULLIF(d.pd->>'linkedShowProjectId', '')),
    'housingPublished',  d.housing_published,
    'patternPublished',  d.pattern_published,
    'coverColor',        d.pd->>'coverColor',

    -- Associations the organizer ticked, same as Object.keys(...).filter(truthy).
    'associations', (
        SELECT jsonb_agg(k)
        FROM jsonb_object_keys(
                 CASE WHEN jsonb_typeof(d.pd->'associations') = 'object'
                      THEN d.pd->'associations' ELSE '{}'::jsonb END) k
        WHERE COALESCE(d.pd->'associations'->>k, '') NOT IN ('', 'false', 'null', '0')
    ),

    -- First usable cover image, in the same order the pages look for one.
    'coverUrl', COALESCE(
        NULLIF(d.pd->>'coverImageUrl', ''),
        (SELECT l->>'url'
           FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(d.pd->'showLogos') = 'array'
                         THEN d.pd->'showLogos' ELSE '[]'::jsonb END) l
          WHERE l->>'url' ~* '\.(jpe?g|png|webp|gif|jfif|avif)(\?|$)'
          LIMIT 1),
        (SELECT f->>'fileUrl'
           FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(d.pd->'generalMarketing') = 'array'
                         THEN d.pd->'generalMarketing' ELSE '[]'::jsonb END) f
          WHERE f->>'fileUrl'  ~* '\.(jpe?g|png|webp|gif|jfif|avif)(\?|$)'
             OR f->>'fileName' ~* '\.(jpe?g|png|webp|gif|jfif|avif)(\?|$)'
          LIMIT 1),
        CASE WHEN d.pd->>'showLogoUrl' ~* '\.(jpe?g|png|webp|gif|jfif|avif)(\?|$)'
             THEN d.pd->>'showLogoUrl' END)
) ORDER BY d.created_at DESC), '[]'::jsonb)
FROM dated d
WHERE (d.housing_published OR d.pattern_published)
  AND COALESCE(d.start_date, '') <> ''
  AND COALESCE(d.end_date, '')   <> '';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_project(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_events()     TO anon, authenticated;
