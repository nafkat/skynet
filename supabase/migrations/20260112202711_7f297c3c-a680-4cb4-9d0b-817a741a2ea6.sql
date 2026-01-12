-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'timekeeper');

-- Create enum for project status
CREATE TYPE public.project_status AS ENUM ('OPEN', 'CLOSED');

-- Create enum for employee status
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive');

-- Create enum for correction request status
CREATE TYPE public.correction_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create specialties table
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_el TEXT NOT NULL,
  code CHAR(4) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE RESTRICT,
  status employee_status NOT NULL DEFAULT 'active',
  regular_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  overtime_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  regular_start_time TIME NOT NULL DEFAULT '07:00:00',
  regular_end_time TIME NOT NULL DEFAULT '14:00:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create time_entries table
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  regular_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create locked_periods table for admin date range locking
CREATE TABLE public.locked_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unlocked_by UUID,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create correction_requests table
CREATE TABLE public.correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  request_reason TEXT NOT NULL,
  new_start_time TIME,
  new_end_time TIME,
  status correction_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (security best practice: separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence tracking for employee codes per specialty
CREATE TABLE public.specialty_sequences (
  specialty_id UUID PRIMARY KEY REFERENCES public.specialties(id) ON DELETE CASCADE,
  current_sequence INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS on all tables
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locked_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialty_sequences ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any elevated role (admin or hr)
CREATE OR REPLACE FUNCTION public.has_elevated_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'hr')
  )
$$;

-- Function to generate employee code
CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  specialty_code CHAR(4);
  next_seq INTEGER;
BEGIN
  -- Get specialty code
  SELECT code INTO specialty_code FROM public.specialties WHERE id = NEW.specialty_id;
  
  -- Get and increment sequence
  INSERT INTO public.specialty_sequences (specialty_id, current_sequence)
  VALUES (NEW.specialty_id, 1)
  ON CONFLICT (specialty_id) 
  DO UPDATE SET current_sequence = specialty_sequences.current_sequence + 1
  RETURNING current_sequence INTO next_seq;
  
  -- Set employee code
  NEW.employee_code := specialty_code || '-' || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;

-- Trigger for auto-generating employee code
CREATE TRIGGER generate_employee_code_trigger
BEFORE INSERT ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.generate_employee_code();

-- Function to calculate time entry durations
CREATE OR REPLACE FUNCTION public.calculate_time_entry_durations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  emp_regular_start TIME;
  emp_regular_end TIME;
  entry_start TIMESTAMP;
  entry_end TIMESTAMP;
  reg_start TIMESTAMP;
  reg_end TIMESTAMP;
  total_mins INTEGER;
  regular_mins INTEGER := 0;
BEGIN
  -- Get employee work schedule
  SELECT regular_start_time, regular_end_time 
  INTO emp_regular_start, emp_regular_end
  FROM public.employees WHERE id = NEW.employee_id;
  
  -- Calculate total duration
  IF NEW.end_time < NEW.start_time THEN
    -- Crosses midnight - calculate as if end is next day
    total_mins := EXTRACT(EPOCH FROM (NEW.end_time + INTERVAL '24 hours' - NEW.start_time)) / 60;
  ELSE
    total_mins := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  END IF;
  
  -- Create timestamp versions for comparison
  entry_start := NEW.entry_date + NEW.start_time;
  IF NEW.end_time < NEW.start_time THEN
    entry_end := (NEW.entry_date + INTERVAL '1 day') + NEW.end_time;
  ELSE
    entry_end := NEW.entry_date + NEW.end_time;
  END IF;
  
  reg_start := NEW.entry_date + emp_regular_start;
  reg_end := NEW.entry_date + emp_regular_end;
  
  -- Calculate overlap with regular hours
  IF entry_end > reg_start AND entry_start < reg_end THEN
    regular_mins := EXTRACT(EPOCH FROM (
      LEAST(entry_end, reg_end) - GREATEST(entry_start, reg_start)
    )) / 60;
    IF regular_mins < 0 THEN
      regular_mins := 0;
    END IF;
  END IF;
  
  NEW.duration_minutes := total_mins;
  NEW.regular_minutes := regular_mins;
  NEW.overtime_minutes := total_mins - regular_mins;
  
  RETURN NEW;
END;
$$;

-- Trigger for auto-calculating durations
CREATE TRIGGER calculate_durations_trigger
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.calculate_time_entry_durations();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_specialties_updated_at BEFORE UPDATE ON public.specialties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Specialties: All authenticated can read, admin can write
CREATE POLICY "Specialties viewable by authenticated users" ON public.specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert specialties" ON public.specialties FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update specialties" ON public.specialties FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete specialties" ON public.specialties FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Employees: Timekeepers see limited fields, admin full access
CREATE POLICY "Employees viewable by authenticated users" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update employees" ON public.employees FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete employees" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Projects: All can read, admin can write
CREATE POLICY "Projects viewable by authenticated users" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Time entries: All authenticated can read, creators can insert, edit rules apply
CREATE POLICY "Time entries viewable by authenticated" ON public.time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert time entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin can update any time entry" ON public.time_entries FOR UPDATE TO authenticated USING (public.has_elevated_role(auth.uid()));
CREATE POLICY "Creator can update own entries within 24h" ON public.time_entries FOR UPDATE TO authenticated USING (
  auth.uid() = created_by AND created_at > (now() - INTERVAL '24 hours')
);
CREATE POLICY "Admin can delete time entries" ON public.time_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Locked periods: Admin only
CREATE POLICY "Locked periods viewable by elevated roles" ON public.locked_periods FOR SELECT TO authenticated USING (public.has_elevated_role(auth.uid()));
CREATE POLICY "Admin can manage locked periods" ON public.locked_periods FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Correction requests
CREATE POLICY "Correction requests viewable by elevated or creator" ON public.correction_requests FOR SELECT TO authenticated USING (
  public.has_elevated_role(auth.uid()) OR auth.uid() = requested_by
);
CREATE POLICY "Users can create correction requests" ON public.correction_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "Admin can update correction requests" ON public.correction_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Admin only management
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Specialty sequences: Admin only
CREATE POLICY "Admin can manage sequences" ON public.specialty_sequences FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();