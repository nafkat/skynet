-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create unique constraint on employee_contact_channels for upsert support
ALTER TABLE public.employee_contact_channels
ADD CONSTRAINT employee_contact_channels_employee_channel_unique 
UNIQUE (employee_id, channel_type);