-- Remove ALL 4-H disciplines
DELETE FROM public.disciplines 
WHERE association_id = '4-H';

-- Remove ALL 4-H divisions
DELETE FROM public.divisions 
WHERE association_id = '4-H';