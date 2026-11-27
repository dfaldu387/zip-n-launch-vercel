-- Live Scoring by Time: penalties add seconds (for example Barrel Knocked Down = +5 sec).
--
--   time_penalties  how many times each penalty was given, e.g. {"<penaltyId>": 2}
--                   The seconds per penalty come from scoring_rules.penalties (points = seconds).

ALTER TABLE public.scoring_entries
  ADD COLUMN IF NOT EXISTS time_penalties jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
