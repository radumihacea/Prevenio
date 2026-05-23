import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import {
  DOCTOR_ID,
  RO_DAYS_SHORT,
  RO_MONTHS,
  SLOT_HOURS,
  addDays,
  startOfWeek,
  toISODate,
} from "@/lib/clinic";
import { toast } from "sonner";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar — MedCab" }] }),
});

function CalendarPage() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [creating, setCreating] = useState<{ date: string; time: string } | null>(null);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);

  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 5);

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments", DOCTOR_ID, "week", toISODate(weekStart)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", DOCTOR_ID)
        .gte("appointment_date", toISODate(weekStart))
        .lte("appointment_date", toISODate(weekEnd))
        .order("appointment_time");
      if (error) throw error;
      return data;
    },
  });

  const apptMap = useMemo(() => {
    const m = new Map<string, any>();
    appts.forEach((a) => m.set(`${a.appointment_date}_${a.appointment_time.slice(0, 5)}`, a));
    return m;
  }, [appts]);

  const todayIso = toISODate(new Date());

  const create = useMutation({
    mutationFn: async (input: {
      date: string;
      time: string;
      patient_name: string;
      patient_phone: string;
      reason: string;
    }) => {
      const { error } = await supabase.from("appointments").insert({
        doctor_id: DOCTOR_ID,
        patient_name: input.patient_name,
        patient_phone: input.patient_phone || null,
        appointment_date: input.date,
        appointment_time: input.time,
        reason: input.reason || null,
        source: "doctor",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setCreating(null);
      toast.success("Programare adăugată");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      patient_name: string;
      patient_phone: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          patient_name: input.patient_name,
          patient_phone: input.patient_phone || null,
          reason: input.reason || null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setEditingAppt(null);
      toast.success("Programare actualizată");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setEditingAppt(null);
      toast.success("Programare ștearsă");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />
      <main className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Săptămâna</p>
            <h2 className="text-2xl font-display font-bold">
              {weekStart.getDate()} {RO_MONTHS[weekStart.getMonth()].slice(0, 3)} —{" "}
              {weekEnd.getDate()} {RO_MONTHS[weekEnd.getMonth()]} {weekEnd.getFullYear()}
            </h2>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="size-9 grid place-items-center rounded-full border border-border hover:bg-muted"
            >
              ←
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-muted"
            >
              Astăzi
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="size-9 grid place-items-center rounded-full border border-border hover:bg-muted"
            >
              →
            </button>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[60px_repeat(6,minmax(0,1fr))] border-b border-border/60 bg-muted/30">
            <div />
            {days.map((d) => {
              const iso = toISODate(d);
              const isToday = iso === todayIso;
              return (
                <div
                  key={iso}
                  className={
                    "p-3 text-center border-l border-border/60 " +
                    (isToday ? "bg-primary/5" : "")
                  }
                >
                  <div className={"text-[10px] uppercase tracking-wider " + (isToday ? "text-primary font-bold" : "text-muted-foreground")}>
                    {RO_DAYS_SHORT[d.getDay()]}
                  </div>
                  <div className={"text-lg font-display font-bold " + (isToday ? "text-primary" : "")}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {SLOT_HOURS.map((time) => (
              <div
                key={time}
                className="grid grid-cols-[60px_repeat(6,minmax(0,1fr))] border-b border-border/40 min-h-[44px]"
              >
                <div className="p-2 text-[10px] font-mono text-muted-foreground border-r border-border/40">
                  {time}
                </div>
                {days.map((d) => {
                  const iso = toISODate(d);
                  const key = `${iso}_${time}`;
                  const appt = apptMap.get(key);
                  const isToday = iso === todayIso;
                  return (
                    <div
                      key={key}
                      onClick={() => {
                        if (appt) setEditingAppt(appt);
                        else setCreating({ date: iso, time });
                      }}
                      className={
                        "border-l border-border/40 p-1 cursor-pointer transition-colors " +
                        (appt ? "hover:bg-primary/15" : "hover:bg-primary/5 " + (isToday ? "bg-primary/[0.03]" : ""))
                      }
                    >
                      {appt && (
                        <div className="h-full bg-primary/10 border-l-2 border-primary rounded-r px-2 py-1">
                          <div className="text-[11px] font-semibold truncate">{appt.patient_name}</div>
                          {appt.reason && (
                            <div className="text-[10px] text-muted-foreground truncate">{appt.reason}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Apasă pe un slot liber pentru a adăuga, sau pe o programare existentă pentru a o modifica / șterge.
        </p>
      </main>

      {creating && (
        <AppointmentModal
          slot={creating}
          onClose={() => setCreating(null)}
          onSave={(f) => create.mutate({ ...creating, ...f })}
          saving={create.isPending}
        />
      )}

      {editingAppt && (
        <AppointmentModal
          slot={{ date: editingAppt.appointment_date, time: editingAppt.appointment_time.slice(0, 5) }}
          initial={{
            patient_name: editingAppt.patient_name ?? "",
            patient_phone: editingAppt.patient_phone ?? "",
            reason: editingAppt.reason ?? "",
          }}
          onClose={() => setEditingAppt(null)}
          onSave={(f) => update.mutate({ id: editingAppt.id, ...f })}
          onDelete={() => {
            if (confirm("Ștergi această programare?")) remove.mutate(editingAppt.id);
          }}
          saving={update.isPending || remove.isPending}
          editing
        />
      )}
    </div>
  );
}

function AppointmentModal({
  slot,
  initial,
  onClose,
  onSave,
  onDelete,
  saving,
  editing,
}: {
  slot: { date: string; time: string };
  initial?: { patient_name: string; patient_phone: string; reason: string };
  onClose: () => void;
  onSave: (f: { patient_name: string; patient_phone: string; reason: string }) => void;
  onDelete?: () => void;
  saving: boolean;
  editing?: boolean;
}) {
  const [form, setForm] = useState(
    initial ?? { patient_name: "", patient_phone: "", reason: "" },
  );
  return (
    <div className="fixed inset-0 z-50 bg-secondary/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-8 w-full max-w-md border border-border">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
          {editing ? "Editare programare" : "Programare nouă"}
        </p>
        <h3 className="text-xl font-display font-bold mb-6">
          {slot.date} · {slot.time}
        </h3>
        <div className="space-y-4">
          <Field label="Nume pacient" value={form.patient_name} onChange={(v) => setForm({ ...form, patient_name: v })} />
          <Field label="Telefon" value={form.patient_phone} onChange={(v) => setForm({ ...form, patient_phone: v })} />
          <Field label="Motiv (opțional)" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
        </div>
        <div className="flex justify-between items-center gap-2 mt-8">
          <div>
            {editing && onDelete && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="px-4 py-2 rounded-full text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50"
              >
                Șterge
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-medium hover:bg-muted">
              Anulează
            </button>
            <button
              disabled={saving || !form.patient_name}
              onClick={() => onSave(form)}
              className="px-5 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary disabled:opacity-50"
            >
              {saving ? "Se salvează..." : editing ? "Salvează" : "Adaugă"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
