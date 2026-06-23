
CREATE POLICY "Authenticated can view company logos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-logos');

CREATE POLICY "Elevated can upload company logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND public.has_elevated_role(auth.uid()));

CREATE POLICY "Elevated can update company logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND public.has_elevated_role(auth.uid()));

CREATE POLICY "Elevated can delete company logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND public.has_elevated_role(auth.uid()));
