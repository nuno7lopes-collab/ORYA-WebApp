"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ViewStateKind = "loading" | "empty" | "error" | "success";

type ViewStateProps = {
  kind: ViewStateKind;
  title: string;
  description?: string | null;
  action?: ReactNode;
  className?: string;
};

const toneClass: Record<ViewStateKind, string> = {
  loading: "border-cyan-300/35 bg-cyan-500/8 text-cyan-50",
  empty: "border-white/15 bg-white/5 text-white/80",
  error: "border-red-300/45 bg-red-500/10 text-red-100",
  success: "border-emerald-300/45 bg-emerald-500/10 text-emerald-100",
};

function Icon({ kind }: { kind: ViewStateKind }) {
  if (kind === "loading") {
    return (
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    );
  }
  if (kind === "error") return <span aria-hidden="true">!</span>;
  if (kind === "success") return <span aria-hidden="true">✓</span>;
  return <span aria-hidden="true">•</span>;
}

export function ViewState({ kind, title, description, action, className }: ViewStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
        toneClass[kind],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/40 text-xs">
          <Icon kind={kind} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="text-sm opacity-85">{description}</p> : null}
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
