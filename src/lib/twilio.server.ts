const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type TwilioSmsResult = {
  ok: boolean;
  sid?: string;
  error?: string;
};

function normalizeE164PhoneNumber(phone: string): string {
  const cleaned = phone.trim().replace(/[\s().-]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  if (/^07\d{8}$/.test(cleaned)) return `+4${cleaned}`;
  return cleaned;
}

function friendlyTwilioError(status: number, data: any): string {
  const message = data?.message ?? JSON.stringify(data);
  if (typeof message === "string" && message.includes("Trial accounts cannot send messages to unverified numbers")) {
    return `Twilio ${status}: Contul Twilio este Trial și nu poate trimite SMS către numere neverificate. Verifică destinatarul în Twilio Verified Caller IDs sau treci contul pe paid.`;
  }
  if (typeof message === "string" && message.includes("Invalid 'To' Phone Number")) {
    return `Twilio ${status}: Numărul destinatarului nu este valid. Folosește format E.164, ex. +407xxxxxxxx.`;
  }
  return `Twilio ${status}: ${message}`;
}

export async function sendTwilioSms(
  to: string,
  body: string,
): Promise<TwilioSmsResult> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) return { ok: false, error: "LOVABLE_API_KEY lipsește" };

  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!TWILIO_API_KEY) return { ok: false, error: "TWILIO_API_KEY lipsește" };

  const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
  if (!TWILIO_FROM_NUMBER)
    return { ok: false, error: "TWILIO_FROM_NUMBER lipsește" };

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizeE164PhoneNumber(to),
        From: TWILIO_FROM_NUMBER,
        Body: body,
      }),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: friendlyTwilioError(response.status, data),
      };
    }
    return { ok: true, sid: data?.sid };
  } catch (error: any) {
    return { ok: false, error: `Twilio fetch error: ${error?.message ?? error}` };
  }
}
