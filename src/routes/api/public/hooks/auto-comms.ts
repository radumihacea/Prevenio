import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const AGE_SCHEDULE: { age: number; vaccine: string; key: string }[] = [
  { age: 1, vaccine: "ROR (rujeolă-oreion-rubeolă)", key: "ror" },
  { age: 5, vaccine: "DTPa-VPI (rapel preșcolar)", key: "dtpa-vpi" },
  { age: 11, vaccine: "HPV", key: "hpv" },
  { age: 14, vaccine: "dTpa (rapel adolescent)", key: "dtpa" },
  { age: 18, vaccine: "dT (rapel adult)", key: "dt" },
];

const MS_DAY = 1000 * 60 * 60 * 24;
const DOCTOR_SLUG = "dr-ionescu";

export const Route = createFileRoute("/api/public/hooks/auto-comms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        const origin = new URL(request.url).origin;
        const link = `${origin}/cabinet/${DOCTOR_SLUG}/programari`;

        // 1) Reminder programări mâine
        const today = new Date();
        const tomorrow = new Date(today.getTime() + MS_DAY);
        const tomorrowIso = tomorrow.toISOString().slice(0, 10);

        const { data: appts } = await supabase
          .from("appointments")
          .select("*")
          .eq("appointment_date", tomorrowIso);

        const apptInserts: any[] = [];
        for (const a of appts ?? []) {
          if (!a.patient_phone) continue;
          const tag = `appt-reminder:${a.id}`;
          const { data: existing } = await supabase
            .from("sms_log")
            .select("id")
            .eq("tag", tag)
            .limit(1);
          if (existing && existing.length > 0) continue;
          apptInserts.push({
            doctor_id: a.doctor_id,
            recipient_phone: a.patient_phone,
            recipient_name: a.patient_name,
            message: `Bună ziua, vă reamintim de programarea de mâine (${a.appointment_date} la ${String(a.appointment_time).slice(0, 5)}). Pentru reprogramare: ${link}`,
            status: "queued",
            tag,
          });
        }

        // 2) Reminder vaccinuri pe schema de vârstă (în fereastra [age-2luni, age])
        const { data: patients } = await supabase.from("patients").select("*");
        const { data: vaccinations } = await supabase
          .from("vaccinations")
          .select("patient_id, vaccine_name");

        const byPatient = new Map<string, string[]>();
        for (const v of vaccinations ?? []) {
          if (!byPatient.has(v.patient_id)) byPatient.set(v.patient_id, []);
          byPatient.get(v.patient_id)!.push((v.vaccine_name as string).toLowerCase());
        }

        const vaccInserts: any[] = [];
        for (const p of patients ?? []) {
          if (!p.phone || !p.birth_date) continue;
          const birth = new Date(p.birth_date as string);
          if (isNaN(birth.getTime())) continue;
          const ageYears = (today.getTime() - birth.getTime()) / (MS_DAY * 365.25);
          const done = byPatient.get(p.id as string) ?? [];

          for (const s of AGE_SCHEDULE) {
            if (done.some((n) => n.includes(s.key))) continue;
            // Trimite cu ~2 luni înainte de împlinirea vârstei (până la împlinire)
            if (ageYears >= s.age - 2 / 12 && ageYears < s.age) {
              const tag = `vacc-reminder:${p.id}:${s.key}`;
              const { data: existing } = await supabase
                .from("sms_log")
                .select("id")
                .eq("tag", tag)
                .limit(1);
              if (existing && existing.length > 0) continue;
              vaccInserts.push({
                doctor_id: p.doctor_id,
                recipient_phone: p.phone,
                recipient_name: p.full_name,
                message: `Bună ziua, pentru ${p.full_name} se apropie momentul vaccinului ${s.vaccine} (recomandat la ${s.age} ani). Vă rugăm programați-vă: ${link}`,
                status: "queued",
                tag,
              });
            }
          }
        }

        const allInserts = [...apptInserts, ...vaccInserts];
        if (allInserts.length > 0) {
          const { error } = await supabase.from("sms_log").insert(allInserts);
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            appointment_reminders: apptInserts.length,
            vaccine_reminders: vaccInserts.length,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
