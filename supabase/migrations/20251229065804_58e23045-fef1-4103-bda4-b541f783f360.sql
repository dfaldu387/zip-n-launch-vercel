-- Add disciplines for SHTX (Stock Horse of Texas)
INSERT INTO disciplines (association_id, name, pattern_type, category, sort_order, open_divisions) VALUES 
('SHTX', 'Stock Horse Pleasure', 'scoresheet_only', 'scoresheet_only', 1, false),
('SHTX', 'Stock Horse Trail', 'custom', 'pattern_and_scoresheet', 2, false),
('SHTX', 'Reining', 'rulebook', 'pattern_and_scoresheet', 3, false),
('SHTX', 'Cow Work', 'scoresheet_only', 'scoresheet_only', 4, false);

-- Add divisions for SHTX (same as AQHA: Open, Amateur, Youth, Non-Pro)
INSERT INTO divisions (association_id, name, sort_order) VALUES 
('SHTX', 'Open', 1),
('SHTX', 'Amateur', 2),
('SHTX', 'Youth', 3),
('SHTX', 'Non-Pro', 4);