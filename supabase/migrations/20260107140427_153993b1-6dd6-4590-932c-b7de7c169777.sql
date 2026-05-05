-- Add mode column to projects table
ALTER TABLE public.projects 
ADD COLUMN mode text;