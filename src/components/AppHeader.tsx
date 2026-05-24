import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useCurrentDoctor } from "@/hooks/useCurrentDoctor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nav = [
  { to: "/programul-zilei", label: "Programul zilei" },
  { to: "/pacienti", label: "Pacienți" },
  { to: "/calendar", label: "Calendar" },
  { to: "/vaccinuri", label: "Vaccinuri" },
  { to: "/comunicare", label: "Comunicare" },
] as const;

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: doctor } = useCurrentDoctor();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Deconectat");
    navigate({ to: "/login" });
  }

  return (
    <header className="max-w-7xl mx-auto flex flex-wrap items-end justify-between gap-6 mb-12">
      <Link to="/programul-zilei" className="space-y-1 group">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          {doctor?.cabinet_name ?? "Cabinet Medical"}
        </span>
        <h1 className="text-3xl font-display font-bold tracking-tight group-hover:text-primary transition-colors">
          {doctor?.full_name ?? "—"}
        </h1>
      </Link>

      <nav className="flex flex-wrap gap-1.5 items-center">
        {nav.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "px-4 py-2 rounded-full text-sm font-medium transition-colors " +
                (active
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-card border border-border hover:bg-muted")
              }
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-sm font-medium bg-card border border-border hover:bg-muted text-muted-foreground"
        >
          Ieșire
        </button>
      </nav>
    </header>
  );
}
