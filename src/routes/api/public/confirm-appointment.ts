import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTwilioSms } from "@/lib/twilio.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/confirm-appointment")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { appointmentId?: string };
          const id = body.appointmentId;
          if (!id || typeof id !== "string") {
            return new Response(JSON.stringify({ ok: false, error: "appointmentId lipsește" }), {
              status: 400,
              headers: { ...CORS, "Content-Type": "application/json" },
            });
          }

          // Look up appointment (admin client bypasses RLS so anon bookings work too)
          const { data: appt, error: apptErr } = await supabaseAdmin
            .from("appointments")
            .select("id, doctor_id, patient_name, patient_phone, appointment_date, appointment_time, created_at, status")
            .eq("id", id)
            .maybeSingle();

          if (apptErr) throw new Error(apptErr.message);
          if (!appt) {
            return new Response(JSON.stringify({ ok: false, error: "Programare inexistentă" }), {
              status: 404,
              headers: { ...CORS, "Content-Type": "application/json" },
            });
          }

          // Anti-abuse: only confirm appointments created in the last 5 minutes
          const ageMs = Date.now() - new Date(appt.created_at as string).getTime();
          if (ageMs > 5 * 60 * 1000) {
            return new Response(JSON.stringify({ ok: false, error: "Confirmare expirată" }), {
              status: 410,
              headers: { ...CORS, "Content-Type": "application/json" },
            });
          }

          if (!appt.patient_phone) {
            return new Response(
              JSON.stringify({ ok: true, smsSent: false, warning: "Fără telefon" }),
              { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
            );
          }

          const { data: doctor } = await supabaseAdmin
            .from("doctors")
            .select("full_name")
            .eq("id", appt.doctor_id)
            .maybeSingle();

          const date = new Date(`${appt.appointment_date}T00:00:00`);
          const formattedDate = new Intl.DateTimeFormat("ro-RO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          }).format(date);
          const formattedTime = String(appt.appointment_time).slice(0, 5);
          const doctorName = doctor?.full_name ?? "medicul dumneavoastră";
          const message = `Buna ziua, ${appt.patient_name}. Ai o programare in data de ${formattedDate}, ora ${formattedTime}, la ${doctorName}. Va asteptam!`;

          const smsResult = await sendTwilioSms(appt.patient_phone, message);

          await supabaseAdmin.from("sms_log").insert({
            doctor_id: appt.doctor_id,
            recipient_phone: appt.patient_phone,
            recipient_name: appt.patient_name,
            message,
            status: smsResult.ok ? "sent" : "failed",
            tag: smsResult.ok ? (smsResult.sid ?? `confirmation:${appt.id}`) : `error: ${smsResult.error}`.slice(0, 200),
            template_id: "appointment_confirmation",
          });

          return new Response(
            JSON.stringify({ ok: true, smsSent: smsResult.ok, warning: smsResult.error }),
            { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          console.error("confirm-appointment error", e);
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? "unknown" }), {
            status: 500,
            headers: { ...CORS, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
