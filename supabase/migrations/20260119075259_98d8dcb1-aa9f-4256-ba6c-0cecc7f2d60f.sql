-- Update the permission_audit_logs change_type constraint to include all needed types
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_change_type_check;

ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_change_type_check 
CHECK (change_type IN (
  'ROLE_CHANGE', 
  'MODULE_ACCESS', 
  'ACTION_PERMISSION', 
  'TEMPLATE_APPLIED',
  'TEMPLATE_ASSIGNED',
  'TEMPLATE_REMOVED',
  'PROFILE_NAME_CHANGE',
  'USER_INVITED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'INVITE_RESENT'
));