import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ilustracion from "@/assets/ilustracion-cuidado.png";

export type Tono = "teal" | "blue" | "coral" | "amber";

const chipTone: Record<Tono, string> = {
  teal: "bg-teal-soft text-teal",
  blue: "bg-blue-soft text-blue",
  coral: "bg-coral-soft text-coral",
  amber: "bg-amber-soft text-amber",
};
const strokeTone: Record<Tono, string> = {
  teal: "var(--teal)", blue: "var(--blue)", coral: "var(--coral)", amber: "var(--amber)",
};
export const toneColor = (t: Tono) => strokeTone[t];

export function IconChip({ icon: Icon, tone = "teal", size = "md" }: { icon: LucideIcon; tone?: Tono; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  const i = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", s, chipTone[tone])}>
      <Icon className={i} strokeWidth={2} aria-hidden />
    </span>
  );
}

export function Card({ className, children, hover }: { className?: string; children: ReactNode; hover?: boolean }) {
  return <div className={cn("surface p-5", hover && "lift", className)}>{children}</div>;
}

export function Tag({ tone = "teal", children }: { tone?: Tono; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", chipTone[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(target); return; }
    let raf = 0; const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Sparkline({ data, tone }: { data: number[]; tone: Tono }) {
  const w = 96, h = 32;
  const max = Math.max(1, ...data);
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (d / max) * (h - 4) - 2}`).join(" ");
  const id = `sp-${tone}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={strokeTone[tone]} stopOpacity="0.3" />
          <stop offset="1" stopColor={strokeTone[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={strokeTone[tone]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} aria-hidden />;
}

export function EmptyState({ title, text, action, error }: { title: string; text: string; action?: ReactNode; error?: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role={error ? "alert" : undefined}>
      <img src={ilustracion} alt="" width={1024} height={1024} loading="lazy" className={cn("mb-4 h-28 w-28 object-contain", error && "opacity-70 grayscale-[40%]")} />
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const inputCls = "h-11 w-full rounded-xl border bg-card px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:border-primary";

export function Field({ id, label, children, required }: { id: string; label: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}{required && <span className="text-destructive" aria-hidden> *</span>}</label>
      {children}
    </div>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn("inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const avatarTones = ["bg-teal-soft text-teal", "bg-blue-soft text-blue", "bg-coral-soft text-coral", "bg-amber-soft text-foreground"];
export function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold", avatarTones[h % avatarTones.length])} aria-hidden>{ini}</span>;
}

export function ListSkeleton() {
  return <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
}
