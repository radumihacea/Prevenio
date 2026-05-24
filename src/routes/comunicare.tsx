import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { formatRoDate } from "@/lib/clinic";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { SMS_TEMPLATES, type PatientLite, type SmsTemplate } from "@/lib/segments";
import { sendTemplateSms } from "@/lib/communications.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/comunicare")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
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
  const { data: doctor } = useCurrentDoctor();
  const doctorId = doctor?.id;
  const doctorSlug = doctor?.slug ?? "";
  const [selected, setSelected] = useState<string>(SMS_TEMPLATES[0].id);

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

  const { data: logs = [] } = useQuery({
    queryKey: ["sms_log", doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_log")
        .select("*")
        .eq("doctor_id", doctorId!)
        .order("created_at", { ascending: false })
        .limit(500);
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

  // Istoricul mesajelor trimise pentru template-ul selectat.
  // Match: 1) prin tag = template_id (preferat), 2) fallback prin începutul textului.
  const historyForTemplate = useMemo(() => {
    return logs.filter((l: any) => {
      if (l.template_id) return l.template_id === tpl.id;
      if (l.tag === tpl.id) return true;
      const body = (l.message ?? "").toString();
      return body.startsWith(tpl.body.slice(0, 40));
    });
  }, [logs, tpl]);

  const sendFn = useServerFn(sendTemplateSms);
  const send = useMutation({
    mutationFn: async () => {
      if (!doctorId) throw new Error("Sesiune medic invalidă.");
      if (audience.length === 0) throw new Error("Niciun pacient în acest segment.");
      return sendFn({
        data: { templateId: tpl.id, doctorId, doctorSlug },
      });
    },
    onSuccess: (res: any) => {
      if (res.warning) toast.warning(res.warning);
      else if (res.failed > 0 && res.sent === 0) {
        toast.error(
          `Niciun SMS trimis. Primul destinatar a eșuat (${res.skipped ?? 0} omise). ${res.lastError ?? ""}`,
        );
      } else {
        toast.success(
          `Trimise: ${res.sent} • Eșuate: ${res.failed}${res.skipped ? ` • Omise: ${res.skipped}` : ""}`,
        );
      }
      qc.invalidateQueries({ queryKey: ["sms_log"] });
    },
    onError: (e: any) => toast.error(e.message),
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
        <div className="grid grid-cols-12 gap-8">

          {/* Templates list */}
          <section className="col-span-12 lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold">Template-uri mesaje</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Selectează un șablon — în dreapta vezi detaliile și istoricul lui.
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
                            {t.category}
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

          {/* Preview & history */}
          <section className="col-span-12 lg:col-span-7 space-y-6">
            <div className="bg-card border border-border/60 rounded-3xl p-6">
              <span
                className={
                  "text-[10px] font-bold uppercase px-2 py-1 rounded-full border " +
                  CATEGORY_TONE[tpl.category]
                }
              >
                {tpl.category}
              </span>
              <h3 className="text-xl font-display font-bold mt-2">{tpl.title}</h3>

              <div className="p-4 bg-muted/40 rounded-xl text-sm leading-relaxed mt-4 mb-4">
                „{tpl.body}{" "}
                <span className="text-primary">
                  med.ro/{doctorSlug}/programari
                </span>
                "
              </div>

              <button
                disabled={send.isPending || audience.length === 0 || !doctorId}
                onClick={() => send.mutate()}
                className="w-full py-3 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-primary transition-colors disabled:opacity-40"
              >
                {send.isPending
                  ? "Se trimite..."
                  : audience.length === 0
                    ? "Niciun pacient în acest segment"
                    : "Trimite mesajul"}
              </button>
            </div>

            <div>
              <h3 className="text-sm font-display font-bold mb-3">
                Istoric destinatari — {tpl.title}
              </h3>
              {historyForTemplate.length === 0 ? (
                <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
                  Acest mesaj nu a fost încă trimis.
                </div>
              ) : (
                <div className="bg-card border border-border/60 rounded-2xl max-h-[520px] overflow-y-auto divide-y divide-border/60">
                  {historyForTemplate.map((l: any) => (
                    <div key={l.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {l.recipient_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {l.recipient_phone}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {l.status}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatRoDate(l.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
