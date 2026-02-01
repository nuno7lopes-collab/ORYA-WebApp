import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { defaultBlurDataURL } from "@/lib/image";

type TagTone = "live" | "soon" | "default";

type StatusTagProps = {
  label: string;
  tone?: TagTone;
  className?: string;
};

type MetaPillProps = {
  label: string;
  icon?: ReactNode;
  className?: string;
};

type EventMeta = {
  label: string;
  icon?: ReactNode;
};

type EventSquareCardProps = {
  href: string;
  imageUrl: string;
  title: string;
  location?: string | null;
  tagLabel?: string;
  tagTone?: TagTone;
  meta?: EventMeta[];
  className?: string;
  imagePriority?: boolean;
};

type EventListCardProps = {
  href: string;
  imageUrl: string;
  title: string;
  subtitle?: string | null;
  dateLabel?: string;
  tagLabel?: string;
  tagTone?: TagTone;
  meta?: EventMeta[];
  className?: string;
};

export function StatusTag({ label, tone = "default", className }: StatusTagProps) {
  const toneClass =
    tone === "live"
      ? "border-[#ff5bd6]/60 bg-[#ff5bd6]/15 text-[#ffd7f4]"
      : tone === "soon"
        ? "border-[#6bffff]/50 bg-[#6bffff]/15 text-[#d7fbff]"
        : "border-white/25 bg-white/10 text-white/80";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
        toneClass,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function MetaPill({ label, icon, className }: MetaPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/6 px-2.5 py-1 text-[10px] text-white/75",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

export function EventSquareCard({
  href,
  imageUrl,
  title,
  location,
  tagLabel,
  tagTone,
  meta,
  className,
  imagePriority,
}: EventSquareCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative w-full rounded-[28px] p-[1px]",
        "bg-[linear-gradient(135deg,var(--orya-neon-pink),var(--orya-neon-cyan))]",
        "shadow-[0_0_26px_rgba(107,255,255,0.2),0_0_26px_rgba(255,0,200,0.18)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[26px] bg-[rgba(6,9,16,0.92)]">
        <div className="relative aspect-square w-full">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
            priority={imagePriority}
            fetchPriority={imagePriority ? "high" : "auto"}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black/60" />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        </div>
        {tagLabel && (
          <div className="absolute left-3 top-3">
            <StatusTag label={tagLabel} tone={tagTone} />
          </div>
        )}
        <div className="absolute inset-x-4 bottom-4 space-y-2">
          <div>
            <p className="text-[13px] font-semibold text-white line-clamp-2">{title}</p>
            {location && <p className="text-[11px] text-white/70 line-clamp-1">{location}</p>}
          </div>
          {meta && meta.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {meta.map((item, index) => (
                <MetaPill key={`${item.label}-${index}`} label={item.label} icon={item.icon} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventListCard({
  href,
  imageUrl,
  title,
  subtitle,
  dateLabel,
  tagLabel,
  tagTone,
  meta,
  className,
}: EventListCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative w-full rounded-[26px] p-[1px]",
        "bg-[linear-gradient(135deg,rgba(255,0,200,0.45),rgba(107,255,255,0.35))]",
        "shadow-[0_0_26px_rgba(107,255,255,0.14),0_0_26px_rgba(255,0,200,0.1)]",
        className,
      )}
    >
      <div className="relative flex gap-4 overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(7,10,16,0.92)] px-4 py-3">
        <div className="pointer-events-none absolute left-0 top-4 h-[calc(100%-2rem)] w-[3px] rounded-full bg-[linear-gradient(180deg,rgba(107,255,255,0.7),rgba(255,94,219,0.35),rgba(255,94,219,0))]" />
        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border border-white/10 md:h-[96px] md:w-[96px]">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="96px"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            placeholder="blur"
            blurDataURL={defaultBlurDataURL}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/30 to-black/80" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            {dateLabel && (
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/60">
                {dateLabel}
              </span>
            )}
            {tagLabel && <StatusTag label={tagLabel} tone={tagTone} />}
          </div>
          <p className="text-[14px] font-semibold text-white line-clamp-1">{title}</p>
          {subtitle && <p className="text-[11px] text-white/65 line-clamp-1">{subtitle}</p>}
          {meta && meta.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((item, index) => (
                <MetaPill key={`${item.label}-${index}`} label={item.label} icon={item.icon} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
