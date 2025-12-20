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
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_60%)]" />

      <section className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-7">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Área pessoal</p>
            <h1 className="text-2xl font-semibold">Minhas experiências</h1>
            <p className="text-sm text-white/75">Experiências que compraste ou reservaste.</p>
          </div>
          <Link
            href="/explorar"
            className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_55px_rgba(255,255,255,0.25)]"
          >
            Explorar experiências
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
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
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-[0_16px_40px_rgba(127,29,29,0.35)] backdrop-blur-xl">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
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
                className="group flex gap-3 rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(2,6,16,0.9))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition hover:border-white/35 hover:-translate-y-[2px]"
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
                  <p className="text-[13px] font-semibold leading-tight text-white/90 group-hover:text-white">
                    {exp.title}
                  </p>
                  <p className="text-xs text-white/70">
                    {exp.startsAt ? new Date(exp.startsAt).toLocaleString("pt-PT") : "Data a definir"}
                  </p>
                  <p className="text-xs text-white/65">{exp.locationName || "Local a anunciar"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
