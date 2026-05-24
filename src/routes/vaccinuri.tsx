import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import type { PatientLite, VaccinationRow } from "@/lib/segments";

export const Route = createFileRoute("/vaccinuri")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: VaccinesPage,
  head: () => ({ meta: [{ title: "Vaccinuri — MedCab" }] }),
});

type CatalogRow = {
  id: string;
  name: string;
  mandatory: boolean;
  recommended_age_months: number | null;
};

function matchesVaccine(vacName: string, catName: string): boolean {
  const v = vacName.toLowerCase();
  const c = catName.toLowerCase();
  const firstWord = c.split(" ")[0];
  if (!v.includes(firstWord)) return false;
  if (c.includes("doza 2")) return v.includes("doza 2");
  if (c.includes("doza 3")) return v.includes("doza 3");
  return true;
}

function VaccinesPage() {
  const { data: doctor } = useCurrentDoctor();
  const doctorId = doctor?.id;

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("doctor_id", doctorId!);
      if (error) throw error;
      return data as PatientLite[];
    },
  });

  const patientIds = useMemo(() => patients.map((p) => p.id), [patients]);

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["vaccinations_for_doctor", doctorId, patientIds.length],
    enabled: !!doctorId && patientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vaccinations")
        .select("*")
        .in("patient_id", patientIds);
      if (error) throw error;
      return data as VaccinationRow[];
    },
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["vaccine_catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vaccine_catalog")
        .select("id, name, mandatory, recommended_age_months")
        .order("recommended_age_months", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as CatalogRow[];
    },
  });

  const rows = useMemo(() => {
    const totalPatients = patients.length;
    return catalog.map((c) => {
      const vaccinatedSet = new Set<string>();
      for (const v of vaccinations) {
        if (matchesVaccine(v.vaccine_name, c.name)) {
          vaccinatedSet.add(v.patient_id);
        }
      }
      const vaccinated = vaccinatedSet.size;
      const unvaccinated = Math.max(0, totalPatients - vaccinated);
      return { ...c, vaccinated, unvaccinated };
    });
  }, [catalog, vaccinations, patients]);

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />
      <main className="max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-display font-bold">Vaccinuri</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Lista vaccinurilor din Calendarul Național — pentru fiecare vaccin, câți
            dintre pacienții tăi îl au și câți nu.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-sm text-center text-muted-foreground">
            Catalogul de vaccinuri este gol.
          </div>
        ) : (
          <div className="border border-border rounded-2xl divide-y divide-border/60 overflow-hidden bg-card">
            <div className="px-5 py-3 grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground bg-muted/40">
              <div className="col-span-7">Vaccin</div>
              <div className="col-span-2 text-right">Vaccinați</div>
              <div className="col-span-3 text-right">Nevaccinați</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="px-5 py-4 grid grid-cols-12 gap-4 items-center"
              >
                <div className="col-span-7 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.name}</span>
                    <span
                      className={
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded " +
                        (r.mandatory
                          ? "bg-red-600 text-white"
                          : "bg-amber-500/20 text-amber-900")
                      }
                    >
                      {r.mandatory ? "obligatoriu" : "opțional"}
                    </span>
                    {r.recommended_age_months != null && (
                      <span className="text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {r.recommended_age_months < 12
                          ? `${r.recommended_age_months} luni`
                          : `${Math.round(r.recommended_age_months / 12)} ani`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <div className="text-2xl font-display font-bold text-emerald-700">
                    {r.vaccinated}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    pacienți
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <div
                    className={
                      "text-2xl font-display font-bold " +
                      (r.mandatory && r.unvaccinated > 0
                        ? "text-red-700"
                        : "text-amber-700")
                    }
                  >
                    {r.unvaccinated}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    pacienți
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
