
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS working_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS work_start_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS work_end_time   time NOT NULL DEFAULT '18:00';
