-- Insert POAC disciplines (same as AQHA minus excluded ones)
INSERT INTO disciplines (id, association_id, name, category, pattern_type, sort_order) VALUES
  (gen_random_uuid(), 'POAC', 'Showmanship at Halter', 'pattern_and_scoresheet', 'custom', 1),
  (gen_random_uuid(), 'POAC', 'Horsemanship', 'pattern_and_scoresheet', 'custom', 2),
  (gen_random_uuid(), 'POAC', 'Hunt Seat Equitation', 'pattern_and_scoresheet', 'custom', 3),
  (gen_random_uuid(), 'POAC', 'Trail', 'pattern_and_scoresheet', 'custom', 4),
  (gen_random_uuid(), 'POAC', 'Ranch Trail', 'pattern_and_scoresheet', 'custom', 5),
  (gen_random_uuid(), 'POAC', 'Equitation Over Fences', 'pattern_and_scoresheet', 'custom', 6),
  (gen_random_uuid(), 'POAC', 'Working Hunter', 'pattern_and_scoresheet', 'custom', 7),
  (gen_random_uuid(), 'POAC', 'Hunter Hack', 'pattern_and_scoresheet', 'custom', 8),
  (gen_random_uuid(), 'POAC', 'Jumping', 'pattern_and_scoresheet', 'custom', 9),
  (gen_random_uuid(), 'POAC', 'In-Hand Trail', 'pattern_and_scoresheet', 'custom', 10),
  (gen_random_uuid(), 'POAC', 'Western Riding', 'pattern_and_scoresheet', 'rulebook', 11),
  (gen_random_uuid(), 'POAC', 'Reining', 'pattern_and_scoresheet', 'rulebook', 12),
  (gen_random_uuid(), 'POAC', 'Ranch Riding', 'pattern_and_scoresheet', 'rulebook', 13);

-- Insert POAC divisions with levels
CALL insert_division_data('POAC', 'Adults', 1, ARRAY['Adults 19 & Over']);
CALL insert_division_data('POAC', 'Youth', 2, ARRAY['Youth 18 & Under']);