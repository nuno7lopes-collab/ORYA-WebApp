"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { trackEvent } from "@/lib/analytics";
import { formatCurrency } from "@/lib/i18n";
import { fetchGeoAutocomplete, fetchGeoDetails } from "@/lib/geo/client";
import type { GeoAutocompleteItem, GeoDetailsItem } from "@/lib/geo/provider";
import { computeMatchSlots } from "@/lib/padel/capacityRecommendation";
import { Avatar } from "@/components/ui/avatar";
import { ActionBar } from "@/components/ui/action-bar";
import { CommandPalette } from "@/components/ui/command-palette";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { useToast } from "@/components/ui/toast-provider";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import {
  buildPadelCategoryKey,
  buildPadelDefaultCategories,
  sortPadelCategories,
} from "@/domain/padelDefaultCategories";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

type PadelClub = {
  id: number;
  name: string;
  city: string | null;
  addressId?: string | null;
  kind?: "OWN" | "PARTNER" | null;
  sourceClubId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  addressRef?: {
    id?: string;
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
    latitude?: number | null;
    longitude?: number | null;
    sourceProvider?: string | null;
    sourceProviderPlaceId?: string | null;
    confidenceScore?: number | null;
    validationStatus?: string | null;
  } | null;
  courtsCount: number;
  slug?: string | null;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string | Date;
};

type PadelClubCourt = {
  id: number;
  padelClubId: number;
  name: string;
  description: string | null;
  indoor: boolean;
  isActive: boolean;
  displayOrder: number;
};

type PadelClubStaff = {
  id: number;
  padelClubId: number;
  userId: string | null;
  email: string | null;
  fullName?: string | null;
  role: string;
  inheritToEvents: boolean;
};

type PadelCategory = {
  id: number;
  label: string;
  genderRestriction: string | null;
  minLevel: string | null;
  maxLevel: string | null;
  season?: string | null;
  year?: number | null;
  isActive: boolean;
  createdAt?: string | Date;
};

type Player = {
  id: number;
  userId?: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  gender?: string | null;
  level: string | null;
  isActive: boolean;
  createdAt: string | Date;
  tournamentsCount?: number;
  noShowCount?: number;
  profile?: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  crm?: {
    id: string;
    status: string;
    contactType?: string | null;
    tags: string[];
    totalSpentCents: number;
    totalTournaments: number;
    lastActivityAt: string | Date | null;
    marketingOptIn: boolean;
  } | null;
};

type Team = {
  id: number;
  name: string;
  level: string | null;
  isActive: boolean;
  padelClubId?: number | null;
  categoryId?: number | null;
  membersCount?: number;
  club?: { id: number; name: string } | null;
  category?: { id: number; label: string } | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type CommunityPost = {
  id: number;
  title?: string | null;
  body: string;
  kind: string;
  visibility: string;
  isPinned: boolean;
  padelClubId?: number | null;
  createdAt?: string | Date | null;
  author?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
  counts?: { comments: number; reactions: number } | null;
};

type OrganizationStaffMember = {
  userId: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
};

type OrganizationStaffResponse = {
  ok: boolean;
  items: OrganizationStaffMember[];
  viewerRole?: string | null;
  organizationId?: number | null;
};

type TrainerItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isPublished: boolean;
  reviewStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  reviewRequestedAt: string | null;
};

type TrainersResponse = {
  ok: boolean;
  items: TrainerItem[];
  error?: string;
};

type LessonService = {
  id: number;
  title: string | null;
  durationMinutes: number | null;
  unitPriceCents: number | null;
  currency: string | null;
  isActive: boolean;
  kind: string | null;
  categoryTag: string | null;
  instructor?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
  _count?: { bookings?: number; availabilities?: number } | null;
};

type ServicesResponse = {
  ok: boolean;
  items?: LessonService[];
  error?: string;
};

type PadelOperationMode = "CLUB_OWNER" | "ORGANIZER";
type ClubKind = "OWN" | "PARTNER";

type PadelConfigResponse = {
  ok: boolean;
  config: {
    eventId: number;
    organizationId: number;
    format: string;
    numberOfCourts: number;
    ruleSetId?: number | null;
    defaultCategoryId?: number | null;
    eligibilityType?: string | null;
    splitDeadlineHours?: number | null;
    enabledFormats?: string[] | null;
    isInterclub?: boolean | null;
    teamSize?: number | null;
    advancedSettings?: Record<string, any> | null;
  } | null;
};

type PadelEventSummary = {
  id: number;
  slug?: string | null;
  title: string;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  status?: string | null;
  padelClubName?: string | null;
  padelPartnerClubNames?: Array<string | null>;
  isInterclub?: boolean;
  teamSize?: number | null;
};

type PadelEventsResponse = {
  ok: boolean;
  items?: PadelEventSummary[];
  error?: string;
};

type PadelEventCategoryLink = {
  id: number;
  padelCategoryId: number | null;
  category?: { id: number; label: string } | null;
};

type PadelOverviewResponse = {
  ok: boolean;
  range?: string;
  currency?: string | null;
  totalTickets?: number;
  totalRevenueCents?: number;
  grossCents?: number;
  platformFeeCents?: number;
  processorFeeCents?: number;
  feesCents?: number;
  netRevenueCents?: number;
  eventsWithSalesCount?: number;
  activeEventsCount?: number;
  error?: string;
};

type PadelOpsSummaryResponse = {
  ok: boolean;
  summary?: {
    pendingSplitCount: number;
    pendingCount?: number;
    confirmedCount?: number;
    conversionRate?: number | null;
    avgMatchmakingMinutes?: number | null;
    waitlistCount: number;
    liveMatchesCount: number;
    delayedMatchesCount: number;
    refundPendingCount: number;
    invalidStateCount?: number;
    updatedAt: string;
  };
};

type CalendarBlock = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  label?: string | null;
  note?: string | null;
  kind?: string | null;
  padelClubId?: number | null;
  courtId?: number | null;
  courtName?: string | null;
  updatedAt?: string | Date | null;
};

type CalendarAvailability = {
  id: number;
  startAt: string | Date;
  endAt: string | Date;
  playerProfileId?: number | null;
  playerName?: string | null;
  playerEmail?: string | null;
  note?: string | null;
  updatedAt?: string | Date | null;
};

type CalendarMatch = {
  id: number;
  startTime?: string | Date | null;
  plannedStartAt?: string | Date | null;
  plannedEndAt?: string | Date | null;
  plannedDurationMinutes?: number | null;
  courtId?: number | null;
  courtName?: string | null;
  courtNumber?: string | number | null;
  status?: string | null;
  roundLabel?: string | null;
  groupLabel?: string | null;
  pairingAId?: number | null;
  pairingBId?: number | null;
  updatedAt?: string | Date | null;
  score?: Record<string, unknown> | null;
};

type CalendarConflict = {
  type: "block_block" | "block_match" | "availability_match" | "player_match" | "outside_event_window";
  aId: number;
  bId: number;
  summary: string;
};

type CalendarResponse = {
  ok: boolean;
  blocks: CalendarBlock[];
  availabilities: CalendarAvailability[];
  matches: CalendarMatch[];
  conflicts: CalendarConflict[];
  eventStartsAt?: string | Date | null;
  eventEndsAt?: string | Date | null;
  eventTimezone?: string | null;
  bufferMinutes?: number | null;
};

type PartnershipStatus = "PENDING" | "APPROVED" | "PAUSED" | "REVOKED" | "EXPIRED";

type PartnershipAgreement = {
  id: number;
  ownerOrganizationId: number;
  partnerOrganizationId: number;
  ownerClubId: number;
  partnerClubId: number | null;
  status: PartnershipStatus;
  startsAt: string | null;
  endsAt: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
  createdAt: string;
  policy?: {
    priorityMode: string;
    ownerOverrideAllowed: boolean;
    autoCompensationOnOverride: boolean;
    hardStopMinutesBeforeBooking: number;
  } | null;
  windowsCount?: number;
  activeWindowsCount?: number;
  activeGrantsCount?: number;
};

type PartnershipOverride = {
  id: number;
  agreementId: number;
  eventId: number | null;
  reasonCode: string;
  reason: string;
  executionStatus: string | null;
  createdAt: string;
  executedAt: string | null;
};

type PartnershipCompensationCase = {
  id: number;
  agreementId: number;
  overrideId: number | null;
  status: string;
  reasonCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type PartnershipsResponse = {
  ok: boolean;
  items?: PartnershipAgreement[];
  error?: string;
};

type PartnershipOverridesResponse = {
  ok: boolean;
  items?: PartnershipOverride[];
  compensationCases?: PartnershipCompensationCase[];
  error?: string;
};

const PADEL_TABS = [
  "create",
  "tournaments",
  "calendar",
  "manage",
  "clubs",
  "partnerships",
  "courts",
  "categories",
  "teams",
  "players",
  "community",
  "trainers",
  "lessons",
] as const;
type PadelTab = (typeof PADEL_TABS)[number];
type PadelToolMode = "CLUB" | "TOURNAMENTS";

const CLUB_TOOL_TABS: ReadonlyArray<PadelTab> = [
  "clubs",
  "partnerships",
  "courts",
  "players",
  "community",
  "trainers",
  "lessons",
];
const TOURNAMENTS_TOOL_TABS: ReadonlyArray<PadelTab> = [
  "create",
  "tournaments",
  "calendar",
  "manage",
  "players",
];
const TAB_LABELS: Record<PadelTab, string> = {
  create: "Criar torneio",
  tournaments: "Torneios",
  calendar: "Calendário",
  manage: "Gestão",
  clubs: "Clubes",
  partnerships: "Parcerias",
  courts: "Campos",
  categories: "Categorias",
  players: "Jogadores",
  teams: "Equipas",
  community: "Comunidade",
  trainers: "Treinadores",
  lessons: "Aulas",
};
const TOOL_SECTION_BY_MODE: Record<PadelToolMode, "padel-club" | "padel-tournaments"> = {
  CLUB: "padel-club",
  TOURNAMENTS: "padel-tournaments",
};
const CTA_PAD_PRIMARY = `${CTA_PRIMARY} px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed`;
const CTA_PAD_PRIMARY_SM = `${CTA_PRIMARY} px-3 py-1.5 text-[12px] disabled:opacity-60 disabled:cursor-not-allowed`;
const CTA_PAD_SECONDARY_SM = `${CTA_SECONDARY} px-3 py-2 text-[12px]`;
const MAIN_CATEGORY_LIMIT = 18;
const OPERATION_MODE_STORAGE_KEY = "orya_padel_operation_mode";

const resolvePadelTabParam = (value: string | null, toolMode: PadelToolMode): PadelTab | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase() as PadelTab;
  if (!PADEL_TABS.includes(normalized)) return null;
  if (toolMode === "TOURNAMENTS") {
    if (normalized === "categories" || normalized === "teams") return "manage";
    if (
      normalized === "clubs" ||
      normalized === "partnerships" ||
      normalized === "courts" ||
      normalized === "community" ||
      normalized === "trainers" ||
      normalized === "lessons"
    ) {
      return null;
    }
    return normalized;
  }
  if (normalized === "create" || normalized === "tournaments" || normalized === "calendar" || normalized === "manage") {
    return null;
  }
  return normalized;
};

type Props = {
  organizationId: number;
  organizationKind: string | null;
  toolMode: PadelToolMode;
  initialClubs: PadelClub[];
  initialPlayers: Player[];
};

const DEFAULT_FORM = {
  id: null as number | null,
  name: "",
  city: "",
  address: "",
  addressId: "" as string | "",
  locationProviderId: "",
  locationFormattedAddress: "",
  locationSourceProvider: null as string | null,
  locationConfidenceScore: null as number | null,
  locationValidationStatus: null as string | null,
  latitude: null as number | null,
  longitude: null as number | null,
  courtsCount: "1",
  isActive: true,
  slug: "",
  isDefault: false,
  kind: "OWN" as ClubKind,
  sourceClubId: null as number | null,
};

const DEFAULT_COURT_FORM = {
  id: null as number | null,
  name: "",
  description: "",
  indoor: false,
  isActive: true,
  displayOrder: 0,
};

const DEFAULT_STAFF_FORM = {
  id: null as number | null,
  email: "",
  staffMemberId: "",
  role: "STAFF",
  inheritToEvents: true,
};

const CATEGORY_GENDER_OPTIONS = [
  { value: "", label: "Sem restrição" },
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Feminino" },
  { value: "MIXED", label: "Misto" },
  { value: "MIXED_FREE", label: "Misto livre" },
];
const CATEGORY_LEVEL_OPTIONS = ["1", "2", "3", "4", "5", "6"];
const TRAINER_STATUS_LABEL: Record<TrainerItem["reviewStatus"], string> = {
  DRAFT: "Rascunho",
  PENDING: "Em revisão",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
};
const TRAINER_STATUS_TONE: Record<TrainerItem["reviewStatus"], string> = {
  DRAFT: "border-white/15 bg-white/5 text-white/60",
  PENDING: "border-amber-300/50 bg-amber-400/10 text-amber-100",
  APPROVED: "border-emerald-300/50 bg-emerald-400/10 text-emerald-100",
  REJECTED: "border-rose-300/50 bg-rose-400/10 text-rose-100",
};
const LESSON_DURATION_OPTIONS = [30, 60, 90, 120];
const LESSON_TAG = "AULAS";
const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  LIVE: "Live",
  COMPLETED: "Concluído",
  ARCHIVED: "Arquivado",
};

const badge = (tone: "green" | "amber" | "slate" = "slate") =>
  `rounded-full border px-2 py-[4px] text-[11px] ${
    tone === "green"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
    : tone === "amber"
        ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
        : "border-white/15 bg-white/10 text-white/70"
  }`;

const PARTNERSHIP_STATUS_LABEL: Record<PartnershipStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PAUSED: "Pausado",
  REVOKED: "Revogado",
  EXPIRED: "Expirado",
};

const PARTNERSHIP_STATUS_TONE: Record<PartnershipStatus, string> = {
  PENDING: "border-amber-300/60 bg-amber-500/10 text-amber-100",
  APPROVED: "border-emerald-300/60 bg-emerald-500/12 text-emerald-100",
  PAUSED: "border-orange-300/60 bg-orange-500/10 text-orange-100",
  REVOKED: "border-rose-300/60 bg-rose-500/12 text-rose-100",
  EXPIRED: "border-slate-300/40 bg-slate-500/10 text-slate-100",
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-[#0b1124]/50 to-[#050810]/70 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl ${className}`}
  />
);

const PadelTabSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <SkeletonBlock className="h-9 w-32" />
      <SkeletonBlock className="h-9 w-24" />
      <SkeletonBlock className="h-9 w-24" />
    </div>
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <SkeletonBlock className="h-[360px]" />
      <div className="space-y-3">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-14" />
        <SkeletonBlock className="h-24" />
      </div>
    </div>
    <div className="grid gap-2 md:grid-cols-3">
      <SkeletonBlock className="h-20" />
      <SkeletonBlock className="h-20" />
      <SkeletonBlock className="h-20" />
    </div>
  </div>
);

const formatDateTimeLocal = (value: string | Date) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const toIsoFromLocalInput = (value: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const formatZoned = (value: string | Date, timeZone: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString("pt-PT");
  }
};

const formatShortDate = (value?: string | Date | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
};

const getDelayInfo = (match: CalendarMatch) => {
  const score =
    match.score && typeof match.score === "object" && !Array.isArray(match.score)
      ? (match.score as Record<string, unknown>)
      : {};
  const statusRaw = typeof score.delayStatus === "string" ? score.delayStatus : null;
  const status = statusRaw === "DELAYED" || statusRaw === "RESCHEDULED" ? statusRaw : null;
  const reason = typeof score.delayReason === "string" ? score.delayReason : null;
  return { status, reason };
};

type TimelineItem = {
  id: string;
  kind: "match" | "block" | "availability";
  label: string;
  start: Date;
  end: Date;
  laneKey: string;
  laneLabel: string;
  courtId?: number | null;
  version?: string | Date | null;
  color: string;
};

type CalendarListItem = {
  id: string;
  kind: "match" | "block" | "availability";
  label: string;
  detail?: string | null;
  start: Date;
  end: Date;
  courtLabel?: string | null;
  conflict?: boolean;
  meta?: Record<string, string | null>;
};

const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
  a.start < b.end && b.start < a.end;

const TimelineView = ({
  blocks,
  availabilities,
  matches,
  timezone,
  dayStart,
  dayLabel,
  onDrop,
  laneHints = [],
  conflictMap,
  slotMinutes,
}: {
  blocks: CalendarBlock[];
  availabilities: CalendarAvailability[];
  matches: CalendarMatch[];
  timezone: string;
  dayStart: Date | null;
  dayLabel?: string | null;
  laneHints?: Array<{ key: string; label: string; courtId?: number | null }>;
  onDrop?: (payload: { id: string; kind: TimelineItem["kind"]; start: Date; end: Date; courtId?: number | null }) => void;
  conflictMap: Map<string, string[]>;
  slotMinutes: number;
}) => {
  if (!dayStart) {
    return <p className="text-[12px] text-white/60">Seleciona uma data válida.</p>;
  }
  const laneWidth = 100; // percent
  const dayLength = 24 * 60 * 60 * 1000;
  const startDay = new Date(dayStart);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(startDay.getTime() + dayLength);

  const toDate = (value?: string | Date | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const items: TimelineItem[] = [];
  const lanesSeed = laneHints.reduce<Record<string, { key: string; label: string; courtId?: number | null; items: TimelineItem[] }>>(
    (acc, hint) => {
      acc[hint.key] = { ...hint, items: [] };
      return acc;
    },
    {},
  );

  for (const b of blocks) {
    const s = toDate(b.startAt);
    const e = toDate(b.endAt);
    if (!s || !e) continue;
    const laneKey = b.courtId ? `court-${b.courtId}` : "block-generic";
    const laneLabel = b.courtName || (b.courtId ? `Campo ${b.courtId}` : "Campo");
    items.push({
      id: `block-${b.id}`,
      kind: "block",
      label: b.label || "Bloqueio",
      start: s,
      end: e,
      laneKey,
      laneLabel,
      courtId: b.courtId ?? null,
      version: b.updatedAt,
      color: "from-[#7b7bff]/25 to-[#7cf2ff]/30 border-white/20",
    });
  }
  for (const av of availabilities) {
    const s = toDate(av.startAt);
    const e = toDate(av.endAt);
    if (!s || !e) continue;
    const laneKey = "player-availability";
    const laneLabel = "Jogadores";
    items.push({
      id: `availability-${av.id}`,
      kind: "availability",
      label: av.playerName || av.playerEmail || "Jogador",
      start: s,
      end: e,
      laneKey,
      laneLabel,
      version: av.updatedAt,
      color: "from-[#f59e0b]/25 to-[#fde68a]/20 border-amber-200/40",
    });
  }
  for (const m of matches) {
    const s = toDate(m.startTime || m.plannedStartAt);
    if (!s) continue;
    const plannedEnd = toDate(m.plannedEndAt);
    const durationMinutes = Number.isFinite(m.plannedDurationMinutes) ? m.plannedDurationMinutes : 60;
    const e = plannedEnd || new Date(s.getTime() + (durationMinutes || 60) * 60 * 1000); // assume 1h se não houver fim
    const laneKey = m.courtId ? `court-${m.courtId}` : m.courtName ? `court-name-${m.courtName}` : m.courtNumber ? `court-num-${m.courtNumber}` : "match-generic";
    const laneLabel = m.courtName || (m.courtNumber ? `Campo ${m.courtNumber}` : m.courtId ? `Campo ${m.courtId}` : "Campo");
    items.push({
      id: `match-${m.id}`,
      kind: "match",
      label: `Jogo #${m.id}`,
      start: s,
      end: e,
      laneKey,
      laneLabel,
      courtId: m.courtId ?? null,
      version: m.updatedAt,
      color: "from-[#34d399]/25 to-[#059669]/25 border-emerald-200/40",
    });
  }

  const grouped = items.reduce<Record<string, { key: string; label: string; courtId?: number | null; items: TimelineItem[] }>>((acc, item) => {
    const existing = acc[item.laneKey] || lanesSeed[item.laneKey];
    if (!existing) {
      acc[item.laneKey] = { key: item.laneKey, label: item.laneLabel, courtId: item.courtId, items: [item] };
    } else {
      acc[item.laneKey] = { ...existing, items: [...(existing.items || []), item] };
    }
    return acc;
  }, lanesSeed);

  const lanes = Object.values(grouped).map((lane) => ({
    court: lane.label,
    courtId: lane.courtId,
    key: lane.key,
    items: (lane.items || []).sort((a, b) => a.start.getTime() - b.start.getTime()),
  }));

  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
  const snapToSlot = (date: Date) => {
    const minutes = date.getMinutes();
    const snapped = Math.round(minutes / slotMinutes) * slotMinutes;
    date.setMinutes(snapped, 0, 0);
    return date;
  };

  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(d);

  return (
    <div className="space-y-2">
      {lanes.length === 0 && <p className="text-[12px] text-white/60">Sem registos para hoje.</p>}
      {lanes.map((lane) => (
        <div
          key={lane.key || lane.court}
          className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            if (!onDrop) return;
            e.preventDefault();
            const payload = e.dataTransfer.getData("application/json");
            try {
                    const parsed = JSON.parse(payload);
                    const duration = parsed.durationMs ?? 0;
                    const rect = (e.currentTarget.querySelector(".timeline-lane") as HTMLElement)?.getBoundingClientRect();
                    if (!rect) return;
                    const relX = (e.clientX - rect.left) / rect.width;
              const newStart = snapToSlot(new Date(startDay.getTime() + relX * (endDay.getTime() - startDay.getTime())));
              const newEnd = new Date(newStart.getTime() + duration);
              onDrop({
                id: parsed.id,
                kind: parsed.kind,
                start: newStart,
                end: newEnd,
                courtId: lane.courtId,
              });
            } catch {
              // ignore
            }
          }}
        >
          <div className="flex items-center justify-between text-[12px] text-white/70">
            <span className="font-semibold">{lane.court}</span>
            <span className="text-white/50">{dayLabel || "Hoje"}</span>
          </div>
          <div className="timeline-lane relative h-16 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {lane.items.map((item) => {
              const left =
                clampPercent(((item.start.getTime() - startDay.getTime()) / (endDay.getTime() - startDay.getTime())) * laneWidth);
              const width =
                clampPercent(((item.end.getTime() - item.start.getTime()) / (endDay.getTime() - startDay.getTime())) * laneWidth);
            return (
              <div
                key={item.id}
                className={`absolute top-1 h-12 rounded-lg border px-2 py-1 text-[11px] text-white shadow ${item.color} bg-gradient-to-r ${
                  lane.items.length > 1 && lane.items.some((other) => other !== item && other.laneKey === item.laneKey && overlaps(item, other))
                    ? "ring-2 ring-red-400/70"
                    : ""
                } ${conflictMap.get(item.id)?.length ? "border-red-300/70 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]" : ""}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                title={`${item.label} · ${formatTime(item.start)} - ${formatTime(item.end)}`}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({
                        id: item.id,
                        kind: item.kind,
                        durationMs: item.end.getTime() - item.start.getTime(),
                        version: item.version,
                      }),
                    );
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  if (!onDrop) return;
                  e.preventDefault();
                  const payload = e.dataTransfer.getData("application/json");
                  try {
                    const parsed = JSON.parse(payload);
                    if (parsed.id !== item.id) return;
                    // simple drop keeps duration, aligns start to cursor
                    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                    const relX = (e.clientX - rect.left) / rect.width;
                    const newStart = snapToSlot(new Date(startDay.getTime() + relX * (endDay.getTime() - startDay.getTime())));
                    const duration = item.end.getTime() - item.start.getTime();
                    const newEnd = new Date(newStart.getTime() + duration);
                    onDrop({
                      id: item.id,
                      kind: item.kind,
                        start: newStart,
                        end: newEnd,
                        courtId: lane.courtId,
                      });
                    } catch {
                      // ignore
                    }
                  }}
              >
                  <p className="font-semibold leading-tight">{item.label}</p>
                  <p className="text-white/70">{formatTime(item.start)} - {formatTime(item.end)}</p>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-white/50">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const CalendarListView = ({
  items,
  timezone,
  onEditBlock,
  onEditAvailability,
  onDeleteBlock,
  onDeleteAvailability,
}: {
  items: CalendarListItem[];
  timezone: string;
  onEditBlock?: (id: string) => void;
  onEditAvailability?: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  onDeleteAvailability?: (id: string) => void;
}) => {
  if (!items.length) return <p className="text-[12px] text-white/60">Sem registos para este periodo.</p>;

  const formatDayKey = (date: Date) =>
    new Intl.DateTimeFormat("pt-PT", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const formatDayLabel = (date: Date) =>
    new Intl.DateTimeFormat("pt-PT", { timeZone: timezone, weekday: "long", day: "2-digit", month: "short" }).format(date);
  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat("pt-PT", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(date);

  const groups: Array<{ key: string; label: string; items: CalendarListItem[] }> = [];
  items.forEach((item) => {
    const key = formatDayKey(item.start);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({ key, label: formatDayLabel(item.start), items: [item] });
    } else {
      last.items.push(item);
    }
  });

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.key} className="rounded-2xl border border-white/12 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] uppercase tracking-[0.16em] text-white/60">{group.label}</p>
            <span className="text-[11px] text-white/50">{group.items.length} itens</span>
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
            {group.items.map((item) => (
              <div
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[12px] ${
                  item.conflict
                    ? "border-rose-400/60 bg-rose-500/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-[11px] text-white/60">
                    {formatTime(item.start)} — {formatTime(item.end)}
                  </p>
                  {item.detail && <p className="text-[11px] text-white/50">{item.detail}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.courtLabel && (
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/70">
                      {item.courtLabel}
                    </span>
                  )}
                  {item.conflict && (
                    <span className="rounded-full border border-rose-300/70 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-100">
                      Conflito
                    </span>
                  )}
                  {item.kind === "block" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditBlock?.(item.id)}
                        className="rounded-full border border-white/20 px-2 py-1 text-[10px] text-white/80 hover:border-white/40"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBlock?.(item.id)}
                        className="rounded-full border border-rose-300/60 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100 hover:border-rose-200/70"
                      >
                        Apagar
                      </button>
                    </>
                  )}
                  {item.kind === "availability" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditAvailability?.(item.id)}
                        className="rounded-full border border-white/20 px-2 py-1 text-[10px] text-white/80 hover:border-white/40"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAvailability?.(item.id)}
                        className="rounded-full border border-rose-300/60 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100 hover:border-rose-200/70"
                      >
                        Apagar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const normalizeSlug = (value: string) => {
  const base =
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "clube";
  return base;
};

const buildSlugCandidates = (value: string, limit = 15) => {
  const base = normalizeSlug(value || "clube");
  const list: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    list.push(i === 0 ? base : `${base}${i}`);
  }
  return list;
};

const fetchCourtsForClub = async (clubId: number): Promise<PadelClubCourt[]> => {
  try {
    const res = await fetch(`/api/padel/clubs/${clubId}/courts`);
    const json = await res.json().catch(() => null);
    if (res.ok && Array.isArray(json?.items)) {
      return json.items as PadelClubCourt[];
    }
  } catch (err) {
    console.error("[padel/clubs] fetchCourtsForClub", err);
  }
  return [];
};

export default function PadelHubClient({
  organizationId,
  organizationKind,
  toolMode,
  initialClubs,
  initialPlayers,
}: Props) {
  const { pushToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const padelSectionParam = searchParams?.get("padel") || null;
  const eventIdParam = searchParams?.get("eventId") || null;
  const eventId = eventIdParam && Number.isFinite(Number(eventIdParam)) ? Number(eventIdParam) : null;
  const allowedTabs = toolMode === "CLUB" ? CLUB_TOOL_TABS : TOURNAMENTS_TOOL_TABS;
  const resolvedPadelTab = resolvePadelTabParam(padelSectionParam, toolMode);
  const defaultTab = toolMode === "TOURNAMENTS" ? (eventId ? "calendar" : "tournaments") : "clubs";
  const fallbackTab = (allowedTabs.includes(defaultTab as PadelTab) ? defaultTab : allowedTabs[0]) as PadelTab;
  const initialTab = resolvedPadelTab && allowedTabs.includes(resolvedPadelTab) ? resolvedPadelTab : fallbackTab;
  const activeSection = TOOL_SECTION_BY_MODE[toolMode];

  const [activeTab, setActiveTab] = useState<PadelTab>(initialTab);
  const [switchingTab, setSwitchingTab] = useState(false);
  const [showOpsDrawer, setShowOpsDrawer] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const toast = (msg: string, tone: "ok" | "err" | "warn" = "ok") => {
    pushToast(msg, {
      variant: tone === "ok" ? "success" : tone === "warn" ? "warning" : "error",
    });
  };
  const [clubs, setClubs] = useState<PadelClub[]>(initialClubs);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [teams, setTeams] = useState<Team[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const defaultOperationMode: PadelOperationMode =
    organizationKind === "CLUBE_PADEL" ? "CLUB_OWNER" : "ORGANIZER";
  const [operationMode, setOperationMode] = useState<PadelOperationMode>(defaultOperationMode);
  const [operationModeReady, setOperationModeReady] = useState(false);
  const [categories, setCategories] = useState<PadelCategory[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<
      number,
      {
        label: string;
        genderRestriction: string;
        minLevel: string;
        maxLevel: string;
        season: string;
        year: string;
        isActive: boolean;
      }
    >
  >({});
  const [categoryForm, setCategoryForm] = useState({
    label: "",
    genderRestriction: "",
    minLevel: "",
    maxLevel: "",
    season: "",
    year: "",
    isActive: true,
  });
  const [categoryQuickGender, setCategoryQuickGender] = useState("MALE");
  const [categoryQuickLevel, setCategoryQuickLevel] = useState(CATEGORY_LEVEL_OPTIONS[0]);
  const [categorySavingId, setCategorySavingId] = useState<number | null>(null);
  const [categoryCreating, setCategoryCreating] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [categoryDeletingId, setCategoryDeletingId] = useState<number | null>(null);
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<PadelCategory | null>(null);
  const [trainerActionLoading, setTrainerActionLoading] = useState<string | null>(null);
  const [trainerError, setTrainerError] = useState<string | null>(null);
  const [trainerMessage, setTrainerMessage] = useState<string | null>(null);
  const [newTrainerUsername, setNewTrainerUsername] = useState("");
  const [creatingTrainer, setCreatingTrainer] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDuration, setLessonDuration] = useState(String(LESSON_DURATION_OPTIONS[1]));
  const [lessonPrice, setLessonPrice] = useState("20");
  const [lessonCreating, setLessonCreating] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonMessage, setLessonMessage] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamLevel, setTeamLevel] = useState("");
  const [teamClubId, setTeamClubId] = useState<string>("");
  const [teamCategoryId, setTeamCategoryId] = useState<string>("");
  const [teamCreating, setTeamCreating] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [entryTeamId, setEntryTeamId] = useState<string>("");
  const [entryEventId, setEntryEventId] = useState<string>("");
  const [entryCategoryId, setEntryCategoryId] = useState<string>("");
  const [entryCreating, setEntryCreating] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postClubId, setPostClubId] = useState<string>("");
  const [postCreating, setPostCreating] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE" | "UNKNOWN">("ALL");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "WITH" | "NONE">("ALL");
  const [noShowFilter, setNoShowFilter] = useState<"ALL" | "WITH" | "NONE">("ALL");
  const [calendarScope, setCalendarScope] = useState<"week" | "day">("week");
  const [calendarView, setCalendarView] = useState<"timeline" | "list">("timeline");
  const [calendarViewTouched, setCalendarViewTouched] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState<"all" | "club">("all");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [slotMinutes, setSlotMinutes] = useState<number>(15);
  const [autoScheduleForm, setAutoScheduleForm] = useState({
    start: "",
    end: "",
    duration: "60",
    slot: "15",
    buffer: "5",
    rest: "10",
    priority: "",
  });
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [autoScheduleSummary, setAutoScheduleSummary] = useState<string | null>(null);
  const [autoSchedulePreview, setAutoSchedulePreview] = useState<
    Array<{ matchId: number; courtId: number; start: string; end: string }> | null
  >(null);
  const [lastAction, setLastAction] = useState<{
    type: "block" | "availability" | "match";
    id: number;
    prevStart: string | Date;
    prevEnd: string | Date;
    prevCourtId?: number | null;
    prevDuration?: number | null;
    version?: string | Date | null;
  } | null>(null);
  const [blockForm, setBlockForm] = useState({
    start: "",
    end: "",
    label: "",
    note: "",
  });
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [editingBlockVersion, setEditingBlockVersion] = useState<string | Date | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    start: "",
    end: "",
    playerName: "",
    playerEmail: "",
    note: "",
  });
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<number | null>(null);
  const [editingAvailabilityVersion, setEditingAvailabilityVersion] = useState<string | Date | null>(null);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [delayBusyMatchId, setDelayBusyMatchId] = useState<number | null>(null);

  const [clubForm, setClubForm] = useState(DEFAULT_FORM);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [clubError, setClubError] = useState<string | null>(null);
  const [clubMessage, setClubMessage] = useState<string | null>(null);
  const [clubLocationQuery, setClubLocationQuery] = useState("");
  const [clubLocationSuggestions, setClubLocationSuggestions] = useState<GeoAutocompleteItem[]>([]);
  const [clubLocationSearchLoading, setClubLocationSearchLoading] = useState(false);
  const [clubLocationSearchError, setClubLocationSearchError] = useState<string | null>(null);
  const [clubLocationDetailsLoading, setClubLocationDetailsLoading] = useState(false);
  const clubLocationSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clubLocationDetailsSeq = useRef(0);

  const [drawerClubId, setDrawerClubId] = useState<number | null>(initialClubs[0]?.id ?? null);
  const [courts, setCourts] = useState<PadelClubCourt[]>([]);
  const [staff, setStaff] = useState<PadelClubStaff[]>([]);
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  const [courtForm, setCourtForm] = useState(DEFAULT_COURT_FORM);
  const [courtMessage, setCourtMessage] = useState<string | null>(null);
  const [courtError, setCourtError] = useState<string | null>(null);
  const [savingCourt, setSavingCourt] = useState(false);
  const [courtDialog, setCourtDialog] = useState<{ court: PadelClubCourt; nextActive: boolean } | null>(null);

  const [staffForm, setStaffForm] = useState(DEFAULT_STAFF_FORM);
  const [staffMode, setStaffMode] = useState<"existing" | "external">("existing");
  const [staffSearch, setStaffSearch] = useState("");
  const [staffMessage, setStaffMessage] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffInviteNotice, setStaffInviteNotice] = useState<string | null>(null);
  const [draggingCourtId, setDraggingCourtId] = useState<number | null>(null);
  const [clubDialog, setClubDialog] = useState<{ club: PadelClub; nextActive: boolean } | null>(null);
  const [deleteClubDialog, setDeleteClubDialog] = useState<PadelClub | null>(null);
  const [deleteCourtDialog, setDeleteCourtDialog] = useState<PadelClubCourt | null>(null);
  const [partnershipActionBusy, setPartnershipActionBusy] = useState<number | null>(null);
  const [partnershipError, setPartnershipError] = useState<string | null>(null);
  const [partnershipMessage, setPartnershipMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(OPERATION_MODE_STORAGE_KEY);
    if (stored === "CLUB_OWNER" || stored === "ORGANIZER") {
      setOperationMode(stored);
    } else {
      setOperationMode(defaultOperationMode);
    }
    setOperationModeReady(true);
  }, [defaultOperationMode]);

  useEffect(() => {
    if (!operationModeReady || typeof window === "undefined") return;
    window.localStorage.setItem(OPERATION_MODE_STORAGE_KEY, operationMode);
  }, [operationMode, operationModeReady]);

  useEffect(() => {
    if (typeof window === "undefined" || calendarViewTouched) return;
    const prefersList = window.matchMedia("(max-width: 900px)").matches;
    setCalendarView(prefersList ? "list" : "timeline");
  }, [calendarViewTouched]);

  const toolClubHref = organizationId ? buildOrgHref(organizationId, "/padel/clubs") : buildOrgHubHref("/organizations");
  const toolTournamentsHref = organizationId
    ? buildOrgHref(organizationId, "/padel/tournaments")
    : buildOrgHubHref("/organizations");
  const tournamentsCreateHref = organizationId
    ? buildOrgHref(organizationId, "/padel/tournaments/create")
    : buildOrgHubHref("/organizations");
  const orgOverviewHref = organizationId ? buildOrgHref(organizationId, "/overview") : buildOrgHubHref("/organizations");

  const buildOrgApiPath = (
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>,
  ) => {
    if (!organizationId) return null;
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === null || typeof value === "undefined") return;
        params.set(key, String(value));
      });
    }
    const suffix = params.size > 0 ? `${path}?${params.toString()}` : path;
    return resolveCanonicalOrgApiPath(`/api/org/[orgId]${suffix}`, organizationId);
  };

  const { data: organizationStaff } = useSWR<OrganizationStaffResponse>(
    organizationId ? `/api/org-hub/organizations/members?organizationId=${organizationId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: trainersRes, isLoading: trainersLoading, mutate: mutateTrainers } = useSWR<TrainersResponse>(
    buildOrgApiPath("/trainers"),
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: servicesRes, isLoading: servicesLoading, mutate: mutateServices } = useSWR<ServicesResponse>(
    buildOrgApiPath("/servicos"),
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: categoriesRes, mutate: mutateCategories } = useSWR<{ ok?: boolean; items?: PadelCategory[] }>(
    organizationId ? `/api/padel/categories/my?organizationId=${organizationId}&includeInactive=1` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: teamsRes, mutate: mutateTeams } = useSWR<{ ok?: boolean; items?: Team[] }>(
    organizationId ? `/api/padel/teams?organizationId=${organizationId}&includeInactive=1` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: communityRes, mutate: mutateCommunity } = useSWR<{ ok?: boolean; items?: CommunityPost[] }>(
    organizationId ? `/api/padel/community/posts?organizationId=${organizationId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: entryCategoriesRes } = useSWR<{ ok?: boolean; items?: PadelEventCategoryLink[] }>(
    entryEventId ? `/api/padel/event-categories?eventId=${entryEventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelEventsRes, isLoading: padelEventsLoading } = useSWR<PadelEventsResponse>(
    buildOrgApiPath("/events/list", { templateType: "PADEL", limit: 200 }),
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelOverviewRes } = useSWR<PadelOverviewResponse>(
    buildOrgApiPath("/analytics/overview", { range: "30d", templateType: "PADEL" }),
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelConfigRes, mutate: mutatePadelConfig } = useSWR<PadelConfigResponse>(
    eventId ? `/api/padel/tournaments/config?eventId=${eventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const calendarKey = useMemo(() => {
    if (!eventId) return null;
    const params = new URLSearchParams({ eventId: String(eventId) });
    if (calendarFilter === "club" && drawerClubId) {
      params.set("padelClubId", String(drawerClubId));
    }
    return `/api/padel/calendar?${params.toString()}`;
  }, [calendarFilter, drawerClubId, eventId]);
  const { data: calendarData, isLoading: isCalendarLoading, mutate: mutateCalendar } = useSWR<CalendarResponse>(
    calendarKey,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: opsSummaryRes } = useSWR<PadelOpsSummaryResponse>(
    eventId ? `/api/padel/ops/summary?eventId=${eventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const {
    data: partnershipsRes,
    isLoading: partnershipsLoading,
    mutate: mutatePartnerships,
  } = useSWR<PartnershipsResponse>(
    organizationId ? `/api/padel/partnerships/agreements?organizationId=${organizationId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const {
    data: partnershipOverridesRes,
    isLoading: partnershipOverridesLoading,
    mutate: mutatePartnershipOverrides,
  } = useSWR<PartnershipOverridesResponse>(
    organizationId ? `/api/padel/partnerships/overrides?organizationId=${organizationId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const padelConfig = padelConfigRes?.config ?? null;
  const scheduleDefaults = (padelConfig?.advancedSettings?.scheduleDefaults ?? {}) as {
    windowStart?: string | null;
    windowEnd?: string | null;
    durationMinutes?: number | null;
    slotMinutes?: number | null;
    bufferMinutes?: number | null;
    minRestMinutes?: number | null;
    priority?: "GROUPS_FIRST" | "KNOCKOUT_FIRST" | null;
  };

  useEffect(() => {
    if (resolvedPadelTab && allowedTabs.includes(resolvedPadelTab) && resolvedPadelTab !== activeTab) {
      setActiveTab(resolvedPadelTab);
      setSwitchingTab(false);
      return;
    }
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(fallbackTab);
      setSwitchingTab(false);
    }
  }, [activeTab, allowedTabs, fallbackTab, resolvedPadelTab]);

  useEffect(() => {
    const timer = switchingTab ? setTimeout(() => setSwitchingTab(false), 280) : null;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [switchingTab]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      if (key === "escape") {
        setShowCommandPalette(false);
        setShowOpsDrawer(false);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handler);
      }
    };
  }, []);

  useEffect(() => {
    if (showCommandPalette) {
      setCommandQuery("");
    }
  }, [showCommandPalette]);

  useEffect(() => {
    if (!calendarData && !padelConfig) return;
    setAutoScheduleForm((prev) => {
      let changed = false;
      const next = { ...prev };
      if (!prev.start) {
        if (scheduleDefaults.windowStart) {
          next.start = formatDateTimeLocal(scheduleDefaults.windowStart);
          changed = true;
        } else if (calendarData?.eventStartsAt) {
          next.start = formatDateTimeLocal(calendarData.eventStartsAt);
          changed = true;
        }
      }
      if (!prev.end) {
        if (scheduleDefaults.windowEnd) {
          next.end = formatDateTimeLocal(scheduleDefaults.windowEnd);
          changed = true;
        } else if (calendarData?.eventEndsAt) {
          next.end = formatDateTimeLocal(calendarData.eventEndsAt);
          changed = true;
        }
      }
      if (!prev.duration && typeof scheduleDefaults.durationMinutes === "number") {
        next.duration = String(scheduleDefaults.durationMinutes);
        changed = true;
      }
      if (!prev.slot) {
        if (typeof scheduleDefaults.slotMinutes === "number") {
          next.slot = String(scheduleDefaults.slotMinutes);
          changed = true;
        } else {
          next.slot = String(slotMinutes);
          changed = true;
        }
      }
      if (!prev.buffer) {
        if (typeof scheduleDefaults.bufferMinutes === "number") {
          next.buffer = String(scheduleDefaults.bufferMinutes);
          changed = true;
        } else {
          next.buffer = String(calendarData?.bufferMinutes ?? 5);
          changed = true;
        }
      }
      if (!prev.rest) {
        if (typeof scheduleDefaults.minRestMinutes === "number") {
          next.rest = String(scheduleDefaults.minRestMinutes);
          changed = true;
        } else {
          next.rest = "10";
          changed = true;
        }
      }
      if (!prev.priority) {
        next.priority = scheduleDefaults.priority || "GROUPS_FIRST";
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    calendarData?.eventStartsAt,
    calendarData?.eventEndsAt,
    calendarData?.bufferMinutes,
    padelConfig?.eventId,
    scheduleDefaults.windowStart,
    scheduleDefaults.windowEnd,
    scheduleDefaults.durationMinutes,
    scheduleDefaults.slotMinutes,
    scheduleDefaults.bufferMinutes,
    scheduleDefaults.minRestMinutes,
    scheduleDefaults.priority,
    slotMinutes,
  ]);

  const setPadelSection = (section: PadelTab) => {
    setSwitchingTab(true);
    setActiveTab(section);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("section", activeSection);
    params.set("padel", section);
    const isModuleRoute =
      pathname?.startsWith(toolClubHref) ||
      pathname?.startsWith(toolTournamentsHref);
    const moduleBasePath = toolMode === "CLUB" ? toolClubHref : toolTournamentsHref;
    if (isModuleRoute) {
      params.delete("tab");
    } else {
      params.set("tab", "manage");
    }
    const basePath = isModuleRoute ? moduleBasePath : orgOverviewHref;
    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
    setLastAction(null);
  };

  const setPadelEventId = (nextId: number | null) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextId && Number.isFinite(nextId)) {
      params.set("eventId", String(nextId));
    } else {
      params.delete("eventId");
    }
    params.set("section", activeSection);
    params.set("padel", "calendar");
    const isModuleRoute =
      pathname?.startsWith(toolClubHref) ||
      pathname?.startsWith(toolTournamentsHref);
    const moduleBasePath = toolMode === "CLUB" ? toolClubHref : toolTournamentsHref;
    if (isModuleRoute) {
      params.delete("tab");
    } else {
      params.set("tab", "manage");
    }
    const basePath = isModuleRoute ? moduleBasePath : orgOverviewHref;
    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
  };

  const hasActiveClub = useMemo(() => clubs.some((c) => c.isActive), [clubs]);
  const sortedClubs = useMemo(() => {
    return [...clubs].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clubs]);

  const selectedClub = useMemo(() => clubs.find((c) => c.id === drawerClubId) || null, [clubs, drawerClubId]);
  const selectedClubIsPartner = selectedClub?.kind === "PARTNER";

  const padelEvents = useMemo(() => {
    if (!padelEventsRes?.ok || !Array.isArray(padelEventsRes.items)) return [];
    return padelEventsRes.items;
  }, [padelEventsRes]);
  const sortedPadelEvents = useMemo(() => {
    return [...padelEvents].sort((a, b) => {
      const aStart = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bStart = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return bStart - aStart;
    });
  }, [padelEvents]);
  const interclubEvents = useMemo(
    () => padelEvents.filter((event) => event.isInterclub),
    [padelEvents],
  );
  const liveEventsCount = useMemo(
    () => padelEvents.filter((event) => (event.status || "").toUpperCase() === "LIVE").length,
    [padelEvents],
  );
  const publishedEventsCount = useMemo(
    () => padelEvents.filter((event) => (event.status || "").toUpperCase() === "PUBLISHED").length,
    [padelEvents],
  );
  const padelEventsError = padelEventsRes?.ok === false ? padelEventsRes.error || "Erro ao carregar torneios." : null;
  const partnershipAgreements = useMemo(() => {
    if (!partnershipsRes?.ok || !Array.isArray(partnershipsRes.items)) return [];
    return partnershipsRes.items;
  }, [partnershipsRes]);
  const partnershipOverrides = useMemo(() => {
    if (!partnershipOverridesRes?.ok || !Array.isArray(partnershipOverridesRes.items)) return [];
    return partnershipOverridesRes.items;
  }, [partnershipOverridesRes]);
  const partnershipCompensationCases = useMemo(() => {
    if (!partnershipOverridesRes?.ok || !Array.isArray(partnershipOverridesRes.compensationCases)) return [];
    return partnershipOverridesRes.compensationCases;
  }, [partnershipOverridesRes]);
  const partnershipPendingCompensationCount = useMemo(
    () =>
      partnershipCompensationCases.filter(
        (item) => item.status === "PENDING_COMPENSATION" || item.status === "OPEN",
      ).length,
    [partnershipCompensationCases],
  );

  useEffect(() => {
    if (!entryEventId) return;
    const selectedId = Number(entryEventId);
    if (!Number.isFinite(selectedId)) return;
    if (!interclubEvents.some((event) => event.id === selectedId)) {
      setEntryEventId("");
    }
  }, [entryEventId, interclubEvents]);
  const entryCategories = useMemo(() => {
    if (!entryCategoriesRes?.ok || !Array.isArray(entryCategoriesRes.items)) return [];
    return entryCategoriesRes.items;
  }, [entryCategoriesRes]);
  const selectedEvent = useMemo(
    () => padelEvents.find((event) => event.id === eventId) || null,
    [padelEvents, eventId],
  );
  const padelOverview = padelOverviewRes?.ok ? padelOverviewRes : null;
  const padelOverviewError =
    padelOverviewRes && padelOverviewRes.ok === false ? padelOverviewRes.error || "Sem acesso a KPIs." : null;
  const overviewCurrency = padelOverview?.currency || "EUR";
  const overviewRevenueLabel = padelOverview
    ? formatCurrency(padelOverview.totalRevenueCents ?? 0, overviewCurrency)
    : "—";
  const overviewGrossLabel = padelOverview
    ? formatCurrency(padelOverview.grossCents ?? 0, overviewCurrency)
    : "—";
  const overviewFeesLabel = padelOverview
    ? formatCurrency(padelOverview.feesCents ?? 0, overviewCurrency)
    : "—";
  const opsSummary = opsSummaryRes?.ok ? opsSummaryRes.summary ?? null : null;
  const opsAlerts = useMemo(() => {
    if (!opsSummary) return [];
    const alerts: Array<{ key: string; label: string }> = [];
    if (opsSummary.pendingSplitCount > 0) {
      alerts.push({
        key: "pending-split",
        label: `${opsSummary.pendingSplitCount} duplas pendentes (split).`,
      });
    }
    if (opsSummary.waitlistCount > 0) {
      alerts.push({
        key: "waitlist",
        label: `${opsSummary.waitlistCount} em waitlist.`,
      });
    }
    if (opsSummary.delayedMatchesCount > 0) {
      alerts.push({
        key: "delayed",
        label: `${opsSummary.delayedMatchesCount} jogos atrasados.`,
      });
    }
    if (opsSummary.refundPendingCount > 0) {
      alerts.push({
        key: "refunds",
        label: `${opsSummary.refundPendingCount} reembolsos pendentes.`,
      });
    }
    if ((opsSummary.invalidStateCount ?? 0) > 0) {
      alerts.push({
        key: "invalid",
        label: `${opsSummary.invalidStateCount} inconsistências de estado.`,
      });
    }
    if (opsSummary.liveMatchesCount > 0) {
      alerts.push({
        key: "live",
        label: `${opsSummary.liveMatchesCount} jogos a decorrer.`,
      });
    }
    return alerts;
  }, [opsSummary]);
  const opsUpdatedLabel = opsSummary?.updatedAt
    ? new Date(opsSummary.updatedAt).toLocaleString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const conversionLabel =
    opsSummary && typeof opsSummary.conversionRate === "number"
      ? `${Math.round(opsSummary.conversionRate * 100)}%`
      : "—";
  const matchmakingLabel =
    opsSummary && typeof opsSummary.avgMatchmakingMinutes === "number"
      ? `${Math.max(0, opsSummary.avgMatchmakingMinutes)} min`
      : "—";
  const opsCounters = useMemo(
    () => [
      { key: "pending", label: "Split pendente", value: opsSummary?.pendingSplitCount ?? 0 },
      { key: "conversion", label: "Conversão", value: conversionLabel },
      { key: "matchmaking", label: "Matchmaking médio", value: matchmakingLabel },
      { key: "waitlist", label: "Waitlist", value: opsSummary?.waitlistCount ?? 0 },
      { key: "live", label: "Jogos live", value: opsSummary?.liveMatchesCount ?? 0 },
      { key: "delayed", label: "Atrasos", value: opsSummary?.delayedMatchesCount ?? 0 },
      { key: "refunds", label: "Reembolsos", value: opsSummary?.refundPendingCount ?? 0 },
      { key: "invalid", label: "Inconsistências", value: opsSummary?.invalidStateCount ?? 0 },
    ],
    [opsSummary, conversionLabel, matchmakingLabel],
  );

  const levelOptions = useMemo(() => {
    const levels = Array.from(
      new Set(players.map((player) => (player.level ?? "").trim()).filter(Boolean)),
    );
    return levels.sort((a, b) => a.localeCompare(b, "pt-PT", { numeric: true }));
  }, [players]);

  const resolveHistoryCount = (player: Player) =>
    Math.max(player.tournamentsCount ?? 0, player.crm?.totalTournaments ?? 0);

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((p) => {
      if (genderFilter !== "ALL") {
        const gender = (p.gender ?? "").trim().toUpperCase();
        if (genderFilter === "UNKNOWN" && gender) return false;
        if (genderFilter === "MALE" && gender !== "MALE") return false;
        if (genderFilter === "FEMALE" && gender !== "FEMALE") return false;
      }

      if (levelFilter !== "ALL") {
        const level = (p.level ?? "").trim();
        if (levelFilter === "UNKNOWN" && level) return false;
        if (levelFilter !== "UNKNOWN" && level !== levelFilter) return false;
      }

      const historyCount = resolveHistoryCount(p);
      if (historyFilter === "WITH" && historyCount <= 0) return false;
      if (historyFilter === "NONE" && historyCount > 0) return false;

      const noShowCount = p.noShowCount ?? 0;
      if (noShowFilter === "WITH" && noShowCount <= 0) return false;
      if (noShowFilter === "NONE" && noShowCount > 0) return false;

      if (!term) return true;
      if (p.fullName.toLowerCase().includes(term)) return true;
      if ((p.email || "").toLowerCase().includes(term)) return true;
      if ((p.profile?.username || "").toLowerCase().includes(term)) return true;
      if ((p.crm?.tags || []).some((tag) => tag.toLowerCase().includes(term))) return true;
      return false;
    });
  }, [players, search, genderFilter, levelFilter, historyFilter, noShowFilter]);

  const quickLinks = useMemo(() => {
    if (toolMode === "TOURNAMENTS") {
      return [
        { label: "Torneios", href: toolTournamentsHref, desc: "Lista, estados e operação live." },
        {
          label: "Check-in",
          href: organizationId ? buildOrgHref(organizationId, "/check-in") : buildOrgHubHref("/organizations"),
          desc: "Entradas e QR em tempo real.",
        },
        {
          label: "Inscrições",
          href: organizationId ? buildOrgHref(organizationId, "/forms") : buildOrgHubHref("/organizations"),
          desc: "Duplas, pagamentos e status.",
        },
        {
          label: "Finanças",
          href: organizationId ? buildOrgHref(organizationId, "/finance") : buildOrgHubHref("/organizations"),
          desc: "Receitas e reconciliação.",
        },
      ];
    }
    return [
      {
        label: "Reservas",
        href: organizationId ? buildOrgHref(organizationId, "/bookings") : buildOrgHubHref("/organizations"),
        desc: "Agenda, aulas e bookings.",
      },
      {
        label: "CRM",
        href: organizationId ? buildOrgHref(organizationId, "/crm/customers") : buildOrgHubHref("/organizations"),
        desc: "Clientes, tags e segmentos.",
      },
      {
        label: "Treinadores",
        href: organizationId ? buildOrgHref(organizationId, "/team/trainers") : buildOrgHubHref("/organizations"),
        desc: "Perfis públicos e gestão.",
      },
      {
        label: "Loja",
        href: organizationId ? buildOrgHref(organizationId, "/store") : buildOrgHubHref("/organizations"),
        desc: "Produtos e stock.",
      },
    ];
  }, [organizationId, toolMode, toolTournamentsHref]);

  const partnershipsError =
    (partnershipsRes && partnershipsRes.ok === false ? partnershipsRes.error : null) ||
    (partnershipOverridesRes && partnershipOverridesRes.ok === false ? partnershipOverridesRes.error : null);

  const runPartnershipAction = async (agreementId: number, action: "approve" | "pause" | "revoke") => {
    setPartnershipError(null);
    setPartnershipMessage(null);
    setPartnershipActionBusy(agreementId);
    try {
      const endpoint = `/api/padel/partnerships/agreements/${agreementId}/${action}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const err = typeof json?.error === "string" ? json.error : "Não foi possível atualizar a parceria.";
        setPartnershipError(err);
        toast(err, "err");
        return;
      }
      const msg =
        action === "approve"
          ? "Parceria aprovada."
          : action === "pause"
            ? "Parceria pausada."
            : "Parceria revogada.";
      setPartnershipMessage(msg);
      toast(msg, "ok");
      await Promise.all([mutatePartnerships(), mutatePartnershipOverrides()]);
    } catch (err) {
      console.error("[padel/partnerships] action", err);
      setPartnershipError("Erro inesperado ao atualizar parceria.");
      toast("Erro ao atualizar parceria", "err");
    } finally {
      setPartnershipActionBusy(null);
    }
  };

  const trainers = trainersRes?.items ?? [];
  const trainersError = trainersRes?.ok === false ? trainersRes.error || "Erro ao carregar treinadores." : null;
  const services = servicesRes?.items ?? [];
  const lessonsError = servicesRes?.ok === false ? servicesRes.error || "Erro ao carregar aulas." : null;
  const lessonServices = useMemo(() => {
    return services.filter((service) => {
      const kind = (service.kind ?? "").trim().toUpperCase();
      const tag = (service.categoryTag ?? "").trim().toLowerCase();
      return kind === "CLASS" || tag.includes("aula") || tag.includes("treino");
    });
  }, [services]);
  const trainerErrorLabel = useMemo(() => {
    if (!trainersError) return null;
    if (trainersError === "FORBIDDEN") return "Sem permissões para gerir treinadores.";
    if (trainersError === "UNAUTHENTICATED") return "Inicia sessão para gerir treinadores.";
    return trainersError;
  }, [trainersError]);
  const lessonsErrorLabel = useMemo(() => {
    if (!lessonsError) return null;
    return lessonsError;
  }, [lessonsError]);

  const defaultCategorySeeds = useMemo(() => buildPadelDefaultCategories(), []);
  const defaultCategoryKeys = useMemo(() => {
    return new Set(defaultCategorySeeds.map((seed) => buildPadelCategoryKey(seed)));
  }, [defaultCategorySeeds]);
  const categoriesByKey = useMemo(() => {
    return new Map(categories.map((cat) => [buildPadelCategoryKey(cat), cat]));
  }, [categories]);
  const baseCategories = useMemo(() => {
    const resolved = defaultCategorySeeds
      .map((seed) => categoriesByKey.get(buildPadelCategoryKey(seed)))
      .filter(Boolean) as PadelCategory[];
    return resolved.filter((cat) => cat.isActive).slice(0, MAIN_CATEGORY_LIMIT);
  }, [categoriesByKey, defaultCategorySeeds]);
  const baseCategoryGroups = useMemo(() => {
    const groups = [
      { key: "masculino", label: "Masculino", items: [] as PadelCategory[] },
      { key: "feminino", label: "Feminino", items: [] as PadelCategory[] },
      { key: "misto", label: "Misto", items: [] as PadelCategory[] },
    ];
    const other: PadelCategory[] = [];
    baseCategories.forEach((cat) => {
      const label = cat.label.toLowerCase();
      if (label.startsWith("masculino")) groups[0].items.push(cat);
      else if (label.startsWith("feminino")) groups[1].items.push(cat);
      else if (label.startsWith("misto")) groups[2].items.push(cat);
      else other.push(cat);
    });
    const result = groups.filter((group) => group.items.length > 0);
    if (other.length > 0) {
      result.push({ key: "outras", label: "Outras", items: other });
    }
    return result;
  }, [baseCategories]);
  const customCategories = useMemo(() => {
    const rest = categories.filter((cat) => !defaultCategoryKeys.has(buildPadelCategoryKey(cat)));
    return sortPadelCategories(rest);
  }, [categories, defaultCategoryKeys]);
  const extraCategoriesCount = customCategories.length;

  const activeCourtsCount = useMemo(() => courts.filter((c) => c.isActive).length, [courts]);
  const staffOptions = useMemo(() => {
    const list = organizationStaff?.items ?? [];
    const term = staffSearch.trim().toLowerCase();
    const filtered = term
      ? list.filter(
          (m) =>
            (m.fullName || "").toLowerCase().includes(term) ||
            (m.email || "").toLowerCase().includes(term) ||
            (m.username || "").toLowerCase().includes(term),
        )
      : list;
    return filtered;
  }, [organizationStaff?.items, staffSearch]);
  const inheritedStaffCount = useMemo(() => staff.filter((s) => s.inheritToEvents).length, [staff]);
  // Mantém a ordem recebida e renumera sequencialmente
  const renumberCourts = (list: PadelClubCourt[]) =>
    list.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));

  const computeActiveCount = (list: PadelClubCourt[]) => list.filter((c) => c.isActive).length;

  const syncActiveCountOnClub = (clubId: number, list: PadelClubCourt[]) => {
    const activeCount = computeActiveCount(list);
    setClubs((prev) => prev.map((c) => (c.id === clubId ? { ...c, courtsCount: activeCount } : c)));
    return activeCount;
  };

  const refreshActiveCounts = async (clubList: PadelClub[]) => {
    if (!clubList.length) return;
    try {
      const updates = await Promise.all(
        clubList.map(async (club) => {
          const courts = await fetchCourtsForClub(club.id);
          return { id: club.id, count: computeActiveCount(courts) };
        }),
      );
      setClubs((prev) =>
        prev.map((club) => {
          const found = updates.find((u) => u.id === club.id);
          return found ? { ...club, courtsCount: found.count } : club;
        }),
      );
    } catch (err) {
      console.error("[padel/clubs] refreshActiveCounts", err);
    }
  };

  const updateCategoryDraft = (
    categoryId: number,
    patch: Partial<{
      label: string;
      genderRestriction: string;
      minLevel: string;
      maxLevel: string;
      season: string;
      year: string;
      isActive: boolean;
    }>,
  ) => {
    setCategoryDrafts((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], ...patch },
    }));
  };

  const getQuickCategoryLabel = (genderValue: string, levelValue: string) => {
    const normalizedGender = genderValue.trim();
    const normalizedLevel = levelValue.trim();
    const resolvedGenderLabel = CATEGORY_GENDER_OPTIONS.find((opt) => opt.value === normalizedGender)?.label;
    const baseLabel = normalizedGender ? resolvedGenderLabel || "Aberta" : "Aberta";
    return normalizedLevel ? `${baseLabel} ${normalizedLevel}` : baseLabel;
  };

  const saveCategory = async (categoryId: number) => {
    const draft = categoryDrafts[categoryId];
    if (!draft) return;
    setCategorySavingId(categoryId);
    setCategoryError(null);
    setCategoryMessage(null);
    try {
      const res = await fetch("/api/padel/categories/my", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: categoryId,
          label: draft.label,
          genderRestriction: draft.genderRestriction || null,
          minLevel: draft.minLevel || null,
          maxLevel: draft.maxLevel || null,
          season: draft.season || null,
          year: draft.year || null,
          isActive: draft.isActive,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setCategoryError(json?.error || "Erro ao guardar categoria.");
        return;
      }
      setCategoryMessage("Categoria atualizada.");
      mutateCategories();
      setTimeout(() => setCategoryMessage(null), 2000);
    } catch (err) {
      console.error("[padel/categories] save", err);
      setCategoryError("Erro ao guardar categoria.");
    } finally {
      setCategorySavingId(null);
    }
  };

  const submitCategory = async (
    payload: {
      label: string;
      genderRestriction: string | null;
      minLevel: string | null;
      maxLevel: string | null;
      season: string | null;
      year: string | number | null;
      isActive: boolean;
    },
    options?: { resetForm?: boolean },
  ) => {
    setCategoryCreating(true);
    setCategoryError(null);
    setCategoryMessage(null);
    try {
      const res = await fetch("/api/padel/categories/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setCategoryError(json?.error || "Erro ao criar categoria.");
        return;
      }
      setCategoryMessage("Categoria criada.");
      if (options?.resetForm) {
        setCategoryForm({
          label: "",
          genderRestriction: "",
          minLevel: "",
          maxLevel: "",
          season: "",
          year: "",
          isActive: true,
        });
      }
      mutateCategories();
      setTimeout(() => setCategoryMessage(null), 2000);
    } catch (err) {
      console.error("[padel/categories] create", err);
      setCategoryError("Erro ao criar categoria.");
    } finally {
      setCategoryCreating(false);
    }
  };

  const createCategory = async () => {
    if (!categoryForm.label.trim()) {
      setCategoryError("Escreve o nome da categoria.");
      return;
    }
    await submitCategory(
      {
        label: categoryForm.label.trim(),
        genderRestriction: categoryForm.genderRestriction || null,
        minLevel: categoryForm.minLevel || null,
        maxLevel: categoryForm.maxLevel || null,
        season: categoryForm.season || null,
        year: categoryForm.year || null,
        isActive: categoryForm.isActive,
      },
      { resetForm: true },
    );
  };

  const createQuickCategory = async () => {
    const levelValue = categoryQuickLevel.trim();
    if (!levelValue) {
      setCategoryError("Seleciona o nível.");
      return;
    }
    const genderValue = categoryQuickGender.trim();
    const label = getQuickCategoryLabel(genderValue, levelValue);
    await submitCategory({
      label,
      genderRestriction: genderValue || null,
      minLevel: levelValue,
      maxLevel: levelValue,
      season: null,
      year: null,
      isActive: true,
    });
  };

  const handleDeleteCategory = async (category: PadelCategory) => {
    setCategoryDeletingId(category.id);
    setCategoryError(null);
    setCategoryMessage(null);
    try {
      const res = await fetch(`/api/padel/categories/my?id=${category.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setCategoryError(json?.error || "Erro ao apagar categoria.");
        return;
      }
      setCategories((prev) => prev.filter((entry) => entry.id !== category.id));
      setCategoryMessage("Categoria apagada.");
      mutateCategories();
      setTimeout(() => setCategoryMessage(null), 2000);
    } catch (err) {
      console.error("[padel/categories] delete", err);
      setCategoryError("Erro ao apagar categoria.");
    } finally {
      setCategoryDeletingId(null);
      setDeleteCategoryDialog(null);
    }
  };

  const handleTrainerAction = async (
    trainer: TrainerItem,
    action: "APPROVE" | "REJECT" | "HIDE" | "PUBLISH",
    note?: string,
  ) => {
    if (!organizationId) return;
    setTrainerActionLoading(trainer.userId);
    setTrainerError(null);
    setTrainerMessage(null);
    try {
      const trainersApiPath = buildOrgApiPath("/trainers");
      if (!trainersApiPath) throw new Error("Organização indisponível.");
      const res = await fetch(trainersApiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          userId: trainer.userId,
          action,
          reviewNote: note ?? null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível atualizar o treinador.");
      }
      if (mutateTrainers) await mutateTrainers();
      const message =
        action === "APPROVE"
          ? "Treinador aprovado."
          : action === "REJECT"
            ? "Treinador recusado."
            : action === "HIDE"
              ? "Treinador ocultado."
              : "Treinador publicado.";
      setTrainerMessage(message);
      toast(message, "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar treinador.";
      setTrainerError(message);
      toast(message, "err");
    } finally {
      setTrainerActionLoading(null);
    }
  };

  const handleCreateTrainerProfile = async () => {
    if (!organizationId) return;
    const value = newTrainerUsername.trim();
    if (!value) {
      setTrainerError("Indica o username do treinador.");
      return;
    }
    setCreatingTrainer(true);
    setTrainerError(null);
    setTrainerMessage(null);
    try {
      const trainersApiPath = buildOrgApiPath("/trainers");
      if (!trainersApiPath) throw new Error("Organização indisponível.");
      const res = await fetch(trainersApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, username: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível criar o perfil.");
      }
      setNewTrainerUsername("");
      setTrainerMessage("Perfil de treinador criado.");
      toast("Perfil de treinador criado.", "ok");
      if (mutateTrainers) await mutateTrainers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar perfil.";
      setTrainerError(message);
      toast(message, "err");
    } finally {
      setCreatingTrainer(false);
    }
  };

  const handleCreateLesson = async () => {
    const title = lessonTitle.trim();
    if (!title) {
      setLessonError("Indica o nome da aula.");
      return;
    }
    const durationValue = Number(lessonDuration);
    if (!LESSON_DURATION_OPTIONS.includes(durationValue)) {
      setLessonError("Seleciona a duração.");
      return;
    }
    const priceValue = Number(lessonPrice.replace(",", "."));
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setLessonError("Preço inválido.");
      return;
    }
    setLessonCreating(true);
    setLessonError(null);
    setLessonMessage(null);
    try {
      const servicesApiPath = buildOrgApiPath("/servicos");
      if (!servicesApiPath) throw new Error("Organização indisponível.");
      const res = await fetch(servicesApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: null,
          durationMinutes: durationValue,
          unitPriceCents: Math.round(priceValue * 100),
          currency: "EUR",
          categoryTag: LESSON_TAG,
          locationMode: "FIXED",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível criar a aula.");
      }
      setLessonTitle("");
      setLessonPrice("20");
      setLessonDuration(String(LESSON_DURATION_OPTIONS[1]));
      setLessonMessage("Aula criada.");
      toast("Aula criada.", "ok");
      if (mutateServices) await mutateServices();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar aula.";
      setLessonError(message);
      toast(message, "err");
    } finally {
      setLessonCreating(false);
    }
  };

  const handleCreateTeam = async () => {
    const name = teamName.trim();
    if (!name) {
      setTeamError("Indica o nome da equipa.");
      return;
    }
    setTeamCreating(true);
    setTeamError(null);
    setTeamMessage(null);
    try {
      const res = await fetch(`/api/padel/teams?organizationId=${organizationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name,
          level: teamLevel.trim() || null,
          padelClubId: teamClubId ? Number(teamClubId) : null,
          categoryId: teamCategoryId ? Number(teamCategoryId) : null,
          isActive: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível criar a equipa.");
      }
      setTeamName("");
      setTeamLevel("");
      setTeamClubId("");
      setTeamCategoryId("");
      setTeamMessage("Equipa criada.");
      toast("Equipa criada.", "ok");
      if (mutateTeams) await mutateTeams();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar equipa.";
      setTeamError(message);
      toast(message, "err");
    } finally {
      setTeamCreating(false);
    }
  };

  const handleRegisterTeam = async () => {
    if (!entryTeamId) {
      setEntryError("Seleciona uma equipa.");
      return;
    }
    if (!entryEventId) {
      setEntryError("Seleciona um torneio.");
      return;
    }
    setEntryCreating(true);
    setEntryError(null);
    setEntryMessage(null);
    try {
      const res = await fetch(`/api/padel/teams/entries?organizationId=${organizationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          teamId: Number(entryTeamId),
          eventId: Number(entryEventId),
          categoryId: entryCategoryId ? Number(entryCategoryId) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível registar a equipa.");
      }
      setEntryMessage("Equipa registada no torneio.");
      toast("Equipa registada.", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao registar equipa.";
      setEntryError(message);
      toast(message, "err");
    } finally {
      setEntryCreating(false);
    }
  };

  const handleCreateCommunityPost = async () => {
    const bodyText = postBody.trim();
    if (!bodyText) {
      setPostError("Escreve uma mensagem.");
      return;
    }
    setPostCreating(true);
    setPostError(null);
    setPostMessage(null);
    try {
      const res = await fetch(`/api/padel/community/posts?organizationId=${organizationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title: postTitle.trim() || null,
          body: bodyText,
          padelClubId: postClubId ? Number(postClubId) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível publicar.");
      }
      setPostTitle("");
      setPostBody("");
      setPostClubId("");
      setPostMessage("Publicação criada.");
      toast("Publicação criada.", "ok");
      if (mutateCommunity) await mutateCommunity();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao publicar.";
      setPostError(message);
      toast(message, "err");
    } finally {
      setPostCreating(false);
    }
  };

  const createDefaultCourts = async (clubId: number, desired: number, startIndex = 1) => {
    const created: PadelClubCourt[] = [];
    for (let i = 0; i < desired; i += 1) {
      const idx = startIndex + i;
      try {
        const res = await fetch(`/api/padel/clubs/${clubId}/courts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Campo ${idx}`,
            description: "",
            indoor: false,
            isActive: true,
            displayOrder: idx,
            surface: null,
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.court) {
          created.push(json.court as PadelClubCourt);
        }
      } catch (err) {
        console.error("[padel/clubs/courts] auto-create", err);
      }
    }
    return renumberCourts(created);
  };

  useEffect(() => {
    if (!drawerClubId) {
      setCourts([]);
      setStaff([]);
      return;
    }
    loadCourtsAndStaff(drawerClubId);
  }, [drawerClubId]);

  useEffect(() => {
    setClubs(initialClubs);
  }, [initialClubs]);

  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);

  useEffect(() => {
    if (!Array.isArray(categoriesRes?.items)) return;
    setCategories(categoriesRes.items);
  }, [categoriesRes?.items]);

  useEffect(() => {
    if (!Array.isArray(teamsRes?.items)) return;
    setTeams(teamsRes.items);
  }, [teamsRes?.items]);

  useEffect(() => {
    if (!Array.isArray(communityRes?.items)) return;
    setCommunityPosts(communityRes.items);
  }, [communityRes?.items]);

  useEffect(() => {
    setEntryCategoryId("");
  }, [entryEventId]);

  useEffect(() => {
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      const currentIds = new Set<number>();
      categories.forEach((cat) => {
        currentIds.add(cat.id);
        if (!next[cat.id]) {
          next[cat.id] = {
            label: cat.label ?? "",
            genderRestriction: cat.genderRestriction ?? "",
            minLevel: cat.minLevel ?? "",
            maxLevel: cat.maxLevel ?? "",
            season: cat.season ?? "",
            year: cat.year ? String(cat.year) : "",
            isActive: cat.isActive ?? true,
          };
        }
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!currentIds.has(id)) delete next[id];
      });
      return next;
    });
  }, [categories]);

  useEffect(() => {
    if (drawerClubId) return;
    if (clubs.length === 0) return;
    const preferred = clubs.find((c) => c.isActive) ?? clubs[0];
    setDrawerClubId(preferred.id);
  }, [clubs, drawerClubId]);

  useEffect(() => {
    if (initialClubs.length) {
      refreshActiveCounts(initialClubs);
    }
  }, []);

  const persistCourtOrder = async (list: PadelClubCourt[]) => {
    if (!selectedClub || selectedClubIsPartner) return;
    const payload = renumberCourts(list);
    const updates = payload.map((c) =>
      fetch(`/api/padel/clubs/${selectedClub.id}/courts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, name: c.name, description: c.description || "", surface: null }),
      }).catch((err) => {
        console.error("[padel/clubs/reorder] failed", err);
        return null;
      })
    );
    await Promise.all(updates);
  };

  const reorderCourts = (targetId: number) => {
    if (!draggingCourtId || draggingCourtId === targetId) return null;
    const current = [...courts];
    const from = current.findIndex((ct) => ct.id === draggingCourtId);
    const to = current.findIndex((ct) => ct.id === targetId);
    if (from === -1 || to === -1) return null;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    const renumbered = renumberCourts(current);
    setCourts(renumbered);
    return renumbered;
  };

  useEffect(() => {
    if (courtForm.id) return;
    const nextOrder = Math.max(1, activeCourtsCount + 1);
    if (courtForm.displayOrder !== nextOrder) {
      setCourtForm((prev) => ({ ...prev, displayOrder: nextOrder }));
    }
  }, [activeCourtsCount, courtForm.id]);

  const openNewClubModal = () => {
    const nextKind: ClubKind = operationMode === "CLUB_OWNER" ? "OWN" : "PARTNER";
    setClubForm({
      ...DEFAULT_FORM,
      kind: nextKind,
      courtsCount: nextKind === "OWN" ? "2" : "1",
      addressId: "",
      locationProviderId: "",
      locationFormattedAddress: "",
      latitude: null,
      longitude: null,
    });
    setClubError(null);
    setClubMessage(null);
    setSlugError(null);
    setClubLocationQuery("");
    setClubLocationSuggestions([]);
    setClubLocationSearchError(null);
    setClubModalOpen(true);
  };

  const openEditClubModal = (club: PadelClub) => {
    const inferredKind: ClubKind = club.kind === "PARTNER"
      ? "PARTNER"
      : club.isDefault
        ? "OWN"
        : operationMode === "CLUB_OWNER"
          ? "OWN"
          : "PARTNER";
    const resolvedLocation = resolveClubLocation(club);
    setClubForm({
      id: club.id,
      name: club.name,
      city: resolvedLocation.city,
      address: resolvedLocation.address,
      addressId: club.addressId || "",
      locationProviderId: club.addressRef?.sourceProviderPlaceId ?? "",
      locationFormattedAddress: resolvedLocation.formatted,
      locationSourceProvider: club.addressRef?.sourceProvider ?? null,
      locationConfidenceScore: club.addressRef?.confidenceScore ?? null,
      locationValidationStatus: club.addressRef?.validationStatus ?? null,
      latitude: typeof club.latitude === "number" ? club.latitude : null,
      longitude: typeof club.longitude === "number" ? club.longitude : null,
      courtsCount: club.courtsCount ? String(club.courtsCount) : "1",
      isActive: club.isActive,
      slug: club.slug || "",
      isDefault: Boolean(club.isDefault),
      kind: inferredKind,
      sourceClubId: club.sourceClubId ?? null,
    });
    setClubError(null);
    setClubMessage(null);
    setSlugError(null);
    setClubLocationQuery(resolvedLocation.formatted || club.name || "");
    setClubLocationSuggestions([]);
    setClubLocationSearchError(null);
    setClubModalOpen(true);
  };

  const loadCourtsAndStaff = async (clubId: number) => {
    setLoadingDrawer(true);
    setCourtMessage(null);
    setCourtError(null);
    setStaffMessage(null);
    setStaffError(null);
    try {
      const [courtsRes, staffRes] = await Promise.all([
        fetch(`/api/padel/clubs/${clubId}/courts`),
        fetch(`/api/padel/clubs/${clubId}/staff`),
      ]);
      const courtsJson = await courtsRes.json().catch(() => null);
      const staffJson = await staffRes.json().catch(() => null);
      if (courtsRes.ok && Array.isArray(courtsJson?.items)) {
        const list = renumberCourts(courtsJson.items as PadelClubCourt[]);
        setCourts(list);
        syncActiveCountOnClub(clubId, list);
      } else setCourtError(courtsJson?.error || "Erro ao carregar campos.");
      if (staffRes.ok && Array.isArray(staffJson?.items)) setStaff(staffJson.items as PadelClubStaff[]);
      else setStaffError(staffJson?.error || "Erro ao carregar equipa.");
    } catch (err) {
      console.error("[padel/clubs] load courts/staff", err);
      setCourtError("Erro ao carregar campos.");
      setStaffError("Erro ao carregar equipa.");
    } finally {
      setLoadingDrawer(false);
    }
  };

  const buildClubFormattedAddress = (nextAddress?: string, nextCity?: string) => {
    const existing = clubForm.locationFormattedAddress?.trim();
    if (!nextAddress && !nextCity && existing) return existing;
    const addressValue = (nextAddress ?? clubForm.address).trim();
    const cityValue = (nextCity ?? clubForm.city).trim();
    return [addressValue, cityValue].filter(Boolean).join(", ");
  };

  const applyClubGeoDetails = (details: GeoDetailsItem | null, fallbackLabel?: string | null) => {
    if (!details) return;
    const nextAddress = details.address || clubForm.address;
    const nextCity = details.city || clubForm.city;
    setClubForm((prev) => ({
      ...prev,
      address: nextAddress || prev.address,
      city: nextCity || prev.city,
      addressId: details.addressId || prev.addressId,
      locationProviderId: details.providerId || prev.locationProviderId,
      locationFormattedAddress: details.formattedAddress || fallbackLabel || prev.locationFormattedAddress,
      locationSourceProvider: details.sourceProvider ?? prev.locationSourceProvider,
      locationConfidenceScore:
        typeof details.confidenceScore === "number" ? details.confidenceScore : prev.locationConfidenceScore,
      locationValidationStatus: details.validationStatus ?? prev.locationValidationStatus,
      latitude: Number.isFinite(details.lat ?? NaN) ? details.lat ?? prev.latitude : prev.latitude,
      longitude: Number.isFinite(details.lng ?? NaN) ? details.lng ?? prev.longitude : prev.longitude,
    }));
  };

  useEffect(() => {
    const query = clubLocationQuery.trim();
    if (query.length < 2) {
      setClubLocationSuggestions([]);
      setClubLocationSearchError(null);
      return;
    }
    if (clubLocationSearchTimeout.current) {
      clearTimeout(clubLocationSearchTimeout.current);
    }
    setClubLocationSearchError(null);
    clubLocationSearchTimeout.current = setTimeout(async () => {
      setClubLocationSearchLoading(true);
      try {
        const items = await fetchGeoAutocomplete(query);
        setClubLocationSuggestions(items);
      } catch (err) {
        console.warn("[padel/club] autocomplete falhou", err);
        setClubLocationSuggestions([]);
        setClubLocationSearchError(err instanceof Error ? err.message : "Falha ao obter sugestões.");
      } finally {
        setClubLocationSearchLoading(false);
      }
    }, 240);

    return () => {
      if (clubLocationSearchTimeout.current) {
        clearTimeout(clubLocationSearchTimeout.current);
      }
    };
  }, [clubLocationQuery]);

  const handleSelectClubLocationSuggestion = async (item: GeoAutocompleteItem) => {
    setClubForm((prev) => ({
      ...prev,
      addressId: "",
      locationProviderId: item.providerId,
      locationFormattedAddress: item.label,
      locationSourceProvider: item.sourceProvider ?? null,
      locationConfidenceScore: null,
      locationValidationStatus: null,
      latitude: Number.isFinite(item.lat ?? NaN) ? item.lat ?? null : null,
      longitude: Number.isFinite(item.lng ?? NaN) ? item.lng ?? null : null,
      address: item.address || prev.address,
      city: item.city || prev.city,
    }));
    setClubLocationQuery(item.label);
    setClubLocationSuggestions([]);
    setClubLocationSearchError(null);
    const seq = ++clubLocationDetailsSeq.current;
    setClubLocationDetailsLoading(true);
    try {
      const details = await fetchGeoDetails(item.providerId, {
        lat: item.lat,
        lng: item.lng,
      });
      if (clubLocationDetailsSeq.current !== seq) return;
      applyClubGeoDetails(details, item.label);
    } catch (err) {
      console.warn("[padel/club] detalhes falharam", err);
    } finally {
      if (clubLocationDetailsSeq.current === seq) {
        setClubLocationDetailsLoading(false);
      }
    }
  };

  const handleSubmitClub = async () => {
    setClubError(null);
    setSlugError(null);
    setClubMessage(null);
    const isOwnClub = clubForm.kind === "OWN" || Boolean(clubForm.id && clubForm.isDefault);
    if (!clubForm.name.trim()) {
      setClubError("Nome do clube é obrigatório.");
      return;
    }
    if (!clubForm.addressId.trim()) {
      setClubError("Seleciona uma morada normalizada antes de guardar.");
      return;
    }
    const courtsNum = Number(clubForm.courtsCount);
    const courtsCount = Number.isFinite(courtsNum) ? Math.min(1000, Math.max(1, Math.floor(courtsNum))) : 1;
    setSavingClub(true);
    const slugCandidates = buildSlugCandidates(clubForm.slug || clubForm.name, 15);
    let savedClub: PadelClub | null = null;
    let lastError: string | null = null;
    try {
      for (const candidate of slugCandidates) {
        const res = await fetch("/api/padel/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: clubForm.id,
            organizationId,
            name: clubForm.name.trim(),
            addressId: clubForm.addressId || null,
            kind: clubForm.kind,
            sourceClubId: clubForm.sourceClubId,
            courtsCount,
            isActive: clubForm.isActive,
            slug: candidate,
            isDefault: clubForm.isDefault,
          }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.club) {
          savedClub = json.club as PadelClub;
          break;
        }
        const errMsg = json?.error || "Erro ao guardar clube.";
        lastError = errMsg;
        const lower = errMsg.toLowerCase();
        if (lower.includes("slug") || lower.includes("já existe") || lower.includes("duplic")) {
          continue;
        } else {
          break;
        }
      }
      if (!savedClub) {
        setSlugError(lastError || "Slug em uso. Tentámos alternativas automáticas.");
        setClubError(lastError || "Erro ao guardar clube.");
        return;
      }
      const club = savedClub;
      setClubs((prev) => {
        const existing = prev.some((c) => c.id === club.id);
        if (existing) return prev.map((c) => (c.id === club.id ? club : c));
        return [club, ...prev];
      });
      setClubMessage(clubForm.id ? "Clube atualizado." : "Clube criado.");
      setClubModalOpen(false);
      setClubForm({ ...DEFAULT_FORM, courtsCount: String(courtsCount) });
      setClubLocationQuery("");
      setClubLocationSuggestions([]);
      setClubLocationSearchError(null);
      setDrawerClubId(club.id);
      trackEvent(clubForm.id ? "padel_club_updated" : "padel_club_created", { clubId: club.id });

      const existingList = await fetchCourtsForClub(club.id);
      const existingCount = existingList.length;
      if (courtsCount > existingCount) {
        const missing = courtsCount - existingCount;
        const createdCourts = await createDefaultCourts(club.id, missing, existingCount + 1);
        const merged = renumberCourts([...existingList, ...createdCourts]);
        if (club.id === selectedClub?.id) setCourts(merged);
        setCourtMessage(`Criados ${createdCourts.length} campos por omissão.`);
        const activeCount = syncActiveCountOnClub(club.id, merged);
        if (club.id !== selectedClub?.id) {
          setClubs((prev) => prev.map((c) => (c.id === club.id ? { ...c, courtsCount: activeCount } : c)));
        }
      } else {
        const normalized = renumberCourts(existingList);
        const activeCount = syncActiveCountOnClub(club.id, normalized);
        if (club.id === selectedClub?.id && existingCount > 0) setCourts(normalized);
        if (club.id !== selectedClub?.id) {
          setClubs((prev) => prev.map((c) => (c.id === club.id ? { ...c, courtsCount: activeCount } : c)));
        }
      }
    } catch (err) {
      console.error("[padel/clubs] save", err);
      setClubError("Erro inesperado ao guardar clube.");
    } finally {
      setSavingClub(false);
    }
  };

  const markDefaultClub = async (club: PadelClub) => {
    setClubError(null);
    setClubMessage(null);
    if (club.kind === "PARTNER") {
      setClubError("Clubes parceiros não podem ser definidos como principal.");
      return;
    }
    const resolvedLocation = resolveClubLocation(club);
    try {
      const res = await fetch("/api/padel/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: club.id,
          organizationId,
          name: club.name,
          addressId: club.addressId ?? null,
          kind: club.kind ?? "OWN",
          courtsCount: club.courtsCount,
          isActive: club.isActive,
          slug: club.slug,
          isDefault: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setClubError(json?.error || "Erro ao definir default.");
      } else {
        const saved = json.club as PadelClub;
        setClubs((prev) => prev.map((c) => ({ ...c, isDefault: c.id === saved.id })));
        setClubMessage("Clube definido como predefinido.");
        trackEvent("padel_club_marked_default", { clubId: saved.id });
      }
    } catch (err) {
      console.error("[padel/clubs] default", err);
      setClubError("Erro inesperado ao definir default.");
    }
  };

  const resetCourtForm = () => {
    setCourtForm(DEFAULT_COURT_FORM);
    setCourtMessage(null);
    setCourtError(null);
  };

  const handleEditCourt = (court: PadelClubCourt) => {
    if (selectedClubIsPartner) {
      setCourtError("Clube parceiro é apenas leitura.");
      return;
    }
    setCourtForm({
      id: court.id,
      name: court.name,
      description: court.description || "",
      indoor: court.indoor,
      isActive: court.isActive,
      displayOrder: court.displayOrder,
    });
  };

  const handleSubmitCourt = async () => {
    if (!selectedClub) return;
    if (selectedClubIsPartner) {
      setCourtError("Clube parceiro é apenas leitura.");
      return;
    }
    const fallbackName = courtForm.name.trim() || `Campo ${courts.length + 1}`;
    const desiredOrder = Number.isFinite(courtForm.displayOrder) ? Math.max(1, Math.floor(courtForm.displayOrder)) : 1;
    const maxOrder = Math.max(1, activeCourtsCount + (courtForm.id ? 0 : courtForm.isActive ? 1 : 0));
    const normalizedOrder = Math.min(maxOrder, desiredOrder);
    setSavingCourt(true);
    setCourtError(null);
    setCourtMessage(null);
    try {
        const res = await fetch(`/api/padel/clubs/${selectedClub.id}/courts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...courtForm,
          name: fallbackName,
          description: courtForm.description.trim(),
          surface: null,
          displayOrder: normalizedOrder,
        }),
      });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          setCourtError(json?.error || "Erro ao guardar campo.");
        } else {
          const court = json.court as PadelClubCourt;
          setCourts((prev) => {
            const exists = prev.some((c) => c.id === court.id);
            const updated = exists ? prev.map((c) => (c.id === court.id ? court : c)) : [...prev, court];
            const normalized = renumberCourts(updated);
            syncActiveCountOnClub(selectedClub.id, normalized);
            return normalized;
          });
          trackEvent(courtForm.id ? "padel_court_updated" : "padel_court_created", {
            clubId: selectedClub.id,
            indoor: court.indoor,
          });
        setCourtMessage(courtForm.id ? "Campo atualizado." : "Campo criado.");
        resetCourtForm();
      }
    } catch (err) {
      console.error("[padel/clubs/courts] save", err);
      setCourtError("Erro inesperado ao guardar campo.");
    } finally {
      setSavingCourt(false);
    }
  };

  const handleConfirmCourtToggle = async () => {
    if (!courtDialog || !selectedClub) return;
    await handleToggleCourtActive(courtDialog.court, courtDialog.nextActive);
    trackEvent(courtDialog.nextActive ? "padel_court_reactivated" : "padel_court_deactivated", {
      clubId: selectedClub.id,
      courtId: courtDialog.court.id,
    });
    setCourtDialog(null);
  };

  const handleToggleClubActive = async (club: PadelClub, next: boolean) => {
    setClubError(null);
    setClubMessage(null);
    setClubDialog(null);
    try {
      const res = await fetch("/api/padel/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: club.id,
          organizationId,
          name: club.name,
          city: club.city,
          addressId: club.addressId ?? null,
          courtsCount: club.courtsCount,
          isActive: next,
          slug: club.slug,
          isDefault: club.isDefault,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setClubError(json?.error || "Erro ao atualizar estado do clube.");
      } else {
        const saved = json.club as PadelClub;
        setClubs((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        setClubMessage(saved.isActive ? "Clube reativado." : "Clube arquivado.");
        trackEvent(saved.isActive ? "padel_club_reactivated" : "padel_club_archived", { clubId: saved.id });
      }
    } catch (err) {
      console.error("[padel/clubs] toggle active", err);
      setClubError("Erro inesperado ao atualizar clube.");
    } finally {
      setClubDialog(null);
    }
  };

  const handleDeleteClub = async (club: PadelClub) => {
    setClubError(null);
    setClubMessage(null);
    try {
      const res = await fetch(`/api/padel/clubs?id=${club.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setClubError(json?.error || "Erro ao apagar clube.");
      } else {
        setClubs((prev) => prev.filter((c) => c.id !== club.id));
        if (drawerClubId === club.id) {
          setDrawerClubId(null);
          setCourts([]);
          setStaff([]);
        }
        setClubMessage("Clube apagado.");
      }
    } catch (err) {
      console.error("[padel/clubs] delete", err);
      setClubError("Erro inesperado ao apagar clube.");
    } finally {
      setDeleteClubDialog(null);
    }
  };

  const handleToggleCourtActive = async (court: PadelClubCourt, next: boolean) => {
    if (!selectedClub) return;
    if (selectedClubIsPartner) {
      setCourtError("Clube parceiro é apenas leitura.");
      return;
    }
    setSavingCourt(true);
    try {
      const res = await fetch(`/api/padel/clubs/${selectedClub.id}/courts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...court, isActive: next }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.court) {
        const updated = json.court as PadelClubCourt;
        setCourts((prev) => {
          const nextList = renumberCourts(prev.map((c) => (c.id === updated.id ? updated : c)));
          syncActiveCountOnClub(selectedClub.id, nextList);
          return nextList;
        });
      }
    } catch (err) {
      console.error("[padel/clubs/courts] toggle", err);
    } finally {
      setSavingCourt(false);
    }
  };

  const handleDeleteCourt = async (court: PadelClubCourt) => {
    if (!selectedClub) return;
    if (selectedClubIsPartner) {
      setCourtError("Clube parceiro é apenas leitura.");
      return;
    }
    setSavingCourt(true);
    try {
      const res = await fetch(`/api/padel/clubs/${selectedClub.id}/courts?courtId=${court.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok !== false) {
        setCourts((prev) => {
          const nextList = renumberCourts(prev.filter((c) => c.id !== court.id));
          syncActiveCountOnClub(selectedClub.id, nextList);
          return nextList;
        });
      } else {
        setCourtError(json?.error || "Erro ao apagar campo.");
      }
    } catch (err) {
      console.error("[padel/clubs/courts] delete", err);
      setCourtError("Erro inesperado ao apagar campo.");
    } finally {
      setSavingCourt(false);
      setDeleteCourtDialog(null);
    }
  };

  const resetStaffForm = () => {
    setStaffForm(DEFAULT_STAFF_FORM);
    setStaffMode("existing");
    setStaffSearch("");
    setStaffError(null);
    setStaffMessage(null);
    setStaffInviteNotice(null);
  };

  const handleEditStaff = (member: PadelClubStaff) => {
    setStaffForm({
      id: member.id,
      email: member.email || "",
      staffMemberId: member.userId || "",
      role: member.role,
      inheritToEvents: member.inheritToEvents,
    });
    setStaffMode(member.userId ? "existing" : "external");
  };

  const handleSubmitStaff = async () => {
    if (!selectedClub) return;
    const selectedMember = staffMode === "existing" ? staffOptions.find((m) => m.userId === staffForm.staffMemberId) : null;
    const emailToSend =
      staffMode === "existing" ? selectedMember?.email ?? "" : staffForm.email.trim();
    if (staffMode === "existing" && !selectedMember) {
      setStaffError("Escolhe um membro do staff global.");
      return;
    }
    if (staffMode === "external" && !emailToSend) {
      setStaffError("Indica o email do contacto externo.");
      return;
    }
    const duplicate =
      staffMode === "existing"
        ? staff.some((s) => s.userId && s.userId === selectedMember?.userId && s.id !== staffForm.id)
        : staff.some((s) => s.email && s.email.toLowerCase() === emailToSend.toLowerCase() && s.id !== staffForm.id);
    if (duplicate) {
      setStaffError("Já tens este contacto associado ao clube.");
      return;
    }
    setStaffError(null);
    setStaffMessage(null);
    setStaffInviteNotice(null);
    try {
      const res = await fetch(`/api/padel/clubs/${selectedClub.id}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: staffForm.id,
          email: emailToSend,
          userId: staffMode === "existing" ? selectedMember?.userId : null,
          role: staffForm.role,
          padelRole: staffForm.role,
          inheritToEvents: staffForm.inheritToEvents,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setStaffError(json?.error || "Erro ao guardar membro.");
      } else {
        const member = json.staff as PadelClubStaff;
        setStaff((prev) => {
          const exists = prev.some((s) => s.id === member.id);
          if (exists) return prev.map((s) => (s.id === member.id ? member : s));
          return [member, ...prev];
        });
        setStaffMessage(staffForm.id ? "Membro atualizado." : "Membro adicionado.");
        if (staffMode === "external" && emailToSend && organizationId) {
          // Tentar enviar convite de organização (staff) para criar conta
          const inviteRes = await fetch("/api/org-hub/organizations/members/invites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizationId,
              identifier: emailToSend,
              role: "STAFF",
            }),
          }).catch(() => null);
          if (inviteRes && inviteRes.ok) {
            setStaffInviteNotice("Convite enviado para criar conta. Ao registar-se, fica ligado como staff do clube.");
          }
        }
        resetStaffForm();
      }
    } catch (err) {
      console.error("[padel/clubs/staff] save", err);
      setStaffError("Erro inesperado ao guardar membro.");
    }
  };

  const getCanonicalField = (canonical: Record<string, unknown> | null | undefined, keys: string[]) => {
    if (!canonical) return null;
    for (const key of keys) {
      const value = canonical[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };

  const resolveClubLocation = (club: PadelClub) => {
    const canonical = (club.addressRef?.canonical as Record<string, unknown> | null) ?? null;
    const city =
      getCanonicalField(canonical, ["city", "addressLine2", "locality"]) || "";
    const address =
      getCanonicalField(canonical, ["addressLine1", "street", "road"]) || "";
    const formatted =
      club.addressRef?.formattedAddress ||
      [address, city].filter(Boolean).join(", ");
    return { city, address, formatted };
  };

  const compactAddress = (club: PadelClub) => {
    const resolved = resolveClubLocation(club);
    const bits = [resolved.formatted].filter(Boolean);
    return bits.join(" · ") || "Local por definir";
  };

  const activeCourtsForClub = (club: PadelClub) => {
    if (!club) return 0;
    if (club.id === selectedClub?.id && courts.length > 0) return computeActiveCount(courts);
    return club.courtsCount || 0;
  };

  const totalActiveCourts = useMemo(() => clubs.reduce((acc, c) => acc + (c.courtsCount || 0), 0), [clubs]);
  const isClubOwnerMode = operationMode === "CLUB_OWNER";
  const isOwnClubForm = clubForm.kind === "OWN" || clubForm.isDefault;
  const isPartnerClubForm = clubForm.kind === "PARTNER";
  const shouldShowLocationBlock = isOwnClubForm || (!clubForm.id && isPartnerClubForm);
  const isClubsTab = activeTab === "clubs";
  const isCourtsTab = activeTab === "courts";
  const showCourtsPanel = isClubsTab || isCourtsTab;
  const calendarBlocksRaw: CalendarBlock[] = calendarData?.blocks ?? [];
  const calendarAvailabilitiesRaw: CalendarAvailability[] = calendarData?.availabilities ?? [];
  const calendarMatchesRaw: CalendarMatch[] = calendarData?.matches ?? [];
  const calendarConflicts: CalendarConflict[] = calendarData?.conflicts ?? [];
  const calendarEventStart = calendarData?.eventStartsAt ?? null;
  const calendarEventEnd = calendarData?.eventEndsAt ?? null;
  const calendarTimezone = calendarData?.eventTimezone ?? "Europe/Lisbon";
  const calendarBuffer = calendarData?.bufferMinutes ?? 5;

  const autoScheduleCapacity = useMemo(() => {
    const parseDate = (value: string | Date | null | undefined) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const windowStart = parseDate(autoScheduleForm.start) ?? parseDate(calendarEventStart);
    const windowEnd = parseDate(autoScheduleForm.end) ?? parseDate(calendarEventEnd);
    if (!windowStart || !windowEnd || windowEnd <= windowStart) return null;

    const duration = Number(autoScheduleForm.duration);
    const buffer = Number(autoScheduleForm.buffer);
    const durationMinutes = Number.isFinite(duration) && duration > 0 ? duration : 60;
    const bufferMinutes = Number.isFinite(buffer) && buffer >= 0 ? buffer : calendarBuffer;

    const advanced = (padelConfig?.advancedSettings || {}) as {
      courtsFromClubs?: Array<unknown>;
      courtIds?: Array<unknown>;
    };
    const courtsFromClubs = Array.isArray(advanced.courtsFromClubs) ? advanced.courtsFromClubs.length : 0;
    const courtsFromIds = Array.isArray(advanced.courtIds) ? advanced.courtIds.length : 0;
    const courtsCount = courtsFromClubs || courtsFromIds || padelConfig?.numberOfCourts || 0;
    if (!courtsCount) return null;

    const totalSlots = computeMatchSlots({
      start: windowStart,
      end: windowEnd,
      courts: courtsCount,
      durationMinutes,
      bufferMinutes,
    });
    if (!totalSlots) return null;
    return {
      totalSlots,
      matchesNeeded: calendarMatchesRaw.length,
      courts: courtsCount,
    };
  }, [
    autoScheduleForm.start,
    autoScheduleForm.end,
    autoScheduleForm.duration,
    autoScheduleForm.buffer,
    calendarEventStart,
    calendarEventEnd,
    calendarBuffer,
    calendarMatchesRaw.length,
    padelConfig?.advancedSettings,
    padelConfig?.numberOfCourts,
  ]);
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [calendarDayTouched, setCalendarDayTouched] = useState(false);
  const startOfDay = useMemo(() => {
    const d = new Date(selectedDay);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }, [selectedDay]);
  const endOfDay = useMemo(() => {
    if (!startOfDay) return null;
    const d = new Date(startOfDay);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [startOfDay]);
  const weekStart = useMemo(() => {
    if (!startOfDay) return null;
    const d = new Date(startOfDay);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [startOfDay]);
  const weekEnd = useMemo(() => {
    if (!weekStart) return null;
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  useEffect(() => {
    if (!calendarEventStart || calendarDayTouched) return;
    const d = new Date(calendarEventStart);
    if (Number.isNaN(d.getTime())) return;
    setSelectedDay(d.toISOString().slice(0, 10));
  }, [calendarEventStart, calendarDayTouched]);

  const isWithinDay = (date: string | Date) => {
    if (!startOfDay || !endOfDay) return true;
    const d = new Date(date);
    return d >= startOfDay && d <= endOfDay;
  };
  const isWithinWeek = (date: string | Date) => {
    if (!weekStart || !weekEnd) return true;
    const d = new Date(date);
    return d >= weekStart && d <= weekEnd;
  };
  const isWithinRange = (date: string | Date) =>
    calendarScope === "day" ? isWithinDay(date) : isWithinWeek(date);

  const calendarBlocks =
    calendarScope === "day" || calendarScope === "week"
      ? calendarBlocksRaw.filter((b) => isWithinRange(b.startAt))
      : calendarBlocksRaw;
  const calendarAvailabilities =
    calendarScope === "day" || calendarScope === "week"
      ? calendarAvailabilitiesRaw.filter((b) => isWithinRange(b.startAt))
      : calendarAvailabilitiesRaw;
  const matchStartsWithinDay = (m: CalendarMatch) => {
    const start = m.startTime || m.plannedStartAt;
    if (!start) return false;
    return isWithinRange(start);
  };
  const calendarMatches =
    calendarScope === "day" || calendarScope === "week"
      ? calendarMatchesRaw.filter((m) => matchStartsWithinDay(m))
      : calendarMatchesRaw;
  const matchesById = useMemo(() => {
    const map = new Map<number, CalendarMatch>();
    calendarMatchesRaw.forEach((m) => map.set(m.id, m));
    return map;
  }, [calendarMatchesRaw]);
  const calendarConflictMap = useMemo(() => {
    return new Map(
      calendarConflicts.map((c) => [
        `${c.type === "block_block" || c.type === "block_match" ? "block" : c.type === "availability_match" ? "availability" : "match"}-${c.aId}`,
        [c.type],
      ]),
    );
  }, [calendarConflicts]);
  const calendarListItems = useMemo(() => {
    const items: CalendarListItem[] = [];
    const toDate = (value?: string | Date | null) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    calendarBlocks.forEach((block) => {
      const start = toDate(block.startAt);
      const end = toDate(block.endAt);
      if (!start || !end) return;
      items.push({
        id: `block-${block.id}`,
        kind: "block",
        label: block.label || "Bloqueio",
        detail: block.note || null,
        start,
        end,
        courtLabel: block.courtName || (block.courtId ? `Campo ${block.courtId}` : null),
        conflict: calendarConflictMap.has(`block-${block.id}`),
      });
    });
    calendarAvailabilities.forEach((availability) => {
      const start = toDate(availability.startAt);
      const end = toDate(availability.endAt);
      if (!start || !end) return;
      items.push({
        id: `availability-${availability.id}`,
        kind: "availability",
        label: availability.playerName || availability.playerEmail || "Jogador",
        detail: availability.note || null,
        start,
        end,
        conflict: calendarConflictMap.has(`availability-${availability.id}`),
      });
    });
    calendarMatches.forEach((match) => {
      const start = toDate(match.startTime || match.plannedStartAt);
      if (!start) return;
      const plannedEnd = toDate(match.plannedEndAt);
      const durationMinutes = Number.isFinite(match.plannedDurationMinutes) ? match.plannedDurationMinutes : 60;
      const end = plannedEnd || new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000);
      const delayInfo = getDelayInfo(match);
      const metaParts = [
        match.groupLabel ? `Grupo ${match.groupLabel}` : null,
        match.roundLabel ? match.roundLabel : null,
        match.status ? match.status : null,
        delayInfo.status ? `Delay ${delayInfo.status}` : null,
      ].filter(Boolean);
      items.push({
        id: `match-${match.id}`,
        kind: "match",
        label: `Jogo #${match.id}`,
        detail: metaParts.length ? metaParts.join(" · ") : null,
        start,
        end,
        courtLabel: match.courtName || (match.courtNumber ? `Campo ${match.courtNumber}` : null),
        conflict: calendarConflictMap.has(`match-${match.id}`),
      });
    });
    return items.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [calendarBlocks, calendarAvailabilities, calendarMatches, calendarConflictMap]);
  const timelineLabel =
    calendarScope === "day"
      ? selectedDay
      : weekStart
        ? `Semana ${formatShortDate(weekStart)}`
        : "Semana";
  const getItemVersion = (kind: "block" | "availability" | "match", id: number) => {
    if (kind === "block") return calendarBlocks.find((block) => block.id === id)?.updatedAt;
    if (kind === "availability") return calendarAvailabilities.find((availability) => availability.id === id)?.updatedAt;
    return calendarMatchesRaw.find((match) => match.id === id)?.updatedAt;
  };

  const resetCalendarForms = () => {
    setBlockForm({ start: "", end: "", label: "", note: "" });
    setAvailabilityForm({ start: "", end: "", playerName: "", playerEmail: "", note: "" });
    setEditingBlockId(null);
    setEditingAvailabilityId(null);
    setEditingBlockVersion(null);
    setEditingAvailabilityVersion(null);
    setCalendarMessage(null);
  };

  const saveCalendarItem = async (type: "block" | "availability") => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para editar o calendário.");
      return;
    }
    const isBlock = type === "block";
    const editingId = isBlock ? editingBlockId : editingAvailabilityId;
    const start = isBlock ? blockForm.start : availabilityForm.start;
    const end = isBlock ? blockForm.end : availabilityForm.end;
    if (!start || !end) {
      setCalendarError("Indica início e fim.");
      return;
    }
    setSavingCalendar(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const payload =
        type === "block"
          ? {
              type: "block",
              id: editingId ?? undefined,
              eventId,
              startAt: blockForm.start,
              endAt: blockForm.end,
              label: blockForm.label || undefined,
              note: blockForm.note || undefined,
              ...(editingBlockVersion ? { version: editingBlockVersion } : {}),
            }
          : {
              type: "availability",
              id: editingId ?? undefined,
              eventId,
              startAt: availabilityForm.start,
              endAt: availabilityForm.end,
              playerName: availabilityForm.playerName || undefined,
              playerEmail: availabilityForm.playerEmail || undefined,
              note: availabilityForm.note || undefined,
              ...(editingAvailabilityVersion ? { version: editingAvailabilityVersion } : {}),
            };

      const res = await fetch("/api/padel/calendar", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setCalendarError(json?.error || "Não foi possível guardar.");
      } else {
        const prev =
          type === "block"
            ? calendarBlocks.find((block) => block.id === editingId)
            : calendarAvailabilities.find((availability) => availability.id === editingId);
        if (prev && editingId) {
          setLastAction({
            type,
            id: editingId,
            prevStart: prev.startAt,
            prevEnd: prev.endAt,
            prevCourtId: "courtId" in prev ? prev.courtId ?? null : null,
            version: prev.updatedAt ?? null,
          });
        } else {
          setLastAction(null);
        }
        setCalendarMessage(editingId ? "Atualizado." : "Guardado.");
        toast(editingId ? "Atualizado" : "Guardado", "ok");
        applyCalendarWarning(json?.warning);
        resetCalendarForms();
        mutateCalendar();
      }
    } catch (err) {
      console.error("[padel/calendar] save", err);
      setCalendarError("Erro inesperado ao guardar.");
    } finally {
      setSavingCalendar(false);
    }
  };

  const handleEditBlock = (block: CalendarBlock) => {
    setEditingAvailabilityId(null);
    setEditingBlockId(block.id);
    setEditingBlockVersion(block.updatedAt || null);
    setBlockForm({
      start: formatDateTimeLocal(block.startAt),
      end: formatDateTimeLocal(block.endAt),
      label: block.label || "",
      note: block.note || "",
    });
  };

  const handleEditAvailability = (av: CalendarAvailability) => {
    setEditingBlockId(null);
    setEditingAvailabilityId(av.id);
    setEditingAvailabilityVersion(av.updatedAt || null);
    setAvailabilityForm({
      start: formatDateTimeLocal(av.startAt),
      end: formatDateTimeLocal(av.endAt),
      playerName: av.playerName || "",
      playerEmail: av.playerEmail || "",
      note: av.note || "",
    });
  };

  const applyCalendarWarning = (warning: any) => {
    const message = typeof warning?.message === "string" ? warning.message : null;
    if (!message) return;
    setCalendarWarning(message);
    toast(message, "warn");
  };

  const handleDeleteCalendarItem = async (type: "block" | "availability", id: number) => {
    if (!eventId || !Number.isFinite(id)) return;
    const sure = window.confirm("Remover este registo?");
    if (!sure) return;
    setSavingCalendar(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const res = await fetch(`/api/padel/calendar?type=${type}&id=${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setCalendarError(json?.error || "Não foi possível remover.");
      } else {
        setCalendarMessage("Removido.");
        resetCalendarForms();
        mutateCalendar();
        setLastAction(null);
      }
    } catch (err) {
      console.error("[padel/calendar] delete", err);
      setCalendarError("Erro inesperado ao remover.");
    } finally {
      setSavingCalendar(false);
    }
  };

  const delayAndRescheduleMatch = async (match: CalendarMatch) => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para reagendar.");
      return;
    }
    const reason = window.prompt("Motivo do atraso? (opcional)") ?? "";
    setDelayBusyMatchId(match.id);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const delayRes = await fetch(`/api/padel/matches/${match.id}/delay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, clearSchedule: true, autoReschedule: true }),
      });
      const delayJson = await delayRes.json().catch(() => null);
      if (!delayRes.ok || delayJson?.ok === false) {
        const errMsg = delayJson?.error || "Não foi possível marcar atraso.";
        setCalendarError(errMsg);
        toast(errMsg, "err");
        return;
      }

      if (delayJson?.rescheduled) {
        const msg = "Reagendado automaticamente.";
        setCalendarMessage(msg);
        toast(msg, "ok");
      } else {
        const errCode = typeof delayJson?.rescheduleError === "string" ? delayJson.rescheduleError : null;
        const msg =
          errCode === "NO_COURTS"
            ? "Atraso marcado, sem campos configurados."
            : errCode === "INVALID_WINDOW"
              ? "Atraso marcado, mas a janela é inválida."
              : errCode
                ? "Atraso marcado, sem slot disponível."
                : "Atraso marcado, sem slot automático.";
        setCalendarWarning(msg);
        toast(msg, "warn");
      }
      mutateCalendar();
    } catch (err) {
      console.error("[padel/calendar] delay", err);
      setCalendarError("Erro inesperado ao reagendar.");
      toast("Erro ao reagendar", "err");
    } finally {
      setDelayBusyMatchId(null);
    }
  };

  const runAutoSchedule = async () => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para auto-agendar.");
      return;
    }
    const startIso = toIsoFromLocalInput(autoScheduleForm.start);
    const endIso = toIsoFromLocalInput(autoScheduleForm.end);
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela termina antes do início.");
      return;
    }
    const durationMinutes = Number(autoScheduleForm.duration);
    const slotMinutesValue = Number(autoScheduleForm.slot);
    const bufferMinutesValue = Number(autoScheduleForm.buffer);
    const restMinutesValue = Number(autoScheduleForm.rest);

    const payload: Record<string, unknown> = { eventId };
    if (startIso) payload.startAt = startIso;
    if (endIso) payload.endAt = endIso;
    if (Number.isFinite(durationMinutes) && durationMinutes > 0) payload.durationMinutes = durationMinutes;
    if (Number.isFinite(slotMinutesValue) && slotMinutesValue > 0) payload.slotMinutes = slotMinutesValue;
    if (Number.isFinite(bufferMinutesValue) && bufferMinutesValue >= 0) payload.bufferMinutes = bufferMinutesValue;
    if (Number.isFinite(restMinutesValue) && restMinutesValue >= 0) payload.minRestMinutes = restMinutesValue;
    if (autoScheduleForm.priority) payload.priority = autoScheduleForm.priority;

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    setAutoScheduleSummary(null);
    setAutoSchedulePreview(null);
    try {
      const res = await fetch("/api/padel/calendar/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errMsg = json?.error || "Não foi possível auto-agendar.";
        setCalendarError(errMsg);
        toast(errMsg, "err");
        return;
      }

      const scheduledCount = Number(json?.scheduledCount ?? 0);
      const skippedCount = Number(json?.skippedCount ?? 0);
      const summary = `Agendados ${scheduledCount} jogos${skippedCount ? ` · ${skippedCount} sem slot` : ""}.`;
      setAutoScheduleSummary(summary);
      if (skippedCount > 0) {
        setCalendarWarning(summary);
        toast("Auto-agendamento parcial", "warn");
      } else {
        setCalendarMessage(summary);
        toast("Auto-agendamento completo", "ok");
      }
      const warnings = Array.isArray(json?.warnings) ? json.warnings : [];
      if (warnings.length > 0) {
        const first = warnings[0]?.message ? ` ${warnings[0].message}` : "";
        const warnMsg = `Aviso: ${warnings.length} conflito(s) de agenda.${first}`;
        setCalendarWarning(warnMsg);
        toast(warnMsg, "warn");
      }
      mutateCalendar();
    } catch (err) {
      console.error("[padel/calendar] auto-schedule", err);
      setCalendarError("Erro inesperado ao auto-agendar.");
      toast("Erro ao auto-agendar", "err");
    } finally {
      setAutoScheduling(false);
    }
  };

  const previewAutoSchedule = async () => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para simular.");
      return;
    }
    const startIso = toIsoFromLocalInput(autoScheduleForm.start);
    const endIso = toIsoFromLocalInput(autoScheduleForm.end);
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela termina antes do início.");
      return;
    }
    const durationMinutes = Number(autoScheduleForm.duration);
    const slotMinutesValue = Number(autoScheduleForm.slot);
    const bufferMinutesValue = Number(autoScheduleForm.buffer);
    const restMinutesValue = Number(autoScheduleForm.rest);

    const payload: Record<string, unknown> = { eventId, dryRun: true };
    if (startIso) payload.startAt = startIso;
    if (endIso) payload.endAt = endIso;
    if (Number.isFinite(durationMinutes) && durationMinutes > 0) payload.durationMinutes = durationMinutes;
    if (Number.isFinite(slotMinutesValue) && slotMinutesValue > 0) payload.slotMinutes = slotMinutesValue;
    if (Number.isFinite(bufferMinutesValue) && bufferMinutesValue >= 0) payload.bufferMinutes = bufferMinutesValue;
    if (Number.isFinite(restMinutesValue) && restMinutesValue >= 0) payload.minRestMinutes = restMinutesValue;
    if (autoScheduleForm.priority) payload.priority = autoScheduleForm.priority;

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    setAutoScheduleSummary(null);
    setAutoSchedulePreview(null);
    try {
      const res = await fetch("/api/padel/calendar/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errMsg = json?.error || "Não foi possível simular.";
        setCalendarError(errMsg);
        toast(errMsg, "err");
        return;
      }
      const scheduledCount = Number(json?.scheduledCount ?? 0);
      const skippedCount = Number(json?.skippedCount ?? 0);
      const summary = `Simulação: ${scheduledCount} jogos cabem${skippedCount ? ` · ${skippedCount} sem slot` : ""}.`;
      setAutoScheduleSummary(summary);
      setAutoSchedulePreview(Array.isArray(json?.scheduled) ? json.scheduled : []);
      if (skippedCount > 0) {
        setCalendarWarning(summary);
        toast("Simulação parcial", "warn");
      } else {
        setCalendarMessage(summary);
        toast("Simulação completa", "ok");
      }
      const warnings = Array.isArray(json?.warnings) ? json.warnings : [];
      if (warnings.length > 0) {
        const first = warnings[0]?.message ? ` ${warnings[0].message}` : "";
        const warnMsg = `Aviso: ${warnings.length} conflito(s) de agenda.${first}`;
        setCalendarWarning(warnMsg);
        toast(warnMsg, "warn");
      }
    } catch (err) {
      console.error("[padel/calendar] preview", err);
      setCalendarError("Erro ao simular.");
      toast("Erro ao simular", "err");
    } finally {
      setAutoScheduling(false);
    }
  };

  const saveAutoScheduleDefaults = async () => {
    if (!eventId || !padelConfig) {
      setCalendarError("Sem configuração do torneio para gravar preferências.");
      return;
    }
    const startIso = toIsoFromLocalInput(autoScheduleForm.start);
    const endIso = toIsoFromLocalInput(autoScheduleForm.end);
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela termina antes do início.");
      return;
    }

    const durationMinutes = Number(autoScheduleForm.duration);
    const slotMinutesValue = Number(autoScheduleForm.slot);
    const bufferMinutesValue = Number(autoScheduleForm.buffer);
    const restMinutesValue = Number(autoScheduleForm.rest);

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const res = await fetch("/api/padel/tournaments/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          organizationId: padelConfig.organizationId,
          format: padelConfig.format,
          numberOfCourts: padelConfig.numberOfCourts,
          ruleSetId: padelConfig.ruleSetId ?? null,
          defaultCategoryId: padelConfig.defaultCategoryId ?? null,
          eligibilityType: padelConfig.eligibilityType ?? null,
          splitDeadlineHours: padelConfig.splitDeadlineHours ?? null,
          enabledFormats: padelConfig.enabledFormats ?? null,
          scheduleDefaults: {
            windowStart: startIso ?? null,
            windowEnd: endIso ?? null,
            durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes) : null,
            slotMinutes: Number.isFinite(slotMinutesValue) && slotMinutesValue > 0 ? Math.round(slotMinutesValue) : null,
            bufferMinutes: Number.isFinite(bufferMinutesValue) && bufferMinutesValue >= 0 ? Math.round(bufferMinutesValue) : null,
            minRestMinutes: Number.isFinite(restMinutesValue) && restMinutesValue >= 0 ? Math.round(restMinutesValue) : null,
            priority:
              autoScheduleForm.priority === "KNOCKOUT_FIRST" || autoScheduleForm.priority === "GROUPS_FIRST"
                ? autoScheduleForm.priority
                : null,
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errMsg = json?.error || "Não foi possível guardar preferências.";
        setCalendarError(errMsg);
        toast(errMsg, "err");
        return;
      }
      setCalendarMessage("Preferências guardadas.");
      toast("Preferências guardadas", "ok");
      mutatePadelConfig();
    } catch (err) {
      console.error("[padel/calendar] save defaults", err);
      setCalendarError("Erro ao guardar preferências.");
      toast("Erro ao guardar preferências", "err");
    } finally {
      setAutoScheduling(false);
    }
  };

  const commandActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      description: string;
      shortcut?: string;
      run: () => void;
      enabled?: boolean;
    }> = [
      {
        id: "open-wizard",
        label: "Criar torneio",
        description: "Abrir wizard Padel.",
        shortcut: "G",
        run: () =>
          router.push(
            tournamentsCreateHref,
          ),
      },
      {
        id: "open-tournaments",
        label: "Torneios",
        description: "Lista e gestão de torneios.",
        shortcut: "T",
        run: () => setPadelSection("tournaments"),
      },
      {
        id: "open-calendar",
        label: "Calendário",
        description: "Agenda e auto-schedule.",
        shortcut: "C",
        run: () => setPadelSection("calendar"),
        enabled: Boolean(eventId),
      },
      {
        id: "open-settings",
        label: "Gestão",
        description: "Regras, waitlist, monitor.",
        shortcut: "S",
        run: () => setPadelSection("manage"),
        enabled: Boolean(eventId),
      },
      {
        id: "open-players",
        label: "Jogadores",
        description: "Diretório e perfis.",
        shortcut: "J",
        run: () => setPadelSection("players"),
      },
      {
        id: "open-partnerships",
        label: "Parcerias",
        description: "Acordos, janelas e compensações.",
        shortcut: "P",
        run: () => setPadelSection("partnerships"),
        enabled: toolMode === "CLUB",
      },
      {
        id: "open-live",
        label: "LiveHub",
        description: "Abrir painel live.",
        run: () => {
          if (!eventId) return;
          if (!organizationId) return;
          window.open(buildOrgHref(organizationId, `/padel/tournaments/${eventId}/live`), "_blank");
        },
        enabled: Boolean(eventId),
      },
      {
        id: "open-monitor",
        label: "Monitor TV",
        description: "Abrir monitor público.",
        run: () => {
          if (!selectedEvent?.slug) return;
          window.open(`/eventos/${selectedEvent.slug}/monitor`, "_blank");
        },
        enabled: Boolean(selectedEvent?.slug),
      },
      {
        id: "preview-schedule",
        label: "Simular auto-schedule",
        description: "Pré-visualizar agenda.",
        run: () => previewAutoSchedule(),
        enabled: Boolean(eventId),
      },
      {
        id: "apply-schedule",
        label: "Aplicar auto-schedule",
        description: "Gerar calendário real.",
        run: () => runAutoSchedule(),
        enabled: Boolean(eventId),
      },
      {
        id: "open-ops",
        label: "Operacional hoje",
        description: "Abrir painel de alertas.",
        shortcut: "O",
        run: () => setShowOpsDrawer(true),
        enabled: Boolean(eventId),
      },
    ];
    return actions.filter((action) => action.enabled !== false);
  }, [eventId, organizationId, previewAutoSchedule, router, runAutoSchedule, selectedEvent?.slug, setPadelSection, toolMode, tournamentsCreateHref]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (showCommandPalette) return;
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName?.toLowerCase();
      if (tag && ["input", "textarea", "select"].includes(tag)) return;
      const key = event.key.toLowerCase();
      if (!key || key.length !== 1) return;
      const action = commandActions.find((cmd) => cmd.shortcut?.toLowerCase() === key);
      if (!action) return;
      event.preventDefault();
      action.run();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handler);
      }
    };
  }, [commandActions, showCommandPalette]);

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return commandActions;
    return commandActions.filter((action) => {
      const hay = `${action.label} ${action.description}`.toLowerCase();
      return hay.includes(query);
    });
  }, [commandActions, commandQuery]);

  const isClubTool = toolMode === "CLUB";
  const toolBadge = isClubTool ? "Gestão de Clube Padel" : "Torneios de Padel";
  const toolTitle = isClubTool ? "Configuração Padel + Atalhos" : "Gestão de Torneios Padel";
  const toolSubtitle = isClubTool
    ? "Clubes, courts, equipa local, comunidade e atalhos cross-module."
    : "Formatos, categorias, equipas, calendário e operação competitiva.";
  const toolSwitchHref = isClubTool ? toolTournamentsHref : toolClubHref;
  const toolSwitchLabel = isClubTool ? "Abrir Torneios de Padel" : "Abrir Gestão de Clube Padel";

  return (
    <div className="space-y-5 rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#101b39]/70 to-[#050810]/90 px-4 py-6 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/12 bg-gradient-to-r from-[#0b1226]/80 via-[#101b39]/75 to-[#050811]/90 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            {toolBadge}
          </div>
          <h1 className="text-3xl font-semibold text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">{toolTitle}</h1>
          <p className="text-sm text-white/70">{toolSubtitle}</p>
        </div>
        <ActionBar className="border-white/15 bg-white/6">
          <Link
            href={toolSwitchHref}
            className={CTA_PAD_SECONDARY_SM}
          >
            {toolSwitchLabel}
          </Link>
          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className={CTA_PAD_SECONDARY_SM}
            aria-label="Abrir command palette"
          >
            Comandos ⌘K
          </button>
          {!isClubTool && eventId && (
            <button
              type="button"
              onClick={() => setShowOpsDrawer(true)}
              className={CTA_PAD_SECONDARY_SM}
              aria-label="Abrir painel operacional"
            >
              Ops hoje
            </button>
          )}
          {!isClubTool && (
            <Link href={tournamentsCreateHref} className={CTA_PAD_SECONDARY_SM}>
              Criar torneio
            </Link>
          )}
        </ActionBar>
      </header>

      {isClubTool ? (
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Modo de operação</p>
              <p className="text-sm text-white/70">
                Ajusta o fluxo de clubes conforme tens clube próprio ou organizas em clubes parceiros.
              </p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {isClubOwnerMode ? "Clube próprio" : "Organizador"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setOperationMode("CLUB_OWNER")}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isClubOwnerMode
                  ? "border-cyan-300/60 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(107,255,255,0.35)]"
                  : "border-white/12 bg-white/5 text-white/70 hover:border-white/25"
              }`}
            >
              <p className="text-sm font-semibold">Tenho clube</p>
              <p className="text-[12px] text-white/60">Cria clube principal, campos e equipa local.</p>
            </button>
            <button
              type="button"
              onClick={() => setOperationMode("ORGANIZER")}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                !isClubOwnerMode
                  ? "border-amber-300/60 bg-amber-400/10 text-white shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                  : "border-white/12 bg-white/5 text-white/70 hover:border-white/25"
              }`}
            >
              <p className="text-sm font-semibold">Organizo em clubes parceiros</p>
              <p className="text-[12px] text-white/60">Gere clubes parceiros e usa-os em torneios.</p>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Dependências da Gestão de Clube</p>
              <p className="text-sm text-white/70">
                Clubes, courts e staff são geridos na Gestão de Clube Padel e consumidos aqui.
              </p>
            </div>
            <Link href={toolClubHref} className={CTA_PAD_SECONDARY_SM}>
              Abrir Gestão de Clube Padel
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#0b1124]/70 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">KPIs 30 dias</p>
              <p className="text-sm text-white/70">Receita, inscrições e atividade do torneio.</p>
            </div>
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              Padel
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/12 bg-black/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Receita líquida</p>
              <p className="text-xl font-semibold text-white">{overviewRevenueLabel}</p>
              <p className="text-[11px] text-white/60">
                {padelOverview ? `${padelOverview.totalTickets ?? 0} inscrições` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Receita bruta</p>
              <p className="text-xl font-semibold text-white">{overviewGrossLabel}</p>
              <p className="text-[11px] text-white/60">
                {padelOverview ? `${padelOverview.eventsWithSalesCount ?? 0} eventos com vendas` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Taxas</p>
              <p className="text-xl font-semibold text-white">{overviewFeesLabel}</p>
              <p className="text-[11px] text-white/60">Plataforma + processamento</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/40 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Eventos ativos</p>
              <p className="text-xl font-semibold text-white">
                {padelOverview ? padelOverview.activeEventsCount ?? 0 : "—"}
              </p>
              <p className="text-[11px] text-white/60">Publicados agora</p>
            </div>
          </div>
          {padelOverviewError && (
            <p className="mt-3 text-[11px] text-amber-200">{padelOverviewError}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Atalhos rápidos</p>
              <p className="text-sm text-white/70">Acesso direto a módulos-chave.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-white/12 bg-black/35 px-3 py-3 text-left transition hover:border-white/30 hover:bg-white/5"
              >
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="text-[11px] text-white/60">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Áreas da ferramenta</p>
            <p className="text-sm text-white/70">
              {isClubTool
                ? "Operação de clube e comunidade, sem duplicar módulos core."
                : "Operação competitiva e calendário de torneios."}
            </p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
            {allowedTabs.length} áreas
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {allowedTabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={`padel-tab-${tab}`}
                type="button"
                onClick={() => setPadelSection(tab)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-cyan-300/70 bg-cyan-400/15 text-white shadow-[0_0_0_1px_rgba(107,255,255,0.35)]"
                    : "border-white/20 bg-white/5 text-white/75 hover:border-white/35"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/12 bg-gradient-to-br from-[#0b1226]/85 via-[#0b1124]/70 to-[#050912]/90 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] sm:grid-cols-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Calendário</p>
          <p className="text-2xl font-semibold">Jogos & bloqueios</p>
          <p className="text-[12px] text-white/60">Agenda por campo.</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
            {isClubOwnerMode ? "Clubes" : "Clubes parceiros"}
          </p>
          <p className="text-2xl font-semibold">{clubs.length}</p>
          <p className="text-[12px] text-white/60">
            {hasActiveClub
              ? "Ativos."
              : isClubOwnerMode
                ? "Define pelo menos um."
                : "Adiciona o primeiro parceiro."}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Categorias</p>
          <p className="text-2xl font-semibold">{categories.length}</p>
          <p className="text-[12px] text-white/60">Níveis e géneros.</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Campos ativos</p>
          <p className="text-2xl font-semibold">{Number.isFinite(totalActiveCourts) ? totalActiveCourts : "—"}</p>
          <p className="text-[12px] text-white/60">Sugestão no wizard.</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Jogadores</p>
          <p className="text-2xl font-semibold">{players.length}</p>
          <p className="text-[12px] text-white/60">Roster via inscrições.</p>
        </div>
      </div>

      {switchingTab && <PadelTabSkeleton />}

      {!switchingTab && activeTab === "create" && (
        <div className="grid gap-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Criar torneio</p>
            <h2 className="text-2xl font-semibold text-white">Wizard dedicado para Padel</h2>
            <p className="text-sm text-white/70">
              Define formato, categorias, preços, courts e publicação num fluxo único. Sem estados impossíveis.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={tournamentsCreateHref} className={CTA_PAD_PRIMARY_SM}>
                Abrir wizard
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Checklist rápido</p>
            <ul className="mt-3 space-y-2 text-[12px] text-white/70">
              <li>Clube e timezone confirmados.</li>
              <li>Categorias com preços e capacidade.</li>
              <li>Duração e intervalos para auto-schedule.</li>
              <li>Regras e inscrições prontas para publicar.</li>
            </ul>
          </div>
        </div>
      )}

      {!switchingTab && activeTab === "tournaments" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Operação de torneios</p>
              <p className="text-sm text-white/70">Lista rápida, estado e atalhos para live/configuração.</p>
            </div>
            <Link href={tournamentsCreateHref} className={CTA_PAD_PRIMARY_SM}>
              Novo torneio
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/12 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Total</p>
              <p className="mt-1 text-xl font-semibold text-white">{padelEvents.length}</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Publicados</p>
              <p className="mt-1 text-xl font-semibold text-white">{publishedEventsCount}</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Live</p>
              <p className="mt-1 text-xl font-semibold text-white">{liveEventsCount}</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Interclubes</p>
              <p className="mt-1 text-xl font-semibold text-white">{interclubEvents.length}</p>
            </div>
          </div>

          {padelEventsError && <p className="text-[12px] text-amber-200">{padelEventsError}</p>}

          {sortedPadelEvents.length === 0 ? (
            <div className="rounded-xl border border-white/12 bg-black/25 px-4 py-6 text-sm text-white/70">
              Ainda não existem torneios de padel para esta organização.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPadelEvents.slice(0, 12).map((event) => {
                const statusKey = (event.status || "").toUpperCase();
                const statusLabel = TOURNAMENT_STATUS_LABELS[statusKey] || statusKey || "—";
                const liveTone =
                  statusKey === "LIVE"
                    ? "border-emerald-300/60 bg-emerald-400/10 text-emerald-100"
                    : "border-white/20 bg-white/5 text-white/70";
                return (
                  <article
                    key={`tournament-row-${event.id}`}
                    className="rounded-xl border border-white/12 bg-black/25 px-3 py-3 text-sm text-white/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">{event.title || `Torneio ${event.id}`}</p>
                        <p className="text-[12px] text-white/60">
                          {event.startsAt ? formatShortDate(event.startsAt) : "Data por definir"}
                          {event.padelClubName ? ` · ${event.padelClubName}` : ""}
                          {event.isInterclub ? " · Interclubes" : ""}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${liveTone}`}>{statusLabel}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={organizationId ? buildOrgHref(organizationId, `/events/${event.id}`) : buildOrgHubHref("/organizations")} className={CTA_PAD_SECONDARY_SM}>
                        Abrir
                      </Link>
                      <Link href={organizationId ? buildOrgHref(organizationId, `/events/${event.id}/live`) : buildOrgHubHref("/organizations")} className={CTA_PAD_SECONDARY_SM}>
                        Live
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPadelEventId(event.id)}
                        className="rounded-full border border-white/25 px-3 py-2 text-[12px] font-semibold text-white/85 hover:border-white/45"
                      >
                        Calendário
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!switchingTab && activeTab === "calendar" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Calendário de jogos</p>
              <p className="text-sm text-white/70">Visual por campo: jogos e bloqueios.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80">
                <span className="text-white/50">Torneio</span>
                <select
                  value={eventId ? String(eventId) : ""}
                  onChange={(e) => setPadelEventId(e.target.value ? Number(e.target.value) : null)}
                  className="min-w-[180px] bg-transparent text-white/90 outline-none"
                  disabled={padelEventsLoading}
                >
                  <option value="">
                    {padelEventsLoading
                      ? "A carregar torneios..."
                      : padelEvents.length > 0
                        ? "Seleciona um torneio"
                        : "Sem torneios de padel"}
                  </option>
                  {padelEvents.map((event) => (
                    <option key={`padel-event-${event.id}`} value={event.id}>
                      {(event.title || `Torneio ${event.id}`).trim()}
                      {event.startsAt ? ` · ${formatShortDate(event.startsAt)}` : ""}
                      {event.padelClubName ? ` · ${event.padelClubName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/75">
                Fuso: {calendarTimezone}
              </span>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/75">
                Buffer: {calendarBuffer} min
              </span>
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
                {["week", "day"].map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setCalendarScope(scope as "week" | "day")}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      calendarScope === scope ? "bg-white text-black shadow" : "text-white/75"
                    }`}
                    disabled={switchingTab}
                  >
                    {scope === "week" ? "Semana" : "Dia"}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => {
                  setCalendarDayTouched(true);
                  setSelectedDay(e.target.value);
                }}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80 outline-none focus:border-white/60 focus:ring-2 focus:ring-cyan-400/40"
              />
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
                {[
                  { key: "all", label: "Todos os clubes" },
                  { key: "club", label: "Clube selecionado" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setCalendarFilter(opt.key as "all" | "club")}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      calendarFilter === opt.key ? "bg-white text-black shadow" : "text-white/75"
                    }`}
                    disabled={switchingTab}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
                {[15, 30].map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSlotMinutes(slot)}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      slotMinutes === slot ? "bg-white text-black shadow" : "text-white/75"
                    }`}
                    disabled={switchingTab}
                  >
                    Slot {slot}m
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
                {[
                  { key: "timeline", label: "Timeline" },
                  { key: "list", label: "Lista" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setCalendarView(opt.key as "timeline" | "list");
                      setCalendarViewTouched(true);
                    }}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      calendarView === opt.key ? "bg-white text-black shadow" : "text-white/75"
                    }`}
                    disabled={switchingTab}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="h-[420px] rounded-2xl border border-dashed border-white/15 bg-black/25 p-4 text-white/70">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  {calendarView === "timeline" ? "Timeline" : "Lista"}
                </p>
                {isCalendarLoading && <span className="text-[11px] text-white/60 animate-pulse">A carregar…</span>}
              </div>
              {!eventId && (
                <div className="mt-2 space-y-1 text-[12px] text-white/60">
                  <p>Seleciona um torneio para carregar o calendário.</p>
                  {!padelEventsLoading && padelEvents.length === 0 && (
                    <p className="text-white/50">
                      Ainda não tens torneios de padel.{" "}
                      <Link href={tournamentsCreateHref} className="text-white underline">
                        Criar torneio
                      </Link>
                      .
                    </p>
                  )}
                  {padelEventsError && <p className="text-red-200">{padelEventsError}</p>}
                </div>
              )}
              {eventId && !padelEventsLoading && !selectedEvent && (
                <p className="mt-2 text-[12px] text-amber-200">
                  Torneio indisponível para esta organização.
                </p>
              )}
              {eventId && !isCalendarLoading && calendarError && (
                <p className="mt-2 text-[12px] text-red-200">{calendarError}</p>
              )}
              {eventId && !isCalendarLoading && calendarWarning && (
                <p className="mt-2 text-[12px] text-amber-200">{calendarWarning}</p>
              )}
              {eventId && !isCalendarLoading && calendarMessage && (
                <p className="mt-2 text-[12px] text-emerald-200">{calendarMessage}</p>
              )}
              {eventId && calendarScope === "day" && !isCalendarLoading && !calendarError && startOfDay && (
                <p className="mt-2 text-[12px] text-white/60">
                  A mostrar registos de {selectedDay} ({formatZoned(startOfDay, calendarTimezone)}).
                </p>
              )}
              {eventId && !isCalendarLoading && !calendarError && (
                <div className="mt-3 space-y-3">
                  {calendarView === "timeline" ? (
                    <>
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
                        <p className="mb-2 text-[12px] uppercase tracking-[0.16em] text-white/55">
                          Visão rápida
                        </p>
                        <TimelineView
                          blocks={calendarBlocks}
                          availabilities={calendarAvailabilities}
                          matches={calendarMatches}
                          timezone={calendarTimezone}
                          dayStart={startOfDay}
                          dayLabel={timelineLabel}
                          conflictMap={calendarConflictMap}
                          slotMinutes={slotMinutes}
                          onDrop={async (payload) => {
                            // Persistir drop no servidor (mantendo duração). Usa PATCH no tipo certo.
                            if (!eventId) return;
                            const [kind, rawId] = payload.id.split("-");
                            const parsedId = Number(rawId);
                            if (!Number.isFinite(parsedId)) return;
                            if (kind === "match") {
                              const match = matchesById.get(parsedId);
                              if (!match?.courtId) {
                                setCalendarWarning("Define primeiro o court do jogo para o mover.");
                                toast("Define o court do jogo antes de mover", "warn");
                                return;
                              }
                            }
                            setSavingCalendar(true);
                            setCalendarError(null);
                            setCalendarMessage(null);
                            setCalendarWarning(null);
                            try {
                              const currentVersion = getItemVersion(kind as any, parsedId);
                              const prevMatch = kind === "match" ? matchesById.get(parsedId) : null;
                              const res = await fetch("/api/padel/calendar", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  type:
                                    kind === "block"
                                      ? "block"
                                      : kind === "availability"
                                        ? "availability"
                                        : kind === "match"
                                          ? "match"
                                          : null,
                                  id: parsedId,
                                  startAt: payload.start.toISOString(),
                                  endAt: payload.end.toISOString(),
                                  ...(currentVersion ? { version: currentVersion } : {}),
                                  ...(payload.courtId ? { courtId: payload.courtId } : {}),
                                }),
                              });
                              const json = await res.json().catch(() => null);
                              if (!res.ok || json?.ok === false) {
                                const errMsg = json?.error || "Não foi possível mover.";
                                if (res.status === 409 || errMsg.toLowerCase().includes("conflito")) {
                                  setCalendarWarning(errMsg);
                                  toast(errMsg, "warn");
                                } else if (res.status === 423 || errMsg.toLowerCase().includes("lock")) {
                                  setCalendarWarning("Outro admin está a editar este slot.");
                                  toast("Outro admin a editar este slot.", "warn");
                                } else if (res.status === 409 && errMsg.toLowerCase().includes("stale")) {
                                  setCalendarWarning("Atualiza a página, houve edição em paralelo.");
                                  toast("Edição desatualizada, atualiza a página.", "warn");
                                } else {
                                  setCalendarError(errMsg);
                                  toast(errMsg, "err");
                                }
                              } else {
                                setCalendarMessage("Atualizado via drag & drop.");
                                toast("Atualizado via drag & drop", "ok");
                                applyCalendarWarning(json?.warning);
                                if (kind === "block") {
                                  const prev = calendarBlocks.find((block) => block.id === parsedId);
                                  if (prev) {
                                    setLastAction({
                                      type: "block",
                                      id: parsedId,
                                      prevStart: prev.startAt,
                                      prevEnd: prev.endAt,
                                      prevCourtId: prev.courtId ?? null,
                                      version: prev.updatedAt ?? null,
                                    });
                                  }
                                } else if (kind === "availability") {
                                  const prev = calendarAvailabilities.find(
                                    (availability) => availability.id === parsedId,
                                  );
                                  if (prev) {
                                    setLastAction({
                                      type: "availability",
                                      id: parsedId,
                                      prevStart: prev.startAt,
                                      prevEnd: prev.endAt,
                                      version: prev.updatedAt ?? null,
                                    });
                                  }
                                } else if (kind === "match" && prevMatch) {
                                  const start = prevMatch.startTime || prevMatch.plannedStartAt;
                                  if (start) {
                                    const end =
                                      prevMatch.plannedEndAt ||
                                      (prevMatch.plannedDurationMinutes
                                        ? new Date(
                                            new Date(start).getTime() +
                                              prevMatch.plannedDurationMinutes * 60 * 1000,
                                          ).toISOString()
                                        : start);
                                    setLastAction({
                                      type: "match",
                                      id: parsedId,
                                      prevStart: start,
                                      prevEnd: end,
                                      prevCourtId: prevMatch.courtId ?? null,
                                      prevDuration: prevMatch.plannedDurationMinutes ?? null,
                                      version: prevMatch.updatedAt ?? null,
                                    });
                                  }
                                }
                                mutateCalendar();
                              }
                            } catch (err) {
                              console.error("[padel/calendar] drag-drop update", err);
                              setCalendarError("Erro ao mover.");
                              toast("Erro ao mover", "err");
                            } finally {
                              setSavingCalendar(false);
                            }
                          }}
                        />
                      </div>
                      <div className="grid gap-2 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">Bloqueios</p>
                          {calendarBlocks.length === 0 && (
                            <p className="text-[12px] text-white/55">Sem bloqueios.</p>
                          )}
                          {[...calendarBlocks]
                            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                            .slice(0, 6)
                            .map((block) => (
                              <div
                                key={`block-${block.id}`}
                                className="space-y-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px]"
                              >
                                <p className="font-semibold text-white">
                                  Bloqueio {block.label || `#${block.id}`}
                                </p>
                                <p className="text-white/65">
                                  {formatZoned(block.startAt, calendarTimezone)} →{" "}
                                  {formatZoned(block.endAt, calendarTimezone)}
                                </p>
                                {block.note && <p className="text-white/55">Nota: {block.note}</p>}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditBlock(block)}
                                    className="rounded-full border border-white/20 px-2 py-[5px] text-[11px] text-white hover:border-white/35"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCalendarItem("block", block.id)}
                                    className="rounded-full border border-red-300/60 bg-red-500/15 px-2 py-[5px] text-[11px] text-red-50 hover:border-red-200/70"
                                  >
                                    Apagar
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">
                            Indisponibilidades
                          </p>
                          {calendarAvailabilities.length === 0 && (
                            <p className="text-[12px] text-white/55">Sem indisponibilidades.</p>
                          )}
                          {[...calendarAvailabilities]
                            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                            .slice(0, 6)
                            .map((av) => (
                              <div
                                key={`av-${av.id}`}
                                className="space-y-1 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[12px] text-white"
                              >
                                <p className="font-semibold">{av.playerName || av.playerEmail || "Jogador"}</p>
                                <p className="text-white/70">
                                  {formatZoned(av.startAt, calendarTimezone)} →{" "}
                                  {formatZoned(av.endAt, calendarTimezone)}
                                </p>
                                {av.note && <p className="text-white/65">Nota: {av.note}</p>}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditAvailability(av)}
                                    className="rounded-full border border-white/30 px-2 py-[5px] text-[11px] text-white hover:border-white/45"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCalendarItem("availability", av.id)}
                                    className="rounded-full border border-red-300/60 bg-red-500/15 px-2 py-[5px] text-[11px] text-red-50 hover:border-red-200/70"
                                  >
                                    Apagar
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                          <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">Jogos agendados</p>
                          {calendarMatches.length === 0 && (
                            <p className="text-[12px] text-white/55">Sem jogos com horário definido.</p>
                          )}
                          {[...calendarMatches]
                            .sort(
                              (a, b) =>
                                new Date(a.startTime || a.plannedStartAt || 0).getTime() -
                                new Date(b.startTime || b.plannedStartAt || 0).getTime(),
                            )
                            .slice(0, 6)
                            .map((m) => {
                              const matchStart = m.startTime || m.plannedStartAt;
                              const matchStartLabel = matchStart ? formatZoned(matchStart, calendarTimezone) : "—";
                              const delayInfo = getDelayInfo(m);
                              const isDelayed = delayInfo.status === "DELAYED";
                              const isRescheduled = delayInfo.status === "RESCHEDULED";
                              return (
                                <div
                                  key={`match-${m.id}`}
                                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${
                                    calendarConflicts.some(
                                      (c) => c.aId === m.id && c.type !== "outside_event_window",
                                    )
                                      ? "border-red-400/70 bg-red-500/10"
                                      : calendarConflicts.some(
                                            (c) => c.aId === m.id && c.type === "outside_event_window",
                                          )
                                        ? "border-amber-300/60 bg-amber-500/10"
                                        : "border-white/12 bg-gradient-to-r from-white/8 via-[#0f1c3d]/50 to-[#050912]/80"
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <p className="font-semibold">Jogo #{m.id}</p>
                                    <p className="text-white/70">
                                      {matchStartLabel} · Campo{" "}
                                      {m.courtName || m.courtNumber || m.courtId || "—"}
                                    </p>
                                    <p className="text-white/60">{m.roundLabel || m.groupLabel || "Fase"}</p>
                                    {isDelayed && (
                                      <p className="text-[11px] text-amber-200">
                                        Atrasado{delayInfo.reason ? `: ${delayInfo.reason}` : "."}
                                      </p>
                                    )}
                                    {isRescheduled && (
                                      <p className="text-[11px] text-emerald-200">Reagendado.</p>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const start = m.startTime || m.plannedStartAt;
                                          const end =
                                            m.plannedEndAt ||
                                            (start && m.plannedDurationMinutes
                                              ? new Date(
                                                  new Date(start).getTime() +
                                                    m.plannedDurationMinutes * 60 * 1000,
                                                ).toISOString()
                                              : null);
                                          if (!start || !end) return;
                                          const newEnd = new Date(
                                            new Date(end).getTime() - slotMinutes * 60 * 1000,
                                          );
                                          setSavingCalendar(true);
                                          try {
                                            const res = await fetch("/api/padel/calendar", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                type: "match",
                                                id: m.id,
                                                startAt: start,
                                                endAt: newEnd.toISOString(),
                                                version: m.updatedAt,
                                              }),
                                            });
                                            const json = await res.json().catch(() => null);
                                            if (!res.ok || json?.ok === false) {
                                              setCalendarError(json?.error || "Não foi possível ajustar.");
                                              toast(json?.error || "Não foi possível ajustar.", "err");
                                            } else {
                                              setLastAction({
                                                type: "match",
                                                id: m.id,
                                                prevStart: start,
                                                prevEnd: end,
                                                prevCourtId: m.courtId ?? null,
                                                prevDuration: m.plannedDurationMinutes ?? null,
                                                version: m.updatedAt ?? null,
                                              });
                                              toast("Ajustado -1 slot", "ok");
                                              applyCalendarWarning(json?.warning);
                                              mutateCalendar();
                                            }
                                          } finally {
                                            setSavingCalendar(false);
                                          }
                                        }}
                                        className="rounded-full border border-white/20 px-2 py-[2px] text-[11px] text-white hover:border-white/35"
                                      >
                                        -{slotMinutes}m
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const start = m.startTime || m.plannedStartAt;
                                          const end =
                                            m.plannedEndAt ||
                                            (start && m.plannedDurationMinutes
                                              ? new Date(
                                                  new Date(start).getTime() +
                                                    m.plannedDurationMinutes * 60 * 1000,
                                                ).toISOString()
                                              : null);
                                          if (!start || !end) return;
                                          const newEnd = new Date(
                                            new Date(end).getTime() + slotMinutes * 60 * 1000,
                                          );
                                          setSavingCalendar(true);
                                          try {
                                            const res = await fetch("/api/padel/calendar", {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                type: "match",
                                                id: m.id,
                                                startAt: start,
                                                endAt: newEnd.toISOString(),
                                                version: m.updatedAt,
                                              }),
                                            });
                                            const json = await res.json().catch(() => null);
                                            if (!res.ok || json?.ok === false) {
                                              setCalendarError(json?.error || "Não foi possível ajustar.");
                                              toast(json?.error || "Não foi possível ajustar.", "err");
                                            } else {
                                              setLastAction({
                                                type: "match",
                                                id: m.id,
                                                prevStart: start,
                                                prevEnd: end,
                                                prevCourtId: m.courtId ?? null,
                                                prevDuration: m.plannedDurationMinutes ?? null,
                                                version: m.updatedAt ?? null,
                                              });
                                              toast("Ajustado +1 slot", "ok");
                                              applyCalendarWarning(json?.warning);
                                              mutateCalendar();
                                            }
                                          } finally {
                                            setSavingCalendar(false);
                                          }
                                        }}
                                        className="rounded-full border border-white/20 px-2 py-[2px] text-[11px] text-white hover:border-white/35"
                                      >
                                        +{slotMinutes}m
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => delayAndRescheduleMatch(m)}
                                        disabled={m.status !== "PENDING" || delayBusyMatchId === m.id}
                                        className="rounded-full border border-amber-200/40 bg-amber-400/10 px-2 py-[2px] text-[11px] text-amber-100 hover:border-amber-200/60 disabled:opacity-60"
                                      >
                                        {delayBusyMatchId === m.id ? "A reagendar…" : "Atrasar + auto"}
                                      </button>
                                    </div>
                                  </div>
                                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/75">
                                    {m.status}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                          <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">Conflitos</p>
                          {calendarConflicts.length === 0 && (
                            <p className="text-[12px] text-emerald-200/80">Sem conflitos detetados.</p>
                          )}
                          {calendarConflicts.slice(0, 6).map((c) => (
                            <div
                              key={`${c.type}-${c.aId}-${c.bId}`}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-[12px] shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${
                                c.type === "outside_event_window" || c.type === "availability_match"
                                  ? "border border-amber-300/40 bg-amber-500/10 text-amber-50"
                                  : "border border-red-300/40 bg-red-500/10 text-red-50"
                              }`}
                            >
                              <div className="space-y-1">
                                <p className="font-semibold">{c.summary}</p>
                                <p className="text-red-100/80">Registos #{c.aId} e #{c.bId}</p>
                                {c.type === "player_match" && (
                                  <p className="text-[11px] text-red-100/70">Duplicado no horário.</p>
                                )}
                                {c.type === "outside_event_window" && (
                                  <p className="text-[11px] text-amber-100/80">Fora da janela do evento.</p>
                                )}
                              </div>
                              <span className="rounded-full border border-red-200/40 bg-red-200/15 px-2 py-[6px] text-[11px] text-red-50">
                                {c.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">
                            Vista em lista
                          </p>
                          <span className="text-[11px] text-white/50">
                            {calendarListItems.length} itens
                          </span>
                        </div>
                        <div className="mt-2">
                          <CalendarListView
                            items={calendarListItems}
                            timezone={calendarTimezone}
                            onEditBlock={(rawId) => {
                              const id = Number(rawId.split("-")[1]);
                              if (!Number.isFinite(id)) return;
                              const block = calendarBlocks.find((item) => item.id === id);
                              if (block) handleEditBlock(block);
                            }}
                            onDeleteBlock={(rawId) => {
                              const id = Number(rawId.split("-")[1]);
                              if (!Number.isFinite(id)) return;
                              handleDeleteCalendarItem("block", id);
                            }}
                            onEditAvailability={(rawId) => {
                              const id = Number(rawId.split("-")[1]);
                              if (!Number.isFinite(id)) return;
                              const availability = calendarAvailabilities.find((item) => item.id === id);
                              if (availability) handleEditAvailability(availability);
                            }}
                            onDeleteAvailability={(rawId) => {
                              const id = Number(rawId.split("-")[1]);
                              if (!Number.isFinite(id)) return;
                              handleDeleteCalendarItem("availability", id);
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">Conflitos</p>
                        {calendarConflicts.length === 0 && (
                          <p className="text-[12px] text-emerald-200/80">Sem conflitos detetados.</p>
                        )}
                        {calendarConflicts.slice(0, 6).map((c) => (
                          <div
                            key={`${c.type}-${c.aId}-${c.bId}`}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-[12px] shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${
                              c.type === "outside_event_window" || c.type === "availability_match"
                                ? "border border-amber-300/40 bg-amber-500/10 text-amber-50"
                                : "border border-red-300/40 bg-red-500/10 text-red-50"
                            }`}
                          >
                            <div className="space-y-1">
                              <p className="font-semibold">{c.summary}</p>
                              <p className="text-red-100/80">Registos #{c.aId} e #{c.bId}</p>
                              {c.type === "player_match" && (
                                <p className="text-[11px] text-red-100/70">Duplicado no horário.</p>
                              )}
                              {c.type === "outside_event_window" && (
                                <p className="text-[11px] text-amber-100/80">Fora da janela do evento.</p>
                              )}
                            </div>
                            <span className="rounded-full border border-red-200/40 bg-red-200/15 px-2 py-[6px] text-[11px] text-red-50">
                              {c.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4 text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold text-white">Legenda & próximos passos</p>
              <ul className="space-y-2 text-[13px] text-white/70">
                <li>• Bloqueios e indisponibilidades.</li>
                <li>• Conflitos: sobreposição, dois jogos, fora de horário.</li>
                <li>• Hierarquia: HardBlock &gt; MatchSlot &gt; Booking &gt; SoftBlock (aviso).</li>
                <li>• Vista por clube ou todos.</li>
                <li>• Horas em {calendarTimezone} · buffer {calendarBuffer} min.</li>
              </ul>
              <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0f1c3d]/50 to-[#050912]/90 p-3 text-[13px] text-white/75">
                Sugestão: auto-agenda e ajusta.
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#101a33]/55 to-[#050912]/90 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold text-white">Auto-agendar jogos</p>
              <p className="text-[12px] text-white/65">
                Distribui jogos na janela com campos ativos. Podes guardar como padrão.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={autoScheduleForm.start}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, start: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Início"
                  disabled={!eventId || autoScheduling}
                />
                <input
                  type="datetime-local"
                  value={autoScheduleForm.end}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, end: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Fim"
                  disabled={!eventId || autoScheduling}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <input
                  type="number"
                  min={10}
                  value={autoScheduleForm.duration}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, duration: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Duração (min)"
                  disabled={!eventId || autoScheduling}
                />
                <input
                  type="number"
                  min={5}
                  value={autoScheduleForm.slot}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, slot: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Slot (min)"
                  disabled={!eventId || autoScheduling}
                />
                <input
                  type="number"
                  min={0}
                  value={autoScheduleForm.buffer}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, buffer: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Buffer (min)"
                  disabled={!eventId || autoScheduling}
                />
                <input
                  type="number"
                  min={0}
                  value={autoScheduleForm.rest}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, rest: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Descanso (min)"
                  disabled={!eventId || autoScheduling}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={autoScheduleForm.priority}
                  onChange={(e) => setAutoScheduleForm((p) => ({ ...p, priority: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                  disabled={!eventId || autoScheduling}
                >
                  <option value="GROUPS_FIRST">Prioridade: Grupos</option>
                  <option value="KNOCKOUT_FIRST">Prioridade: Eliminatórias</option>
                </select>
                <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/70">
                  Descanso mínimo evita jogos seguidos da mesma dupla.
                </div>
              </div>
              {autoScheduleCapacity && autoScheduleCapacity.matchesNeeded > autoScheduleCapacity.totalSlots && (
                <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                  Capacidade recomendada (estimativa): {autoScheduleCapacity.matchesNeeded} jogos para ~
                  {autoScheduleCapacity.totalSlots} slots ({autoScheduleCapacity.courts} courts). Ajusta janela,
                  duração ou courts se quiseres mais folga. Este aviso não bloqueia.
                </div>
              )}
              {calendarEventStart && calendarEventEnd && (
                <p className="text-[11px] text-white/60">
                  Janela do evento: {formatZoned(calendarEventStart, calendarTimezone)} →{" "}
                  {formatZoned(calendarEventEnd, calendarTimezone)}.
                </p>
              )}
              <button
                type="button"
                onClick={runAutoSchedule}
                disabled={!eventId || autoScheduling}
                className={CTA_PAD_PRIMARY}
              >
                {autoScheduling ? "A agendar…" : "Auto-agendar jogos"}
              </button>
              <button
                type="button"
                onClick={previewAutoSchedule}
                disabled={!eventId || autoScheduling}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:border-white/45 disabled:opacity-50"
              >
                Simular
              </button>
              <button
                type="button"
                onClick={saveAutoScheduleDefaults}
                disabled={!eventId || !padelConfig || autoScheduling}
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 disabled:opacity-50"
              >
                Guardar
              </button>
              {autoScheduleSummary && <p className="text-[12px] text-white/70">{autoScheduleSummary}</p>}
              {autoSchedulePreview && autoSchedulePreview.length > 0 && (
                <div className="space-y-1 rounded-xl border border-white/15 bg-black/30 p-2 text-[11px] text-white/75">
                  {autoSchedulePreview.slice(0, 6).map((item) => (
                    <p key={`preview-${item.matchId}`}>
                      #{item.matchId} · Campo {item.courtId} · {formatZoned(item.start, calendarTimezone)} →
                      {formatZoned(item.end, calendarTimezone)}
                    </p>
                  ))}
                  {autoSchedulePreview.length > 6 && (
                    <p className="text-white/55">+{autoSchedulePreview.length - 6} jogos</p>
                  )}
                </div>
              )}
              {!eventId && <p className="text-[12px] text-white/55">Falta eventId no URL.</p>}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0f1c3d]/55 to-[#050912]/90 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold text-white">Exportar calendário</p>
              <p className="text-[12px] text-white/65">Partilha a agenda com equipas e clube.</p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={
                    eventId
                      ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "pdf" }) || "#"
                      : "#"
                  }
                  aria-disabled={!eventId}
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[12px] font-semibold text-white ${
                    eventId ? "border-white/25 hover:border-white/45" : "pointer-events-none border-white/10 text-white/40"
                  }`}
                >
                  PDF
                </a>
                <a
                  href={
                    eventId
                      ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "html" }) || "#"
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!eventId}
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[12px] font-semibold text-white ${
                    eventId ? "border-white/25 hover:border-white/45" : "pointer-events-none border-white/10 text-white/40"
                  }`}
                >
                  HTML
                </a>
                <a
                  href={
                    eventId
                      ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "csv" }) || "#"
                      : "#"
                  }
                  aria-disabled={!eventId}
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[12px] font-semibold text-white ${
                    eventId ? "border-white/25 hover:border-white/45" : "pointer-events-none border-white/10 text-white/40"
                  }`}
                >
                  CSV
                </a>
                <a
                  href={
                    eventId
                      ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "ics" }) || "#"
                      : "#"
                  }
                  aria-disabled={!eventId}
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-[12px] font-semibold text-white ${
                    eventId ? "border-white/25 hover:border-white/45" : "pointer-events-none border-white/10 text-white/40"
                  }`}
                >
                  ICS
                </a>
              </div>
              {!eventId && <p className="text-[12px] text-white/55">Seleciona um torneio para exportar.</p>}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0f1c3d]/55 to-[#050912]/90 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold text-white">Novo bloqueio</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={blockForm.start}
                  onChange={(e) => setBlockForm((p) => ({ ...p, start: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Início"
                  disabled={!eventId || savingCalendar}
                />
                <input
                  type="datetime-local"
                  value={blockForm.end}
                  onChange={(e) => setBlockForm((p) => ({ ...p, end: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Fim"
                  disabled={!eventId || savingCalendar}
                />
              </div>
              <input
                type="text"
                value={blockForm.label}
                onChange={(e) => setBlockForm((p) => ({ ...p, label: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Título do bloqueio (opcional)"
                disabled={!eventId || savingCalendar}
              />
              <input
                type="text"
                value={blockForm.note}
                onChange={(e) => setBlockForm((p) => ({ ...p, note: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Nota (opcional)"
                disabled={!eventId || savingCalendar}
              />
              <button
                type="button"
                onClick={() => saveCalendarItem("block")}
                disabled={!eventId || savingCalendar}
                className={CTA_PAD_PRIMARY}
              >
                {savingCalendar ? "A guardar…" : editingBlockId ? "Atualizar bloqueio" : "Guardar bloqueio"}
              </button>
              {lastAction && lastAction.type === "block" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!lastAction) return;
                    setCalendarMessage(null);
                    setCalendarWarning(null);
                    setCalendarError(null);
                    setSavingCalendar(true);
                    fetch("/api/padel/calendar", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "block",
                        id: lastAction.id,
                        startAt: lastAction.prevStart,
                        endAt: lastAction.prevEnd,
                        courtId: lastAction.prevCourtId ?? undefined,
                        version: lastAction.version ?? undefined,
                      }),
                    })
                      .then((res) => res.json().then((json) => ({ res, json })))
                      .then(({ res, json }) => {
                        if (!res.ok || json?.ok === false) {
                          setCalendarError(json?.error || "Não foi possível desfazer.");
                          toast(json?.error || "Não foi possível desfazer.", "err");
                        } else {
                          setCalendarMessage("Desfeito.");
                          toast("Desfeito", "ok");
                          setLastAction(null);
                          mutateCalendar();
                        }
                      })
                      .catch(() => {
                        setCalendarError("Erro ao desfazer.");
                      })
                      .finally(() => setSavingCalendar(false));
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
                >
                  Desfazer último
                </button>
              )}
              {editingBlockId && (
                <button
                  type="button"
                  onClick={resetCalendarForms}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
                >
                  Cancelar edição
                </button>
              )}
              {!eventId && <p className="text-[12px] text-white/55">Precisas de eventId no URL.</p>}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#130c24]/55 to-[#050912]/90 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold text-white">Nova indisponibilidade</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={availabilityForm.start}
                  onChange={(e) => setAvailabilityForm((p) => ({ ...p, start: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Início"
                  disabled={!eventId || savingCalendar}
                />
                <input
                  type="datetime-local"
                  value={availabilityForm.end}
                  onChange={(e) => setAvailabilityForm((p) => ({ ...p, end: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  placeholder="Fim"
                  disabled={!eventId || savingCalendar}
                />
              </div>
              <input
                type="text"
                value={availabilityForm.playerName}
                onChange={(e) => setAvailabilityForm((p) => ({ ...p, playerName: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Nome do jogador (opcional)"
                disabled={!eventId || savingCalendar}
              />
              <input
                type="email"
                value={availabilityForm.playerEmail}
                onChange={(e) => setAvailabilityForm((p) => ({ ...p, playerEmail: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Email (opcional)"
                disabled={!eventId || savingCalendar}
              />
              <input
                type="text"
                value={availabilityForm.note}
                onChange={(e) => setAvailabilityForm((p) => ({ ...p, note: e.target.value }))}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                placeholder="Nota (opcional)"
                disabled={!eventId || savingCalendar}
              />
              <button
                type="button"
                onClick={() => saveCalendarItem("availability")}
                disabled={!eventId || savingCalendar}
                className={CTA_PAD_PRIMARY}
              >
                {savingCalendar ? "A guardar…" : editingAvailabilityId ? "Atualizar indisponibilidade" : "Guardar indisponibilidade"}
              </button>
              {lastAction && lastAction.type === "availability" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!lastAction) return;
                    setCalendarMessage(null);
                    setCalendarWarning(null);
                    setCalendarError(null);
                    setSavingCalendar(true);
                    fetch("/api/padel/calendar", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "availability",
                        id: lastAction.id,
                        startAt: lastAction.prevStart,
                        endAt: lastAction.prevEnd,
                        version: lastAction.version ?? undefined,
                      }),
                    })
                      .then((res) => res.json().then((json) => ({ res, json })))
                      .then(({ res, json }) => {
                        if (!res.ok || json?.ok === false) {
                          setCalendarError(json?.error || "Não foi possível desfazer.");
                          toast(json?.error || "Não foi possível desfazer.", "err");
                        } else {
                          setCalendarMessage("Desfeito.");
                          toast("Desfeito", "ok");
                          setLastAction(null);
                          mutateCalendar();
                        }
                      })
                      .catch(() => {
                        setCalendarError("Erro ao desfazer.");
                      })
                      .finally(() => setSavingCalendar(false));
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
                >
                  Desfazer último
                </button>
              )}
              {editingAvailabilityId && (
                <button
                  type="button"
                  onClick={resetCalendarForms}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
                >
                  Cancelar edição
                </button>
              )}
              {!eventId && <p className="text-[12px] text-white/55">Precisas de eventId no URL.</p>}
            </div>
          </div>
        </div>
      )}

      {!switchingTab && showCourtsPanel && (
        <div className="space-y-4 transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">{isCourtsTab ? "Campos" : "Clubes"}</h2>
              <p className="text-[12px] text-white/65">
                {isCourtsTab
                  ? "Campos ativos por clube e equipa de apoio."
                  : isClubOwnerMode
                    ? "Morada, campos e clube principal."
                    : "Clubes parceiros usados nos torneios."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isCourtsTab && (
                <button
                  type="button"
                  onClick={() => setPadelSection("clubs")}
                  className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/40"
                >
                  Ver clubes
                </button>
              )}
              <button
                type="button"
                onClick={openNewClubModal}
                className={CTA_PAD_PRIMARY}
              >
                Novo clube
              </button>
            </div>
          </div>
          {sortedClubs.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-lg font-semibold">Sem clubes.</p>
              <p className="text-sm text-white/70">
                {isCourtsTab
                  ? "Adiciona um clube para gerir campos."
                  : isClubOwnerMode
                    ? "Adiciona o clube principal com morada e campos."
                    : "Adiciona o primeiro clube parceiro para criar torneios."}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={openNewClubModal}
                  className={CTA_PAD_PRIMARY}
                >
                  Criar clube
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedClubs.map((club) => {
                return (
                  <div
                    key={club.id}
                    className={`rounded-2xl p-4 shadow-[0_16px_60px_rgba(0,0,0,0.45)] ${
                      club.isActive
                        ? "border border-emerald-400/40 bg-emerald-500/5"
                        : "border border-red-500/40 bg-red-500/8"
                    } ${drawerClubId === club.id ? "ring-2 ring-cyan-400/40" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setDrawerClubId(club.id);
                      loadCourtsAndStaff(club.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDrawerClubId(club.id);
                        loadCourtsAndStaff(club.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-white">{club.name}</p>
                        <p className="text-[12px] text-white/65">{compactAddress(club)}</p>
                        <p className="text-[12px] text-white/55">Campos ativos: {activeCourtsForClub(club)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={
                            club.isActive
                              ? badge("green")
                              : "rounded-full border border-red-400/50 bg-red-500/15 px-3 py-1 text-[12px] text-red-100"
                          }
                        >
                          {club.isActive ? "Ativo" : "Inativo"}
                        </span>
                        {club.kind === "PARTNER" && <span className={badge("amber")}>Parceiro</span>}
                        {club.isDefault && <span className={badge("slate")}>Principal</span>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerClubId(club.id);
                          loadCourtsAndStaff(club.id);
                        }}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/30"
                      >
                        Campos & equipa
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditClubModal(club)}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/30"
                      >
                        Editar
                      </button>
                      {!club.isDefault && club.kind !== "PARTNER" && (
                        <button
                          type="button"
                          onClick={() => markDefaultClub(club)}
                          className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30"
                        >
                          Definir default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setClubDialog({ club, nextActive: !club.isActive })}
                        className={`rounded-full border px-3 py-1.5 text-[12px] ${
                          club.isActive
                            ? "border-amber-300/60 bg-amber-400/15 text-amber-50 hover:border-amber-200/80"
                            : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/80"
                        }`}
                      >
                        {club.isActive ? "Arquivar" : "Reativar"}
                      </button>
                      {!club.isActive && (
                        <button
                          type="button"
                          onClick={() => setDeleteClubDialog(club)}
                          className="rounded-full border border-red-400/60 bg-red-500/15 px-3 py-1.5 text-[12px] text-red-50 hover:border-red-300/80"
                        >
                          Apagar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {drawerClubId && selectedClub && (
            <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/65 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">Campos & equipa</p>
                  <p className="text-sm text-white/70">Campos ativos e staff herdável para o wizard.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor="club-switcher">
                    Trocar clube
                  </label>
                  <select
                    id="club-switcher"
                    value={drawerClubId ?? ""}
                    onChange={(e) => {
                      const nextId = Number(e.target.value);
                      if (Number.isFinite(nextId)) {
                        setDrawerClubId(nextId);
                      }
                    }}
                    className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[12px] text-white shadow-inner outline-none transition focus:border-white/60 focus:ring-2 focus:ring-cyan-400/40"
                  >
                    {sortedClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                  <span className={badge("slate")}>{selectedClub.name}</span>
                  <button
                    type="button"
                    onClick={() => setDrawerClubId(null)}
                    className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white hover:border-white/30"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {loadingDrawer && (
                <div className="space-y-3">
                  <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
                  <div className="grid gap-3 lg:grid-cols-2">
                    {[...Array(2)].map((_, idx) => (
                      <div key={idx} className="space-y-2 rounded-xl border border-white/12 bg-white/5 p-3 animate-pulse">
                        <div className="h-4 w-1/2 rounded bg-white/10" />
                        <div className="h-10 rounded bg-white/5" />
                        <div className="h-10 rounded bg-white/5" />
                        <div className="h-3 w-24 rounded bg-white/10" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Campos do clube</p>
                    <span className={badge("slate")}>{courts.filter((c) => c.isActive).length} ativos</span>
                  </div>
                  {selectedClubIsPartner && (
                    <p className="text-[11px] text-amber-200">Clube parceiro é apenas leitura.</p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={courtForm.name}
                      onChange={(e) => setCourtForm((p) => ({ ...p, name: e.target.value }))}
                      disabled={selectedClubIsPartner}
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] disabled:opacity-60"
                      placeholder="Nome do campo"
                    />
                    <input
                      value={courtForm.description}
                      onChange={(e) => setCourtForm((p) => ({ ...p, description: e.target.value }))}
                      disabled={selectedClubIsPartner}
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] disabled:opacity-60"
                      placeholder="Descrição / patrocinador (opcional)"
                    />
                    <div className="col-span-2 flex flex-wrap items-center gap-2 text-sm text-white/80">
                      <span className="text-[12px] uppercase tracking-[0.2em] text-white/60">Tipo</span>
                      <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                        {[
                          { key: false, label: "Outdoor" },
                          { key: true, label: "Indoor" },
                        ].map((opt) => (
                          <button
                            key={String(opt.key)}
                            type="button"
                            onClick={() => setCourtForm((p) => ({ ...p, indoor: opt.key as boolean }))}
                            className={`rounded-full px-3 py-1 transition ${
                              courtForm.indoor === opt.key
                                ? "bg-white text-black font-semibold shadow"
                                : "text-white/75 hover:bg-white/5"
                            }`}
                            disabled={selectedClubIsPartner}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                        {[
                          { key: true, label: "Ativo" },
                          { key: false, label: "Inativo" },
                        ].map((opt) => (
                          <button
                            key={String(opt.key)}
                            type="button"
                            onClick={() => setCourtForm((p) => ({ ...p, isActive: opt.key as boolean }))}
                            className={`rounded-full px-3 py-1 transition ${
                              courtForm.isActive === opt.key
                                ? opt.key
                                  ? "bg-emerald-400 text-black font-semibold"
                                  : "bg-white text-black font-semibold"
                                : "text-white/75 hover:bg-white/5"
                            }`}
                            disabled={selectedClubIsPartner}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitCourt}
                      disabled={savingCourt || selectedClubIsPartner}
                      className={`${CTA_PAD_PRIMARY_SM} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {savingCourt ? "A guardar…" : courtForm.id ? "Atualizar campo" : "Guardar campo"}
                    </button>
                    {courtForm.id && (
                      <button
                        type="button"
                        onClick={resetCourtForm}
                        disabled={selectedClubIsPartner}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  {(courtError || courtMessage) && (
                    <span className="text-[12px] text-white/70">{courtError || courtMessage}</span>
                  )}
                  <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80">
                    {courts.length === 0 && <p className="text-white/60">Sem campos ainda.</p>}
                    {courts.map((c, idx) => (
                      <div
                        key={c.id}
                        draggable={!selectedClubIsPartner}
                        onDragStart={() => setDraggingCourtId(c.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (selectedClubIsPartner) return;
                          const updated = reorderCourts(c.id);
                          if (updated) {
                            persistCourtOrder(updated);
                          }
                          setDraggingCourtId(null);
                        }}
                        onDragEnd={() => setDraggingCourtId(null)}
                        className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 transition ${
                          c.isActive
                            ? "border border-emerald-400/35 bg-emerald-500/5"
                            : "border border-red-500/40 bg-red-500/8"
                        } ${draggingCourtId === c.id ? "opacity-60" : "opacity-100"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg font-bold ${
                              c.isActive
                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
                                : "border-red-400/40 bg-red-500/10 text-red-100"
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{c.name}</p>
                            <p className={`text-[11px] ${c.isActive ? "text-emerald-100/80" : "text-red-100/80"}`}>
                              {c.indoor ? "Indoor" : "Outdoor"} · Ordem {c.displayOrder} · {c.isActive ? "Ativo" : "Inativo"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditCourt(c)}
                            disabled={selectedClubIsPartner}
                            className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30 disabled:opacity-60"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setCourtDialog({ court: c, nextActive: !c.isActive })}
                            disabled={selectedClubIsPartner}
                            className={`rounded-full border px-2 py-1 text-[11px] disabled:opacity-60 ${
                              c.isActive
                                ? "border-amber-300/60 bg-amber-400/15 text-amber-50 hover:border-amber-200/80"
                                : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/80"
                            }`}
                          >
                            {c.isActive ? "Desativar" : "Reativar"}
                          </button>
                          {!c.isActive && (
                            <button
                              type="button"
                              onClick={() => setDeleteCourtDialog(c)}
                              disabled={selectedClubIsPartner}
                              className="rounded-full border border-red-400/60 bg-red-500/15 px-2 py-1 text-[11px] text-red-50 hover:border-red-300/80 disabled:opacity-60"
                            >
                              Apagar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">Staff do clube</p>
                      <p className="text-[11px] text-white/60">
                        {staff.length} membros · {inheritedStaffCount} herdam para torneios
                      </p>
                    </div>
                    <span className={badge("slate")}>Herdam: {inheritedStaffCount}</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      {
                        key: "existing",
                        label: "Staff do organização",
                        desc: "Reaproveita quem já tens no staff global e herda para torneios.",
                      },
                      {
                        key: "external",
                        label: "Contacto externo",
                        desc: "Email + role só para este clube. Podes convidar depois.",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setStaffMode(opt.key as typeof staffMode)}
                        className={`rounded-xl border p-3 text-left transition ${
                          staffMode === opt.key
                            ? "border-white/60 bg-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.45)]"
                            : "border-white/15 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <p className="font-semibold text-white">{opt.label}</p>
                        <p className="text-[12px] text-white/65">{opt.desc}</p>
                      </button>
                    ))}
                  </div>

                  {staffMode === "existing" ? (
                    <div className="space-y-2 rounded-xl border border-white/12 bg-black/30 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                          placeholder="Pesquisar membro (nome, email, username)"
                        />
                        <select
                          value={staffForm.staffMemberId}
                          onChange={(e) => setStaffForm((p) => ({ ...p, staffMemberId: e.target.value }))}
                          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                        >
                          <option value="">Escolhe membro</option>
                          {staffOptions.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {(m.fullName || m.username || m.email || "Membro").trim()} {m.email ? `· ${m.email}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      {staffForm.staffMemberId && (
                        <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-[12px] text-white/75">
                          <p className="font-semibold text-white/90">Resumo rápido</p>
                          <p className="text-white/70">
                            Herdado do staff global; ficará marcado como herdado neste clube e nos torneios.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-white/12 bg-black/30 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={staffForm.email}
                          onChange={(e) => setStaffForm((p) => ({ ...p, email: e.target.value }))}
                          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                          placeholder="Email do contacto"
                        />
                        <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-[12px] text-white/70">
                          Sem conta ORYA: guardamos só email + role. Podes convidar mais tarde.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={staffForm.role}
                      onChange={(e) => setStaffForm((p) => ({ ...p, role: e.target.value }))}
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                    >
                      <option value="ADMIN_CLUBE">Admin clube</option>
                      <option value="DIRETOR_PROVA">Diretor / Árbitro</option>
                      <option value="STAFF">Staff de campo</option>
                    </select>
                    <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                      {[
                        { key: true, label: "Herdar para torneios" },
                        { key: false, label: "Só neste clube" },
                      ].map((opt) => (
                        <button
                          key={String(opt.key)}
                          type="button"
                          onClick={() => setStaffForm((p) => ({ ...p, inheritToEvents: opt.key as boolean }))}
                          className={`rounded-full px-3 py-1 transition ${
                            staffForm.inheritToEvents === opt.key
                              ? "bg-white text-black font-semibold shadow"
                              : "text-white/75 hover:bg-white/5"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitStaff}
                      className={CTA_PAD_PRIMARY_SM}
                    >
                      {staffForm.id ? "Atualizar" : "Adicionar"}
                    </button>
                    {staffForm.id && (
                      <button
                        type="button"
                        onClick={resetStaffForm}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35"
                      >
                        Cancelar
                      </button>
                    )}
                    {(staffError || staffMessage || staffInviteNotice) && (
                      <span className="text-[12px] text-white/70">
                        {staffError || staffMessage || staffInviteNotice}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 rounded-lg border border-white/12 bg-white/5 p-2 text-[12px] text-white/80">
                    {staff.length === 0 && <p className="text-white/60">Sem staff.</p>}
                    {staff.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-1.5"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm text-white">{s.email || s.userId || "Sem contacto"}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-[2px]">{s.role}</span>
                            <span
                              className={`rounded-full border px-2 py-[2px] ${
                                s.inheritToEvents
                                  ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100"
                                  : "border-white/20 bg-white/5 text-white/70"
                              }`}
                            >
                              {s.inheritToEvents ? "Herdado" : "Só clube"}
                            </span>
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-[2px]">
                              {s.userId ? "Global" : "Externo"}
                            </span>
                            {!s.userId && (
                              <span className="rounded-full border border-amber-300/50 bg-amber-400/10 px-2 py-[2px] text-amber-50">
                                Pendente
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditStaff(s)}
                          className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30"
                        >
                          Editar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!switchingTab && activeTab === "partnerships" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Parcerias operacionais</p>
              <p className="text-sm text-white/70">
                Acordos aprovados são o único caminho canónico para operar em clube parceiro.
              </p>
            </div>
            <span className={badge("slate")}>
              {partnershipAgreements.length} acordos · {partnershipPendingCompensationCount} compensações pendentes
            </span>
          </div>

          {(partnershipsError || partnershipError) && (
            <p className="text-[12px] text-amber-200">{partnershipError || partnershipsError}</p>
          )}
          {!partnershipError && partnershipMessage && (
            <p className="text-[12px] text-emerald-200">{partnershipMessage}</p>
          )}

          {(partnershipsLoading || partnershipOverridesLoading) && (
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
            </div>
          )}

          {!partnershipsLoading && partnershipAgreements.length === 0 && (
            <div className="rounded-xl border border-white/12 bg-black/30 px-4 py-4 text-sm text-white/70">
              Sem acordos ainda. Cria acordo via API de parcerias e faz aprovação para disponibilizar janelas.
            </div>
          )}

          {!partnershipsLoading && partnershipAgreements.length > 0 && (
            <div className="space-y-2">
              {partnershipAgreements.map((agreement) => {
                const status = (agreement.status || "PENDING") as PartnershipStatus;
                const statusLabel = PARTNERSHIP_STATUS_LABEL[status] ?? status;
                const statusTone = PARTNERSHIP_STATUS_TONE[status] ?? PARTNERSHIP_STATUS_TONE.PENDING;
                const pendingCases = partnershipCompensationCases.filter(
                  (item) =>
                    item.agreementId === agreement.id &&
                    (item.status === "PENDING_COMPENSATION" || item.status === "OPEN"),
                ).length;
                const recentOverride = partnershipOverrides.find((item) => item.agreementId === agreement.id) ?? null;
                return (
                  <article
                    key={`partnership-${agreement.id}`}
                    className="rounded-xl border border-white/12 bg-black/25 px-3 py-3 text-sm text-white/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">Acordo #{agreement.id}</p>
                        <p className="text-[12px] text-white/60">
                          Clube dono #{agreement.ownerClubId}
                          {agreement.partnerClubId ? ` · Clube parceiro #${agreement.partnerClubId}` : ""}
                          {agreement.activeWindowsCount != null ? ` · Janelas ativas ${agreement.activeWindowsCount}` : ""}
                        </p>
                        <p className="text-[12px] text-white/55">
                          {agreement.policy?.priorityMode ? `Prioridade ${agreement.policy.priorityMode}` : "Sem política configurada"}
                          {agreement.policy?.autoCompensationOnOverride ? " · Compensação auto ativa" : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[11px] ${statusTone}`}>{statusLabel}</span>
                        {pendingCases > 0 && <span className={badge("amber")}>{pendingCases} pendente(s)</span>}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={buildOrgHref(organizationId, `/padel/parcerias/${agreement.id}`)}
                        className="rounded-full border border-white/25 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:border-white/45"
                      >
                        Workspace
                      </Link>
                      {(status === "PENDING" || status === "PAUSED") && (
                        <button
                          type="button"
                          disabled={partnershipActionBusy === agreement.id}
                          onClick={() => runPartnershipAction(agreement.id, "approve")}
                          className={CTA_PAD_PRIMARY_SM}
                        >
                          {partnershipActionBusy === agreement.id ? "A atualizar…" : "Aprovar"}
                        </button>
                      )}
                      {status === "APPROVED" && (
                        <button
                          type="button"
                          disabled={partnershipActionBusy === agreement.id}
                          onClick={() => runPartnershipAction(agreement.id, "pause")}
                          className="rounded-full border border-amber-300/60 bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-100 hover:border-amber-200/80 disabled:opacity-60"
                        >
                          {partnershipActionBusy === agreement.id ? "A atualizar…" : "Pausar"}
                        </button>
                      )}
                      {status !== "REVOKED" && status !== "EXPIRED" && (
                        <button
                          type="button"
                          disabled={partnershipActionBusy === agreement.id}
                          onClick={() => runPartnershipAction(agreement.id, "revoke")}
                          className="rounded-full border border-rose-300/60 bg-rose-500/10 px-3 py-1.5 text-[12px] font-semibold text-rose-100 hover:border-rose-200/80 disabled:opacity-60"
                        >
                          {partnershipActionBusy === agreement.id ? "A atualizar…" : "Revogar"}
                        </button>
                      )}
                      {recentOverride && (
                        <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                          Último override: {recentOverride.reasonCode}
                          {recentOverride.executionStatus ? ` (${recentOverride.executionStatus})` : ""}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-white/12 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Casos de compensação</p>
              <div className="mt-2 space-y-2 text-[12px]">
                {partnershipCompensationCases.length === 0 && (
                  <p className="text-white/60">Sem casos ativos.</p>
                )}
                {partnershipCompensationCases.slice(0, 8).map((item) => (
                  <div key={`comp-case-${item.id}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-white/85">Caso #{item.id} · Acordo #{item.agreementId}</p>
                    <p className="text-white/60">
                      Estado: {item.status}
                      {item.reasonCode ? ` · ${item.reasonCode}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/12 bg-black/25 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Overrides</p>
              <div className="mt-2 space-y-2 text-[12px]">
                {partnershipOverrides.length === 0 && (
                  <p className="text-white/60">Sem overrides registados.</p>
                )}
                {partnershipOverrides.slice(0, 8).map((item) => (
                  <div key={`override-${item.id}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-white/85">
                      Override #{item.id} · Acordo #{item.agreementId}
                    </p>
                    <p className="text-white/60">
                      {item.reasonCode}
                      {item.executionStatus ? ` · ${item.executionStatus}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!switchingTab && activeTab === "manage" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Categorias</p>
              <p className="text-sm text-white/70">Define níveis, género e intervalo.</p>
            </div>
            <span className={badge("slate")}>
              {categories.filter((c) => c.isActive).length} ativas
            </span>
          </div>

          {categoryError && <p className="text-[12px] text-amber-200">{categoryError}</p>}
          {!categoryError && categoryMessage && (
            <p className="text-[12px] text-emerald-200">{categoryMessage}</p>
          )}

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-lg font-semibold">Sem categorias.</p>
              <p className="text-sm text-white/70">Cria categorias base.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Categorias base</p>
                    <p className="text-sm text-white/70">{MAIN_CATEGORY_LIMIT} obrigatórias, sempre ativas.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={badge("slate")}>{baseCategories.length} obrigatórias</span>
                    {extraCategoriesCount > 0 && (
                      <span className={badge("amber")}>+{extraCategoriesCount} personalizadas</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {baseCategoryGroups.length === 0 && (
                    <p className="text-[12px] text-white/60">Sem categorias base ativas.</p>
                  )}
                  {baseCategoryGroups.map((group) => (
                    <div
                      key={`padel-cat-group-${group.key}`}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{group.label}</p>
                        <span className="text-[10px] text-white/45">{group.items.length}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.items.map((cat) => (
                          <span
                            key={`padel-cat-chip-${cat.id}`}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-white/80"
                          >
                            {cat.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {customCategories.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Personalizadas</p>
                        <p className="text-[12px] text-white/60">Extras opcionais para o teu clube.</p>
                      </div>
                      <span className={badge("amber")}>{customCategories.length} extras</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customCategories.map((cat) => (
                        <span
                          key={`padel-cat-custom-${cat.id}`}
                          className={`rounded-full border px-3 py-1 text-[12px] ${
                            cat.isActive
                              ? "border-amber-300/40 bg-amber-400/10 text-amber-50"
                              : "border-white/15 bg-white/5 text-white/60"
                          }`}
                        >
                          {cat.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCategoryEditor((prev) => !prev)}
                        className="rounded-full border border-white/25 px-3 py-1.5 text-[12px] text-white hover:border-white/40"
                      >
                        {showCategoryEditor ? "Fechar edição" : "Gerir personalizadas"}
                      </button>
                      <span className="text-[11px] text-white/55">Edita detalhes abaixo.</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-[11px] text-white/55">
                    Cria categorias extra abaixo (opcionais).
                  </p>
                )}
              </div>

              {showCategoryEditor && customCategories.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {customCategories.map((cat) => {
                    const draft = categoryDrafts[cat.id];
                    if (!draft) return null;
                    return (
                      <div
                        key={`padel-cat-${cat.id}`}
                        className={`rounded-2xl border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)] ${
                          draft.isActive
                            ? "border-emerald-400/30 bg-emerald-500/5"
                            : "border-red-500/40 bg-red-500/8"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Categoria</p>
                            <input
                              value={draft.label}
                              onChange={(e) => updateCategoryDraft(cat.id, { label: e.target.value })}
                              className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                              placeholder="Ex: M3, F2, Mista Open"
                            />
                          </div>
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] ${
                              draft.isActive
                                ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-100"
                                : "border-red-300/60 bg-red-500/15 text-red-100"
                            }`}
                          >
                            {draft.isActive ? "Ativa" : "Inativa"}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="text-[11px] text-white/60">
                            Género
                            <select
                              value={draft.genderRestriction}
                              onChange={(e) => updateCategoryDraft(cat.id, { genderRestriction: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                            >
                              {CATEGORY_GENDER_OPTIONS.map((opt) => (
                                <option key={`gender-${cat.id}-${opt.value}`} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[11px] text-white/60">
                            Época
                            <input
                              value={draft.season}
                              onChange={(e) => updateCategoryDraft(cat.id, { season: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                              placeholder="2024/25"
                            />
                          </label>
                          <label className="text-[11px] text-white/60">
                            Nível min
                            <input
                              value={draft.minLevel}
                              onChange={(e) => updateCategoryDraft(cat.id, { minLevel: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                              placeholder="1"
                            />
                          </label>
                          <label className="text-[11px] text-white/60">
                            Nível max
                            <input
                              value={draft.maxLevel}
                              onChange={(e) => updateCategoryDraft(cat.id, { maxLevel: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                              placeholder="6"
                            />
                          </label>
                          <label className="text-[11px] text-white/60">
                            Ano
                            <input
                              value={draft.year}
                              onChange={(e) => updateCategoryDraft(cat.id, { year: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                              placeholder="2025"
                            />
                          </label>
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() => updateCategoryDraft(cat.id, { isActive: true })}
                              className={`rounded-full px-3 py-1 text-[11px] ${
                                draft.isActive
                                  ? "border border-emerald-300/70 bg-emerald-500/15 text-emerald-100"
                                  : "border border-white/20 text-white/70 hover:border-white/40"
                              }`}
                            >
                              Ativa
                            </button>
                            <button
                              type="button"
                              onClick={() => updateCategoryDraft(cat.id, { isActive: false })}
                              className={`rounded-full px-3 py-1 text-[11px] ${
                                !draft.isActive
                                  ? "border border-red-300/70 bg-red-500/15 text-red-100"
                                  : "border border-white/20 text-white/70 hover:border-white/40"
                              }`}
                            >
                              Inativa
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveCategory(cat.id)}
                            disabled={categorySavingId === cat.id || categoryDeletingId === cat.id}
                            className={CTA_PAD_PRIMARY_SM}
                          >
                            {categorySavingId === cat.id ? "A guardar…" : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCategoryDialog(cat)}
                            disabled={categorySavingId === cat.id || categoryDeletingId === cat.id}
                            className="rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-[11px] text-red-100 hover:border-red-300/60 disabled:opacity-60"
                          >
                            {categoryDeletingId === cat.id ? "A apagar…" : "Apagar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div>
              <p className="text-sm font-semibold text-white">Criação rápida</p>
              <p className="text-[11px] text-white/60">Escolhe género e nível; criamos automaticamente.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-white/60">
                Género
                <select
                  value={categoryQuickGender}
                  onChange={(e) => setCategoryQuickGender(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                >
                  {CATEGORY_GENDER_OPTIONS.filter((opt) => opt.value).map((opt) => (
                    <option key={`quick-gender-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-white/60">
                Nível
                <select
                  value={categoryQuickLevel}
                  onChange={(e) => setCategoryQuickLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white"
                >
                  {CATEGORY_LEVEL_OPTIONS.map((level) => (
                    <option key={`quick-level-${level}`} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                {getQuickCategoryLabel(categoryQuickGender, categoryQuickLevel)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createQuickCategory}
                disabled={categoryCreating}
                className={CTA_PAD_PRIMARY_SM}
              >
                {categoryCreating ? "A criar…" : "Criar rápida"}
              </button>
              <span className="text-[11px] text-white/55">Depois podes ajustar detalhes.</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div>
              <p className="text-sm font-semibold text-white">Nova categoria</p>
              <p className="text-[11px] text-white/60">Cria o nível em falta.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={categoryForm.label}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, label: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Nome da categoria"
              />
              <select
                value={categoryForm.genderRestriction}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, genderRestriction: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                {CATEGORY_GENDER_OPTIONS.map((opt) => (
                  <option key={`new-gender-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                value={categoryForm.minLevel}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, minLevel: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Nível min"
              />
              <input
                value={categoryForm.maxLevel}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, maxLevel: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Nível max"
              />
              <input
                value={categoryForm.season}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, season: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Época"
              />
              <input
                value={categoryForm.year}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, year: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Ano"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createCategory}
                disabled={categoryCreating}
                className={CTA_PAD_PRIMARY_SM}
              >
                {categoryCreating ? "A criar…" : "Criar categoria"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCategoryForm({
                    label: "",
                    genderRestriction: "",
                    minLevel: "",
                    maxLevel: "",
                    season: "",
                    year: "",
                    isActive: true,
                  })
                }
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/80 hover:border-white/35"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {!switchingTab && activeTab === "players" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Jogadores</p>
              <p className="text-sm text-white/70">Roster automático. Sem manual.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar por nome ou email"
                className="w-56 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              />
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as "ALL" | "MALE" | "FEMALE" | "UNKNOWN")}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/80"
              >
                <option value="ALL">Género</option>
                <option value="MALE">Masculino</option>
                <option value="FEMALE">Feminino</option>
                <option value="UNKNOWN">Sem género</option>
              </select>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/80"
              >
                <option value="ALL">Nível</option>
                <option value="UNKNOWN">Sem nível</option>
                {levelOptions.map((level) => (
                  <option key={`level-${level}`} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as "ALL" | "WITH" | "NONE")}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/80"
              >
                <option value="ALL">Histórico</option>
                <option value="WITH">Com histórico</option>
                <option value="NONE">Sem histórico</option>
              </select>
              <select
                value={noShowFilter}
                onChange={(e) => setNoShowFilter(e.target.value as "ALL" | "WITH" | "NONE")}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-[12px] text-white/80"
              >
                <option value="ALL">No-shows</option>
                <option value="WITH">Com no-show</option>
                <option value="NONE">Sem no-show</option>
              </select>
            </div>
          </div>
          <div className="overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-[12px] uppercase tracking-[0.12em] text-white/60">
                <tr>
                  <th className="px-3 py-2">Jogador</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">CRM</th>
                  <th className="px-3 py-2">Torneios</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-[13px] text-white/60" colSpan={5}>
                      Sem jogadores. A lista aparece com inscrições.
                    </td>
                  </tr>
                )}
                {filteredPlayers.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="px-3 py-2 font-semibold text-white">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={p.profile?.avatarUrl}
                          name={p.fullName}
                          className="h-8 w-8 rounded-full border border-white/10"
                          textClassName="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80"
                        />
                      <div>
                        <div>{p.fullName}</div>
                        <p className="text-[11px] text-white/60">
                          {[
                            p.profile?.username ? `@${p.profile.username}` : null,
                            p.gender === "MALE" ? "Masculino" : p.gender === "FEMALE" ? "Feminino" : "Sem género",
                            p.level || "Sem nível",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{p.email || "—"}</td>
                    <td className="px-3 py-2">{p.phone || "—"}</td>
                    <td className="px-3 py-2">
                      {p.crm ? (
                        <div className="space-y-1">
                          <Link
                            href={organizationId ? buildOrgHref(organizationId, `/crm/customers/${p.crm.id}`) : buildOrgHubHref("/organizations")}
                            className="text-[12px] text-white underline"
                          >
                            Abrir CRM
                          </Link>
                          <div className="flex flex-wrap gap-1">
                            {(p.crm.tags || []).slice(0, 3).map((tag) => (
                              <span key={`${p.crm?.id}-${tag}`} className={badge("slate")}>
                                {tag}
                              </span>
                            ))}
                            {(p.crm.tags || []).length > 3 && (
                              <span className={badge("slate")}>+{(p.crm.tags || []).length - 3}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-white/60">
                            {formatCurrency(p.crm.totalSpentCents ?? 0, "EUR")} gasto
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/50">Sem CRM</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={badge("slate")}>{resolveHistoryCount(p)} torneios</span>
                        <span className={badge((p.noShowCount ?? 0) > 0 ? "amber" : "slate")}>
                          {p.noShowCount ?? 0} no-shows
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!switchingTab && activeTab === "manage" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Equipas & Interclubes</p>
              <p className="text-sm text-white/70">Cria equipas por clube e categoria para ligas interclubes.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div>
              <p className="text-sm font-semibold text-white">Registar equipa no torneio</p>
              <p className="text-[11px] text-white/60">Liga interclubes: associa equipa a um torneio.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={entryTeamId}
                onChange={(e) => setEntryTeamId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Equipa</option>
                {teams.map((team) => (
                  <option key={`entry-team-${team.id}`} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select
                value={entryEventId}
                onChange={(e) => setEntryEventId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Torneio</option>
                {interclubEvents.map((event) => (
                  <option key={`entry-event-${event.id}`} value={event.id}>
                    {event.title}
                    {event.startsAt ? ` · ${formatShortDate(event.startsAt)}` : ""}
                  </option>
                ))}
              </select>
              <select
                value={entryCategoryId}
                onChange={(e) => setEntryCategoryId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                disabled={!entryEventId}
              >
                <option value="">Categoria (opcional)</option>
                {entryCategories
                  .filter((link) => Number.isFinite(link.padelCategoryId ?? NaN))
                  .map((link) => (
                    <option key={`entry-cat-${link.id}`} value={link.padelCategoryId ?? undefined}>
                      {link.category?.label ?? `Categoria ${link.padelCategoryId}`}
                    </option>
                  ))}
              </select>
            </div>
            {interclubEvents.length === 0 && (
              <p className="text-[11px] text-white/60">
                Não há torneios interclubes. Ativa o modo interclubes no wizard do torneio.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRegisterTeam}
                disabled={entryCreating}
                className={CTA_PAD_PRIMARY_SM}
              >
                {entryCreating ? "A registar…" : "Registar equipa"}
              </button>
              {entryMessage && <span className="text-[12px] text-emerald-200">{entryMessage}</span>}
              {entryError && <span className="text-[12px] text-rose-200">{entryError}</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div>
              <p className="text-sm font-semibold text-white">Nova equipa</p>
              <p className="text-[11px] text-white/60">Associa a um clube ou categoria.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Nome da equipa"
              />
              <input
                value={teamLevel}
                onChange={(e) => setTeamLevel(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Nível (opcional)"
              />
              <select
                value={teamClubId}
                onChange={(e) => setTeamClubId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Clube (opcional)</option>
                {clubs.map((club) => (
                  <option key={`team-club-${club.id}`} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
              <select
                value={teamCategoryId}
                onChange={(e) => setTeamCategoryId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Categoria (opcional)</option>
                {categories.map((cat) => (
                  <option key={`team-cat-${cat.id}`} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateTeam}
                disabled={teamCreating}
                className={CTA_PAD_PRIMARY_SM}
              >
                {teamCreating ? "A criar…" : "Criar equipa"}
              </button>
              {teamMessage && <span className="text-[12px] text-emerald-200">{teamMessage}</span>}
              {teamError && <span className="text-[12px] text-rose-200">{teamError}</span>}
            </div>
          </div>

          {teams.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-lg font-semibold">Sem equipas.</p>
              <p className="text-sm text-white/70">Cria a primeira equipa para começar a liga.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{team.name}</p>
                      <p className="text-[11px] text-white/60">
                        {[team.level || null, team.club?.name || null, team.category?.label || null]
                          .filter(Boolean)
                          .join(" · ") || "Sem detalhes"}
                      </p>
                    </div>
                    <span className={badge(team.isActive ? "green" : "amber")}>
                      {team.isActive ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
                    <span className={badge("slate")}>{team.membersCount ?? 0} membros</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!switchingTab && activeTab === "community" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Comunidade</p>
              <p className="text-sm text-white/70">Feed do clube: anúncios, desafios e atualizações.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
              <input
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Título (opcional)"
              />
              <select
                value={postClubId}
                onChange={(e) => setPostClubId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Todos os clubes</option>
                {clubs.map((club) => (
                  <option key={`post-club-${club.id}`} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
              placeholder="Escreve o anúncio ou desafio..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateCommunityPost}
                disabled={postCreating}
                className={CTA_PAD_PRIMARY_SM}
              >
                {postCreating ? "A publicar…" : "Publicar"}
              </button>
              {postMessage && <span className="text-[12px] text-emerald-200">{postMessage}</span>}
              {postError && <span className="text-[12px] text-rose-200">{postError}</span>}
            </div>
          </div>

          {communityPosts.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-lg font-semibold">Sem publicações.</p>
              <p className="text-sm text-white/70">Cria o primeiro anúncio para o clube.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {communityPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{post.title || "Atualização"}</p>
                      <p className="text-[11px] text-white/60">
                        {post.author?.fullName || post.author?.username || "Staff"} ·{" "}
                        {post.createdAt ? formatShortDate(post.createdAt) : "—"}
                      </p>
                    </div>
                    {post.isPinned && <span className={badge("amber")}>Fixado</span>}
                  </div>
                  <p className="mt-3 text-[13px] text-white/80 whitespace-pre-line">{post.body}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
                    <span className={badge("slate")}>{post.counts?.comments ?? 0} comentários</span>
                    <span className={badge("slate")}>{post.counts?.reactions ?? 0} reações</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!switchingTab && activeTab === "trainers" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Treinadores</p>
              <p className="text-sm text-white/70">Perfis aprovados e equipa técnica associada aos torneios.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={organizationId ? buildOrgHref(organizationId, "/team", { staff: "convidados" }) : buildOrgHubHref("/organizations")}
                className="rounded-full border border-white/25 px-4 py-2 text-[12px] font-semibold text-white hover:border-white/40"
              >
                Equipa
              </Link>
              <Link
                href={organizationId ? buildOrgHref(organizationId, "/team/trainers") : buildOrgHubHref("/organizations")}
                className="rounded-full border border-white/15 px-4 py-2 text-[12px] font-semibold text-white/80 hover:border-white/35"
              >
                Perfil treinador
              </Link>
            </div>
          </div>

          {trainersLoading && <p className="text-[12px] text-white/60">A carregar treinadores…</p>}

          {trainerErrorLabel && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-100">
              {trainerErrorLabel}
            </div>
          )}

          {!trainersLoading && !trainerErrorLabel && trainers.length === 0 && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-lg font-semibold">Sem treinadores.</p>
              <p className="text-sm text-white/70">Cria o primeiro perfil para publicar.</p>
            </div>
          )}

          {!trainerErrorLabel && trainers.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {trainers.map((trainer) => {
                const busy = trainerActionLoading === trainer.userId;
                const isPending = trainer.reviewStatus === "PENDING";
                const isApproved = trainer.reviewStatus === "APPROVED";
                const canPublish = isApproved && !trainer.isPublished;
                const canHide = isApproved && trainer.isPublished;
                const canApprove = trainer.reviewStatus !== "APPROVED";
                const showReject = isPending;
                return (
                  <div
                    key={trainer.userId}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={trainer.avatarUrl}
                          name={trainer.fullName || trainer.username || "Treinador"}
                          className="h-10 w-10 rounded-full border border-white/10"
                          textClassName="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {trainer.fullName || trainer.username || "Treinador"}
                          </p>
                          {trainer.username && (
                            <p className="text-[11px] text-white/60">@{trainer.username}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                            TRAINER_STATUS_TONE[trainer.reviewStatus]
                          }`}
                        >
                          {TRAINER_STATUS_LABEL[trainer.reviewStatus]}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                            trainer.isPublished
                              ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                              : "border-white/15 bg-white/5 text-white/60"
                          }`}
                        >
                          {trainer.isPublished ? "Publicado" : "Oculto"}
                        </span>
                      </div>
                    </div>

                    {trainer.reviewNote && trainer.reviewStatus === "REJECTED" && (
                      <p className="mt-2 text-[11px] text-rose-200">Motivo: {trainer.reviewNote}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {canApprove && (
                        <button
                          type="button"
                          onClick={() => handleTrainerAction(trainer, "APPROVE")}
                          disabled={busy}
                          className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-100 hover:border-emerald-200/70 disabled:opacity-60"
                        >
                          Aprovar
                        </button>
                      )}
                      {showReject && (
                        <button
                          type="button"
                          onClick={() => {
                            const note = window.prompt("Motivo (opcional)") ?? null;
                            if (note === null) return;
                            handleTrainerAction(trainer, "REJECT", note.trim() || undefined);
                          }}
                          disabled={busy}
                          className="rounded-full border border-rose-300/50 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
                        >
                          Recusar
                        </button>
                      )}
                      {canPublish && (
                        <button
                          type="button"
                          onClick={() => handleTrainerAction(trainer, "PUBLISH")}
                          disabled={busy}
                          className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] text-white/80 hover:border-white/40 disabled:opacity-60"
                        >
                          Publicar
                        </button>
                      )}
                      {canHide && (
                        <button
                          type="button"
                          onClick={() => handleTrainerAction(trainer, "HIDE")}
                          disabled={busy}
                          className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/70 hover:border-white/35 disabled:opacity-60"
                        >
                          Ocultar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!trainerErrorLabel && (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <div>
                <p className="text-sm font-semibold text-white">Adicionar treinador</p>
                <p className="text-[11px] text-white/60">Cria o perfil via username e publica quando estiver pronto.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={newTrainerUsername}
                  onChange={(e) => setNewTrainerUsername(e.target.value)}
                  placeholder="@username"
                  className="min-w-[220px] flex-1 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                />
                <button
                  type="button"
                  onClick={handleCreateTrainerProfile}
                  disabled={creatingTrainer}
                  className={CTA_PAD_PRIMARY_SM}
                >
                  {creatingTrainer ? "A criar…" : "Criar perfil"}
                </button>
              </div>
              {(trainerError || trainerMessage) && (
                <p className={`text-[12px] ${trainerError ? "text-rose-200" : "text-emerald-200"}`}>
                  {trainerError || trainerMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!switchingTab && activeTab === "lessons" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-sm text-white/75 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Aulas</p>
              <p className="text-sm text-white/70">Catálogo, instrutores e marcações de treino.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPadelSection("trainers")}
                className="rounded-full border border-white/25 px-4 py-2 text-[12px] font-semibold text-white hover:border-white/40"
              >
                Ver treinadores
              </button>
              <Link
                href={organizationId ? buildOrgHref(organizationId, "/bookings") : buildOrgHubHref("/organizations")}
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] font-semibold text-white/80 hover:border-white/35"
              >
                Agenda avançada
              </Link>
              <Link
                href={organizationId ? buildOrgHref(organizationId, "/bookings/services") : buildOrgHubHref("/organizations")}
                className="rounded-full border border-white/15 px-4 py-2 text-[12px] font-semibold text-white/70 hover:border-white/30"
              >
                Catálogo completo
              </Link>
            </div>
          </div>

          {servicesLoading && <p className="text-[12px] text-white/60">A carregar aulas…</p>}

          {lessonsErrorLabel && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-100">
              {lessonsErrorLabel}
            </div>
          )}

          {!servicesLoading && !lessonsErrorLabel && lessonServices.length === 0 && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-lg font-semibold">Sem aulas.</p>
              <p className="text-sm text-white/70">Cria o primeiro serviço de aula.</p>
            </div>
          )}

          {!lessonsErrorLabel && lessonServices.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lessonServices.map((service) => {
                const priceLabel = formatCurrency(service.unitPriceCents ?? 0, service.currency ?? "EUR");
                return (
                  <Link
                    key={service.id}
                    href={organizationId ? buildOrgHref(organizationId, `/bookings/${service.id}`) : buildOrgHubHref("/organizations")}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)] transition hover:border-white/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{service.title || "Aula"}</p>
                        <p className="text-[12px] text-white/60">
                          {service.durationMinutes ?? 60} min · {priceLabel}
                        </p>
                        {service.instructor?.fullName && (
                          <p className="text-[11px] text-white/50">Instrutor: {service.instructor.fullName}</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                          service.isActive
                            ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                            : "border-white/15 bg-white/5 text-white/60"
                        }`}
                      >
                        {service.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
                      <span>{service._count?.bookings ?? 0} marcações</span>
                      <span>{service._count?.availabilities ?? 0} slots</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!lessonsErrorLabel && (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <div>
                <p className="text-sm font-semibold text-white">Nova aula</p>
                <p className="text-[11px] text-white/60">Cria uma aula rápida com preço e duração.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Nome da aula"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                />
                <select
                  value={lessonDuration}
                  onChange={(e) => setLessonDuration(e.target.value)}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                >
                  {LESSON_DURATION_OPTIONS.map((minutes) => (
                    <option key={`lesson-${minutes}`} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
                <input
                  value={lessonPrice}
                  onChange={(e) => setLessonPrice(e.target.value)}
                  placeholder="Preço"
                  inputMode="decimal"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateLesson}
                  disabled={lessonCreating}
                  className={CTA_PAD_PRIMARY_SM}
                >
                  {lessonCreating ? "A criar…" : "Criar aula"}
                </button>
                {(lessonError || lessonMessage) && (
                  <span className={`text-[12px] ${lessonError ? "text-rose-200" : "text-emerald-200"}`}>
                    {lessonError || lessonMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {organizationKind !== "CLUBE_PADEL" && (
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-[12px] text-white/70 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
          Sem clube próprio? Usa o modo organizador e gere clubes parceiros por torneio.
        </div>
      )}

      {clubModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c142b] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">
                  {clubForm.id
                    ? "Editar clube"
                    : isOwnClubForm
                      ? "Novo clube principal"
                      : "Novo clube parceiro"}
                </p>
                <h3 className="text-xl font-semibold text-white">
                  {isOwnClubForm ? "Clube principal" : "Clube parceiro"}
                </h3>
                <p className="text-[11px] text-white/60">
                  {isOwnClubForm
                    ? "Completa morada e campos para o wizard."
                    : "Regista so o necessario e afina depois."}
                </p>
                {isPartnerClubForm && clubForm.id && (
                  <p className="text-[11px] text-amber-200">Clube parceiro é sincronizado e não permite alterações base.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setClubModalOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white hover:border-white/35"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {!clubForm.id && (
                <div className="rounded-xl border border-white/12 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Tipo de clube</p>
                  <div className="mt-2 inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                    {[
                      { key: "OWN" as ClubKind, label: "Clube principal" },
                      { key: "PARTNER" as ClubKind, label: "Clube parceiro" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setClubForm((prev) => ({
                            ...prev,
                            kind: opt.key,
                            addressId: "",
                            locationProviderId: "",
                            locationFormattedAddress: "",
                            latitude: null,
                            longitude: null,
                          }));
                        }}
                        className={`rounded-full px-3 py-1 transition ${
                          clubForm.kind === opt.key
                            ? "bg-white text-black font-semibold shadow"
                            : "text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                value={clubForm.name}
                onChange={(e) => setClubForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do clube"
                disabled={isPartnerClubForm && Boolean(clubForm.id)}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] disabled:opacity-60"
              />
              {shouldShowLocationBlock && (
                <div className="rounded-xl border border-white/12 bg-black/35 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Morada normalizada</p>
                    <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
                      Apple Maps
                    </span>
                  </div>
                  <div className="space-y-2">
                      <input
                        value={clubLocationQuery}
                        onChange={(e) => {
                          setClubLocationQuery(e.target.value);
                          setClubForm((prev) => ({
                            ...prev,
                            addressId: "",
                            locationProviderId: "",
                            locationFormattedAddress: "",
                            locationSourceProvider: null,
                            locationConfidenceScore: null,
                            locationValidationStatus: null,
                          }));
                        }}
                        placeholder="Pesquisar morada"
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      />
                      {clubLocationSearchError && (
                        <p className="text-[11px] text-rose-200">{clubLocationSearchError}</p>
                      )}
                      {clubLocationSearchLoading ? (
                        <p className="text-[11px] text-white/60">A procurar moradas...</p>
                      ) : clubLocationSuggestions.length === 0 ? (
                        <p className="text-[11px] text-white/60">Sugestões aparecem aqui.</p>
                      ) : (
                        <div className="max-h-40 space-y-2 overflow-auto">
                          {clubLocationSuggestions.map((item) => (
                            <button
                              key={item.providerId}
                              type="button"
                              onClick={() => handleSelectClubLocationSuggestion(item)}
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left text-[12px] text-white/80 hover:border-cyan-300/50"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-white">{item.label}</span>
                                <div className="flex items-center gap-2 text-[10px] text-white/60">
                                  <span>{item.city || "—"}</span>
                                  {item.sourceProvider === "APPLE_MAPS" && (
                                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]">
                                      Apple
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {clubLocationDetailsLoading && (
                        <p className="text-[11px] text-white/50">A validar morada...</p>
                      )}
                      {Boolean(clubForm.addressId) && clubForm.locationFormattedAddress && (
                        <div className="space-y-1 text-[11px] text-emerald-200">
                          <p>Morada confirmada: {clubForm.locationFormattedAddress}</p>
                          {(clubForm.locationSourceProvider ||
                            clubForm.locationConfidenceScore !== null ||
                            clubForm.locationValidationStatus) && (
                            <div className="flex flex-wrap gap-2 text-[10px] text-white/70">
                              {clubForm.locationSourceProvider && (
                                <span className="rounded-full border border-white/15 px-2 py-0.5">
                                  {clubForm.locationSourceProvider === "APPLE_MAPS"
                                    ? "Apple Maps"
                                    : clubForm.locationSourceProvider}
                                </span>
                              )}
                              {clubForm.locationConfidenceScore !== null && (
                                <span className="rounded-full border border-white/15 px-2 py-0.5">
                                  Confiança {Math.round(clubForm.locationConfidenceScore)}%
                                </span>
                              )}
                              {clubForm.locationValidationStatus && (
                                <span className="rounded-full border border-white/15 px-2 py-0.5">
                                  {clubForm.locationValidationStatus === "VERIFIED"
                                    ? "Verificada"
                                    : clubForm.locationValidationStatus === "NORMALIZED"
                                      ? "Normalizada"
                                      : clubForm.locationValidationStatus === "RAW"
                                        ? "Bruta"
                                        : clubForm.locationValidationStatus}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <input
                    value={clubForm.city}
                    readOnly
                    disabled
                    placeholder="Cidade (auto)"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-70"
                  />
                </div>
                <input
                  value={clubForm.address}
                  readOnly
                  disabled
                  placeholder="Morada (auto)"
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-70"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={clubForm.slug}
                  onChange={(e) => {
                    setSlugError(null);
                    setClubForm((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  placeholder="Slug / código curto (opcional)"
                  disabled={isPartnerClubForm && Boolean(clubForm.id)}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] disabled:opacity-60"
                />
                {slugError && <p className="mt-1 text-[12px] font-semibold text-red-300">{slugError}</p>}
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={clubForm.courtsCount}
                  onChange={(e) => setClubForm((p) => ({ ...p, courtsCount: e.target.value }))}
                  placeholder={isOwnClubForm ? "Nº de campos" : "Nº de campos (estimado)"}
                  disabled={isPartnerClubForm && Boolean(clubForm.id)}
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] disabled:opacity-60"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={clubForm.isActive}
                  onChange={(e) => setClubForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4"
                />
                {isOwnClubForm ? "Ativo (disponível no wizard)" : "Disponível para torneios"}
              </label>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                {clubError && <span className="text-red-300">{clubError}</span>}
                {clubMessage && <span>{clubMessage}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSubmitClub}
                  disabled={savingClub}
                  className={CTA_PAD_PRIMARY}
                >
                  {savingClub ? "A guardar…" : clubForm.id ? "Guardar alterações" : "Criar clube"}
                </button>
                <button
                  type="button"
                  onClick={() => setClubModalOpen(false)}
                  className="rounded-full border border-white/20 px-3 py-2 text-[12px] text-white hover:border-white/35"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        query={commandQuery}
        onQueryChange={setCommandQuery}
        inputRef={commandInputRef}
        placeholder="Pesquisar comando…"
      >
        {filteredCommands.length === 0 ? (
          <p className="text-[12px] text-white/60">Sem comandos disponíveis para este contexto.</p>
        ) : (
          filteredCommands.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                action.run();
                setShowCommandPalette(false);
              }}
              className="w-full rounded-xl border border-white/12 bg-black/35 px-3 py-3 text-left transition hover:border-white/30 hover:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{action.label}</p>
                  <p className="text-[11px] text-white/60">{action.description}</p>
                </div>
                {action.shortcut && (
                  <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[10px] text-white/70">
                    {action.shortcut}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </CommandPalette>

      <ContextDrawer
        open={showOpsDrawer}
        onClose={() => setShowOpsDrawer(false)}
        eyebrow="Operacional"
        title="Hoje"
      >
        <div className="space-y-3 text-white/80">
              <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Torneio ativo</p>
                <p className="text-sm font-semibold text-white">{selectedEvent?.title || "Seleciona um torneio"}</p>
                <p className="text-[11px] text-white/60">Atualizado às {opsUpdatedLabel}</p>
              </div>
              {eventId && opsSummary && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {opsCounters.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-white/12 bg-black/40 px-3 py-3"
                    >
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{item.label}</p>
                      <p className="text-xl font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {eventId && !opsSummary && (
                <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-[12px] text-white/70">
                  A carregar métricas operacionais…
                </div>
              )}
              {eventId && (
                <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Alertas</p>
                  {opsAlerts.length === 0 && (
                    <p className="text-[12px] text-emerald-200/80">Sem alertas críticos agora.</p>
                  )}
                  {opsAlerts.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {opsAlerts.map((alert) => (
                        <div key={alert.key} className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
                          {alert.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!eventId && (
                <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-[12px] text-white/70">
                  Abre um torneio para ver métricas operacionais e alertas.
                </div>
              )}
              {eventId && (
                <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Atalhos</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPadelSection("tournaments")}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                    >
                      Torneios
                    </button>
                    <button
                      type="button"
                      onClick={() => setPadelSection("calendar")}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                    >
                      Calendário
                    </button>
                    <button
                      type="button"
                      onClick={() => setPadelSection("manage")}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                    >
                      Gestão
                    </button>
                    {selectedEvent?.slug && (
                      <button
                        type="button"
                        onClick={() => window.open(`/eventos/${selectedEvent.slug}/monitor`, "_blank")}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                      >
                        Monitor TV
                      </button>
                    )}
                    {eventId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!organizationId) return;
                          window.open(buildOrgHref(organizationId, `/padel/tournaments/${eventId}/live`), "_blank");
                        }}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                      >
                        LiveHub
                      </button>
                    )}
                  </div>
                </div>
              )}
        </div>
      </ContextDrawer>

      {clubDialog && (
        <ConfirmDestructiveActionDialog
          open
          title={clubDialog.nextActive ? "Reativar clube?" : "Arquivar clube?"}
          description={
            clubDialog.nextActive
              ? "O clube volta a aparecer no wizard e sugestões."
              : "O clube ficará inativo e deixa de aparecer nas sugestões do wizard."
          }
          consequences={
            clubDialog.nextActive
              ? ["Campos ativos continuam disponíveis."]
              : ["Não aparecerá ao criar torneios.", "Podes reativar mais tarde."]
          }
          confirmLabel={clubDialog.nextActive ? "Reativar" : "Arquivar"}
          dangerLevel="medium"
          onClose={() => setClubDialog(null)}
          onConfirm={() => handleToggleClubActive(clubDialog.club, clubDialog.nextActive)}
        />
      )}

      {deleteClubDialog && (
        <ConfirmDestructiveActionDialog
          open
          title="Apagar clube?"
          description="Remove definitivamente este clube e os campos associados. Não aparecerá mais no hub ou no wizard."
          consequences={["Ação permanente.", "Campos e staff associados deixam de estar disponíveis."]}
          confirmLabel="Apagar"
          dangerLevel="high"
          onClose={() => setDeleteClubDialog(null)}
          onConfirm={() => handleDeleteClub(deleteClubDialog)}
        />
      )}

      {courtDialog && (
        <ConfirmDestructiveActionDialog
          open
          title={courtDialog.nextActive ? "Reativar campo?" : "Desativar campo?"}
          description={
            courtDialog.nextActive
              ? "O campo volta a ser sugerido no wizard."
              : "O campo fica inativo e deixa de ser sugerido."
          }
          consequences={
            courtDialog.nextActive
              ? ["Mantém a ordem e atributos."]
              : ["Sai das sugestões do wizard.", "Podes reativar mais tarde."]
          }
          confirmLabel={courtDialog.nextActive ? "Reativar" : "Desativar"}
          dangerLevel="medium"
          onClose={() => setCourtDialog(null)}
          onConfirm={handleConfirmCourtToggle}
        />
      )}

      {deleteCourtDialog && (
        <ConfirmDestructiveActionDialog
          open
          title="Apagar campo?"
          description="Remove definitivamente este campo. Não aparecerá mais no hub ou no wizard."
          consequences={["Ação permanente.", "Podes criar outro mais tarde."]}
          confirmLabel="Apagar"
          dangerLevel="high"
          onClose={() => setDeleteCourtDialog(null)}
          onConfirm={() => handleDeleteCourt(deleteCourtDialog)}
        />
      )}

      {deleteCategoryDialog && (
        <ConfirmDestructiveActionDialog
          open
          title="Apagar categoria?"
          description="Remove definitivamente esta categoria personalizada."
          consequences={[
            "Ação permanente.",
            "Se estiver em uso, remove-a dos torneios ou desativa antes de apagar.",
          ]}
          confirmLabel="Apagar"
          dangerLevel="high"
          onClose={() => setDeleteCategoryDialog(null)}
          onConfirm={() => handleDeleteCategory(deleteCategoryDialog)}
        />
      )}
    </div>
  );
}
