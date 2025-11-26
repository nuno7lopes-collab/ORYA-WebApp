// app/me/experiencias/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ExperienceCard = {
  id: number;
  title: string;
  slug: string;
  startsAt: string | null;
  locationName: string | null;
  coverImageUrl: string | null;
};

export default function MinhasExperienciasPage() {
  const [items, setItems] = useState<ExperienceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/me/experiencias", { cache: "no-store" });
        if (res.status === 404) {
          setItems([]);
          return;
        }
        if (!res.ok) throw new Error("Erro ao carregar experiências");
        const data = await res.json();
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        console.error(err);
        if (active) setError("Não foi possível carregar as experiências.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">Área pessoal</p>
          <h1 className="text-2xl font-semibold">Minhas experiências</h1>
          <p className="text-sm text-white/70">Experiências que compraste ou reservaste.</p>
        </div>
        <Link
          href="/explorar"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg hover:brightness-105"
        >
          Explorar experiências
        </Link>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map((v) => (
              <div key={v} className="flex gap-3">
                <div className="h-16 w-16 animate-pulse rounded-xl bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/75">
          Ainda não tens experiências. Quando comprares ou fores convidado para uma experiência, ela
          aparece aqui.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((exp) => (
            <Link
              key={exp.id}
              href={`/experiencias/${exp.slug}`}
              className="group flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-[#6BFFFF]/80 hover:-translate-y-[2px]"
            >
              <div className="h-20 w-20 overflow-hidden rounded-xl bg-gradient-to-br from-[#22d3ee]/30 via-[#34d399]/20 to-[#0ea5e9]/30">
                {exp.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={exp.coverImageUrl}
                    alt={exp.title}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[13px] font-semibold leading-tight group-hover:text-[#6BFFFF]">
                  {exp.title}
                </p>
                <p className="text-xs text-white/65">
                  {exp.startsAt ? new Date(exp.startsAt).toLocaleString("pt-PT") : "Data a definir"}
                </p>
                <p className="text-xs text-white/60">{exp.locationName || "Local a anunciar"}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
