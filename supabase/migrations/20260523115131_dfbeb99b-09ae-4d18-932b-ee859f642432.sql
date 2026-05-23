ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vaccinated_flu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_lab_date date,
  ADD COLUMN IF NOT EXISTS last_bp_check date;