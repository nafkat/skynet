ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET setup_completed = true WHERE setup_completed = false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, display_name, is_active, setup_completed)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'full_name', true, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;