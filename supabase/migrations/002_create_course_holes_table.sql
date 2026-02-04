-- Create course_holes table to store par and stroke index for each hole
CREATE TABLE IF NOT EXISTS course_holes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  par INTEGER NOT NULL CHECK (par >= 3 AND par <= 6),
  stroke_index INTEGER NOT NULL CHECK (stroke_index >= 1 AND stroke_index <= 18),
  distance_yards INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure each hole number is unique per course
  UNIQUE(course_id, hole_number)
);

-- Create index for faster lookups by course_id
CREATE INDEX IF NOT EXISTS idx_course_holes_course_id ON course_holes(course_id);

-- Enable Row Level Security
ALTER TABLE course_holes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read course holes
CREATE POLICY "Allow authenticated users to read course_holes"
ON course_holes FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert course holes
CREATE POLICY "Allow authenticated users to insert course_holes"
ON course_holes FOR INSERT
TO authenticated
WITH CHECK (true);
