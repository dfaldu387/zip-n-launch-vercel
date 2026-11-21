-- Scoring rules: what a judge's score sheet starts from, per discipline.
--
-- One row per discipline. A discipline row already belongs to one association
-- (disciplines.association_id), so "AQHA Horsemanship" and "PtHA Horsemanship" are
-- two different discipline rows and get their own rules.
--
--   starting_score   the score every horse starts the class with (for example 70)
--   penalties        [{ "id", "name", "points", "kind" }]
--                      kind = 'normal'  -> subtracts `points` (a positive number)
--                      kind = 'zero'    -> total score becomes 0
--                      kind = 'dq'      -> shown as DISQUALIFICATION (wins over zero)
--   maneuver_scores  [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]  the allowed per-maneuver scores
--
-- The Scoring Portal reads this table. Everyone signed in can read it (judges and
-- show managers need it); only admins can change it.
--
-- ids are stored as plain text with no foreign key on purpose, so this file works
-- whatever type disciplines.id / associations.id use.

CREATE TABLE IF NOT EXISTS public.scoring_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id    text NOT NULL,
  association_id   text,
  starting_score   numeric(6,2) NOT NULL DEFAULT 70,
  penalties        jsonb NOT NULL DEFAULT '[]'::jsonb,
  maneuver_scores  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scoring_rules_discipline_key UNIQUE (discipline_id),
  CONSTRAINT scoring_rules_penalties_is_array CHECK (jsonb_typeof(penalties) = 'array'),
  CONSTRAINT scoring_rules_scores_is_array CHECK (jsonb_typeof(maneuver_scores) = 'array')
);

ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read scoring rules" ON public.scoring_rules;
CREATE POLICY "Signed-in users can read scoring rules"
  ON public.scoring_rules FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage scoring rules" ON public.scoring_rules;
CREATE POLICY "Admins can manage scoring rules"
  ON public.scoring_rules FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
