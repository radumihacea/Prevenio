-- Catalog vaccinuri
CREATE TABLE public.vaccine_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  disease text NOT NULL,
  manufacturer text,
  doses_required integer NOT NULL DEFAULT 1,
  interval_months integer,
  seasonal boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vaccine_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read vaccine_catalog" ON public.vaccine_catalog FOR SELECT USING (true);
CREATE POLICY "public write vaccine_catalog" ON public.vaccine_catalog FOR ALL USING (true) WITH CHECK (true);

-- Istoric administrări
CREATE TABLE public.vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  vaccine_id uuid REFERENCES public.vaccine_catalog(id) ON DELETE SET NULL,
  vaccine_name text NOT NULL,
  administered_date date NOT NULL,
  dose_number integer NOT NULL DEFAULT 1,
  lot_number text,
  manufacturer text,
  administered_by text,
  adverse_reactions text,
  next_due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read vaccinations" ON public.vaccinations FOR SELECT USING (true);
CREATE POLICY "public write vaccinations" ON public.vaccinations FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_vaccinations_patient ON public.vaccinations(patient_id);
CREATE INDEX idx_vaccinations_date ON public.vaccinations(administered_date);

-- Pre-populare catalog cu vaccinuri uzuale
INSERT INTO public.vaccine_catalog (name, disease, manufacturer, doses_required, interval_months, seasonal, notes) VALUES
  ('Vaccin antigripal', 'Gripă sezonieră', 'Sanofi / GSK', 1, 12, true, 'Recomandare anuală, sezon octombrie-decembrie'),
  ('Vaccin COVID-19', 'SARS-CoV-2', 'Pfizer / Moderna', 2, 6, false, 'Rapel anual recomandat pentru categorii de risc'),
  ('Vaccin antitetanic (dT)', 'Tetanos / difterie', 'Sanofi', 1, 120, false, 'Rapel la fiecare 10 ani'),
  ('Vaccin HPV', 'Papilomavirus uman', 'MSD', 3, 6, false, 'Schemă 0-2-6 luni'),
  ('Vaccin hepatită B', 'Hepatita B', 'GSK', 3, 6, false, 'Schemă 0-1-6 luni'),
  ('Vaccin pneumococic', 'Infecții pneumococice', 'Pfizer', 1, 60, false, 'Recomandat 65+ și categorii de risc'),
  ('Vaccin ROR', 'Rujeolă / oreion / rubeolă', 'MSD', 2, 12, false, 'Schemă pediatrică'),
  ('Vaccin meningococic', 'Meningita meningococică', 'GSK', 1, NULL, false, 'În funcție de expunere');