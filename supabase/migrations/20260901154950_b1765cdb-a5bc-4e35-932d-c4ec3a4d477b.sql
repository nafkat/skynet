create table public.employee_pay_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  regular_hourly_rate numeric(10,3) not null default 0,
  regular_rate_all_in numeric(10,3) not null default 0,
  overtime_hourly_rate numeric(10,3) not null default 0,
  effective_from date not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_pay_rates TO authenticated;
GRANT ALL ON public.employee_pay_rates TO service_role;

alter table public.employee_pay_rates enable row level security;

create unique index employee_pay_rates_employee_date_uniq
  on public.employee_pay_rates (employee_id, effective_from);

create index employee_pay_rates_employee_idx
  on public.employee_pay_rates (employee_id, effective_from desc);

create policy "Pay rates viewable by admin and hr"
  on public.employee_pay_rates for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));

create policy "Admin and hr can insert pay rates"
  on public.employee_pay_rates for insert to authenticated
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));

create policy "Admin and hr can update pay rates"
  on public.employee_pay_rates for update to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));

create policy "Admin and hr can delete pay rates"
  on public.employee_pay_rates for delete to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));

create trigger update_employee_pay_rates_updated_at
  before update on public.employee_pay_rates
  for each row execute function public.update_updated_at_column();

insert into public.employee_pay_rates
  (employee_id, regular_hourly_rate, regular_rate_all_in, overtime_hourly_rate, effective_from, notes)
select
  id,
  coalesce(regular_hourly_rate, 0),
  coalesce(regular_rate_all_in, 0),
  coalesce(overtime_hourly_rate, 0),
  CURRENT_DATE,
  'Initial seed — pre-existing rate'
from public.employees
on conflict (employee_id, effective_from) do nothing;