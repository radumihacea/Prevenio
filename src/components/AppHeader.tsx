import { Link, useRouterState } from "@tanstack/react-router";
import { CABINET_NAME, DOCTOR_NAME } from "@/lib/clinic";

const nav = [
  { to: "/", label: "Astăzi" },
  { to: "/pacienti", label: "Pacienți" },
  { to: "/calendar", label: "Calendar" },
  { to: "/vaccinuri", label: "Vaccinuri" },
  { to: "/comunicare", label: "Comunicare" },
] as const;

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="max-w-7xl mx-auto flex flex-wrap items-end justify-between gap-6 mb-12">
      <Link to="/" className="space-y-1 group">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          {CABINET_NAME}
        </span>
        <h1 className="text-3xl font-display font-bold tracking-tight group-hover:text-primary transition-colors">
          {DOCTOR_NAME}
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
      </nav>
    </header>
  );
}
