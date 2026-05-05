-- First add AQHA to ep_associations if not exists
INSERT INTO public.ep_associations (id, name, rulebook_url, season_year, meta)
VALUES 
  (gen_random_uuid(), 'AQHA - American Quarter Horse Association', 'https://www.aqha.com/rulebook', 2024, '{"abbreviation": "AQHA"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Add Western Riding patterns with ALL and L1 versions
-- Pattern Set 1
INSERT INTO public.ep_patterns (title, code, discipline, division, level, level_category, pattern_set_number, status, source, association_id)
VALUES 
  ('Western Riding Pattern 1', 'WR-1-ALL', 'Western Riding', 'Open', 'All Levels', 'ALL', 1, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Western Riding Pattern 1 - L1', 'WR-1-L1', 'Western Riding', 'Open', 'Level 1', 'L1', 1, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  
  -- Pattern Set 2
  ('Western Riding Pattern 2', 'WR-2-ALL', 'Western Riding', 'Open', 'All Levels', 'ALL', 2, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Western Riding Pattern 2 - L1', 'WR-2-L1', 'Western Riding', 'Open', 'Level 1', 'L1', 2, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  
  -- Pattern Set 3
  ('Western Riding Pattern 3', 'WR-3-ALL', 'Western Riding', 'Open', 'All Levels', 'ALL', 3, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Western Riding Pattern 3 - L1', 'WR-3-L1', 'Western Riding', 'Open', 'Level 1', 'L1', 3, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  
  -- Pattern Set 4 (ALL only - no L1 version)
  ('Western Riding Pattern 4', 'WR-4-ALL', 'Western Riding', 'Open', 'All Levels', 'ALL', 4, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  
  -- Pattern Set 5 
  ('Western Riding Pattern 5', 'WR-5-ALL', 'Western Riding', 'Open', 'All Levels', 'ALL', 5, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Western Riding Pattern 5 - L1', 'WR-5-L1', 'Western Riding', 'Open', 'Level 1', 'L1', 5, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1));

-- Also add Trail patterns as another discipline example
INSERT INTO public.ep_patterns (title, code, discipline, division, level, level_category, pattern_set_number, status, source, association_id)
VALUES 
  ('Trail Pattern 1', 'TR-1-ALL', 'Trail', 'Open', 'All Levels', 'ALL', 101, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Trail Pattern 1 - L1', 'TR-1-L1', 'Trail', 'Open', 'Level 1', 'L1', 101, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Trail Pattern 2', 'TR-2-ALL', 'Trail', 'Open', 'All Levels', 'ALL', 102, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1)),
  ('Trail Pattern 2 - L1', 'TR-2-L1', 'Trail', 'Open', 'Level 1', 'L1', 102, 'approved', 'AQHA Rulebook 2024', (SELECT id FROM ep_associations WHERE name ILIKE '%AQHA%' LIMIT 1));