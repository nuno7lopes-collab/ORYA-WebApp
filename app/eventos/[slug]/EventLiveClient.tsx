"use client";

import useSWR from "swr";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LiveHubModule, LiveHubViewerRole } from "@/lib/liveHubConfig";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { getTicketCopy } from "@/app/components/checkout/checkoutCopy";
import { useUser } from "@/app/hooks/useUser";
import { Avatar } from "@/components/ui/avatar";
import { formatEventLocationLabel } from "@/lib/location/eventLocation";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { resolveLocale, t } from "@/lib/i18n";
import type { Prisma } from "@prisma/client";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
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
  addressId?: string | null;
  addressRef?: {
    formattedAddress: string | null;
    canonical?: Prisma.JsonValue | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  coverImageUrl: string | null;
  liveStreamUrl: string | null;
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
  nowPlaying?: SponsorSlot | null;
} | null;

type GoalLimitsConfig = {
  defaultLimit?: number | null;
  roundLimits?: Record<string, number> | null;
} | null;

function formatDateRange(start?: string, end?: string, locale: string = "pt-PT", timeZone: string = DEFAULT_TIMEZONE) {
  if (!start) return "";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const day = startDate.toLocaleDateString(locale, { day: "2-digit", month: "long", timeZone });
  const time = startDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  if (!endDate) return `${day} · ${time}`;
  const endTime = endDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day} · ${time} - ${endTime}`;
}

function formatTimeLabel(value: string | null | undefined, locale: string, timeZone: string = DEFAULT_TIMEZONE) {
  if (!value) return t("timeTbd", locale);
  return new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone });
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

type EventStatusKey = "TBD" | "UPCOMING" | "LIVE" | "DONE";

function getEventStatusKey(start: string | undefined, end: string | undefined): EventStatusKey {
  if (!start) return "TBD";
  const now = new Date();
  const startsAt = new Date(start);
  const endsAt = end ? new Date(end) : null;
  if (now < startsAt) return "UPCOMING";
  if (endsAt && now > endsAt) return "DONE";
  return "LIVE";
}

function getEventStatusLabel(status: EventStatusKey, locale: string) {
  if (status === "TBD") return t("eventAnnounced", locale);
  if (status === "UPCOMING") return t("eventUpcoming", locale);
  if (status === "DONE") return t("eventFinished", locale);
  return t("eventLive", locale);
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

function formatPadelSetsText(score?: MatchPayload["score"]) {
  if (!score?.sets?.length) return "";
  return score.sets.map((s) => `${s.a}-${s.b}`).join(", ");
}

function parsePadelSetsText(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((set) => set.split("-").map((entry) => Number(entry.trim())))
    .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([teamA, teamB]) => ({ teamA, teamB }));
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
    if (Number.isFinite(limit)) {
      if (score.goals.a === limit) return "A";
      if (score.goals.b === limit) return "B";
      return null;
    }
    if (score.goals.a === score.goals.b) return null;
    return score.goals.a > score.goals.b ? "A" : "B";
  }
  const summary = getScoreSummary(score);
  if (!summary) return null;
  if (summary.a === summary.b) return null;
  return summary.a > summary.b ? "A" : "B";
}

function resolveBracketAdvancement(matches: MatchPayload[]) {
  const cloned = matches.map((match) => ({ ...match }));
  const matchesByRound = cloned.reduce<Record<number, MatchPayload[]>>((acc, match) => {
    const round = match.round ?? 0;
    if (round <= 0) return acc;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});
  const rounds = Object.keys(matchesByRound)
    .map((round) => Number(round))
    .filter((round) => round > 0)
    .sort((a, b) => a - b);

  for (let idx = 0; idx < rounds.length - 1; idx += 1) {
    const round = rounds[idx];
    const nextRound = rounds[idx + 1];
    const currentMatches = (matchesByRound[round] ?? []).slice().sort(compareBracketOrder);
    const nextMatches = (matchesByRound[nextRound] ?? []).slice().sort(compareBracketOrder);

    currentMatches.forEach((match, matchIdx) => {
      if (match.status !== "DONE") return;
      const winnerSide = getWinnerSide(match.score);
      if (!winnerSide) return;
      const winnerPairingId = winnerSide === "A" ? match.pairing1Id : match.pairing2Id;
      if (!winnerPairingId) return;
      const target = nextMatches[Math.floor(matchIdx / 2)];
      if (!target) return;
      if (matchIdx % 2 === 0) {
        if (!target.pairing1Id) target.pairing1Id = winnerPairingId;
      } else if (!target.pairing2Id) {
        target.pairing2Id = winnerPairingId;
      }
    });
  }

  return cloned;
}

function buildRoundLabels(totalRounds: number, locale?: string | null) {
  const finalLabel = t("roundFinal", locale);
  const semiLabel = t("roundSemifinal", locale);
  const quarterLabel = t("roundQuarterfinal", locale);
  const roundOf16 = t("roundOf16", locale);
  const roundOf32 = t("roundOf32", locale);
  const roundOf64 = t("roundOf64", locale);

  if (totalRounds <= 1) return [finalLabel];
  if (totalRounds === 2) return [semiLabel, finalLabel];
  if (totalRounds === 3) return [quarterLabel, semiLabel, finalLabel];
  if (totalRounds === 4) return [roundOf16, quarterLabel, semiLabel, finalLabel];
  if (totalRounds === 5) return [roundOf32, roundOf16, quarterLabel, semiLabel, finalLabel];
  return [roundOf64, roundOf32, roundOf16, quarterLabel, semiLabel, finalLabel];
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

function getStreamEmbed(url?: string | null) {
  if (!url) return { embedUrl: null, href: null, provider: null };
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parentHost =
      typeof window !== "undefined"
        ? window.location.hostname
        : (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "orya.pt")
            .replace(/^https?:\/\//, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id
        ? { embedUrl: `https://www.youtube.com/embed/${id}`, href: url, provider: "youtube" }
        : { embedUrl: null, href: url, provider: "youtube" };
    }

    if (host.endsWith("youtube.com")) {
      const queryId = parsed.searchParams.get("v");
      if (queryId) {
        return { embedUrl: `https://www.youtube.com/embed/${queryId}`, href: url, provider: "youtube" };
      }
      const parts = parsed.pathname.split("/").filter(Boolean);
      const pathType = parts[0];
      const pathId = parts[1];
      if (pathId && ["live", "embed", "shorts"].includes(pathType)) {
        return { embedUrl: `https://www.youtube.com/embed/${pathId}`, href: url, provider: "youtube" };
      }
      return { embedUrl: null, href: url, provider: "youtube" };
    }

    if (host.endsWith("twitch.tv") || host === "player.twitch.tv") {
      let channel = parsed.searchParams.get("channel");
      let video = parsed.searchParams.get("video");

      if (!channel && !video) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts[0] === "videos" && parts[1]) {
          video = parts[1];
        } else if (parts[0]) {
          channel = parts[0];
        }
      }

      const embedBase = "https://player.twitch.tv/";
      if (channel) {
        return {
          embedUrl: `${embedBase}?channel=${channel}&parent=${parentHost}`,
          href: url,
          provider: "twitch",
        };
      }
      if (video) {
        return {
          embedUrl: `${embedBase}?video=${video}&parent=${parentHost}`,
          href: url,
          provider: "twitch",
        };
      }
      return { embedUrl: null, href: url, provider: "twitch" };
    }

    return { embedUrl: null, href: url, provider: "unknown" };
  } catch {
    return { embedUrl: null, href: url ?? null, provider: null };
  }
}

function pairingMeta(id: number | null | undefined, pairings: Record<number, PairingMeta>) {
  if (!id) return null;
  return pairings[id] ?? null;
}

function pairingLabelPlain(id: number | null | undefined, pairings: Record<number, PairingMeta>) {
  if (!id) return "";
  return pairings[id]?.label ?? "";
}

function renderPairingName(id: number | null | undefined, pairings: Record<number, PairingMeta>, className?: string) {
  if (!id) return <span className={className} />;
  const meta = pairings[id];
  const label = meta?.label ?? `#${id}`;
  const subLabel = meta?.subLabel;
  const content = (
    <span className="inline-flex items-center gap-2">
      <Avatar
        src={meta?.avatarUrl ?? null}
        name={label}
        className="h-5 w-5 border border-white/10"
        textClassName="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/80"
        fallbackText="OR"
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

function RoleBadge({ role, locale }: { role: LiveHubViewerRole; locale: string }) {
  const style =
    role === "ORGANIZATION"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : role === "PARTICIPANT"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
        : "border-white/15 bg-white/5 text-white/70";
  const label =
    role === "ORGANIZATION"
      ? t("roleOrganization", locale)
      : role === "PARTICIPANT"
        ? t("roleParticipant", locale)
        : t("rolePublic", locale);
  return <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${style}`}>{label}</span>;
}

function SponsorsStrip({ organization, locale }: { organization: { publicName?: string | null } | null; locale: string }) {
  const sponsorLabels = organization?.publicName ? [organization.publicName] : [];
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
            <span className="text-sm text-white/60">{t("sponsorsSoon", locale)}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span>{t("poweredBy", locale)}</span>
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
  locale,
  size = "md",
  showCourt,
}: {
  match: MatchPayload;
  pairings: Record<number, PairingMeta>;
  highlight?: boolean;
  timeZone: string;
  locale: string;
  size?: "md" | "lg";
  showCourt: boolean;
}) {
  const titleClass = size === "lg" ? "text-base" : "text-sm";
  const metaClass = size === "lg" ? "text-xs" : "text-[11px]";
  const statusClass = size === "lg" ? "text-[11px]" : "text-[11px]";
  const scoreClass = size === "lg" ? "text-sm" : "text-xs";
  const timeLabel = formatTimeLabel(match.startAt, locale, timeZone);
  const metaParts = [`${t("matchLabel", locale)} #${match.id}`];
  if (match.round) metaParts.push(`R${match.round}`);
  metaParts.push(timeLabel);
  if (showCourt) {
    metaParts.push(match.courtId ? `${t("court", locale)} ${match.courtId}` : `${t("court", locale)} —`);
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

function OrganizationMatchEditor({
  match,
  tournamentId,
  onUpdated,
  goalLimit,
  locked = false,
  lockedReason,
  canResolveDispute = false,
  locale,
}: {
  match: MatchPayload;
  tournamentId: number;
  onUpdated: () => void;
  goalLimit: number;
  locked?: boolean;
  lockedReason?: string | null;
  canResolveDispute?: boolean;
  locale: string;
}) {
  const [score, setScore] = useState(() => ({
    a: match.score?.goals?.a ?? 0,
    b: match.score?.goals?.b ?? 0,
  }));
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [disputePending, setDisputePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pendingScoreRef = useRef<{ a: number; b: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expectedUpdatedAtRef = useRef<string | null>(match.updatedAt ?? null);
  const savingRef = useRef(false);

  useEffect(() => {
    setScore({ a: match.score?.goals?.a ?? 0, b: match.score?.goals?.b ?? 0 });
  }, [match.id, match.updatedAt, match.score?.goals?.a, match.score?.goals?.b]);

  useEffect(() => {
    const next = match.updatedAt ?? null;
    expectedUpdatedAtRef.current = next;
    pendingScoreRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [match.id, match.updatedAt]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const flushPending = () => {
    if (savingRef.current || !pendingScoreRef.current) return;
    const pending = pendingScoreRef.current;
    pendingScoreRef.current = null;
    pushScore(pending.a, pending.b);
  };

  const clampScore = (value: number) => Math.max(0, Math.min(goalLimit, value));

  const pushScore = async (nextA: number, nextB: number) => {
    if (locked) {
      setError(lockedReason || t("matchLocked", locale));
      return;
    }
    const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
    if (!expected) {
      setError(t("matchVersionMissing", locale));
      return;
    }
    setSaving(true);
    savingRef.current = true;
    setError(null);
    const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/matches/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: { goals: { a: nextA, b: nextB, limit: goalLimit } },
        expectedUpdatedAt: expected,
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    savingRef.current = false;
    if (!json?.ok) {
      if (json?.error === "MATCH_CONFLICT") {
        setError(t("matchConflictUpdated", locale));
        onUpdated();
        return;
      }
      setError(json?.error || t("matchSaveError", locale));
      return;
    }
    if (json?.match?.updatedAt) {
      expectedUpdatedAtRef.current = json.match.updatedAt as string;
    }
    if (!pendingScoreRef.current) {
      setScore({ a: nextA, b: nextB });
    }
    onUpdated();
    flushPending();
  };

  const adjust = (side: "A" | "B", delta: number) => {
    if (locked) {
      setError(lockedReason || t("matchLocked", locale));
      return;
    }
    const nextA = clampScore(side === "A" ? score.a + delta : score.a);
    const nextB = clampScore(side === "B" ? score.b + delta : score.b);
    if (nextA === score.a && nextB === score.b) return;
    setScore({ a: nextA, b: nextB });
    pendingScoreRef.current = { a: nextA, b: nextB };
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      flushPending();
    }, 120);
  };


  const overrideWinner = async (side: "A" | "B") => {
    if (saving) return;
    if (locked) {
      setError(lockedReason || t("matchLocked", locale));
      return;
    }
    const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
    if (!expected) {
      setError(t("matchVersionMissing", locale));
      return;
    }
    const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
    if (!pairingId) {
      setError(t("matchPlayerMissing", locale));
      return;
    }
    const confirmed = window.confirm(t("matchOverrideConfirm", locale));
    if (!confirmed) return;
    const nextA = side === "A" ? goalLimit : 0;
    const nextB = side === "B" ? goalLimit : 0;
    setSaving(true);
    savingRef.current = true;
    setError(null);
    const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/matches/${match.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: { goals: { a: nextA, b: nextB, limit: goalLimit } },
        winnerPairingId: pairingId,
        status: "DONE",
        expectedUpdatedAt: expected,
        force: true,
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    savingRef.current = false;
    if (!json?.ok) {
      if (json?.error === "MATCH_CONFLICT") {
        setError(t("matchConflictUpdated", locale));
        onUpdated();
        return;
      }
      setError(json?.error || t("matchOverrideError", locale));
      return;
    }
    if (json?.match?.updatedAt) {
      expectedUpdatedAtRef.current = json.match.updatedAt as string;
    }
    setScore({ a: nextA, b: nextB });
    onUpdated();
  };

  const markDisputed = async () => {
    if (saving || disputePending) return;
    if (locked) {
      setError(lockedReason || t("matchLocked", locale));
      return;
    }
    const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
    if (!expected) {
      setError(t("matchVersionMissing", locale));
      return;
    }
    const confirmed = window.confirm(t("matchDisputeConfirm", locale));
    if (!confirmed) return;
    setDisputePending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/matches/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DISPUTED",
          expectedUpdatedAt: expected,
          force: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchDisputeMarkError", locale));
        return;
      }
      if (json?.match?.updatedAt) {
        expectedUpdatedAtRef.current = json.match.updatedAt as string;
      }
      setInfo(t("matchDisputeMarked", locale));
      onUpdated();
    } finally {
      setDisputePending(false);
    }
  };

  const resolveDispute = async () => {
    if (saving || disputePending) return;
    if (!canResolveDispute) {
      setError(t("matchDisputeAdminOnly", locale));
      return;
    }
    const expected = expectedUpdatedAtRef.current ?? match.updatedAt ?? null;
    if (!expected) {
      setError(t("matchVersionMissing", locale));
      return;
    }
    const confirmed = window.confirm(t("matchDisputeResolveConfirm", locale));
    if (!confirmed) return;
    setDisputePending(true);
    setError(null);
    setInfo(null);
    const nextStatus = score.a > 0 || score.b > 0 ? "IN_PROGRESS" : "PENDING";
    try {
      const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/matches/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          expectedUpdatedAt: expected,
          force: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchDisputeResolveError", locale));
        return;
      }
      if (json?.match?.updatedAt) {
        expectedUpdatedAtRef.current = json.match.updatedAt as string;
      }
      setInfo(t("matchDisputeResolved", locale));
      onUpdated();
    } finally {
      setDisputePending(false);
    }
  };

  const undoLast = async () => {
    if (undoing || saving) return;
    setUndoing(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/organizacao/tournaments/${tournamentId}/matches/${match.id}/undo`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchUndoUnavailable", locale));
        return;
      }
      if (json?.match?.updatedAt) {
        expectedUpdatedAtRef.current = json.match.updatedAt as string;
      }
      setScore({
        a: json?.match?.score?.goals?.a ?? 0,
        b: json?.match?.score?.goals?.b ?? 0,
      });
      setInfo(t("matchUndoSuccess", locale));
      onUpdated();
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm">
          {t("matchGoalsLabel", locale).replace("{limit}", String(goalLimit))}
        </span>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-white/70">
        {(["A", "B"] as const).map((side) => {
          const value = side === "A" ? score.a : score.b;
          const finished = score.a === goalLimit || score.b === goalLimit;
          return (
            <div key={`${match.id}-score-${side}`} className="flex items-center justify-between gap-2">
              <span className="text-white/60">
                {side === "A" ? t("matchPlayerA", locale) : t("matchPlayerB", locale)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={locked || value <= 0}
                  onClick={() => adjust(side, -1)}
                  className="h-7 w-7 rounded-full border border-white/15 text-white/70 hover:border-white/40 disabled:opacity-50"
                >
                  −
                </button>
                <span className="min-w-[24px] text-center text-sm text-white">{value}</span>
                <button
                  type="button"
                  disabled={locked || value >= goalLimit || finished}
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
      {info && <p className="mt-2 text-[11px] text-emerald-200">{info}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={undoLast}
          disabled={undoing || saving}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
        >
          {undoing ? t("matchUndoing", locale) : t("matchUndoLabel", locale)}
        </button>
        {match.status === "DISPUTED" ? (
          <button
            type="button"
            onClick={resolveDispute}
            disabled={disputePending || saving || !canResolveDispute}
            className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
          >
            {disputePending
              ? t("matchDisputeResolving", locale)
              : canResolveDispute
                ? t("matchDisputeResolve", locale)
                : t("matchDisputeResolveAdmin", locale)}
          </button>
        ) : (
          <button
            type="button"
            onClick={markDisputed}
            disabled={disputePending || saving || locked}
            className="rounded-full border border-rose-400/40 px-3 py-1 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
          >
            {disputePending ? t("matchDisputeMarking", locale) : t("matchDisputeMark", locale)}
          </button>
        )}
      </div>
      <details className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
        <summary className="cursor-pointer uppercase tracking-[0.18em] text-[11px]">
          {t("matchOverrideLabel", locale)}
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-amber-100/80">{t("matchOverrideHint", locale)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !match.pairing1Id}
              onClick={() => overrideWinner("A")}
              className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
            >
              {t("matchOverrideForcePlayer", locale).replace(
                "{player}",
                match.pairing1Id ? `#${match.pairing1Id}` : t("matchPlayerA", locale),
              )}
            </button>
            <button
              type="button"
              disabled={saving || !match.pairing2Id}
              onClick={() => overrideWinner("B")}
              className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
            >
              {t("matchOverrideForcePlayer", locale).replace(
                "{player}",
                match.pairing2Id ? `#${match.pairing2Id}` : t("matchPlayerB", locale),
              )}
            </button>
          </div>
        </div>
      </details>
      <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/60">
        <p className="uppercase tracking-[0.18em] text-white/60">{t("walkoverRulesTitle", locale)}</p>
        <p className="mt-1">{t("walkoverRulesHint", locale)}</p>
      </div>
    </div>
  );
}

function PadelMatchEditor({
  match,
  eventId,
  onUpdated,
  locked = false,
  lockedReason,
  canResolveDispute = false,
  locale,
}: {
  match: MatchPayload;
  eventId: number;
  onUpdated: () => void;
  locked?: boolean;
  lockedReason?: string | null;
  canResolveDispute?: boolean;
  locale: string;
}) {
  const [scoreText, setScoreText] = useState(() => formatPadelSetsText(match.score));
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [disputePending, setDisputePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setScoreText(formatPadelSetsText(match.score));
  }, [match.id, match.updatedAt, match.score?.sets]);

  const ensureUnlocked = () => {
    if (!locked) return true;
    setError(lockedReason || t("matchLocked", locale));
    return false;
  };

  const saveScore = async (status: "IN_PROGRESS" | "DONE") => {
    if (!ensureUnlocked()) return;
    const trimmed = scoreText.trim();
    const sets = parsePadelSetsText(trimmed);
    if (trimmed && sets.length === 0) {
      setError(t("scoreInvalidFormat", locale));
      return;
    }
    if (status === "DONE" && sets.length === 0) {
      setError(t("scoreFinalRequired", locale));
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    const score = sets.length ? { resultType: "NORMAL", sets } : undefined;
    try {
      const res = await fetch("/api/padel/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: match.id,
          status,
          ...(score ? { score } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const message =
          json?.error === "MATCH_DISPUTED"
            ? t("matchDisputeEditAdmin", locale)
            : json?.error === "INVALID_SCORE"
              ? t("scoreInvalidSets", locale)
              : t("matchSaveError", locale);
        setError(message);
        return;
      }
      setInfo(status === "DONE" ? t("matchResultSaved", locale) : t("matchPartialUpdated", locale));
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const overrideWinner = async (side: "A" | "B") => {
    if (!ensureUnlocked()) return;
    const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
    if (!pairingId) {
      setError(t("matchPairingMissing", locale));
      return;
    }
    const confirmed = window.confirm(t("matchOverrideConfirm", locale));
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/padel/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: match.id,
          status: "DONE",
          score: { resultType: "WALKOVER", winnerSide: side, walkover: true },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchOverrideError", locale));
        return;
      }
      setInfo(t("matchOverrideApplied", locale));
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const markDisputed = async () => {
    if (!ensureUnlocked()) return;
    if (saving || disputePending) return;
    if (match.status !== "DONE") {
      setError(t("matchDisputeOnlyFinished", locale));
      return;
    }
    const reason = window.prompt(t("matchDisputeReasonPrompt", locale))?.trim() ?? "";
    if (reason.length < 5) {
      setError(t("matchDisputeReasonMin", locale));
      return;
    }
    setDisputePending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/padel/matches/${match.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchDisputeMarkError", locale));
        return;
      }
      setInfo(t("matchDisputeMarked", locale));
      onUpdated();
    } finally {
      setDisputePending(false);
    }
  };

  const resolveDispute = async () => {
    if (saving || disputePending) return;
    if (!canResolveDispute) {
      setError(t("matchDisputeAdminOnly", locale));
      return;
    }
    const confirmed = window.confirm(t("matchDisputeResolvePrompt", locale));
    if (!confirmed) return;
    const resolutionNote = window.prompt(t("matchDisputeResolveNote", locale))?.trim() ?? "";
    setDisputePending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/padel/matches/${match.id}/dispute`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resolutionNote ? { resolutionNote } : {}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchDisputeResolveError", locale));
        return;
      }
      setInfo(t("matchDisputeResolved", locale));
      onUpdated();
    } finally {
      setDisputePending(false);
    }
  };

  const undoLast = async () => {
    if (undoing || saving) return;
    setUndoing(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/padel/matches/${match.id}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || t("matchUndoUnavailable", locale));
        return;
      }
      setInfo(t("matchUndoSuccess", locale));
      onUpdated();
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm">{t("matchSetsLabel", locale)}</span>
      </div>
      <div className="mt-2 space-y-2 text-xs text-white/70">
        <input
          value={scoreText}
          onChange={(e) => setScoreText(e.target.value)}
          placeholder={t("scorePlaceholder", locale)}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          disabled={locked}
        />
        <p className="text-[11px] text-white/50">{t("scoreFormatHint", locale)}</p>
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
      {info && <p className="mt-2 text-[11px] text-emerald-200">{info}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => saveScore("IN_PROGRESS")}
          disabled={saving || locked}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
        >
          {saving ? t("matchSaving", locale) : t("matchSavePartial", locale)}
        </button>
        <button
          type="button"
          onClick={() => saveScore("DONE")}
          disabled={saving || locked}
          className="rounded-full border border-emerald-400/40 px-3 py-1 text-[11px] text-emerald-100 hover:border-emerald-200/70 disabled:opacity-60"
        >
          {saving ? t("matchSaving", locale) : t("matchFinalize", locale)}
        </button>
        <button
          type="button"
          onClick={undoLast}
          disabled={undoing || saving}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:border-white/40 disabled:opacity-60"
        >
          {undoing ? t("matchUndoing", locale) : t("matchUndoLabel", locale)}
        </button>
        {match.status === "DISPUTED" ? (
          <button
            type="button"
            onClick={resolveDispute}
            disabled={disputePending || saving || !canResolveDispute}
            className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
          >
            {disputePending
              ? t("matchDisputeResolving", locale)
              : canResolveDispute
                ? t("matchDisputeResolve", locale)
                : t("matchDisputeResolveAdmin", locale)}
          </button>
        ) : (
          <button
            type="button"
            onClick={markDisputed}
            disabled={disputePending || saving || locked || match.status !== "DONE"}
            className="rounded-full border border-rose-400/40 px-3 py-1 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
          >
            {disputePending ? t("matchDisputeMarking", locale) : t("matchDisputeMark", locale)}
          </button>
        )}
      </div>
      <details className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
        <summary className="cursor-pointer uppercase tracking-[0.18em] text-[11px]">
          {t("matchOverrideLabel", locale)}
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-amber-100/80">{t("matchOverrideHint", locale)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !match.pairing1Id}
              onClick={() => overrideWinner("A")}
              className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
            >
              {t("matchOverrideForce", locale).replace("{pairing}", match.pairing1Id ? `#${match.pairing1Id}` : "A")}
            </button>
            <button
              type="button"
              disabled={saving || !match.pairing2Id}
              onClick={() => overrideWinner("B")}
              className="rounded-full border border-amber-400/40 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
            >
              {t("matchOverrideForce", locale).replace("{pairing}", match.pairing2Id ? `#${match.pairing2Id}` : "B")}
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
  locale,
  showCourt,
}: {
  event: EventPayload;
  tournament: any;
  pairings: Record<number, PairingMeta>;
  timeZone: string;
  locale: string;
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
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">{t("tvModeLabel", locale)}</p>
          <h1 className="text-4xl font-semibold text-white">{event.title}</h1>
          <p className="text-white/60">{formatDateRange(event.startsAt, event.endsAt, locale, timeZone)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
          {t("monitorSubtitle", locale)}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t("nowPlaying", locale)}</h2>
            <span className="text-white/60 text-sm">
              {live.length} {t("matches", locale)}
            </span>
          </div>
          {live.length === 0 && <p className="text-white/60">{t("noLiveMatches", locale)}</p>}
          {live.map((m: MatchPayload) => (
            <MatchCard key={`live-${m.id}`} match={m} pairings={pairings} timeZone={timeZone} locale={locale} size="lg" showCourt={showCourt} />
          ))}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t("upcomingMatches", locale)}</h2>
            <span className="text-white/60 text-sm">
              {upcoming.length} {t("matches", locale)}
            </span>
          </div>
          {upcoming.length === 0 && <p className="text-white/60">{t("noUpcomingMatches", locale)}</p>}
          {upcoming.map((m: MatchPayload) => (
            <MatchCard key={`up-${m.id}`} match={m} pairings={pairings} timeZone={timeZone} locale={locale} size="lg" showCourt={showCourt} />
          ))}
        </section>
      </div>

      {tvBracketMatches.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t("bracket", locale)}</h2>
            <span className="text-white/60 text-sm">
              {tvBracketMatches.length} {t("matches", locale)}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tvBracketMatches.map((match: MatchPayload) => (
              <MatchCard key={`tv-bracket-${match.id}`} match={match} pairings={pairings} timeZone={timeZone} locale={locale} size="lg" showCourt={showCourt} />
            ))}
          </div>
        </section>
      )}
      {tvBracketMatches.length === 0 && tvGroupStages.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t("standings", locale)}</h2>
            <span className="text-white/60 text-sm">{t("standings", locale)}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {tvGroupStages.map((stage: any) =>
              stage.groups.map((group: any) => (
                <div key={`tv-group-${group.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">{group.name || t("groupLabel", locale)}</h3>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {(group.standings ?? []).length === 0 && (
                      <p className="text-white/60">{t("noStandings", locale)}</p>
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
  isOrganizationEdit,
  tournamentId,
  eventId,
  onUpdated,
  goalLimits,
  locale,
  highlightPairingId,
  canResolveDispute,
  scoreMode = "GOALS",
  view = "split",
}: {
  matches: MatchPayload[];
  pairings: Record<number, PairingMeta>;
  isOrganizationEdit: boolean;
  tournamentId: number | null;
  eventId?: number | null;
  onUpdated: () => void;
  goalLimits: GoalLimitsConfig;
  locale: string;
  highlightPairingId?: number | null;
  canResolveDispute?: boolean;
  scoreMode?: "GOALS" | "PADEL";
  view?: "split" | "full";
}) {
  const [activeRound, setActiveRound] = useState<number | null>(null);

  const matchesByRound = matches.reduce((acc: Record<number, MatchPayload[]>, match: MatchPayload) => {
    const round = match.round ?? 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {});
  const rounds = Object.keys(matchesByRound)
    .map((r) => Number(r))
    .sort((a, b) => a - b);
  const roundLabels = buildRoundLabels(rounds.length, locale);
  const roundFallback = (round: number) => `${t("roundLabel", locale)} ${round}`;
  const finalRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const roundLabelMap = rounds.reduce((acc, round, idx) => {
    acc[round] = roundLabels[idx] || roundFallback(round);
    return acc;
  }, {} as Record<number, string>);
  const treeRowHeight = 32;
  const liveMatches = matches.filter((match) => match.status === "IN_PROGRESS" || match.status === "LIVE");
  const liveRound = liveMatches[0]?.round ?? null;
  const roundIsComplete = (round: number) => {
    const list = matchesByRound[round] ?? [];
    return list.length > 0 && list.every((match) => match.status === "DONE");
  };
  const roundHasLive = (round: number) => {
    const list = matchesByRound[round] ?? [];
    return list.some((match) => match.status === "IN_PROGRESS" || match.status === "LIVE");
  };
  const currentRound =
    (liveRound && rounds.includes(liveRound) ? liveRound : null) ??
    rounds.find((round) => !roundIsComplete(round)) ??
    finalRound;
  const roundIsLocked = (round: number) => {
    const idx = rounds.indexOf(round);
    if (idx <= 0) return false;
    return rounds.slice(0, idx).some((r) => !roundIsComplete(r));
  };
  const desktopTreeStartIndex = Math.max(0, rounds.length - 3);
  const mobileTreeStartIndex = Math.max(0, rounds.length - 2);
  const activeRoundIndex = activeRound ? rounds.indexOf(activeRound) : -1;
  const desktopTreeRounds = rounds.slice(desktopTreeStartIndex);
  const mobileTreeRounds = rounds.slice(mobileTreeStartIndex);
  const showDesktopTree = activeRoundIndex >= desktopTreeStartIndex;
  const showMobileTree = activeRoundIndex >= mobileTreeStartIndex;

  const renderRow = (
    side: "A" | "B",
    match: MatchPayload,
    winnerSide: "A" | "B" | null,
    summary: { a: number; b: number } | null,
    compact?: boolean,
    final?: boolean,
  ) => {
    const pairingId = side === "A" ? match.pairing1Id : match.pairing2Id;
    const isWinner = winnerSide === side;
    const isLoser = winnerSide && winnerSide !== side;
    const score = summary ? (side === "A" ? summary.a : summary.b) : 0;
    const scoreTone = isWinner ? "text-emerald-300" : isLoser ? "text-rose-300" : "text-white/70";
    const nameTone = isLoser ? "text-white/50" : "text-white/85";
    const textClass = compact ? "text-[11px]" : "text-sm";
    const paddingClass = compact ? "py-1" : "py-2";
    if (compact) {
      const meta = pairingMeta(pairingId, pairings);
      const fallbackLabel = pairingId ? `#${pairingId}` : "A definir";
      const label = meta?.label ?? fallbackLabel;
      const displayLabel = label.length > 16 ? label.slice(0, 16) : label;
      const avatarClass = final ? "h-14 w-14" : "h-12 w-12";
      return (
        <div className={`flex items-center justify-between gap-3 ${paddingClass}`}>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <Avatar
                src={meta?.avatarUrl ?? null}
                name={label}
                className={`${avatarClass} border border-white/10`}
                textClassName={`${final ? "text-[11px]" : "text-[10px]"} font-semibold uppercase tracking-[0.16em] text-white/80`}
                fallbackText="OR"
              />
              <span className={`max-w-[120px] truncate text-[11px] ${nameTone}`} title={label}>
                {displayLabel}
              </span>
            </div>
          </div>
          <span
            className={`min-w-[22px] text-right text-base font-semibold tabular-nums ${final ? "text-lg" : ""} ${scoreTone}`}
          >
            {score}
          </span>
        </div>
      );
    }
    return (
      <div className={`flex items-center justify-between gap-2 ${paddingClass}`}>
        <div className={`min-w-0 ${textClass} ${nameTone}`}>{renderPairingName(pairingId, pairings, "truncate")}</div>
        <span className={`${textClass} min-w-[24px] text-right font-semibold tabular-nums ${scoreTone}`}>{score}</span>
      </div>
    );
  };

  const renderListMatch = (
    match: MatchPayload,
    options?: {
      withConnector?: boolean;
      connectorSide?: "left" | "right";
      connectorDirection?: "up" | "down";
      connectorHeight?: number;
      compact?: boolean;
      accent?: boolean;
      final?: boolean;
      locked?: boolean;
      style?: Record<string, string | number>;
    },
  ) => {
    const summary = getScoreSummary(match.score);
    const winnerSide = match.status === "DONE" ? getWinnerSide(match.score) : null;
    const isLive = match.status === "IN_PROGRESS" || match.status === "LIVE";
    const isDisputed = match.status === "DISPUTED";
    const isLocked = Boolean(options?.locked || isDisputed);
    const lockedReason = isDisputed
      ? t("matchDisputeLocked", locale)
      : options?.locked
      ? t("matchPhaseInactive", locale)
        : null;
    const useCompact = Boolean(options?.compact);
    const isHighlighted =
      typeof highlightPairingId === "number" &&
      (match.pairing1Id === highlightPairingId || match.pairing2Id === highlightPairingId);
    const wrapperTone = useCompact
      ? "border-transparent bg-transparent"
      : isDisputed
        ? "border-rose-400/60 bg-rose-500/10"
        : isLive
        ? "border-emerald-400/70 bg-emerald-500/15"
        : isHighlighted
          ? "border-emerald-400/50 bg-emerald-500/10"
          : "border-white/10 bg-black/30";
    const isFinal = Boolean(options?.final);
    const paddingClass = isFinal ? "p-3" : useCompact ? "p-2" : "p-3";
    const accentClass = options?.accent ? "ring-1 ring-white/25 shadow-[0_10px_24px_rgba(0,0,0,0.35)]" : "";
    const liveClass = isLive ? "ring-1 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.25)]" : "";
    const disputeClass = isDisputed ? "ring-1 ring-rose-400/60 shadow-[0_0_16px_rgba(244,63,94,0.28)]" : "";
    const finalClass = isFinal
      ? "ring-1 ring-amber-300/70 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      : "";
    const needsRelative = Boolean(options?.withConnector || options?.connectorSide || isLive);
    const lockedClass = isLocked ? "opacity-70" : "";
    const wrapperClass = `${needsRelative ? "relative" : ""} rounded-2xl border ${wrapperTone} ${paddingClass} ${accentClass} ${liveClass} ${disputeClass} ${finalClass} ${lockedClass}`;
    return (
      <div key={`list-${match.id}`} className={wrapperClass} style={options?.style}>
        {isLive && (
          <span className="absolute -top-2 left-3 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
            {t("liveLabel", locale)}
          </span>
        )}
        {isDisputed && (
          <span className="absolute -top-2 left-3 rounded-full border border-rose-400/60 bg-rose-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-100">
            {t("scoreDispute", locale)}
          </span>
        )}
        {isFinal && (
          <span className="absolute -top-2 right-3 rounded-full border border-amber-300/70 bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-100">
            {t("roundFinal", locale)}
          </span>
        )}
        {isFinal ? (
          <div className="grid grid-cols-2 gap-4">
            {renderRow("A", match, winnerSide, summary, useCompact, isFinal)}
            {renderRow("B", match, winnerSide, summary, useCompact, isFinal)}
          </div>
        ) : (
          <div className={useCompact ? "space-y-1" : "space-y-2"}>
            {renderRow("A", match, winnerSide, summary, useCompact, isFinal)}
            {renderRow("B", match, winnerSide, summary, useCompact, isFinal)}
          </div>
        )}
        {(options?.withConnector || options?.connectorSide) && (
          <div
            className={`pointer-events-none absolute top-1/2 h-px w-6 bg-white/15 ${
              options?.connectorSide === "left" ? "left-[-18px]" : "right-[-18px]"
            }`}
          />
        )}
        {options?.connectorHeight && options?.connectorDirection && (
          <div
            className={`pointer-events-none absolute w-px bg-white/15 ${
              options?.connectorSide === "left" ? "left-[-18px]" : "right-[-18px]"
            } ${options?.connectorDirection === "up" ? "bottom-1/2" : "top-1/2"}`}
            style={{ height: options.connectorHeight }}
          />
        )}
        {isOrganizationEdit && (scoreMode === "PADEL" ? Boolean(eventId) : Boolean(tournamentId)) && (
          <div className="pt-1">
            {scoreMode === "PADEL" ? (
              <PadelMatchEditor
                match={match}
                eventId={eventId as number}
                onUpdated={onUpdated}
                locked={isLocked}
                lockedReason={lockedReason}
                canResolveDispute={canResolveDispute}
                locale={locale}
              />
            ) : (
              <OrganizationMatchEditor
                match={match}
                tournamentId={tournamentId as number}
                onUpdated={onUpdated}
                goalLimit={resolveGoalLimit(match.round ?? null, goalLimits)}
                locked={isLocked}
                lockedReason={lockedReason}
                canResolveDispute={canResolveDispute}
                locale={locale}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (rounds.length === 0) return;
    if (!activeRound || !rounds.includes(activeRound)) {
      setActiveRound(currentRound ?? rounds[0]);
    }
  }, [activeRound, currentRound, rounds.join(",")]);

  const activeMatches = activeRound ? matchesByRound[activeRound] ?? [] : [];
  const activeMatchesSorted = activeMatches.slice().sort((a, b) => a.id - b.id);
  const splitIndex = Math.ceil(activeMatchesSorted.length / 2);
  const leftMatches = activeMatchesSorted.slice(0, splitIndex);
  const rightMatches = activeMatchesSorted.slice(splitIndex);

  const renderSymmetricTreeGrid = (
    treeRounds: number[],
    options?: { compact?: boolean; rowHeight?: number; minColWidth?: number; accentRound?: number | null },
  ) => {
    if (treeRounds.length === 0) return null;
    const lastRound = treeRounds[treeRounds.length - 1];
    const leftRounds = treeRounds.filter((round) => round !== lastRound);
    const leftCount = leftRounds.length;
    const columns = leftCount * 2 + 1;
    const rowHeight = options?.rowHeight ?? treeRowHeight;
    const treeRows = leftCount > 0 ? 2 ** leftCount : 1;
    const leftIndexMap = leftRounds.reduce((acc, round, idx) => {
      acc[round] = idx;
      return acc;
    }, {} as Record<number, number>);
    const rightRounds = [...leftRounds].reverse();
    const columnLabels = [
      ...leftRounds.map((round) => roundLabelMap[round] || roundFallback(round)),
      roundLabelMap[lastRound] || roundFallback(lastRound),
      ...rightRounds.map((round) => roundLabelMap[round] || roundFallback(round)),
    ];
    const roundMatches = (round: number) =>
      (matchesByRound[round] ?? []).slice().sort((a, b) => compareBracketOrder(a, b));
    const roundSplit = (round: number) => {
      const list = roundMatches(round);
      const half = Math.ceil(list.length / 2);
      return { left: list.slice(0, half), right: list.slice(half) };
    };
    const finalMatch = roundMatches(lastRound)[0] ?? null;
    const finalRow = leftCount > 0 ? 2 ** (leftCount - 1) : 1;
    const accentRound = options?.accentRound ?? null;
    const columnTemplate =
      options?.minColWidth && options.minColWidth > 0
        ? `repeat(${columns}, minmax(${options.minColWidth}px, 1fr))`
        : `repeat(${columns}, minmax(0, 1fr))`;

    return (
      <div className="space-y-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: columnTemplate }}>
          {columnLabels.map((label, idx) => (
            <p key={`sym-label-${idx}`} className="text-[11px] uppercase tracking-[0.24em] text-white/50">
              {label}
            </p>
          ))}
        </div>
        <div
          className="grid gap-x-6 gap-y-2"
          style={{
            gridTemplateColumns: columnTemplate,
            gridTemplateRows: `repeat(${treeRows}, minmax(${rowHeight}px, 1fr))`,
            minHeight: treeRows ? `${treeRows * rowHeight}px` : undefined,
          }}
        >
          {leftRounds.flatMap((round, colIdx) => {
            const { left } = roundSplit(round);
            const roundIndex = leftIndexMap[round] ?? colIdx;
            const connectorHeight = left.length > 1 ? rowHeight * 2 ** roundIndex : 0;
            return left.map((match, matchIdx) => {
              const row = 2 ** roundIndex * (2 * matchIdx + 1);
              const connectorDirection = matchIdx % 2 === 0 ? "down" : "up";
              return renderListMatch(match, {
                connectorSide: "right",
                connectorDirection: connectorHeight ? connectorDirection : undefined,
                connectorHeight: connectorHeight || undefined,
                compact: options?.compact,
                locked: roundIsLocked(round),
                style: { gridColumn: colIdx + 1, gridRow: row },
              });
            });
          })}
          {finalMatch &&
            renderListMatch(finalMatch, {
              compact: options?.compact,
              accent: accentRound === lastRound,
              final: true,
              locked: roundIsLocked(lastRound),
              style: { gridColumn: leftCount + 1, gridRow: finalRow },
            })}
          {rightRounds.flatMap((round, idx) => {
            const { right } = roundSplit(round);
            const roundIndex = leftIndexMap[round] ?? 0;
            const col = leftCount + 2 + idx;
            const connectorHeight = right.length > 1 ? rowHeight * 2 ** roundIndex : 0;
            return right.map((match, matchIdx) => {
              const row = 2 ** roundIndex * (2 * matchIdx + 1);
              const connectorDirection = matchIdx % 2 === 0 ? "down" : "up";
              return renderListMatch(match, {
                connectorSide: "left",
                connectorDirection: connectorHeight ? connectorDirection : undefined,
                connectorHeight: connectorHeight || undefined,
                compact: options?.compact,
                locked: roundIsLocked(round),
                style: { gridColumn: col, gridRow: row },
              });
            });
          })}
        </div>
      </div>
    );
  };

  const renderMobileFinalTree = (treeRounds: number[]) => {
    if (treeRounds.length === 0) return null;
    const finalRound = treeRounds[treeRounds.length - 1];
    const semiRound = treeRounds.length > 1 ? treeRounds[treeRounds.length - 2] : null;
    const finalMatch = (matchesByRound[finalRound] ?? []).slice().sort(compareBracketOrder)[0] ?? null;
    const semiMatches = semiRound
      ? (matchesByRound[semiRound] ?? []).slice().sort(compareBracketOrder)
      : [];
    return (
      <div className="space-y-4">
        {semiRound && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              {roundLabelMap[semiRound] || roundFallback(semiRound)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {semiMatches.map((match) =>
                renderListMatch(match, { locked: roundIsLocked(match.round ?? 0) }),
              )}
            </div>
          </div>
        )}
        {finalMatch && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              {roundLabelMap[finalRound] || roundFallback(finalRound)}
            </p>
            <div className="mx-auto max-w-sm">
              {renderListMatch(finalMatch, { final: true, accent: true, locked: roundIsLocked(finalRound) })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (view === "full") {
    return (
      <div className="space-y-4">
        {rounds.map((round, idx) => (
          <div key={`full-round-${round}`} className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              {roundLabels[idx] || roundFallback(round)}
            </p>
            {(matchesByRound[round] ?? [])
              .slice()
              .sort((a, b) => a.id - b.id)
              .map((match) => renderListMatch(match, { locked: roundIsLocked(match.round ?? 0) }))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
          {rounds.map((round) => {
            const isActive = activeRound === round;
            const isLiveRound = roundHasLive(round);
            const isCompleted = roundIsComplete(round);
            const isLocked = roundIsLocked(round);
            const isCurrent = round === currentRound;
            const tone = isCompleted
              ? "border-purple-400/60 bg-purple-500/15 text-purple-100"
              : isLiveRound || isCurrent
                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                : isLocked
                  ? "border-white/10 bg-white/5 text-white/40"
                  : "border-white/15 bg-white/5 text-white/60";
            return (
              <button
                key={`round-tab-${round}`}
                type="button"
                onClick={() => {
                  if (!isLocked) setActiveRound(round);
                }}
                disabled={isLocked}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${tone} ${
                  isLocked ? "cursor-not-allowed" : "hover:border-white/40"
                } ${isActive ? "ring-1 ring-white/30" : ""}`}
              >
                <span>{roundLabelMap[round] || roundFallback(round)}</span>
                {isCompleted && (
                  <span className="ml-2 rounded-full border border-purple-400/50 bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-100">
                    Concluida
                  </span>
                )}
                {!isCompleted && isLiveRound && (
                  <span className="ml-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-100">
                    Live
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden md:block">
        {showDesktopTree ? (
          <div className="space-y-3">
            {renderSymmetricTreeGrid(desktopTreeRounds, {
              compact: true,
              rowHeight: 32,
              minColWidth: 140,
              accentRound: activeRound === finalRound ? finalRound : null,
            })}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3">
              {leftMatches.map((match) =>
                renderListMatch(match, { locked: roundIsLocked(match.round ?? 0) })
              )}
            </div>
            <div className="space-y-3">
              {rightMatches.map((match) =>
                renderListMatch(match, { locked: roundIsLocked(match.round ?? 0) })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="md:hidden">
        {showMobileTree ? (
          <div className="space-y-3">{renderMobileFinalTree(mobileTreeRounds)}</div>
        ) : (
          <div className="space-y-3">
            {activeMatchesSorted.map((match) =>
              renderListMatch(match, { locked: roundIsLocked(match.round ?? 0) })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OneVOneBracket({
  stage,
  pairings,
  eventStatusKey,
  locale,
  isOrganizationEdit,
  tournamentId,
  eventId,
  onUpdated,
  goalLimits,
  canResolveDispute,
  scoreMode = "GOALS",
}: {
  stage: { matches?: MatchPayload[]; name?: string | null } | null;
  pairings: Record<number, PairingMeta>;
  eventStatusKey: EventStatusKey;
  locale: string;
  isOrganizationEdit: boolean;
  tournamentId: number | null;
  eventId?: number | null;
  onUpdated: () => void;
  goalLimits: GoalLimitsConfig;
  canResolveDispute?: boolean;
  scoreMode?: "GOALS" | "PADEL";
}) {
  if (!stage || !stage.matches || stage.matches.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/70">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{t("bracket", locale)}</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{t("bracketPreparing", locale)}</h2>
        <p className="text-sm text-white/60">{t("bracketPreparingHint", locale)}</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{t("bracket", locale)}</p>
          <h2 className="text-xl font-semibold text-white">{stage.name || t("oneVoneElims", locale)}</h2>
        </div>
        <span className="text-xs text-white/50">
          {eventStatusKey === "UPCOMING" ? t("preEventLabel", locale) : t("eventLive", locale)}
        </span>
      </div>
      <BracketRoundsView
        matches={stage.matches}
        pairings={pairings}
        isOrganizationEdit={isOrganizationEdit}
        tournamentId={tournamentId}
        eventId={eventId}
        onUpdated={onUpdated}
        goalLimits={goalLimits}
        locale={locale}
        canResolveDispute={canResolveDispute}
        scoreMode={scoreMode}
      />
    </section>
  );
}

function OneVOneLiveLayout({
  event,
  organization,
  tournament,
  pairings,
  eventStatusKey,
  locale,
  countdownLabel,
  nowMatch,
  championLabel,
  sponsors,
  onToggleFollow,
  followPending,
  isFollowing,
  showSponsors,
  isOrganizationEdit,
  canManageLiveConfig,
  canPostAnnouncements,
  canResolveDispute,
  onRefresh,
  variant = "full",
}: {
  event: EventPayload;
  organization: { id: number; publicName: string; username: string | null; brandingAvatarUrl: string | null } | null;
  tournament: any;
  pairings: Record<number, PairingMeta>;
  eventStatusKey: EventStatusKey;
  locale: string;
  countdownLabel: string | null;
  nowMatch: MatchPayload | null;
  championLabel: string | null;
  sponsors: SponsorsConfig;
  onToggleFollow: () => void;
  followPending: boolean;
  isFollowing: boolean;
  showSponsors: boolean;
  isOrganizationEdit: boolean;
  canManageLiveConfig: boolean;
  canPostAnnouncements: boolean;
  canResolveDispute: boolean;
  onRefresh: () => void;
  variant?: "full" | "inline";
}) {
  const streamEmbed = getStreamEmbed(event.liveStreamUrl);
  const embedUrl = streamEmbed.embedUrl;
  const streamHref = streamEmbed.href;
  const streamLabel =
    streamEmbed.provider === "youtube"
      ? t("openYoutube", locale)
      : streamEmbed.provider === "twitch"
        ? t("openTwitch", locale)
        : t("openStream", locale);
  const [streamUrl, setStreamUrl] = useState(event.liveStreamUrl ?? "");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [sponsorDraft, setSponsorDraft] = useState<SponsorsConfig>(sponsors ?? {});
  const [goalLimitsDraft, setGoalLimitsDraft] = useState<GoalLimitsConfig>(
    normalizeGoalLimits(tournament?.goalLimits as GoalLimitsConfig),
  );
  const [activeTab, setActiveTab] = useState<"stats" | "rules">("stats");
  const featuredMatchId = typeof tournament?.featuredMatchId === "number" ? tournament.featuredMatchId : null;
  const bracketStage =
    tournament?.stages?.find((s: any) => s.stageType === "PLAYOFF" && s.matches?.length) ??
    tournament?.stages?.find((s: any) => s.matches?.length) ??
    null;
  const flatMatches: MatchPayload[] = tournament?.stages
    ? tournament.stages.flatMap((s: any) => [...s.matches, ...(s.groups ?? []).flatMap((g: any) => g.matches)])
    : [];
  const firstRoundMatches = bracketStage?.matches?.filter((m: MatchPayload) => (m.round ?? 0) === 1) ?? [];
  const playerCount = firstRoundMatches.length ? firstRoundMatches.length * 2 : null;
  const locationLabel = formatEventLocationLabel(
    { addressRef: event.addressRef ?? null },
    t("locationTbd", locale),
  );

  const nowLabelParts = nowMatch
    ? [pairingLabelPlain(nowMatch.pairing1Id, pairings), pairingLabelPlain(nowMatch.pairing2Id, pairings)].filter(Boolean)
    : [];
  const nowLabel = nowLabelParts.length ? nowLabelParts.join(" vs ") : null;
  const scoreLabel = nowMatch ? formatScore(nowMatch.score) : null;
  const heroStatus =
    eventStatusKey === "LIVE"
      ? `${t("eventLive", locale)}${nowLabel ? ` · ${t("nowPlaying", locale)}: ${nowLabel}${scoreLabel && scoreLabel !== "—" ? ` (${scoreLabel})` : ""}` : ""}`
      : eventStatusKey === "DONE"
        ? championLabel
          ? `${t("eventFinished", locale)} · ${t("championLabel", locale)}: ${championLabel}`
          : t("eventFinished", locale)
        : t("liveStartsSoon", locale);

  const hasHeroSponsor = Boolean(sponsors?.hero?.logoUrl || sponsors?.hero?.label);
  const nowSponsor = sponsors?.nowPlaying ?? null;
  const sideSponsors = [sponsors?.sideA, sponsors?.sideB].filter(
    (slot) => slot && (slot.logoUrl || slot.label),
  ) as SponsorSlot[];
  const goalLimits = normalizeGoalLimits(tournament?.goalLimits as GoalLimitsConfig);
  const goalDefaultLimit = goalLimits?.defaultLimit ?? 3;
  const goalRoundOverrides = goalLimits?.roundLimits ?? null;
  const roundNumbers = bracketStage?.matches
    ? Array.from(
        new Set(
          (bracketStage.matches as MatchPayload[]).map((m) =>
            Number.isFinite(m.round) ? Number(m.round) : 0,
          ),
        ),
      )
        .filter((r): r is number => Number.isFinite(r) && r > 0)
        .sort((a, b) => a - b)
    : [];
  const roundFallback = (round: number) => `${t("roundLabel", locale)} ${round}`;
  const roundLabels = buildRoundLabels(roundNumbers.length, locale);
  const roundLabelMap = roundNumbers.reduce((acc, round, idx) => {
    acc[round] = roundLabels[idx] || roundFallback(round);
    return acc;
  }, {} as Record<number, string>);
  const nowSummary = nowMatch ? getScoreSummary(nowMatch.score) : null;
  const nowWinnerSide = nowMatch && nowMatch.status === "DONE" ? getWinnerSide(nowMatch.score) : null;
  const nowIsLive = nowMatch ? nowMatch.status === "IN_PROGRESS" || nowMatch.status === "LIVE" : false;
  const nowMetaA = nowMatch ? pairingMeta(nowMatch.pairing1Id, pairings) : null;
  const nowMetaB = nowMatch ? pairingMeta(nowMatch.pairing2Id, pairings) : null;
  const nowLabelA = nowMetaA?.label ?? "";
  const nowLabelB = nowMetaB?.label ?? "";
  const nowDisplayLabelA = nowLabelA.length > 16 ? nowLabelA.slice(0, 16) : nowLabelA;
  const nowDisplayLabelB = nowLabelB.length > 16 ? nowLabelB.slice(0, 16) : nowLabelB;
  const nowScoreA = nowSummary ? nowSummary.a : 0;
  const nowScoreB = nowSummary ? nowSummary.b : 0;
  const overrideActive = Boolean(featuredMatchId && nowMatch?.id === featuredMatchId);
  const [featuredDraft, setFeaturedDraft] = useState<number | null>(featuredMatchId);
  const isPadelLive = event.templateType === "PADEL";
  const configFormat = typeof tournament?.format === "string" ? tournament.format : null;

  useEffect(() => {
    setStreamUrl(event.liveStreamUrl ?? "");
  }, [event.liveStreamUrl]);

  useEffect(() => {
    setSponsorDraft(sponsors ?? {});
  }, [sponsors]);

  useEffect(() => {
    setGoalLimitsDraft(normalizeGoalLimits(tournament?.goalLimits as GoalLimitsConfig));
  }, [tournament?.goalLimits]);

  useEffect(() => {
    setFeaturedDraft(featuredMatchId);
  }, [featuredMatchId]);

  const saveFeaturedMatch = async (matchId: number | null) => {
    setSavingConfig(true);
    setConfigMessage(null);
    try {
      if (isPadelLive) {
        if (!organization?.id) {
          setConfigMessage(t("organizationUnavailable", locale));
          return;
        }
        await fetch("/api/padel/tournaments/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: organization.id,
            eventId: event.id,
            ...(configFormat ? { format: configFormat } : {}),
            featuredMatchId: matchId,
          }),
        });
      } else if (tournament?.id) {
        await fetch(`/api/organizacao/tournaments/${tournament.id}/featured-match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });
      }
      setConfigMessage(matchId ? t("overrideApplied", locale) : t("overrideRemoved", locale));
      onRefresh();
    } catch {
      setConfigMessage(t("overrideUpdateError", locale));
    } finally {
      setSavingConfig(false);
      setTimeout(() => setConfigMessage(null), 2000);
    }
  };

  const saveLiveConfig = async () => {
    setSavingConfig(true);
    setConfigMessage(null);
    try {
      if (streamUrl.trim() !== (event.liveStreamUrl ?? "")) {
        await fetch("/api/organizacao/events/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            liveStreamUrl: streamUrl.trim() || null,
          }),
        });
      }
      if (isPadelLive) {
        if (!organization?.id) {
          setConfigMessage(t("organizationUnavailable", locale));
          return;
        }
        await fetch("/api/padel/tournaments/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: organization.id,
            eventId: event.id,
            ...(configFormat ? { format: configFormat } : {}),
            liveSponsors: {
              hero: sponsorDraft?.hero ?? null,
              sideA: sponsorDraft?.sideA ?? null,
              sideB: sponsorDraft?.sideB ?? null,
              nowPlaying: sponsorDraft?.nowPlaying ?? null,
            },
            goalLimits: {
              defaultLimit: goalLimitsDraft?.defaultLimit ?? null,
              roundLimits: goalLimitsDraft?.roundLimits ?? {},
            },
          }),
        });
      } else if (tournament?.id) {
        await fetch(`/api/organizacao/tournaments/${tournament.id}/sponsors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hero: sponsorDraft?.hero ?? null,
            sideA: sponsorDraft?.sideA ?? null,
            sideB: sponsorDraft?.sideB ?? null,
            nowPlaying: sponsorDraft?.nowPlaying ?? null,
          }),
        });
        await fetch(`/api/organizacao/tournaments/${tournament.id}/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultLimit: goalLimitsDraft?.defaultLimit ?? null,
            roundLimits: goalLimitsDraft?.roundLimits ?? {},
          }),
        });
      }
      setConfigMessage(t("configSaved", locale));
      onRefresh();
    } catch {
      setConfigMessage(t("configSaveError", locale));
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

  const heroSponsorSection = hasHeroSponsor ? (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <a
        href={sponsors?.hero?.url || undefined}
        target={sponsors?.hero?.url ? "_blank" : undefined}
        rel={sponsors?.hero?.url ? "noreferrer" : undefined}
        className="flex items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{t("mainSponsor", locale)}</p>
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
    </section>
  ) : null;

  const nowPlayingSection = (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{t("nowPlaying", locale)}</h3>
        <div className="flex items-center gap-2 text-xs text-white/50">
          {overrideActive && (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
              {t("overrideLabel", locale)}
            </span>
          )}
          <span>
            {nowMatch
              ? nowIsLive
                ? t("liveNowLabel", locale)
                : t("latestLabel", locale)
              : t("noneLabel", locale)}
          </span>
        </div>
      </div>
      {nowSponsor && (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/70">
          <span className="uppercase tracking-[0.2em] text-white/50">{t("matchSponsor", locale)}</span>
          <div className="flex items-center gap-2">
            {nowSponsor.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={nowSponsor.logoUrl}
                alt={nowSponsor.label || "Sponsor"}
                className="h-7 w-auto rounded-lg border border-white/10 bg-white/5 px-2 py-1 object-contain"
              />
            )}
            {nowSponsor.label && <span>{nowSponsor.label}</span>}
          </div>
        </div>
      )}
      {!nowMatch && <p className="text-sm text-white/60">{t("noLiveMatches", locale)}</p>}
      {nowMatch && (
        <div
          className={`rounded-2xl border p-4 ${
            nowIsLive ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-black/20"
          }`}
        >
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <Avatar
                src={nowMetaA?.avatarUrl ?? null}
                name={nowLabelA}
                className={`h-20 w-20 border border-white/10 ${
                  nowWinnerSide === "A" ? "ring-2 ring-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]" : ""
                }`}
                textClassName="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80"
                fallbackText="OR"
              />
              <span className="max-w-[140px] truncate text-sm text-white/85" title={nowLabelA}>
                {nowDisplayLabelA}
              </span>
              <span
                className={`text-3xl font-semibold ${
                  nowWinnerSide === "A" ? "text-emerald-300" : nowWinnerSide ? "text-rose-300" : "text-white/70"
                }`}
              >
                {nowScoreA}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                {nowIsLive ? t("nowPlaying", locale) : t("resultLabel", locale)}
              </span>
              <span className="text-sm font-semibold text-white/80">VS</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar
                src={nowMetaB?.avatarUrl ?? null}
                name={nowLabelB}
                className={`h-20 w-20 border border-white/10 ${
                  nowWinnerSide === "B" ? "ring-2 ring-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.35)]" : ""
                }`}
                textClassName="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80"
                fallbackText="OR"
              />
              <span className="max-w-[140px] truncate text-sm text-white/85" title={nowLabelB}>
                {nowDisplayLabelB}
              </span>
              <span
                className={`text-3xl font-semibold ${
                  nowWinnerSide === "B" ? "text-emerald-300" : nowWinnerSide ? "text-rose-300" : "text-white/70"
                }`}
              >
                {nowScoreB}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        {heroSponsorSection}
        {nowPlayingSection}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_55%),linear-gradient(135deg,rgba(6,8,20,0.9),rgba(15,18,35,0.8))] p-6 text-center">
        <p className="text-[12px] uppercase tracking-[0.45em] text-white/50">{t("liveLabel", locale)}</p>
        <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
          {event.title} — {t("liveLabel", locale)}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {locationLabel}
          {playerCount ? ` · ${playerCount} ${t("playersLabel", locale)}` : ""}
          {` · ${t("oneVoneElims", locale)}`}
        </p>
        <p className="mt-2 text-sm text-white/70">{heroStatus}</p>
        {eventStatusKey === "UPCOMING" && countdownLabel && (
          <div className="mx-auto mt-4 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">{t("eventStartsIn", locale)}</span>
            <span className="text-lg font-semibold text-white">{countdownLabel}</span>
          </div>
        )}
      </header>

      {nowPlayingSection}

      <div className={`grid gap-6 ${hasHeroSponsor ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{t("liveStreamLabel", locale)}</p>
              <h2 className="text-lg font-semibold text-white">
                {embedUrl ? t("liveNowLabel", locale) : t("liveStartsSoon", locale)}
              </h2>
            </div>
            {eventStatusKey === "LIVE" && (
              <span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-200">
                {t("liveLabel", locale)}
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
                title={t("liveStreamLabel", locale)}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/70">
              {t("liveStartsSoonDesc", locale)}
            </div>
          )}
          {!embedUrl && streamHref && (
            <a
              href={streamHref}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            >
              {streamLabel}
            </a>
          )}
          {!embedUrl && organization && (
            <button
              type="button"
              disabled={followPending}
              onClick={onToggleFollow}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60"
            >
              {followPending
                ? t("followUpdating", locale)
                : isFollowing
                  ? t("followedLabel", locale)
                  : t("followToNotify", locale)}
            </button>
          )}
          <div className="flex items-center gap-2 pt-2 text-[11px] uppercase tracking-[0.18em] text-white/50">
            {(["stats", "rules"] as const).map((tab) => (
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
                {tab === "stats" ? t("tabStats", locale) : t("tabRules", locale)}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            {activeTab === "stats" && t("statsSoon", locale)}
            {activeTab === "rules" && (
              <ul className="space-y-1 text-sm text-white/70">
                {isPadelLive ? (
                  <>
                    <li>{t("padelRulesSets", locale)}</li>
                    <li>{t("padelRulesTieBreak", locale)}</li>
                    <li>{t("padelRulesFairPlay", locale)}</li>
                    <li>{t("padelRulesStaffFinal", locale)}</li>
                  </>
                ) : (
                  <>
                    <li>{t("oneVoneRulesElimination", locale)}</li>
                    <li>{t("oneVoneRulesLimitWin", locale)}</li>
                    <li>
                      {t("oneVoneRulesDefaultLimit", locale)} {goalDefaultLimit}.
                    </li>
                    {goalRoundOverrides && <li>{t("oneVoneRulesRoundLimits", locale)}</li>}
                    <li>{t("padelRulesFairPlay", locale)}</li>
                    <li>{t("padelRulesStaffFinal", locale)}</li>
                  </>
                )}
              </ul>
            )}
          </div>
        </section>

        {heroSponsorSection}
      </div>

      <OneVOneBracket
        stage={bracketStage}
        pairings={pairings}
        eventStatusKey={eventStatusKey}
        locale={locale}
        isOrganizationEdit={isOrganizationEdit}
        tournamentId={tournament?.id ?? null}
        eventId={event.id}
        onUpdated={onRefresh}
        goalLimits={tournament?.goalLimits as GoalLimitsConfig}
        canResolveDispute={canResolveDispute}
        scoreMode={event.templateType === "PADEL" ? "PADEL" : "GOALS"}
      />

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

      {showSponsors && !hasHeroSponsor && sideSponsors.length === 0 && (
        <SponsorsStrip organization={organization} locale={locale} />
      )}

      {isOrganizationEdit && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">{t("liveOpsLabel", locale)}</h3>
            <span className="text-xs text-white/50">{t("roleOrganization", locale)}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Agora a jogar</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={featuredDraft ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFeaturedDraft(value ? Number(value) : null);
                }}
                className="min-w-[220px] flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="">{t("liveOpsAutoMode", locale)}</option>
                {flatMatches
                  .filter((m) => m.pairing1Id && m.pairing2Id)
                  .sort(compareMatchOrder)
                  .map((match) => {
                    const label = `${pairingLabelPlain(match.pairing1Id, pairings)} vs ${pairingLabelPlain(match.pairing2Id, pairings)}`;
                    return (
                      <option key={`featured-${match.id}`} value={match.id}>
                        #{match.id} · {label || t("matchLabel", locale)}
                      </option>
                    );
                  })}
              </select>
              <button
                type="button"
                disabled={savingConfig}
                onClick={() => saveFeaturedMatch(featuredDraft ?? null)}
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:border-white/40 disabled:opacity-60"
              >
                {savingConfig ? t("matchSaving", locale) : t("liveOpsApplyOverride", locale)}
              </button>
              <button
                type="button"
                disabled={savingConfig}
                onClick={() => saveFeaturedMatch(null)}
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/60 hover:border-white/40 disabled:opacity-60"
              >
                {t("liveOpsResetAuto", locale)}
              </button>
            </div>
            {featuredMatchId && (
              <p className="text-[11px] text-white/50">
                {t("liveOpsOverrideActive", locale).replace("{id}", String(featuredMatchId))}
              </p>
            )}
          </div>
          {configMessage && <p className="text-xs text-white/60">{configMessage}</p>}
          {canManageLiveConfig ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t("liveOpsStreamUrlLabel", locale)}</label>
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
                      {t("liveOpsTestEmbed", locale)}
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t("mainSponsor", locale)}</label>
                  <input
                    value={sponsorDraft?.hero?.label ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        hero: { ...(prev?.hero ?? {}), label: e.target.value },
                      }))
                    }
                    placeholder={t("liveOpsSponsorNamePlaceholder", locale)}
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
                    placeholder={t("liveOpsSponsorLogoPlaceholder", locale)}
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
                    placeholder={t("liveOpsSponsorLinkPlaceholder", locale)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">{t("liveOpsNowPlayingSponsor", locale)}</label>
                  <input
                    value={sponsorDraft?.nowPlaying?.label ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        nowPlaying: { ...(prev?.nowPlaying ?? {}), label: e.target.value },
                      }))
                    }
                    placeholder={t("liveOpsSponsorNamePlaceholder", locale)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={sponsorDraft?.nowPlaying?.logoUrl ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        nowPlaying: { ...(prev?.nowPlaying ?? {}), logoUrl: e.target.value },
                      }))
                    }
                    placeholder={t("liveOpsSponsorLogoPlaceholder", locale)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={sponsorDraft?.nowPlaying?.url ?? ""}
                    onChange={(e) =>
                      setSponsorDraft((prev) => ({
                        ...(prev ?? {}),
                        nowPlaying: { ...(prev?.nowPlaying ?? {}), url: e.target.value },
                      }))
                    }
                    placeholder={t("liveOpsSponsorLinkPlaceholder", locale)}
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
                        {t("liveOpsSideSponsor", locale).replace(
                          "{side}",
                          slotKey === "sideA" ? "A" : "B",
                        )}
                      </label>
                      <input
                        value={slot?.label ?? ""}
                        onChange={(e) =>
                          setSponsorDraft((prev) => ({
                            ...(prev ?? {}),
                            [slotKey]: { ...(slot ?? {}), label: e.target.value },
                          }))
                        }
                        placeholder={t("liveOpsSponsorNamePlaceholder", locale)}
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
                        placeholder={t("liveOpsSponsorLogoPlaceholder", locale)}
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
                        placeholder={t("liveOpsSponsorLinkPlaceholder", locale)}
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  );
                })}
              </div>

              {!isPadelLive && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{t("liveOpsGoalsRules", locale)}</p>
                    <h4 className="text-sm font-semibold text-white">{t("liveOpsGoalsLimitTitle", locale)}</h4>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-sm text-white/70">
                      <span>{t("liveOpsGoalsDefaultLabel", locale)}</span>
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
                        <span>{roundLabelMap[round] || roundFallback(round)}</span>
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
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={saveLiveConfig}
                  className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60"
                >
                  {savingConfig ? t("matchSaving", locale) : t("liveOpsSaveConfig", locale)}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-white/50">{t("liveOpsAdminOnly", locale)}</p>
          )}
        </section>
      )}
    </div>
  );
}

export default function EventLiveClient({
  slug,
  variant = "full",
  locale: localeOverride,
}: {
  slug: string;
  variant?: "full" | "inline";
  locale?: string | null;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = resolveLocale(localeOverride ?? searchParams?.get("lang"));
  const { isLoggedIn } = useUser();
  const { openModal } = useAuthModal();
  const [showFullBracket, setShowFullBracket] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [startingMatchId, setStartingMatchId] = useState<number | null>(null);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const isTv = searchParams?.get("tv") === "1";
  const isOrganizationRoute = Boolean(pathname && pathname.startsWith("/organizacao/"));
  const [nowMs, setNowMs] = useState(() => Date.now());

  const url = useMemo(() => `/api/livehub/${slug}`, [slug]);
  const { data, error, mutate } = useSWR(url, fetcher, { refreshInterval: 10000 });
  const onRefresh = () => {
    void mutate();
  };

  const organization = (data?.organization as
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
  const tournament = data?.tournament ?? null;
  const tournamentStages = useMemo(() => {
    if (!tournament?.stages) return [];
    return tournament.stages.map((stage: any) => {
      const shouldResolve = stage.stageType === "PLAYOFF";
      const matches = Array.isArray(stage.matches)
        ? shouldResolve
          ? resolveBracketAdvancement(stage.matches)
          : stage.matches
        : [];
      return { ...stage, matches };
    });
  }, [tournament]);
  const tournamentView = tournament ? { ...tournament, stages: tournamentStages } : null;
  const pairings: Record<number, PairingMeta> = data?.pairings || {};

  useEffect(() => {
    setIsFollowing(Boolean(organization?.isFollowed));
  }, [organization?.isFollowed]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return <div className="p-4 text-white/70">{t("liveLoadError", locale)}</div>;
  }
  if (!data) {
    return <div className="p-4 text-white/70">{t("loadingLabel", locale)}</div>;
  }
  if (!data?.ok) {
    return <div className="p-4 text-white/70">{t("liveUnavailable", locale)}</div>;
  }

  const event: EventPayload = data.event;
  const viewerRole: LiveHubViewerRole = data.viewerRole;
  const canEditMatches = Boolean(data?.canEditMatches);
  const organizationRole = typeof data?.organizationRole === "string" ? data.organizationRole : null;
  const canPostAnnouncements =
    organizationRole !== null &&
    ["OWNER", "CO_OWNER", "ADMIN", "STAFF", "TRAINER"].includes(organizationRole);
  const canManageLiveConfig =
    organizationRole === "OWNER" || organizationRole === "CO_OWNER" || organizationRole === "ADMIN";
  const canResolveDispute = canManageLiveConfig;
  const liveHub = data.liveHub as { modules: LiveHubModule[]; mode: "DEFAULT" | "PREMIUM" };
  const pairingIdFromQuery = searchParams?.get("pairingId");
  const showCourt = event.templateType === "PADEL";
  const ticketCopy = getTicketCopy(showCourt ? "PADEL" : "DEFAULT");
  const locationLabel = event.addressRef?.formattedAddress ?? null;

  if (access?.liveHubAllowed === false) {
    const visibility = access?.liveHubVisibility ?? "PUBLIC";
    const message =
      visibility === "DISABLED"
        ? t("liveHubDisabled", locale)
        : visibility === "PRIVATE"
          ? t("liveHubPrivate", locale)
          : t("liveHubUnavailable", locale);
    return (
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-white/70 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{t("accessRestrictedLabel", locale)}</p>
        <h2 className="text-xl font-semibold text-white">{t("liveHubUnavailableTitle", locale)}</h2>
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
    if (!organization) return;
    if (!ensureAuthForFollow()) return;
    const next = !isFollowing;
    setFollowPending(true);
    setIsFollowing(next);
    try {
      const res = await fetch(next ? "/api/social/follow-organization" : "/api/social/unfollow-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
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

  if (isTv && tournamentView) {
    return (
      <LiveHubTv event={event} tournament={tournamentView} pairings={pairings} timeZone={timeZone} locale={locale} showCourt={showCourt} />
    );
  }

  const flatMatches: MatchPayload[] = tournamentView
    ? tournamentView.stages.flatMap((s: any) => [...s.matches, ...s.groups.flatMap((g: any) => g.matches)])
    : [];

  const roundsGlobal = Array.from(new Set(flatMatches.map((m) => m.round ?? 0)))
    .filter((r) => r > 0)
    .sort((a, b) => a - b);
  const roundIsCompleteGlobal = (round: number) => {
    const list = flatMatches.filter((m) => (m.round ?? 0) === round);
    return list.length > 0 && list.every((m) => m.status === "DONE");
  };
  const roundIsLockedGlobal = (round: number) => {
    const idx = roundsGlobal.indexOf(round);
    if (idx <= 0) return false;
    return roundsGlobal.slice(0, idx).some((r) => !roundIsCompleteGlobal(r));
  };

  const liveMatches = flatMatches.filter((m) => m.status === "IN_PROGRESS" || m.status === "LIVE");
  const completedMatches = flatMatches.filter((m) => m.status === "DONE");
  const byUpdatedAtDesc = (a: MatchPayload, b: MatchPayload) =>
    a.updatedAt && b.updatedAt ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : 0;
  const latestCompletedMatch = completedMatches.slice().sort(byUpdatedAtDesc)[0] ?? null;
  const defaultNowMatch = liveMatches.sort(compareMatchOrder)[0] ?? latestCompletedMatch;
  const isOneVOne = false;
  const featuredMatchId = typeof tournamentView?.featuredMatchId === "number" ? tournamentView.featuredMatchId : null;
  const featuredMatch = featuredMatchId ? flatMatches.find((m) => m.id === featuredMatchId) ?? null : null;
  const featuredActive =
    featuredMatch && featuredMatch.status !== "DONE" && featuredMatch.status !== "CANCELLED" ? featuredMatch : null;
  const autoNowMatch = defaultNowMatch;
  const nowMatch = featuredActive ?? autoNowMatch;

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

  const modules: LiveHubModule[] = Array.isArray(liveHub?.modules) ? (liveHub.modules as LiveHubModule[]) : [];
  const resolvedModules: LiveHubModule[] =
    event.liveStreamUrl && !modules.includes("VIDEO") ? ["VIDEO", ...modules] : modules;
  const eventStatusKey = getEventStatusKey(event.startsAt, event.endsAt);
  const eventStatus = getEventStatusLabel(eventStatusKey, locale);
  const countdownLabel = formatCountdown(event.startsAt, nowMs);
  const goalLimits = normalizeGoalLimits(tournamentView?.goalLimits as GoalLimitsConfig);
  const sponsors = (tournamentView?.sponsors as SponsorsConfig) ?? null;
  const derivedChampionPairingId = (() => {
    if (!tournamentView?.stages?.length) return null;
    const playoffStages = tournamentView.stages.filter(
      (stage: any) => stage.stageType === "PLAYOFF" && stage.matches?.length,
    );
    const bracketStage =
      playoffStages[playoffStages.length - 1] ?? tournamentView.stages.find((stage: any) => stage.matches?.length);
    if (!bracketStage?.matches?.length) return null;
    const maxRound = Math.max(...bracketStage.matches.map((match: MatchPayload) => match.round ?? 0));
    if (!Number.isFinite(maxRound) || maxRound <= 0) return null;
    const finalMatch = bracketStage.matches
      .filter((match: MatchPayload) => (match.round ?? 0) === maxRound)
      .sort((a: MatchPayload, b: MatchPayload) => b.id - a.id)[0];
    if (!finalMatch || finalMatch.status !== "DONE") return null;
    const winnerSide = getWinnerSide(finalMatch.score);
    if (!winnerSide) return null;
    return winnerSide === "A" ? finalMatch.pairing1Id ?? null : finalMatch.pairing2Id ?? null;
  })();
  const championLabel = tournamentView?.championPairingId
    ? pairingLabelPlain(tournamentView.championPairingId, pairings) || null
    : derivedChampionPairingId
      ? pairingLabelPlain(derivedChampionPairingId, pairings) || null
      : null;
  const isOrganizationEdit =
    viewerRole === "ORGANIZATION" && canEditMatches && isOrganizationRoute && searchParams?.get("edit") === "1";
  const organizationEditHref = (() => {
    const defaultBase =
      event.templateType === "PADEL"
        ? `/organizacao/padel/torneios/${event.id}/live`
        : `/organizacao/eventos/${event.id}/live`;
    const base = isOrganizationRoute && pathname ? pathname : defaultBase;
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", "preview");
    params.set("edit", "1");
    const rawHref = `${base}?${params.toString()}`;
    return appendOrganizationIdToHref(rawHref, organization?.id ?? null);
  })();
  const pendingMatches = flatMatches
    .filter((match) => match.status === "PENDING" || match.status === "SCHEDULED")
    .sort(compareMatchOrder);
  const firstPlayableMatch = pendingMatches.find((match) => match.pairing1Id && match.pairing2Id) ?? null;

  const startFirstMatch = async () => {
    if (!tournamentView || !firstPlayableMatch) {
      setStartMessage(t("liveOpsNoPlayable", locale));
      return;
    }
    if (event.templateType !== "PADEL" && !firstPlayableMatch.updatedAt) {
      setStartMessage(t("matchVersionMissing", locale));
      return;
    }
    setStartingMatchId(firstPlayableMatch.id);
    setStartMessage(null);
    try {
      const res =
        event.templateType === "PADEL"
          ? await fetch("/api/padel/matches", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: firstPlayableMatch.id,
                status: "IN_PROGRESS",
              }),
            })
          : await fetch(
              `/api/organizacao/tournaments/${tournamentView.id}/matches/${firstPlayableMatch.id}/result`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "IN_PROGRESS",
                  expectedUpdatedAt: firstPlayableMatch.updatedAt,
                }),
              },
            );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setStartMessage(json?.error || t("liveOpsStartError", locale));
        return;
      }
      setStartMessage(t("liveOpsStartSuccess", locale));
      mutate();
    } catch {
      setStartMessage(t("liveOpsStartError", locale));
    } finally {
      setStartingMatchId(null);
    }
  };
  const nextPendingLabel = firstPlayableMatch
    ? [pairingLabelPlain(firstPlayableMatch.pairing1Id, pairings), pairingLabelPlain(firstPlayableMatch.pairing2Id, pairings)]
        .filter(Boolean)
        .join(" vs ")
    : null;

  if (variant === "inline" && !isOneVOne) {
    const hero = sponsors?.hero;
    const inlineStatus = nowMatch
      ? nowMatch.status === "IN_PROGRESS" || nowMatch.status === "LIVE"
        ? t("liveNowLabel", locale)
        : t("latestLabel", locale)
      : t("noneLabel", locale);
    return (
      <div className="space-y-4">
        {hero && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <a
              href={hero.url || undefined}
              target={hero.url ? "_blank" : undefined}
              rel={hero.url ? "noreferrer" : undefined}
              className="flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{t("mainSponsor", locale)}</p>
                {hero.label && <p className="text-white/80">{hero.label}</p>}
              </div>
              {hero.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hero.logoUrl}
                  alt={hero.label || "Sponsor"}
                  className="h-10 w-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 object-contain"
                />
              )}
            </a>
          </section>
        )}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{t("nowPlaying", locale)}</h3>
            <span className="text-xs text-white/50">{inlineStatus}</span>
          </div>
          {!nowMatch && <p className="text-sm text-white/60">{t("noLiveMatches", locale)}</p>}
          {nowMatch && (
            <MatchCard
              match={nowMatch}
              pairings={pairings}
              timeZone={timeZone}
              locale={locale}
              size="lg"
              showCourt={showCourt}
            />
          )}
        </section>
      </div>
    );
  }

  if (isOneVOne) {
    const showSponsors = resolvedModules.includes("SPONSORS");
    return (
      <div className="space-y-6">
        {variant === "full" && viewerRole === "ORGANIZATION" && canEditMatches && isOrganizationRoute && !isOrganizationEdit && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            {t("liveOpsPublicMode", locale)}{" "}
            <Link href={organizationEditHref} className="text-white underline">
              {t("liveOpsActivateOverlay", locale)}
            </Link>
            .
          </div>
        )}
        {variant === "full" && viewerRole === "ORGANIZATION" && canEditMatches && isOrganizationRoute && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{t("liveOpsKickoffLabel", locale)}</p>
                <p className="text-sm text-white/70">{t("liveOpsKickoffHint", locale)}</p>
                {nextPendingLabel && (
                  <p className="text-[11px] text-white/50">{t("nextLabel", locale)}: {nextPendingLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={startFirstMatch}
                disabled={!firstPlayableMatch || Boolean(startingMatchId)}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60"
              >
                {startingMatchId ? t("liveOpsStarting", locale) : t("liveOpsStartLabel", locale)}
              </button>
            </div>
            {startMessage && <p className="mt-2 text-[11px] text-white/60">{startMessage}</p>}
          </section>
        )}
        <OneVOneLiveLayout
          event={event}
          organization={organization}
          tournament={tournamentView}
          pairings={pairings}
          eventStatusKey={eventStatusKey}
          locale={locale}
          countdownLabel={countdownLabel}
          nowMatch={nowMatch}
          championLabel={championLabel}
          sponsors={sponsors}
          onToggleFollow={toggleFollow}
          followPending={followPending}
          isFollowing={isFollowing}
          showSponsors={showSponsors}
          isOrganizationEdit={isOrganizationEdit}
          canManageLiveConfig={canManageLiveConfig}
          canPostAnnouncements={canPostAnnouncements}
          canResolveDispute={canResolveDispute}
          onRefresh={() => mutate()}
          variant={variant}
        />

      </div>
    );
  }

  const renderModule = (mod: LiveHubModule) => {
    switch (mod) {
      case "HERO": {
        const statusTone =
          eventStatusKey === "LIVE"
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
            : eventStatusKey === "UPCOMING"
              ? "border-sky-400/40 bg-sky-500/10 text-sky-100"
              : eventStatusKey === "DONE"
                ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                : "border-white/15 bg-white/5 text-white/70";
        return (
          <section key="hero" className="rounded-3xl border border-white/10 bg-black/40 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("liveHubLabel", locale)}</p>
                <h1 className="text-2xl font-semibold text-white md:text-3xl">{event.title}</h1>
                <p className="text-white/70 text-sm">{formatDateRange(event.startsAt, event.endsAt, locale, timeZone)}</p>
                {locationLabel && (
                  <p className="text-white/50 text-sm">{locationLabel}</p>
                )}
                {eventStatusKey === "UPCOMING" && countdownLabel && (
                  <p className="text-sm text-white/60">{t("eventStartsIn", locale)} {countdownLabel}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={viewerRole} locale={locale} />
                <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${statusTone}`}>
                  {eventStatus}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
                  {t("autoModeLabel", locale)}
                </span>
              </div>
            </div>

            {organization && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <Avatar
                  src={organization.brandingAvatarUrl}
                  name={organization.publicName || t("roleOrganization", locale)}
                  className="h-10 w-10 border border-white/10"
                  textClassName="text-xs font-semibold uppercase tracking-[0.16em] text-white/80"
                  fallbackText="OR"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                    {t("organizedByLabel", locale)}
                  </p>
                  <p className="text-white font-medium">{organization.publicName}</p>
                  {organization.username && <p className="text-white/50 text-xs">@{organization.username}</p>}
                </div>
              </div>
            )}
          </section>
        );
      }
      case "VIDEO": {
        const streamEmbed = getStreamEmbed(event.liveStreamUrl);
        const embedUrl = streamEmbed.embedUrl;
        const streamHref = streamEmbed.href;
        const streamLabel =
          streamEmbed.provider === "youtube"
            ? t("openYoutube", locale)
            : streamEmbed.provider === "twitch"
              ? t("openTwitch", locale)
              : t("openStream", locale);
        if (!embedUrl) {
          return (
            <section key="video" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{t("liveLabel", locale)}</p>
                <h2 className="text-lg font-semibold text-white">{t("liveStartsSoon", locale)}</h2>
              </div>
              <p className="text-sm text-white/60">{t("liveStartsSoonDesc", locale)}</p>
              {streamHref && (
                <a
                  href={streamHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                >
                  {streamLabel}
                </a>
              )}
              {organization && (
                <button
                  type="button"
                  disabled={followPending}
                  onClick={toggleFollow}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60"
                >
                  {followPending
                    ? t("followUpdating", locale)
                    : isFollowing
                      ? t("followedLabel", locale)
                      : t("followToNotify", locale)}
                </button>
              )}
            </section>
          );
        }
        return (
          <section key="video" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{t("liveLabel", locale)}</p>
                <h2 className="text-lg font-semibold text-white">{t("watchNow", locale)}</h2>
              </div>
              {streamHref && (
                <a
                  href={streamHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                >
                  {streamLabel}
                </a>
              )}
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
              <iframe
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                title={t("watchStream", locale)}
              />
            </div>
          </section>
        );
      }
      case "NOW_PLAYING": {
        if (!tournamentView) {
          return (
            <EmptyCard key="now" title={t("nowPlaying", locale)}>
              {t("noTournamentLinked", locale)}
            </EmptyCard>
          );
        }
        return (
          <section key="now" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t("nowPlaying", locale)}</h2>
              <span className="text-xs text-white/50">
                {liveMatches.length} {t("matches", locale)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {liveMatches.length === 0 && <p className="text-white/60">{t("noLiveMatches", locale)}</p>}
              {liveMatches.map((match) => (
                <MatchCard key={`now-${match.id}`} match={match} pairings={pairings} timeZone={timeZone} locale={locale} highlight showCourt={showCourt} />
              ))}
            </div>
          </section>
        );
      }
      case "NEXT_MATCHES": {
        if (!tournamentView) {
          return (
            <EmptyCard key="next" title={t("upcomingMatches", locale)}>
              {t("noTournamentLinked", locale)}
            </EmptyCard>
          );
        }
        return (
          <section key="next" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t("upcomingMatches", locale)}</h2>
              <span className="text-xs text-white/50">
                {upcomingMatches.length} {t("matches", locale)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {upcomingMatches.length === 0 && <p className="text-white/60">{t("noUpcomingMatches", locale)}</p>}
              {upcomingMatches.map((match) => {
                const highlight =
                  (pairingIdFromQuery &&
                    (`${match.pairing1Id}` === pairingIdFromQuery || `${match.pairing2Id}` === pairingIdFromQuery)) ||
                  (tournamentView?.userPairingId &&
                    (match.pairing1Id === tournamentView.userPairingId || match.pairing2Id === tournamentView.userPairingId));
                return (
                  <MatchCard
                    key={`next-${match.id}`}
                    match={match}
                    pairings={pairings}
                    highlight={highlight}
                    timeZone={timeZone}
                    locale={locale}
                    showCourt={showCourt}
                  />
                );
              })}
            </div>
          </section>
        );
      }
      case "RESULTS": {
        if (!tournamentView) {
          return (
            <EmptyCard key="results" title={t("resultsLabel", locale)}>
              {t("noTournamentLinked", locale)}
            </EmptyCard>
          );
        }
        return (
          <section key="results" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t("recentResults", locale)}</h2>
              <span className="text-xs text-white/50">
                {recentResults.length} {t("matches", locale)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {recentResults.length === 0 && <p className="text-white/60">{t("noResults", locale)}</p>}
              {recentResults.map((match) => (
                <MatchCard key={`res-${match.id}`} match={match} pairings={pairings} timeZone={timeZone} locale={locale} showCourt={showCourt} />
              ))}
            </div>
          </section>
        );
      }
      case "BRACKET": {
        if (!tournamentView) {
          return (
            <EmptyCard key="bracket" title={t("bracket", locale)}>
              {t("noTournamentLinked", locale)}
            </EmptyCard>
          );
        }
        const stages = tournamentView.stages ?? [];
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
            return tournamentView?.userPairingId ?? null;
          })();
          return (
            <section key="bracket" className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{t("bracket", locale)}</p>
                  <h2 className="text-lg font-semibold text-white">{t("fullBracket", locale)}</h2>
                </div>
                {bracketHasEarlyRounds && (
                  <button
                    type="button"
                    onClick={() => setShowFullBracket((prev) => !prev)}
                    className="hidden md:inline-flex rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                  >
                    {showFullBracket ? t("showLess", locale) : t("showFullBracket", locale)}
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {bracketStages.map((stage: any) => {
                  if (!stage.matches.length) return null;
                  return (
                    <div key={stage.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold">{stage.name || t("playoffsLabel", locale)}</h3>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                      </div>
                      <BracketRoundsView
                        matches={stage.matches}
                        pairings={pairings}
                        isOrganizationEdit={isOrganizationEdit}
                        tournamentId={tournamentView?.id ?? null}
                        eventId={event.id}
                        onUpdated={onRefresh}
                        goalLimits={goalLimits}
                        locale={locale}
                        highlightPairingId={highlightPairingId}
                        canResolveDispute={canResolveDispute}
                        scoreMode={event.templateType === "PADEL" ? "PADEL" : "GOALS"}
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
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{t("standings", locale)}</p>
                <h2 className="text-lg font-semibold text-white">{t("groupStandings", locale)}</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {stages.map((stage: any) =>
                  stage.groups?.map((group: any) => (
                    <div key={`group-${group.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold">{group.name || t("groupLabel", locale)}</h3>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">{stage.stageType}</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(group.standings ?? []).length === 0 && (
                          <p className="text-sm text-white/60">{t("noStandings", locale)}</p>
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

        return (
          <EmptyCard key="bracket" title={t("bracket", locale)}>
            {t("noBracket", locale)}
          </EmptyCard>
        );
      }
      case "CHAMPION": {
        if (!tournamentView) {
          return (
            <EmptyCard key="champ" title={t("championLabel", locale)}>
              {t("noTournamentLinked", locale)}
            </EmptyCard>
          );
        }
        const championId = (tournamentView.championPairingId as number | null) ?? derivedChampionPairingId;
        const meta = pairingMeta(championId, pairings);
        if (!championId || !meta) {
          return (
            <EmptyCard key="champ" title={t("championLabel", locale)}>
              {t("noChampion", locale)}
            </EmptyCard>
          );
        }
        return (
          <section key="champ" className="rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,rgba(255,215,120,0.12),rgba(20,20,20,0.8))] p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-300/10 text-2xl">
                🏆
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/70">{t("championLabel", locale)}</p>
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
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{t("summaryLabel", locale)}</p>
            <h2 className="text-lg font-semibold text-white">{t("aboutEventTitle", locale)}</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              {event.description?.trim() || t("descriptionSoon", locale)}
            </p>
          </section>
        );
      }
      case "CTA": {
        const ctaCopy =
          viewerRole === "PUBLIC"
            ? ticketCopy.isPadel
              ? t("ctaPublicPadel", locale)
              : t("ctaPublicTicket", locale)
            : t("liveHubParticipantHint", locale);
        const ctaLabel =
          viewerRole === "PUBLIC"
            ? ticketCopy.isPadel
              ? ticketCopy.buyLabel
              : t("ctaPublicTicketAction", locale)
            : ticketCopy.isPadel
              ? t("ctaMemberPadel", locale)
              : t("ctaMemberTicket", locale);
        return (
          <section key="cta" className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">{t("ctaParticipationLabel", locale)}</p>
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
        return <SponsorsStrip organization={organization} locale={locale} />;
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {resolvedModules.map((mod) => renderModule(mod))}

      {viewerRole === "ORGANIZATION" && canEditMatches && tournamentView && isOrganizationRoute && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{t("liveOpsQuickManageTitle", locale)}</h2>
            <span className="text-xs text-white/50">{t("roleOrganization", locale)}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{t("liveOpsKickoffLabel", locale)}</p>
                <p className="text-sm text-white/70">{t("liveOpsKickoffHint", locale)}</p>
                {nextPendingLabel && (
                  <p className="text-[11px] text-white/50">{t("nextLabel", locale)}: {nextPendingLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={startFirstMatch}
                disabled={!firstPlayableMatch || Boolean(startingMatchId)}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-[12px] font-semibold text-emerald-100 hover:border-emerald-300/70 disabled:opacity-60"
              >
                {startingMatchId ? t("liveOpsStarting", locale) : t("liveOpsStartLabel", locale)}
              </button>
            </div>
            {startMessage && <p className="mt-2 text-[11px] text-white/60">{startMessage}</p>}
          </div>
          <div className="space-y-3">
            {flatMatches
              .filter((m) => m.status !== "DONE")
              .slice(0, 6)
              .map((match) => (
                <div key={`edit-${match.id}`} className="space-y-2">
                  <MatchCard match={match} pairings={pairings} timeZone={timeZone} locale={locale} showCourt={showCourt} />
                  {event.templateType === "PADEL" ? (
                    <PadelMatchEditor
                      match={match}
                      eventId={event.id}
                      onUpdated={() => mutate()}
                      locked={roundIsLockedGlobal(match.round ?? 0) || match.status === "DISPUTED"}
                      lockedReason={
                        match.status === "DISPUTED"
                          ? t("matchDisputeLocked", locale)
                          : roundIsLockedGlobal(match.round ?? 0)
                          ? t("matchPhaseInactive", locale)
                            : null
                      }
                      canResolveDispute={canResolveDispute}
                      locale={locale}
                    />
                  ) : (
                    <OrganizationMatchEditor
                      match={match}
                      tournamentId={tournamentView.id}
                      onUpdated={() => mutate()}
                      goalLimit={resolveGoalLimit(match.round ?? null, goalLimits)}
                      locked={roundIsLockedGlobal(match.round ?? 0) || match.status === "DISPUTED"}
                      lockedReason={
                        match.status === "DISPUTED"
                          ? t("matchDisputeLocked", locale)
                          : roundIsLockedGlobal(match.round ?? 0)
                          ? t("matchPhaseInactive", locale)
                            : null
                      }
                      canResolveDispute={canResolveDispute}
                      locale={locale}
                    />
                  )}
                </div>
              ))}
            {flatMatches.filter((m) => m.status !== "DONE").length === 0 && (
              <p className="text-white/60">{t("liveOpsNoPending", locale)}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
