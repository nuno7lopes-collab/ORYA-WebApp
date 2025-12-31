"use client";

import type { ReactNode } from "react";

type ProfileHeaderLayoutProps = {
  coverUrl?: string | null;
  coverActionsSlot?: ReactNode;
  coverHeightClassName?: string;
  contentWidthClassName?: string;
  avatarSlot: ReactNode;
  statsSlot?: ReactNode;
  titleSlot: ReactNode;
  metaSlot?: ReactNode;
  bioSlot?: ReactNode;
  linksSlot?: ReactNode;
  actionsSlot?: ReactNode;
  afterSlot?: ReactNode;
};

export function ProfileStatPill({
  label,
  value,
  onClick,
}: {
  label: string;
  value: ReactNode;
  onClick?: () => void;
}) {
  const isClickable = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`inline-flex items-center gap-2 rounded-2xl border border-white/16 bg-white/8 px-3 py-1.5 text-white ${
        isClickable ? "hover:border-white/24 hover:bg-white/10 transition-colors" : "cursor-default"
      } disabled:opacity-100 disabled:cursor-default`}
    >
      <span className="text-base font-semibold leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-[0.12em] text-white/70 leading-none">
        {label}
      </span>
    </button>
  );
}

export function ProfileVerifiedBadge() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/50 bg-gradient-to-br from-amber-400/30 via-amber-500/20 to-amber-600/25 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.35)]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

export default function ProfileHeaderLayout({
  coverUrl,
  coverActionsSlot,
  coverHeightClassName = "h-44 sm:h-52",
  contentWidthClassName = "orya-page-width",
  avatarSlot,
  statsSlot,
  titleSlot,
  metaSlot,
  bioSlot,
  linksSlot,
  actionsSlot,
  afterSlot,
}: ProfileHeaderLayoutProps) {
  const coverStyle = coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined;

  return (
    <section className="relative">
      <div className="px-5 pt-5 sm:px-8">
        <div className={contentWidthClassName}>
          <div
            className={`relative w-full overflow-hidden rounded-2xl border border-white/10 ${coverHeightClassName}`}
          >
            <div className="absolute inset-0 bg-cover bg-center" style={coverStyle} />
            {!coverUrl && (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(107,255,255,0.25),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(255,0,200,0.2),transparent_55%),linear-gradient(135deg,rgba(6,10,20,0.8),rgba(9,10,18,0.95))]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-[#05070f]/95" />
            {coverActionsSlot && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                {coverActionsSlot}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative -mt-10 px-5 pb-6 sm:px-8">
        <div className={`${contentWidthClassName} flex flex-col gap-4 md:flex-row md:items-end md:justify-between`}>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">{avatarSlot}</div>
            <div className="flex min-w-0 flex-col gap-3">
              {statsSlot && (
                <div className="flex flex-wrap items-center gap-3">{statsSlot}</div>
              )}
              {titleSlot}
              {metaSlot}
              {bioSlot}
              {linksSlot}
            </div>
          </div>
          {actionsSlot && <div className="flex flex-wrap items-center gap-2">{actionsSlot}</div>}
        </div>
        {afterSlot}
      </div>
    </section>
  );
}
