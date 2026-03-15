-- Civic Issue Reporter Database Schema

-- 1. User profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- 2. Complaints (civic issues)
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pothole', 'water', 'trash', 'electrical', 'road', 'other')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  upvote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "complaints_select_all" ON complaints;
DROP POLICY IF EXISTS "complaints_insert_auth" ON complaints;
DROP POLICY IF EXISTS "complaints_update_own" ON complaints;
DROP POLICY IF EXISTS "complaints_delete_own" ON complaints;

CREATE POLICY "complaints_select_all" ON complaints FOR SELECT USING (true);
CREATE POLICY "complaints_insert_auth" ON complaints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "complaints_update_own" ON complaints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "complaints_delete_own" ON complaints FOR DELETE USING (auth.uid() = user_id);

-- 3. Upvotes (one per user per complaint)
CREATE TABLE IF NOT EXISTS upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, complaint_id)
);

ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upvotes_select_all" ON upvotes;
DROP POLICY IF EXISTS "upvotes_insert_auth" ON upvotes;
DROP POLICY IF EXISTS "upvotes_delete_own" ON upvotes;

CREATE POLICY "upvotes_select_all" ON upvotes FOR SELECT USING (true);
CREATE POLICY "upvotes_insert_auth" ON upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upvotes_delete_own" ON upvotes FOR DELETE USING (auth.uid() = user_id);

-- 4. Comments/Discussions
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_all" ON comments;
DROP POLICY IF EXISTS "comments_insert_auth" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;

CREATE POLICY "comments_select_all" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints (category);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints (user_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_complaint ON upvotes (complaint_id);
CREATE INDEX IF NOT EXISTS idx_comments_complaint ON comments (complaint_id);
