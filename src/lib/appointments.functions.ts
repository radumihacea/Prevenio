import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sendTwilioSms } from "./twilio.server";

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ appointmentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, doctor_id, patient_name, patient_phone, appointment_date, appointment_time")
      .eq("id", data.appointmentId)
      .maybeSingle();

    if (appointmentError) throw new Error(appointmentError.message);
    if (!appointment) throw new Error("Programarea nu a fost găsită.");

    const { data: doctor } = await supabase
      .from("doctors")
      .select("full_name")
      .eq("id", appointment.doctor_id)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.appointmentId);

    if (updateError) throw new Error(updateError.message);

    if (!appointment.patient_phone) {
      return { ok: true, smsSent: false, warning: "Pacientul nu are telefon salvat." };
    }

    const date = new Date(`${appointment.appointment_date}T00:00:00`);
    const formattedDate = new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
    const formattedTime = String(appointment.appointment_time).slice(0, 5);
    const doctorName = doctor?.full_name ?? "medicul dumneavoastră";
    const message = `Buna ziua, ${appointment.patient_name}. Programarea dumneavoastra cu ${doctorName} din ${formattedDate}, ora ${formattedTime}, a fost anulata. Va rugam sa ne contactati pentru reprogramare.`;
    const smsResult = await sendTwilioSms(appointment.patient_phone, message);

    const { error: logError } = await supabase.from("sms_log").insert({
      doctor_id: appointment.doctor_id,
      recipient_phone: appointment.patient_phone,
      recipient_name: appointment.patient_name,
      message,
      status: smsResult.ok ? "sent" : "failed",
      tag: smsResult.sid ?? `cancellation:${appointment.id}`,
    });

    if (logError) throw new Error(logError.message);
    return { ok: true, smsSent: smsResult.ok, warning: smsResult.error };
  });