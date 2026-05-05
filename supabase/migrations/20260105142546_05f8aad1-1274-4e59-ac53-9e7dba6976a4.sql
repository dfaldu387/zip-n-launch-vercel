
-- Nebraska 4-H Disciplines (city = 'Nebraska')
INSERT INTO public.disciplines (id, name, association_id, city, category, pattern_type, open_divisions, sort_order) VALUES
(gen_random_uuid(), 'Western Horsemanship', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 1),
(gen_random_uuid(), 'Western Riding', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'rulebook', false, 2),
(gen_random_uuid(), 'English Controlled Riding', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 3),
(gen_random_uuid(), 'English Equitation', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 4),
(gen_random_uuid(), 'Hunter Hack', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 5),
(gen_random_uuid(), 'Reining', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'rulebook', false, 6),
(gen_random_uuid(), 'Ranch Riding', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'rulebook', false, 7),
(gen_random_uuid(), 'Ranch Horsemanship', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 8),
(gen_random_uuid(), 'Ranch Trail', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 9),
(gen_random_uuid(), 'Ranch Cutting', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'scoresheet_only', false, 10),
(gen_random_uuid(), 'Ranch Cow Work', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'rulebook', false, 11),
(gen_random_uuid(), 'Showmanship', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 12),
(gen_random_uuid(), 'English Showmanship', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 13),
(gen_random_uuid(), 'Trail', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 14),
(gen_random_uuid(), 'English Trail', '4-H', 'Nebraska', 'pattern_and_scoresheet', 'custom', false, 15);

-- Nebraska 4-H Division (Youth with specific levels)
DO $$
DECLARE
  div_id UUID;
BEGIN
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), '4-H', 'Youth', 1, 'Nebraska')
  RETURNING id INTO div_id;

  INSERT INTO public.division_levels (id, division_id, name, sort_order) VALUES
  (gen_random_uuid(), div_id, 'Junior 8-10', 1),
  (gen_random_uuid(), div_id, 'Intermediate 13-Under', 2),
  (gen_random_uuid(), div_id, 'Senior 14-18', 3),
  (gen_random_uuid(), div_id, 'Walk Trot 18-Under', 4),
  (gen_random_uuid(), div_id, 'Junior 8-10 Level I', 5),
  (gen_random_uuid(), div_id, 'Intermediate 13-Under Level I', 6),
  (gen_random_uuid(), div_id, 'Senior 14-18 Level I', 7),
  (gen_random_uuid(), div_id, 'Junior 8-10 Level 2', 8),
  (gen_random_uuid(), div_id, 'Intermediate 13-Under Level 2', 9),
  (gen_random_uuid(), div_id, 'Senior 14-18 Level 2', 10),
  (gen_random_uuid(), div_id, 'Junior 8-10 Level 3', 11),
  (gen_random_uuid(), div_id, 'Intermediate 13-Under Level 3', 12),
  (gen_random_uuid(), div_id, 'Senior 14-18 Level 3', 13),
  (gen_random_uuid(), div_id, 'Junior 8-10 Level 4', 14),
  (gen_random_uuid(), div_id, 'Intermediate 13-Under Level 4', 15),
  (gen_random_uuid(), div_id, 'Senior 14-18 Level 4', 16);
END $$;

-- Wyoming 4-H Disciplines (city = 'Wyoming')
INSERT INTO public.disciplines (id, name, association_id, city, category, pattern_type, open_divisions, sort_order) VALUES
(gen_random_uuid(), 'Western Horsemanship', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 1),
(gen_random_uuid(), 'Western Riding', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'rulebook', false, 2),
(gen_random_uuid(), 'English Controlled Riding', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 3),
(gen_random_uuid(), 'English Equitation', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 4),
(gen_random_uuid(), 'Hunter Hack', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 5),
(gen_random_uuid(), 'Reining', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'rulebook', false, 6),
(gen_random_uuid(), 'Ranch Riding', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'rulebook', false, 7),
(gen_random_uuid(), 'Ranch Horsemanship', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 8),
(gen_random_uuid(), 'Ranch Trail', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 9),
(gen_random_uuid(), 'Ranch Cutting', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'scoresheet_only', false, 10),
(gen_random_uuid(), 'Ranch Cow Work', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'rulebook', false, 11),
(gen_random_uuid(), 'Showmanship', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 12),
(gen_random_uuid(), 'English Showmanship', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 13),
(gen_random_uuid(), 'Trail', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 14),
(gen_random_uuid(), 'English Trail', '4-H', 'Wyoming', 'pattern_and_scoresheet', 'custom', false, 15);

-- Wyoming 4-H Division (Youth with 4 levels)
DO $$
DECLARE
  div_id UUID;
BEGIN
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), '4-H', 'Youth', 1, 'Wyoming')
  RETURNING id INTO div_id;

  INSERT INTO public.division_levels (id, division_id, name, sort_order) VALUES
  (gen_random_uuid(), div_id, 'Junior 8-10', 1),
  (gen_random_uuid(), div_id, 'Intermediate 13-Under', 2),
  (gen_random_uuid(), div_id, 'Senior 14-18', 3),
  (gen_random_uuid(), div_id, 'Walk Trot 18-Under', 4);
END $$;

-- Arkansas 4-H Disciplines (city = 'Arkansas')
INSERT INTO public.disciplines (id, name, association_id, city, category, pattern_type, open_divisions, sort_order) VALUES
(gen_random_uuid(), 'Western Horsemanship', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 1),
(gen_random_uuid(), 'Western Riding', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'rulebook', false, 2),
(gen_random_uuid(), 'English Controlled Riding', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 3),
(gen_random_uuid(), 'English Equitation', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 4),
(gen_random_uuid(), 'Hunter Hack', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 5),
(gen_random_uuid(), 'Reining', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'rulebook', false, 6),
(gen_random_uuid(), 'Ranch Riding', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'rulebook', false, 7),
(gen_random_uuid(), 'Ranch Horsemanship', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 8),
(gen_random_uuid(), 'Ranch Trail', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 9),
(gen_random_uuid(), 'Ranch Cutting', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'scoresheet_only', false, 10),
(gen_random_uuid(), 'Ranch Cow Work', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'rulebook', false, 11),
(gen_random_uuid(), 'Showmanship', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 12),
(gen_random_uuid(), 'English Showmanship', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 13),
(gen_random_uuid(), 'Trail', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 14),
(gen_random_uuid(), 'English Trail', '4-H', 'Arkansas', 'pattern_and_scoresheet', 'custom', false, 15);

-- Arkansas 4-H Division (Youth with 3 levels)
DO $$
DECLARE
  div_id UUID;
BEGIN
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), '4-H', 'Youth', 1, 'Arkansas')
  RETURNING id INTO div_id;

  INSERT INTO public.division_levels (id, division_id, name, sort_order) VALUES
  (gen_random_uuid(), div_id, 'Junior 8-13', 1),
  (gen_random_uuid(), div_id, 'Senior 14-18', 2),
  (gen_random_uuid(), div_id, 'Walk Trot 18-Under', 3);
END $$;
