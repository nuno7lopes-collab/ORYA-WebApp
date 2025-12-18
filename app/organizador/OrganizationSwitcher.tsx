"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type OrganizationSwitcherOption = {
  organizerId: number;
  role: string;
  organizer: {
    id: number;
    username: string | null;
    publicName?: string | null;
    displayName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
};

type Props = {
  currentId: number | null;
  initialOrgs?: OrganizationSwitcherOption[];
};

export function OrganizationSwitcher({ currentId, initialOrgs = [] }: Props) {
  const [options, setOptions] = useState<OrganizationSwitcherOption[]>(initialOrgs);
  const [activeId, setActiveId] = useState<number | null>(currentId);
  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Defere para o próximo tick para evitar cascade em render síncrono de layout
    const id = requestAnimationFrame(() => {
      setActiveId(currentId);
      setOptions(initialOrgs);
    });
    return () => cancelAnimationFrame(id);
  }, [currentId, initialOrgs]);

  const current = useMemo(
    () => options.find((i) => i.organizerId === activeId) ?? options[0] ?? null,
    [activeId, options],
  );

  if (!current) {
    return (
      <div data-tour="user-experience">
        <Link
          href="/organizador/organizations"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:border-white/20"
        >
          Escolher organização
        </Link>
      </div>
    );
  }

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const goUserMode = () => {
    closeDropdown();
    router.push("/explorar");
  };

  return (
    <div className="relative" data-tour="user-experience">
      <details
        className="group"
        ref={detailsRef}
        open={isOpen}
        onToggle={(e) => setIsOpen(e.currentTarget.open)}
        suppressHydrationWarning
      >
        <summary
          className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[12px] text-white/85 transition hover:border-white/30"
        >
          {current.organizer.brandingAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.organizer.brandingAvatarUrl}
              alt={current.organizer.publicName || current.organizer.displayName || "Organização"}
              className="h-8 w-8 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold">
              {(current.organizer.publicName || current.organizer.displayName || current.organizer.businessName || "O")[0]}
            </span>
          )}
          <span className="text-white/70 group-open:rotate-180 transition-transform pr-1">▾</span>
        </summary>
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-white/10 bg-black/85 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="space-y-1">
            <Link
              href="/organizador/organizations"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white hover:bg-white/10"
              onClick={closeDropdown}
            >
              <span>Gerir organizações</span>
              <span className="text-[10px] text-white/60">↗</span>
            </Link>
            <Link
              href={current.organizer.username ? `/org/${current.organizer.username}` : "/explorar"}
              target={current.organizer.username ? "_blank" : undefined}
              rel={current.organizer.username ? "noreferrer" : undefined}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white hover:bg-white/10"
              onClick={closeDropdown}
            >
              <span>Página pública</span>
              <span className="text-[10px] text-white/60">↗</span>
            </Link>
            <button
              type="button"
              onClick={goUserMode}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              <span>Modo público</span>
              <span className="text-[10px] text-white/60">↗</span>
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
