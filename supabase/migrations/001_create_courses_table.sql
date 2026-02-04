-- Create courses table for course database
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  par INTEGER NOT NULL DEFAULT 72,
  rating DECIMAL(4,1),
  slope INTEGER,
  tees TEXT DEFAULT 'White',
  course_type TEXT CHECK (course_type IN ('Links', 'Parkland', 'Heath', 'Cliffside')),
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster name searches
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(name);

-- Enable Row Level Security
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read courses
CREATE POLICY "Allow authenticated users to read courses"
ON courses FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert new courses
CREATE POLICY "Allow authenticated users to insert courses"
ON courses FOR INSERT
TO authenticated
WITH CHECK (true);

-- Insert some initial courses (Irish courses)
INSERT INTO courses (name, par, rating, slope, tees, course_type, location) VALUES
('Portmarnock Golf Club', 72, 73.3, 133, 'Championship', 'Links', 'Portmarnock, Dublin'),
('Royal Dublin Golf Club', 72, 73.0, 130, 'Championship', 'Links', 'Dollymount, Dublin'),
('The Island Golf Club', 71, 72.5, 128, 'Championship', 'Links', 'Donabate, Dublin'),
('Malahide Golf Club', 71, 71.8, 126, 'Championship', 'Parkland', 'Malahide, Dublin'),
('Howth Golf Club', 72, 70.5, 124, 'White', 'Heath', 'Howth, Dublin'),
('Sutton Golf Club', 68, 67.2, 118, 'White', 'Links', 'Sutton, Dublin'),
('St. Annes Golf Club', 70, 69.8, 122, 'White', 'Links', 'Dollymount, Dublin'),
('Clontarf Golf Club', 69, 68.5, 120, 'White', 'Parkland', 'Clontarf, Dublin'),
('Elm Park Golf Club', 69, 68.9, 121, 'White', 'Parkland', 'Donnybrook, Dublin'),
('Milltown Golf Club', 71, 71.2, 125, 'White', 'Parkland', 'Milltown, Dublin')
ON CONFLICT DO NOTHING;
