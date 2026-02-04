"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type MixFormat = "NON_STOP" | "FASE_FINALS";

export default function PadelMixNovoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = parseOrganizationId(searchParams?.get("organizationId"));
  const [title, setTitle] = useState("Mix rápido");
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [teamsCount, setTeamsCount] = useState(8);
  const [format, setFormat] = useState<MixFormat>("NON_STOP");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!startsAt) {
      setError("Indica a data/hora de início.");
      return;
    }
    if (teamsCount < 2 || teamsCount > 8) {
      setError("O Mix rápido suporta entre 2 e 8 equipas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/organizacao/padel/mix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt,
          durationMinutes,
          teamsCount,
          format,
          locationName,
          locationCity,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível criar o Mix.");
      }
      router.push(appendOrganizationIdToHref(`/organizacao/padel/torneios/${json.eventId}`, organizationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar o Mix.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 text-white">
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Easy Mix</p>
          <h1 className="text-3xl font-semibold">Criar Mix rápido</h1>
          <p className="text-sm text-white/70">
            Torneio curto (2-3h) para grupos de pessoas. Podes adicionar as duplas depois.
          </p>
        </header>

        <div className="grid gap-4 rounded-2xl border border-white/15 bg-white/5 p-4">
          <label className="space-y-1 text-sm text-white/70">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Nome</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Início</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Duração (min)</span>
              <input
                type="number"
                min={60}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Equipas (2-8)</span>
              <input
                type="number"
                min={2}
                max={8}
                value={teamsCount}
                onChange={(e) => setTeamsCount(Number(e.target.value))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Formato</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as MixFormat)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
              >
                <option value="NON_STOP">Nonstop (todos contra todos)</option>
                <option value="FASE_FINALS">Fase + finais (2 grupos)</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Local (opcional)</span>
              <input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                placeholder="Clube ou campo"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/60">Cidade (opcional)</span>
              <input
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                placeholder="Lisboa"
              />
            </label>
          </div>

          {error && <p className="text-sm text-amber-200">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {loading ? "A criar..." : "Criar Mix"}
          </button>
        </div>
      </div>
    </div>
  );
}
