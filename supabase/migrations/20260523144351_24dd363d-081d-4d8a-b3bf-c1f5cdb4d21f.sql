ALTER TABLE public.vaccine_catalog ADD COLUMN IF NOT EXISTS mandatory boolean NOT NULL DEFAULT false;
ALTER TABLE public.vaccine_catalog ADD COLUMN IF NOT EXISTS recommended_age_months integer;