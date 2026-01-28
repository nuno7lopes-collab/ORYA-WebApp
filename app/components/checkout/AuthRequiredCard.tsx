"use client";

import type { ReactNode } from "react";

type AuthRequiredCardProps = {
  title: string;
  description: string;
  loading?: boolean;
  children?: ReactNode;
};

export default function AuthRequiredCard({
  title,
  description,
  loading = false,
  children,
}: AuthRequiredCardProps) {
  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11px] text-white/65 max-w-sm leading-relaxed">{description}</p>
      </div>
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-9 rounded-full bg-white/10" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
