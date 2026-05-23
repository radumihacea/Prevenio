
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  full_name text not null,
  specialty text not null default 'Medic de familie',
  cabinet_name text,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  full_name text not null,
  birth_date date,
  cnp text,
  phone text,
  address text,
  last_visit date,
  created_at timestamptz not null default now()
);
create index on public.patients(doctor_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null,
  patient_phone text,
  appointment_date date not null,
  appointment_time time not null,
  reason text,
  status text not null default 'confirmed',
  source text not null default 'doctor',
  created_at timestamptz not null default now()
);
create index on public.appointments(doctor_id, appointment_date);

create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  recipient_phone text not null,
  recipient_name text,
  message text not null,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.sms_log enable row level security;

-- MVP demo: acces public
create policy "public read doctors" on public.doctors for select using (true);
create policy "public write doctors" on public.doctors for all using (true) with check (true);

create policy "public read patients" on public.patients for select using (true);
create policy "public write patients" on public.patients for all using (true) with check (true);

create policy "public read appointments" on public.appointments for select using (true);
create policy "public write appointments" on public.appointments for all using (true) with check (true);

create policy "public read sms" on public.sms_log for select using (true);
create policy "public write sms" on public.sms_log for all using (true) with check (true);
