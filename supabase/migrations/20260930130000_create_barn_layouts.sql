-- Saved barn layouts: a shared, searchable catalog so nobody has to build a barn
-- from scratch. A layout is filed under Facility + Barn, with an optional third
-- label (a show name, "Quarter Horse Show", "County Fair"...).
--
-- The layout is only the SHAPE of the barn (grid size, box types, row/column names,
-- aisles, numbering, typed stall numbers). It never carries bookings, prices or
-- dates, so sharing it exposes no exhibitor data.
--
-- Everyone signed in can search and copy a layout; only the person who saved it
-- can change or delete it.

CREATE TABLE IF NOT EXISTS public.barn_layouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_name text,
  facility_name text NOT NULL CHECK (btrim(facility_name) <> ''),
  barn_name     text NOT NULL CHECK (btrim(barn_name) <> ''),
  show_label    text,
  layout        jsonb NOT NULL,
  stall_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Lower-cased copies used for searching and for "one per person per name".
  facility_key  text GENERATED ALWAYS AS (lower(btrim(facility_name))) STORED,
  barn_key      text GENERATED ALWAYS AS (lower(btrim(barn_name))) STORED,
  label_key     text GENERATED ALWAYS AS (lower(btrim(coalesce(show_label, '')))) STORED
);

-- Saving the same Facility + Barn + label again replaces your earlier copy.
CREATE UNIQUE INDEX IF NOT EXISTS barn_layouts_owner_key_idx
  ON public.barn_layouts (created_by, facility_key, barn_key, label_key);

CREATE INDEX IF NOT EXISTS barn_layouts_facility_key_idx
  ON public.barn_layouts (facility_key);

ALTER TABLE public.barn_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can search barn layouts" ON public.barn_layouts;
CREATE POLICY "Signed-in users can search barn layouts"
  ON public.barn_layouts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can save their own barn layouts" ON public.barn_layouts;
CREATE POLICY "Users can save their own barn layouts"
  ON public.barn_layouts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own barn layouts" ON public.barn_layouts;
CREATE POLICY "Users can update their own barn layouts"
  ON public.barn_layouts FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own barn layouts" ON public.barn_layouts;
CREATE POLICY "Users can delete their own barn layouts"
  ON public.barn_layouts FOR DELETE TO authenticated
  USING (created_by = auth.uid());

NOTIFY pgrst, 'reload schema';
