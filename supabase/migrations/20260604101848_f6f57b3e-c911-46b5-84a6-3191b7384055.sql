CREATE OR REPLACE FUNCTION public.generate_employee_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  specialty_code CHAR(4);
  next_seq INTEGER;
BEGIN
  SELECT code INTO specialty_code FROM public.specialties WHERE id = NEW.specialty_id;

  INSERT INTO public.specialty_sequences (specialty_id, current_sequence)
  VALUES (NEW.specialty_id, 1)
  ON CONFLICT (specialty_id)
  DO UPDATE SET current_sequence = specialty_sequences.current_sequence + 1
  RETURNING current_sequence INTO next_seq;

  NEW.employee_code := specialty_code || '-' || LPAD(next_seq::TEXT, 4, '0');

  RETURN NEW;
END;
$function$;