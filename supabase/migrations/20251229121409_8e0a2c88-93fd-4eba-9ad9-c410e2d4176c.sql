DO $$
DECLARE
  open_div_id UUID;
  amateur_div_id UUID;
  youth_div_id UUID;
BEGIN
  -- Insert Open division
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), 'open-show', 'Open', 1, 'apha')
  RETURNING id INTO open_div_id;
  
  -- Insert Open division levels
  INSERT INTO public.division_levels (id, division_id, name, sort_order)
  VALUES
    (gen_random_uuid(), open_div_id, 'All-Ages', 0),
    (gen_random_uuid(), open_div_id, 'Junior Horse (5 & Under)', 1),
    (gen_random_uuid(), open_div_id, 'Senior Horse (6 & Over)', 2),
    (gen_random_uuid(), open_div_id, '2-Year-Old', 3),
    (gen_random_uuid(), open_div_id, '3-Year-Old', 4),
    (gen_random_uuid(), open_div_id, 'Green Horse', 5);

  -- Insert Amateur division
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), 'open-show', 'Amateur', 2, 'apha')
  RETURNING id INTO amateur_div_id;
  
  -- Insert Amateur division levels
  INSERT INTO public.division_levels (id, division_id, name, sort_order)
  VALUES
    (gen_random_uuid(), amateur_div_id, 'Amateur (19 & Over)', 0),
    (gen_random_uuid(), amateur_div_id, 'Classic Amateur (19-44)', 1),
    (gen_random_uuid(), amateur_div_id, 'Masters Amateur (45 & Over)', 2),
    (gen_random_uuid(), amateur_div_id, 'Novice Amateur', 3),
    (gen_random_uuid(), amateur_div_id, 'Amateur Walk-Trot (19 & Over)', 4),
    (gen_random_uuid(), amateur_div_id, 'Masters Walk-Trot (45 & Over)', 5),
    (gen_random_uuid(), amateur_div_id, 'Classic Amateur Walk-Trot (19-44)', 6);

  -- Insert Youth division
  INSERT INTO public.divisions (id, association_id, name, sort_order, sub_association_type)
  VALUES (gen_random_uuid(), 'open-show', 'Youth', 3, 'apha')
  RETURNING id INTO youth_div_id;
  
  -- Insert Youth division levels
  INSERT INTO public.division_levels (id, division_id, name, sort_order)
  VALUES
    (gen_random_uuid(), youth_div_id, 'Youth 13 & Under', 0),
    (gen_random_uuid(), youth_div_id, 'Youth 14-18', 1),
    (gen_random_uuid(), youth_div_id, 'Novice Youth (18 & Under)', 2),
    (gen_random_uuid(), youth_div_id, 'Youth Walk-Trot 5-10', 3),
    (gen_random_uuid(), youth_div_id, 'Youth Walk-Trot 11-18', 4),
    (gen_random_uuid(), youth_div_id, 'Youth 18 & Under', 5),
    (gen_random_uuid(), youth_div_id, 'Youth Walk-Trot 18 & Under', 6);
END $$;