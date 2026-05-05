-- Add NRCHA disciplines
INSERT INTO disciplines (id, name, association_id, pattern_type, category, sort_order)
VALUES 
  (gen_random_uuid(), 'Herd Work', 'NRCHA', 'scoresheet', 'Performance', 1),
  (gen_random_uuid(), 'Rein Work', 'NRCHA', 'rulebook', 'Performance', 2),
  (gen_random_uuid(), 'Cow Work', 'NRCHA', 'scoresheet', 'Performance', 3),
  (gen_random_uuid(), 'Fence Work', 'NRCHA', 'scoresheet', 'Performance', 4),
  (gen_random_uuid(), 'Boxing', 'NRCHA', 'scoresheet', 'Performance', 5);

-- Add NRCHA divisions: Open, Non-Pro, Youth (no Amateur)
-- Open Division
CALL insert_division_data('NRCHA', 'Open', 1, ARRAY[
  'Open',
  'Open Intermediate',
  'Open Limited',
  'Open Futurity',
  'Open Derby'
]);

-- Non-Pro Division
CALL insert_division_data('NRCHA', 'Non-Pro', 2, ARRAY[
  'Non-Pro',
  'Non-Pro Intermediate',
  'Non-Pro Limited',
  'Non-Pro Futurity',
  'Non-Pro Derby'
]);

-- Youth Division
CALL insert_division_data('NRCHA', 'Youth', 3, ARRAY[
  'Youth',
  'Youth 13 & Under',
  'Youth 14-18'
]);