-- First delete the incorrectly added Kansas divisions
DELETE FROM divisions WHERE association_id = '4-H' AND sub_association_type = 'Kansas';

-- Insert Kansas 4-H Youth division (category)
INSERT INTO public.divisions (name, association_id, sub_association_type, sort_order) VALUES
('Youth', '4-H', 'Kansas', 1);

-- Insert Texas 4-H Youth division (category - levels will be added by user via "Add Levels" button)
INSERT INTO public.divisions (name, association_id, sub_association_type, sort_order) VALUES
('Youth', '4-H', 'Texas', 1);

-- Insert Kansas division levels under the Youth division
INSERT INTO public.division_levels (name, division_id, sort_order)
SELECT 'Juniors 7-8', id, 1 FROM divisions WHERE association_id = '4-H' AND sub_association_type = 'Kansas' AND name = 'Youth'
UNION ALL
SELECT 'Intermediates 9-13', id, 2 FROM divisions WHERE association_id = '4-H' AND sub_association_type = 'Kansas' AND name = 'Youth'
UNION ALL
SELECT 'Seniors 14-18', id, 3 FROM divisions WHERE association_id = '4-H' AND sub_association_type = 'Kansas' AND name = 'Youth';