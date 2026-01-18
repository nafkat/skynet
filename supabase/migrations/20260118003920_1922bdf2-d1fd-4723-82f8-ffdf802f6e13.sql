-- Fix foreign key constraint on permission_audit_logs to allow user deletion
-- We'll set the target_user_id to NULL when the referenced user is deleted
-- This preserves audit history while allowing user management

-- First, make the columns nullable if they aren't already
ALTER TABLE public.permission_audit_logs 
ALTER COLUMN target_user_id DROP NOT NULL;

ALTER TABLE public.permission_audit_logs 
ALTER COLUMN actor_user_id DROP NOT NULL;

-- Drop the existing foreign key constraints
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_target_user_id_fkey;

ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_actor_user_id_fkey;

-- Re-add the constraints with ON DELETE SET NULL
-- This allows users to be deleted while preserving the audit log records
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_target_user_id_fkey 
FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_actor_user_id_fkey 
FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;