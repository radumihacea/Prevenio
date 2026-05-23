import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Autentificare medic — MedCab" },
      { name: "description", content: "Autentificare securizată cu cod parafă și cod 2FA." },
    ],
  }),
});

type Step = "credentials" | "enroll" | "challenge";

// Construim un email sintetic stabil pe baza CUI/CNP-ului (rămâne intern).
function parafaToEmail(parafa: string) {
  return `${parafa.trim().toLowerCase()}@medic.prevenio.local`;
}

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("credentials");
  const [transitioning, setTransitioning] = useState(false);

  // Step 1
  const [parafa, setParafa] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 (enroll / challenge)
  const [otp, setOtp] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus pe câmpul OTP după tranziție
  useEffect(() => {
    if ((step === "challenge" || step === "enroll") && !transitioning) {
      const t = setTimeout(() => otpInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [step, transitioning]);

  function softTransitionTo(next: Step) {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 200);
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parafa.trim() || !password) {
      setError("Completați codul parafă și parola.");
      return;
    }
    setLoading(true);
    try {
      const email = parafaToEmail(parafa);
      // Încercăm autentificarea; dacă utilizatorul nu există, îl creăm (portal închis, auto-confirm).
      let { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials")) {
          // Probabil cont inexistent → creăm
          const { error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) throw signUpError;
          const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
          if (retryError) throw retryError;
        } else {
          throw signInError;
        }
      }

      // AAL check → determinăm dacă trebuie enroll sau challenge
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verifiedTotp = factorsData.totp?.find((f) => f.status === "verified");

      if (!verifiedTotp) {
        // Înrolare (prima logare)
        const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `MedCab TOTP ${Date.now()}`,
        });
        if (enrollError) throw enrollError;
        setFactorId(enrollData.id);
        setQrSvg(enrollData.totp.qr_code);
        setTotpSecret(enrollData.totp.secret);
        setInfo("Scanați codul QR cu Google Authenticator, apoi introduceți codul de 6 cifre.");
        softTransitionTo("enroll");
      } else if (aalData.nextLevel === "aal2" && aalData.currentLevel === "aal1") {
        // Logare recurentă — creăm challenge
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
          factorId: verifiedTotp.id,
        });
        if (chErr) throw chErr;
        setFactorId(verifiedTotp.id);
        setChallengeId(ch.id);
        setInfo("Introduceți codul de 6 cifre din Google Authenticator.");
        softTransitionTo("challenge");
      } else {
        // Deja AAL2 (rar pe acest flux) → mergem direct la dashboard
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err?.message ?? "Autentificare eșuată. Verificați datele introduse.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("Codul trebuie să conțină exact 6 cifre.");
      return;
    }
    if (!factorId) {
      setError("Sesiune MFA expirată. Reintroduceți credențialele.");
      softTransitionTo("credentials");
      return;
    }
    setLoading(true);
    try {
      if (step === "enroll") {
        // challengeAndVerify într-un singur pas pentru înrolare
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: otp,
        });
        if (verifyError) throw verifyError;
      } else {
        if (!challengeId) throw new Error("Challenge inexistent.");
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code: otp,
        });
        if (verifyError) throw verifyError;
      }
      // Succes — token a fost ridicat la AAL2
      navigate({ to: "/" });
    } catch (err: any) {
      setError("Codul 2FA invalid");
      setOtp("");
      otpInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  function backToCredentials() {
    setOtp("");
    setError(null);
    setInfo(null);
    setQrSvg(null);
    setTotpSecret(null);
    setFactorId(null);
    setChallengeId(null);
    softTransitionTo("credentials");
  }

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-6">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8"
      >
        <header className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Portal Medic · ROeID
          </p>
          <h1
            id="login-title"
            className="mt-2 text-2xl font-display font-bold text-foreground"
          >
            {step === "credentials" ? "Autentificare medic" : "Verificare în doi pași"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "credentials"
              ? "Introduceți codul parafă și parola pentru a continua."
              : step === "enroll"
                ? "Activați 2FA scanând codul QR cu Google Authenticator."
                : "Introduceți codul de 6 cifre generat de Google Authenticator."}
          </p>
        </header>

        {/* Indicator pași */}
        <ol
          aria-label="Etapele autentificării"
          className="flex items-center gap-2 mb-6 text-[10px] uppercase tracking-wider"
        >
          <li
            aria-current={step === "credentials" ? "step" : undefined}
            className={`flex-1 h-1 rounded-full ${
              step === "credentials" ? "bg-primary" : "bg-primary/30"
            }`}
          />
          <li
            aria-current={step !== "credentials" ? "step" : undefined}
            className={`flex-1 h-1 rounded-full ${
              step !== "credentials" ? "bg-primary" : "bg-muted"
            }`}
          />
        </ol>

        <div
          className={`transition-all duration-200 ${
            transitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
          }`}
        >
          {step === "credentials" && (
            <form onSubmit={handleCredentials} noValidate className="space-y-4">
              <div>
                <label htmlFor="parafa" className="block text-xs font-medium text-foreground mb-1.5">
                  Cod parafă
                </label>
                <input
                  id="parafa"
                  name="parafa"
                  type="text"
                  autoComplete="username"
                  required
                  aria-required="true"
                  aria-invalid={!!error}
                  value={parafa}
                  onChange={(e) => setParafa(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="ex. MD123456"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-foreground mb-1.5"
                >
                  Parolă
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  aria-invalid={!!error}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Minim 6 caractere"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-xs text-destructive-foreground bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
                {loading && (
                  <span
                    aria-hidden="true"
                    className="inline-block h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"
                  />
                )}
                {loading ? "Se verifică..." : "Continuă"}
              </button>

              <p className="text-[11px] text-muted-foreground text-center">
                Veți primi un cod 2FA în Google Authenticator după validarea credențialelor.
              </p>
            </form>
          )}

          {(step === "enroll" || step === "challenge") && (
            <form onSubmit={handleVerify} noValidate className="space-y-4">
              {step === "enroll" && qrSvg && (
                <div className="rounded-xl border border-border bg-muted/40 p-4 flex flex-col items-center gap-3">
                  <div
                    aria-label="Cod QR pentru Google Authenticator"
                    role="img"
                    className="bg-white p-2 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  {totpSecret && (
                    <details className="text-[11px] text-muted-foreground w-full">
                      <summary className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                        Nu pot scana — afișează codul manual
                      </summary>
                      <code className="mt-2 block break-all bg-background border border-border rounded px-2 py-1 text-foreground">
                        {totpSecret}
                      </code>
                    </details>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="otp" className="block text-xs font-medium text-foreground mb-1.5">
                  Cod 2FA (6 cifre)
                </label>
                <input
                  id="otp"
                  ref={otpInputRef}
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby="otp-help"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-center text-lg tracking-[0.6em] font-mono text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="••••••"
                />
                {info && (
                  <p id="otp-help" className="mt-1.5 text-[11px] text-muted-foreground">
                    {info}
                  </p>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
                >
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="rounded-full border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Înapoi
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
                >
                  {loading && (
                    <span
                      aria-hidden="true"
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin"
                    />
                  )}
                  {loading
                    ? "Se verifică..."
                    : step === "enroll"
                      ? "Activează 2FA"
                      : "Confirmă"}
                </button>
              </div>
            </form>
          )}
        </div>

        {step === "credentials" && (
          <div className="mt-6 pt-5 border-t border-border text-center">
            <Link
              to="/signup"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Nu ești înregistrat în aplicație? Creează-ți un cont.
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
