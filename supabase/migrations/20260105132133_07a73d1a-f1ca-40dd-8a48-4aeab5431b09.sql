-- Insert Texas 4-H disciplines
INSERT INTO public.disciplines (id, name, association_id, city, pattern_type, category, sort_order)
VALUES 
  (gen_random_uuid(), 'Showmanship', '4-H', 'Texas', 'rulebook', 'pattern_and_scoresheet', 1),
  (gen_random_uuid(), 'Western Horsemanship', '4-H', 'Texas', 'rulebook', 'pattern_and_scoresheet', 2),
  (gen_random_uuid(), 'Trail', '4-H', 'Texas', 'rulebook', 'pattern_and_scoresheet', 3),
  (gen_random_uuid(), 'Hunt Seat Equitation', '4-H', 'Texas', 'rulebook', 'pattern_and_scoresheet', 4);