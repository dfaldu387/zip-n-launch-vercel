-- Live Scoring by Time: the judge types a time for each exhibitor, fastest time places first.
--
--   time_seconds  the time in seconds, for example 17.342 (NULL = no time typed yet)
--   no_time       true = the horse has no time (scratched, no run). Placed last, no placing number.
--
-- Same table as the other score sheet types, so add/remove/complete code is shared.

ALTER TABLE public.scoring_entries
  ADD COLUMN IF NOT EXISTS time_seconds numeric,
  ADD COLUMN IF NOT EXISTS no_time boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
