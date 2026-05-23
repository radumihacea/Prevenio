import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RO_DAYS_SHORT,
  RO_MONTHS,
  SLOT_HOURS,
  addDays,
  toISODate,
} from "@/lib/clinic";
import { toast } from "sonner";

export const Route = createFileRoute("/cabinet/$slug/programari")({
  component: PublicBookingPage,
  head: ({ params }) => ({
    meta: [{ title: `Programare ${params.slug} — MedCab` }],
  }),
});

function PublicBookingPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();

  const { data: doctor } = useQuery({
    queryKey: ["doctor", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);
  const selectedDate = days[selectedDayOffset];
  const selectedIso = toISODate(selectedDate);

  const { data: takenSlots = new Set<string>() } = useQuery({
    queryKey: ["public_appts", doctor?.id, selectedIso],
    enabled: !!doctor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("appointment_time")
        .eq("doctor_id", doctor!.id)
        .eq("appointment_date", selectedIso);
      if (error) throw error;
      return new Set(data.map((a) => a.appointment_time.slice(0, 5)));
    },
  });

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ patient_name: "", patient_phone: "", reason: "" });

  const book = useMutation({
    mutationFn: async () => {
      if (!doctor) throw new Error("Cabinet inexistent");
      if (!selectedSlot) throw new Error("Selectează un interval");
      const { error } = await supabase.from("appointments").insert({
        doctor_id: doctor.id,
        patient_name: form.patient_name,
        patient_phone: form.patient_phone || null,
        appointment_date: selectedIso,
        appointment_time: selectedSlot,
        reason: form.reason || null,
        source: "public",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programare confirmată!");
      qc.invalidateQueries({ queryKey: ["public_appts"] });
      setSelectedSlot(null);
      setForm({ patient_name: "", patient_phone: "", reason: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!doctor) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <p className="text-muted-foreground text-sm">Se încarcă cabinetul...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 lg:p-12">
        <div className="text-center mb-12">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Programare online
          </span>
          <h1 className="text-4xl font-display font-bold tracking-tight mt-2">{doctor.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {doctor.cabinet_name} · {doctor.specialty}
          </p>
        </div>

        {/* Day selector */}
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            1. Alege ziua
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d, i) => {
              const active = i === selectedDayOffset;
              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDayOffset(i);
                    setSelectedSlot(null);
                  }}
                  className={
                    "shrink-0 px-5 py-3 rounded-2xl text-center transition-colors " +
                    (active
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-card border border-border hover:border-primary")
                  }
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-70">
                    {RO_DAYS_SHORT[d.getDay()]}
                  </div>
                  <div className="text-xl font-display font-bold leading-tight">{d.getDate()}</div>
                  <div className="text-[10px] opacity-70">{RO_MONTHS[d.getMonth()].slice(0, 3)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot grid */}
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            2. Alege intervalul
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {SLOT_HOURS.map((slot) => {
              const taken = takenSlots.has(slot);
              const active = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  disabled={taken}
                  onClick={() => setSelectedSlot(slot)}
                  className={
                    "py-3 rounded-xl text-sm font-medium font-mono transition-all " +
                    (taken
                      ? "bg-muted/30 text-muted-foreground/40 line-through cursor-not-allowed"
                      : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border hover:border-primary")
                  }
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        {selectedSlot && (
          <div className="bg-card border border-border rounded-3xl p-8">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              3. Datele tale
            </p>
            <div className="space-y-4">
              <input
                placeholder="Nume complet"
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
              <input
                placeholder="Telefon"
                type="tel"
                value={form.patient_phone}
                onChange={(e) => setForm({ ...form, patient_phone: e.target.value })}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
              <input
                placeholder="Motivul programării (opțional)"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
              <button
                disabled={book.isPending || !form.patient_name}
                onClick={() => book.mutate()}
                className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-primary disabled:opacity-50 transition-colors"
              >
                {book.isPending
                  ? "Se confirmă..."
                  : `Confirmă pentru ${selectedDate.getDate()} ${RO_MONTHS[selectedDate.getMonth()]} la ${selectedSlot}`}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground mt-12 uppercase tracking-widest">
          Confidențial · Datele tale rămân la medicul tău
        </p>
      </div>
    </div>
  );
}
