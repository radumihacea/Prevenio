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

type DueItem = {
  patient: PatientLite;
  vaccine: string;
  dueDate: string;
  diffDays: number;
  source: "next_dose" | "age_schedule";
};

const AGE_SCHEDULE: { age: number; vaccine: string }[] = [
  { age: 1, vaccine: "ROR (rujeolă-oreion-rubeolă)" },
  { age: 5, vaccine: "DTPa-VPI (rapel preșcolar)" },
  { age: 11, vaccine: "HPV" },
  { age: 14, vaccine: "dTpa (rapel adolescent)" },
  { age: 18, vaccine: "dT (rapel adult)" },
];

const MS_DAY = 1000 * 60 * 60 * 24;

function ageInYears(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (MS_DAY * 365.25);
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

  const byPatient = useMemo(() => {
    const m = new Map<string, VaccinationRow[]>();
    for (const v of vaccinations) {
      if (!m.has(v.patient_id)) m.set(v.patient_id, []);
      m.get(v.patient_id)!.push(v);
    }
    return m;
  }, [vaccinations]);

  // Doar restantele: next_due_date depășit sau vaccin din schemă vârstă deja trecută
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
          out.push({
            patient: p,
            vaccine: v.vaccine_name,
            dueDate: v.next_due_date,
            diffDays,
            source: "next_dose",
          });
        }
      }

      const age = ageInYears(p.birth_date);
      if (age === null) continue;
      for (const s of AGE_SCHEDULE) {
        const done = vacs.some((v) =>
          v.vaccine_name.toLowerCase().includes(s.vaccine.split(" ")[0].toLowerCase()),
        );
        if (done) continue;
        if (age > s.age) {
          const birth = new Date(p.birth_date!);
          const dueDate = new Date(birth);
          dueDate.setFullYear(birth.getFullYear() + s.age);
          const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / MS_DAY);
          out.push({
            patient: p,
            vaccine: s.vaccine,
            dueDate: dueDate.toISOString().slice(0, 10),
            diffDays,
            source: "age_schedule",
          });
        }
      }
    }
    return out.sort((a, b) => a.diffDays - b.diffDays);
  }, [patients, byPatient]);

  const sendReminder = useMutation({
    mutationFn: async (items: DueItem[]) => {
      const link = `${window.location.origin}/cabinet/${DOCTOR_SLUG}/programari`;
      const rows = items
        .filter((i) => !!i.patient.phone)
        .map((i) => ({
          doctor_id: DOCTOR_ID,
          recipient_phone: i.patient.phone!,
          recipient_name: i.patient.full_name,
          message: `Bună ziua, pentru ${i.patient.full_name} vaccinul ${i.vaccine} este restant (scadent acum ${Math.abs(i.diffDays)} zile). Vă rugăm programați-vă: ${link}`,
          status: "queued",
        }));
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
          <div>
            <div className="text-4xl font-display font-bold text-red-700">{overdue.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              rapeluri / vaccinuri restante
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
          <div className="border border-red-500/30 bg-red-500/5 rounded-2xl divide-y divide-border/60">
            {overdue.map((i, idx) => (
              <div
                key={`${i.patient.id}-${i.vaccine}-${idx}`}
                className="p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <Link to="/pacienti" className="font-medium hover:text-primary transition-colors">
                    {i.patient.full_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {i.vaccine}
                    {i.source === "age_schedule" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                        schemă vârstă
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-red-700">
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
