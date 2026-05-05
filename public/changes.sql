-- Add sub_association_type to discipline_associations
    ALTER TABLE public.discipline_associations
    ADD COLUMN IF NOT EXISTS sub_association_type TEXT;

    -- Add a unique constraint to avoid duplicates
    ALTER TABLE public.discipline_associations
    ADD CONSTRAINT discipline_associations_unique UNIQUE (discipline_id, association_id, sub_association_type);