-- Scoring Portal: a horse can be marked "done" (scores locked and the card collapsed
-- to one line). Saved with the horse so it stays done after a refresh or on another device.

ALTER TABLE public.scoring_entries
  ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
