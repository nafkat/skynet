INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed)
VALUES ('88888888-8888-8888-8888-888888888888', 'costing.reports.approve', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = true;

-- Recompute permissions for all users with the Costing Manager template
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT user_id FROM public.user_permission_templates WHERE template_id = '88888888-8888-8888-8888-888888888888' LOOP
    PERFORM public.recompute_user_permissions(u);
  END LOOP;
END $$;