-- Add maneuvers_range column to tbl_patterns table
ALTER TABLE public.tbl_patterns 
ADD COLUMN maneuvers_range TEXT DEFAULT NULL;