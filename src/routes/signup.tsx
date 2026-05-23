import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Înregistrare medic — MedCab" },
      { name: "description", content: "Creează un cont nou de medic în portalul MedCab." },
    ],
  }),
});

function parafaToEmail(parafa: string) {
  return `${parafa.trim().toLowerCase()}@medic.prevenio.local`;
}

function SignupPage() {
  const navigate = useNavigate();
  const [parafa, setParafa] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parafa.trim() || !password) {
      setError("Completați codul parafă și parola.");
      return;
    }
    if (password.length < 6) {
      setError("Parola trebuie să aibă minim 6 caractere.");
      return;
    }
    if (password !== confirm) {
      setError("Parolele nu coincid.");
      return;
    }
    setLoading(true);
    try {
      const email = parafaToEmail(parafa);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (signUpError) throw signUpError;
      // Mergem direct la login pentru a porni fluxul 2FA (enroll TOTP)
      navigate({ to: "/login" });
    } catch (err: any) {
      setError(err?.message ?? "Înregistrare eșuată. Încercați din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-6">
      <section
        aria-labelledby="signup-title"
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8"
      >
        <header className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Portal Medic · ROeID
          </p>
          <h1
            id="signup-title"
            className="mt-2 text-2xl font-display font-bold text-foreground"
          >
            Creează cont medic
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Introduceți codul parafă și alegeți o parolă pentru noul cont.
          </p>
        </header>

        <form onSubmit={handleSignup} noValidate className="space-y-4">
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
            <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1.5">
              Parolă
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-required="true"
              aria-invalid={!!error}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Minim 6 caractere"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-xs font-medium text-foreground mb-1.5">
              Confirmă parola
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              aria-required="true"
              aria-invalid={!!error}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Reintroduceți parola"
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
            {loading ? "Se creează..." : "Creează cont"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border text-center">
          <Link
            to="/login"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Ești deja înregistrat? Accesează pagina de login.
          </Link>
        </div>
      </section>
    </main>
  );
}
