-- Insert 4-H Kansas disciplines with correct pattern_type
INSERT INTO public.disciplines (name, association_id, pattern_type, category, open_divisions, sub_association_type, city, sort_order) VALUES
('Showmanship', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 1),
('Trail', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 2),
('Western Horsemanship', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 3),
('Reining', '4-H', 'rulebook', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 4),
('Ranch Pattern', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 5),
('Ranch Trail', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 6),
('Equitation Hunt Seat', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 7),
('Hunt Seat Equitation', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 8),
('Hunter Hack', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 9),
('Saddle Seat Equitation', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Kansas', 'Kansas', 10);

-- Insert 4-H Texas disciplines with correct pattern_type
INSERT INTO public.disciplines (name, association_id, pattern_type, category, open_divisions, sub_association_type, city, sort_order) VALUES
('Showmanship', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 1),
('Western Horsemanship', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 2),
('Trail', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 3),
('In-Hand Trail', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 4),
('Hunt Seat Equitation', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 5),
('Hunter Hack', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 6),
('Working Hunter', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 7),
('Jumping', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 8),
('Equitation over Fences', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 9),
('Tie-Down', '4-H', 'none', 'scoresheet_only', false, 'Texas', 'Texas', 10),
('Heading', '4-H', 'none', 'scoresheet_only', false, 'Texas', 'Texas', 11),
('Heeling', '4-H', 'none', 'scoresheet_only', false, 'Texas', 'Texas', 12),
('Working Cow Horse', '4-H', 'rulebook', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 13),
('Cutting', '4-H', 'none', 'scoresheet_only', false, 'Texas', 'Texas', 14),
('Reining', '4-H', 'rulebook', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 15),
('Stock Horse Trail', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 16),
('Stock Horse Horsemanship', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 17),
('Stock Horse Showmanship', '4-H', 'custom', 'pattern_and_scoresheet', false, 'Texas', 'Texas', 18);

-- Insert 4-H Kansas division with levels
INSERT INTO public.divisions (name, association_id, sub_association_type, sort_order) VALUES
('Youth', '4-H', 'Kansas', 1);

-- Get the Kansas Youth division ID and insert levels
INSERT INTO public.division_levels (division_id, name, sort_order)
SELECT d.id, level_name, level_order
FROM public.divisions d
CROSS JOIN (VALUES 
  ('Juniors 7–8', 1),
  ('Intermediates 9–13', 2),
  ('Seniors 14–18', 3)
) AS levels(level_name, level_order)
WHERE d.association_id = '4-H' AND d.sub_association_type = 'Kansas' AND d.name = 'Youth';

-- Insert 4-H Texas division (no preset levels - uses Add Levels button)
INSERT INTO public.divisions (name, association_id, sub_association_type, sort_order) VALUES
('Youth', '4-H', 'Texas', 1);