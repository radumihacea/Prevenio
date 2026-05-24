
-- Drop all permissive public policies
DROP POLICY IF EXISTS "public read doctors" ON public.doctors;
DROP POLICY IF EXISTS "public write doctors" ON public.doctors;
DROP POLICY IF EXISTS "public read patients" ON public.patients;
DROP POLICY IF EXISTS "public write patients" ON public.patients;
DROP POLICY IF EXISTS "public read appointments" ON public.appointments;
DROP POLICY IF EXISTS "public write appointments" ON public.appointments;
DROP POLICY IF EXISTS "public read tokenuri_sms" ON public.tokenuri_sms;
DROP POLICY IF EXISTS "public write tokenuri_sms" ON public.tokenuri_sms;
DROP POLICY IF EXISTS "public read sms" ON public.sms_log;
DROP POLICY IF EXISTS "public write sms" ON public.sms_log;
DROP POLICY IF EXISTS "public read vaccine_catalog" ON public.vaccine_catalog;
DROP POLICY IF EXISTS "public write vaccine_catalog" ON public.vaccine_catalog;
DROP POLICY IF EXISTS "public read vaccinations" ON public.vaccinations;
DROP POLICY IF EXISTS "public write vaccinations" ON public.vaccinations;

-- Authenticated-only access for sensitive tables (single-doctor app: any
-- logged-in user represents the doctor; server-side writes via webhooks use
-- the service role which bypasses RLS).
CREATE POLICY "authenticated read doctors" ON public.doctors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write doctors" ON public.doctors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read patients" ON public.patients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write patients" ON public.patients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read appointments" ON public.appointments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write appointments" ON public.appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read tokenuri_sms" ON public.tokenuri_sms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write tokenuri_sms" ON public.tokenuri_sms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read sms" ON public.sms_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write sms" ON public.sms_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read vaccinations" ON public.vaccinations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write vaccinations" ON public.vaccinations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Vaccine catalog: public read OK (reference data), authenticated-only writes.
CREATE POLICY "public read vaccine_catalog" ON public.vaccine_catalog
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "authenticated write vaccine_catalog" ON public.vaccine_catalog
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
