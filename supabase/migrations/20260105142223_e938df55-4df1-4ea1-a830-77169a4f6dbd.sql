
-- Indiana 4-H Disciplines (city = 'Indiana')
INSERT INTO public.disciplines (id, name, association_id, city, category, pattern_type, open_divisions, sort_order) VALUES
(gen_random_uuid(), 'Showmanship', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 1),
(gen_random_uuid(), 'Western Horsemanship', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 2),
(gen_random_uuid(), 'Trail', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 3),
(gen_random_uuid(), 'In-Hand Trail', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 4),
(gen_random_uuid(), 'Hunt Seat Equitation', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 5),
(gen_random_uuid(), 'Hunter Hack', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 6),
(gen_random_uuid(), 'Working Hunter', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 7),
(gen_random_uuid(), 'Jumping', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 8),
(gen_random_uuid(), 'Equitation Over Fences', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 9),
(gen_random_uuid(), 'Tie-Down', '4-H', 'Indiana', 'pattern_and_scoresheet', 'scoresheet_only', false, 10),
(gen_random_uuid(), 'Heading', '4-H', 'Indiana', 'pattern_and_scoresheet', 'scoresheet_only', false, 11),
(gen_random_uuid(), 'Heeling', '4-H', 'Indiana', 'pattern_and_scoresheet', 'scoresheet_only', false, 12),
(gen_random_uuid(), 'Working Cow Horse', '4-H', 'Indiana', 'pattern_and_scoresheet', 'rulebook', false, 13),
(gen_random_uuid(), 'Cutting', '4-H', 'Indiana', 'pattern_and_scoresheet', 'scoresheet_only', false, 14),
(gen_random_uuid(), 'Reining', '4-H', 'Indiana', 'pattern_and_scoresheet', 'rulebook', false, 15),
(gen_random_uuid(), 'Ranch Horse Trail', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 16),
(gen_random_uuid(), 'Ranch Horse Horsemanship', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 17),
(gen_random_uuid(), 'Ranch Horse Showmanship', '4-H', 'Indiana', 'pattern_and_scoresheet', 'custom', false, 18);

-- Indiana 4-H Division (Youth with Add Levels)
INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type) VALUES
(gen_random_uuid(), '4-H', 'Youth', 1, 'Indiana');

-- Ohio 4-H Disciplines (city = 'Ohio')
INSERT INTO public.disciplines (id, name, association_id, city, category, pattern_type, open_divisions, sort_order) VALUES
(gen_random_uuid(), 'Showmanship', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 1),
(gen_random_uuid(), 'Western Horsemanship', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 2),
(gen_random_uuid(), 'Trail', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 3),
(gen_random_uuid(), 'In-Hand Trail', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 4),
(gen_random_uuid(), 'Hunt Seat Equitation', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 5),
(gen_random_uuid(), 'Hunter Hack', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 6),
(gen_random_uuid(), 'Working Hunter', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 7),
(gen_random_uuid(), 'Jumping', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 8),
(gen_random_uuid(), 'Equitation Over Fences', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 9),
(gen_random_uuid(), 'Tie-Down', '4-H', 'Ohio', 'pattern_and_scoresheet', 'scoresheet_only', false, 10),
(gen_random_uuid(), 'Heading', '4-H', 'Ohio', 'pattern_and_scoresheet', 'scoresheet_only', false, 11),
(gen_random_uuid(), 'Heeling', '4-H', 'Ohio', 'pattern_and_scoresheet', 'scoresheet_only', false, 12),
(gen_random_uuid(), 'Working Cow Horse', '4-H', 'Ohio', 'pattern_and_scoresheet', 'rulebook', false, 13),
(gen_random_uuid(), 'Cutting', '4-H', 'Ohio', 'pattern_and_scoresheet', 'scoresheet_only', false, 14),
(gen_random_uuid(), 'Reining', '4-H', 'Ohio', 'pattern_and_scoresheet', 'rulebook', false, 15),
(gen_random_uuid(), 'Ranch Horse Trail', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 16),
(gen_random_uuid(), 'Ranch Horse Horsemanship', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 17),
(gen_random_uuid(), 'Ranch Horse Showmanship', '4-H', 'Ohio', 'pattern_and_scoresheet', 'custom', false, 18);

-- Ohio 4-H Division (Youth with Add Levels)
INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type) VALUES
(gen_random_uuid(), '4-H', 'Youth', 1, 'Ohio');

-- Colorado 4-H Disciplines (city = 'Colorado')
INSERT INTO public.disciplines (id, name, association_id, city, category, pattern_type, open_divisions, sort_order) VALUES
(gen_random_uuid(), 'Western Horsemanship', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 1),
(gen_random_uuid(), 'Western Riding', '4-H', 'Colorado', 'pattern_and_scoresheet', 'rulebook', false, 2),
(gen_random_uuid(), 'English Controlled Riding', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 3),
(gen_random_uuid(), 'English Equitation', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 4),
(gen_random_uuid(), 'Hunter Hack', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 5),
(gen_random_uuid(), 'Reining', '4-H', 'Colorado', 'pattern_and_scoresheet', 'rulebook', false, 6),
(gen_random_uuid(), 'Ranch Riding', '4-H', 'Colorado', 'pattern_and_scoresheet', 'rulebook', false, 7),
(gen_random_uuid(), 'Ranch Horsemanship', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 8),
(gen_random_uuid(), 'Ranch Trail', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 9),
(gen_random_uuid(), 'Ranch Cutting', '4-H', 'Colorado', 'pattern_and_scoresheet', 'scoresheet_only', false, 10),
(gen_random_uuid(), 'Ranch Cow Work', '4-H', 'Colorado', 'pattern_and_scoresheet', 'rulebook', false, 11),
(gen_random_uuid(), 'Showmanship', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 12),
(gen_random_uuid(), 'English Showmanship', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 13),
(gen_random_uuid(), 'Trail', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 14),
(gen_random_uuid(), 'English Trail', '4-H', 'Colorado', 'pattern_and_scoresheet', 'custom', false, 15);

-- Colorado 4-H Division (Youth with specific levels)
DO $$
DECLARE
  div_id UUID;
BEGIN
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), '4-H', 'Youth', 1, 'Colorado')
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
