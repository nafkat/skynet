-- =====================================================
-- SKYNET PERMISSIONS RESET V2
-- Base Roles: Admin, Employee (only)
-- HR/Timekeeper become permission templates
-- =====================================================

-- Step 1: Create new app_role enum with only Admin and Employee
-- We need to handle this carefully due to existing dependencies

-- First, create a new enum type
CREATE TYPE public.app_role_v2 AS ENUM ('admin', 'employee');

-- Step 2: Add base_role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS base_role text CHECK (base_role IN ('admin', 'employee')) DEFAULT 'employee';

-- Step 3: Create permission_template_permissions table (key-value based)
CREATE TABLE IF NOT EXISTS public.permission_template_permissions (
  template_id uuid REFERENCES public.permission_templates(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  PRIMARY KEY (template_id, permission_key)
);

-- Enable RLS on the new table
ALTER TABLE public.permission_template_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for permission_template_permissions
CREATE POLICY "Admins can view permission template permissions"
  ON public.permission_template_permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage permission template permissions"
  ON public.permission_template_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 4: Create user_permissions cache table for effective permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

-- Enable RLS on user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_permissions
CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user permissions"
  ON public.user_permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user permissions"
  ON public.user_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 5: Update existing admin user (nafkat@gmail.com) to have base_role = 'admin'
UPDATE public.profiles 
SET base_role = 'admin' 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'nafkat@gmail.com'
);

-- Step 6: Create function to check user permission by key
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin base_role has all permissions
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = _user_id AND base_role = 'admin'
    ) THEN true
    ELSE COALESCE(
      (SELECT allowed FROM public.user_permissions 
       WHERE user_id = _user_id AND permission_key = _permission_key),
      false
    )
  END
$$;

-- Step 7: Create function to check if user is admin (by base_role)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT base_role = 'admin' FROM public.profiles WHERE user_id = _user_id),
    false
  )
$$;

-- Step 8: Create function to recompute user permissions from assigned templates
CREATE OR REPLACE FUNCTION public.recompute_user_permissions(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear existing permissions
  DELETE FROM public.user_permissions WHERE user_id = _user_id;
  
  -- Insert union of all permissions from assigned templates
  INSERT INTO public.user_permissions (user_id, permission_key, allowed, updated_at)
  SELECT 
    _user_id,
    ptp.permission_key,
    bool_or(ptp.allowed), -- Union: if any template allows, it's allowed
    now()
  FROM public.user_permission_templates upt
  JOIN public.permission_template_permissions ptp ON ptp.template_id = upt.template_id
  WHERE upt.user_id = _user_id
  GROUP BY ptp.permission_key;
END;
$$;

-- Step 9: Seed the permission catalog into modules and module_actions tables
-- First, ensure modules exist
INSERT INTO public.modules (key, name, is_active) VALUES
  ('timekeeping', 'Timekeeping', true),
  ('procurement', 'Procurement', true),
  ('announcements', 'Announcements', true),
  ('admin_console', 'Admin Console', true)
ON CONFLICT (key) DO UPDATE SET is_active = true;

-- Clear old module_actions and insert new standardized ones
DELETE FROM public.module_actions WHERE module_key IN ('timekeeping', 'procurement', 'announcements', 'admin_console');

INSERT INTO public.module_actions (module_key, action_key, description) VALUES
  -- Timekeeping actions
  ('timekeeping', 'timekeeping.entries.view', 'View time entries'),
  ('timekeeping', 'timekeeping.entries.create', 'Create time entries'),
  ('timekeeping', 'timekeeping.entries.edit', 'Edit time entries'),
  ('timekeeping', 'timekeeping.entries.delete_24h', 'Delete entries within 24 hours'),
  ('timekeeping', 'timekeeping.entries.request_delete', 'Request deletion of older entries'),
  ('timekeeping', 'timekeeping.entries.approve_requests', 'Approve/reject deletion requests'),
  ('timekeeping', 'timekeeping.employees.view', 'View employees'),
  ('timekeeping', 'timekeeping.employees.manage', 'Manage employees'),
  ('timekeeping', 'timekeeping.projects.view', 'View projects'),
  ('timekeeping', 'timekeeping.projects.manage', 'Manage projects'),
  ('timekeeping', 'timekeeping.reports.view', 'View reports'),
  ('timekeeping', 'timekeeping.reports.export', 'Export reports'),
  -- Procurement actions
  ('procurement', 'procurement.ro.view', 'View request offers'),
  ('procurement', 'procurement.ro.create', 'Create request offers'),
  ('procurement', 'procurement.ro.send_email', 'Send RO emails'),
  ('procurement', 'procurement.suppliers.view', 'View suppliers'),
  ('procurement', 'procurement.suppliers.manage', 'Manage suppliers'),
  ('procurement', 'procurement.reports.view', 'View procurement reports'),
  -- Announcements actions
  ('announcements', 'announcements.view', 'View announcements'),
  ('announcements', 'announcements.create', 'Create announcements'),
  ('announcements', 'announcements.send', 'Send announcements'),
  -- Admin Console actions
  ('admin_console', 'admin.users.manage', 'Manage users'),
  ('admin_console', 'admin.roles.manage', 'Manage roles/templates'),
  ('admin_console', 'admin.audit.view', 'View audit logs'),
  ('admin_console', 'admin.settings.manage', 'Manage system settings');

-- Step 10: Seed initial permission templates
-- Template 1: Timekeeping – Employee
INSERT INTO public.permission_templates (id, name, description, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'Timekeeping – Employee', 'Basic timekeeping access for employees', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('11111111-1111-1111-1111-111111111111', 'module.timekeeping', true),
  ('11111111-1111-1111-1111-111111111111', 'timekeeping.entries.view', true),
  ('11111111-1111-1111-1111-111111111111', 'timekeeping.entries.create', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Template 2: Timekeeping – Timekeeper
INSERT INTO public.permission_templates (id, name, description, created_at, updated_at)
VALUES ('22222222-2222-2222-2222-222222222222', 'Timekeeping – Timekeeper', 'Full timekeeping access for timekeepers', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('22222222-2222-2222-2222-222222222222', 'module.timekeeping', true),
  ('22222222-2222-2222-2222-222222222222', 'timekeeping.entries.view', true),
  ('22222222-2222-2222-2222-222222222222', 'timekeeping.entries.create', true),
  ('22222222-2222-2222-2222-222222222222', 'timekeeping.entries.edit', true),
  ('22222222-2222-2222-2222-222222222222', 'timekeeping.entries.delete_24h', true),
  ('22222222-2222-2222-2222-222222222222', 'timekeeping.entries.request_delete', true),
  ('22222222-2222-2222-2222-222222222222', 'timekeeping.projects.view', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Template 3: Timekeeping – HR
INSERT INTO public.permission_templates (id, name, description, created_at, updated_at)
VALUES ('33333333-3333-3333-3333-333333333333', 'Timekeeping – HR', 'HR access for timekeeping management', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('33333333-3333-3333-3333-333333333333', 'module.timekeeping', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.entries.view', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.entries.approve_requests', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.employees.view', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.employees.manage', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.projects.view', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.projects.manage', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.reports.view', true),
  ('33333333-3333-3333-3333-333333333333', 'timekeeping.reports.export', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Template 4: Procurement – User
INSERT INTO public.permission_templates (id, name, description, created_at, updated_at)
VALUES ('44444444-4444-4444-4444-444444444444', 'Procurement – User', 'Basic procurement access', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('44444444-4444-4444-4444-444444444444', 'module.procurement', true),
  ('44444444-4444-4444-4444-444444444444', 'procurement.ro.view', true),
  ('44444444-4444-4444-4444-444444444444', 'procurement.ro.create', true),
  ('44444444-4444-4444-4444-444444444444', 'procurement.ro.send_email', true),
  ('44444444-4444-4444-4444-444444444444', 'procurement.suppliers.view', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Template 5: Procurement – Admin
INSERT INTO public.permission_templates (id, name, description, created_at, updated_at)
VALUES ('55555555-5555-5555-5555-555555555555', 'Procurement – Admin', 'Full procurement management access', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('55555555-5555-5555-5555-555555555555', 'module.procurement', true),
  ('55555555-5555-5555-5555-555555555555', 'procurement.ro.view', true),
  ('55555555-5555-5555-5555-555555555555', 'procurement.ro.create', true),
  ('55555555-5555-5555-5555-555555555555', 'procurement.ro.send_email', true),
  ('55555555-5555-5555-5555-555555555555', 'procurement.suppliers.view', true),
  ('55555555-5555-5555-5555-555555555555', 'procurement.suppliers.manage', true),
  ('55555555-5555-5555-5555-555555555555', 'procurement.reports.view', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- Template 6: Announcements – Manager
INSERT INTO public.permission_templates (id, name, description, created_at, updated_at)
VALUES ('66666666-6666-6666-6666-666666666666', 'Announcements – Manager', 'Create and send announcements', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('66666666-6666-6666-6666-666666666666', 'module.announcements', true),
  ('66666666-6666-6666-6666-666666666666', 'announcements.view', true),
  ('66666666-6666-6666-6666-666666666666', 'announcements.create', true),
  ('66666666-6666-6666-6666-666666666666', 'announcements.send', true)
ON CONFLICT (template_id, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;