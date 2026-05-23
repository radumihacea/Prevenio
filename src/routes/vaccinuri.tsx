import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { DOCTOR_ID, DOCTOR_SLUG, formatRoDate } from "@/lib/clinic";
import type { PatientLite, VaccinationRow } from "@/lib/segments";
import { toast } from "sonner";

export const Route = createFileRoute("/vaccinuri")({
  component: VaccinesPage,
  head: () => ({ meta: [{ title: "Vaccinuri — MedCab" }] }),
});

type CatalogRow = {
  id: string;
  name: string;
  mandatory: boolean;
  recommended_age_months: number | null;
};

type DueItem = {
  patient: PatientLite;
  vaccine: string;
  mandatory: boolean;
  dueDate: string;
  diffDays: number;
  source: "next_dose" | "age_schedule";
};

const MS_DAY = 1000 * 60 * 60 * 24;
const MS_MONTH = MS_DAY * 30.4375;

function ageInMonths(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / MS_MONTH;
}

function ageLabelFromMonths(m: number) {
  if (m < 1) return "în primele zile";
  if (m < 12) return `la ${m} luni`;
  const y = Math.round(m / 12);
  return y === 1 ? "la 1 an" : `la ${y} ani`;
}

function mandatoryMsg(name: string, vaccine: string, ageLabel: string, link: string, days: number) {
  return `URGENT - Vaccinare obligatorie: ${name} are restanță la ${vaccine} (${ageLabel}), conform Calendarului Național de Vaccinare. Restanță ${days} zile. Vă rugăm programați-vă cât mai curând: ${link}`;
}

function optionalMsg(name: string, vaccine: string, ageLabel: string, link: string) {
  return `Recomandare: pentru ${name} este momentul potrivit pentru ${vaccine} (${ageLabel}). Este un vaccin opțional, dar recomandat pentru protecție suplimentară. Pentru informații / programare: ${link}`;
}

function VaccinesPage() {
  const qc = useQueryClient();

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", DOCTOR_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("doctor_id", DOCTOR_ID);
      if (error) throw error;
      return data as PatientLite[];
    },
  });

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["vaccinations_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vaccinations").select("*");
      if (error) throw error;
      return data as VaccinationRow[];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["vaccine_catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vaccine_catalog")
        .select("id, name, mandatory, recommended_age_months");
      if (error) throw error;
      return data as CatalogRow[];
    },
  });

  const byPatient = useMemo(() => {
    const m = new Map<string, VaccinationRow[]>();
    for (const v of vaccinations) {
      if (!m.has(v.patient_id)) m.set(v.patient_id, []);
      m.get(v.patient_id)!.push(v);
    }
    return m;
  }, [vaccinations]);

  // Restantele: next_due_date depășit + vaccinuri din schema de vârstă neefectuate
  const overdue: DueItem[] = useMemo(() => {
    const today = new Date();
    const out: DueItem[] = [];
    for (const p of patients) {
      const vacs = byPatient.get(p.id) ?? [];

      for (const v of vacs) {
        if (!v.next_due_date) continue;
        const due = new Date(v.next_due_date);
        if (isNaN(due.getTime())) continue;
        const diffDays = Math.floor((due.getTime() - today.getTime()) / MS_DAY);
        if (diffDays < 0) {
          const catalogMatch = catalog.find((c) =>
            v.vaccine_name.toLowerCase().includes(c.name.toLowerCase().split(" ")[0]),
          );
          out.push({
            patient: p,
            vaccine: v.vaccine_name,
            mandatory: catalogMatch?.mandatory ?? false,
            dueDate: v.next_due_date,
            diffDays,
            source: "next_dose",
          });
        }
      }

      const ageM = ageInMonths(p.birth_date);
      if (ageM === null) continue;
      for (const c of catalog) {
        if (c.recommended_age_months == null) continue;
        const firstWord = c.name.toLowerCase().split(" ")[0];
        const doseTag = c.name.toLowerCase().includes("doza 2")
          ? "doza 2"
          : c.name.toLowerCase().includes("doza 3")
            ? "doza 3"
            : "";
        const done = vacs.some((v) => {
          const n = v.vaccine_name.toLowerCase();
          return n.includes(firstWord) && (doseTag === "" || n.includes(doseTag));
        });
        if (done) continue;
        if (ageM > c.recommended_age_months) {
          const birth = new Date(p.birth_date!);
          const dueDate = new Date(birth.getTime() + c.recommended_age_months * MS_MONTH);
          const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / MS_DAY);
          out.push({
            patient: p,
            vaccine: c.name,
            mandatory: c.mandatory,
            dueDate: dueDate.toISOString().slice(0, 10),
            diffDays,
            source: "age_schedule",
          });
        }
      }
    }
    // Obligatoriile primele
    return out.sort((a, b) => {
      if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
      return a.diffDays - b.diffDays;
    });
  }, [patients, byPatient, catalog]);

  const sendReminder = useMutation({
    mutationFn: async (items: DueItem[]) => {
      const link = `${window.location.origin}/cabinet/${DOCTOR_SLUG}/programari`;
      const rows = items
        .filter((i) => !!i.patient.phone)
        .map((i) => {
          const catalogMatch = catalog.find((c) => c.name === i.vaccine);
          const ageLabel = catalogMatch?.recommended_age_months != null
            ? ageLabelFromMonths(catalogMatch.recommended_age_months)
            : "conform schemei";
          return {
            doctor_id: DOCTOR_ID,
            recipient_phone: i.patient.phone!,
            recipient_name: i.patient.full_name,
            message: i.mandatory
              ? mandatoryMsg(i.patient.full_name, i.vaccine, ageLabel, link, Math.abs(i.diffDays))
              : optionalMsg(i.patient.full_name, i.vaccine, ageLabel, link),
            status: "queued",
          };
        });
      if (rows.length === 0) throw new Error("Niciun pacient cu telefon în această listă.");
      const { error } = await supabase.from("sms_log").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Reminder trimis către ${n} pacienți / părinți`);
      qc.invalidateQueries({ queryKey: ["sms_log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reachable = overdue.filter((i) => !!i.patient.phone).length;
  const mandatoryCount = overdue.filter((i) => i.mandatory).length;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />
      <main className="max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-display font-bold">Vaccinuri restante</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pacienții cu rapeluri sau vaccinuri din schema de vârstă neefectuate.
          </p>
        </div>

        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex gap-8">
            <div>
              <div className="text-4xl font-display font-bold text-red-700">{mandatoryCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                obligatorii restante
              </div>
            </div>
            <div>
              <div className="text-4xl font-display font-bold text-amber-700">
                {overdue.length - mandatoryCount}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                opționale recomandate
              </div>
            </div>
          </div>
          {overdue.length > 0 && (
            <button
              disabled={sendReminder.isPending || reachable === 0}
              onClick={() => sendReminder.mutate(overdue)}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider rounded-full hover:bg-primary transition-colors disabled:opacity-40"
            >
              {sendReminder.isPending ? "Se trimite..." : `Trimite reminder → ${reachable} pacienți`}
            </button>
          )}
        </div>

        {overdue.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-sm text-center text-muted-foreground">
            Niciun vaccin restant — felicitări.
          </div>
        ) : (
          <div className="border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
            {overdue.map((i, idx) => (
              <div
                key={`${i.patient.id}-${i.vaccine}-${idx}`}
                className={`p-4 flex items-center justify-between gap-3 flex-wrap ${
                  i.mandatory ? "bg-red-500/5" : "bg-amber-500/5"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to="/pacienti" className="font-medium hover:text-primary transition-colors">
                      {i.patient.full_name}
                    </Link>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        i.mandatory
                          ? "bg-red-600 text-white"
                          : "bg-amber-500/20 text-amber-900"
                      }`}
                    >
                      {i.mandatory ? "obligatoriu" : "opțional"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {i.vaccine}
                    {i.source === "age_schedule" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                        schemă vârstă
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-medium ${i.mandatory ? "text-red-700" : "text-amber-700"}`}
                  >
                    Restant {Math.abs(i.diffDays)}z
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatRoDate(i.dueDate)} · {i.patient.phone ?? "fără telefon"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
