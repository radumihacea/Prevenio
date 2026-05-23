ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS tag text;
CREATE INDEX IF NOT EXISTS sms_log_tag_idx ON public.sms_log (tag) WHERE tag IS NOT NULL;