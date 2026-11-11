-- The Event page gets its OWN Draft / Published switch (project_data.publicPage.eventPublished),
-- separate from Housing, the Pattern Book and the stalling chart.
--
-- Rule for the public Events / Home / Past Events listings:
--   eventPublished = true   -> listed, even if Housing and the Pattern Book are still drafts
--   eventPublished = false  -> NOT listed, even if Housing or the Pattern Book is live
--   not set (older shows)   -> old rule: listed when Housing or the Pattern Book is live
-- A pattern book that is linked to a show uses the SHOW's switch (that is where the
-- Event Branding page saves it), so the two records never disagree.
--
-- Only list_public_events changes. get_public_project is untouched: the event page
-- itself checks the switch and shows "not public yet" for a draft.

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
            OR (b.pd->'moduleStatuses'->>'patternBook') = 'published')   AS pattern_published,
           -- This record's own switch, else the linked record's.
           COALESCE(
               b.pd->'publicPage'->>'eventPublished',
               (SELECT l.project_data->'publicPage'->>'eventPublished'
                  FROM public.projects l
                 WHERE l.id::text = COALESCE(NULLIF(b.pd->>'linkedShowProjectId', ''),
                                             NULLIF(b.pd->>'linkedProjectId', ''))
                 LIMIT 1)
           ) AS event_switch
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

    'associations', (
        SELECT jsonb_agg(k)
        FROM jsonb_object_keys(
                 CASE WHEN jsonb_typeof(d.pd->'associations') = 'object'
                      THEN d.pd->'associations' ELSE '{}'::jsonb END) k
        WHERE COALESCE(d.pd->'associations'->>k, '') NOT IN ('', 'false', 'null', '0')
    ),

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
WHERE (
        d.event_switch = 'true'
        OR (d.event_switch IS NULL AND (d.housing_published OR d.pattern_published))
      )
  AND COALESCE(d.start_date, '') <> ''
  AND COALESCE(d.end_date, '')   <> '';
$$;

GRANT EXECUTE ON FUNCTION public.list_public_events() TO anon, authenticated;
