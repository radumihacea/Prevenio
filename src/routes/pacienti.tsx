import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { formatRoDate, ageFromBirth } from "@/lib/clinic";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import {
  populationStats,
  vaccineSuggestions,
  type PatientLite,
  type VaccinationRow,
  type VaccineCatalogRow,
} from "@/lib/segments";
import { toast } from "sonner";

type PatientsSearch = { id?: string };

export const Route = createFileRoute("/pacienti")({
  validateSearch: (s: Record<string, unknown>): PatientsSearch => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: PatientsPage,
  head: () => ({ meta: [{ title: "Pacienți — MedCab" }] }),
});

type Patient = PatientLite & {
  cnp: string | null;
  address: string | null;
};

const empty: Omit<Patient, "id"> = {
  full_name: "",
  birth_date: null,
  cnp: null,
  phone: null,
  address: null,
  last_visit: null,
  conditions: [],
  vaccinated_flu: false,
  last_lab_date: null,
  last_bp_check: null,
};


function PatientsPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: doctor } = useCurrentDoctor();
  const doctorId = doctor?.id;
  const [editing, setEditing] = useState<Patient | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("doctor_id", doctorId!)
        .order("full_name");
      if (error) throw error;
      return data as Patient[];
    },
  });

  const stats = useMemo(() => populationStats(patients), [patients]);

  // Deschide automat fișa pacientului dacă URL-ul are ?id=<uuid>
  useEffect(() => {
    if (!search.id || patients.length === 0) return;
    const p = patients.find((x) => x.id === search.id);
    if (p) setEditing(p);
  }, [search.id, patients]);

  const save = useMutation({
    mutationFn: async (p: Partial<Patient> & { id?: string }) => {
      const payload: any = {
        full_name: p.full_name,
        birth_date: p.birth_date || null,
        cnp: p.cnp || null,
        phone: p.phone || null,
        address: p.address || null,
        last_visit: p.last_visit || null,
        conditions: p.conditions ?? [],
        vaccinated_flu: !!p.vaccinated_flu,
        last_lab_date: p.last_lab_date || null,
        last_bp_check: p.last_bp_check || null,
      };
      if (p.id) {
        const { error } = await supabase.from("patients").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patients")
          .insert({ doctor_id: doctorId!, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      setEditing(null);
      setCreating(false);
      toast.success("Pacient salvat");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = patients;

  function closeModal() {
    setCreating(false);
    setEditing(null);
    if (search.id) navigate({ to: "/pacienti", search: {} });
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <AppHeader />
      <main className="max-w-7xl mx-auto space-y-8">
        {/* Stare populație */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Total pacienți", value: stats.total, tone: "bg-secondary text-secondary-foreground" },
            { label: "Monitorizați cronic", value: stats.monitored, tone: "bg-card border border-border" },
            { label: "Inactivi 12+ luni", value: stats.inactive12, tone: "bg-red-500/10 border border-red-500/30 text-red-700" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl p-5 ${s.tone}`}>
              <div className="text-3xl font-display font-bold">{s.value}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider mt-1 opacity-80">
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-2xl font-display font-bold">
            Toți pacienții
            <span className="text-base font-mono text-muted-foreground font-normal ml-2">
              {filtered.length}
            </span>
          </h2>
          <button
            onClick={() => setCreating(true)}
            className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium hover:bg-primary transition-colors"
          >
            + Pacient Nou
          </button>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted/40 border-b border-border/60">
              <tr>
                {["Pacient", "Afecțiuni", "Telefon", "Ultima Vizită", "Vaccin", ""].map((h) => (
                  <th key={h} className="p-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Se încarcă...</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 group cursor-pointer" onClick={() => setEditing(p)}>
                  <td className="p-4">
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRoDate(p.birth_date)}
                      {ageFromBirth(p.birth_date) !== null ? ` · ${ageFromBirth(p.birth_date)} ani` : ""}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {(p.conditions ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        (p.conditions ?? []).map((c) => (
                          <span key={c} className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-700 rounded-full uppercase tracking-wider font-bold">
                            {c}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-sm">{p.phone ?? "—"}</td>
                  <td className="p-4 text-sm">{formatRoDate(p.last_visit)}</td>
                  <td className="p-4 text-sm">
                    {p.vaccinated_flu ? (
                      <span className="text-emerald-600 text-xs font-bold">✓ Da</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-primary text-xs font-bold opacity-0 group-hover:opacity-100">
                      FIȘĂ →
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Niciun pacient în acest segment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {(creating || editing) && (
        <PatientModal
          initial={editing ?? { ...empty, id: undefined as any }}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(p) => save.mutate(p)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}


function PatientModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: any;
  onClose: () => void;
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...initial, conditions: initial.conditions ?? [] });
  const [newCondition, setNewCondition] = useState("");

  const patientId: string | undefined = initial.id;

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["vaccinations", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vaccinations")
        .select("*")
        .eq("patient_id", patientId)
        .order("administered_date", { ascending: false });
      if (error) throw error;
      return data as VaccinationRow[];
    },
  });

  const suggestions = useMemo(() => vaccineSuggestions(vaccinations), [vaccinations]);

  function addCondition() {
    const c = newCondition.trim();
    if (!c) return;
    if (form.conditions.includes(c)) {
      setNewCondition("");
      return;
    }
    setForm({ ...form, conditions: [...form.conditions, c] });
    setNewCondition("");
  }
  function removeCondition(c: string) {
    setForm({ ...form, conditions: form.conditions.filter((x: string) => x !== c) });
  }

  return (
    <div className="fixed inset-0 z-50 bg-secondary/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-3xl p-8 w-full max-w-3xl border border-border my-8">
        <h3 className="text-xl font-display font-bold mb-1">
          {initial.id ? form.full_name || "Editare pacient" : "Pacient nou"}
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          {initial.id ? "Fișă pacient" : "Adaugă un pacient nou în registru"}
        </p>

        {/* Sugestii automate */}
        {initial.id && suggestions.length > 0 && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
              Sugestii automate
            </div>
            <ul className="space-y-1.5">
              {suggestions.map((s, i) => (
                <li key={i} className="text-sm leading-relaxed flex gap-2">
                  <span className="text-primary">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {[
            { k: "full_name", label: "Nume complet", type: "text", full: true },
            { k: "birth_date", label: "Data nașterii", type: "date" },
            { k: "cnp", label: "CNP", type: "text" },
            { k: "phone", label: "Telefon", type: "tel" },
            { k: "address", label: "Adresă", type: "text", full: true },
            { k: "last_visit", label: "Ultima vizită", type: "date" },
            { k: "last_bp_check", label: "Ultim control tensiune", type: "date" },
            { k: "last_lab_date", label: "Ultimele analize", type: "date" },
          ].map((f: any) => (
            <div key={f.k} className={f.full ? "col-span-2" : ""}>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                {f.label}
              </label>
              <input
                type={f.type}
                value={form[f.k] ?? ""}
                onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>

        <div className="mt-5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
            Boli cunoscute
          </label>
          <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
            {form.conditions.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nicio boală înregistrată.</span>
            ) : (
              form.conditions.map((c: string) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 border border-amber-500/40 text-amber-700"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCondition(c)}
                    className="ml-1 text-amber-700/70 hover:text-amber-900"
                    aria-label={`Șterge ${c}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCondition();
                }
              }}
              placeholder="ex. hipertensiune, diabet tip 2..."
              className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={addCondition}
              disabled={!newCondition.trim()}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold uppercase hover:bg-primary disabled:opacity-40"
            >
              Adaugă
            </button>
          </div>
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!form.vaccinated_flu}
            onChange={(e) => setForm({ ...form, vaccinated_flu: e.target.checked })}
            className="size-4 accent-primary"
          />
          Vaccinat antigripal în sezonul curent
        </label>

        {patientId && (
          <VaccinationsPanel patientId={patientId} vaccinations={vaccinations} />
        )}

        <div className="flex justify-end gap-2 mt-8">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-medium hover:bg-muted">
            Închide
          </button>
          <button
            disabled={saving || !form.full_name}
            onClick={() => onSave(form)}
            className="px-5 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary disabled:opacity-50"
          >
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaccinationsPanel({
  patientId,
  vaccinations,
}: {
  patientId: string;
  vaccinations: VaccinationRow[];
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({
    vaccine_id: "",
    vaccine_name: "",
    administered_date: today,
    dose_number: 1,
    lot_number: "",
    manufacturer: "",
    administered_by: "",
    adverse_reactions: "",
    next_due_date: "",
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["vaccine_catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vaccine_catalog")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as VaccineCatalogRow[];
    },
  });

  function pickVaccine(id: string) {
    const v = catalog.find((c) => c.id === id);
    if (!v) {
      setForm({ ...form, vaccine_id: "", vaccine_name: "" });
      return;
    }
    let next = "";
    if (v.interval_months) {
      const d = new Date(form.administered_date || today);
      d.setMonth(d.getMonth() + v.interval_months);
      next = d.toISOString().slice(0, 10);
    }
    setForm({
      ...form,
      vaccine_id: v.id,
      vaccine_name: v.name,
      manufacturer: v.manufacturer ?? "",
      next_due_date: next,
    });
  }

  const add = useMutation({
    mutationFn: async () => {
      const payload = {
        patient_id: patientId,
        vaccine_id: form.vaccine_id || null,
        vaccine_name: form.vaccine_name,
        administered_date: form.administered_date,
        dose_number: Number(form.dose_number) || 1,
        lot_number: form.lot_number || null,
        manufacturer: form.manufacturer || null,
        administered_by: form.administered_by || null,
        adverse_reactions: form.adverse_reactions || null,
        next_due_date: form.next_due_date || null,
      };
      const { error } = await (supabase as any).from("vaccinations").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations", patientId] });
      qc.invalidateQueries({ queryKey: ["vaccine_counts"] });
      setAdding(false);
      setForm({
        vaccine_id: "", vaccine_name: "", administered_date: today,
        dose_number: 1, lot_number: "", manufacturer: "",
        administered_by: "", adverse_reactions: "", next_due_date: "",
      });
      toast.success("Vaccinare înregistrată");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("vaccinations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations", patientId] });
      qc.invalidateQueries({ queryKey: ["vaccine_counts"] });
      toast.success("Vaccinare ștearsă");
    },
  });

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Istoric vaccinări · {vaccinations.length}
        </h4>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-bold text-primary hover:underline"
          >
            + Adaugă vaccinare
          </button>
        )}
      </div>

      {vaccinations.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Nicio vaccinare înregistrată.</p>
      )}

      {vaccinations.length > 0 && (
        <div className="space-y-2">
          {vaccinations.map((v) => {
            const overdue = v.next_due_date && new Date(v.next_due_date) < new Date();
            return (
              <div key={v.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {v.vaccine_name}
                    <span className="ml-2 text-xs text-muted-foreground">doza {v.dose_number}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatRoDate(v.administered_date)}
                    {v.lot_number ? ` · lot ${v.lot_number}` : ""}
                    {v.manufacturer ? ` · ${v.manufacturer}` : ""}
                  </div>
                  {v.adverse_reactions ? (
                    <div className="text-xs text-red-700 mt-1">
                      ⚠ Reacții: {v.adverse_reactions}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-700 mt-1 inline-flex items-center gap-1">
                      <span className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-500/15 text-emerald-700">✓</span>
                      Fără reacții adverse
                    </div>
                  )}
                  {v.next_due_date && (
                    <div className={`text-xs mt-1 ${overdue ? "text-red-700 font-bold" : "text-primary"}`}>
                      {overdue ? "Rapel scadent: " : "Următoarea doză: "}{formatRoDate(v.next_due_date)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { if (confirm("Ștergi această vaccinare?")) del.mutate(v.id); }}
                  className="text-xs text-muted-foreground hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Vaccin (din catalog)
              </label>
              <select
                value={form.vaccine_id}
                onChange={(e) => pickVaccine(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              >
                <option value="">— Selectează din catalog (sau introdu manual) —</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.disease}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Nume vaccin
              </label>
              <input
                value={form.vaccine_name}
                onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {[
              { k: "administered_date", label: "Data administrării", type: "date" },
              { k: "dose_number", label: "Nr. doză", type: "number" },
              { k: "lot_number", label: "Lot", type: "text" },
              { k: "manufacturer", label: "Producător", type: "text" },
              { k: "administered_by", label: "Administrat de", type: "text" },
              { k: "next_due_date", label: "Următoarea doză", type: "date" },
            ].map((f: any) => (
              <div key={f.k}>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={form[f.k] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Reacții adverse
              </label>
              <textarea
                value={form.adverse_reactions ?? ""}
                onChange={(e) => setForm({ ...form, adverse_reactions: e.target.value })}
                rows={2}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-full text-xs font-medium hover:bg-muted"
            >
              Anulează
            </button>
            <button
              disabled={add.isPending || !form.vaccine_name || !form.administered_date}
              onClick={() => add.mutate()}
              className="px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold hover:bg-primary disabled:opacity-50"
            >
              {add.isPending ? "Se salvează..." : "Înregistrează"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

