-- Final Maneuver: an optional last column on every score sheet of a discipline
-- (for example "Form & Effectiveness", scored 0 to 5).
--
--   final_maneuver  { "enabled": true, "label": "Form & Effectiveness", "scores": [0,1,2,3,4,5] }
--                   NULL = this discipline has no final maneuver.
--
-- The judge's score for it is saved with the horse as the LAST entry of
-- scoring_entries.maneuver_scores, so the entries table needs no change.

ALTER TABLE public.scoring_rules
  ADD COLUMN IF NOT EXISTS final_maneuver jsonb;

NOTIFY pgrst, 'reload schema';
