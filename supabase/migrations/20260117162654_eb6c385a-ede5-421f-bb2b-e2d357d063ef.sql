-- =============================================
-- PART A: PERMISSIONS DATA MODEL
-- =============================================

-- 1) TABLE: modules (static list of available modules)
CREATE TABLE public.modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view modules"
  ON public.modules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage modules"
  ON public.modules FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Seed modules
INSERT INTO public.modules (key, name, is_active) VALUES
  ('timekeeping', 'Timekeeping', true),
  ('admin_console', 'Admin Console', true);

-- 2) TABLE: user_module_access
CREATE TABLE public.user_module_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
  can_access boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_key)
);

ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own module access"
  ON public.user_module_access FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all module access"
  ON public.user_module_access FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage module access"
  ON public.user_module_access FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- 3) TABLE: module_actions
CREATE TABLE public.module_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
  action_key text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.module_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view module actions"
  ON public.module_actions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage module actions"
  ON public.module_actions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Seed Timekeeping actions
INSERT INTO public.module_actions (module_key, action_key, description) VALUES
  ('timekeeping', 'timekeeping.entries.view', 'View time entries'),
  ('timekeeping', 'timekeeping.entries.create', 'Create time entries'),
  ('timekeeping', 'timekeeping.entries.edit', 'Edit time entries'),
  ('timekeeping', 'timekeeping.entries.delete_24h', 'Delete entries within 24 hours'),
  ('timekeeping', 'timekeeping.entries.request_delete_after_24h', 'Request deletion after 24 hours'),
  ('timekeeping', 'timekeeping.entries.approve_requests', 'Approve correction/deletion requests'),
  ('timekeeping', 'timekeeping.employees.manage', 'Manage employees'),
  ('timekeeping', 'timekeeping.projects.view', 'View projects'),
  ('timekeeping', 'timekeeping.projects.manage', 'Manage projects'),
  ('timekeeping', 'timekeeping.reports.view', 'View reports'),
  ('timekeeping', 'timekeeping.reports.export', 'Export reports/payroll');

-- 4) TABLE: user_module_actions
CREATE TABLE public.user_module_actions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_key text NOT NULL REFERENCES public.module_actions(action_key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_key)
);

ALTER TABLE public.user_module_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own action permissions"
  ON public.user_module_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all action permissions"
  ON public.user_module_actions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage action permissions"
  ON public.user_module_actions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- PART B: PERMISSION AUDIT LOG
-- =============================================

CREATE TABLE public.permission_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  change_type text NOT NULL CHECK (change_type IN ('ROLE_CHANGE', 'MODULE_ACCESS', 'ACTION_PERMISSION')),
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view permission audit logs"
  ON public.permission_audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert permission audit logs"
  ON public.permission_audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================
-- HELPER FUNCTION: Check if user has action permission
-- =============================================

CREATE OR REPLACE FUNCTION public.has_action_permission(_user_id uuid, _action_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT allowed FROM public.user_module_actions WHERE user_id = _user_id AND action_key = _action_key),
    false
  )
$$;

-- =============================================
-- HELPER FUNCTION: Check if user has module access
-- =============================================

CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT can_access FROM public.user_module_access WHERE user_id = _user_id AND module_key = _module_key),
    false
  )
$$;

-- =============================================
-- FUNCTION: Initialize default permissions for a user based on role
-- =============================================

CREATE OR REPLACE FUNCTION public.initialize_user_permissions(_user_id uuid, _role app_role, _granted_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing permissions
  DELETE FROM public.user_module_access WHERE user_id = _user_id;
  DELETE FROM public.user_module_actions WHERE user_id = _user_id;

  -- Set module access based on role
  IF _role = 'admin' THEN
    -- Admin gets access to all modules
    INSERT INTO public.user_module_access (user_id, module_key, can_access, granted_by)
    SELECT _user_id, key, true, _granted_by
    FROM public.modules WHERE is_active = true;
    
    -- Admin gets all actions
    INSERT INTO public.user_module_actions (user_id, action_key, allowed, granted_by)
    SELECT _user_id, action_key, true, _granted_by
    FROM public.module_actions;
  ELSE
    -- HR and Timekeeper: only timekeeping module
    INSERT INTO public.user_module_access (user_id, module_key, can_access, granted_by)
    VALUES (_user_id, 'timekeeping', true, _granted_by);
    
    -- Admin console explicitly off
    INSERT INTO public.user_module_access (user_id, module_key, can_access, granted_by)
    VALUES (_user_id, 'admin_console', false, _granted_by);
    
    IF _role = 'hr' THEN
      -- HR gets all timekeeping actions
      INSERT INTO public.user_module_actions (user_id, action_key, allowed, granted_by)
      SELECT _user_id, action_key, true, _granted_by
      FROM public.module_actions WHERE module_key = 'timekeeping';
    ELSE
      -- Timekeeper gets limited actions
      INSERT INTO public.user_module_actions (user_id, action_key, allowed, granted_by)
      SELECT _user_id, action_key, 
        CASE 
          WHEN action_key IN (
            'timekeeping.entries.view',
            'timekeeping.entries.create',
            'timekeeping.entries.edit',
            'timekeeping.entries.delete_24h',
            'timekeeping.entries.request_delete_after_24h',
            'timekeeping.projects.view',
            'timekeeping.reports.view'
          ) THEN true
          ELSE false
        END,
        _granted_by
      FROM public.module_actions WHERE module_key = 'timekeeping';
    END IF;
  END IF;
END;
$$;