CREATE TABLE IF NOT EXISTS public.tokenuri_sms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  patient_id UUID,
  patient_name TEXT,
  phone TEXT NOT NULL,
  folosit BOOLEAN NOT NULL DEFAULT false,
  expira_la TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tokenuri_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read tokenuri_sms" ON public.tokenuri_sms FOR SELECT USING (true);
CREATE POLICY "public write tokenuri_sms" ON public.tokenuri_sms FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tokenuri_sms_token ON public.tokenuri_sms(token);