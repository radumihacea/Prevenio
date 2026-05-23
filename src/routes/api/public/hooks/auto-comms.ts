import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MS_DAY = 1000 * 60 * 60 * 24;
const MS_MONTH = MS_DAY * 30.4375;
const DOCTOR_SLUG = "dr-ionescu";

function mandatoryMsg(patientName: string, vaccine: string, ageLabel: string, link: string) {
  return `URGENT - Vaccinare obligatorie: ${patientName} trebuie să facă ${vaccine} (${ageLabel}), conform Calendarului Național de Vaccinare. Vă rugăm programați-vă cât mai curând: ${link}`;
}

function optionalMsg(patientName: string, vaccine: string, ageLabel: string, link: string) {
  return `Recomandare: pentru ${patientName} este momentul potrivit pentru ${vaccine} (${ageLabel}). Este un vaccin opțional, dar recomandat pentru protecție suplimentară. Dacă doriți mai multe informații sau programare: ${link}`;
}

function ageLabelFromMonths(m: number) {
  if (m < 1) return "în primele zile de viață";
  if (m < 12) return `la ${m} luni`;
  const years = Math.round(m / 12);
  return years === 1 ? "la 1 an" : `la ${years} ani`;
}

function shortKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

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

        // 2) Reminder vaccinuri pe baza catalogului
        const { data: catalog } = await supabase
          .from("vaccine_catalog")
          .select("name, mandatory, recommended_age_months");

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
          const ageMonths = (today.getTime() - birth.getTime()) / MS_MONTH;
          const done = byPatient.get(p.id as string) ?? [];

          for (const v of catalog ?? []) {
            if (v.recommended_age_months == null) continue;
            const nameLc = (v.name as string).toLowerCase();
            if (done.some((n) => n.includes(nameLc.split(" ")[0]) && n.includes(nameLc.includes("doza 2") ? "doza 2" : nameLc.includes("doza 3") ? "doza 3" : ""))) continue;
            // Fereastră: cu ~2 luni înainte până la împlinirea vârstei
            const target = v.recommended_age_months as number;
            if (ageMonths >= target - 2 && ageMonths < target) {
              const tag = `vacc-reminder:${p.id}:${shortKey(v.name as string)}`;
              const { data: existing } = await supabase
                .from("sms_log")
                .select("id")
                .eq("tag", tag)
                .limit(1);
              if (existing && existing.length > 0) continue;
              const ageLabel = ageLabelFromMonths(target);
              const message = v.mandatory
                ? mandatoryMsg(p.full_name as string, v.name as string, ageLabel, link)
                : optionalMsg(p.full_name as string, v.name as string, ageLabel, link);
              vaccInserts.push({
                doctor_id: p.doctor_id,
                recipient_phone: p.phone,
                recipient_name: p.full_name,
                message,
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
