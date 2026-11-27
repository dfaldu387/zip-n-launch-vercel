-- Names for maneuver scores, for example {"2": "Excellent", "1": "Good", "0": "Average"}.
ALTER TABLE public.scoring_rules
  ADD COLUMN IF NOT EXISTS score_labels jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
