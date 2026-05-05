-- First, delete existing disciplines for open-show
DELETE FROM public.disciplines WHERE association_id = 'open-show';

-- Insert Custom Pattern disciplines
INSERT INTO public.disciplines (name, association_id, category, pattern_type, sort_order, open_divisions)
VALUES
  ('Showmanship', 'open-show', 'pattern_and_scoresheet', 'custom', 1, true),
  ('Horsemanship', 'open-show', 'pattern_and_scoresheet', 'custom', 2, true),
  ('Hunt Seat Equitation', 'open-show', 'pattern_and_scoresheet', 'custom', 3, true),
  ('Trail', 'open-show', 'pattern_and_scoresheet', 'custom', 4, true),
  ('In-Hand Trail', 'open-show', 'pattern_and_scoresheet', 'custom', 5, true),
  ('Ranch Trail', 'open-show', 'pattern_and_scoresheet', 'custom', 6, true),
  ('Hunter Hack', 'open-show', 'pattern_and_scoresheet', 'custom', 7, true),
  ('Working Hunter', 'open-show', 'pattern_and_scoresheet', 'custom', 8, true),
  ('Equitation Over Fences', 'open-show', 'pattern_and_scoresheet', 'custom', 9, true),
  ('Jumping', 'open-show', 'pattern_and_scoresheet', 'custom', 10, true),
  ('English Versatility', 'open-show', 'pattern_and_scoresheet', 'custom', 11, true),
  ('Western Versatility', 'open-show', 'pattern_and_scoresheet', 'custom', 12, true);

-- Insert Rulebook Pattern disciplines
INSERT INTO public.disciplines (name, association_id, category, pattern_type, sort_order, open_divisions)
VALUES
  ('Western Riding', 'open-show', 'pattern_and_scoresheet', 'rulebook', 13, true),
  ('Reining', 'open-show', 'pattern_and_scoresheet', 'rulebook', 14, true),
  ('Working Cow Horse', 'open-show', 'pattern_and_scoresheet', 'rulebook', 15, true),
  ('Ranch Riding', 'open-show', 'pattern_and_scoresheet', 'rulebook', 16, true),
  ('Ranch Reining', 'open-show', 'pattern_and_scoresheet', 'rulebook', 17, true),
  ('Ranch Pleasure', 'open-show', 'pattern_and_scoresheet', 'rulebook', 18, true);

-- Insert Scoresheet Only disciplines
INSERT INTO public.disciplines (name, association_id, category, pattern_type, sort_order, open_divisions)
VALUES
  ('Ranch Cutting', 'open-show', 'scoresheet_only', 'none', 19, true),
  ('Tie-Down Roping', 'open-show', 'scoresheet_only', 'none', 20, true),
  ('Ranch Cow Work', 'open-show', 'scoresheet_only', 'none', 21, true),
  ('Cutting', 'open-show', 'scoresheet_only', 'none', 22, true),
  ('Boxing', 'open-show', 'scoresheet_only', 'none', 23, true),
  ('Ranch Boxing', 'open-show', 'scoresheet_only', 'none', 24, true),
  ('Heeling', 'open-show', 'scoresheet_only', 'none', 25, true),
  ('Steer Stopping', 'open-show', 'scoresheet_only', 'none', 26, true),
  ('Ranch Box Drive', 'open-show', 'scoresheet_only', 'none', 27, true),
  ('Longe Line', 'open-show', 'scoresheet_only', 'none', 28, true),
  ('Heading', 'open-show', 'scoresheet_only', 'none', 29, true);