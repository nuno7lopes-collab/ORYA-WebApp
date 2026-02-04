"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { summarizeMatchStatus, computeStandingsForGroup } from "@/domain/tournaments/structure";
import { type TieBreakRule } from "@/domain/tournaments/standings";
import { computeLiveWarnings } from "@/domain/tournaments/liveWarnings";
import { Avatar } from "@/components/ui/avatar";
import { appendOrganizationIdToHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type PageProps = { params: Promise<{ id: string }> };
type TournamentLiveManagerProps = { tournamentId: number };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Participant = {
  id: number;
  name: string;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  seed?: number | null;
};

type ParticipantDraft = {
  id?: number | null;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
};

type UserResult = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export function TournamentLiveManager({ tournamentId }: TournamentLiveManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationId = parseOrganizationId(searchParams?.get("organizationId"));
  const isValidTournamentId = Number.isFinite(tournamentId);
  const [authError, setAuthError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Array<Participant | null>>([]);
  const [bracketSize, setBracketSize] = useState(16);
  const [participantsMessage, setParticipantsMessage] = useState<string | null>(null);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [slotDraft, setSlotDraft] = useState<ParticipantDraft>({
    name: "",
    username: "",
    email: "",
    avatarUrl: null,
  });
  const [slotMode, setSlotMode] = useState<"user" | "guest">("guest");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedParticipantsRef = useRef(false);
  const lastSavedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (authError === "login") router.replace("/login");
    if (authError === "organização") {
      router.replace(appendOrganizationIdToHref("/organizacao", organizationId));
    }
  }, [authError, organizationId, router]);

  const { data, error } = useSWR(
    isValidTournamentId ? `/api/organizacao/tournaments/${tournamentId}/live` : null,
    fetcher,
  );
  const { data: participantsRes, mutate: mutateParticipants } = useSWR(
    isValidTournamentId ? `/api/organizacao/tournaments/${tournamentId}/participants` : null,
    fetcher,
  );

  const buildParticipantsPayload = (items: Array<Participant | null>) =>
    items
      .map((slot, idx) =>
        slot
          ? {
              id: slot.id,
              name: slot.name,
              username: slot.username ?? null,
              email: slot.email ?? null,
              avatarUrl: slot.avatarUrl ?? null,
              seed: idx + 1,
            }
          : null,
      )
      .filter(Boolean) as Participant[];

  const buildParticipantsKey = (items: Array<Participant | null>, size: number) =>
    JSON.stringify({ size, participants: buildParticipantsPayload(items) });

  const buildSlotsFromParticipants = (list: Participant[], size: number) => {
    const nextSlots: Array<Participant | null> = Array.from({ length: size }, () => null);
    const seeded: Participant[] = [];
    const unseeded: Participant[] = [];
    list.forEach((p) => {
      const seed = Number.isFinite(p.seed) ? Number(p.seed) : null;
      if (seed && seed >= 1 && seed <= size) seeded.push(p);
      else unseeded.push(p);
    });
    seeded
      .sort((a, b) => (Number(a.seed) || 0) - (Number(b.seed) || 0))
      .forEach((p) => {
        const idx = Number(p.seed) - 1;
        if (idx >= 0 && idx < size && !nextSlots[idx]) nextSlots[idx] = p;
      });
    let cursor = 0;
    unseeded.forEach((p) => {
      while (cursor < nextSlots.length && nextSlots[cursor]) cursor += 1;
      if (cursor < nextSlots.length) {
        nextSlots[cursor] = p;
        cursor += 1;
      }
    });
    return nextSlots;
  };

  useEffect(() => {
    if (!participantsRes?.ok) return;
    const list = Array.isArray(participantsRes.participants) ? (participantsRes.participants as Participant[]) : [];
    const nextSize = Number.isFinite(participantsRes.bracketSize) ? Number(participantsRes.bracketSize) : bracketSize;
    const resolvedSize = Number.isFinite(nextSize) ? nextSize : bracketSize;
    const nextSlots = buildSlotsFromParticipants(list, resolvedSize);
    if (Number.isFinite(resolvedSize)) setBracketSize(resolvedSize);
    setSlots(nextSlots);
    lastSavedKeyRef.current = buildParticipantsKey(nextSlots, resolvedSize);
    hasLoadedParticipantsRef.current = true;
  }, [participantsRes]);

  useEffect(() => {
    setSlots((prev) => {
      if (prev.length === bracketSize) return prev;
      if (bracketSize > prev.length) {
        return [...prev, ...Array.from({ length: bracketSize - prev.length }, () => null)];
      }
      return prev.slice(0, bracketSize);
    });
  }, [bracketSize]);

  useEffect(() => {
    if (activeSlotIndex !== null && activeSlotIndex >= bracketSize) {
      closeSlotEditor();
    }
  }, [activeSlotIndex, bracketSize]);

  useEffect(() => {
    if (!data?.error) return;
    if (data.error === "UNAUTHENTICATED") setAuthError("login");
    if (data.error === "FORBIDDEN") setAuthError("organização");
  }, [data?.error]);

  useEffect(() => {
    if (slotMode !== "user") {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const term = searchTerm.trim();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}&limit=6`);
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok || !json?.ok) {
          setSearchResults([]);
          return;
        }
        setSearchResults(Array.isArray(json.results) ? (json.results as UserResult[]) : []);
      } catch {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, slotMode]);

  const nextNegativeId = () => {
    const min = slots.reduce((acc, item) => {
      if (item && item.id < acc) return item.id;
      return acc;
    }, 0);
    return min <= -1 ? min - 1 : -1;
  };

  const openSlotEditor = (index: number) => {
    const current = slots[index];
    setActiveSlotIndex(index);
    setSlotMode(current?.username ? "user" : "guest");
    setSlotDraft({
      id: current?.id ?? nextNegativeId(),
      name: current?.name ?? "",
      username: current?.username ?? "",
      email: current?.email ?? "",
      avatarUrl: current?.avatarUrl ?? null,
    });
    setSearchTerm("");
    setSearchResults([]);
  };

  const closeSlotEditor = () => {
    setActiveSlotIndex(null);
    setSlotDraft({ name: "", username: "", email: "", avatarUrl: null });
    setSearchTerm("");
    setSearchResults([]);
  };

  const applyUserToDraft = (user: UserResult) => {
    const displayName = user.fullName || (user.username ? `@${user.username}` : "");
    setSlotDraft((prev) => ({
      ...prev,
      name: displayName,
      username: user.username ?? "",
      avatarUrl: user.avatarUrl ?? null,
      email: "",
    }));
    setSlotMode("user");
  };

  const handleSlotAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?scope=avatar", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setParticipantsMessage(json?.error || "Falha no upload da imagem.");
        return;
      }
      setSlotDraft((prev) => ({ ...prev, avatarUrl: json.url as string }));
    } catch {
      setParticipantsMessage("Erro ao carregar imagem.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (activeSlotIndex === null) return;
    const name = slotDraft.name.trim();
    if (!name) return;
    if (slotDraftTimerRef.current) clearTimeout(slotDraftTimerRef.current);
    slotDraftTimerRef.current = setTimeout(() => {
      const next: Participant = {
        id: slotDraft.id ?? nextNegativeId(),
        name,
        username: slotMode === "user" ? slotDraft.username.trim().replace(/^@/, "") || null : null,
        email: slotMode === "guest" ? slotDraft.email.trim().toLowerCase() || null : null,
        avatarUrl: slotDraft.avatarUrl?.trim() || null,
        seed: activeSlotIndex + 1,
      };
      setSlots((prev) => {
        const current = prev[activeSlotIndex];
        if (
          current &&
          current.id === next.id &&
          current.name === next.name &&
          (current.username ?? null) === (next.username ?? null) &&
          (current.email ?? null) === (next.email ?? null) &&
          (current.avatarUrl ?? null) === (next.avatarUrl ?? null)
        ) {
          return prev;
        }
        const copy = [...prev];
        copy[activeSlotIndex] = next;
        return copy;
      });
    }, 400);
    return () => {
      if (slotDraftTimerRef.current) clearTimeout(slotDraftTimerRef.current);
    };
  }, [activeSlotIndex, slotDraft, slotMode]);

  const clearSlot = () => {
    if (activeSlotIndex === null) return;
    setSlots((prev) => {
      const copy = [...prev];
      copy[activeSlotIndex] = null;
      return copy;
    });
    setParticipantsMessage(null);
    closeSlotEditor();
  };

  const moveSlot = (from: number, to: number) => {
    setSlots((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[from];
      copy[from] = copy[to];
      copy[to] = temp;
      return copy;
    });
  };

  const tournament = data?.tournament;
  const tieBreakRules: TieBreakRule[] = Array.isArray(tournament?.tieBreakRules)
    ? (tournament.tieBreakRules as TieBreakRule[])
    : (["WINS", "SET_DIFF", "GAME_DIFF", "HEAD_TO_HEAD", "RANDOM"] as TieBreakRule[]);

  const stages = useMemo(
    () =>
      tournament
        ? tournament.stages.map((s: any) => ({
            ...s,
            groups: s.groups.map((g: any) => ({
              ...g,
              standings: computeStandingsForGroup(g.matches, tieBreakRules, tournament.generationSeed || undefined),
              matches: g.matches.map((m: any) => ({ ...m, statusLabel: summarizeMatchStatus(m.status) })),
            })),
            matches: s.matches.map((m: any) => ({ ...m, statusLabel: summarizeMatchStatus(m.status) })),
          }))
        : [],
    [tournament, tieBreakRules],
  );

  const flatMatches = useMemo(
    () => stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)]),
    [stages],
  );

  const warnings = useMemo(
    () =>
      tournament
        ? computeLiveWarnings({
            matches: flatMatches,
            pairings: data?.pairings ?? [],
            startThresholdMinutes: 60,
          })
        : [],
    [tournament, flatMatches, data?.pairings],
  );

  const filledCount = slots.filter(Boolean).length;

  const saveParticipants = async (options?: { silent?: boolean }) => {
    if (savingParticipants) return;
    const filled = slots.filter((p): p is Participant => Boolean(p));
    if (filled.length > bracketSize) {
      setParticipantsMessage("Há mais participantes do que o tamanho da bracket.");
      return;
    }
    setSavingParticipants(true);
    setParticipantsMessage(null);
    try {
      const payload = buildParticipantsPayload(slots);
      const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: payload, bracketSize }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setParticipantsMessage(json?.error || "Erro ao guardar participantes.");
        return;
      }
      const list = Array.isArray(json.participants) ? (json.participants as Participant[]) : [];
      const nextSize = Number.isFinite(json.bracketSize) ? Number(json.bracketSize) : bracketSize;
      const nextSlots = buildSlotsFromParticipants(list, nextSize);
      setBracketSize(nextSize);
      setSlots(nextSlots);
      lastSavedKeyRef.current = buildParticipantsKey(nextSlots, nextSize);
      if (!options?.silent) {
        setParticipantsMessage("Participantes guardados.");
      }
      mutateParticipants();
    } catch {
      setParticipantsMessage("Erro inesperado ao guardar participantes.");
    } finally {
      setSavingParticipants(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedParticipantsRef.current) return;
    const nextKey = buildParticipantsKey(slots, bracketSize);
    if (nextKey === lastSavedKeyRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveParticipants({ silent: true });
    }, 700);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [slots, bracketSize]);

  const generateBracket = async () => {
    const count = slots.filter(Boolean).length;
    if (count === 0) {
      setGenerationMessage("Adiciona participantes antes de gerar a bracket.");
      return;
    }
    if (count > bracketSize) {
      setGenerationMessage("Há mais participantes do que o tamanho da bracket.");
      return;
    }
    const shouldRegenerate = flatMatches.length > 0;
    if (shouldRegenerate) {
      const confirmed = window.confirm(
        "Já existem jogos. Gerar novamente vai apagar resultados e reagendar a bracket. Queres continuar?",
      );
      if (!confirmed) return;
    }
    setGenerating(true);
    setGenerationMessage(null);
    try {
      const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "manual", bracketSize, forceGenerate: shouldRegenerate }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setGenerationMessage(json?.error || "Erro ao gerar bracket.");
        return;
      }
      setGenerationMessage("Bracket gerada.");
    } catch {
      setGenerationMessage("Erro inesperado ao gerar bracket.");
    } finally {
      setGenerating(false);
    }
  };

  if (!isValidTournamentId) {
    return (
      <div className="p-4 text-white/70">
        <p>ID de torneio inválido.</p>
        <button
          onClick={() => router.back()}
          className="mt-3 rounded-full border border-white/20 px-3 py-1 text-sm text-white hover:border-white/40"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-white/70">Erro a carregar dados do torneio.</div>;
  }

  if (!tournament) return <div className="p-4 text-white/70">A carregar…</div>;

  const summary = {
    pending: flatMatches.filter((m: any) => m.status === "PENDING").length,
    inProgress: flatMatches.filter((m: any) => m.status === "IN_PROGRESS").length,
    done: flatMatches.filter((m: any) => m.status === "DONE").length,
  };
  const showLivePanel = tournament?.event?.isGratis === false;

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Preparação</p>
            <h2 className="text-lg font-semibold text-white">Bracket & participantes</h2>
            <p className="text-sm text-white/60">Define tamanho e lista de jogadores.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
              {savingParticipants ? "A guardar…" : "Auto-guardar ativo"}
            </span>
            <button
              type="button"
              onClick={generateBracket}
              disabled={generating}
              className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100 hover:border-emerald-300/60 disabled:opacity-60"
            >
              {generating ? "A gerar…" : "Gerar bracket"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Tamanho da bracket</label>
              <select
                value={bracketSize}
                onChange={(e) => {
                  const nextSize = Number(e.target.value);
                  if (filledCount > nextSize) {
                    const ok = window.confirm("Bracket menor que jogadores. Continuar?");
                    if (!ok) return;
                  }
                  setBracketSize(nextSize);
                }}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80"
              >
                {[2, 4, 8, 16, 32, 64].map((size) => (
                  <option key={size} value={size}>
                    {size} jogadores
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-white/50">
                {filledCount} participantes · ordem top-down
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/60">
              Preenche os slots na ordem desejada. Cada slot corresponde a uma posicao no bracket.
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot, idx) => {
                const isActive = activeSlotIndex === idx;
                return (
                  <div key={`slot-${idx}`} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>Seed {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSlot(idx, idx - 1)}
                          disabled={!slot || idx === 0}
                          className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/70 hover:border-white/40 disabled:opacity-50"
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlot(idx, idx + 1)}
                          disabled={!slot || idx === slots.length - 1}
                          className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/70 hover:border-white/40 disabled:opacity-50"
                        >
                          Descer
                        </button>
                      </div>
                    </div>
                    {slot ? (
                      <>
                        <div className="flex items-center gap-3">
                        <Avatar
                          src={slot.avatarUrl}
                          name={slot.name}
                          className="h-10 w-10 border border-white/10"
                          textClassName="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80"
                          fallbackText="OR"
                        />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{slot.name}</p>
                            <p className="text-[11px] text-white/50">
                              {slot.username ? `@${slot.username}` : "Convidado"}
                              {slot.email ? ` · ${slot.email}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => (isActive ? closeSlotEditor() : openSlotEditor(idx))}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                          >
                            {isActive ? "Fechar" : "Editar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSlots((prev) => {
                                const copy = [...prev];
                                copy[idx] = null;
                                return copy;
                              });
                            }}
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 hover:border-white/30"
                          >
                            Limpar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 text-sm text-white/60">
                        <p>Slot vazio</p>
                        <button
                          type="button"
                          onClick={() => (isActive ? closeSlotEditor() : openSlotEditor(idx))}
                          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                        >
                          {isActive ? "Fechar" : "Adicionar jogador"}
                        </button>
                      </div>
                    )}

                    {isActive && (
                      <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                              Slot {idx + 1}
                            </p>
                            <h3 className="text-base font-semibold text-white">Editar jogador</h3>
                          </div>
                          <button
                            type="button"
                            onClick={closeSlotEditor}
                            className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                          >
                            Fechar
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          {(["user", "guest"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                if (mode === slotMode) return;
                                setSlotMode(mode);
                                if (mode === "guest") {
                                  setSlotDraft((prev) => ({ ...prev, username: "", avatarUrl: null }));
                                }
                                if (mode === "user") {
                                  setSlotDraft((prev) => ({ ...prev, email: "", avatarUrl: null }));
                                }
                              }}
                              className={`rounded-full border px-3 py-1 ${
                                slotMode === mode
                                  ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100"
                                  : "border-white/15 bg-white/5 text-white/60"
                              }`}
                            >
                              {mode === "user" ? "Utilizador ORYA" : "Convidado"}
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm text-white/70">
                            Nome
                            <input
                              value={slotDraft.name}
                              onChange={(e) => setSlotDraft((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="Nome publico"
                              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                            />
                          </label>
                          {slotMode === "guest" && (
                            <label className="text-sm text-white/70">
                              Email (para reclamar)
                              <input
                                value={slotDraft.email}
                                onChange={(e) => setSlotDraft((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="email@dominio.com"
                                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                              />
                            </label>
                          )}
                          {slotMode === "user" && (
                            <label className="text-sm text-white/70">
                              Username
                              <input
                                value={slotDraft.username}
                                onChange={(e) => setSlotDraft((prev) => ({ ...prev, username: e.target.value }))}
                                placeholder="@username"
                                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                              />
                            </label>
                          )}
                        </div>

                        {slotMode === "user" && (
                          <div className="space-y-2">
                            <label className="text-sm text-white/70">
                              Procurar utilizador
                              <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nome ou @username"
                                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                              />
                            </label>
                            {searching && <p className="text-[11px] text-white/50">A procurar...</p>}
                            {!searching && searchTerm && searchResults.length === 0 && (
                              <p className="text-[11px] text-white/50">Sem resultados.</p>
                            )}
                            {searchResults.length > 0 && (
                              <div className="grid gap-2 md:grid-cols-2">
                                {searchResults.map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => applyUserToDraft(user)}
                                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 hover:border-white/30"
                                  >
                                    <Avatar
                                      src={user.avatarUrl}
                                      name={user.fullName || user.username || "Utilizador"}
                                      className="h-8 w-8 border border-white/10"
                                      textClassName="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80"
                                      fallbackText="OR"
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm">{user.fullName || user.username || "Utilizador"}</p>
                                      {user.username && <p className="text-[11px] text-white/50">@{user.username}</p>}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {slotMode === "guest" ? (
                          <div className="space-y-2">
                            <p className="text-sm text-white/70">Avatar</p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60">
                              <label className="cursor-pointer rounded-full border border-white/15 px-3 py-1 hover:border-white/40">
                                {uploadingAvatar ? "A carregar..." : "Carregar"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingAvatar}
                                  onChange={(e) => handleSlotAvatarUpload(e.target.files?.[0] ?? null)}
                                />
                              </label>
                              {slotDraft.avatarUrl && (
                                <button
                                  type="button"
                                  onClick={() => setSlotDraft((prev) => ({ ...prev, avatarUrl: null }))}
                                  className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 hover:border-white/30"
                                >
                                  Remover
                                </button>
                              )}
                              {!slotDraft.avatarUrl && (
                                <span className="text-white/50">Sem upload: iniciais.</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-white/50">Avatar ORYA ou iniciais.</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-white/50">Auto-guardado.</span>
                          <button
                            type="button"
                            onClick={clearSlot}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 hover:border-white/30"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {(participantsMessage || generationMessage) && (
          <p className="text-[12px] text-white/70">
            {participantsMessage || generationMessage}
          </p>
        )}
      </div>

      {showLivePanel && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Live</p>
              <h1 className="text-xl font-semibold text-white">{tournament?.event?.title ?? "Torneio"}</h1>
              <p className="text-white/70 text-sm">Formato: {tournament.format}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
              <p>Jogos: {flatMatches.length}</p>
              <p>Pendentes {summary.pending} · Em jogo {summary.inProgress} · Terminados {summary.done}</p>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
              <p className="font-semibold">Avisos</p>
              <ul className="list-disc pl-4 space-y-1">
                {warnings.map((w: any, idx: number) => (
                  <li key={`${w.type}-${w.matchId ?? w.pairingId}-${idx}`}>
                    {w.type === "REQUIRES_ACTION" && <>Jogador #{w.pairingId} exige ação</>}
                    {w.type === "MISSING_COURT" && <>Jogo #{w.matchId}: sem court</>}
                    {w.type === "MISSING_START" && <>Jogo #{w.matchId}: sem horário definido</>}
                    {w.type === "INVALID_SCORE" && <>Jogo #{w.matchId}: score inválido</>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {stages.map((stage: any) => (
            <div key={stage.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                    {stage.name || stage.stageType}
                  </p>
                  <p className="text-white/75 text-sm">{stage.matches.length} jogos</p>
                </div>
                <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70">
                  {stage.stageType}
                </div>
              </div>

              {stage.groups.length > 0 && (
                <div className="space-y-2">
                  {stage.groups.map((group: any) => (
                    <div key={group.id} className="rounded-lg border border-white/10 bg-black/40 p-2">
                      <p className="text-[12px] text-white/70 mb-1">{group.name}</p>
                      <div className="space-y-1">
                        {group.standings.map((row: any, idx: number) => (
                          <div key={row.pairingId ?? idx} className="flex items-center justify-between text-[12px] text-white/80">
                            <span>
                              #{idx + 1} · Jogador {row.pairingId ?? "—"}
                            </span>
                            <span>{row.points} pts</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 space-y-1">
                        {group.matches.map((match: any) => (
                          <div
                            key={match.id}
                            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/75"
                          >
                            <div className="flex items-center justify-between">
                              <span>Jogo #{match.id}</span>
                              <span>{match.statusLabel}</span>
                            </div>
                            <div className="text-white/60">
                              {match.pairing1Id ?? "—"} vs {match.pairing2Id ?? "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {stage.matches.length > 0 && (
                <div className="space-y-1">
                  {stage.matches.map((match: any) => (
                    <div
                      key={match.id}
                      className="rounded border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75"
                    >
                      <div className="flex items-center justify-between">
                        <span>Jogo #{match.id}</span>
                        <span>{match.statusLabel}</span>
                      </div>
                      <div className="text-white/60">
                        {match.pairing1Id ?? "—"} vs {match.pairing2Id ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrganizationTournamentLivePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const tournamentId = Number(resolvedParams.id);
  const router = useRouter();
  const isValidTournamentId = Number.isFinite(tournamentId);
  const { data } = useSWR(
    isValidTournamentId ? `/api/organizacao/tournaments/${tournamentId}/live` : null,
    fetcher,
  );

  useEffect(() => {
    const event = data?.tournament?.event ?? null;
    const eventId = event?.id;
    if (Number.isFinite(eventId)) {
      const basePath = event?.templateType === "PADEL" ? "/organizacao/padel/torneios" : "/organizacao/eventos";
      router.replace(`${basePath}/${eventId}/live?tab=bracket`);
    }
  }, [data?.tournament?.event, router]);

  return (
    <div className="p-4 text-white/70">
      A redirecionar para a preparação do evento...
    </div>
  );
}
