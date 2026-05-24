import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { cancelAppointment } from "@/lib/appointments.functions";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import {
  RO_DAYS_SHORT,
  RO_MONTHS,
  addDays,
  generateSlots,
  isoDow,
  startOfWeek,
  toISODate,
} from "@/lib/clinic";
import { toast } from "sonner";

export const Route = createFileRoute("/calendar")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar — MedCab" }] }),
});

const DAY_LABELS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

function CalendarPage() {
  const qc = useQueryClient();
  const cancelAppointmentFn = useServerFn(cancelAppointment);
  const { data: doctor } = useCurrentDoctor();
  const doctorId = doctor?.id;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [creating, setCreating] = useState<{ date: string; time: string } | null>(null);
  const [editingAppt, setEditingAppt] = useState<any | null>(null);
  const [showHoursEditor, setShowHoursEditor] = useState(false);

  const workingDays = doctor?.working_days ?? [1, 2, 3, 4, 5];
  const workStart = doctor?.work_start_time ?? "08:00";
  const workEnd = doctor?.work_end_time ?? "18:00";

  // Toate cele 7 zile, dar afișăm doar zilele de lucru
  const days = useMemo(() => {
    const all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return all.filter((d) => workingDays.includes(isoDow(d)));
  }, [weekStart, workingDays]);
  const weekEnd = addDays(weekStart, 6);

  const slotHours = useMemo(() => generateSlots(workStart, workEnd), [workStart, workEnd]);

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments", doctorId, "week", toISODate(weekStart)],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("doctor_id", doctorId!)
        .gte("appointment_date", toISODate(weekStart))
        .lte("appointment_date", toISODate(weekEnd))
        .neq("status", "cancelled")
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
      const { data: inserted, error } = await supabase
        .from("appointments")
        .insert({
          doctor_id: doctorId!,
          patient_name: input.patient_name,
          patient_phone: input.patient_phone || null,
          appointment_date: input.date,
          appointment_time: input.time,
          reason: input.reason || null,
          source: "doctor",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) {
        fetch("/api/public/confirm-appointment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: inserted.id }),
        }).catch((e) => console.error("SMS confirmation failed", e));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["sms_log"] });
      setCreating(null);
      toast.success("Programare adăugată — pacientul a fost notificat prin SMS");
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
      return cancelAppointmentFn({ data: { appointmentId: id } });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["sms_log"] });
      setEditingAppt(null);
      if (result.warning) toast.warning(`Programare anulată. ${result.warning}`);
      else toast.success("Programare anulată și pacientul a fost notificat prin SMS");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveHours = useMutation({
    mutationFn: async (input: { working_days: number[]; work_start_time: string; work_end_time: string }) => {
      const { error } = await supabase
        .from("doctors")
        .update(input)
        .eq("id", doctorId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-doctor"] });
      setShowHoursEditor(false);
      toast.success("Program actualizat");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const gridCols = `60px repeat(${days.length}, minmax(0, 1fr))`;

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
              onClick={() => setShowHoursEditor(true)}
              className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-muted"
            >
              Program de lucru
            </button>
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
          <div className="grid border-b border-border/60 bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
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
            {slotHours.map((time) => (
              <div
                key={time}
                className="grid border-b border-border/40 min-h-[44px]"
                style={{ gridTemplateColumns: gridCols }}
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
            if (confirm("Anulezi această programare și trimiți SMS pacientului?")) remove.mutate(editingAppt.id);
          }}
          saving={update.isPending || remove.isPending}
          editing
        />
      )}

      {showHoursEditor && doctor && (
        <WorkingHoursModal
          initial={{
            working_days: workingDays,
            work_start_time: workStart.slice(0, 5),
            work_end_time: workEnd.slice(0, 5),
          }}
          onClose={() => setShowHoursEditor(false)}
          onSave={(f) => saveHours.mutate(f)}
          saving={saveHours.isPending}
        />
      )}
    </div>
  );
}

function WorkingHoursModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: { working_days: number[]; work_start_time: string; work_end_time: string };
  onClose: () => void;
  onSave: (f: { working_days: number[]; work_start_time: string; work_end_time: string }) => void;
  saving: boolean;
}) {
  const [days, setDays] = useState<number[]>(initial.working_days);
  const [start, setStart] = useState(initial.work_start_time);
  const [end, setEnd] = useState(initial.work_end_time);

  const toggle = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  return (
    <div className="fixed inset-0 z-50 bg-secondary/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl p-8 w-full max-w-md border border-border">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">Setări</p>
        <h3 className="text-xl font-display font-bold mb-6">Program de lucru</h3>

        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Zile de lucru
        </p>
        <div className="grid grid-cols-7 gap-1.5 mb-6">
          {DAY_LABELS.map((lbl, i) => {
            const dow = i + 1;
            const active = days.includes(dow);
            return (
              <button
                key={dow}
                onClick={() => toggle(dow)}
                className={
                  "py-2 rounded-lg text-xs font-medium border transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:border-primary")
                }
              >
                {lbl.slice(0, 3)}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Ora început
            </label>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Ora sfârșit
            </label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-medium hover:bg-muted">
            Anulează
          </button>
          <button
            disabled={saving || days.length === 0 || start >= end}
            onClick={() => onSave({ working_days: days, work_start_time: start, work_end_time: end })}
            className="px-5 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
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
                Anulează programarea
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
