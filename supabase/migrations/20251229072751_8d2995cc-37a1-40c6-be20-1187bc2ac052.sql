-- Add NRHA discipline: Reining (Rulebook pattern)
INSERT INTO disciplines (id, name, association_id, pattern_type, category, sort_order)
VALUES (gen_random_uuid(), 'Reining', 'NRHA', 'rulebook', 'Performance', 1);

-- Add NRHA divisions: Open, Non-Pro, Youth (no Amateur)
-- Open Division
CALL insert_division_data('NRHA', 'Open', 1, ARRAY[
  'Open Rookie',
  'Open Level 1',
  'Open Level 2',
  'Open Level 3',
  'Open Junior',
  'Open Junior Level 1',
  'Open Junior Level 2',
  'Open Junior Level 3',
  'Open Senior',
  'Open Senior Level 1',
  'Open Senior Level 2',
  'Open Senior Level 3'
]);

-- Non-Pro Division
CALL insert_division_data('NRHA', 'Non-Pro', 2, ARRAY[
  'Non-Pro',
  'Non-Pro Level 1',
  'Non-Pro Level 2',
  'Non-Pro Level 3'
]);

-- Youth Division
CALL insert_division_data('NRHA', 'Youth', 3, ARRAY[
  'Youth 13 & Under Rookie',
  'Youth 14–18 Rookie',
  'Youth 13 & Under Level 1',
  'Youth 14–18 Level 1',
  'Youth 13 & Under Level 2',
  'Youth 14–18 Level 2',
  'Youth 13 & Under Level 3',
  'Youth 14–18 Level 3',
  'Small Fry (9 & Under)',
  'Walk-Trot Youth 13 & Under',
  'Walk-Trot Youth 14–18',
  'Youth 14–18',
  'Youth 18 & Under Level 3',
  'Youth 18 & Under Level 2',
  'Youth 13 & Under',
  'Youth 18 & Under Rookie',
  'Youth 18 & Under',
  'Walk-Trot Youth 18 & Under',
  'Youth 18 & Under Level 1'
]);