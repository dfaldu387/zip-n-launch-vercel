-- Score sheet type: which kind of score sheet a discipline uses.
--   general  = General Score Sheet (start score, penalties, maneuver scores)
--   notes    = Live Scoring with Notes (drag exhibitors into placings, notes only)
--   scores   = Live Scoring with Scores/Penalties (live hybrid)
--   time     = Live Scoring by Time (placings sorted by time)
-- Existing rows stay 'general', so nothing changes for current classes.

ALTER TABLE public.scoring_rules
  ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'general';

ALTER TABLE public.scoring_rules
  DROP CONSTRAINT IF EXISTS scoring_rules_sheet_type_check;
ALTER TABLE public.scoring_rules
  ADD CONSTRAINT scoring_rules_sheet_type_check
  CHECK (sheet_type IN ('general', 'notes', 'scores', 'time'));

NOTIFY pgrst, 'reload schema';
