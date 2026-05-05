-- Drop existing policies
DROP POLICY IF EXISTS "full" ON tbl_patterns;
DROP POLICY IF EXISTS "full" ON tbl_pattern_media;
DROP POLICY IF EXISTS "full" ON tbl_maneuvers;

-- Create new policies for authenticated users
CREATE POLICY "Allow all for authenticated users" ON tbl_patterns
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON tbl_pattern_media
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON tbl_maneuvers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow public read access
CREATE POLICY "Allow read for public" ON tbl_patterns
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow read for public" ON tbl_pattern_media
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow read for public" ON tbl_maneuvers
  FOR SELECT TO anon
  USING (true);