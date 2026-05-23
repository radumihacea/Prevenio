import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { DOCTOR_ID, DOCTOR_SLUG, formatRoDate } from "@/lib/clinic";
import { SMS_TEMPLATES, type PatientLite, type SmsTemplate } from "@/lib/segments";
import { toast } from "sonner";

export const Route = createFileRoute("/comunicare")({
  component: CommunicationPage,
  head: () => ({ meta: [{ title: "Comunicare — MedCab" }] }),
});

const CATEGORY_TONE: Record<SmsTemplate["category"], string> = {
  Preventie: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  Monitorizare: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  Logistica: "bg-primary/10 text-primary border-primary/30",
};

function CommunicationPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(SMS_TEMPLATES[0].id);

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

  const { data: logs = [] } = useQuery({
    queryKey: ["sms_log", DOCTOR_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_log")
        .select("*")
        .eq("doctor_id", DOCTOR_ID)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const tpl = SMS_TEMPLATES.find((t) => t.id === selected) ?? SMS_TEMPLATES[0];

  const audience = useMemo(() => {
    return patients.filter(
      (p) => !!p.phone && (!tpl.audience || tpl.audience(p)),
    );
  }, [patients, tpl]);

  const send = useMutation({
    mutationFn: async () => {
      const link = `${window.location.origin}/cabinet/${DOCTOR_SLUG}/programari`;
      const message = `${tpl.body} ${link}`;
      const rows = audience.map((p) => ({
        doctor_id: DOCTOR_ID,
        recipient_phone: p.phone!,
        recipient_name: p.full_name,
        message,
        status: "queued",
      }));
      if (rows.length === 0) throw new Error("Niciun pacient în acest segment.");
      const { error } = await supabase.from("sms_log").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Mesaje trimise către ${n} pacienți`);
      qc.invalidateQueries({ queryKey: ["sms_log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const campaigns = new Map<string, typeof logs>();
  logs.forEach((l) => {
    const key = `${l.message}::${l.created_at.slice(0, 16)}`;
    if (!campaigns.has(key)) campaigns.set(key, [] as any);
    campaigns.get(key)!.push(l);
  });

  const grouped = SMS_TEMPLATES.reduce<Record<string, SmsTemplate[]>>((acc, t) => {
    acc[t.category] = acc[t.category] ?? [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />
      <main className="max-w-7xl mx-auto space-y-8">
        {/* Automatizări active */}
        <section className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-500/20 text-emerald-700 text-xs">✓</span>
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Automatizări active
            </h2>
          </div>
          <ul className="text-sm space-y-1.5 text-foreground/80">
            <li>→ <b>Reminder programări</b>: cu 24h înainte, pacientul primește automat un SMS cu data și ora.</li>
            <li>→ <b>Reminder vaccinuri pe vârstă</b>: cu ~2 luni înainte de împlinirea vârstei recomandate (ex. 14 ani → dTpa), părinții primesc automat invitația de programare.</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            Rulează zilnic la 09:00. Mesajele apar în istoricul de mai jos.
          </p>
        </section>

        <div className="grid grid-cols-12 gap-8">
        {/* Templates list */}
        <section className="col-span-12 lg:col-span-5 space-y-6">
          <div>
            <h2 className="text-2xl font-display font-bold">Template-uri mesaje</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Selectează un șablon — sistemul filtrează automat publicul țintă.
            </p>
          </div>

          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                {cat}
              </div>
              <div className="space-y-2">
                {items.map((t) => {
                  const active = t.id === selected;
                  const count = patients.filter(
                    (p) => !!p.phone && (!t.audience || t.audience(p)),
                  ).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className={
                        "w-full text-left p-4 rounded-2xl border transition-colors " +
                        (active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-muted/40")
                      }
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="font-medium text-sm">{t.title}</div>
                        <span
                          className={
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border " +
                            CATEGORY_TONE[t.category]
                          }
                        >
                          {count}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {t.body}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Preview & send */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="bg-card border border-border/60 rounded-3xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span
                  className={
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full border " +
                    CATEGORY_TONE[tpl.category]
                  }
                >
                  {tpl.category}
                </span>
                <h3 className="text-xl font-display font-bold mt-2">{tpl.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {tpl.audienceLabel ?? "Toți pacienții"}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-display font-bold text-primary">{audience.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  destinatari
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl text-sm leading-relaxed mb-4">
              „{tpl.body}{" "}
              <span className="text-primary">
                med.ro/{DOCTOR_SLUG}/programari
              </span>
              "
            </div>

            <button
              disabled={send.isPending || audience.length === 0}
              onClick={() => send.mutate()}
              className="w-full py-3 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-primary transition-colors disabled:opacity-40"
            >
              {send.isPending
                ? "Se trimite..."
                : audience.length === 0
                  ? "Niciun pacient în acest segment"
                  : `Trimite către ${audience.length} pacienți`}
            </button>
          </div>

          {audience.length > 0 && (
            <div className="bg-card border border-border/60 rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Destinatari ({audience.length})
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {audience.map((p) => (
                  <span
                    key={p.id}
                    className="text-[11px] px-2 py-1 bg-muted rounded-full"
                  >
                    {p.full_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-display font-bold mb-3">Istoric campanii</h3>
            {campaigns.size === 0 && (
              <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                Niciun mesaj trimis încă.
              </div>
            )}
            <div className="space-y-3">
              {Array.from(campaigns.entries()).map(([key, group]) => {
                const first = group[0];
                return (
                  <div key={key} className="bg-card border border-border/60 rounded-2xl p-4">
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <p className="text-sm leading-relaxed flex-1">{first.message}</p>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-bold uppercase text-primary">
                          {group.length}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatRoDate(first.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
