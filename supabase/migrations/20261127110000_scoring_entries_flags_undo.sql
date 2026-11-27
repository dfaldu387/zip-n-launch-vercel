-- Live scoring screen: Contender / Recheck flags and an undo history per horse.
ALTER TABLE public.scoring_entries
  ADD COLUMN IF NOT EXISTS contender boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recheck boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS undo_log jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
