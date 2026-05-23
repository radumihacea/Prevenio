import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import {
  DOCTOR_ID,
  formatRoLongDate,
  formatRoPhone,
  toISODate,
  SLOT_HOURS,
} from "@/lib/clinic";


export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Astăzi — MedCab" }],
  }),
});

function Dashboard() {
  const today = toISODate(new Date());

  const { data: todaysAppts = [] } = useQuery({
    queryKey: ["appointments", DOCTOR_ID, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", DOCTOR_ID)
        .eq("appointment_date", today)
        .order("appointment_time");
      if (error) throw error;
      return data;
    },
  });

  // Build today timeline — multiple appointments per slot supported
  const bySlot = new Map<string, typeof todaysAppts>();
  for (const a of todaysAppts) {
    const k = a.appointment_time.slice(0, 5);
    if (!bySlot.has(k)) bySlot.set(k, []);
    bySlot.get(k)!.push(a);
  }
  const timeline = SLOT_HOURS.map((slot) => ({
    time: slot,
    appts: bySlot.get(slot) ?? [],
  }));


  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />

      <main className="max-w-7xl mx-auto grid grid-cols-12 gap-8">
        {/* Today appointments list */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-display font-bold">
                  Programări astăzi
                  <span className="ml-3 text-xs font-mono text-muted-foreground font-normal">
                    {todaysAppts.length}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRoLongDate(new Date())}
                </p>
              </div>
              <Link
                to="/calendar"
                className="text-xs font-bold text-primary uppercase tracking-wider"
              >
                Vezi calendar →
              </Link>
            </div>

            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
              {todaysAppts.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Nicio programare astăzi.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/60">
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-20">
                        Oră
                      </th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Pacient
                      </th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Motiv
                      </th>
                      <th className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Telefon
                      </th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {todaysAppts.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="p-4 font-mono text-sm font-bold text-primary">
                          {a.appointment_time.slice(0, 5)}
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{a.patient_name}</div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {a.reason ?? "Consultație"}
                        </td>
                        <td className="p-4 text-sm font-mono text-muted-foreground">
                          {formatRoPhone(a.patient_phone)}
                        </td>

                        <td className="p-4 text-right">
                          {a.patient_id && (
                            <Link
                              to="/pacienti"
                              className="text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              FIȘĂ →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        {/* Today timeline */}
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <section className="bg-secondary text-secondary-foreground rounded-3xl p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-xl font-display font-bold">Agendă</h2>
                <p className="text-white/50 text-xs">Sloturi orare</p>
              </div>
              <div className="size-10 rounded-full border border-white/20 grid place-items-center text-xs font-bold">
                {todaysAppts.length}
              </div>
            </div>

            <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2">
              {timeline.map(({ time, appts }) => {
                const has = appts.length > 0;
                return (
                  <div key={time} className="flex gap-4">
                    <span
                      className={
                        "text-xs font-bold w-12 pt-1 " +
                        (has ? "text-primary" : "text-white/25")
                      }
                    >
                      {time}
                    </span>
                    <div
                      className={
                        "flex-1 pl-4 border-l space-y-2 " +
                        (has ? "border-white/15" : "border-accent/60")
                      }
                    >
                      {has ? (
                        appts.map((appt) => (
                          <div key={appt.id}>
                            <div className="text-sm font-medium">
                              {appt.reason ?? "Consultație"}
                            </div>
                            <div className="text-[11px] text-white/40">
                              {appt.patient_name}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-accent uppercase tracking-wider">
                          Liber
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
