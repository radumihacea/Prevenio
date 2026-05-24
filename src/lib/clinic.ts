// Constantele DOCTOR_* au fost eliminate. Folosiți hook-ul useCurrentDoctor()
// pentru a obține medicul autentificat curent. Vezi src/hooks/useCurrentDoctor.ts.

export const RO_MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];
export const RO_MONTHS_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];
export const RO_DAYS = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
export const RO_DAYS_SHORT = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];

export function formatRoDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${RO_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatRoLongDate(d: Date): string {
  return `${RO_DAYS[d.getDay()]}, ${d.getDate()} ${RO_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ageFromBirth(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date): Date {
  // Monday start (RO convention)
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Mon
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Working hours slots (30 min). Default fallback list — prefer generateSlots().
export const SLOT_HOURS = Array.from({ length: 20 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

// ISO weekday: 1 = Monday … 7 = Sunday
export function isoDow(d: Date): number {
  const js = d.getDay(); // 0=Sun..6=Sat
  return js === 0 ? 7 : js;
}

// Build 30-min slot strings between "HH:MM" start (inclusive) and end (exclusive).
export function generateSlots(start: string, end: string): string[] {
  const toMin = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  };
  const s = toMin(start);
  const e = toMin(end);
  const out: string[] = [];
  for (let m = s; m < e; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

// Normalize RO phone numbers to format "07XX XXX XXX"
export function formatRoPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (digits.startsWith("40")) local = "0" + digits.slice(2);
  else if (!digits.startsWith("0")) local = "0" + digits;
  if (local.length !== 10) return raw.trim();
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

