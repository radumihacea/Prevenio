# Plan: SMS prin Twilio (renunțăm la gateway-ul Android)

## Context
- Twilio e conectat ca App connector → `TWILIO_API_KEY` și `LOVABLE_API_KEY` sunt disponibile în runtime-ul server.
- Număr expeditor: `+19129553773`.
- Renunțăm complet la vechea logică (Android gateway pe `172.20.10.4:8082`, status `queued`, endpoint `/api/public/hooks/auto-comms` — deja șters).

## Modificări

### 1. Helper nou: `src/lib/twilio.server.ts`
Funcție `sendTwilioSms(to, body)` care:
- Citește `LOVABLE_API_KEY`, `TWILIO_API_KEY`, `TWILIO_FROM_NUMBER` din `process.env` (aruncă erori clare dacă lipsesc).
- POST `application/x-www-form-urlencoded` la `https://connector-gateway.lovable.dev/twilio/Messages.json` cu headerele cerute de gateway (`Authorization: Bearer ${LOVABLE_API_KEY}`, `X-Connection-Api-Key: ${TWILIO_API_KEY}`).
- Returnează `{ ok, sid?, error? }`. Nu aruncă pe eroare HTTP — caller-ul decide cum logăm în `sms_log`.

Numărul `+19129553773` va fi păstrat ca secret runtime `TWILIO_FROM_NUMBER` (cer add_secret în pasul de build), nu hardcodat.

### 2. `src/lib/appointments.functions.ts` (refactor `cancelAppointment`)
- Șterg helper-ul local `sendSms` și constanta `GATEWAY_TIMEOUT_MS`.
- Import `sendTwilioSms` din `./twilio.server`.
- Logica de mesaj rămâne aceeași; trimit prin Twilio.
- Insert în `sms_log` cu `status: "sent"` sau `"failed"` (+ eventual `sid` pus în `tag`).

### 3. Server function nou: `sendTemplateSms` în `src/lib/communications.functions.ts`
- `requireSupabaseAuth`, input `{ templateId }`.
- Re-implementează logica din butonul „Trimite mesajul":
  - Ia doctorul curent + pacienții lui din DB.
  - Filtrează după template (segmentele rămân în `src/lib/segments.ts`, importat în versiunea server — fără cod care folosește `window`).
  - Pentru fiecare destinatar: `sendTwilioSms`, apoi insert în `sms_log` (status real `sent`/`failed`).
  - Returnează `{ sent, failed }`.
- Linkul către portal nu mai poate folosi `window.location.origin` — îl construim din header-ul `host` al request-ului sau dintr-un `PUBLIC_APP_URL` (folosesc `getRequestHeader('host')` cu fallback).

### 4. `src/routes/comunicare.tsx`
- Înlocuiesc mutația care făcea `supabase.from("sms_log").insert(rows)` cu apel `useServerFn(sendTemplateSms)`.
- Restul UI rămâne neschimbat. Toast-ul arată `sent`/`failed`.

### 5. Secret nou
Cer prin `add_secret` o singură variabilă: `TWILIO_FROM_NUMBER` = `+19129553773`.

## Ce NU schimbăm
- Schema DB (`sms_log` rămâne identic).
- RLS, auth, UI, segmentele, șabloanele.
- Funcțiile pentru programări (doar internalul de trimitere se schimbă).

## Fișiere atinse
- `src/lib/twilio.server.ts` (nou)
- `src/lib/communications.functions.ts` (nou)
- `src/lib/appointments.functions.ts` (refactor)
- `src/routes/comunicare.tsx` (mutația folosește server fn nouă)
- `.lovable/plan.md` (curățat — referințele vechi la auto-comms / Android gateway dispar)

## Validare
- Anulare programare din calendar → SMS real către pacient, rând `sent` în `sms_log`.
- „Trimite mesajul" din Comunicare → SMS-uri reale către segmentul afișat, contoarele din istoric se actualizează.
