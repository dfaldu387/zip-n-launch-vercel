-- Remove disciplines for Florida, New York, Michigan, Indiana, Texas
DELETE FROM public.disciplines 
WHERE association_id = '4-H' 
AND city IN ('Florida', 'New York', 'Michigan', 'Indiana', 'Texas');

-- Remove divisions for these cities
DELETE FROM public.divisions 
WHERE association_id = '4-H' 
AND sub_association_type IN ('Florida', 'New York', 'Michigan', 'Indiana', 'Texas');