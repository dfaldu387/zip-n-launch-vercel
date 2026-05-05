-- Add level_category column (text to allow admin flexibility for ALL, L1, L2, etc.)
ALTER TABLE public.ep_patterns 
ADD COLUMN IF NOT EXISTS level_category text DEFAULT 'ALL';

-- Add pattern_set_number column for grouping patterns
ALTER TABLE public.ep_patterns 
ADD COLUMN IF NOT EXISTS pattern_set_number integer;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ep_patterns_level_category ON public.ep_patterns(level_category);
CREATE INDEX IF NOT EXISTS idx_ep_patterns_set_number ON public.ep_patterns(pattern_set_number);

-- Add a comment explaining the level_category
COMMENT ON COLUMN public.ep_patterns.level_category IS 'Pattern level category: ALL (universal), L1 (Level 1 simplified), L2, etc. Admin can create custom levels.';
COMMENT ON COLUMN public.ep_patterns.pattern_set_number IS 'Groups related patterns together (e.g., Pattern Set 1 contains ALL and L1 versions)';