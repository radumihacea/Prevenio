# Prevenio — Cabinetul medicului de familie, digital

## 1. Cum se numește?

**Prevenio** — Un nume scurt, ușor de
ținut minte, care comunică direct ce face produsul: digitalizează cabinetul
medicului de familie.

## 2. Ce face, pe scurt?

Prevenio este o platformă web pentru medicii de familie din România care
înlocuiește registrele de hârtie, agendele și telefoanele neîncetate.
Medicul își gestionează pacienții, programările, vaccinările și
comunicarea prin SMS dintr-un singur loc, iar pacienții își fac singuri
programări printr-un link public personalizat (`/cabinet/{slug}/programari`).
Este utilă pentru că reduce timpul administrativ al medicului și
elimină drumurile inutile ale pacientului la cabinet doar pentru a-și
prinde o oră.

## 3. Ce problemă rezolvă?

Relația dintre pacient și medicul de familie din sistemul public este
plină de frecușuri birocratice mărunte care, adunate, consumă enorm de
mult timp pentru ambele părți:

- **Pacientul nu mai trebuie să sune** la cabinet în orele de program ca
  să prindă o oră — primește un link prin SMS și își alege singur slotul
  liber.
- **Medicul nu mai ține registre pe hârtie** pentru pacienți, vaccinări
  sau control. Tot istoricul este într-un singur loc, căutabil.
- **Sugestii automate** pentru rapeluri de vaccin, control tensiune sau
  analize — medicul nu mai trebuie să țină minte cine ce datorează.
- **Mai puține drumuri** pentru pacient la cabinet doar ca să întrebe „ce
  am de făcut?" — primește notificările prin SMS.
- **Programul zilei la deschidere** — medicul vede dintr-o privire pe
  cine are de consultat astăzi, fără să mai răsfoiască agenda.

Pe scurt: mai puțin timp pierdut cu sunat, programat, scris în registru
și sunat înapoi pentru rapeluri.

## 4. Ce date folosiți?

Aplicația folosește **date simulate** care imită structura reală a unui
cabinet de medicină de familie din România. Schema în baza de date
(Lovable Cloud / Postgres) este:

- **`doctors`** — medicul: `id`, `slug` (folosit în URL public),
  `full_name`, `specialty`, `cabinet_name`, `parafa_code` (codul de
  parafă, identificatorul oficial al medicului în România),
  `auth_email`, `working_days`, `work_start_time`, `work_end_time`.
- **`patients`** — pacienții cabinetului: `full_name`, `birth_date`,
  `cnp`, `phone`, `address`, `conditions` (afecțiuni cronice),
  `vaccinated_flu`, `last_visit`, `last_lab_date`, `last_bp_check`.
- **`appointments`** — programări: `doctor_id`, `patient_name`,
  `patient_phone`, `appointment_date`, `appointment_time`, `reason`,
  `status`, `source` (`doctor` sau `public`, ca să distingem programările
  făcute de pacient prin link).
- **`vaccinations`** + **`vaccine_catalog`** — istoricul vaccinărilor și
  catalogul de vaccinuri din schema oficială (DTP, HepB, ROR, antigripal
  etc.) cu intervale recomandate.
- **`sms_log`** — jurnalul de SMS-uri trimise prin Twilio (cu cine, când,
  ce mesaj, ce template).
- **`tokenuri_sms`** — token-uri unice pentru link-urile trimise prin SMS
  (expiră în 48h, single-use).

Sursele de date publice de referință pe care s-a inspirat structura:
- Schema Națională de Vaccinare (Ministerul Sănătății / INSP) —
  pentru catalogul de vaccinuri și intervalele recomandate.
- Formatul CNP românesc — pentru calculul automat al vârstei și
  validare.
- Formatul codului de parafă — pentru autentificarea medicilor.

Datele de demo (pacienți, programări) sunt **simulate**, nu provin din
sisteme reale.

---

## Tech stack

### Frontend
- **React 19** — UI library.
- **TanStack Start (v1) + TanStack Router** — full-stack React framework
  cu file-based routing, server functions și SSR pe edge runtime.
  Ales pentru type-safe routing și server functions co-locate cu codul
  client.
- **TanStack Query** — fetch, cache, invalidare și sincronizare a
  datelor din backend. Înlocuiește boilerplate-ul de `useState +
  useEffect + fetch`.
- **Tailwind CSS v4** — utility-first styling, cu design tokens
  semantice definite în `src/styles.css` (oklch).
- **shadcn/ui + Radix UI** — componente UI accesibile, headless, peste
  care am construit design system-ul.
- **Lucide React** — set de iconuri.
- **Sonner** — notificări toast.
- **date-fns** — manipulare dată/oră.
- **Zod** — validare schema pentru input-urile server functions.

### Backend (Lovable Cloud / Supabase)
- **Postgres** cu **Row-Level Security (RLS)** — fiecare query e
  filtrată automat la nivel de bază de date după rolul `authenticated`
  vs `anon`. Pacienții (anon) văd doar sloturile libere; medicii
  (authenticated) văd toate datele.
- **Supabase Auth** — autentificare prin email + parolă (cod de parafă
  ca username intern, sintetizat în `parafa@medcab.local`).
- **TanStack Server Functions (`createServerFn`)** — pentru logica
  server-side (trimitere SMS Twilio, business rules) rulând pe
  Cloudflare Workers.
- **Twilio** — provider SMS pentru trimiterea link-urilor de
  programare și a notificărilor către pacienți.

### Infrastructură
- **Vite 7** — build tool.
- **Cloudflare Workers** (deploy țintă) — runtime serverless edge.
- **Bun** — package manager.

---

## Funcții importante (comentate)

### Simulare 2FA / Autentificare prin cod de parafă

În România, fiecare medic are un cod de parafă unic. Pentru a simplifica
onboarding-ul, MedCab folosește codul de parafă ca un al doilea factor
de identificare: medicul introduce parafa lui și o parolă. Intern,
sistemul construiește un email sintetic `{parafa}@medcab.local` pe care
îl folosește cu Supabase Auth. La login, dacă un medic introduce
adresa lui reală de email, fallback-ul în `useCurrentDoctor` caută
medicul după codul de parafă extras din partea locală a email-ului.

Astfel, doar cineva care cunoaște *atât* codul de parafă (informație
profesională verificabilă), *cât și* parola contului poate accesa
cabinetul — un 2FA simulat fără cost suplimentar.

Vezi: `src/routes/login.tsx`, `src/routes/signup.tsx`,
`src/hooks/useCurrentDoctor.ts`.

### Partea de date — link public per medic

Fiecare medic are un `slug` unic în tabelul `doctors`. Ruta
`/cabinet/{slug}/programari` (`src/routes/cabinet.$slug.programari.tsx`)
e accesibilă fără autentificare. Pacientul:

1. Vede numele și specialitatea medicului.
2. Alege o zi din zilele lucrătoare ale medicului (`working_days`).
3. Vede sloturile libere — orele deja ocupate sunt scoase printr-o
   **view publică** `public_appointment_slots` care expune *doar*
   `doctor_id`, `appointment_date`, `appointment_time` (fără PII).
4. Își introduce numele, telefonul, motivul și confirmă.

Lista de sloturi se generează în `src/lib/clinic.ts` (`generateSlots`)
pe baza programului de lucru al medicului.

### Logica de securitate

- **Row-Level Security per tabel**:
  - `doctors` — citire publică (datele profesionale sunt publice oricum).
  - `appointments` — `anon` poate `SELECT` doar prin view-ul
    `public_appointment_slots` (fără nume/telefon ale altor pacienți)
    și poate `INSERT` doar cu `source = 'public'`. `authenticated`
    (medicii) văd tot.
  - `patients`, `vaccinations`, `sms_log`, `tokenuri_sms` — accesibile
    doar `authenticated`. Datele pacienților nu părăsesc niciodată
    contextul autentificat.

- **Token-uri SMS single-use** (`tokenuri_sms`): fiecare link trimis
  prin SMS conține un UUID care expiră în 48h și se invalidează la
  prima folosire. Previne ca cineva care interceptează SMS-ul vechi
  să își însușească identitatea pacientului.

- **Validare input cu Zod** în server functions — toate datele care
  intră în backend sunt validate ca tip, lungime și format înainte de
  a ajunge în baza de date.

- **Secrete în Cloudflare Secrets, nu în cod** — `TWILIO_*`,
  `SUPABASE_SERVICE_ROLE_KEY` etc. sunt injectate ca env vars la
  runtime; clientul browser folosește doar cheia `publishable` (anon),
  care e legată de RLS.

- **`security_invoker = true` pe view** — view-ul public rulează cu
  privilegiile celui care îl interoghează, nu cu cele ale
  proprietarului, astfel încât RLS rămâne aplicat și prin view.
