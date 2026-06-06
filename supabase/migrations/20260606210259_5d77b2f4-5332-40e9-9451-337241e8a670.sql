
CREATE POLICY "Authenticated can view cost-photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cost-photos');

CREATE POLICY "Authenticated can upload cost-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cost-photos');

CREATE POLICY "Authenticated can delete cost-photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cost-photos');
