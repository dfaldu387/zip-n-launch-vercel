-- First, delete existing division levels for open-show divisions
DELETE FROM public.division_levels WHERE division_id IN (
  SELECT id FROM public.divisions WHERE association_id = 'open-show'
);

-- Delete existing divisions for open-show
DELETE FROM public.divisions WHERE association_id = 'open-show';

-- Insert Open division and get its ID
DO $$
DECLARE
    open_div_id UUID;
    amateur_div_id UUID;
    youth_div_id UUID;
BEGIN
    -- Insert Open division
    INSERT INTO public.divisions (id, association_id, name, sort_order)
    VALUES (gen_random_uuid(), 'open-show', 'Open', 1)
    RETURNING id INTO open_div_id;
    
    -- Insert Open division levels
    INSERT INTO public.division_levels (division_id, name, sort_order) VALUES
    (open_div_id, 'All-Ages', 1),
    (open_div_id, 'Junior Horse (5 & Under)', 2),
    (open_div_id, 'Senior Horse (6 & Over)', 3),
    (open_div_id, '2-Year-Old', 4),
    (open_div_id, '3-Year-Old', 5),
    (open_div_id, 'Green Horse', 6);

    -- Insert Amateur division
    INSERT INTO public.divisions (id, association_id, name, sort_order)
    VALUES (gen_random_uuid(), 'open-show', 'Amateur', 2)
    RETURNING id INTO amateur_div_id;
    
    -- Insert Amateur division levels
    INSERT INTO public.division_levels (division_id, name, sort_order) VALUES
    (amateur_div_id, 'Amateur (19 & Over)', 1),
    (amateur_div_id, 'Classic Amateur (19–44)', 2),
    (amateur_div_id, 'Masters Amateur (45 & Over)', 3),
    (amateur_div_id, 'Novice Amateur', 4),
    (amateur_div_id, 'Amateur Walk-Trot (19 & Over)', 5),
    (amateur_div_id, 'Masters Walk-Trot (45 & Over)', 6),
    (amateur_div_id, 'Classic Amateur Walk-Trot (19 -44)', 7);

    -- Insert Youth division
    INSERT INTO public.divisions (id, association_id, name, sort_order)
    VALUES (gen_random_uuid(), 'open-show', 'Youth', 3)
    RETURNING id INTO youth_div_id;
    
    -- Insert Youth division levels
    INSERT INTO public.division_levels (division_id, name, sort_order) VALUES
    (youth_div_id, 'Youth 13 & Under', 1),
    (youth_div_id, 'Youth 14–18', 2),
    (youth_div_id, 'Novice Youth (18 & Under)', 3),
    (youth_div_id, 'Youth Walk-Trot 5–10', 4),
    (youth_div_id, 'Youth Walk-Trot 11–18', 5),
    (youth_div_id, 'Youth 18 & Under', 6),
    (youth_div_id, 'Youth Walk-Trot 18 & Under', 7);
END $$;