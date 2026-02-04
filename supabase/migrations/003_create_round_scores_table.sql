-- Create round_scores table to store individual hole scores for each round
-- This links a round to course_holes (reference data) and stores the actual strokes played
CREATE TABLE IF NOT EXISTS round_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  course_hole_id UUID NOT NULL REFERENCES course_holes(id) ON DELETE CASCADE,
  strokes INTEGER NOT NULL CHECK (strokes >= 1 AND strokes <= 20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each hole can only have one score per round
  UNIQUE(round_id, course_hole_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_round_scores_round_id ON round_scores(round_id);
CREATE INDEX IF NOT EXISTS idx_round_scores_course_hole_id ON round_scores(course_hole_id);

-- Enable Row Level Security
ALTER TABLE round_scores ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own round scores (via rounds table)
CREATE POLICY "Users can read own round_scores"
ON round_scores FOR SELECT
TO authenticated
USING (
  round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
);

-- Allow authenticated users to insert their own round scores
CREATE POLICY "Users can insert own round_scores"
ON round_scores FOR INSERT
TO authenticated
WITH CHECK (
  round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
);

-- Allow authenticated users to delete their own round scores
CREATE POLICY "Users can delete own round_scores"
ON round_scores FOR DELETE
TO authenticated
USING (
  round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
);
