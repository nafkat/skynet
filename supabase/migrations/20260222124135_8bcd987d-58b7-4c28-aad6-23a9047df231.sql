ALTER TABLE public.permission_audit_logs DROP CONSTRAINT permission_audit_logs_change_type_check;

ALTER TABLE public.permission_audit_logs ADD CONSTRAINT permission_audit_logs_change_type_check CHECK (change_type = ANY (ARRAY[
  'ROLE_CHANGE'::text,
  'MODULE_ACCESS'::text,
  'ACTION_PERMISSION'::text,
  'TEMPLATE_APPLIED'::text,
  'TEMPLATE_ASSIGNED'::text,
  'TEMPLATE_REMOVED'::text,
  'PROFILE_NAME_CHANGE'::text,
  'USER_INVITED'::text,
  'USER_ACTIVATED'::text,
  'USER_DEACTIVATED'::text,
  'INVITE_RESENT'::text,
  'ROLE_CREATED'::text,
  'ROLE_DELETED'::text,
  'ROLE_UPDATED'::text,
  'ROLE_MODULE_GRANTED'::text,
  'ROLE_MODULE_REVOKED'::text,
  'ROLE_ACTION_GRANTED'::text,
  'ROLE_ACTION_REVOKED'::text
]));