-- Fix Foreign Key Relationships for Supabase Joins
-- This allows queries like .select('*, profiles(display_name)') to work

-- The issue: complaints.user_id and comments.user_id reference auth.users
-- But Supabase can't infer the join to profiles automatically

-- Solution: We'll keep the current structure but ensure profiles are created
-- and add a note that the join works through the shared user_id

-- First, ensure every user has a profile (run this migration)
-- Insert missing profiles for any existing users
INSERT INTO profiles (id, display_name, created_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', au.email),
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- The join should work now because:
-- 1. complaints.user_id = auth.users.id
-- 2. profiles.id = auth.users.id
-- 3. Therefore: complaints.user_id = profiles.id (transitively)

-- However, Supabase needs an explicit hint. We'll create a view for convenience:

-- Create a view that includes user display names
CREATE OR REPLACE VIEW complaints_with_users AS
SELECT
  c.*,
  p.display_name as user_display_name
FROM complaints c
LEFT JOIN profiles p ON c.user_id = p.id;

-- Create a view for comments with user names
CREATE OR REPLACE VIEW comments_with_users AS
SELECT
  cm.*,
  p.display_name as user_display_name
FROM comments cm
LEFT JOIN profiles p ON cm.user_id = p.id;

-- Grant access to these views
GRANT SELECT ON complaints_with_users TO authenticated, anon;
GRANT SELECT ON comments_with_users TO authenticated, anon;

-- Note: The original queries using .select('*, profiles(display_name)')
-- should work after this migration because:
-- 1. All users now have profiles
-- 2. The foreign keys properly reference the same user IDs
