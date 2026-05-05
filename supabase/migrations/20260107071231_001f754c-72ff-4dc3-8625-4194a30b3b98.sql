-- Rename file_url column to city_state in tbl_scoresheet
ALTER TABLE public.tbl_scoresheet 
RENAME COLUMN file_url TO city_state;