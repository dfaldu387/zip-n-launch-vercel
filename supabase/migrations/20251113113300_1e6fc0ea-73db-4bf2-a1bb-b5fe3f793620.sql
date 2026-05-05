-- Add sort_order column to associations table
ALTER TABLE associations ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;