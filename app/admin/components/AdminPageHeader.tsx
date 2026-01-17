import { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ title, subtitle, eyebrow = "Admin", actions }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white/95 md:text-3xl">{title}</h1>
        {subtitle && <p className="max-w-2xl text-sm text-white/60">{subtitle}</p>}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
