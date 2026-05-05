-- Create judge_favorites table for storing judge's favorite patterns
CREATE TABLE IF NOT EXISTS judge_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    association_id TEXT NOT NULL,
    discipline_id TEXT NOT NULL,
    class_id TEXT,
    pattern_id INTEGER NOT NULL,
    rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 3),
    creator_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by judge
CREATE INDEX IF NOT EXISTS idx_judge_favorites_judge_id ON judge_favorites(judge_id);

-- Unique constraint: one judge can only assign each rank once per association+discipline+class
CREATE UNIQUE INDEX IF NOT EXISTS idx_judge_favorites_unique_rank
    ON judge_favorites(judge_id, association_id, discipline_id, COALESCE(class_id, ''), rank);

-- Enable RLS
ALTER TABLE judge_favorites ENABLE ROW LEVEL SECURITY;

-- Judges can read their own favorites
CREATE POLICY "Users can view own favorites" ON judge_favorites
    FOR SELECT USING (auth.uid() = judge_id);

-- Judges can insert their own favorites
CREATE POLICY "Users can insert own favorites" ON judge_favorites
    FOR INSERT WITH CHECK (auth.uid() = judge_id);

-- Judges can update their own favorites
CREATE POLICY "Users can update own favorites" ON judge_favorites
    FOR UPDATE USING (auth.uid() = judge_id);

-- Judges can delete their own favorites
CREATE POLICY "Users can delete own favorites" ON judge_favorites
    FOR DELETE USING (auth.uid() = judge_id);
