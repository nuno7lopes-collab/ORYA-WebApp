"use client";

import { useState } from "react";
import useSWR from "swr";

type Pairing = {
  id: number;
  pairingStatus: string;
  paymentMode: string;
  categoryId?: number | null;
  slots: { id: number; slotRole: string; slotStatus: string; paymentStatus: string; playerProfile?: { displayName?: string | null; fullName?: string | null } | null }[];
  inviteToken?: string | null;
};

type Match = {
  id: number;
  status: string;
  pairingA?: Pairing | null;
  pairingB?: Pairing | null;
  scoreSets?: Array<{ teamA: number; teamB: number }> | null;
};

type Standings = Record<string, Array<{ pairingId: number; points: number; wins: number; losses: number; setsFor: number; setsAgainst: number }>>;
type CategoryMeta = { name?: string; categoryId?: number | null; capacity?: number | null; registrationType?: string | null };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function nameFromSlots(pairing?: Pairing | null) {
  if (!pairing) return "—";
  const names = pairing.slots
    .map((s) => s.playerProfile?.displayName || s.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : "Dupla incompleta";
}

export default function PadelTournamentTabs({ eventId, categoriesMeta }: { eventId: number; categoriesMeta?: CategoryMeta[] }) {
  const [tab, setTab] = useState<"duplas" | "jogos" | "rankings">("duplas");

  const { data: pairingsRes } = useSWR(eventId ? `/api/padel/pairings?eventId=${eventId}` : null, fetcher);
  const { data: matchesRes, mutate: mutateMatches } = useSWR(eventId ? `/api/padel/matches?eventId=${eventId}` : null, fetcher);
  const { data: standingsRes } = useSWR(eventId ? `/api/padel/standings?eventId=${eventId}` : null, fetcher);

  const pairings: Pairing[] = pairingsRes?.pairings ?? [];
  const matches: Match[] = matchesRes?.items ?? [];
  const standings: Standings = standingsRes?.standings ?? {};

  const categoryStats = (() => {
    const metaMap = new Map<number | null, CategoryMeta>();
    (categoriesMeta || []).forEach((m) => {
      const key = Number.isFinite(m.categoryId as number) ? (m.categoryId as number) : null;
      metaMap.set(key, m);
    });
    const counts = new Map<number | null, number>();
    pairings.forEach((p) => {
      const key = Number.isFinite(p.categoryId as number) ? (p.categoryId as number) : null;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const rows: Array<{ key: number | null; label: string; count: number; capacity: number | null }> = [];
    const keys = new Set([...counts.keys(), ...metaMap.keys()]);
    keys.forEach((key) => {
      const meta = metaMap.get(key);
      const label = meta?.name || (key === null ? "Categoria" : `Categoria ${key}`);
      const capacity = meta?.capacity ?? null;
      rows.push({ key, label, count: counts.get(key) || 0, capacity });
    });
    return rows;
  })();

  const matchesSummary = {
    pending: matches.filter((m) => m.status === "PENDING").length,
    live: matches.filter((m) => m.status === "LIVE").length,
    done: matches.filter((m) => m.status === "DONE").length,
  };

  async function submitResult(matchId: number, scoreText: string) {
    const sets = scoreText
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((s) => s.split("-").map((v) => Number(v.trim())))
      .filter((arr) => arr.length === 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1]))
      .map(([a, b]) => ({ teamA: a, teamB: b }));

    await fetch(`/api/padel/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: matchId, status: "DONE", score: { sets } }),
    });
    mutateMatches();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4 mt-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Inscrições Padel</p>
          <p className="text-2xl font-semibold text-white">{pairings.length}</p>
          <p className="text-[12px] text-white/70">
            Completas: {pairings.filter((p) => p.pairingStatus === "COMPLETE").length} · Pendentes:{" "}
            {pairings.filter((p) => p.pairingStatus !== "COMPLETE").length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Jogos</p>
          <p className="text-2xl font-semibold text-white">{matches.length}</p>
          <p className="text-[12px] text-white/70">
            Pendentes {matchesSummary.pending} · Live {matchesSummary.live} · Terminados {matchesSummary.done}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Categorias</p>
          <div className="space-y-1 text-[12px] text-white/75">
            {categoryStats.length === 0 && <p className="text-white/60">Sem categorias definidas.</p>}
            {categoryStats.map((c) => {
              const occupancy = c.capacity ? Math.min(100, Math.round((c.count / c.capacity) * 100)) : null;
              return (
                <div key={`${c.key ?? "default"}`} className="flex items-center justify-between gap-2">
                  <span className="text-white">{c.label}</span>
                  <span className="text-white/70">
                    {c.count} equipa{c.count === 1 ? "" : "s"} {c.capacity ? `· ${occupancy}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        {[
          { key: "duplas", label: "Duplas" },
          { key: "jogos", label: "Jogos" },
          { key: "rankings", label: "Rankings" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "duplas" | "jogos" | "rankings")}
            className={`rounded-full px-3 py-1 border ${tab === t.key ? "bg-white text-black font-semibold" : "border-white/20 text-white/75"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "duplas" && (
        <div className="space-y-2">
          {pairings.length === 0 && <p className="text-sm text-white/70">Ainda não há duplas.</p>}
          {pairings.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm flex items-center justify-between">
              <div>
                <p className="font-semibold">{nameFromSlots(p)}</p>
                <p className="text-[11px] text-white/60">{p.pairingStatus} · {p.paymentMode}</p>
              </div>
              {p.inviteToken && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/eventos/${event.slug}?token=${p.inviteToken}`)}
                  className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                >
                  Copiar convite
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "jogos" && (
        <div className="space-y-3">
          {matches.length === 0 && <p className="text-sm text-white/70">Sem jogos gerados.</p>}
          {matches.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{nameFromSlots(m.pairingA as Pairing)} vs {nameFromSlots(m.pairingB as Pairing)}</p>
                <span className="text-[11px] text-white/60">{m.status}</span>
              </div>
              <p className="text-[12px] text-white/70">Resultado: {m.scoreSets?.length ? m.scoreSets.map((s) => `${s.teamA}-${s.teamB}`).join(", ") : "—"}</p>
              <div className="flex items-center gap-2 text-[12px]">
                <input
                  type="text"
                  placeholder="6-3, 6-4"
                  className="flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) submitResult(m.id, v);
                  }}
                />
                <span className="text-white/50">(guardar ao sair do campo)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "rankings" && (
        <div className="space-y-3 text-sm">
          {Object.keys(standings).length === 0 && <p className="text-white/70">Sem standings.</p>}
          {Object.entries(standings).map(([groupKey, rows]) => (
            <div key={groupKey} className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{groupKey}</p>
              <div className="space-y-1">
                {rows.map((r, idx) => (
                  <div key={r.pairingId} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/85">
                      <span className="text-[11px] text-white/60">#{idx + 1}</span>
                      <span>Dupla {r.pairingId}</span>
                    </span>
                    <span className="text-white/70">Pts {r.points} · {r.wins}V/{r.losses}D · Sets {r.setsFor}-{r.setsAgainst}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
