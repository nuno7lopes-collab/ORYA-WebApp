"use client";

import Link from "next/link";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";

type ObjectiveOverviewProps = {
  objectiveLabel: string;
  title: string;
  description: string;
  categoryLabel: string;
  cta: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

export default function ObjectiveOverview({
  objectiveLabel,
  title,
  description,
  categoryLabel,
  cta,
  secondaryAction,
}: ObjectiveOverviewProps) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050912]/95 p-5 md:p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_32%),linear-gradient(240deg,rgba(255,255,255,0.06),transparent_36%)]" />
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            Objetivo · {objectiveLabel}
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white drop-shadow-[0_6px_30px_rgba(0,0,0,0.55)]">
            {title}
          </h1>
          <p className="text-sm text-white/70">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80">
            {categoryLabel}
          </span>
          <Link
            href={cta.href}
            className={`${CTA_PRIMARY} px-4 py-2 text-sm`}
          >
            {cta.label}
          </Link>
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
