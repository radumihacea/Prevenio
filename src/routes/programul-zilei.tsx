import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import {
  formatRoLongDate,
  formatRoPhone,
  toISODate,
} from "@/lib/clinic";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";

export const Route = createFileRoute("/programul-zilei")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: TodayPage,
  head: () => ({ meta: [{ title: "Programul zilei — MedCab" }] }),
});

function TodayPage() {
  const navigate = useNavigate();
  const { data: doctor } = useCurrentDoctor();
  const doctorId = doctor?.id;
  const today = new Date();
  const todayIso = toISODate(today);

  const { data: appts = [], isLoading } = useQuery({
    queryKey: ["appointments", doctorId, "day", todayIso],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId!)
        .eq("appointment_date", todayIso)
        .order("appointment_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("doctor_id", doctorId!);
      if (error) throw error;
      return data;
    },
  });

  const patientByName = new Map(patients.map((p: any) => [p.full_name, p.id]));

  function openProfile(appt: any) {
    const id = appt.patient_id ?? patientByName.get(appt.patient_name);
    if (id) {
      navigate({ to: "/pacienti", search: { id } as any });
    } else {
      navigate({ to: "/pacienti" });
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />
      <main className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Astăzi
          </p>
          <h2 className="text-3xl font-display font-bold capitalize">
            {formatRoLongDate(today)}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {appts.length === 0
              ? "Nicio programare astăzi."
              : `${appts.length} programare${appts.length === 1 ? "" : appts.length < 20 ? "" : ""}${appts.length === 1 ? "" : ""} în agenda zilei.`}
          </p>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground">Se încarcă...</div>
        )}

        {!isLoading && appts.length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
            Liber astăzi. Apasă pe Calendar pentru a adăuga programări.
          </div>
        )}

        <div className="space-y-2">
          {appts.map((a: any) => (
            <button
              key={a.id}
              onClick={() => openProfile(a)}
              className="w-full text-left bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4 hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="text-2xl font-display font-bold text-primary w-20 shrink-0">
                {String(a.appointment_time).slice(0, 5)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{a.patient_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.reason ?? "Consultație"} ·{" "}
                  {formatRoPhone(a.patient_phone)}
                </div>
              </div>
              <span className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                FIȘĂ →
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
