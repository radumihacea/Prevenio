
-- Add parafa_code & auth_email to doctors
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS parafa_code text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS auth_email text;

-- Backfill existing doctor with a parafa
UPDATE public.doctors SET parafa_code = 'MD100001' WHERE parafa_code IS NULL AND slug = 'dr-ionescu';
UPDATE public.doctors SET auth_email = lower(parafa_code) || '@medic.prevenio.local' WHERE auth_email IS NULL AND parafa_code IS NOT NULL;

ALTER TABLE public.doctors ALTER COLUMN parafa_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS doctors_parafa_code_key ON public.doctors (lower(parafa_code));
CREATE UNIQUE INDEX IF NOT EXISTS doctors_auth_email_key ON public.doctors (lower(auth_email));
CREATE UNIQUE INDEX IF NOT EXISTS doctors_slug_key ON public.doctors (slug);

-- Unique CNP per doctor (when CNP is provided)
CREATE UNIQUE INDEX IF NOT EXISTS patients_doctor_cnp_unique
  ON public.patients (doctor_id, cnp) WHERE cnp IS NOT NULL;

-- sms_log: add template_id for clean per-template history
ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS template_id text;
