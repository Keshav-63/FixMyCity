-- Create storage bucket for complaint images
INSERT INTO storage.buckets (id, name, public)
VALUES ('sem6_fixmycity', 'sem6_fixmycity', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (makes script re-runnable)
DROP POLICY IF EXISTS "complaint_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "complaint_images_select" ON storage.objects;
DROP POLICY IF EXISTS "complaint_images_delete" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "complaint_images_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sem6_fixmycity');

-- Allow public read access to images
CREATE POLICY "complaint_images_select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'sem6_fixmycity');

-- Allow users to delete their own uploads
CREATE POLICY "complaint_images_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'sem6_fixmycity' AND (storage.foldername(name))[1] = auth.uid()::text);
