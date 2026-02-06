-- Create admin_squads table to establish many-to-many relationship between admins and squads
-- One admin can view multiple squads; one squad can be viewed by multiple admins
CREATE TABLE IF NOT EXISTS admin_squads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each admin can only be assigned to a squad once
  UNIQUE(admin_id, squad_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_squads_admin_id ON admin_squads(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_squads_squad_id ON admin_squads(squad_id);

-- Enable Row Level Security
ALTER TABLE admin_squads ENABLE ROW LEVEL SECURITY;

-- Allow admins to read their own squad assignments
CREATE POLICY "Admins can read own squad assignments"
ON admin_squads FOR SELECT
TO authenticated
USING (
  admin_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Super Admin'
  )
);

-- Allow Super Admins to insert admin-squad assignments
CREATE POLICY "Super Admins can insert admin squad assignments"
ON admin_squads FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Super Admin'
  )
);

-- Allow Super Admins to delete admin-squad assignments
CREATE POLICY "Super Admins can delete admin squad assignments"
ON admin_squads FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Super Admin'
  )
);
