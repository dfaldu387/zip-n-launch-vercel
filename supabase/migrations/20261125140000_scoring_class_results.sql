-- Scoring Portal: "Complete Class". When a judge finishes a class, the placings are saved
-- here as a snapshot, one row per score sheet (one class + one judge).
--
--   results  [{ "placing", "back_number", "work_order", "total", "status" }]  best first
--   status   'ok' | 'dq' | 'zero' per horse; placing is null for a disqualified horse
--
-- Same access as scoring_entries: the show owner and admins.

CREATE TABLE IF NOT EXISTS public.scoring_class_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id       text NOT NULL,
  sheet_key     text NOT NULL,
  results       jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scoring_class_results_sheet_key UNIQUE (show_id, sheet_key),
  CONSTRAINT scoring_class_results_is_array CHECK (jsonb_typeof(results) = 'array')
);

ALTER TABLE public.scoring_class_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Show owners and admins manage scoring class results" ON public.scoring_class_results;
CREATE POLICY "Show owners and admins manage scoring class results"
  ON public.scoring_class_results FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = scoring_class_results.show_id AND p.user_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = scoring_class_results.show_id AND p.user_id::text = auth.uid()::text
    )
  );

NOTIFY pgrst, 'reload schema';
