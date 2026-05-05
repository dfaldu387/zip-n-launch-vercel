-- Delete all existing AQHA disciplines
DELETE FROM disciplines WHERE association_id = 'AQHA';

-- Insert AQHA Custom Pattern Disciplines
INSERT INTO disciplines (name, association_id, category, pattern_type, open_divisions, sort_order) VALUES
('Showmanship at Halter (Youth & Amateur)', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 1),
('Horsemanship (Youth & Amateur)', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 2),
('Hunt Seat Equitation (Youth & Amateur)', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 3),
('Trail', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 4),
('Ranch Trail', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 5),
('Equitation Over Fences (Youth & Amateur)', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 6),
('Working Hunter', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 7),
('Hunter Hack', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 8),
('Jumping', 'AQHA', 'pattern_and_scoresheet', 'custom', false, 9);

-- Insert AQHA Rule Book Pattern Disciplines
INSERT INTO disciplines (name, association_id, category, pattern_type, open_divisions, sort_order) VALUES
('Western Riding', 'AQHA', 'pattern_and_scoresheet', 'rulebook', false, 10),
('Reining', 'AQHA', 'pattern_and_scoresheet', 'rulebook', false, 11),
('Ranch Riding', 'AQHA', 'pattern_and_scoresheet', 'rulebook', false, 12),
('Ranch Reining', 'AQHA', 'pattern_and_scoresheet', 'rulebook', false, 13),
('Working Cow Horse', 'AQHA', 'pattern_and_scoresheet', 'rulebook', false, 14);

-- Insert AQHA Score Sheet Only Disciplines
INSERT INTO disciplines (name, association_id, category, pattern_type, open_divisions, sort_order) VALUES
('Western Pleasure', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 15),
('Hunter Under Saddle', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 16),
('English Pleasure / Hunt Seat Pleasure', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 17),
('Ranch Rail Pleasure', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 18),
('Pleasure Driving', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 19),
('Barrel Racing', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 20),
('Pole Bending', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 21),
('Stake Race', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 22),
('Timed Speed Events', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 23),
('Boxing', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 24),
('Heading', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 25),
('Heeling', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 26),
('Steer Stopping', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 27),
('Tie-Down', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 28),
('Team roping', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 29),
('Breakaway roping', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 30),
('Team Penning', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 31),
('Ranch Sorting', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 32),
('Cutting', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 33),
('Halter', 'AQHA', 'scoresheet_only', 'scoresheet_only', false, 34);