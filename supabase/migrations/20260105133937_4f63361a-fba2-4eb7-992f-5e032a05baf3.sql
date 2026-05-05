
-- Add disciplines for 4-H Florida
INSERT INTO public.disciplines (name, association_id, sub_association_type, category, pattern_type, open_divisions, sort_order)
VALUES 
  ('Showmanship', '4-H', 'Florida', 'Showmanship', 'standard', false, 1),
  ('Western Horsemanship', '4-H', 'Florida', 'Western', 'standard', false, 2),
  ('Trail', '4-H', 'Florida', 'Trail', 'standard', false, 3),
  ('Ranch Riding', '4-H', 'Florida', 'Ranch', 'standard', false, 4),
  ('Ranch Trail', '4-H', 'Florida', 'Ranch', 'standard', false, 5),
  ('Ranch Reining', '4-H', 'Florida', 'Ranch', 'standard', false, 6),
  ('Ranch Roping', '4-H', 'Florida', 'Ranch', 'standard', false, 7),
  ('Working Cow Horse', '4-H', 'Florida', 'Cattle', 'standard', false, 8),
  ('Hunt Seat Equitation', '4-H', 'Florida', 'English', 'standard', false, 9),
  ('Hunter Hack', '4-H', 'Florida', 'English', 'standard', false, 10),
  ('Working Hunter', '4-H', 'Florida', 'English', 'standard', false, 11),
  ('Equitation Over Fences', '4-H', 'Florida', 'English', 'standard', false, 12)
ON CONFLICT DO NOTHING;

-- Add disciplines for 4-H New York
INSERT INTO public.disciplines (name, association_id, sub_association_type, category, pattern_type, open_divisions, sort_order)
VALUES 
  ('Showmanship', '4-H', 'New York', 'Showmanship', 'standard', false, 1),
  ('Western Horsemanship', '4-H', 'New York', 'Western', 'standard', false, 2),
  ('Trail', '4-H', 'New York', 'Trail', 'standard', false, 3),
  ('In-Hand Trail', '4-H', 'New York', 'Trail', 'standard', false, 4),
  ('Hunt Seat Equitation', '4-H', 'New York', 'English', 'standard', false, 5),
  ('Hunter Hack', '4-H', 'New York', 'English', 'standard', false, 6),
  ('Working Hunter', '4-H', 'New York', 'English', 'standard', false, 7),
  ('Jumping', '4-H', 'New York', 'English', 'standard', false, 8),
  ('Equitation Over Fences', '4-H', 'New York', 'English', 'standard', false, 9),
  ('Tie-Down', '4-H', 'New York', 'Roping', 'standard', false, 10),
  ('Heading', '4-H', 'New York', 'Roping', 'standard', false, 11),
  ('Heeling', '4-H', 'New York', 'Roping', 'standard', false, 12),
  ('Working Cow Horse', '4-H', 'New York', 'Cattle', 'standard', false, 13),
  ('Cutting', '4-H', 'New York', 'Cattle', 'standard', false, 14),
  ('Reining', '4-H', 'New York', 'Reining', 'standard', false, 15),
  ('Ranch Horse Trail', '4-H', 'New York', 'Ranch', 'standard', false, 16),
  ('Ranch Horse Horsemanship', '4-H', 'New York', 'Ranch', 'standard', false, 17),
  ('Ranch Horse Showmanship', '4-H', 'New York', 'Ranch', 'standard', false, 18)
ON CONFLICT DO NOTHING;

-- Add disciplines for 4-H Michigan
INSERT INTO public.disciplines (name, association_id, sub_association_type, category, pattern_type, open_divisions, sort_order)
VALUES 
  ('Showmanship', '4-H', 'Michigan', 'Showmanship', 'standard', false, 1),
  ('Western Horsemanship', '4-H', 'Michigan', 'Western', 'standard', false, 2),
  ('Trail', '4-H', 'Michigan', 'Trail', 'standard', false, 3),
  ('In-Hand Trail', '4-H', 'Michigan', 'Trail', 'standard', false, 4),
  ('Hunt Seat Equitation', '4-H', 'Michigan', 'English', 'standard', false, 5),
  ('Hunter Hack', '4-H', 'Michigan', 'English', 'standard', false, 6),
  ('Working Hunter', '4-H', 'Michigan', 'English', 'standard', false, 7),
  ('Jumping', '4-H', 'Michigan', 'English', 'standard', false, 8),
  ('Equitation Over Fences', '4-H', 'Michigan', 'English', 'standard', false, 9),
  ('Tie-Down', '4-H', 'Michigan', 'Roping', 'standard', false, 10),
  ('Heading', '4-H', 'Michigan', 'Roping', 'standard', false, 11),
  ('Heeling', '4-H', 'Michigan', 'Roping', 'standard', false, 12),
  ('Working Cow Horse', '4-H', 'Michigan', 'Cattle', 'standard', false, 13),
  ('Cutting', '4-H', 'Michigan', 'Cattle', 'standard', false, 14),
  ('Reining', '4-H', 'Michigan', 'Reining', 'standard', false, 15),
  ('Ranch Horse Trail', '4-H', 'Michigan', 'Ranch', 'standard', false, 16),
  ('Ranch Horse Horsemanship', '4-H', 'Michigan', 'Ranch', 'standard', false, 17),
  ('Ranch Horse Showmanship', '4-H', 'Michigan', 'Ranch', 'standard', false, 18)
ON CONFLICT DO NOTHING;

-- Add disciplines for 4-H Indiana
INSERT INTO public.disciplines (name, association_id, sub_association_type, category, pattern_type, open_divisions, sort_order)
VALUES 
  ('Showmanship', '4-H', 'Indiana', 'Showmanship', 'standard', false, 1),
  ('Western Horsemanship', '4-H', 'Indiana', 'Western', 'standard', false, 2),
  ('Trail', '4-H', 'Indiana', 'Trail', 'standard', false, 3),
  ('In-Hand Trail', '4-H', 'Indiana', 'Trail', 'standard', false, 4),
  ('Hunt Seat Equitation', '4-H', 'Indiana', 'English', 'standard', false, 5),
  ('Hunter Hack', '4-H', 'Indiana', 'English', 'standard', false, 6),
  ('Working Hunter', '4-H', 'Indiana', 'English', 'standard', false, 7),
  ('Jumping', '4-H', 'Indiana', 'English', 'standard', false, 8),
  ('Equitation Over Fences', '4-H', 'Indiana', 'English', 'standard', false, 9),
  ('Tie-Down', '4-H', 'Indiana', 'Roping', 'standard', false, 10),
  ('Heading', '4-H', 'Indiana', 'Roping', 'standard', false, 11),
  ('Heeling', '4-H', 'Indiana', 'Roping', 'standard', false, 12),
  ('Working Cow Horse', '4-H', 'Indiana', 'Cattle', 'standard', false, 13),
  ('Cutting', '4-H', 'Indiana', 'Cattle', 'standard', false, 14),
  ('Reining', '4-H', 'Indiana', 'Reining', 'standard', false, 15),
  ('Ranch Horse Trail', '4-H', 'Indiana', 'Ranch', 'standard', false, 16),
  ('Ranch Horse Horsemanship', '4-H', 'Indiana', 'Ranch', 'standard', false, 17),
  ('Ranch Horse Showmanship', '4-H', 'Indiana', 'Ranch', 'standard', false, 18)
ON CONFLICT DO NOTHING;

-- Add Youth divisions for each 4-H city (with empty levels - "Add Levels" button)
INSERT INTO public.divisions (name, association_id, sub_association_type, sort_order)
VALUES 
  ('Youth', '4-H', 'Texas', 1),
  ('Youth', '4-H', 'Florida', 1),
  ('Youth', '4-H', 'New York', 1),
  ('Youth', '4-H', 'Michigan', 1),
  ('Youth', '4-H', 'Indiana', 1)
ON CONFLICT DO NOTHING;
