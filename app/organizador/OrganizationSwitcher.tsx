"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type OrganizationSwitcherOption = {
  organizerId: number;
  role: string;
  organizer: {
    id: number;
    username: string | null;
    displayName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    status: string | null;
  };
};

type Props = {
  currentId: number | null;
  initialOrgs?: OrganizationSwitcherOption[];
};

export function OrganizationSwitcher({ currentId, initialOrgs = [] }: Props) {
  const router = useRouter();

  const [options, setOptions] = useState<OrganizationSwitcherOption[]>(initialOrgs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(currentId);

  useEffect(() => {
    setActiveId(currentId);
    setOptions(initialOrgs);
  }, [currentId, initialOrgs]);

  const current = useMemo(
    () => options.find((i) => i.organizerId === activeId) ?? options[0] ?? null,
    [activeId, options],
  );

  const handleSwitch = async (id: number) => {
    if (id === activeId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizador/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Erro ao mudar de organização.");
      } else {
        setActiveId(id);
        router.refresh();
      }
    } catch (err) {
      console.error("[OrganizationSwitcher] switch error", err);
      setError("Erro inesperado ao mudar de organização.");
    } finally {
      setSaving(false);
    }
  };

  if (!current) {
    return (
      <Link
        href="/organizador/(dashboard)/organizations"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:border-white/20"
      >
        Escolher organização
      </Link>
    );
  }

  return (
    <div className="relative">
      <details className="group">
        <summary className="flex cursor-pointer select-none items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/85 transition hover:border-white/20">
          <span className="truncate max-w-[180px]">{current.organizer.displayName || current.organizer.businessName || "Organização"}</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.16em] text-white/60">
            {current.role}
          </span>
          <span className="text-white/60 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="max-h-80 overflow-auto space-y-1">
            {options.map((org) => (
              <button
                key={org.organizerId}
                type="button"
                onClick={() => handleSwitch(org.organizerId)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  org.organizerId === activeId
                    ? "bg-white/10 text-white font-semibold"
                    : "hover:bg-white/10 text-white/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {org.organizer.displayName || org.organizer.businessName || "Organização"}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">{org.role}</span>
                </div>
                {org.organizer.city && (
                  <p className="text-[11px] text-white/50 truncate">{org.organizer.city}</p>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 text-right">
            <Link
              href="/organizador/become"
              className="text-[12px] text-white/70 hover:text-white transition"
            >
              Criar nova organização
            </Link>
          </div>
          {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
        </div>
      </details>
    </div>
  );
}
