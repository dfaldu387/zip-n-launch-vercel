-- Delete old APHA disciplines
DELETE FROM public.disciplines WHERE association_id = 'APHA';

-- Insert new APHA disciplines with proper categories
-- Custom Pattern Disciplines
INSERT INTO public.disciplines (id, name, category, association_id, pattern_type, sort_order) VALUES
(gen_random_uuid(), 'Showmanship at Halter (Youth & Amateur)', 'Custom Pattern Disciplines', 'APHA', 'custom', 1),
(gen_random_uuid(), 'Horsemanship (Youth & Amateur)', 'Custom Pattern Disciplines', 'APHA', 'custom', 2),
(gen_random_uuid(), 'Hunt Seat Equitation (Youth & Amateur)', 'Custom Pattern Disciplines', 'APHA', 'custom', 3),
(gen_random_uuid(), 'Equitation Over Fences (Youth & Amateur)', 'Custom Pattern Disciplines', 'APHA', 'custom', 4),
(gen_random_uuid(), 'Working Hunter', 'Custom Pattern Disciplines', 'APHA', 'custom', 5),
(gen_random_uuid(), 'Hunter Hack', 'Custom Pattern Disciplines', 'APHA', 'custom', 6),
(gen_random_uuid(), 'Jumping', 'Custom Pattern Disciplines', 'APHA', 'custom', 7),
(gen_random_uuid(), 'Trail', 'Custom Pattern Disciplines', 'APHA', 'custom', 8),
(gen_random_uuid(), 'Ranch Trail', 'Custom Pattern Disciplines', 'APHA', 'custom', 9);

-- Rule Book Pattern Disciplines
INSERT INTO public.disciplines (id, name, category, association_id, pattern_type, sort_order) VALUES
(gen_random_uuid(), 'Western Riding', 'Rule Book Pattern Disciplines', 'APHA', 'rulebook', 10),
(gen_random_uuid(), 'Reining', 'Rule Book Pattern Disciplines', 'APHA', 'rulebook', 11),
(gen_random_uuid(), 'Working Cow Horse', 'Rule Book Pattern Disciplines', 'APHA', 'rulebook', 12),
(gen_random_uuid(), 'Ranch Riding', 'Rule Book Pattern Disciplines', 'APHA', 'rulebook', 13),
(gen_random_uuid(), 'Ranch Reining', 'Rule Book Pattern Disciplines', 'APHA', 'rulebook', 14);

-- Score Sheet Only Disciplines
INSERT INTO public.disciplines (id, name, category, association_id, pattern_type, sort_order) VALUES
(gen_random_uuid(), 'Western Pleasure', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 15),
(gen_random_uuid(), 'Ranch Rail Pleasure', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 16),
(gen_random_uuid(), 'Hunter Under Saddle', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 17),
(gen_random_uuid(), 'Barrel Racing', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 18),
(gen_random_uuid(), 'Pole Bending', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 19),
(gen_random_uuid(), 'Stake Race', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 20),
(gen_random_uuid(), 'Cutting', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 21),
(gen_random_uuid(), 'Boxing', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 22),
(gen_random_uuid(), 'Team Penning', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 23),
(gen_random_uuid(), 'Ranch Sorting', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 24),
(gen_random_uuid(), 'Heading', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 25),
(gen_random_uuid(), 'Heeling', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 26),
(gen_random_uuid(), 'Steer Stopping', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 27),
(gen_random_uuid(), 'Pleasure Driving', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 28),
(gen_random_uuid(), 'Halter', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 29),
(gen_random_uuid(), 'Yearling Longe Line', 'Score Sheet Only Disciplines', 'APHA', 'scoresheet', 30);