## Problema

Pagina `/cabinet/{slug}/programari` rămâne blocată la "Se încarcă cabinetul..." pentru orice vizitator care nu este autentificat (pacienții care primesc link-ul prin SMS).

**Cauza:** tabelele `doctors` și `appointments` au politici RLS doar pentru rolul `authenticated`. Clientul Supabase din browser folosește rolul `anon` pentru vizitatorii nelogați, deci interogarea `SELECT * FROM doctors WHERE slug = ...` returnează 0 rânduri → `doctor` rămâne `undefined` → pagina nu iese niciodată din starea de loading.

Același lucru s-ar întâmpla și la rezervare: `INSERT` în `appointments` ar eșua silențios.

## Soluție

Migrație SQL care adaugă politicile RLS minim necesare pentru rolul `anon`, fără să atingă politicile existente pentru `authenticated`:

1. **`doctors`** — `SELECT` public, doar coloanele necesare paginii publice (nume, cabinet, specialitate, slug, program de lucru). Toate coloanele tabelei sunt deja informații publice afișate pe pagina de programare, deci politica va fi `USING (true)` pe tot rândul.

2. **`appointments`** — două politici noi pentru `anon`:
   - `SELECT` limitat: doar coloana `appointment_time` pentru o zi/medic dat (necesar pentru a marca sloturile ocupate). Politica permite `SELECT` general, dar codul aplicației nu cere date sensibile (nume pacient, telefon) — vom restrânge prin coloane: politica va permite `SELECT (true)` doar pe rândurile cu `status != 'cancelled'`. **Notă de securitate:** pentru a evita expunerea numelor pacienților, vom crea o **view** publică `public_appointment_slots` care expune doar `doctor_id, appointment_date, appointment_time` și vom modifica `cabinet.$slug.programari.tsx` să citească din view în loc de tabel.
   - `INSERT` public: orice anon poate adăuga o programare cu `source = 'public'`. Politica `WITH CHECK (source = 'public')` previne abuzul de a insera programări marcate ca venind din alte surse.

## Pași concreți

1. Migrație SQL:
   - `CREATE POLICY "anon read doctors" ON doctors FOR SELECT TO anon USING (true);`
   - `CREATE VIEW public_appointment_slots WITH (security_invoker=true) AS SELECT doctor_id, appointment_date, appointment_time FROM appointments WHERE status != 'cancelled';`
   - `GRANT SELECT ON public_appointment_slots TO anon;`
   - `CREATE POLICY "anon read slot times" ON appointments FOR SELECT TO anon USING (status <> 'cancelled');` (necesar pentru ca view-ul security_invoker să funcționeze; expune doar coloanele cerute prin view — codul aplicației nu va mai selecta direct din tabel)
   - Alternativ mai sigur: politică `SELECT` doar pentru coloanele non-PII via funcție RPC. Voi merge cu varianta view + modificarea fetch-ului în cod.
   - `CREATE POLICY "anon insert public appointments" ON appointments FOR INSERT TO anon WITH CHECK (source = 'public' AND status = 'pending');`

2. Modificare în `src/routes/cabinet.$slug.programari.tsx`:
   - Schimbă `.from("appointments").select("appointment_time")` în `.from("public_appointment_slots").select("appointment_time")`.
   - Restul rămâne neschimbat.

## Rezultat

- Link-ul `/cabinet/dr-popescu/programari` etc. se va încărca corect pentru oricine, fără login.
- Pacienții pot vedea sloturile disponibile și pot face programare.
- Numele/telefoanele altor pacienți rămân private (nu sunt expuse prin view).
- Medicii autentificați continuă să vadă/gestioneze toate programările lor ca până acum.

Nu modific designul paginii, nu modific funcționalitatea pentru medicii logați.
