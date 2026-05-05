-- Add columns to tbl_scoresheet for scoresheet data connected to patterns
ALTER TABLE public.tbl_scoresheet 
ADD COLUMN IF NOT EXISTS pattern_id BIGINT REFERENCES public.tbl_patterns(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS association_abbrev TEXT,
ADD COLUMN IF NOT EXISTS pattern_version TEXT,
ADD COLUMN IF NOT EXISTS discipline TEXT;

-- Create index for faster lookups by pattern_id
CREATE INDEX IF NOT EXISTS idx_tbl_scoresheet_pattern_id ON public.tbl_scoresheet(pattern_id);

-- Create index for faster lookups by file_name
CREATE INDEX IF NOT EXISTS idx_tbl_scoresheet_file_name ON public.tbl_scoresheet(file_name);

-- Add RLS policies
ALTER TABLE public.tbl_scoresheet ENABLE ROW LEVEL SECURITY;

-- Public can view scoresheets
CREATE POLICY "Public can view scoresheets" ON public.tbl_scoresheet
FOR SELECT USING (true);

-- Admins can manage scoresheets
CREATE POLICY "Admins can manage scoresheets" ON public.tbl_scoresheet
FOR ALL USING (is_admin()) WITH CHECK (is_admin());