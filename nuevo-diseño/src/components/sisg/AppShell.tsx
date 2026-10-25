import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Tent, BarChart3, ClipboardList, FlaskConical, Send, HeartPulse, LayoutDashboard, LogOut, Megaphone, Menu, Search, UserCog, Users, X } from "lucide-react";
import { api, esAdmin, esCentro, puedeEscribir, ROLES, setSession, useSession, veAuditoria } from "@/lib/api";
import { CuentaDialog } from "./CuentaDialog";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "./ui";
import { cn } from "@/lib/utils";
import ilustracion from "@/assets/ilustracion-cuidado.png";

export function Logo({ inverted }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", inverted ? "bg-primary-foreground/15 text-primary-foreground" : "bg-gradient-primary text-primary-foreground shadow-glow")}>
        <HeartPulse className="h-5 w-5" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className={cn("font-display text-lg font-extrabold", inverted && "text-primary-foreground")}>SISG</p>
        <p className={cn("text-[11px] font-medium", inverted ? "text-primary-foreground/80" : "text-muted-foreground")}>Salud de Guatemala</p>
      </div>
    </div>
  );
}

function SidebarLogo() {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <img src={ilustracion} alt="" width={72} height={72} className="h-[72px] w-[72px] object-contain" aria-hidden />
      <div className="leading-tight">
        <p className="font-display text-lg font-extrabold">SISG</p>
        <p className="text-[11px] font-medium text-muted-foreground">Salud de Guatemala</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [cuenta, setCuenta] = useState(false);
  const qc = useQueryClient();

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && !session) navigate({ to: "/" });
  }, [hydrated, session, navigate]);

  if (!hydrated || !session) {
    return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
  }

  const centro = esCentro(session.entidad);
  const items = [
    { to: "/inicio", label: "Inicio", icon: LayoutDashboard },
    { to: "/pacientes", label: "Pacientes", icon: Users },
    centro
      ? { to: "/estudios", label: "Estudios", icon: FlaskConical }
      : { to: "/campanas", label: "Campañas", icon: Megaphone },
    { to: "/referidos", label: "Referidos", icon: Send },
    ...(!centro && puedeEscribir(session) ? [{ to: "/jornada", label: "Jornada", icon: Tent }] : []),
    ...(veAuditoria(session) ? [{ to: "/impacto", label: centro ? "Indicadores" : "Impacto", icon: BarChart3 }] : []),
    ...(veAuditoria(session) ? [{ to: "/actividad", label: "Auditoría", icon: ClipboardList }] : []),
    ...(esAdmin(session) ? [{ to: "/usuarios", label: "Usuarios", icon: UserCog }] : []),
  ] as { to: string; label: string; icon: typeof Users }[];

  const nav = (
    <nav className="flex h-full flex-col gap-6 p-5" aria-label="Principal">
      <SidebarLogo />
      <div className="rounded-2xl bg-secondary p-3">
        <p className="truncate text-sm font-bold">{session.entidad.nombre}</p>
        <span className="mt-1 inline-block rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
          {centro ? "Centro de diagnóstico" : "Organismo no lucrativo"}
        </span>
        <p className="mt-2 truncate text-xs text-muted-foreground">{session.usuario.nombre === ROLES[session.usuario.rol].label ? session.usuario.nombre : `${session.usuario.nombre} · ${ROLES[session.usuario.rol].label}`}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to}
              onClick={() => setOpen(false)}
              className="group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "!bg-accent !text-accent-foreground font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-primary" }}
            >
              <it.icon className="h-5 w-5" aria-hidden />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
      <button
        onClick={async () => { await api.logout(); setSession(null); qc.clear(); }}
        className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-5 w-5" aria-hidden /> Cerrar sesión
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar/90 backdrop-blur print:hidden lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-foreground/40" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-in slide-in-from-left bg-sidebar shadow-xl duration-200">
            <button className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-accent" onClick={() => setOpen(false)} aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur print:hidden md:px-8">
          <button className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-accent lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 lg:hidden" aria-label="SISG">
            <img src={ilustracion} alt="" width={36} height={36} className="h-9 w-9 object-contain" aria-hidden />
            <span className="font-display text-base font-extrabold">SISG</span>
          </div>
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              aria-label="Búsqueda rápida"
              placeholder="Buscar pacientes, estudios…"
              className="h-11 w-full rounded-xl border bg-card pl-9 pr-14 text-sm shadow-sm placeholder:text-muted-foreground"
            />
            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground sm:block">⌘K</kbd>
          </div>
          <button onClick={() => setCuenta(true)} aria-label="Mi cuenta" title="Mi cuenta"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary font-display text-sm font-bold text-primary-foreground transition-transform hover:scale-105">
            {session.usuario.nombre.slice(0, 1).toUpperCase()}
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
        <CuentaDialog open={cuenta} onOpenChange={setCuenta} session={session} />
      </div>
    </div>
  );
}
