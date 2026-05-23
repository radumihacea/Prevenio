alter table public.appointments
add constraint appointments_doctor_date_time_unique
unique (doctor_id, appointment_date, appointment_time);