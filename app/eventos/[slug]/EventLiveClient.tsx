"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LiveHubModule, LiveHubViewerRole } from "@/lib/liveHubConfig";
import { DEFAULT_GUEST_AVATAR } from "@/lib/avatars";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useUser } from "@/app/hooks/useUser";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const LOCALE = "pt-PT";
const DEFAULT_TIMEZONE = "Europe/Lisbon";

type PairingMeta = {
  id: number;
  label: string;
  subLabel?: string | null;
  avatarUrl?: string | null;
  profileUsername?: string | null;
  href?: string | null;
};

type EventPayload = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  templateType?: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  locationName: string;
  locationCity: string | null;
  coverImageUrl: string | null;
  liveStreamUrl: string | null;
  liveHubMode: "DEFAULT" | "PREMIUM";
  timezone?: string | null;
};

type MatchPayload = {
  id: number;
  stageId: number;
  groupId?: number | null;
  pairing1Id?: number | null;
  pairing2Id?: number | null;
  courtId?: number | null;
  round?: number | null;
  roundLabel?: string | null;
  startAt?: string | null;
  status: string;
  statusLabel: string;
  score?: { sets?: Array<{ a: number; b: number }>; goals?: { a: number; b: number; limit?: number } } | null;
  updatedAt?: string | null;
};

type SponsorSlot = {
  label?: string | null;
  logoUrl?: string | null;
  url?: string | null;
};

type SponsorsConfig = {
  hero?: SponsorSlot | null;
  sideA?: SponsorSlot | null;
  sideB?: SponsorSlot | null;
} | null;

type GoalLimitsConfig = {
  defaultLimit?: number | null;
  roundLimits?: Record<string, number> | null;
} | null;

function formatDateRange(start?: string, end?: string, timeZone: string = DEFAULT_TIMEZONE) {
  if (!start) return "";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const day = startDate.toLocaleDateString(LOCALE, { day: "2-digit", month: "long", timeZone });
  const time = startDate.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone });
  if (!endDate) return `${day} · ${time}`;
  const endTime = endDate.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day} · ${time} - ${endTime}`;
}

function formatTime(value?: string | null, timeZone: string = DEFAULT_TIMEZONE) {
  if (!value) return "Por definir";
  return new Date(value).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone });
}

function formatCountdown(start?: string, nowMs?: number) {
  if (!start || !nowMs) return null;
  const diff = new Date(start).getTime() - nowMs;
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function getEventStatusLabel(start?: string, end?: string) {
  if (!start) return "Por anunciar";
  const now = new Date();
  const startsAt = new Date(start);
  const endsAt = end ? new Date(end) : null;
  if (now < startsAt) return "Próximo";
  if (endsAt && now > endsAt) return "Concluído";
  return "A decorrer";
}

function escapeIcsText(value?: string | null) {
  if (!value) return "";
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatCalendarDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildCalendarLinks(event: EventPayload, timeZone: string) {
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : startsAt;
  const location = [event.locationName, event.locationCity].filter(Boolean).join(" · ");
  const description = event.description?.trim() || `Evento ${event.title}`;
  const dtStart = formatCalendarDate(startsAt);
  const dtEnd = formatCalendarDate(endsAt);
  const uid = `${event.slug || event.id}@orya`;

  const googleUrl = new URL("https://calendar.google.com/calendar/render");
  googleUrl.searchParams.set("action", "TEMPLATE");
  googleUrl.searchParams.set("text", event.title);
  googleUrl.searchParams.set("dates", `${dtStart}/${dtEnd}`);
  if (description) googleUrl.searchParams.set("details", description);
  if (location) googleUrl.searchParams.set("location", location);
  if (timeZone) googleUrl.searchParams.set("ctz", timeZone);

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ORYA//LiveHub//PT",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const icsUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsLines.join("\n"))}`;
  return { google: googleUrl.toString(), ics: icsUrl };
}

function compareMatchOrder(a: MatchPayload, b: MatchPayload) {
  if (a.startAt && b.startAt) {
    const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (diff !== 0) return diff;
  } else if (a.startAt && !b.startAt) {
    return -1;
  } else if (!a.startAt && b.startAt) {
    return 1;
  }
  const aRound = a.round ?? 0;
  const bRound = b.round ?? 0;
  if (aRound !== bRound) return aRound - bRound;
  return a.id - b.id;
}

function compareBracketOrder(a: MatchPayload, b: MatchPayload) {
  const aRound = a.round ?? 0;
  const bRound = b.round ?? 0;
  if (aRound !== bRound) return aRound - bRound;
  return a.id - b.id;
}

function formatScore(score?: MatchPayload["score"]) {
  if (score?.goals) return `${score.goals.a}-${score.goals.b}`;
  if (score?.sets?.length) return score.sets.map((s) => `${s.a}-${s.b}`).join(" · ");
  return "—";
}

function getScoreSummary(score?: MatchPayload["score"]) {
  if (score?.goals) {
    return { a: score.goals.a, b: score.goals.b };
  }
  if (!score?.sets?.length) return null;
  let a = 0;
  let b = 0;
  score.sets.forEach((s) => {
    if (s.a > s.b) a += 1;
    if (s.b > s.a) b += 1;
  });
  return { a, b };
}

function getWinnerSide(score?: MatchPayload["score"]) {
  if (score?.goals) {
    const limit = score.goals.limit;
    if (!Number.isFinite(limit)) return null;
    if (score.goals.a === limit) return "A";
    if (score.goals.b === limit) return "B";
    return null;
  }
  const summary = getScoreSummary(score);
  if (!summary) return null;
  if (summary.a === summary.b) return null;
  return summary.a > summary.b ? "A" : "B";
}

function buildRoundLabels(totalRounds: number) {
  if (totalRounds <= 1) return ["Final"];
  if (totalRounds === 2) return ["Meias", "Final"];
  if (totalRounds === 3) return ["Quartos", "Meias", "Final"];
  if (totalRounds === 4) return ["Oitavos", "Quartos", "Meias", "Final"];
  if (totalRounds === 5) return ["R32", "Oitavos", "Quartos", "Meias", "Final"];
  return ["R64", "R32", "Oitavos", "Quartos", "Meias", "Final"];
}

function normalizeGoalLimits(input: GoalLimitsConfig): GoalLimitsConfig {
  if (!input) return null;
  const defaultLimit =
    typeof input.defaultLimit === "number" && Number.isFinite(input.defaultLimit) ? input.defaultLimit : null;
  const roundLimitsRaw = input.roundLimits ?? null;
  const roundLimits: Record<string, number> = {};
  if (roundLimitsRaw && typeof roundLimitsRaw === "object") {
    Object.entries(roundLimitsRaw).forEach(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        roundLimits[key] = value;
      }
    });
  }
  return {
    defaultLimit,
    roundLimits: Object.keys(roundLimits).length ? roundLimits : null,
  };
}

function resolveGoalLimit(round: number | null | undefined, limits: GoalLimitsConfig) {
  const normalized = normalizeGoalLimits(limits);
  const fallback = normalized?.defaultLimit ?? 3;
  if (!round || !normalized?.roundLimits) return fallback;
  const roundKey = String(round);
  const roundLimit = normalized.roundLimits[roundKey];
  return Number.isFinite(roundLimit) ? roundLimit : fallback;
}

function getEmbedUrl(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return url;
  } catch {
    return null;
  }
}

function pairingMeta(id: number | null | undefined, pairings: Record<number, PairingMeta>) {
  if (!id) return null;
  return pairings[id] ?? null;
}

function pairingLabelPlain(id: number | null | undefined, pairings: Record<number, PairingMeta>) {
  if (!id) return "TBD";
  return pairings[id]?.label ?? `#${id}`;
}

function renderPairingName(id: number | null | undefined, pairings: Record<number, PairingMeta>, className?: string) {
  if (!id) {
    return <span className={className}>TBD</span>;
  }
  const meta = pairings[id];
  const label = meta?.label ?? `#${id}`;
  const subLabel = meta?.subLabel;
  const avatarUrl = meta?.avatarUrl || DEFAULT_GUEST_AVATAR;
  const content = (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-5 w-5 rounded-full border border-white/10 bg-white/10 bg-cover bg-center"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
      <span>{label}</span>
      {subLabel && <span className="text-[11px] text-white/40">{subLabel}</span>}
    </span>
  );
  if (meta?.href) {
    return (
      <Link href={meta.href} className={className ? `${className} hover:underline` : "hover:underline"}>
        {content}
      </Link>
    );
  }
  return <span className={className}>{content}</span>;
}

function RoleBadge({ role }: { role: LiveHubViewerRole }) {
  const style =
    role === "ORGANIZER"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : role === "PARTICIPANT"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
        : "border-white/15 bg-white/5 text-white/70";
  const label = role === "ORGANIZER" ? "Organizador" : role === "PARTICIPANT" ? "Participante" : "Público";
  return <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${style}`}>{label}</span>;
}

function SponsorsStrip({ organizer }: { organizer: { publicName?: string | null } | null }) {
  const sponsorLabels = organizer?.publicName ? [organizer.publicName] : [];
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {sponsorLabels.length > 0 ? (
            sponsorLabels.map((label) => (
              <span
                key={`sponsor-${label}`}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70"
              >
                {label}
              </span>
            ))
          ) : (
            <span className="text-sm text-white/60">Sponsors em breve</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>Powered by</span>
          <span className="text-white/80">ORYA</span>
        </div>
      </div>
    </section>
  );
}

function MatchCard({
  match,
  pairings,
  highlight,
  timeZone,
  size = "md",
  showCourt,
}: {
  match: MatchPayload;
  pairings: Record<number, PairingMeta>;
  highlight?: boolean;
  timeZone: string;
  size?: "md" | "lg";
  showCourt: boolean;
}) {
  const titleClass = size === "lg" ? "text-base" : "text-sm";
  const metaClass = size === "lg" ? "text-xs" : "text-[11px]";
  const statusClass = size === "lg" ? "text-[11px]" : "text-[11px]";
  const scoreClass = size === "lg" ? "text-sm" : "text-xs";
  const timeLabel = formatTime(match.startAt, timeZone);
  const metaParts = [`Jogo #${match.id}`];
  if (match.round) metaParts.push(`R${match.round}`);
  metaParts.push(timeLabel);
  if (showCourt) {
    metaParts.push(match.courtId ? `Campo ${match.courtId}` : "Campo —");
  }
  return (
    <div
      className={`rounded-xl border px-3 py-2 transition ${
        highlight ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className={`text-white font-medium ${titleClass}`}>
            {renderPairingName(match.pairing1Id, pairings)} <span className="text-white/40">vs</span>{" "}
            {renderPairingName(match.pairing2Id, pairings)}
          </p>
          <p className={`${metaClass} text-white/60`}>
            {metaParts.join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className={`${statusClass} uppercase tracking-[0.18em] text-white/50`}>{match.statusLabel}</p>
          <p className={`text-white/80 ${scoreClass}`}>{formatScore(match.score)}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      <p className="text-white font-semibold">{title}</p>
      <p className="mt-2 text-white/60">{children}</p>
    </div>
  );
}

function OrganizerMatchEditor({
  match,
  tournamentId,
  onUpdated,
  goalLimit,
}: {
  match: MatchPayload;
  tournamentId: number;
  onUpdated: () => void;
  goalLimit: number;
}) {
  const [score, setScore] = useState(() => ({
    a: match.score?.goals?.a ?? 0,
    b: match.score?.goals?.b ?? 0,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScore({ a: match.score?.goals?.a ?? 0, b: match.score?.goals?.b ?? 0 });
  }, [match.id, match.updatedAt, match.score?.goals?.a, match.score?.goals?.b]);

  const clampScore = (value: number) => Math.max(0, Math.min(goalLimit, value));

  const pushScore = async (nextA: number, nextB: number) => {
    if (!match.updatedAt) {
      setError("Sem versão do jogo.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: { goals: { a: nextA, b: nextB, limit: goalLimit } },
        expectedUpdatedAt: match.updatedAt,
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!json?.ok) {
      setError(json?.error || "Falha ao guardar resultado.");
      return;
    }
    setScore({ a: nextA, b: nextB });
    onUpdated();
  };

  const adjust = (side: "A" | "B", delta: number) => {
    if (saving) return;
    const nextA = clampScore(side === "A" ? score.a + delta : score.a);
    const nextB = clampScore(side === "B" ? score.b + delta : score.b);
    if (nextA === score.a && nextB === score.b) return;
    pushScore(nextA, nextB);
  };

  const overrideWinner = async (side: "A" | "B") => {
    if (saving) return;
    if (!match.updatedAt) {
      setError("Sem versão do jogo.");
      return;
    }
    const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
    if (!pairingId) {
      setError("Sem jogador atribuído.");
      return;
    }
    const confirmed = window.confirm("Confirmar override manual? Isto vai marcar o jogo como terminado.");
    if (!confirmed) return;
    const nextA = side === "A" ? goalLimit : 0;
    const nextB = side === "B" ? goalLimit : 0;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organizador/tournaments/${tournamentId}/matches/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: { goals: { a: nextA, b: nextB, limit: goalLimit } },
        winnerPairingId: pairingId,
        status: "DONE",
        expectedUpdatedAt: match.updatedAt,
        force: true,
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!json?.ok) {
      setError(json?.error || "Falha ao aplicar override.");
      return;
    }
    setScore({ a: nextA, b: nextB });
    onUpdated();
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm">Golos (limite {goalLimit})</span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{match.statusLabel}</span>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-white/70">
        {(["A", "B"] as const).map((side) => {
          const value = side === "A" ? score.a : score.b;
          const finished = score.a === goalLimit || score.b === goalLimit;
          return (
            <div key={`${match.id}-score-${side}`} className="flex items-center justify-between gap-2">
              <span className="text-white/60">{side === "A" ? "Jogador A" : "Jogador B"}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving || value <= 0}
                  onClick={() => adjust(side, -1)}
                  className="h-7 w-7 rounded-full border border-white/15 text-white/70 hover:border-white/40 disabled:opacity-50"
                >
                  −
                </button>
                <span className="min-w-[24px] text-center text-sm text-white">{value}</span>
                <button
                  type="button"
                  disabled={saving || value >= goalLimit || finished}
                  onClick={() => adjust(side, 1)}
                  className="h-7 w-7 rounded-full border border-white/15 text-white/70 hover:border-white/40 disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
      <details className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
        <summary className="cursor-pointer uppercase tracking-[0.18em] text-[11px]">
          Override manual
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-amber-100/80">Usa só em casos excecionais.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !match.pairing1Id}
              onClick={() => overrideWinner("A")}
              className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
            >
              Forçar {match.pairing1Id ? `Dupla #${match.pairing1Id}` : "Jogador A"}
            </button>
            <button
              type="button"
              disabled={saving || !match.pairing2Id}
              onClick={() => overrideWinner("B")}
              className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
            >
              Forçar {match.pairing2Id ? `Dupla #${match.pairing2Id}` : "Jogador B"}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

function LiveHubTv({
  event,
  tournament,
  pairings,
  timeZone,
  showCourt,
}: {
  event: EventPayload;
  tournament: any;
  pairings: Record<number, PairingMeta>;
  timeZone: string;
  showCourt: boolean;
}) {
  const matches = tournament.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)]);

  const upcoming = matches
    .filter((m: MatchPayload) => m.status !== "DONE" && m.status !== "IN_PROGRESS" && m.status !== "LIVE")
    .sort((a: MatchPayload, b: MatchPayload) => {
      if (a.startAt && b.startAt) {
        const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        if (diff !== 0) return diff;
      }
      if (showCourt) {
        const aCourt = a.courtId ?? 9999;
        const bCourt = b.courtId ?? 9999;
        return aCourt - bCourt;
      }
      return 0;
    })
    .slice(0, 8);

  const live = matches.filter((m: MatchPayload) => m.status === "IN_PROGRESS" || m.status === "LIVE").slice(0, 6);
  const playoffStage =
    tournament.stages.find((s: any) => s.stageType === "PLAYOFF" && s.matches?.length) ??
    tournament.stages.find((s: any) => s.matches?.length) ??
    tournament.stages[0];
  const tvBracketMatches = playoffStage?.matches?.slice(0, 8) ?? [];
  const tvGroupStages = tournament.stages.filter((s: any) => (s.groups ?? []).length > 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">Modo TV</p>
          <h1 className="text-4xl font-semibold text-white">{event.title}</h1>
          <p className="text-white/60">{formatDateRange(event.startsAt, event.endsAt, timeZone)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
          Atualiza automaticamente
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Agora a jogar</h2>
            <span className="text-white/60 text-sm">{live.length} ativos</span>
          </div>
          {live.length === 0 && <p className="text-white/60">Sem jogos em curso.</p>}
          {live.map((m: MatchPayload) => (
            <MatchCard key={`live-${m.id}`} match={m} pairings={pairings} timeZone={timeZone} size="lg" showCourt={showCourt} />
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Próximos jogos</h2>
            <span className="text-white/60 text-sm">{upcoming.length} agendados</span>
          </div>
          {upcoming.length === 0 && <p className="text-white/60">Sem jogos agendados.</p>}
          {upcoming.map((m: MatchPayload) => (
            <MatchCard key={`up-${m.id}`} match={m} pairings={pairings} timeZone={timeZone} size="lg" showCourt={showCourt} />
          ))}
        </section>
      </div>

      {tvBracketMatches.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Bracket</h2>
            <span className="text-white/60 text-sm">{tvBracketMatches.length} jogos</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tvBracketMatches.map((match: MatchPayload) => (
              <MatchCard key={`tv-bracket-${match.id}`} match={match} pairings={pairings} timeZone={timeZone} size="lg" showCourt={showCourt} />
            ))}
          </div>
        </section>
      )}
      {tvBracketMatches.length === 0 && tvGroupStages.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tabela</h2>
            <span className="text-white/60 text-sm">Classificações</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {tvGroupStages.map((stage: any) =>
              stage.groups.map((group: any) => (
                <div key={`tv-group-${group.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">{group.name || "Grupo"}</h3>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {(group.standings ?? []).length === 0 && (
                      <p className="text-white/60">Sem classificação disponível.</p>
                    )}
                    {(group.standings ?? []).map((row: any, idx: number) => (
                      <div key={`tv-group-${group.id}-${row.pairingId}`} className="flex items-center justify-between text-white/80">
                        <div className="flex items-center gap-3">
                          <span className="text-white/50">{idx + 1}</span>
                          {renderPairingName(row.pairingId, pairings)}
                        </div>
                        <span className="text-white/50">{row.wins}-{row.losses}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function BracketRoundsView({
  matches,
  pairings,
  isOrganizerEdit,
  tournamentId,
  onUpdated,
  goalLimits,
  highlightPairingId,
  view = "split",
}: {
  matches: MatchPayload[];
  pairings: Record<number, PairingMeta>;
  isOrganizerEdit: boolean;
  tournamentId: number | null;
  onUpdated: () => void;
  goalLimits: GoalLimitsConfig;
  highlightPairingId?: number | null;
  view?: "split" | "full";
}) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});

  const matchesByRound = matches.reduce((acc: Record<number, MatchPayload[]>, match: MatchPayload) => {
    const round = match.round ?? 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});
  const rounds = Object.keys(matchesByRound)
    .map((r) => Number(r))
    .sort((a, b) => a - b);
  const roundLabels = buildRoundLabels(rounds.length);
  const treeCount = Math.min(3, rounds.length);
  const treeRounds = rounds.slice(-treeCount);
  const earlyRounds = rounds.slice(0, -treeCount);
  const desktopTreeRounds = treeRounds;
  const mobileTreeRounds = treeRounds.slice(-Math.min(2, treeRounds.length));
  const mobileEarlyRounds = rounds.slice(0, rounds.length - mobileTreeRounds.length);

  const renderRow = (side: "A" | "B", match: MatchPayload, winnerSide: "A" | "B" | null, summary: { a: number; b: number } | null) => {
    const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
    const isWinner = winnerSide === side;
    const isLoser = winnerSide && winnerSide !== side;
    const tone = isWinner
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : isLoser
        ? "border-rose-400/30 bg-rose-500/10 text-rose-100 opacity-60"
        : "border-white/10 bg-white/5 text-white/80";
    const score = summary ? (side === "A" ? summary.a : summary.b) : null;
    return (
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${tone}`}>
        <div className="min-w-0 text-sm">{renderPairingName(pairingId, pairings, "truncate")}</div>
        <span className="text-sm font-semibold">{score !== null ? score : "—"}</span>
      </div>
    );
  };

  const renderListMatch = (match: MatchPayload) => {
    const summary = getScoreSummary(match.score);
    const winnerSide = match.status === "DONE" ? getWinnerSide(match.score) : null;
    const pending =
      match.status === "PENDING" &&
      (!summary || (match.score?.goals && summary.a === 0 && summary.b === 0));
    const isHighlighted =
      typeof highlightPairingId === "number" &&
      (match.pairing1Id === highlightPairingId || match.pairing2Id === highlightPairingId);
    const wrapperTone = isHighlighted
      ? "border-emerald-400/50 bg-emerald-500/10"
      : "border-white/10 bg-black/30";
    return (
      <div key={`list-${match.id}`} className={`rounded-2xl border ${wrapperTone} p-3 space-y-2`}>
        {renderRow("A", match, winnerSide, summary)}
        {renderRow("B", match, winnerSide, summary)}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/50">
          <span>{match.statusLabel}</span>
          {match.round ? <span>R{match.round}</span> : null}
        </div>
        {pending && (
          <div className="h-1 w-full rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-fuchsia-400/40 via-sky-400/40 to-emerald-400/40" />
          </div>
        )}
        {isOrganizerEdit && tournamentId && (
          <div className="pt-1">
            <OrganizerMatchEditor
              match={match}
              tournamentId={tournamentId}
              onUpdated={onUpdated}
              goalLimit={resolveGoalLimit(match.round ?? null, goalLimits)}
            />
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (!selectedRound && earlyRounds.length > 0) {
      setSelectedRound(earlyRounds[0]);
    }
  }, [selectedRound, earlyRounds.join(",")]);

  if (view === "full") {
    return (
      <div className="space-y-4">
        {rounds.map((round, idx) => (
          <div key={`full-round-${round}`} className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              {roundLabels[idx] || `Ronda ${round}`}
            </p>
            {(matchesByRound[round] ?? [])
              .slice()
              .sort((a, b) => a.id - b.id)
              .map(renderListMatch)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
      <div className="space-y-4">
        {earlyRounds.length > 0 && (
          <div className="hidden md:block space-y-3">
            <div className="flex flex-wrap gap-2">
              {earlyRounds.map((round, idx) => (
                <button
                  key={`tab-${round}`}
                  type="button"
                  onClick={() => setSelectedRound(round)}
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                    selectedRound === round
                      ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-100"
                      : "border-white/15 bg-white/5 text-white/60"
                  }`}
                >
                  {roundLabels[idx] || `Ronda ${round}`}
                </button>
              ))}
            </div>
            {selectedRound && (
              <div className="space-y-3">
                {(matchesByRound[selectedRound] ?? [])
                  .slice()
                  .sort((a, b) => a.id - b.id)
                  .map(renderListMatch)}
              </div>
            )}
          </div>
        )}

        {mobileEarlyRounds.length > 0 && (
          <div className="space-y-3 md:hidden">
            {mobileEarlyRounds.map((round, idx) => {
              const isOpen = Boolean(openRounds[round]);
              return (
                <div key={`accordion-${round}`} className="rounded-2xl border border-white/10 bg-black/30">
                  <button
                    type="button"
                    onClick={() => setOpenRounds((prev) => ({ ...prev, [round]: !isOpen }))}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-white/70"
                  >
                    <span>{roundLabels[idx] || `Ronda ${round}`}</span>
                    <span>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 px-4 pb-4">
                      {(matchesByRound[round] ?? [])
                        .slice()
                        .sort((a, b) => a.id - b.id)
                        .map(renderListMatch)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: `repeat(${desktopTreeRounds.length}, minmax(0, 1fr))` }}>
          {desktopTreeRounds.map((round, idx) => {
            const label = roundLabels[rounds.length - desktopTreeRounds.length + idx] || `Ronda ${round}`;
            const matches = (matchesByRound[round] ?? []).slice().sort((a, b) => a.id - b.id);
            return (
              <div key={`tree-${round}`} className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">{label}</p>
                {matches.map(renderListMatch)}
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:hidden" style={{ gridTemplateColumns: `repeat(${mobileTreeRounds.length}, minmax(0, 1fr))` }}>
          {mobileTreeRounds.map((round, idx) => {
            const label = roundLabels[rounds.length - mobileTreeRounds.length + idx] || `Ronda ${round}`;
            const matches = (matchesByRound[round] ?? []).slice().sort((a, b) => a.id - b.id);
            return (
              <div key={`tree-mobile-${round}`} className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">{label}</p>
                {matches.map(renderListMatch)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OneVOneBracket({
  stage,
  pairings,
  eventStatus,
  isOrganizerEdit,
  tournamentId,
  onUpdated,
  goalLimits,
}: {
  stage: { matches?: MatchPayload[]; name?: string | null } | null;
  pairings: Record<number, PairingMeta>;
  eventStatus: string;
  isOrganizerEdit: boolean;
  tournamentId: number | null;
  onUpdated: () => void;
  goalLimits: GoalLimitsConfig;
}) {
  if (!stage || !stage.matches || stage.matches.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/70">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Bracket</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Chave em preparação</h2>
        <p className="text-sm text-white/60">Em breve os jogos vão aparecer aqui.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Bracket</p>
          <h2 className="text-xl font-semibold text-white">{stage.name || "Eliminatórias 1v1"}</h2>
        </div>
        <span className="text-xs text-white/50">{eventStatus === "Próximo" ? "Pré-evento" : "Ao vivo"}</span>
      </div>
      <BracketRoundsView
        matches={stage.matches}
        pairings={pairings}
        isOrganizerEdit={isOrganizerEdit}
        tournamentId={tournamentId}
        onUpdated={onUpdated}
        goalLimits={goalLimits}
      />
    </section>
  );
}

function OneVOneLiveLayout({
  event,
  organizer,
  tournament,
  pairings,
  timeZone,
  eventStatus,
  countdownLabel,
  nowMatch,
  championLabel,
  sponsors,
  onToggleFollow,
  followPending,
  isFollowing,
  showSponsors,
  isOrganizerEdit,
  onRefresh,
}: {
  event: EventPayload;
  organizer: { id: number; publicName: string; username: string | null; brandingAvatarUrl: string | null } | null;
  tournament: any;
  pairings: Record<number, PairingMeta>;
  timeZone: string;
  eventStatus: string;
  countdownLabel: string | null;
  nowMatch: MatchPayload | null;
  championLabel: string | null;
  sponsors: SponsorsConfig;
  onToggleFollow: () => void;
  followPending: boolean;
  isFollowing: boolean;
  showSponsors: boolean;
  isOrganizerEdit: boolean;
  onRefresh: () => void;
}) {
  const embedUrl = getEmbedUrl(event.liveStreamUrl);
  const [streamUrl, setStreamUrl] = useState(event.liveStreamUrl ?? "");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [sponsorDraft, setSponsorDraft] = useState<SponsorsConfig>(sponsors ?? {});
  const [goalLimitsDraft, setGoalLimitsDraft] = useState<GoalLimitsConfig>(
    normalizeGoalLimits(tournament?.goalLimits as GoalLimitsConfig),
  );
  const [activeTab, setActiveTab] = useState<"chat" | "stats" | "rules">("chat");
  const bracketStage =
    tournament?.stages?.find((s: any) => s.stageType === "PLAYOFF" && s.matches?.length) ??
    tournament?.stages?.find((s: any) => s.matches?.length) ??
    null;
  const firstRoundMatches = bracketStage?.matches?.filter((m: MatchPayload) => (m.round ?? 0) === 1) ?? [];
  const playerCount = firstRoundMatches.length ? firstRoundMatches.length * 2 : null;
  const locationLabel = [event.locationCity, event.locationName].filter(Boolean).join(" · ");

  const nowLabel = nowMatch
    ? `${pairingLabelPlain(nowMatch.pairing1Id, pairings)} vs ${pairingLabelPlain(nowMatch.pairing2Id, pairings)}`
    : null;
  const scoreLabel = nowMatch ? formatScore(nowMatch.score) : null;
  const heroStatus =
    eventStatus === "A decorrer"
      ? `Ao vivo${nowLabel ? ` · Jogo atual: ${nowLabel}${scoreLabel && scoreLabel !== "—" ? ` (${scoreLabel})` : ""}` : ""}`
      : eventStatus === "Concluído"
        ? championLabel
          ? `Concluído · Campeão: ${championLabel}`
          : "Concluído"
        : "A live começa em breve";

  const hasHeroSponsor = Boolean(sponsors?.hero?.logoUrl || sponsors?.hero?.label);
  const sideSponsors = [sponsors?.sideA, sponsors?.sideB].filter(
    (slot) => slot && (slot.logoUrl || slot.label),
  ) as SponsorSlot[];
  const goalLimits = normalizeGoalLimits(tournament?.goalLimits as GoalLimitsConfig);
  const goalDefaultLimit = goalLimits?.defaultLimit ?? 3;
  const goalRoundOverrides = goalLimits?.roundLimits ?? null;
  const roundNumbers = bracketStage?.matches
    ? Array.from(new Set(bracketStage.matches.map((m: MatchPayload) => m.round ?? 0))).filter((r) => r > 0).sort((a, b) => a - b)
    : [];
  const roundLabels = buildRoundLabels(roundNumbers.length);
  const roundLabelMap = roundNumbers.reduce((acc, round, idx) => {
    acc[round] = roundLabels[idx] || `Ronda ${round}`;
    return acc;
  }, {} as Record<number, string>);

  useEffect(() => {
    setStreamUrl(event.liveStreamUrl ?? "");
  }, [event.liveStreamUrl]);

  useEffect(() => {
    setSponsorDraft(sponsors ?? {});
  }, [sponsors]);

  useEffect(() => {
    setGoalLimitsDraft(normalizeGoalLimits(tournament?.goalLimits as GoalLimitsConfig));
  }, [tournament?.goalLimits]);

  const saveLiveConfig = async () => {
    setSavingConfig(true);
    setConfigMessage(null);
    try {
      if (streamUrl.trim() !== (event.liveStreamUrl ?? "")) {
        await fetch("/api/organizador/events/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            liveStreamUrl: streamUrl.trim() || null,
          }),
        });
      }
      if (tournament?.id) {
        await fetch(`/api/organizador/tournaments/${tournament.id}/sponsors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hero: sponsorDraft?.hero ?? null,
            sideA: sponsorDraft?.sideA ?? null,
            sideB: sponsorDraft?.sideB ?? null,
          }),
        });
        await fetch(`/api/organizador/tournaments/${tournament.id}/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultLimit: goalLimitsDraft?.defaultLimit ?? null,
            roundLimits: goalLimitsDraft?.roundLimits ?? {},
          }),
        });
      }
      setConfigMessage("Configuração guardada.");
      onRefresh();
    } catch {
      setConfigMessage("Erro ao guardar configuração.");
    } finally {
      setSavingConfig(false);
      setTimeout(() => setConfigMessage(null), 2000);
    }
  };

  const updateDefaultLimit = (value: string) => {
    const next = value === "" ? null : Number(value);
    if (value !== "" && !Number.isFinite(next)) return;
    setGoalLimitsDraft((prev) => ({
      ...(prev ?? {}),
      defaultLimit: next,
      roundLimits: prev?.roundLimits ?? null,
    }));
  };

  const updateRoundLimit = (round: number, value: string) => {
    const next = value === "" ? null : Number(value);
    if (value !== "" && !Number.isFinite(next)) return;
    setGoalLimitsDraft((prev) => {
      const roundLimits = { ...(prev?.roundLimits ?? {}) };
      if (next === null) {
        delete roundLimits[String(round)];
      } else {
        roundLimits[String(round)] = next;
      }
      return {
        ...(prev ?? {}),
        roundLimits: Object.keys(roundLimits).length ? roundLimits : null,
      };
    });
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_55%),linear-gradient(135deg,rgba(6,8,20,0.9),rgba(15,18,35,0.8))] p-6 text-center">
        <p className="text-[12px] uppercase tracking-[0.45em] text-white/50">Live</p>
        <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">{event.title} — Live</h1>
        <p className="mt-2 text-sm text-white/60">
          {locationLabel}
          {playerCount ? ` · ${playerCount} jogadores` : ""}
          {" · Eliminatórias 1v1"}
        </p>
        <p className="mt-2 text-sm text-white/70">{heroStatus}</p>
        {eventStatus === "Próximo" && countdownLabel && (
          <div className="mx-auto mt-4 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">O evento começa em</span>
            <span className="text-lg font-semibold text-white">{countdownLabel}</span>
          </div>
        )}
      </header>

      <OneVOneBracket
        stage={bracketStage}
        pairings={pairings}
        eventStatus={eventStatus}
        isOrganizerEdit={isOrganizerEdit}
        tournamentId={tournament?.id ?? null}
        onUpdated={onRefresh}
        goalLimits={tournament?.goalLimits as GoalLimitsConfig}
      />

      {hasHeroSponsor && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <a
            href={sponsors?.hero?.url || undefined}
            target={sponsors?.hero?.url ? "_blank" : undefined}
            rel={sponsors?.hero?.url ? "noreferrer" : undefined}
            className="flex items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Sponsor principal</p>
              {sponsors?.hero?.label && <p className="text-white/80">{sponsors.hero.label}</p>}
            </div>
            {sponsors?.hero?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sponsors.hero.logoUrl}
                alt={sponsors.hero.label || "Sponsor"}
                className="h-10 w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 object-contain"
              />
            )}
          </a>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Live stream</p>
              <h2 className="text-lg font-semibold text-white">{embedUrl ? "Em direto" : "Live em breve"}</h2>
            </div>
            {eventStatus === "A decorrer" && (
              <span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-200">
                Live
              </span>
            )}
          </div>
          {embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              <iframe
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                title="Live stream"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/70">
              A live vai começar em breve. Assim que o link estiver ativo aparece aqui.
            </div>
          )}
          {!embedUrl && organizer && (
            <button
              type="button"
              disabled={followPending}
              onClick={onToggleFollow}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60"
            >
              {followPending ? "A atualizar…" : isFollowing ? "A seguir" : "Segue para receber notificação"}
            </button>
          )}
          <div className="flex items-center gap-2 pt-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
            {(["chat", "stats", "rules"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full border px-3 py-1 ${
                  activeTab === tab
                    ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100"
                    : "border-white/15 bg-white/5 text-white/60"
                }`}
              >
                {tab === "chat" ? "Chat" : tab === "stats" ? "Stats" : "Regras"}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            {activeTab === "chat" && "Chat disponível em breve."}
            {activeTab === "stats" && "Stats do torneio em breve."}
            {activeTab === "rules" && (
              <ul className="space-y-1 text-sm text-white/70">
                <li>Jogo a eliminar direto (1v1).</li>
                <li>Vence quem chega primeiro ao limite de golos.</li>
                <li>Limite padrão: {goalDefaultLimit} golos.</li>
                {goalRoundOverrides && (
                  <li>Existem limites por ronda configurados pelo organizador.</li>
                )}
                <li>Fair play obrigatório.</li>
                <li>Decisões do staff são finais.</li>
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Agora a jogar</h3>
              <span className="text-xs text-white/50">{nowMatch ? "1 em destaque" : "Sem destaque"}</span>
            </div>
            {!nowMatch && <p className="text-sm text-white/60">Sem jogos em curso.</p>}
            {nowMatch && (
              <div className="space-y-2">
                <MatchCard match={nowMatch} pairings={pairings} timeZone={timeZone} highlight showCourt={false} />
              </div>
            )}
          </section>

          {sideSponsors.length > 0 && (
            <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-2 md:grid-cols-2">
                {sideSponsors.map((slot, idx) => (
                  <a
                    key={`side-sponsor-${idx}`}
                    href={slot.url || undefined}
                    target={slot.url ? "_blank" : undefined}
                    rel={slot.url ? "noreferrer" : undefined}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
                  >
                    {slot.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slot.logoUrl} alt={slot.label || "Sponsor"} className="h-8 w-auto object-contain" />
                    )}
                    {slot.label && <span>{slot.label}</span>}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {showSponsors && !hasHeroSponsor && sideSponsors.length === 0 && <SponsorsStrip organizer={organizer} />}

      {isOrganizerEdit && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Live Ops (overlay)</h3>
            <span className="text-xs text-white/50">Organizador</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-white/70">URL da livestream</label>
              <input
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
              {streamUrl && (
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/60 hover:text-white"
                >
                  Testar embed ↗
                </a>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Sponsor principal</label>
              <input
                value={sponsorDraft?.hero?.label ?? ""}
                onChange={(e) =>
                  setSponsorDraft((prev) => ({
                    ...(prev ?? {}),
                    hero: { ...(prev?.hero ?? {}), label: e.target.value },
                  }))
                }
                placeholder="Nome do sponsor"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <input
                value={sponsorDraft?.hero?.logoUrl ?? ""}
                onChange={(e) =>
                  setSponsorDraft((prev) => ({
                    ...(prev ?? {}),
                    hero: { ...(prev?.hero ?? {}), logoUrl: e.target.value },
                  }))
                }
                placeholder="URL do logo"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <input
                value={sponsorDraft?.hero?.url ?? ""}
                onChange={(e) =>
                  setSponsorDraft((prev) => ({
                    ...(prev ?? {}),
                    hero: { ...(prev?.hero ?? {}), url: e.target.value },
                  }))
                }
                placeholder="Link (site/Instagram)"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(["sideA", "sideB"] as Array<"sideA" | "sideB">).map((slotKey) => {
              const slot = sponsorDraft?.[slotKey] ?? null;
              return (
                <div key={slotKey} className="space-y-2">
                  <label className="text-sm text-white/70">
                    Sponsor {slotKey === "sideA" ? "secundário A" : "secundário B"}
                  </label>
                  <input
                    value={slot?.label ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        [slotKey]: { ...(slot ?? {}), label: e.target.value },
                      }))
                    }
                    placeholder="Nome"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={slot?.logoUrl ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        [slotKey]: { ...(slot ?? {}), logoUrl: e.target.value },
                      }))
                    }
                    placeholder="URL do logo"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={slot?.url ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        [slotKey]: { ...(slot ?? {}), url: e.target.value },
                      }))
                    }
                    placeholder="Link (site/Instagram)"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Regras de golos</p>
              <h4 className="text-sm font-semibold text-white">Limite por ronda</h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-white/70">
                <span>Limite padrão</span>
                <input
                  type="number"
                  min={1}
                  value={goalLimitsDraft?.defaultLimit ?? ""}
                  onChange={(e) => updateDefaultLimit(e.target.value)}
                  placeholder="Ex: 3"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
              {roundNumbers.map((round) => (
                <label key={`round-limit-${round}`} className="space-y-1 text-sm text-white/70">
                  <span>{roundLabelMap[round] || `Ronda ${round}`}</span>
                  <input
                    type="number"
                    min={1}
                    value={goalLimitsDraft?.roundLimits?.[String(round)] ?? ""}
                    onChange={(e) => updateRoundLimit(round, e.target.value)}
                    placeholder={`${goalDefaultLimit}`}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={savingConfig}
              onClick={saveLiveConfig}
              className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60"
            >
              {savingConfig ? "A guardar…" : "Guardar configuração"}
            </button>
            {configMessage && <span className="text-xs text-white/60">{configMessage}</span>}
          </div>
        </section>
      )}
    </div>
  );
}

export default function EventLiveClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isLoggedIn } = useUser();
  const { openModal } = useAuthModal();
  const [showFullBracket, setShowFullBracket] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const isTv = searchParams?.get("tv") === "1";
  const isOrganizerRoute = Boolean(pathname && pathname.startsWith("/organizador/"));
  const [nowMs, setNowMs] = useState(() => Date.now());

  const url = useMemo(() => `/api/livehub/${slug}`, [slug]);
  const { data, error, mutate } = useSWR(url, fetcher, { refreshInterval: 10000 });

  const organizer = (data?.organizer as
    | {
        id: number;
        publicName: string;
        username: string | null;
        brandingAvatarUrl: string | null;
        isFollowed?: boolean;
      }
    | null) ?? null;
  const access = data?.access as
    | {
        liveHubAllowed?: boolean;
        liveHubVisibility?: "PUBLIC" | "PRIVATE" | "DISABLED";
      }
    | undefined;

  useEffect(() => {
    setIsFollowing(Boolean(organizer?.isFollowed));
  }, [organizer?.isFollowed]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return <div className="p-4 text-white/70">Erro a carregar live.</div>;
  }
  if (!data) {
    return <div className="p-4 text-white/70">A carregar…</div>;
  }
  if (!data?.ok) {
    return <div className="p-4 text-white/70">Live indisponível para este evento.</div>;
  }

  const event: EventPayload = data.event;
  const viewerRole: LiveHubViewerRole = data.viewerRole;
  const liveHub = data.liveHub as { modules: LiveHubModule[]; mode: "DEFAULT" | "PREMIUM" };
  const tournament = data.tournament;
  const pairings: Record<number, PairingMeta> = data.pairings || {};
  const pairingIdFromQuery = searchParams?.get("pairingId");
  const showCourt = event.templateType === "PADEL";

  if (access?.liveHubAllowed === false) {
    const visibility = access?.liveHubVisibility ?? "PUBLIC";
    const message =
      visibility === "DISABLED"
        ? "O LiveHub foi desativado pelo organizador."
        : visibility === "PRIVATE"
          ? "O LiveHub está reservado para participantes."
          : "O LiveHub está indisponível.";
    return (
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-white/70 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Acesso reservado</p>
        <h2 className="text-xl font-semibold text-white">Este LiveHub não está disponível agora.</h2>
        <p className="text-sm text-white/60">{message}</p>
      </div>
    );
  }

  const timeZone = event.timezone || DEFAULT_TIMEZONE;

  const ensureAuthForFollow = () => {
    if (isLoggedIn) return true;
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
    openModal({ mode: "login", redirectTo });
    return false;
  };

  const toggleFollow = async () => {
    if (!organizer) return;
    if (!ensureAuthForFollow()) return;
    const next = !isFollowing;
    setFollowPending(true);
    setIsFollowing(next);
    try {
      const res = await fetch(next ? "/api/social/follow-organizer" : "/api/social/unfollow-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: organizer.id }),
      });
      if (!res.ok) {
        setIsFollowing(!next);
      }
    } catch {
      setIsFollowing(!next);
    } finally {
      setFollowPending(false);
    }
  };

  if (isTv && tournament) {
    return <LiveHubTv event={event} tournament={tournament} pairings={pairings} timeZone={timeZone} showCourt={showCourt} />;
  }

  const flatMatches: MatchPayload[] = tournament
    ? tournament.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)])
    : [];

  const liveMatches = flatMatches.filter((m) => m.status === "IN_PROGRESS" || m.status === "LIVE");
  const pendingMatches = flatMatches.filter((m) => m.status !== "DONE" && m.status !== "IN_PROGRESS" && m.status !== "LIVE");
  const defaultNowMatch =
    liveMatches.sort(compareMatchOrder)[0] ?? pendingMatches.sort(compareMatchOrder)[0] ?? null;
  const oneVOneOrderedMatches = flatMatches.slice().sort(compareBracketOrder);
  const oneVOneLiveMatches = oneVOneOrderedMatches.filter((m) => m.status === "IN_PROGRESS" || m.status === "LIVE");
  const oneVOnePendingMatches = oneVOneOrderedMatches.filter(
    (m) => m.status !== "DONE" && m.status !== "IN_PROGRESS" && m.status !== "LIVE",
  );
  const oneVOneNowMatch = oneVOneLiveMatches[0] ?? oneVOnePendingMatches[0] ?? null;
  const isOneVOne = organizer?.id === 23 && liveHub?.mode === "PREMIUM";
  const nowMatch = isOneVOne ? oneVOneNowMatch : defaultNowMatch;

  const upcomingMatches = flatMatches
    .filter((m) => m.status !== "DONE" && m.id !== (nowMatch?.id ?? -1))
    .sort(compareMatchOrder)
    .slice(0, 4);

  const recentResults = flatMatches
    .filter((m) => m.status === "DONE")
    .sort((a, b) =>
      a.updatedAt && b.updatedAt ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : 0,
    )
    .slice(0, 6);

  const modules = liveHub?.modules ?? [];
  const resolvedModules =
    event.liveStreamUrl && !modules.includes("VIDEO") ? ["VIDEO", ...modules] : modules;
  const eventStatus = getEventStatusLabel(event.startsAt, event.endsAt);
  const calendarLinks = event.startsAt ? buildCalendarLinks(event, timeZone) : null;
  const countdownLabel = formatCountdown(event.startsAt, nowMs);
  const sponsors = (tournament?.sponsors as SponsorsConfig) ?? null;
  const championLabel =
    tournament?.championPairingId ? pairingLabelPlain(tournament.championPairingId, pairings) : null;
  const isOrganizerEdit =
    viewerRole === "ORGANIZER" && isOrganizerRoute && searchParams?.get("edit") === "1";
  const organizerEditHref = (() => {
    const base = isOrganizerRoute && pathname ? pathname : `/organizador/eventos/${event.id}/live`;
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", "preview");
    params.set("edit", "1");
    return `${base}?${params.toString()}`;
  })();

  if (isOneVOne) {
    const showSponsors = resolvedModules.includes("SPONSORS");
    return (
      <div className="space-y-6">
        {viewerRole === "ORGANIZER" && isOrganizerRoute && !isOrganizerEdit && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Estás em modo público.{" "}
            <Link href={organizerEditHref} className="text-white underline">
              Ativar overlay do organizador
            </Link>
            .
          </div>
        )}
        <OneVOneLiveLayout
          event={event}
          organizer={organizer}
          tournament={tournament}
          pairings={pairings}
          timeZone={timeZone}
          eventStatus={eventStatus}
          countdownLabel={countdownLabel}
          nowMatch={nowMatch}
          championLabel={championLabel}
          sponsors={sponsors}
          onToggleFollow={toggleFollow}
          followPending={followPending}
          isFollowing={isFollowing}
          showSponsors={showSponsors}
          isOrganizerEdit={isOrganizerEdit}
          onRefresh={() => mutate()}
        />

      </div>
    );
  }

  const renderModule = (mod: LiveHubModule) => {
    switch (mod) {
      case "HERO": {
        const statusTone =
          eventStatus === "A decorrer"
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
            : eventStatus === "Próximo"
              ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
              : eventStatus === "Concluído"
                ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                : "border-white/15 bg-white/5 text-white/70";
        return (
          <section key="hero" className="rounded-3xl border border-white/10 bg-black/40 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">LiveHub</p>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{event.title}</h1>
                <p className="text-white/70 text-sm">{formatDateRange(event.startsAt, event.endsAt, timeZone)}</p>
                {event.locationName && (
                  <p className="text-white/50 text-sm">
                    {event.locationName}{event.locationCity ? ` · ${event.locationCity}` : ""}
                  </p>
                )}
                {eventStatus === "Próximo" && countdownLabel && (
                  <p className="text-sm text-white/60">Começa em {countdownLabel}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={viewerRole} />
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${statusTone}`}>
                  {eventStatus}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Modo automático
                </span>
                {calendarLinks && (
                  <a
                    href={calendarLinks.ics}
                    download={`${event.slug || "evento"}.ics`}
                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70 hover:border-white/40"
                  >
                    Adicionar ao calendário
                  </a>
                )}
              </div>
            </div>

            {organizer && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/10">
                  {organizer.brandingAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={organizer.brandingAvatarUrl} alt="Organizador" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                      {organizer.publicName?.slice(0, 2) ?? "OR"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Organizado por</p>
                  <p className="text-white font-medium">{organizer.publicName}</p>
                  {organizer.username && <p className="text-white/50 text-xs">@{organizer.username}</p>}
                </div>
              </div>
            )}
          </section>
        );
      }
      case "VIDEO": {
        const embedUrl = getEmbedUrl(event.liveStreamUrl);
        if (!embedUrl) {
          return (
            <section key="video" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Live</p>
                <h2 className="text-lg font-semibold text-white">Live stream em breve</h2>
              </div>
              <p className="text-sm text-white/60">
                Ainda não existe uma livestream ativa. Assim que o link estiver disponível, aparece aqui.
              </p>
              {organizer && (
                <button
                  type="button"
                  disabled={followPending}
                  onClick={toggleFollow}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60"
                >
                  {followPending ? "A atualizar…" : isFollowing ? "A seguir" : "Segue para receber notificação"}
                </button>
              )}
            </section>
          );
        }
        return (
          <section key="video" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Live</p>
                <h2 className="text-lg font-semibold text-white">Assistir agora</h2>
              </div>
              <a
                href={event.liveStreamUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
              >
                Abrir no YouTube
              </a>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              <iframe
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                title="Live stream"
              />
            </div>
          </section>
        );
      }
      case "NOW_PLAYING": {
        if (!tournament) return <EmptyCard key="now" title="Agora a jogar" children="Sem torneio associado." />;
        return (
          <section key="now" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Agora a jogar</h2>
              <span className="text-xs text-white/50">{liveMatches.length} em jogo</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {liveMatches.length === 0 && <p className="text-white/60">Sem jogos em curso.</p>}
              {liveMatches.map((match) => (
                <MatchCard key={`now-${match.id}`} match={match} pairings={pairings} timeZone={timeZone} highlight showCourt={showCourt} />
              ))}
            </div>
          </section>
        );
      }
      case "NEXT_MATCHES": {
        if (!tournament) return <EmptyCard key="next" title="Próximos jogos" children="Sem torneio associado." />;
        return (
          <section key="next" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Próximos jogos</h2>
              <span className="text-xs text-white/50">{upcomingMatches.length} previstos</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {upcomingMatches.length === 0 && <p className="text-white/60">Sem jogos agendados.</p>}
              {upcomingMatches.map((match) => {
                const highlight =
                  (pairingIdFromQuery &&
                    (`${match.pairing1Id}` === pairingIdFromQuery || `${match.pairing2Id}` === pairingIdFromQuery)) ||
                  (tournament.userPairingId &&
                    (match.pairing1Id === tournament.userPairingId || match.pairing2Id === tournament.userPairingId));
                return (
                  <MatchCard
                    key={`next-${match.id}`}
                    match={match}
                    pairings={pairings}
                    highlight={highlight}
                    timeZone={timeZone}
                    showCourt={showCourt}
                  />
                );
              })}
            </div>
          </section>
        );
      }
      case "RESULTS": {
        if (!tournament) return <EmptyCard key="results" title="Resultados" children="Sem torneio associado." />;
        return (
          <section key="results" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Resultados recentes</h2>
              <span className="text-xs text-white/50">{recentResults.length} jogos</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recentResults.length === 0 && <p className="text-white/60">Sem resultados registados.</p>}
              {recentResults.map((match) => (
                <MatchCard key={`res-${match.id}`} match={match} pairings={pairings} timeZone={timeZone} showCourt={showCourt} />
              ))}
            </div>
          </section>
        );
      }
      case "BRACKET": {
        if (!tournament) return <EmptyCard key="bracket" title="Bracket" children="Sem torneio associado." />;
        const stages = tournament.stages ?? [];
        const playoffStages = stages.filter((stage: any) => stage.stageType === "PLAYOFF" && stage.matches?.length);
        const bracketStages = playoffStages.length > 0 ? playoffStages : stages.filter((stage: any) => stage.matches?.length);
        const hasBracket = bracketStages.length > 0;
        const hasGroups = stages.some((stage: any) => stage.groups?.length);

        if (hasBracket) {
          const bracketHasEarlyRounds = bracketStages.some((stage: any) => {
            const roundCount = new Set(stage.matches.map((m: MatchPayload) => m.round ?? 0)).size;
            return roundCount > 3;
          });
          const highlightPairingId = (() => {
            if (pairingIdFromQuery) {
              const parsed = Number(pairingIdFromQuery);
              return Number.isFinite(parsed) ? parsed : null;
            }
            return tournament.userPairingId ?? null;
          })();
          return (
            <section key="bracket" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Bracket</p>
                  <h2 className="text-lg font-semibold text-white">Chave completa</h2>
                </div>
                {bracketHasEarlyRounds && (
                  <button
                    type="button"
                    onClick={() => setShowFullBracket((prev) => !prev)}
                    className="hidden md:inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                  >
                    {showFullBracket ? "Mostrar menos" : "Ver bracket completo"}
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {bracketStages.map((stage: any) => {
                  if (!stage.matches.length) return null;
                  return (
                    <div key={stage.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold">{stage.name || "Playoffs"}</h3>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                      </div>
                      <BracketRoundsView
                        matches={stage.matches}
                        pairings={pairings}
                        isOrganizerEdit={isOrganizerEdit}
                        tournamentId={tournament?.id ?? null}
                        onUpdated={onRefresh}
                        goalLimits={goalLimits}
                        highlightPairingId={highlightPairingId}
                        view={showFullBracket ? "full" : "split"}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        }

        if (hasGroups) {
          return (
            <section key="bracket" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Tabela</p>
                <h2 className="text-lg font-semibold text-white">Classificação dos grupos</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {stages.map((stage: any) =>
                  stage.groups?.map((group: any) => (
                    <div key={`group-${group.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold">{group.name || "Grupo"}</h3>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(group.standings ?? []).length === 0 && (
                          <p className="text-sm text-white/60">Sem classificação disponível.</p>
                        )}
                        {(group.standings ?? []).map((row: any, idx: number) => {
                          return (
                            <div key={`group-${group.id}-row-${row.pairingId}`} className="flex items-center justify-between text-sm text-white/80">
                              <div className="flex items-center gap-3">
                                <span className="text-white/50">{idx + 1}</span>
                                {renderPairingName(row.pairingId, pairings)}
                              </div>
                              <span className="text-white/50">{row.wins}-{row.losses}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )),
                )}
              </div>
            </section>
          );
        }

        return <EmptyCard key="bracket" title="Bracket" children="Sem chave definida." />;
      }
      case "CHAMPION": {
        if (!tournament) return <EmptyCard key="champ" title="Campeão" children="Sem torneio associado." />;
        const championId = tournament.championPairingId as number | null;
        const meta = pairingMeta(championId, pairings);
        if (!championId || !meta) {
          return <EmptyCard key="champ" title="Campeão" children="Ainda não existe campeão definido." />;
        }
        return (
          <section key="champ" className="rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,rgba(255,215,120,0.12),rgba(20,20,20,0.8))] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-300/10 text-2xl">
                🏆
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/70">Campeão</p>
                <div className="text-xl font-semibold text-white">
                  {renderPairingName(championId, pairings)}
                </div>
              </div>
            </div>
          </section>
        );
      }
      case "SUMMARY": {
        return (
          <section key="summary" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Resumo</p>
            <h2 className="text-lg font-semibold text-white">Sobre este evento</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              {event.description?.trim() || "Descrição em breve."}
            </p>
          </section>
        );
      }
      case "CTA": {
        const ctaCopy =
          viewerRole === "PUBLIC"
            ? "Queres aparecer como participante? Garante o teu bilhete."
            : "Já tens acesso como participante. Aproveita o LiveHub.";
        const ctaLabel = viewerRole === "PUBLIC" ? "Garantir lugar" : "Ver o meu bilhete";
        return (
          <section key="cta" className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">Participação</p>
                <p className="text-white/80">{ctaCopy}</p>
              </div>
              <Link
                href={`/eventos/${event.slug}`}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
              >
                {ctaLabel}
              </Link>
            </div>
          </section>
        );
      }
      case "SPONSORS": {
        return <SponsorsStrip organizer={organizer} />;
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {resolvedModules.map((mod) => renderModule(mod))}

      {viewerRole === "ORGANIZER" && tournament && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Gestão rápida</h2>
            <span className="text-xs text-white/50">Organizador</span>
          </div>
          <div className="space-y-3">
            {flatMatches
              .filter((m) => m.status !== "DONE")
              .slice(0, 6)
              .map((match) => (
                <div key={`edit-${match.id}`} className="space-y-2">
                  <MatchCard match={match} pairings={pairings} timeZone={timeZone} showCourt={showCourt} />
                  <OrganizerMatchEditor
                    match={match}
                    tournamentId={tournament.id}
                    onUpdated={() => mutate()}
                  />
                </div>
              ))}
            {flatMatches.filter((m) => m.status !== "DONE").length === 0 && (
              <p className="text-white/60">Sem jogos pendentes para editar.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
