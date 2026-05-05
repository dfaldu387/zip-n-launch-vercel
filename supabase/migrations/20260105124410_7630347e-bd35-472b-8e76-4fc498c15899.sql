-- Add city column to disciplines table
ALTER TABLE public.disciplines ADD COLUMN IF NOT EXISTS city text;

-- Insert Kansas 4-H disciplines
INSERT INTO public.disciplines (name, association_id, category, pattern_type, city, open_divisions) VALUES
('Showmanship', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Trail', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Western Horsemanship', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Reining', '4-H', 'pattern_and_scoresheet', 'rulebook', 'Kansas', false),
('Ranch Pattern', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Ranch Trail', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Equitation Hunt Seat', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Hunt Seat Equitation', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false),
('Hunter Hack', '4-H', 'scoresheet_only', 'none', 'Kansas', false),
('Saddle Seat Equitation', '4-H', 'pattern_and_scoresheet', 'custom', 'Kansas', false);

-- Insert Texas 4-H disciplines
INSERT INTO public.disciplines (name, association_id, category, pattern_type, city, open_divisions) VALUES
('Showmanship', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Western Horsemanship', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Trail', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('In-Hand Trail', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Hunt Seat Equitation', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Hunter Hack', '4-H', 'scoresheet_only', 'none', 'Texas', true),
('Working Hunter', '4-H', 'scoresheet_only', 'none', 'Texas', true),
('Jumping', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Equitation over Fences', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Tie-Down', '4-H', 'scoresheet_only', 'none', 'Texas', true),
('Heading', '4-H', 'scoresheet_only', 'none', 'Texas', true),
('Heeling', '4-H', 'scoresheet_only', 'none', 'Texas', true),
('Working Cow Horse', '4-H', 'pattern_and_scoresheet', 'rulebook', 'Texas', true),
('Cutting', '4-H', 'scoresheet_only', 'none', 'Texas', true),
('Reining', '4-H', 'pattern_and_scoresheet', 'rulebook', 'Texas', true),
('Stock Horse Trail', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Stock Horse Horsemanship', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true),
('Stock Horse Showmanship', '4-H', 'pattern_and_scoresheet', 'custom', 'Texas', true);

-- Insert Kansas 4-H divisions
INSERT INTO public.divisions (name, association_id, sub_association_type, sort_order) VALUES
('Youth - Juniors 7-8', '4-H', 'Kansas', 1),
('Youth - Intermediates 9-13', '4-H', 'Kansas', 2),
('Youth - Seniors 14-18', '4-H', 'Kansas', 3);

-- Texas divisions will use "Add Levels" button (open_divisions = true), so no preset divisions needed