
-- Clean orphan template assignments for users that no longer exist in auth.users
DELETE FROM public.user_permission_templates upt
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = upt.user_id);

-- Also clean orphan user_roles, user_permissions, user_module_access, user_module_actions
DELETE FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);
DELETE FROM public.user_permissions up
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = up.user_id);
DELETE FROM public.user_module_access uma
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = uma.user_id);
DELETE FROM public.user_module_actions umact
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = umact.user_id);

-- 1. Add base_role column to permission_templates
ALTER TABLE public.permission_templates 
  ADD COLUMN IF NOT EXISTS base_role app_role NOT NULL DEFAULT 'timekeeper';

-- 2. Backfill base_role for known templates
UPDATE public.permission_templates SET base_role = 'hr'        WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.permission_templates SET base_role = 'hr'        WHERE id = '66666666-6666-6666-6666-666666666666';
UPDATE public.permission_templates SET base_role = 'admin'     WHERE id = '55555555-5555-5555-5555-555555555555';
UPDATE public.permission_templates SET base_role = 'timekeeper' WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444',
  '69f0ce28-8baf-4dba-8255-aed36eae29b2'
);

-- 3. Helper function
CREATE OR REPLACE FUNCTION public.compute_user_role_from_templates(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pt.base_role
      FROM public.user_permission_templates upt
      JOIN public.permission_templates pt ON pt.id = upt.template_id
      WHERE upt.user_id = _user_id
      ORDER BY CASE pt.base_role
                 WHEN 'admin'      THEN 3
                 WHEN 'hr'         THEN 2
                 WHEN 'timekeeper' THEN 1
               END DESC
      LIMIT 1
    ),
    'timekeeper'::app_role
  )
$$;

-- 4. Trigger function
CREATE OR REPLACE FUNCTION public.sync_user_role_from_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_new_role app_role;
  v_granted_by uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_granted_by := COALESCE(NEW.assigned_by, OLD.assigned_by, auth.uid());

  -- Skip if user no longer exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_new_role := public.compute_user_role_from_templates(v_user_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, v_new_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  PERFORM public.recompute_user_permissions(v_user_id);
  PERFORM public.initialize_user_permissions(v_user_id, v_new_role, v_granted_by);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Unique constraint for upsert on user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_unique'
  ) THEN
    DELETE FROM public.user_roles a
    USING public.user_roles b
    WHERE a.ctid < b.ctid AND a.user_id = b.user_id;

    ALTER TABLE public.user_roles 
      ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 6. Create trigger
DROP TRIGGER IF EXISTS trg_sync_role_on_template_assign ON public.user_permission_templates;
CREATE TRIGGER trg_sync_role_on_template_assign
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_templates
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_from_templates();

-- 7. One-time backfill
DO $$
DECLARE
  r RECORD;
  v_role app_role;
BEGIN
  FOR r IN 
    SELECT DISTINCT upt.user_id 
    FROM public.user_permission_templates upt
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = upt.user_id)
  LOOP
    v_role := public.compute_user_role_from_templates(r.user_id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (r.user_id, v_role)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

    PERFORM public.recompute_user_permissions(r.user_id);
    PERFORM public.initialize_user_permissions(r.user_id, v_role, NULL);
  END LOOP;
END $$;
