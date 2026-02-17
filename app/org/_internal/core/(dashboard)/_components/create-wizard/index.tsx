import type { ReactNode } from "react";

export function CreateWizardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05070f] py-8 text-white">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4">{children}</div>
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
    <header className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-white/70">{subtitle}</p> : null}
    </header>
  );
}

export function CreateWizardSectionCard({
  title,
  subtitle,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.28)]"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{title}</p>
        {subtitle ? <p className="text-sm text-white/72">{subtitle}</p> : null}
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

  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones}`}>{children}</div>;
}

export function CreateWizardChecklist({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; label: string; done: boolean; blockedLabel?: string }>;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/12 bg-black/25 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
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
    <div className="sticky bottom-4 z-20 rounded-2xl border border-white/12 bg-black/45 p-4 shadow-[0_16px_38px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {children}
    </div>
  );
}
