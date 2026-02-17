import type { ReactNode } from "react";

export function CreateWizardShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070f] py-6 text-white sm:py-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(92,199,255,0.2),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_2%,rgba(87,240,205,0.16),transparent_38%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06111f]/30 via-[#05070f]/65 to-[#05070f]" />
      </div>
      <div className="relative mx-auto w-full max-w-6xl px-4">
        <div className="space-y-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,30,0.88),rgba(6,10,19,0.94))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function CreateWizardHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="rounded-3xl border border-white/12 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_64px_rgba(0,0,0,0.38)] backdrop-blur-md">
      <p className="text-[10px] uppercase tracking-[0.3em] text-white/55">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-3xl text-sm text-white/72">{subtitle}</p> : null}
    </header>
  );
}

export function CreateWizardSectionCard({
  title,
  subtitle,
  children,
  id,
  statusLabel,
  statusTone = "neutral",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  id?: string;
  statusLabel?: string;
  statusTone?: "ok" | "warn" | "neutral";
}) {
  const statusClass =
    statusTone === "ok"
      ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-50"
      : statusTone === "warn"
        ? "border-amber-300/60 bg-amber-500/20 text-amber-100"
        : "border-white/20 bg-white/[0.06] text-white/70";
  return (
    <section
      id={id}
      className="space-y-4 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_16px_44px_rgba(0,0,0,0.32)]"
    >
      <div className="space-y-1 border-b border-white/8 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">{title}</p>
          {statusLabel ? (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClass}`}>
              {statusLabel}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-sm text-white/74">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function CreateWizardAlert({
  variant,
  children,
}: {
  variant: "warning" | "error" | "success";
  children: ReactNode;
}) {
  const tones =
    variant === "error"
      ? "border-rose-300/45 bg-rose-500/10 text-rose-100"
      : variant === "success"
        ? "border-emerald-300/45 bg-emerald-500/10 text-emerald-50"
        : "border-amber-300/45 bg-amber-500/10 text-amber-100";

  return <div className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_12px_34px_rgba(0,0,0,0.25)] ${tones}`}>{children}</div>;
}

export function CreateWizardChecklist({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; label: string; done: boolean; blockedLabel?: string }>;
}) {
  const completed = items.filter((item) => item.done).length;
  return (
    <div className="space-y-3 rounded-3xl border border-white/12 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">{title}</p>
        <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {completed}/{items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
          >
            <span className="text-sm text-white/82">{item.label}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                item.done
                  ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-50"
                  : "border-amber-300/60 bg-amber-500/20 text-amber-100"
              }`}
            >
              {item.done ? "OK" : item.blockedLabel || "Pendente"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreateWizardActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-3 z-20 rounded-3xl border border-white/14 bg-[linear-gradient(120deg,rgba(8,13,24,0.92),rgba(5,8,15,0.9))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {children}
    </div>
  );
}
