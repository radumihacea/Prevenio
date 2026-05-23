// Helpers pentru segmentarea pacienților + sugestii automate.

export type PatientLite = {
  id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  last_visit: string | null;
  conditions: string[] | null;
  vaccinated_flu: boolean | null;
  last_lab_date: string | null;
  last_bp_check: string | null;
};

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

export function monthsSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / MS_PER_MONTH);
}

export function hasCondition(p: PatientLite, key: string): boolean {
  return (p.conditions ?? []).some((c) => c.toLowerCase().includes(key));
}

// --- Segmente automate ---
export type Segment = {
  id: string;
  label: string;
  hint: string;
  tone: "warn" | "info" | "danger" | "ok";
  match: (p: PatientLite) => boolean;
};

export const SEGMENTS: Segment[] = [
  {
    id: "inactive_12m",
    label: "Inactivi 12+ luni",
    hint: "Fără vizită de peste 12 luni — necesită rechemare",
    tone: "danger",
    match: (p) => {
      const m = monthsSince(p.last_visit);
      return m === null || m >= 12;
    },
  },
  {
    id: "diabet_no_labs",
    label: "Diabetici fără analize",
    hint: "Analize lipsă sau mai vechi de 6 luni",
    tone: "warn",
    match: (p) => {
      if (!hasCondition(p, "diabet")) return false;
      const m = monthsSince(p.last_lab_date);
      return m === null || m >= 6;
    },
  },
  {
    id: "hta_no_control",
    label: "Hipertensivi fără control",
    hint: "Fără tensiune măsurată în 6+ luni",
    tone: "warn",
    match: (p) => {
      if (!hasCondition(p, "hipertensiun") && !hasCondition(p, "hta")) return false;
      const m = monthsSince(p.last_bp_check);
      return m === null || m >= 6;
    },
  },
  {
    id: "no_flu",
    label: "Nevaccinați antigripal",
    hint: "Recomandare sezonieră",
    tone: "info",
    match: (p) => !p.vaccinated_flu,
  },
];

// --- Counters pentru secțiunea „Stare populație" ---
export function populationStats(patients: PatientLite[]) {
  const monitored = patients.filter((p) => (p.conditions ?? []).length > 0).length;
  const inactive12 = patients.filter((p) => {
    const m = monthsSince(p.last_visit);
    return m === null || m >= 12;
  }).length;
  return {
    total: patients.length,
    monitored,
    inactive12,
  };
}

// --- Sugestii automate pentru fișa pacientului ---
export function buildSuggestions(p: PatientLite): string[] {
  const out: string[] = [];
  const visitMonths = monthsSince(p.last_visit);

  if (visitMonths === null) {
    out.push("Pacient fără vizite înregistrate — programează prima evaluare.");
  } else if (visitMonths >= 12) {
    out.push(
      `Ultima vizită acum ${visitMonths} luni — recomandăm consultație de bilanț.`,
    );
  } else if (visitMonths >= 6) {
    out.push(`Ultima vizită acum ${visitMonths} luni — control de rutină.`);
  }

  if (hasCondition(p, "hipertensiun")) {
    const bp = monthsSince(p.last_bp_check);
    if (bp === null || bp >= 6) {
      out.push("Pacient hipertensiv — recomandăm EKG și măsurare tensiune.");
    }
  }
  if (hasCondition(p, "diabet")) {
    const lab = monthsSince(p.last_lab_date);
    if (lab === null || lab >= 6) {
      out.push("Diabetic fără analize recente — solicită HbA1c și glicemie.");
    }
  }
  if (hasCondition(p, "astm")) {
    out.push("Astmatic — verifică schema inhalatorie și spirometrie anuală.");
  }
  if (!p.vaccinated_flu) {
    out.push("Nevaccinat antigripal — propune vaccinare în sezon.");
  }

  return out;
}

// --- Vaccinuri: utilitare ---
export type VaccinationRow = {
  id: string;
  patient_id: string;
  vaccine_id: string | null;
  vaccine_name: string;
  administered_date: string;
  dose_number: number;
  lot_number: string | null;
  manufacturer: string | null;
  administered_by: string | null;
  adverse_reactions: string | null;
  next_due_date: string | null;
  notes: string | null;
};

export type VaccineCatalogRow = {
  id: string;
  name: string;
  disease: string;
  manufacturer: string | null;
  doses_required: number;
  interval_months: number | null;
  seasonal: boolean;
  notes: string | null;
};

export function vaccineSuggestions(vaccinations: VaccinationRow[]): string[] {
  const out: string[] = [];
  const today = new Date();
  for (const v of vaccinations) {
    if (!v.next_due_date) continue;
    const due = new Date(v.next_due_date);
    if (isNaN(due.getTime())) continue;
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      out.push(`Rapel scadent: ${v.vaccine_name} (restanță ${Math.abs(diffDays)} zile).`);
    } else if (diffDays <= 30) {
      out.push(`Rapel apropiat: ${v.vaccine_name} în ${diffDays} zile.`);
    }
  }
  return out;
}

// --- Template SMS organizate pe scopuri ---
export type SmsTemplate = {
  id: string;
  category: "Preventie" | "Monitorizare" | "Logistica";
  title: string;
  body: string;
  // Funcție care selectează publicul țintă (opțional)
  audience?: (p: PatientLite) => boolean;
  audienceLabel?: string;
};

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: "flu",
    category: "Preventie",
    title: "Campanie vaccin antigripal",
    body: "Bună ziua, avem disponibil vaccinul antigripal. Vă invităm să vă programați.",
    audience: (p) => !p.vaccinated_flu,
    audienceLabel: "Pacienți nevaccinați antigripal",
  },
  {
    id: "checkup",
    category: "Preventie",
    title: "Consult anual de bilanț",
    body: "Bună ziua, nu ați mai venit la consult de peste un an. Vă invităm la o evaluare de rutină.",
    audience: (p) => {
      const m = monthsSince(p.last_visit);
      return m !== null && m >= 12;
    },
    audienceLabel: "Pacienți fără vizită de 12+ luni",
  },
  {
    id: "lab_diab",
    category: "Monitorizare",
    title: "Analize diabetici",
    body: "Bună ziua, vă rugăm să efectuați HbA1c și glicemia. Programați-vă pentru interpretare.",
    audience: (p) => {
      if (!hasCondition(p, "diabet")) return false;
      const m = monthsSince(p.last_lab_date);
      return m === null || m >= 6;
    },
    audienceLabel: "Diabetici cu analize lipsă",
  },
  {
    id: "hta_ctrl",
    category: "Monitorizare",
    title: "Control hipertensiune",
    body: "Bună ziua, vă invităm la un control al tensiunii și ajustarea tratamentului.",
    audience: (p) => {
      if (!hasCondition(p, "hipertensiun")) return false;
      const m = monthsSince(p.last_bp_check);
      return m === null || m >= 6;
    },
    audienceLabel: "Hipertensivi fără control recent",
  },
  {
    id: "reminder",
    category: "Logistica",
    title: "Reamintire programare",
    body: "Bună ziua, vă reamintim de programarea de mâine. Pentru reprogramare folosiți linkul:",
    audienceLabel: "Toți pacienții cu telefon",
  },
  {
    id: "reteta",
    category: "Logistica",
    title: "Rețetă disponibilă",
    body: "Bună ziua, rețeta dumneavoastră este pregătită. Treceți pe la cabinet pentru ridicare.",
    audienceLabel: "Toți pacienții cu telefon",
  },
];
