import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MS_DAY = 1000 * 60 * 60 * 24;
const DOCTOR_SLUG = "dr-ionescu";
const DEFAULT_GATEWAY_URL = "http://172.20.10.4:8082/send";
const GATEWAY_TIMEOUT_MS = 4_000;

async function sendSms(phone: string, message: string, gatewayUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `Gateway ${response.status}` };
    }

    return { ok: true, error: null };
  } catch (error: any) {
    const isAbort = error?.name === "AbortError";
    return {
      ok: false,
      error: isAbort
        ? `Gateway timeout după ${GATEWAY_TIMEOUT_MS / 1000}s`
        : `Gateway error: ${error?.message ?? error}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const Route = createFileRoute()({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = request.headers.get("apikey");
          const allowedKeys = [
            process.env.SUPABASE_PUBLISHABLE_KEY,
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ].filter(Boolean) as string[];

          if (allowedKeys.length > 0 && (!apiKey || !allowedKeys.includes(apiKey))) {
            return Response.json({ error: "Cerere neautorizată" }, { status: 401 });
          }

          const supabase = supabaseAdmin;
          const origin = new URL(request.url).origin;
          const appUrl = process.env.VITE_APP_URL ?? origin;
          const gatewayUrl =
            process.env.ANDROID_GATEWAY_URL ??
            process.env.VITE_ANDROID_GATEWAY_URL ??
            DEFAULT_GATEWAY_URL;

          // Resolve doctor once
          const { data: doctorRow, error: dErr } = await supabase
            .from("doctors")
            .select("id")
            .eq("slug", DOCTOR_SLUG)
            .maybeSingle();

          if (dErr) {
            return Response.json(
              { error: `Doctor lookup failed: ${dErr.message}` },
              { status: 500 },
            );
          }
          const doctorId = doctorRow?.id ?? null;

          // Patients needing follow-up
          const { data: patients, error: pErr } = await supabase
            .from("patients")
            .select("id, full_name, phone, last_visit")
            .not("phone", "is", null);

          if (pErr) {
            return Response.json(
              { error: `Patients query failed: ${pErr.message}` },
              { status: 500 },
            );
          }

          const now = Date.now();
          const needsCheckup = (patients ?? []).filter((p: any) => {
            if (!p.phone) return false;
            if (!p.last_visit) return true;
            const last = new Date(p.last_visit).getTime();
            if (isNaN(last)) return true;
            return now - last >= 365 * MS_DAY;
          });

          let sent = 0;
          const errors: string[] = [];

          for (const p of needsCheckup as any[]) {
            const { data: tokenRow, error: tErr } = await supabase
              .from("tokenuri_sms")
              .insert({
                patient_id: p.id,
                patient_name: p.full_name,
                phone: p.phone,
                folosit: false,
                expira_la: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
              })
              .select("token")
              .single();

            if (tErr || !tokenRow) {
              errors.push(`Token failed for ${p.full_name}: ${tErr?.message}`);
              continue;
            }

            const message = `Buna ziua, ${p.full_name}. Este timpul pentru controlul periodic la medicul de familie. Programeaza-te aici: ${appUrl}/programare/${tokenRow.token}`;

            const smsResult = await sendSms(p.phone, message, gatewayUrl);
            const status = smsResult.ok ? "sent" : "failed";
            if (smsResult.ok) sent++;
            else errors.push(`${smsResult.error} pentru ${p.phone}`);

            if (doctorId) {
              await supabase.from("sms_log").insert({
                doctor_id: doctorId,
                recipient_phone: p.phone,
                recipient_name: p.full_name,
                message,
                status,
                tag: `auto-checkup:${p.id}:${new Date().toISOString().slice(0, 10)}`,
              });
            }
          }

          return Response.json({
            ok: true,
            candidates: needsCheckup.length,
            sent,
            errors: errors.length > 0 ? errors : undefined,
          });
        } catch (e: any) {
          console.error("[auto-comms] fatal", e);
          return Response.json(
            { error: e?.message ?? "Unknown server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
