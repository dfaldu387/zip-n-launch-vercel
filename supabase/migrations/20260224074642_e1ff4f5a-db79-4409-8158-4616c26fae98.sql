-- Add module_name to discipline_equipment for optional module grouping
-- NULL = standard baseline kit, non-null = named optional module (e.g., 'Gate Kit', 'Signage Kit')
ALTER TABLE public.discipline_equipment
ADD COLUMN module_name text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.discipline_equipment.module_name IS 'Optional module grouping name. NULL means standard/baseline equipment. Non-null groups items into toggleable optional modules (e.g., Gate Kit, Measurement Kit, Signage Kit).';
