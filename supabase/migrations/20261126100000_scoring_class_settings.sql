-- Scoring Portal: per-class settings chosen by the judge. Today: the tiebreaker.
--
--   tiebreak  ordered list of steps, e.g. [{ "type": "penalties" }]   ([] = no tiebreaker)
--
-- One row per score sheet (one class + one judge). Same access as scoring_entries.

CREATE TABLE IF NOT EXISTS public.scoring_class_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     text NOT NULL,
  sheet_key   text NOT NULL,
  tiebreak    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scoring_class_settings_sheet_key UNIQUE (show_id, sheet_key),
  CONSTRAINT scoring_class_settings_is_array CHECK (jsonb_typeof(tiebreak) = 'array')
);

ALTER TABLE public.scoring_class_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Show owners and admins manage scoring class settings" ON public.scoring_class_settings;
CREATE POLICY "Show owners and admins manage scoring class settings"
  ON public.scoring_class_settings FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = scoring_class_settings.show_id AND p.user_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = scoring_class_settings.show_id AND p.user_id::text = auth.uid()::text
    )
  );

NOTIFY pgrst, 'reload schema';
