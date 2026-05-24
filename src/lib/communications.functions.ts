import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTwilioSms } from "./twilio.server";
import { SMS_TEMPLATES, type PatientLite } from "./segments";

export const sendTemplateSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        templateId: z.string().min(1).max(64),
        doctorId: z.string().uuid(),
        doctorSlug: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tpl = SMS_TEMPLATES.find((t) => t.id === data.templateId);
    if (!tpl) throw new Error("Template necunoscut.");

    const { data: patients, error: pErr } = await supabase
      .from("patients")
      .select(
        "id, full_name, birth_date, phone, last_visit, conditions, vaccinated_flu, last_lab_date, last_bp_check",
      )
      .eq("doctor_id", data.doctorId);
    if (pErr) throw new Error(pErr.message);

    const audience = (patients as PatientLite[]).filter(
      (p) => !!p.phone && (!tpl.audience || tpl.audience(p)),
    );
    if (audience.length === 0)
      return { sent: 0, failed: 0, total: 0, warning: "Niciun pacient în segment." };

    let host = "med.ro";
    try {
      host = getRequestHost();
    } catch {}
    const link = `https://${host}/cabinet/${data.doctorSlug}/programari`;
    const message = `${tpl.body} ${link}`;

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let lastError: string | undefined;
    let abort = false;
    const rows: any[] = [];
    for (const p of audience) {
      if (abort) {
        skipped++;
        rows.push({
          doctor_id: data.doctorId,
          recipient_phone: p.phone!,
          recipient_name: p.full_name,
          message,
          status: "skipped",
          template_id: tpl.id,
          tag: "skipped: primul SMS a eșuat, restul nu au fost trimise",
        });
        continue;
      }
      const result = await sendTwilioSms(p.phone!, message);
      if (result.ok) sent++;
      else {
        failed++;
        lastError = result.error;
        console.error("[Twilio SMS failed]", p.phone, result.error);
        // All-or-nothing: dacă primul destinatar eșuează, oprim restul
        if (sent === 0) abort = true;
      }
      rows.push({
        doctor_id: data.doctorId,
        recipient_phone: p.phone!,
        recipient_name: p.full_name,
        message,
        status: result.ok ? "sent" : "failed",
        template_id: tpl.id,
        tag: result.ok
          ? (result.sid ?? tpl.id)
          : `error: ${result.error ?? "unknown"}`.slice(0, 200),
      });
    }

    const { error: logErr } = await supabase.from("sms_log").insert(rows);
    if (logErr) throw new Error(logErr.message);

    return { sent, failed, skipped, total: audience.length, lastError };
  });
