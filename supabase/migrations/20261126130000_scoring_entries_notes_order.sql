-- Live Scoring with Notes: the judge drags exhibitors into placing order and can add notes.
--
--   place_order  1, 2, 3 ... the placing the judge dragged this horse to (NULL = not placed yet)
--   notes        free text the judge typed for this horse
--
-- Same table as the General score sheet, so the existing add/remove/complete code is shared.

ALTER TABLE public.scoring_entries
  ADD COLUMN IF NOT EXISTS place_order integer,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
