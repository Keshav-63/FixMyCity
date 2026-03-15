-- Create storage bucket for complaint images
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-images', 'complaint-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "complaint_images_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'complaint-images');

-- Allow public read access to images
CREATE POLICY "complaint_images_select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'complaint-images');

-- Allow users to delete their own uploads
CREATE POLICY "complaint_images_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'complaint-images' AND (storage.foldername(name))[1] = auth.uid()::text);
