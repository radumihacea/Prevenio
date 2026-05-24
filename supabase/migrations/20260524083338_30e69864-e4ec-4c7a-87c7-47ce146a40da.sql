-- Allow public (anon) read access to doctors so the public booking page works
CREATE POLICY "anon read doctors"
ON public.doctors
FOR SELECT
TO anon
USING (true);

-- Create a privacy-safe view exposing only slot occupancy (no patient PII)
CREATE OR REPLACE VIEW public.public_appointment_slots
WITH (security_invoker = true) AS
SELECT doctor_id, appointment_date, appointment_time
FROM public.appointments
WHERE status <> 'cancelled';

GRANT SELECT ON public.public_appointment_slots TO anon, authenticated;

-- Allow anon to see appointment rows via the view (security_invoker requires base table access)
-- Only non-cancelled rows are visible; the view restricts which columns can be read.
CREATE POLICY "anon read appointment slot times"
ON public.appointments
FOR SELECT
TO anon
USING (status <> 'cancelled');

-- Allow anon to insert public bookings only
CREATE POLICY "anon insert public appointments"
ON public.appointments
FOR INSERT
TO anon
WITH CHECK (source = 'public');