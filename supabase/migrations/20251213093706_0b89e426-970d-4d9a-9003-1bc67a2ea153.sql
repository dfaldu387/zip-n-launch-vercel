-- Add pattern_version column to tbl_patterns table
ALTER TABLE public.tbl_patterns 
ADD COLUMN pattern_version TEXT DEFAULT NULL;