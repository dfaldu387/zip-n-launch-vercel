-- Delete all existing ApHC disciplines
DELETE FROM disciplines WHERE association_id = 'ApHC';

-- Insert ApHC Custom Pattern Disciplines
INSERT INTO disciplines (name, association_id, category, pattern_type, open_divisions, sort_order) VALUES
('Showmanship at Halter (Youth & Amateur)', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 1),
('Western Horsemanship (Youth & Amateur)', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 2),
('Bareback Horsemanship (Youth & Amateur)', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 3),
('Hunt Seat Equitation (Youth & Amateur)', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 4),
('Equitation Over Fences (Youth & Amateur)', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 5),
('Working Hunter', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 6),
('Hunter Hack', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 7),
('Jumping', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 8),
('Trail', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 9),
('Ranch Trail', 'ApHC', 'pattern_and_scoresheet', 'custom', false, 10);

-- Insert ApHC Rule Book Pattern Disciplines
INSERT INTO disciplines (name, association_id, category, pattern_type, open_divisions, sort_order) VALUES
('Western Riding', 'ApHC', 'pattern_and_scoresheet', 'rulebook', false, 11),
('Reining', 'ApHC', 'pattern_and_scoresheet', 'rulebook', false, 12),
('Working Cow Horse', 'ApHC', 'pattern_and_scoresheet', 'rulebook', false, 13),
('Ranch Riding', 'ApHC', 'pattern_and_scoresheet', 'rulebook', false, 14),
('Ranch Reining', 'ApHC', 'pattern_and_scoresheet', 'rulebook', false, 15);

-- Insert ApHC Score Sheet Only Disciplines
INSERT INTO disciplines (name, association_id, category, pattern_type, open_divisions, sort_order) VALUES
('Western Pleasure', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 16),
('Ranch Rail Pleasure', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 17),
('Hunter Under Saddle', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 18),
('Hunter in Hand', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 19),
('Barrel Racing', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 20),
('Pole Bending', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 21),
('Figure 8 Stake Race', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 22),
('Camas Prairie Stump Race', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 23),
('Keyhole Race', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 24),
('Cutting', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 25),
('Boxing', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 26),
('Team Penning', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 27),
('Ranch Sorting', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 28),
('Heading', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 29),
('Heeling', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 30),
('Steer Stopping', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 31),
('Pleasure Driving', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 32),
('Halter', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 33),
('Yearling Longe line', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 34),
('Heritage Class', 'ApHC', 'scoresheet_only', 'scoresheet_only', false, 35);