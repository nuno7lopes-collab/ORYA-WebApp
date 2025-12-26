"use client";

import { useEffect, useMemo, useState } from "react";
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
  groupLabel?: string | null;
  roundType?: string | null;
  roundLabel?: string | null;
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
  const [tab, setTab] = useState<"duplas" | "grupos" | "eliminatorias" | "rankings">("duplas");
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const categoryOptions = useMemo(
    () =>
      (categoriesMeta || [])
        .filter((c) => Number.isFinite(c.categoryId as number))
        .map((c) => ({
          id: c.categoryId as number,
          label: c.name || `Categoria ${c.categoryId}`,
        })),
    [categoriesMeta],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }
    if (selectedCategoryId && categoryOptions.some((c) => c.id === selectedCategoryId)) return;
    setSelectedCategoryId(categoryOptions[0].id ?? null);
  }, [categoryOptions, selectedCategoryId]);

  const { data: pairingsRes } = useSWR(eventId ? `/api/padel/pairings?eventId=${eventId}` : null, fetcher);
  const categoryParam = selectedCategoryId ? `&categoryId=${selectedCategoryId}` : "";
  const { data: matchesRes, mutate: mutateMatches } = useSWR(
    eventId ? `/api/padel/matches?eventId=${eventId}${categoryParam}` : null,
    fetcher,
  );
  const { data: standingsRes } = useSWR(
    eventId ? `/api/padel/standings?eventId=${eventId}${categoryParam}` : null,
    fetcher,
  );
  const { data: configRes, mutate: mutateConfig } = useSWR(
    eventId ? `/api/padel/tournaments/config?eventId=${eventId}` : null,
    fetcher,
  );

  const pairings: Pairing[] = pairingsRes?.pairings ?? [];
  const matches: Match[] = matchesRes?.items ?? [];
  const standings: Standings = standingsRes?.standings ?? {};
  const advanced = (configRes?.config?.advancedSettings || {}) as Record<string, any>;
  const formatRequested = advanced.formatRequested as string | undefined;
  const formatEffective = advanced.formatEffective as string | undefined;
  const generationVersion = advanced.generationVersion as string | undefined;
  const koGeneratedAt = advanced.koGeneratedAt as string | undefined;
  const koSeedSnapshot =
    (advanced.koSeedSnapshot as
      | Array<{
          pairingId: number;
          groupLabel: string;
          rank: number;
          points?: number;
          setDiff?: number;
          gameDiff?: number;
          setsFor?: number;
          setsAgainst?: number;
        }>
      | undefined) ?? [];
  const koOverride = advanced.koOverride === true;

  const pairingNameById = useMemo(() => {
    const map = new Map<number, string>();
    pairings.forEach((p) => map.set(p.id, nameFromSlots(p)));
    return map;
  }, [pairings]);

  const filteredPairings = selectedCategoryId
    ? pairings.filter((p) => p.categoryId === selectedCategoryId)
    : pairings;

  const koRounds = useMemo(() => {
    const winnerFromSets = (sets?: Array<{ teamA: number; teamB: number }>): "A" | "B" | null => {
      if (!sets || sets.length === 0) return null;
      let winsA = 0;
      let winsB = 0;
      sets.forEach((s) => {
        if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
          if (s.teamA > s.teamB) winsA += 1;
          else if (s.teamB > s.teamA) winsB += 1;
        }
      });
      if (winsA === winsB) return null;
      return winsA > winsB ? "A" : "B";
    };

    const rounds = new Map<
      string,
      Array<{
        id: number;
        teamA: string;
        teamB: string;
        status: string;
        score: string;
        winner: "A" | "B" | null;
      }>
    >();
    matches
      .filter((m) => m.roundType === "KNOCKOUT")
      .forEach((m) => {
        const key = m.roundLabel || "KO";
        if (!rounds.has(key)) rounds.set(key, []);
        const score =
          m.scoreSets?.length && m.scoreSets.length > 0
            ? m.scoreSets.map((s) => `${s.teamA}-${s.teamB}`).join(", ")
            : "—";
        rounds.get(key)!.push({
          id: m.id,
          teamA: pairingNameById.get(m.pairingA?.id ?? 0) ?? "—",
          teamB: m.pairingB ? pairingNameById.get(m.pairingB?.id ?? 0) ?? "—" : "BYE",
          status: m.status,
          score,
          winner: winnerFromSets(m.scoreSets ?? undefined),
        });
      });
    // ordenar rounds por importância
    const order = ["R16", "QUARTERFINAL", "SEMIFINAL", "FINAL"];
    return Array.from(rounds.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [matches, pairingNameById]);

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
    live: matches.filter((m) => m.status === "IN_PROGRESS" || m.status === "LIVE").length,
    done: matches.filter((m) => m.status === "DONE").length,
  };
  const groupMatchesCount = matches.filter((m) => m.roundType === "GROUPS").length;
  const groupMatchesDone = matches.filter((m) => m.roundType === "GROUPS" && m.status === "DONE").length;
  const groupMissing = Math.max(0, groupMatchesCount - groupMatchesDone);
  const groupsConfig = (advanced.groupsConfig as Record<string, any>) || {};

  const formatLabel = (value?: string | null) => {
    if (!value) return "";
    switch (value) {
      case "TODOS_CONTRA_TODOS":
        return "Todos contra todos";
      case "QUADRO_ELIMINATORIO":
        return "Quadro eliminatório";
      case "GRUPOS_ELIMINATORIAS":
        return "Grupos + eliminatórias";
      case "CAMPEONATO_LIGA":
        return "Campeonato/Liga";
      case "QUADRO_AB":
        return "Quadro A/B";
      case "NON_STOP":
        return "Non-stop";
      default:
        return value;
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-PT");
  };

  const championName = useMemo(() => {
    const finalRound = koRounds.find(([key]) => key === "FINAL") || koRounds[koRounds.length - 1];
    if (!finalRound) return null;
    const [, games] = finalRound;
    const final = games[0];
    if (!final) return null;
    if (final.winner === "A") return final.teamA;
    if (final.winner === "B") return final.teamB;
    return null;
  }, [koRounds]);

  async function saveGroupsConfig(update: Partial<{ groupCount: number | null; qualifyPerGroup: number | null; seeding: "SNAKE" | "NONE" }>) {
    const organizerId = configRes?.config?.organizerId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizerId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizerId,
        eventId,
        format,
        groups: {
          ...groupsConfig,
          ...update,
        },
      }),
    });
    if (res.ok) {
      setConfigMessage("Configuração guardada.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar configuração.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  const handleNumberConfig = (
    e: React.FocusEvent<HTMLInputElement>,
    key: "groupCount" | "qualifyPerGroup",
  ) => {
    const val = Number(e.target.value);
    if (!Number.isFinite(val) || val <= 0) {
      e.target.value = "";
      return;
    }
    saveGroupsConfig({ [key]: val } as any);
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
      {categoryOptions.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
          <span className="uppercase tracking-[0.18em] text-[11px] text-white/60">Categoria ativa</span>
          <select
            value={selectedCategoryId ?? ""}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[12px] text-white/80"
          >
            {categoryOptions.map((opt) => (
              <option key={`padel-cat-${opt.id}`} value={String(opt.id)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {formatRequested && formatEffective && formatRequested !== formatEffective && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12px] text-amber-50">
          Formato pedido: {formatLabel(formatRequested)}. Este torneio está a usar: {formatLabel(formatEffective)} (modo Beta).
        </div>
      )}

      {(generationVersion || groupMissing > 0) && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 flex items-center justify-between gap-3 flex-wrap">
          <span>Motor de geração: {generationVersion ?? "v1-groups-ko"}</span>
          {groupMissing > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-100">
              Faltam {groupMissing} jogo{groupMissing === 1 ? "" : "s"} dos grupos para fechar classificação.
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[12px]">
        {[
          { key: "duplas", label: "Duplas" },
          { key: "grupos", label: "Grupos" },
          { key: "eliminatorias", label: "Eliminatórias" },
          { key: "rankings", label: "Rankings" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`rounded-full px-3 py-1 border ${tab === t.key ? "bg-white text-black font-semibold" : "border-white/20 text-white/75"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "grupos" && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Configuração de grupos</p>
          {configMessage && <p className="text-[12px] text-white/70">{configMessage}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Nº de grupos</span>
              <input
                type="number"
                min={1}
                defaultValue={groupsConfig.groupCount ?? ""}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                onBlur={(e) => handleNumberConfig(e, "groupCount")}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Passam por grupo</span>
              <input
                type="number"
                min={1}
                defaultValue={groupsConfig.qualifyPerGroup ?? 2}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                onBlur={(e) => handleNumberConfig(e, "qualifyPerGroup")}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Seeding</span>
              <select
                defaultValue={groupsConfig.seeding ?? "SNAKE"}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                onChange={(e) => saveGroupsConfig({ seeding: e.target.value as any })}
              >
                <option value="SNAKE">Snake (equilibrado)</option>
                <option value="NONE">Aleatório</option>
              </select>
            </label>
          </div>
          <p className="text-[11px] text-white/50">Guardado ao sair dos campos. Valores têm de ser maiores que zero.</p>
        </div>
      )}

      {tab === "duplas" && (
        <div className="space-y-2">
          {filteredPairings.length === 0 && <p className="text-sm text-white/70">Ainda não há duplas.</p>}
          {filteredPairings.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm flex items-center justify-between">
              <div>
                <p className="font-semibold">{nameFromSlots(p)}</p>
                <p className="text-[11px] text-white/60">{p.pairingStatus} · {p.paymentMode}</p>
              </div>
              {p.inviteToken && (
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/eventos/${eventId}?token=${p.inviteToken}`)
                  }
                  className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                >
                  Copiar convite
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "grupos" && (
        <div className="space-y-3">
          {matches.filter((m) => m.roundType === "GROUPS").length === 0 && <p className="text-sm text-white/70">Sem jogos de grupos.</p>}
          {matches
            .filter((m) => m.roundType === "GROUPS")
            .map((m) => (
              <div key={m.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/70">
                      Grupo {m.groupLabel || "?"}
                    </span>
                    <p className="font-semibold">{nameFromSlots(m.pairingA as Pairing)} vs {nameFromSlots(m.pairingB as Pairing)}</p>
                  </div>
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

      {tab === "eliminatorias" && (
        <div className="space-y-3">
          {koRounds.length === 0 && <p className="text-sm text-white/70">Ainda não geraste eliminatórias.</p>}
          {koGeneratedAt && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-1">
              <p>Quadro gerado em {formatDate(koGeneratedAt)}.</p>
              {koOverride && <p className="text-amber-200">Gerado em modo override (grupos com jogos em falta).</p>}
              {koSeedSnapshot.length > 0 && (
                <div className="space-y-1 text-white/70">
                  {koSeedSnapshot.map((q) => (
                    <div key={`${q.groupLabel}-${q.rank}-${q.pairingId}`} className="flex items-center justify-between gap-2">
                      <span>
                        {q.rank}º {q.groupLabel} — {pairingNameById.get(q.pairingId) ?? `Dupla ${q.pairingId}`}
                      </span>
                      <span className="text-white/50">
                        Pts {q.points ?? "—"} · SetΔ {q.setDiff ?? "—"} · GameΔ {q.gameDiff ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {championName && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[12px] text-emerald-50 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">Vencedor</span>
              <span className="text-sm font-semibold">{championName}</span>
            </div>
          )}
          {koRounds.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex min-w-full gap-4 pb-2">
                {koRounds.map(([roundKey, games], roundIdx) => {
                  const isLast = roundIdx === koRounds.length - 1;
                  return (
                  <div
                    key={roundKey}
                    className="relative min-w-[220px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-[#0a0f1f]/60 to-[#05070f]/70 p-3 space-y-2 shadow-[0_15px_35px_rgba(0,0,0,0.35)]"
                  >
                    {!isLast && <div className="absolute top-3 right-[-12px] h-[90%] w-px bg-white/10 hidden lg:block" />}
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{roundKey}</p>
                    {games.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-xl border border-white/15 bg-black/40 p-2 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[12px] text-white">
                          <span className={`font-semibold ${g.winner === "A" ? "text-emerald-300" : ""}`}>{g.teamA}</span>
                          <span className="text-white/60">{g.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-white">
                          <span className={`font-semibold ${g.winner === "B" ? "text-emerald-300" : ""}`}>{g.teamB}</span>
                          <span className="text-white/60">{g.score}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <input
                            type="text"
                            placeholder="6-3, 6-4"
                            className="flex-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v) submitResult(g.id, v);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "rankings" && (
        <div className="space-y-3 text-sm">
          {Object.keys(standings).length === 0 && <p className="text-white/70">Sem standings.</p>}
          {Object.entries(standings).map(([groupKey, rows]) => (
            <div key={groupKey} className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Grupo {groupKey}</p>
                <span className="text-[11px] text-white/50">Top {rows.length}</span>
              </div>
              <div className="space-y-1">
                {rows.map((r, idx) => (
                  <div key={r.pairingId} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white/85">
                      <span className="text-[11px] text-white/60">#{idx + 1}</span>
                      <span>{pairingNameById.get(r.pairingId) ?? `Dupla ${r.pairingId}`}</span>
                    </span>
                    <span className="text-white/70">
                      Pts {r.points} · {r.wins}V/{r.losses}D · Sets {r.setsFor}-{r.setsAgainst}
                    </span>
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
