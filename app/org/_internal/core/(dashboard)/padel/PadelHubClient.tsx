"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { trackEvent } from "@/lib/analytics";
import { formatCurrency } from "@/lib/i18n";
import { AddressCombobox } from "@/components/ui/address-combobox";
import type { GeoDetailsItem } from "@/lib/geo/types";
import { Avatar } from "@/components/ui/avatar";
import { CommandPalette } from "@/components/ui/command-palette";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { OryaDateTimeField } from "@/components/ui/datetime/OryaDateTimeField";
import { useToast } from "@/components/ui/toast-provider";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/org/_internal/core/dashboardUi";
import {
  buildPadelCategoryKey,
  buildPadelDefaultCategories,
  isReservedPadelMandatoryLabel,
  sortPadelCategories,
} from "@/domain/padelDefaultCategories";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";
import { lockBodyScroll } from "@/lib/dom/bodyScrollLock";
import { getRolePackLabel, parseOrganizationRolePack } from "@/lib/organizationRolePackPolicy";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import { PADEL_FORMAT_LABELS_PT } from "@/domain/padel/formatPresentation";
import PartnershipsPageClient from "./parcerias/PartnershipsPageClient";
import { ClubsManagementPanel } from "./clubs-v2/ClubsManagementPanel";
import { CalendarControls } from "./calendar-v2/CalendarControls";
import { CalendarExportPanel } from "./calendar-v2/CalendarExportPanel";
import { CalendarMatrixPanel } from "./calendar-v2/CalendarMatrixPanel";
import { CalendarManualAdjustmentsPanel } from "./calendar-v2/CalendarManualAdjustmentsPanel";
import { CalendarMatchAdjustmentsPanel } from "./calendar-v2/CalendarMatchAdjustmentsPanel";

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
  userId: string;
  user?: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null } | null;
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
  ranking?: {
    rating: number | null;
    orgPosition: number | null;
    matchesPlayed: number;
    leaderboardEligible: boolean;
    blockedNewMatches: boolean;
    lastMatchAt: string | Date | null;
    lastRebuildAt: string | Date | null;
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

type OrganizationStaffMember = {
  userId: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  rolePack?: string | null;
};

type OrganizationStaffResponse = {
  ok: boolean;
  items: OrganizationStaffMember[];
  viewerRole?: string | null;
  organizationId?: number | null;
};

type CoachItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role?: string | null;
  rolePack?: string | null;
  professionalId?: number | null;
  professionalIsActive?: boolean | null;
};

type CoachesResponse = {
  ok: boolean;
  items: CoachItem[];
  error?: string;
};

function formatRolePackLabel(rolePack?: string | null) {
  const parsedRolePack = parseOrganizationRolePack(rolePack);
  if (!parsedRolePack) return rolePack?.trim() || null;
  return getRolePackLabel(parsedRolePack);
}

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
  format?: string | null;
  capacityTeams?: number | null;
  activeTeams?: number | null;
  completeTeams?: number | null;
  confirmedTeams?: number | null;
  pendingTeams?: number | null;
  isEnabled?: boolean;
  category?: { id: number; label: string } | null;
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
    inProgressMatchesCount: number;
    delayedMatchesCount: number;
    refundPendingCount: number;
    invalidStateCount?: number;
    updatedAt: string;
  };
};

type TournamentBlockOverrideItem = {
  auditId: string;
  overrideId: string;
  eventId: number;
  operationId: string | null;
  softBlockId: number | null;
  conflictPolicy: string | null;
  reasonCode: string | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string | null;
};

type TournamentBlockOverridesResponse = {
  ok: boolean;
  data?: {
    items: TournamentBlockOverrideItem[];
    nextCursor: string | null;
  };
};

type PadelRoundsAdvanceResponse = {
  ok: boolean;
  generated?: number;
  scheduled?: number;
  unscheduledByReason?: Record<string, number>;
  roundState?: {
    format?: string | null;
    categoryId?: number | null;
    dryRun?: boolean;
    updatedAt?: string | null;
  } | null;
  error?: string;
};

type PadelFormatPlanCategoryResult = {
  key: string;
  categoryId: number | null;
  label: string;
  format: string;
  teams: number;
  minTeams: number;
  matchesNeeded: number;
  allocatedSlots: number;
  recommendedMaxTeams: number;
  hardCapMax: number | null;
  queueEstimatedRounds: number | null;
  feasible: boolean;
  warnings?: string[];
};

type PadelFormatPlanCategoryPayload = {
  categoryId: number;
  label: string;
  teams: number;
  format: string;
  amMxMode: "INDIVIDUAL_ROTATION" | "FIXED_PAIR" | undefined;
  amMxProgressionMode: "ROUND_BY_ROUND" | undefined;
  nonStopMode: "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST" | undefined;
  nonStopRounds: number | undefined;
};

type PadelFormatPlanResult = {
  feasible: boolean;
  totalSlots: number;
  matchesNeeded: number;
  unscheduledMatches: number;
  courtsUsed: number;
  warnings: string[];
  blockingReasons: string[];
  alternatives: Array<{ type: string; summary: string }>;
  categories: PadelFormatPlanCategoryResult[];
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

type CalendarCourt = {
  id: number;
  name: string;
  padelClubId?: number | null;
  isActive?: boolean;
  displayOrder?: number | null;
  club?: { name?: string | null } | null;
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

type CalendarClassSession = {
  id: number;
  courtId?: number | null;
  startsAt: string | Date;
  endsAt: string | Date;
  status?: string | null;
  updatedAt?: string | Date | null;
};

type CalendarBooking = {
  id: number;
  courtId?: number | null;
  startsAt: string | Date;
  endsAt: string | Date;
  status?: string | null;
  updatedAt?: string | Date | null;
};

type CalendarOccupancyItem = {
  type: "HARD_BLOCK" | "CLASS_SESSION" | "MATCH" | "BOOKING" | "SOFT_BLOCK";
  sourceId: string;
  courtId?: number | null;
  startsAt: string | Date;
  endsAt: string | Date;
  priority: number;
  isBlocking: boolean;
  label?: string | null;
};

type CalendarOccupancyLegendItem = {
  type: "HARD_BLOCK" | "CLASS_SESSION" | "MATCH" | "BOOKING" | "SOFT_BLOCK";
  priority: number;
  isBlocking: boolean;
  label: string;
  description?: string | null;
};

type CalendarMatch = {
  id: number;
  categoryId?: number | null;
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
  type:
    | "block_block"
    | "block_match"
    | "class_match"
    | "booking_match"
    | "availability_match"
    | "player_match"
    | "outside_event_window";
  aId: number;
  bId: number;
  summary: string;
};

type CalendarResponse = {
  ok: boolean;
  courts?: CalendarCourt[];
  blocks: CalendarBlock[];
  classSessions?: CalendarClassSession[];
  bookings?: CalendarBooking[];
  softBlocks?: Array<{
    id: number;
    scopeType: string;
    scopeId?: number | null;
    startsAt: string | Date;
    endsAt: string | Date;
    updatedAt?: string | Date | null;
  }>;
  occupancyItems?: CalendarOccupancyItem[];
  occupancyLegend?: CalendarOccupancyLegendItem[];
  arbitrationPolicy?: {
    algorithm?: string | null;
    priorityRuleVersion?: string | null;
    priorityOrder?: Array<"HARD_BLOCK" | "CLASS_SESSION" | "MATCH" | "BOOKING" | "SOFT_BLOCK">;
    tieBreak?: string | null;
    note?: string | null;
  } | null;
  availabilities: CalendarAvailability[];
  matches: CalendarMatch[];
  conflicts: CalendarConflict[];
  eventStartsAt?: string | Date | null;
  eventEndsAt?: string | Date | null;
  eventTimezone?: string | null;
  bufferMinutes?: number | null;
};

type AutoScheduleRunCategorySummary = {
  categoryId: number | null;
  scheduledCount: number;
  skippedCount: number;
  unscheduledByReason?: Record<string, number>;
};

type AutoScheduleRunData = {
  id: string;
  status: string;
  scheduledCount: number;
  skippedCount: number;
  applied?: boolean;
  queued?: boolean;
  errorCode?: string | null;
  byCategory?: AutoScheduleRunCategorySummary[] | null;
};

type AutoScheduleRunResponse = {
  ok?: boolean;
  run?: AutoScheduleRunData;
  error?: string;
};

type LiveOpsMatchItem = {
  id: number;
  categoryId?: number | null;
  status?: string | null;
  startTime?: string | Date | null;
  plannedStartAt?: string | Date | null;
  elapsedSeconds?: number | null;
  isLiveClockRunning?: boolean;
  stream?: {
    isLive?: boolean;
    url?: string | null;
    provider?: string | null;
    label?: string | null;
  } | null;
  roundLabel?: string | null;
  groupLabel?: string | null;
  score?: Record<string, unknown> | null;
  pairingA?: {
    slots?: Array<{
      playerProfile?: {
        displayName?: string | null;
        fullName?: string | null;
      } | null;
    } | null> | null;
  } | null;
  pairingB?: {
    slots?: Array<{
      playerProfile?: {
        displayName?: string | null;
        fullName?: string | null;
      } | null;
    } | null> | null;
  } | null;
};

type LiveIncidentStatusFilter =
  | "ALL"
  | "RESULT_SUBMITTED"
  | "PENDING_CONFIRMATION"
  | "PENDING_REVIEW_EXPIRED"
  | "DISPUTED"
  | "IN_PROGRESS";

type LiveIncidentAction = "confirm" | "reject" | "reset_to_submitted" | "resolve_dispute";
type LiveIncidentDisputeResolution = "CONFIRMED" | "CORRECTED" | "VOIDED";

type LiveIncidentItem = {
  matchId: number;
  status: string;
  categoryId: number | null;
  categoryLabel: string;
  formatKey: string | null;
  formatLabel: string;
  pairingLabel: string;
  phaseLabel: string;
  startAt: string | Date | null;
  startMs: number;
  priority: number;
  pendingConfirmationExpiresAt: string | null;
  pendingConfirmationRemainingMs: number | null;
  elapsedSeconds: number | null;
  streamIsLive: boolean;
  streamUrl: string | null;
};

const PADEL_TABS = [
  "tournaments",
  "calendar",
  "clubs",
  "partnerships",
  "categories",
  "teams",
  "players",
  "coaches",
  "lessons",
] as const;
type PadelTab = (typeof PADEL_TABS)[number];
type PadelToolMode = "CLUB" | "TOURNAMENTS";

const CLUB_TOOL_TABS: ReadonlyArray<PadelTab> = [
  "clubs",
  "partnerships",
  "players",
  "coaches",
  "lessons",
];
const TOURNAMENTS_TOOL_TABS: ReadonlyArray<PadelTab> = [
  "tournaments",
  "calendar",
  "categories",
  "teams",
  "players",
];
const TOOL_SECTION_BY_MODE: Record<PadelToolMode, "padel-club" | "padel-tournaments"> = {
  CLUB: "padel-club",
  TOURNAMENTS: "padel-tournaments",
};
const CTA_PAD_PRIMARY = `${CTA_PRIMARY} px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed`;
const CTA_PAD_PRIMARY_SM = `${CTA_PRIMARY} px-3 py-1.5 text-[12px] disabled:opacity-60 disabled:cursor-not-allowed`;
const CTA_PAD_SECONDARY_SM = `${CTA_SECONDARY} px-3 py-2 text-[12px]`;
const MAIN_CATEGORY_LIMIT = 18;
const OPERATION_MODE_STORAGE_KEY = "orya_padel_operation_mode";
const PADEL_FORMAT_LABELS: Record<string, string> = { ...PADEL_FORMAT_LABELS_PT };
const PADEL_FORMAT_KEYS = Object.keys(PADEL_FORMAT_LABELS);
const DEFAULT_PADEL_FORMAT_FALLBACK = "TODOS_CONTRA_TODOS" as const;
const AM_MX_FORMAT_SET = new Set(["AMERICANO", "MEXICANO"]);
const DEFAULT_NON_STOP_ROUNDS = 6;
const SHOW_CLUB_STAFF_PANEL = false;
const FORMATS_WITH_KNOCKOUT = new Set([
  "GRUPOS_ELIMINATORIAS",
  "QUADRO_ELIMINATORIO",
  "QUADRO_AB",
  "DUPLA_ELIMINACAO",
]);

const resolvePadelTabParam = (value: string | null, toolMode: PadelToolMode): PadelTab | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "manage") {
    return toolMode === "TOURNAMENTS" ? "categories" : null;
  }
  if (normalized === "courts") {
    return toolMode === "CLUB" ? "clubs" : null;
  }
  if (normalized === "partnerships") {
    return toolMode === "CLUB" ? "partnerships" : null;
  }
  if (normalized === "community") {
    return toolMode === "CLUB" ? "clubs" : null;
  }
  if (normalized === "create") {
    return toolMode === "TOURNAMENTS" ? "tournaments" : null;
  }
  if (!PADEL_TABS.includes(normalized as PadelTab)) return null;
  const resolved = normalized as PadelTab;
  if (toolMode === "TOURNAMENTS") {
    if (
      resolved === "clubs" ||
      resolved === "partnerships" ||
      resolved === "coaches" ||
      resolved === "lessons"
    ) {
      return null;
    }
    return resolved;
  }
  if (
    resolved === "tournaments" ||
    resolved === "calendar" ||
    resolved === "categories" ||
    resolved === "teams"
  ) {
    return null;
  }
  return resolved;
};

type Props = {
  organizationId: number;
  organizationKind: string | null;
  toolMode: PadelToolMode;
  canEditPadel: boolean;
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
const CATEGORY_LEVEL_OPTIONS = ["7", "8", "9", "10", "11", "12"];
const LESSON_DURATION_OPTIONS = [60, 90];
const LESSON_TAG = "AULAS";
const LESSON_DEFAULT_START_TIME = "10:00";
const LESSON_WEEKDAY_OPTIONS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];
const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  LOCKED: "Bloqueado",
  DATE_CHANGED: "Data alterada",
  FINISHED: "Concluído",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  ARCHIVED: "Arquivado",
};

const LIVE_INCIDENT_STATUS_OPTIONS: Array<{ value: LiveIncidentStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "RESULT_SUBMITTED", label: "Submetidos" },
  { value: "PENDING_CONFIRMATION", label: "Pend. confirmação" },
  { value: "PENDING_REVIEW_EXPIRED", label: "Pend. expirado" },
  { value: "DISPUTED", label: "Disputa" },
  { value: "IN_PROGRESS", label: "Em jogo" },
];

const LIVE_INCIDENT_STATUSES = new Set([
  "RESULT_SUBMITTED",
  "PENDING_CONFIRMATION",
  "PENDING_REVIEW_EXPIRED",
  "DISPUTED",
  "IN_PROGRESS",
]);
const LIVE_INCIDENT_DISPUTE_RESOLUTIONS: LiveIncidentDisputeResolution[] = ["CONFIRMED", "CORRECTED", "VOIDED"];
const LIVE_INCIDENT_DEFAULT_REJECT_REASON = "Resultado rejeitado pela organização após triagem live.";
const LIVE_INCIDENT_DEFAULT_RESET_REASON = "Reaberto para nova submissão após validação operacional.";
const LIVE_INCIDENT_DEFAULT_RESET_CODE = "ORGANIZER_REVIEW";

const TERMINAL_TOURNAMENT_STATUSES = new Set(["DRAFT", "CANCELLED", "FINISHED", "COMPLETED", "ARCHIVED"]);

function resolveEventTimestamp(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : null;
}

function isTournamentInProgress(event: PadelEventSummary, nowTs: number) {
  const statusKey = (event.status || "").toUpperCase();
  if (TERMINAL_TOURNAMENT_STATUSES.has(statusKey)) return false;
  const startTs = resolveEventTimestamp(event.startsAt);
  if (startTs === null || nowTs < startTs) return false;
  const endTs = resolveEventTimestamp(event.endsAt);
  if (endTs !== null && nowTs > endTs) return false;
  return true;
}

const badge = (tone: "green" | "amber" | "blue" | "slate" = "slate") =>
  `rounded-full border px-2 py-[4px] text-[11px] ${
    tone === "green"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
    : tone === "amber"
        ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
      : tone === "blue"
          ? "border-sky-300/45 bg-sky-400/12 text-sky-100"
        : "border-white/15 bg-white/10 text-white/70"
  }`;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-2xl border border-white/10   /50 /70   ${className}`}
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

const toDateInputValue = (value: Date) => {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
};

const parseTimeInputToMinute = (value: string) => {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
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

const formatMatchStatusLabel = (status?: string | null) => {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em curso";
    case "RESULT_SUBMITTED":
      return "Resultado submetido";
    case "PENDING_CONFIRMATION":
      return "Pendente confirmação";
    case "PENDING_REVIEW_EXPIRED":
      return "Pendente expirado";
    case "DISPUTED":
      return "Em disputa";
    case "OFFICIAL":
      return "Oficial";
    case "WALKOVER":
      return "WO";
    case "RETIRED":
      return "Desistência";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status || "—";
  }
};

const statusToneClass = (status?: string | null) => {
  if (status === "PENDING_REVIEW_EXPIRED") return "border-rose-300/45 bg-rose-500/12 text-rose-100";
  if (status === "DISPUTED") return "border-amber-300/45 bg-amber-500/12 text-amber-100";
  if (status === "PENDING_CONFIRMATION") return "border-sky-300/45 bg-sky-500/12 text-sky-100";
  if (status === "RESULT_SUBMITTED") return "border-cyan-300/45 bg-cyan-500/12 text-cyan-100";
  if (status === "IN_PROGRESS") return "border-emerald-300/45 bg-emerald-500/12 text-emerald-100";
  return "border-white/20 bg-white/10 text-white/75";
};

const resolvePairingLabel = (
  pairing?:
    | {
        slots?: Array<{
          playerProfile?: { displayName?: string | null; fullName?: string | null } | null;
        } | null> | null;
      }
    | null,
) => {
  if (!pairing?.slots || !Array.isArray(pairing.slots)) return "Dupla";
  const names = pairing.slots
    .map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const profile = slot.playerProfile;
      if (!profile || typeof profile !== "object") return null;
      return profile.displayName || profile.fullName || null;
    })
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return names.length > 0 ? names.join(" / ") : "Dupla";
};

const resolvePendingConfirmationMeta = (score: unknown) => {
  const scoreObj = score && typeof score === "object" && !Array.isArray(score) ? (score as Record<string, unknown>) : null;
  const workflow =
    scoreObj?.liveWorkflow && typeof scoreObj.liveWorkflow === "object" && !Array.isArray(scoreObj.liveWorkflow)
      ? (scoreObj.liveWorkflow as Record<string, unknown>)
      : null;
  const expiresAt = workflow && typeof workflow.pendingConfirmationExpiresAt === "string" ? workflow.pendingConfirmationExpiresAt : null;
  if (!expiresAt) {
    return { expiresAt: null, remainingMs: null as number | null };
  }
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return { expiresAt, remainingMs: null as number | null };
  }
  return { expiresAt, remainingMs: parsed.getTime() - Date.now() };
};

const resolveMatchStreamMeta = (match: LiveOpsMatchItem) => {
  if (match.stream && typeof match.stream === "object" && !Array.isArray(match.stream)) {
    const stream = match.stream;
    const rawUrl = typeof stream.url === "string" ? stream.url.trim() : "";
    return {
      isLive: stream.isLive === true,
      url: rawUrl.length > 0 ? rawUrl : null,
    };
  }
  const scoreObj = match.score && typeof match.score === "object" && !Array.isArray(match.score) ? match.score : null;
  const liveStream =
    scoreObj?.liveStream && typeof scoreObj.liveStream === "object" && !Array.isArray(scoreObj.liveStream)
      ? (scoreObj.liveStream as Record<string, unknown>)
      : null;
  const rawUrl = typeof liveStream?.url === "string" ? liveStream.url.trim() : "";
  return {
    isLive: liveStream?.isLive === true,
    url: rawUrl.length > 0 ? rawUrl : null,
  };
};

const formatElapsedSecondsLabel = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatRemainingMsLabel = (remainingMs: number | null) => {
  if (typeof remainingMs !== "number" || !Number.isFinite(remainingMs)) return null;
  if (remainingMs <= 0) return "expirado";
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${Math.max(1, totalMinutes)} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const incidentPriority = (status: string) => {
  switch (status) {
    case "PENDING_REVIEW_EXPIRED":
      return 0;
    case "DISPUTED":
      return 1;
    case "PENDING_CONFIRMATION":
      return 2;
    case "RESULT_SUBMITTED":
      return 3;
    case "IN_PROGRESS":
      return 4;
    default:
      return 99;
  }
};

const createClientRequestId = (prefix = "padel_ops") => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const extractApiErrorCode = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const json = payload as Record<string, unknown>;
  if (typeof json.errorCode === "string" && json.errorCode.trim().length > 0) return json.errorCode.trim();
  if (typeof json.code === "string" && json.code.trim().length > 0) return json.code.trim();
  if (typeof json.error === "string" && json.error.trim().length > 0) return json.error.trim();
  if (typeof json.message === "string" && json.message.trim().length > 0) return json.message.trim();
  if (json.data && typeof json.data === "object") {
    const data = json.data as Record<string, unknown>;
    if (typeof data.error === "string" && data.error.trim().length > 0) return data.error.trim();
    if (typeof data.errorCode === "string" && data.errorCode.trim().length > 0) return data.errorCode.trim();
  }
  return null;
};

const liveIncidentActionErrorMessage = (errorCode: string | null, fallback: string) => {
  switch (errorCode) {
    case "UNAUTHENTICATED":
      return "Sessão expirada. Volta a autenticar para continuar.";
    case "FORBIDDEN":
      return "Sem permissões para esta ação no torneio.";
    case "INVALID_MATCH":
    case "MATCH_NOT_FOUND":
      return "O jogo já não existe ou foi removido.";
    case "MISSING_CLIENT_REQUEST_ID":
      return "Falha de idempotência. Tenta novamente.";
    case "INVALID_REASON_TEXT":
      return "A ação exige um motivo válido.";
    case "MISSING_REASON_CODE":
    case "INVALID_TARGET_STATE":
      return "Parâmetros de reset pendente inválidos.";
    case "DISPUTE_NOT_OPEN":
      return "A disputa já foi resolvida por outro operador.";
    case "MISSING_RESOLUTION_STATUS":
    case "INVALID_RESOLUTION_STATUS":
      return "Estado de resolução da disputa inválido.";
    case "MISSING_CONFIRMATION_SOURCE":
    case "INVALID_CONFIRMATION_SOURCE":
      return "Fonte de confirmação inválida para esta ação.";
    default:
      return sanitizeUiErrorMessage(errorCode, fallback);
  }
};

const parsePositiveInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const mapNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => parsePositiveInt(entry))
    .filter((entry): entry is number => typeof entry === "number");
};

const areNumberArraysEqual = (left: number[], right: number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const EMPTY_UNKNOWN_RECORD: Record<string, unknown> = {};
const EMPTY_PROFILE_BY_CATEGORY: Record<string, Record<string, unknown>> = {};

const normalizeDateLike = (value: string | Date | null | undefined) => {
  if (!value) return "";
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? value.toISOString() : "";
  }
  return String(value);
};

const arePadelClubArraysEqual = (left: PadelClub[], right: PadelClub[]) =>
  left.length === right.length &&
  left.every((club, index) => {
    const target = right[index];
    if (!target) return false;
    return (
      club.id === target.id &&
      club.name === target.name &&
      (club.city ?? null) === (target.city ?? null) &&
      (club.addressId ?? null) === (target.addressId ?? null) &&
      club.courtsCount === target.courtsCount &&
      club.isActive === target.isActive &&
      normalizeDateLike(club.createdAt) === normalizeDateLike(target.createdAt)
    );
  });

const arePlayerArraysEqual = (left: Player[], right: Player[]) =>
  left.length === right.length &&
  left.every((player, index) => {
    const target = right[index];
    if (!target) return false;
    return (
      player.id === target.id &&
      (player.userId ?? null) === (target.userId ?? null) &&
      player.fullName === target.fullName &&
      (player.email ?? null) === (target.email ?? null) &&
      (player.phone ?? null) === (target.phone ?? null) &&
      (player.gender ?? null) === (target.gender ?? null) &&
      (player.level ?? null) === (target.level ?? null) &&
      player.isActive === target.isActive &&
      (player.tournamentsCount ?? null) === (target.tournamentsCount ?? null) &&
      (player.noShowCount ?? null) === (target.noShowCount ?? null) &&
      normalizeDateLike(player.createdAt) === normalizeDateLike(target.createdAt)
    );
  });

const arePadelCategoryArraysEqual = (left: PadelCategory[], right: PadelCategory[]) =>
  left.length === right.length &&
  left.every((category, index) => {
    const target = right[index];
    if (!target) return false;
    return (
      category.id === target.id &&
      category.label === target.label &&
      (category.genderRestriction ?? null) === (target.genderRestriction ?? null) &&
      (category.minLevel ?? null) === (target.minLevel ?? null) &&
      (category.maxLevel ?? null) === (target.maxLevel ?? null) &&
      (category.season ?? null) === (target.season ?? null) &&
      (category.year ?? null) === (target.year ?? null) &&
      category.isActive === target.isActive
    );
  });

const areTeamArraysEqual = (left: Team[], right: Team[]) =>
  left.length === right.length &&
  left.every((team, index) => {
    const target = right[index];
    if (!target) return false;
    return (
      team.id === target.id &&
      team.name === target.name &&
      (team.level ?? null) === (target.level ?? null) &&
      team.isActive === target.isActive &&
      (team.padelClubId ?? null) === (target.padelClubId ?? null) &&
      (team.categoryId ?? null) === (target.categoryId ?? null) &&
      (team.membersCount ?? null) === (target.membersCount ?? null) &&
      normalizeDateLike(team.updatedAt ?? null) === normalizeDateLike(target.updatedAt ?? null) &&
      normalizeDateLike(team.createdAt ?? null) === normalizeDateLike(target.createdAt ?? null)
    );
  });

const resolveCategoryTeamsForPlanning = (
  link: PadelEventCategoryLink | null | undefined,
  strategy: "runtime-first" | "capacity-first" = "runtime-first",
) => {
  if (!link) return 0;
  const toTeams = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
  };
  const confirmed = toTeams(link.confirmedTeams);
  const complete = toTeams(link.completeTeams);
  const active = toTeams(link.activeTeams);
  const pending = toTeams(link.pendingTeams);
  const capacity = toTeams(link.capacityTeams);

  if (strategy === "capacity-first") {
    if (capacity > 0) return capacity;
    if (confirmed > 0) return confirmed;
    if (active > 0) return active;
    if (complete > 0) return complete;
    if (pending > 0) return pending;
    return 0;
  }

  if (confirmed > 0) return confirmed;
  if (complete > 0) return complete;
  if (active > 0) return active;
  if (capacity > 0) return capacity;
  if (pending > 0) return pending;
  return 0;
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
  canEditPadel,
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
  const [coachActionLoading, setCoachActionLoading] = useState<string | null>(null);
  const [coachCreateUserId, setCoachCreateUserId] = useState("");
  const [coachCreating, setCoachCreating] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachMessage, setCoachMessage] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDuration, setLessonDuration] = useState(String(LESSON_DURATION_OPTIONS[0]));
  const [lessonPrice, setLessonPrice] = useState("20");
  const [lessonCoachUserId, setLessonCoachUserId] = useState("");
  const [lessonCourtId, setLessonCourtId] = useState("");
  const [lessonWeekday, setLessonWeekday] = useState(String(new Date().getDay()));
  const [lessonStartTime, setLessonStartTime] = useState(LESSON_DEFAULT_START_TIME);
  const [lessonValidFrom, setLessonValidFrom] = useState(() => toDateInputValue(new Date()));
  const [lessonValidUntil, setLessonValidUntil] = useState("");
  const [lessonCapacity, setLessonCapacity] = useState("4");
  const [lessonCreating, setLessonCreating] = useState(false);
  const [lessonProvisioningCoach, setLessonProvisioningCoach] = useState(false);
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
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE" | "UNKNOWN">("ALL");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "WITH" | "NONE">("ALL");
  const [noShowFilter, setNoShowFilter] = useState<"ALL" | "WITH" | "NONE">("ALL");
  const [calendarScope, setCalendarScope] = useState<"week" | "day">("week");
  const [calendarDataView, setCalendarDataView] = useState<"complete" | "games">("complete");
  const [calendarFilter, setCalendarFilter] = useState<"all" | "club">("all");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [bulkBlockCourtIds, setBulkBlockCourtIds] = useState<number[]>([]);
  const [bulkBlockStartAt, setBulkBlockStartAt] = useState("");
  const [bulkBlockEndAt, setBulkBlockEndAt] = useState("");
  const [bulkBlockConflictPolicy, setBulkBlockConflictPolicy] = useState<"CASCADE_SAME_COURT" | "REJECT_ON_CONFLICT">(
    "CASCADE_SAME_COURT",
  );
  const [bulkBlockReasonCode, setBulkBlockReasonCode] = useState("");
  const [bulkBlockReasonText, setBulkBlockReasonText] = useState("");
  const [bulkBlockForce, setBulkBlockForce] = useState(false);
  const [bulkBlockBusy, setBulkBlockBusy] = useState(false);
  const [bulkBlockMessage, setBulkBlockMessage] = useState<string | null>(null);
  const [bulkBlockError, setBulkBlockError] = useState<string | null>(null);
  const [overrideOperationId, setOverrideOperationId] = useState("");
  const [overrideSoftBlockId, setOverrideSoftBlockId] = useState("");
  const [overridePolicy, setOverridePolicy] = useState<"REJECT_ON_CONFLICT" | "FORCE_OVERRIDE">(
    "REJECT_ON_CONFLICT",
  );
  const [overrideReasonCode, setOverrideReasonCode] = useState("");
  const [overrideReasonText, setOverrideReasonText] = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);
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
  const [autoScheduleCourtIds, setAutoScheduleCourtIds] = useState<number[]>([]);
  const [autoScheduleCourtPriorityOrder, setAutoScheduleCourtPriorityOrder] = useState<number[]>([]);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [lastAutoScheduleRunId, setLastAutoScheduleRunId] = useState<string | null>(null);
  const [autoScheduleSummary, setAutoScheduleSummary] = useState<string | null>(null);
  const [autoScheduleUnscheduledByReason, setAutoScheduleUnscheduledByReason] = useState<Record<string, number>>({});
  const [autoScheduleByCategory, setAutoScheduleByCategory] = useState<
    Array<{
      categoryId: number | null;
      scheduledCount: number;
      skippedCount: number;
      unscheduledByReason: Record<string, number>;
    }>
  >([]);
  const [autoSchedulePreview, setAutoSchedulePreview] = useState<
    Array<{ matchId: number; courtId: number; start: string; end: string }> | null
  >(null);
  const autoSchedulePreviewSnapshotRef = useRef<{
    fingerprint: string;
    scheduledCount: number;
    skippedCount: number;
    unscheduledByReason: Record<string, number>;
  } | null>(null);
  const reportedPreflightMismatchRef = useRef<Set<string>>(new Set());
  const [autoSchedulePlan, setAutoSchedulePlan] = useState<PadelFormatPlanResult | null>(null);
  const [autoSchedulePlanLoading, setAutoSchedulePlanLoading] = useState(false);
  const [autoSchedulePlanError, setAutoSchedulePlanError] = useState<string | null>(null);
  const [roundOpsCategoryKey, setRoundOpsCategoryKey] = useState("global");
  const [roundOpsBusy, setRoundOpsBusy] = useState(false);
  const [roundOpsMessage, setRoundOpsMessage] = useState<string | null>(null);
  const [roundOpsWarning, setRoundOpsWarning] = useState<string | null>(null);
  const [roundOpsError, setRoundOpsError] = useState<string | null>(null);
  const [opsLiveFeed, setOpsLiveFeed] = useState<
    Array<{
      id: string;
      level: "ok" | "warn" | "err" | "info";
      title: string;
      detail?: string | null;
      at: string;
    }>
  >([]);
  const [roundOpsPlanningMode, setRoundOpsPlanningMode] = useState<"runtime" | "capacity">("runtime");
  const [roundOpsProfileBusy, setRoundOpsProfileBusy] = useState(false);
  const [roundOpsPlan, setRoundOpsPlan] = useState<PadelFormatPlanResult | null>(null);
  const [roundOpsPlanLoading, setRoundOpsPlanLoading] = useState(false);
  const [roundOpsPlanError, setRoundOpsPlanError] = useState<string | null>(null);
  const [roundOpsNonStopRoundsDraft, setRoundOpsNonStopRoundsDraft] = useState(String(DEFAULT_NON_STOP_ROUNDS));
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<LiveIncidentStatusFilter>("ALL");
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState<string>("ALL");
  const [incidentFormatFilter, setIncidentFormatFilter] = useState<string>("ALL");
  const [incidentActionBusyKey, setIncidentActionBusyKey] = useState<string | null>(null);
  const [incidentActionMessage, setIncidentActionMessage] = useState<string | null>(null);
  const [incidentActionError, setIncidentActionError] = useState<string | null>(null);
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
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [editingMatchVersion, setEditingMatchVersion] = useState<string | Date | null>(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState<number[]>([]);
  const [matchForm, setMatchForm] = useState({
    start: "",
    end: "",
    courtId: "",
  });
  const [savingCalendar, setSavingCalendar] = useState(false);

  const [clubForm, setClubForm] = useState(DEFAULT_FORM);
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [clubError, setClubError] = useState<string | null>(null);
  const [clubMessage, setClubMessage] = useState<string | null>(null);
  const [clubLocationQuery, setClubLocationQuery] = useState("");
  const [hasMounted, setHasMounted] = useState(false);

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

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!clubModalOpen || !hasMounted) return;
    const unlockBodyScroll = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClubModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unlockBodyScroll();
    };
  }, [clubModalOpen, hasMounted]);

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
  const { data: coachesRes, isLoading: coachesLoading, mutate: mutateCoaches } = useSWR<CoachesResponse>(
    buildOrgApiPath("/padel/coaches"),
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
  const { data: entryCategoriesRes } = useSWR<{ ok?: boolean; items?: PadelEventCategoryLink[] }>(
    entryEventId ? `/api/padel/event-categories?eventId=${entryEventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: eventCategoriesRes } = useSWR<{ ok?: boolean; items?: PadelEventCategoryLink[] }>(
    eventId ? `/api/padel/event-categories?eventId=${eventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: padelEventsRes, isLoading: padelEventsLoading } = useSWR<PadelEventsResponse>(
    buildOrgApiPath("/events/list", { templateType: "PADEL", limit: 200 }),
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
  const overridesKey = eventId
    ? buildOrgApiPath("/tournaments/blocks/overrides", { eventId, limit: 20 })
    : null;
  const { data: tournamentOverridesRes, mutate: mutateTournamentOverrides } = useSWR<TournamentBlockOverridesResponse>(
    overridesKey,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: opsSummaryRes } = useSWR<PadelOpsSummaryResponse>(
    eventId ? `/api/padel/ops/summary?eventId=${eventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const autoScheduleRunKey = lastAutoScheduleRunId
    ? `/api/padel/calendar/auto-schedule/runs/${lastAutoScheduleRunId}`
    : null;
  const { data: autoScheduleRunRes, mutate: mutateAutoScheduleRun } = useSWR<AutoScheduleRunResponse>(
    autoScheduleRunKey,
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: lastAutoScheduleRunId ? 2000 : 0,
    },
  );
  const { data: liveOpsMatchesRes, isLoading: liveOpsMatchesLoading, mutate: mutateLiveOpsMatches } = useSWR<{
    ok?: boolean;
    data?: { items?: LiveOpsMatchItem[]; error?: string };
    items?: LiveOpsMatchItem[];
    error?: string;
  }>(eventId ? `/api/padel/matches?eventId=${eventId}` : null, fetcher, { revalidateOnFocus: false });
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
  const autoScheduleCourtOptions = useMemo(() => {
    const advanced = (padelConfig?.advancedSettings ?? {}) as {
      courtsFromClubs?: Array<{
        id?: number | string | null;
        name?: string | null;
        clubName?: string | null;
        displayOrder?: number | null;
      }>;
      courtIds?: Array<number | string | null>;
    };
    const fromClubs = Array.isArray(advanced.courtsFromClubs)
      ? advanced.courtsFromClubs
          .map((entry, idx) => {
            const idRaw = typeof entry?.id === "number" ? entry.id : Number(entry?.id);
            if (!Number.isFinite(idRaw) || idRaw <= 0) return null;
            const id = Math.floor(idRaw);
            const nameRaw = typeof entry?.name === "string" ? entry.name.trim() : "";
            const clubNameRaw = typeof entry?.clubName === "string" ? entry.clubName.trim() : "";
            const displayOrderRaw =
              typeof entry?.displayOrder === "number" && Number.isFinite(entry.displayOrder)
                ? entry.displayOrder
                : idx;
            return {
              id,
              name: nameRaw || `Campo ${id}`,
              clubName: clubNameRaw || null,
              displayOrder: displayOrderRaw,
            };
          })
          .filter((entry): entry is { id: number; name: string; clubName: string | null; displayOrder: number } =>
            Boolean(entry),
          )
      : [];

    if (fromClubs.length > 0) {
      const byId = new Map<number, { id: number; name: string; clubName: string | null; displayOrder: number }>();
      fromClubs.forEach((entry) => {
        if (!byId.has(entry.id)) byId.set(entry.id, entry);
      });
      return Array.from(byId.values()).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    }

    const fromIds = Array.isArray(advanced.courtIds)
      ? advanced.courtIds
          .map((value, idx) => {
            const raw = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(raw) || raw <= 0) return null;
            const id = Math.floor(raw);
            return {
              id,
              name: `Campo ${id}`,
              clubName: null as string | null,
              displayOrder: idx,
            };
          })
          .filter((entry): entry is { id: number; name: string; clubName: string | null; displayOrder: number } =>
            Boolean(entry),
          )
      : [];
    return fromIds;
  }, [padelConfig?.advancedSettings]);

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

  useEffect(() => {
    const optionIds = autoScheduleCourtOptions.map((court) => court.id);
    if (optionIds.length === 0) {
      setAutoScheduleCourtIds((prev) => (prev.length === 0 ? prev : []));
      setAutoScheduleCourtPriorityOrder((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const advanced = (padelConfig?.advancedSettings ?? {}) as {
      courtSelectionDefaults?: {
        useAllCourts?: boolean;
        courtIds?: Array<number | string | null>;
      };
      courtPriorityOrder?: Array<number | string | null>;
    };
    const selectionDefaults = advanced.courtSelectionDefaults ?? {};
    const preferredSubset =
      selectionDefaults.useAllCourts === false && Array.isArray(selectionDefaults.courtIds)
        ? selectionDefaults.courtIds
            .map((value) => (typeof value === "number" ? value : Number(value)))
            .filter((value): value is number => Number.isFinite(value) && value > 0)
            .map((value) => Math.floor(value))
            .filter((id) => optionIds.includes(id))
        : [];
    const selectedIds = preferredSubset.length > 0 ? preferredSubset : optionIds;
    const configuredPriority = Array.isArray(advanced.courtPriorityOrder)
      ? advanced.courtPriorityOrder
          .map((value) => (typeof value === "number" ? value : Number(value)))
          .filter((value): value is number => Number.isFinite(value) && value > 0)
          .map((value) => Math.floor(value))
          .filter((id) => selectedIds.includes(id))
      : [];
    const priority = [...configuredPriority, ...selectedIds.filter((id) => !configuredPriority.includes(id))];
    setAutoScheduleCourtIds((prev) =>
      prev.length === selectedIds.length && prev.every((id, idx) => id === selectedIds[idx]) ? prev : selectedIds,
    );
    setAutoScheduleCourtPriorityOrder((prev) =>
      prev.length === priority.length && prev.every((id, idx) => id === priority[idx]) ? prev : priority,
    );
  }, [autoScheduleCourtOptions, padelConfig?.eventId, padelConfig?.advancedSettings]);

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
  const visibleClubs = useMemo(() => sortedClubs.slice(0, 1), [sortedClubs]);

  const selectedClub = useMemo(() => clubs.find((c) => c.id === drawerClubId) || null, [clubs, drawerClubId]);

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
  const inProgressEventsCount = useMemo(
    () => {
      const nowTs = Date.now();
      return padelEvents.filter((event) => isTournamentInProgress(event, nowTs)).length;
    },
    [padelEvents],
  );
  const publishedEventsCount = useMemo(
    () => padelEvents.filter((event) => (event.status || "").toUpperCase() === "PUBLISHED").length,
    [padelEvents],
  );
  const padelEventsError = padelEventsRes?.ok === false ? sanitizeUiErrorMessage(padelEventsRes.error, "Erro ao carregar torneios.") : null;

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
    if (opsSummary.inProgressMatchesCount > 0) {
      alerts.push({
        key: "in-progress",
        label: `${opsSummary.inProgressMatchesCount} jogos a decorrer.`,
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
      { key: "in-progress", label: "Jogos em curso", value: opsSummary?.inProgressMatchesCount ?? 0 },
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

  const coaches = coachesRes?.items ?? [];
  const lessonCoachOptions = useMemo(
    () =>
      [...coaches].sort((a, b) =>
        (a.fullName || a.username || "").localeCompare((b.fullName || b.username || ""), "pt-PT"),
      ),
    [coaches],
  );
  const selectedLessonCoach = useMemo(
    () => coaches.find((coach) => coach.userId === lessonCoachUserId) ?? null,
    [lessonCoachUserId, coaches],
  );
  const activeLessonCourts = useMemo(
    () => courts.filter((court) => court.isActive).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id),
    [courts],
  );
  const coachesError = coachesRes?.ok === false ? sanitizeUiErrorMessage(coachesRes.error, "Erro ao carregar treinadores.") : null;
  const coachUserIds = useMemo(() => new Set(coaches.map((coach) => coach.userId)), [coaches]);
  const coachMemberCandidates = useMemo(() => {
    const allowedRoles = new Set(["OWNER", "CO_OWNER", "ADMIN", "STAFF"]);
    return (organizationStaff?.items ?? [])
      .filter((member) => member.userId && member.role && allowedRoles.has(member.role))
      .filter((member) => !coachUserIds.has(member.userId));
  }, [organizationStaff?.items, coachUserIds]);
  const services = servicesRes?.items ?? [];
  const lessonsError = servicesRes?.ok === false ? sanitizeUiErrorMessage(servicesRes.error, "Erro ao carregar aulas.") : null;
  const lessonServices = useMemo(() => {
    return services.filter((service) => {
      const kind = (service.kind ?? "").trim().toUpperCase();
      const tag = (service.categoryTag ?? "").trim().toLowerCase();
      return kind === "CLASS" || tag.includes("aula") || tag.includes("treino");
    });
  }, [services]);
  const coachErrorLabel = useMemo(() => {
    if (!coachesError) return null;
    if (coachesError === "FORBIDDEN") return "Sem permissões para gerir treinadores.";
    if (coachesError === "UNAUTHENTICATED") return "Inicia sessão para gerir treinadores.";
    return coachesError;
  }, [coachesError]);
  const lessonsErrorLabel = useMemo(() => {
    if (!lessonsError) return null;
    return lessonsError;
  }, [lessonsError]);

  useEffect(() => {
    if (lessonCoachUserId && !coaches.some((coach) => coach.userId === lessonCoachUserId)) {
      setLessonCoachUserId("");
    }
  }, [lessonCoachUserId, coaches]);

  useEffect(() => {
    if (lessonCourtId && !activeLessonCourts.some((court) => String(court.id) === lessonCourtId)) {
      setLessonCourtId("");
    }
  }, [activeLessonCourts, lessonCourtId]);

  useEffect(() => {
    if (coachCreateUserId && !coachMemberCandidates.some((member) => member.userId === coachCreateUserId)) {
      setCoachCreateUserId("");
    }
  }, [coachCreateUserId, coachMemberCandidates]);

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
      const gender = (cat.genderRestriction ?? "").trim().toUpperCase();
      if (gender === "MALE") groups[0].items.push(cat);
      else if (gender === "FEMALE") groups[1].items.push(cat);
      else if (gender === "MIXED") groups[2].items.push(cat);
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
    setClubs((prev) => {
      let changed = false;
      const next = prev.map((club) => {
        if (club.id !== clubId) return club;
        if (club.courtsCount === activeCount) return club;
        changed = true;
        return { ...club, courtsCount: activeCount };
      });
      return changed ? next : prev;
    });
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
      const countByClubId = new Map(updates.map((entry) => [entry.id, entry.count] as const));
      setClubs((prev) => {
        let changed = false;
        const next = prev.map((club) => {
          const foundCount = countByClubId.get(club.id);
          if (typeof foundCount !== "number" || foundCount === club.courtsCount) return club;
          changed = true;
          return { ...club, courtsCount: foundCount };
        });
        return changed ? next : prev;
      });
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
    const codePrefix =
      normalizedGender === "MALE" ? "M" : normalizedGender === "FEMALE" ? "F" : normalizedGender === "MIXED" ? "MX" : null;
    if (codePrefix && normalizedLevel) {
      return `${codePrefix}${normalizedLevel}`;
    }
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
        setCategoryError(sanitizeUiErrorMessage(json?.error, "Erro ao guardar categoria."));
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
        setCategoryError(sanitizeUiErrorMessage(json?.error, "Erro ao criar categoria."));
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
    const label = categoryForm.label.trim();
    if (!label) {
      setCategoryError("Escreve o nome da categoria.");
      return;
    }
    if (isReservedPadelMandatoryLabel(label)) {
      setCategoryError("Código reservado: M1..M6, F1..F6 e MX1..MX6 já são obrigatórios.");
      return;
    }
    await submitCategory(
      {
        label,
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
    if (isReservedPadelMandatoryLabel(label)) {
      setCategoryError("Código reservado: M1..M6, F1..F6 e MX1..MX6 já são obrigatórios.");
      return;
    }
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
        setCategoryError(sanitizeUiErrorMessage(json?.error, "Erro ao apagar categoria."));
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

  const handleEnsureCoachOperational = async (coach: CoachItem, source: "coaches" | "lessons" = "coaches") => {
    if (!organizationId) return;
    if (source === "coaches") {
      setCoachActionLoading(coach.userId);
      setCoachError(null);
      setCoachMessage(null);
    } else {
      setLessonProvisioningCoach(true);
      setLessonError(null);
      setLessonMessage(null);
    }
    try {
      const coachesApiPath = buildOrgApiPath("/padel/coaches");
      if (!coachesApiPath) throw new Error("Organização indisponível.");
      const res = await fetch(coachesApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          userId: coach.userId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(
          sanitizeUiErrorMessage(
            json?.error ?? json?.errorCode,
            "Não foi possível garantir o treinador em Reservas.",
          ),
        );
      }
      if (mutateCoaches) await mutateCoaches();
      if (source === "coaches") {
        setCoachMessage("Treinador ligado a Reservas.");
        toast("Treinador ligado a Reservas.", "ok");
      } else {
        setLessonMessage("Treinador criado em reservas.");
        toast("Treinador criado em reservas.", "ok");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : source === "coaches"
            ? "Erro ao ligar treinador a Reservas."
            : "Erro ao criar treinador em Reservas.";
      if (source === "coaches") {
        setCoachError(message);
      } else {
        setLessonError(message);
      }
      toast(message, "err");
    } finally {
      if (source === "coaches") {
        setCoachActionLoading(null);
      } else {
        setLessonProvisioningCoach(false);
      }
    }
  };

  const handleAddCoach = async () => {
    if (!organizationId || !coachCreateUserId || coachCreating) return;
    setCoachCreating(true);
    setCoachError(null);
    setCoachMessage(null);
    try {
      const coachesApiPath = buildOrgApiPath("/padel/coaches");
      if (!coachesApiPath) throw new Error("Organização indisponível.");
      const res = await fetch(coachesApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          userId: coachCreateUserId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(sanitizeUiErrorMessage(json?.error, "Não foi possível adicionar o treinador."));
      }
      setCoachCreateUserId("");
      setCoachMessage("Treinador associado com sucesso.");
      if (mutateCoaches) await mutateCoaches();
      toast("Treinador associado.", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao adicionar treinador.";
      setCoachError(message);
      toast(message, "err");
    } finally {
      setCoachCreating(false);
    }
  };

  const handleRemoveCoach = async (coach: CoachItem) => {
    if (!organizationId) return;
    const confirmed = window.confirm(
      `Remover ${coach.fullName || coach.username || "este treinador"} da lista de treinadores?`,
    );
    if (!confirmed) return;
    setCoachActionLoading(coach.userId);
    setCoachError(null);
    setCoachMessage(null);
    try {
      const coachesApiPath = buildOrgApiPath("/padel/coaches");
      if (!coachesApiPath) throw new Error("Organização indisponível.");
      const res = await fetch(coachesApiPath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          userId: coach.userId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(sanitizeUiErrorMessage(json?.error, "Não foi possível remover o treinador."));
      }
      if (mutateCoaches) await mutateCoaches();
      setCoachMessage("Treinador removido.");
      toast("Treinador removido.", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao remover treinador.";
      setCoachError(message);
      toast(message, "err");
    } finally {
      setCoachActionLoading(null);
    }
  };

  const handleProvisionLessonCoach = async () => {
    if (!organizationId || !selectedLessonCoach || lessonProvisioningCoach) return;
    await handleEnsureCoachOperational(selectedLessonCoach, "lessons");
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

    const dayOfWeek = Number(lessonWeekday);
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      setLessonError("Seleciona o dia da semana.");
      return;
    }
    const startMinute = parseTimeInputToMinute(lessonStartTime);
    if (startMinute == null) {
      setLessonError("Hora inválida.");
      return;
    }
    const capacityValue = Number(lessonCapacity);
    if (!Number.isFinite(capacityValue) || capacityValue <= 0) {
      setLessonError("Capacidade inválida.");
      return;
    }
    if (!lessonValidFrom) {
      setLessonError("Indica a data de início.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonValidFrom)) {
      setLessonError("Data inicial inválida (AAAA-MM-DD).");
      return;
    }
    if (lessonValidUntil && !/^\d{4}-\d{2}-\d{2}$/.test(lessonValidUntil)) {
      setLessonError("Data final inválida (AAAA-MM-DD).");
      return;
    }

    if (!lessonCoachUserId) {
      setLessonError("Seleciona um treinador para criar a aula.");
      return;
    }
    const selectedCoach = selectedLessonCoach;
    if (!selectedCoach) {
      setLessonError("Treinador inválido.");
      return;
    }
    if (!selectedCoach.professionalId || selectedCoach.professionalIsActive !== true) {
      setLessonError('Treinador sem profissional ativo. Usa "Criar em reservas".');
      return;
    }
    const professionalIds = [selectedCoach.professionalId];
    const courtId = lessonCourtId ? Number(lessonCourtId) : null;
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
          kind: "CLASS",
          instructorId: lessonCoachUserId,
          assignmentMode: "PROFESSIONAL_ONLY",
          professionalIds,
          categoryTag: LESSON_TAG,
          locationMode: "FIXED",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(sanitizeUiErrorMessage(json?.error, "Não foi possível criar a aula."));
      }
      const serviceId = Number(json?.service?.id);
      if (!Number.isFinite(serviceId) || serviceId <= 0) {
        throw new Error("A API não devolveu o serviço criado.");
      }

      const classSeriesApiPath = buildOrgApiPath(`/servicos/${serviceId}/class-series`);
      if (!classSeriesApiPath) throw new Error("Organização indisponível.");
      const classSeriesRes = await fetch(classSeriesApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek,
          startMinute,
          durationMinutes: durationValue,
          capacity: Math.floor(capacityValue),
          validFrom: lessonValidFrom,
          validUntil: lessonValidUntil || null,
          professionalId: selectedCoach.professionalId,
          courtId,
          isActive: true,
        }),
      });
      const classSeriesJson = await classSeriesRes.json().catch(() => null);
      if (!classSeriesRes.ok || classSeriesJson?.ok === false) {
        const rollbackPath = buildOrgApiPath(`/servicos/${serviceId}`);
        if (rollbackPath) {
          await fetch(rollbackPath, { method: "DELETE" }).catch(() => null);
        }
        throw new Error(
          sanitizeUiErrorMessage(
            classSeriesJson?.error ?? classSeriesJson?.errorCode,
            "Serviço criado, mas falhou a série recorrente.",
          ),
        );
      }

      setLessonTitle("");
      setLessonPrice("20");
      setLessonDuration(String(LESSON_DURATION_OPTIONS[0]));
      setLessonCoachUserId("");
      setLessonCourtId("");
      setLessonWeekday(String(new Date().getDay()));
      setLessonStartTime(LESSON_DEFAULT_START_TIME);
      setLessonValidFrom(toDateInputValue(new Date()));
      setLessonValidUntil("");
      setLessonCapacity("4");
      setLessonMessage("Aula recorrente criada.");
      toast("Aula recorrente criada.", "ok");
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
        throw new Error(sanitizeUiErrorMessage(json?.error, "Não foi possível criar a equipa."));
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
        throw new Error(sanitizeUiErrorMessage(json?.error, "Não foi possível registar a equipa."));
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
      setCourts((prev) => (prev.length === 0 ? prev : []));
      setStaff((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    loadCourtsAndStaff(drawerClubId);
  }, [drawerClubId]);

  useEffect(() => {
    setClubs((prev) => (arePadelClubArraysEqual(prev, initialClubs) ? prev : initialClubs));
  }, [initialClubs]);

  useEffect(() => {
    setPlayers((prev) => (arePlayerArraysEqual(prev, initialPlayers) ? prev : initialPlayers));
  }, [initialPlayers]);

  useEffect(() => {
    const items = categoriesRes?.items;
    if (!items) return;
    setCategories((prev) => (arePadelCategoryArraysEqual(prev, items) ? prev : items));
  }, [categoriesRes?.items]);

  useEffect(() => {
    const items = teamsRes?.items;
    if (!items) return;
    setTeams((prev) => (areTeamArraysEqual(prev, items) ? prev : items));
  }, [teamsRes?.items]);

  useEffect(() => {
    setEntryCategoryId("");
  }, [entryEventId]);

  useEffect(() => {
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
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
          changed = true;
        }
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!currentIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
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
    if (!selectedClub || courtsPanelReadOnly) return;
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
    if (courtsPanelReadOnly) return null;
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
    if (isPadelReadOnly) {
      setClubError("Apenas leitura. Sem permissões para criar clubes.");
      toast("Apenas leitura. Sem permissões para criar clubes.", "warn");
      return;
    }
    const existingClub = sortedClubs[0] ?? null;
    if (existingClub) {
      setClubForm({
        ...DEFAULT_FORM,
        id: existingClub.id,
        name: existingClub.name,
        addressId: existingClub.addressId ?? "",
        locationProviderId: existingClub.addressRef?.sourceProviderPlaceId ?? "",
        locationFormattedAddress: existingClub.addressRef?.formattedAddress ?? "",
        locationSourceProvider: existingClub.addressRef?.sourceProvider ?? null,
        locationConfidenceScore: existingClub.addressRef?.confidenceScore ?? null,
        locationValidationStatus: existingClub.addressRef?.validationStatus ?? null,
        latitude: existingClub.addressRef?.latitude ?? null,
        longitude: existingClub.addressRef?.longitude ?? null,
        courtsCount: String(Math.max(1, existingClub.courtsCount || 1)),
        kind: "OWN",
        sourceClubId: null,
        isActive: existingClub.isActive,
      });
      setClubLocationQuery(existingClub.addressRef?.formattedAddress ?? "");
      setClubMessage("A organização já tem um clube. Podes atualizar os dados.");
    } else {
      setClubForm({
        ...DEFAULT_FORM,
        kind: "OWN",
        courtsCount: "1",
        addressId: "",
        locationProviderId: "",
        locationFormattedAddress: "",
        latitude: null,
        longitude: null,
        sourceClubId: null,
        isActive: true,
      });
      setClubLocationQuery("");
    }
    setClubError(null);
    if (!existingClub) {
      setClubMessage(null);
    }
    setShowCommandPalette(false);
    setShowOpsDrawer(false);
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
        SHOW_CLUB_STAFF_PANEL ? fetch(`/api/padel/clubs/${clubId}/staff`) : Promise.resolve(null),
      ]);
      const courtsJson = await courtsRes.json().catch(() => null);
      const staffJson = staffRes ? await staffRes.json().catch(() => null) : null;
      if (courtsRes.ok && Array.isArray(courtsJson?.items)) {
        const list = renumberCourts(courtsJson.items as PadelClubCourt[]);
        setCourts(list);
        syncActiveCountOnClub(clubId, list);
      } else setCourtError(sanitizeUiErrorMessage(courtsJson?.error, "Erro ao carregar campos."));
      if (!SHOW_CLUB_STAFF_PANEL) {
        setStaff([]);
      } else if (staffRes?.ok && Array.isArray(staffJson?.items)) {
        setStaff(staffJson.items as PadelClubStaff[]);
      } else {
        setStaffError(sanitizeUiErrorMessage(staffJson?.error, "Erro ao carregar staff."));
      }
    } catch (err) {
      console.error("[padel/clubs] load courts/staff", err);
      setCourtError("Erro ao carregar campos.");
      if (SHOW_CLUB_STAFF_PANEL) {
        setStaffError("Erro ao carregar staff.");
      }
    } finally {
      setLoadingDrawer(false);
    }
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

  const handleSubmitClub = async () => {
    if (isPadelReadOnly) {
      setClubError("Apenas leitura. Sem permissões para guardar clubes.");
      return;
    }
    setClubError(null);
    setClubMessage(null);
    if (!clubForm.name.trim()) {
      setClubError("Nome do clube é obrigatório.");
      return;
    }
    if (!clubForm.addressId.trim()) {
      setClubError("Seleciona uma morada.");
      return;
    }
    const courtsNum = Number(clubForm.courtsCount);
    const courtsCount = Number.isFinite(courtsNum) ? Math.min(1000, Math.max(1, Math.floor(courtsNum))) : 1;
    setSavingClub(true);
    try {
      const res = await fetch("/api/padel/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clubForm.id,
          organizationId,
          name: clubForm.name.trim(),
          addressId: clubForm.addressId || null,
          kind: "OWN",
          sourceClubId: null,
          courtsCount,
          isActive: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.club) {
        setClubError(sanitizeUiErrorMessage(json?.error, "Erro ao guardar clube."));
        return;
      }
      const club = json.club as PadelClub;
      setClubs((prev) => {
        const existing = prev.some((c) => c.id === club.id);
        if (existing) return prev.map((c) => (c.id === club.id ? club : c));
        return [club, ...prev];
      });
      setClubMessage(clubForm.id ? "Clube atualizado." : "Clube criado.");
      setClubModalOpen(false);
      setClubForm({ ...DEFAULT_FORM, courtsCount: String(courtsCount) });
      setClubLocationQuery("");
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

  const resetCourtForm = () => {
    setCourtForm(DEFAULT_COURT_FORM);
    setCourtMessage(null);
    setCourtError(null);
  };

  const handleEditCourt = (court: PadelClubCourt) => {
    if (isPadelReadOnly) {
      setCourtError("Apenas leitura. Sem permissões para editar campos.");
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
    if (isPadelReadOnly) {
      setCourtError("Apenas leitura. Sem permissões para guardar campos.");
      return;
    }
    if (!selectedClub) return;
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
          setCourtError(sanitizeUiErrorMessage(json?.error, "Erro ao guardar campo."));
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
    if (isPadelReadOnly) {
      setClubError("Apenas leitura. Sem permissões para alterar estado de clube.");
      return;
    }
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
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setClubError(sanitizeUiErrorMessage(json?.error, "Erro ao atualizar estado do clube."));
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
    if (isPadelReadOnly) {
      setClubError("Apenas leitura. Sem permissões para apagar clube.");
      return;
    }
    setClubError(null);
    setClubMessage(null);
    try {
      const res = await fetch(`/api/padel/clubs?id=${club.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setClubError(sanitizeUiErrorMessage(json?.error, "Erro ao apagar clube."));
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
    if (isPadelReadOnly) {
      setCourtError("Apenas leitura. Sem permissões para alterar estado de campo.");
      return;
    }
    if (!selectedClub) return;
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
    if (isPadelReadOnly) {
      setCourtError("Apenas leitura. Sem permissões para apagar campo.");
      return;
    }
    if (!selectedClub) return;
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
        setCourtError(sanitizeUiErrorMessage(json?.error, "Erro ao apagar campo."));
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
    if (courtsPanelReadOnly) {
      setStaffError("Apenas leitura. Sem permissões para editar staff.");
      return;
    }
    setStaffForm({
      id: member.id,
      email: "",
      staffMemberId: member.userId || "",
      role: member.role,
      inheritToEvents: member.inheritToEvents,
    });
    setStaffMode("existing");
  };

  const handleSubmitStaff = async () => {
    if (isPadelReadOnly) {
      setStaffError("Apenas leitura. Sem permissões para gerir staff.");
      return;
    }
    if (!selectedClub) return;
    const selectedMember = staffMode === "existing" ? staffOptions.find((m) => m.userId === staffForm.staffMemberId) : null;
    if (staffMode === "existing" && !selectedMember) {
      setStaffError("Escolhe um membro do staff global.");
      return;
    }
    const inviteEmail = staffForm.email.trim().toLowerCase();
    if (staffMode === "external" && !inviteEmail) {
      setStaffError("Indica o email para convite.");
      return;
    }
    const duplicate =
      staffMode === "existing"
        ? staff.some((s) => s.userId && s.userId === selectedMember?.userId && s.id !== staffForm.id)
        : false;
    if (duplicate) {
      setStaffError("Já tens este contacto associado ao clube.");
      return;
    }
    setStaffError(null);
    setStaffMessage(null);
    setStaffInviteNotice(null);
    try {
      if (staffMode === "external") {
        const inviteRes = await fetch(`/api/padel/clubs/${selectedClub.id}/staff/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: inviteEmail,
            role: staffForm.role,
            inheritToEvents: staffForm.inheritToEvents,
          }),
        });
        const inviteJson = await inviteRes.json().catch(() => null);
        if (!inviteRes.ok || inviteJson?.ok === false) {
          setStaffError(sanitizeUiErrorMessage(inviteJson?.error, "Erro ao enviar convite."));
          return;
        }
        setStaffInviteNotice("Convite enviado. O utilizador terá de aceitar para entrar no clube.");
        resetStaffForm();
        return;
      }

      const res = await fetch(`/api/padel/clubs/${selectedClub.id}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: staffForm.id,
          userId: selectedMember?.userId,
          role: staffForm.role,
          padelRole: staffForm.role,
          inheritToEvents: staffForm.inheritToEvents,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setStaffError(sanitizeUiErrorMessage(json?.error, "Erro ao guardar membro."));
        return;
      }
      const member = json.staff as PadelClubStaff;
      setStaff((prev) => {
        const exists = prev.some((s) => s.id === member.id);
        if (exists) return prev.map((s) => (s.id === member.id ? member : s));
        return [member, ...prev];
      });
      setStaffMessage(staffForm.id ? "Membro atualizado." : "Membro adicionado.");
      resetStaffForm();
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
  const isPadelReadOnly = !canEditPadel;
  const isClubsTab = activeTab === "clubs";
  const showCourtsPanel = isClubsTab;
  const showClubStaffPanel = SHOW_CLUB_STAFF_PANEL;
  const courtsPanelReadOnly = isPadelReadOnly;
  const calendarCourtsRaw: CalendarCourt[] | null = Array.isArray(calendarData?.courts) ? calendarData.courts : null;
  const calendarBlocksRaw: CalendarBlock[] = calendarData?.blocks ?? [];
  const calendarClassSessionsRaw: CalendarClassSession[] = Array.isArray(calendarData?.classSessions)
    ? calendarData.classSessions
    : [];
  const calendarBookingsRaw: CalendarBooking[] = Array.isArray(calendarData?.bookings)
    ? calendarData.bookings
    : [];
  const calendarOccupancyItemsRaw: CalendarOccupancyItem[] = Array.isArray(calendarData?.occupancyItems)
    ? calendarData.occupancyItems
    : [];
  const calendarOccupancyLegendRaw: CalendarOccupancyLegendItem[] = Array.isArray(calendarData?.occupancyLegend)
    ? calendarData.occupancyLegend
    : [];
  const calendarArbitrationPolicy =
    calendarData?.arbitrationPolicy && typeof calendarData.arbitrationPolicy === "object"
      ? calendarData.arbitrationPolicy
      : null;
  const calendarAvailabilitiesRaw: CalendarAvailability[] = calendarData?.availabilities ?? [];
  const calendarMatchesRaw: CalendarMatch[] = calendarData?.matches ?? [];
  const calendarConflicts: CalendarConflict[] = calendarData?.conflicts ?? [];
  const tournamentOverrides = tournamentOverridesRes?.data?.items ?? [];
  const calendarEventStart = calendarData?.eventStartsAt ?? null;
  const calendarEventEnd = calendarData?.eventEndsAt ?? null;
  const calendarTimezone = calendarData?.eventTimezone ?? "Europe/Lisbon";
  const calendarBuffer = calendarData?.bufferMinutes ?? 5;
  const calendarCourts = useMemo(() => {
    if (calendarCourtsRaw && calendarCourtsRaw.length > 0) return calendarCourtsRaw;
    return autoScheduleCourtOptions.map((court, idx) => ({
      id: court.id,
      name: court.name,
      padelClubId: null,
      isActive: true,
      displayOrder: Number.isFinite(court.displayOrder) ? court.displayOrder : idx,
      club: court.clubName ? { name: court.clubName } : null,
    }));
  }, [autoScheduleCourtOptions, calendarCourtsRaw]);
  const calendarCourtIdsKey = useMemo(() => {
    const ids = calendarCourts
      .map((court) => parsePositiveInt(court.id))
      .filter((id): id is number => typeof id === "number")
      .sort((left, right) => left - right);
    const uniqueIds: number[] = [];
    ids.forEach((id) => {
      if (uniqueIds.length === 0 || uniqueIds[uniqueIds.length - 1] !== id) {
        uniqueIds.push(id);
      }
    });
    return uniqueIds.join(",");
  }, [calendarCourts]);
  useEffect(() => {
    const fallback = calendarCourtIdsKey
      .split(",")
      .map((value) => Number(value))
      .filter((value): value is number => Number.isFinite(value) && value > 0);
    setBulkBlockCourtIds((prev) => {
      if (fallback.length === 0) {
        return prev.length === 0 ? prev : [];
      }
      const validIds = new Set(fallback);
      const next = prev.filter((id) => validIds.has(id));
      return areNumberArraysEqual(prev, next) ? prev : next;
    });
  }, [calendarCourtIdsKey]);
  useEffect(() => {
    if (!calendarEventStart || !calendarEventEnd) return;
    if (!bulkBlockStartAt) {
      setBulkBlockStartAt(formatDateTimeLocal(calendarEventStart));
    }
    if (!bulkBlockEndAt) {
      setBulkBlockEndAt(formatDateTimeLocal(calendarEventEnd));
    }
  }, [calendarEventStart, calendarEventEnd, bulkBlockStartAt, bulkBlockEndAt]);
  const tournamentFormatRaw = typeof padelConfig?.format === "string" ? padelConfig.format : null;
  const tournamentFormatLabel = tournamentFormatRaw
    ? PADEL_FORMAT_LABELS[tournamentFormatRaw] ?? tournamentFormatRaw
    : "Formato por definir";
  const tournamentHasKnockoutPhase = tournamentFormatRaw ? FORMATS_WITH_KNOCKOUT.has(tournamentFormatRaw) : false;
  const autoScheduleFormatHint = !tournamentFormatRaw
    ? "Define o formato do torneio para alinhar a prioridade da agenda."
    : tournamentFormatRaw === "GRUPOS_ELIMINATORIAS"
      ? "Formato com 2 fases: agenda grupos primeiro e reserva janelas finais para eliminatórias."
      : tournamentHasKnockoutPhase
        ? "Formato eliminatório: prioriza rondas KO e mantém margem para atrasos entre rondas."
        : "Formato sem eliminatórias: a prioridade aplica-se só às rondas gerais.";
  const advancedSettings = useMemo<Record<string, unknown>>(() => {
    const source = padelConfig?.advancedSettings;
    return source && typeof source === "object" ? (source as Record<string, unknown>) : EMPTY_UNKNOWN_RECORD;
  }, [padelConfig?.advancedSettings]);
  const formatProfilesByCategoryRaw = useMemo<Record<string, unknown>>(() => {
    const source = advancedSettings.formatProfilesByCategory;
    return source && typeof source === "object" && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : EMPTY_UNKNOWN_RECORD;
  }, [advancedSettings]);
  const formatProfilesByCategory = useMemo<Record<string, Record<string, unknown>>>(() => {
    const entries = Object.entries(formatProfilesByCategoryRaw);
    if (entries.length === 0) return EMPTY_PROFILE_BY_CATEGORY;
    return entries.reduce<Record<string, Record<string, unknown>>>((acc, [key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return acc;
      acc[key] = { ...(value as Record<string, unknown>) };
      return acc;
    }, {});
  }, [formatProfilesByCategoryRaw]);
  const nonStopRuntimeByCategory = useMemo<Record<string, unknown>>(() => {
    const source = advancedSettings.nonStopRuntimeByCategory;
    return source && typeof source === "object" && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : EMPTY_UNKNOWN_RECORD;
  }, [advancedSettings]);
  const amMxRuntimeByCategory = useMemo<Record<string, unknown>>(() => {
    const source = advancedSettings.amMxRuntimeByCategory;
    return source && typeof source === "object" && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : EMPTY_UNKNOWN_RECORD;
  }, [advancedSettings]);
  const eventCategories = useMemo(() => {
    if (!eventCategoriesRes?.ok || !Array.isArray(eventCategoriesRes.items)) return [];
    return eventCategoriesRes.items;
  }, [eventCategoriesRes]);
  const eventCategoryLabelById = useMemo(() => {
    const labels = new Map<number, string>();
    for (const link of eventCategories) {
      const categoryId =
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null;
      if (!categoryId || labels.has(categoryId)) continue;
      labels.set(categoryId, link.category?.label || `Categoria #${categoryId}`);
    }
    return labels;
  }, [eventCategories]);
  const eventCategoriesById = useMemo(() => {
    const entries = new Map<number, PadelEventCategoryLink>();
    for (const link of eventCategories) {
      const categoryId =
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null;
      if (!categoryId || entries.has(categoryId)) continue;
      entries.set(categoryId, link);
    }
    return entries;
  }, [eventCategories]);
  const eventCategoryFormatById = useMemo(() => {
    const map = new Map<number, string>();
    for (const link of eventCategories) {
      const categoryId =
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null;
      if (!categoryId || map.has(categoryId)) continue;
      const formatRaw = typeof link.format === "string" ? link.format.trim().toUpperCase() : "";
      if (!formatRaw) continue;
      map.set(categoryId, formatRaw);
    }
    return map;
  }, [eventCategories]);
  const runtimeCategoryKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add("global");
    eventCategories.forEach((link) => {
      const categoryId =
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null;
      if (categoryId && categoryId > 0) keys.add(String(categoryId));
    });
    Object.keys(formatProfilesByCategory).forEach((key) => keys.add(String(key)));
    Object.keys(nonStopRuntimeByCategory).forEach((key) => keys.add(key));
    Object.keys(amMxRuntimeByCategory).forEach((key) => keys.add(key));
    return Array.from(keys).sort((a, b) => {
      if (a === "global") return -1;
      if (b === "global") return 1;
      const numericA = parsePositiveInt(a);
      const numericB = parsePositiveInt(b);
      if (numericA !== null && numericB !== null) return numericA - numericB;
      return a.localeCompare(b);
    });
  }, [amMxRuntimeByCategory, eventCategories, formatProfilesByCategory, nonStopRuntimeByCategory]);
  const selectedNonStopRuntime =
    nonStopRuntimeByCategory[roundOpsCategoryKey] && typeof nonStopRuntimeByCategory[roundOpsCategoryKey] === "object"
      ? (nonStopRuntimeByCategory[roundOpsCategoryKey] as Record<string, unknown>)
      : null;
  const selectedAmMxRuntime =
    amMxRuntimeByCategory[roundOpsCategoryKey] && typeof amMxRuntimeByCategory[roundOpsCategoryKey] === "object"
      ? (amMxRuntimeByCategory[roundOpsCategoryKey] as Record<string, unknown>)
      : null;
  const selectedCategoryProfileOwn =
    formatProfilesByCategory[roundOpsCategoryKey] && typeof formatProfilesByCategory[roundOpsCategoryKey] === "object"
      ? (formatProfilesByCategory[roundOpsCategoryKey] as Record<string, unknown>)
      : null;
  const globalCategoryProfile =
    formatProfilesByCategory.global && typeof formatProfilesByCategory.global === "object"
      ? (formatProfilesByCategory.global as Record<string, unknown>)
      : null;
  const selectedCategoryProfile = selectedCategoryProfileOwn ?? globalCategoryProfile;
  const roundOpsCategoryId = roundOpsCategoryKey === "global" ? null : parsePositiveInt(roundOpsCategoryKey);
  const selectedRoundOpsCategoryLink =
    roundOpsCategoryId !== null ? eventCategoriesById.get(roundOpsCategoryId) ?? null : null;
  const roundOpsPlanningStrategy = roundOpsPlanningMode === "capacity" ? "capacity-first" : "runtime-first";
  const selectedRoundOpsCategoryTeams = (() => {
    const teams = resolveCategoryTeamsForPlanning(selectedRoundOpsCategoryLink, roundOpsPlanningStrategy);
    return teams > 0 ? teams : null;
  })();
  const selectedRoundOpsCategoryTeamHint = (() => {
    if (!selectedRoundOpsCategoryLink) return null;
    const confirmed = parsePositiveInt(selectedRoundOpsCategoryLink.confirmedTeams) ?? 0;
    const complete = parsePositiveInt(selectedRoundOpsCategoryLink.completeTeams) ?? 0;
    const active = parsePositiveInt(selectedRoundOpsCategoryLink.activeTeams) ?? 0;
    const pending = parsePositiveInt(selectedRoundOpsCategoryLink.pendingTeams) ?? 0;
    const capacity = parsePositiveInt(selectedRoundOpsCategoryLink.capacityTeams) ?? 0;
    return `Planeamento ${roundOpsPlanningMode === "capacity" ? "por capacidade" : "por equipas reais"} · confirmadas ${confirmed} · completas ${complete} · ativas ${active} · pendentes ${pending} · capacidade ${capacity}`;
  })();
  const roundOpsFormatRaw =
    selectedNonStopRuntime
      ? "NON_STOP"
      : typeof selectedCategoryProfile?.format === "string" && PADEL_FORMAT_KEYS.includes(selectedCategoryProfile.format)
        ? selectedCategoryProfile.format
        : selectedAmMxRuntime && tournamentFormatRaw && PADEL_FORMAT_KEYS.includes(tournamentFormatRaw)
          ? tournamentFormatRaw
          : tournamentFormatRaw && PADEL_FORMAT_KEYS.includes(tournamentFormatRaw)
            ? tournamentFormatRaw
            : DEFAULT_PADEL_FORMAT_FALLBACK;
  const roundOpsFormatValue = parsePadelFormat(roundOpsFormatRaw) ?? DEFAULT_PADEL_FORMAT_FALLBACK;
  const roundOpsFormatLabel = PADEL_FORMAT_LABELS[roundOpsFormatValue] ?? roundOpsFormatValue;
  const roundOpsIsAmMxFormat = AM_MX_FORMAT_SET.has(roundOpsFormatValue);
  const roundOpsIsNonStopFormat = roundOpsFormatValue === "NON_STOP";
  const selectedAmMxMode =
    selectedCategoryProfile?.amMxMode === "FIXED_PAIR" ? "FIXED_PAIR" : "INDIVIDUAL_ROTATION";
  const selectedAmMxProgressionMode = "ROUND_BY_ROUND" as const;
  const selectedNonStopMode =
    selectedNonStopRuntime?.mode === "ACTIVE_QUEUE" || selectedNonStopRuntime?.mode === "HARD_CAP_WAITLIST"
      ? selectedNonStopRuntime.mode
      : selectedCategoryProfile?.nonStopMode === "ACTIVE_QUEUE" ||
          selectedCategoryProfile?.nonStopMode === "HARD_CAP_WAITLIST"
        ? selectedCategoryProfile.nonStopMode
        : "ACTIVE_QUEUE";
  const selectedNonStopRounds =
    parsePositiveInt(selectedCategoryProfile?.nonStopRounds) ??
    parsePositiveInt(selectedCategoryProfile?.roundsHint) ??
    parsePositiveInt(selectedNonStopRuntime?.roundsTotal) ??
    DEFAULT_NON_STOP_ROUNDS;
  const roundOpsHasRuntime = Boolean(selectedNonStopRuntime || selectedAmMxRuntime);
  const roundOpsCategoryLabel = (() => {
    if (roundOpsCategoryKey === "global") return "Global";
    if (!roundOpsCategoryId) return `Categoria ${roundOpsCategoryKey}`;
    return eventCategoryLabelById.get(roundOpsCategoryId) ?? `Categoria #${roundOpsCategoryId}`;
  })();
  const liveOpsMatchesPayload = useMemo(() => {
    if (!liveOpsMatchesRes || typeof liveOpsMatchesRes !== "object") {
      return { ok: false, items: [] as LiveOpsMatchItem[], error: null as string | null };
    }
    const envelopeData =
      liveOpsMatchesRes.data && typeof liveOpsMatchesRes.data === "object" ? liveOpsMatchesRes.data : liveOpsMatchesRes;
    const payload = envelopeData as Record<string, unknown>;
    const items = Array.isArray(payload.items) ? (payload.items as LiveOpsMatchItem[]) : [];
    const ok = liveOpsMatchesRes.ok === true || Array.isArray(payload.items);
    const error =
      typeof liveOpsMatchesRes.error === "string"
        ? liveOpsMatchesRes.error
        : typeof payload.error === "string"
          ? payload.error
          : null;
    return { ok, items, error };
  }, [liveOpsMatchesRes]);
  const liveOpsMatchesError = !liveOpsMatchesPayload.ok
    ? sanitizeUiErrorMessage(liveOpsMatchesPayload.error, "Erro ao carregar incidentes live.")
    : null;
  const liveIncidentItems = useMemo(() => {
    if (!Array.isArray(liveOpsMatchesPayload.items) || liveOpsMatchesPayload.items.length === 0) return [];
    return liveOpsMatchesPayload.items
      .map((match): LiveIncidentItem | null => {
        const statusRaw = typeof match?.status === "string" ? match.status.trim().toUpperCase() : "";
        if (!statusRaw || !LIVE_INCIDENT_STATUSES.has(statusRaw)) return null;
        const categoryId = parsePositiveInt(match?.categoryId);
        const categoryLabel = categoryId ? eventCategoryLabelById.get(categoryId) ?? `Categoria #${categoryId}` : "Sem categoria";
        const categoryProfile =
          categoryId && formatProfilesByCategory[String(categoryId)] && typeof formatProfilesByCategory[String(categoryId)] === "object"
            ? (formatProfilesByCategory[String(categoryId)] as Record<string, unknown>)
            : null;
        const globalProfile =
          formatProfilesByCategory.global && typeof formatProfilesByCategory.global === "object"
            ? (formatProfilesByCategory.global as Record<string, unknown>)
            : null;
        const profileFormatRaw =
          typeof categoryProfile?.format === "string"
            ? categoryProfile.format.trim().toUpperCase()
            : typeof globalProfile?.format === "string"
              ? globalProfile.format.trim().toUpperCase()
              : null;
        const formatKey = eventCategoryFormatById.get(categoryId ?? -1) ?? profileFormatRaw ?? tournamentFormatRaw ?? null;
        const formatLabel = formatKey ? PADEL_FORMAT_LABELS[formatKey] ?? formatKey : "Formato por definir";
        const pairingLabel = `${resolvePairingLabel(match.pairingA)} vs ${resolvePairingLabel(match.pairingB)}`;
        const phaseLabel = [match.groupLabel ? `Grupo ${match.groupLabel}` : null, match.roundLabel || null]
          .filter((value) => typeof value === "string" && value.trim().length > 0)
          .join(" · ") || "Fase";
        const startAt = match.startTime ?? match.plannedStartAt ?? null;
        const startMs = startAt ? new Date(startAt).getTime() : Number.MAX_SAFE_INTEGER;
        const pendingMeta = resolvePendingConfirmationMeta(match.score);
        const streamMeta = resolveMatchStreamMeta(match);
        const elapsedSeconds =
          typeof match.elapsedSeconds === "number" && Number.isFinite(match.elapsedSeconds) && match.elapsedSeconds >= 0
            ? Math.floor(match.elapsedSeconds)
            : statusRaw === "IN_PROGRESS" && Number.isFinite(startMs) && startMs > 0
              ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
              : null;
        return {
          matchId: match.id,
          status: statusRaw,
          categoryId: categoryId ?? null,
          categoryLabel,
          formatKey: formatKey ?? null,
          formatLabel,
          pairingLabel,
          phaseLabel,
          startAt,
          startMs: Number.isFinite(startMs) ? startMs : Number.MAX_SAFE_INTEGER,
          priority: incidentPriority(statusRaw),
          pendingConfirmationExpiresAt: pendingMeta.expiresAt,
          pendingConfirmationRemainingMs: pendingMeta.remainingMs,
          elapsedSeconds,
          streamIsLive: streamMeta.isLive,
          streamUrl: streamMeta.url,
        };
      })
      .filter((item): item is LiveIncidentItem => Boolean(item))
      .sort((a, b) => a.priority - b.priority || a.startMs - b.startMs || a.matchId - b.matchId);
  }, [eventCategoryFormatById, eventCategoryLabelById, formatProfilesByCategory, liveOpsMatchesPayload.items, tournamentFormatRaw]);
  const liveIncidentCategoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    liveIncidentItems.forEach((item) => {
      if (!item.categoryId || map.has(item.categoryId)) return;
      map.set(item.categoryId, item.categoryLabel);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));
  }, [liveIncidentItems]);
  const liveIncidentFormatOptions = useMemo(() => {
    const map = new Map<string, string>();
    liveIncidentItems.forEach((item) => {
      if (!item.formatKey || map.has(item.formatKey)) return;
      map.set(item.formatKey, item.formatLabel);
    });
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));
  }, [liveIncidentItems]);
  const filteredLiveIncidentItems = useMemo(() => {
    return liveIncidentItems.filter((item) => {
      if (incidentStatusFilter !== "ALL" && item.status !== incidentStatusFilter) return false;
      if (incidentCategoryFilter !== "ALL") {
        const parsed = parsePositiveInt(incidentCategoryFilter);
        if (!parsed || parsed !== item.categoryId) return false;
      }
      if (incidentFormatFilter !== "ALL" && incidentFormatFilter !== item.formatKey) return false;
      return true;
    });
  }, [incidentCategoryFilter, incidentFormatFilter, incidentStatusFilter, liveIncidentItems]);
  const nonStopActivePairs = useMemo(() => {
    if (!selectedNonStopRuntime || !Array.isArray(selectedNonStopRuntime.activePairs)) return [];
    return selectedNonStopRuntime.activePairs
      .map((entry, idx) => {
        if (!Array.isArray(entry)) return null;
        const sideA = parsePositiveInt(entry[0]);
        const sideB = parsePositiveInt(entry[1]);
        return {
          court: idx + 1,
          sideA,
          sideB,
        };
      })
      .filter((entry): entry is { court: number; sideA: number | null; sideB: number | null } => Boolean(entry));
  }, [selectedNonStopRuntime]);
  const nonStopQueuePairingIds = useMemo(
    () => mapNumberArray(selectedNonStopRuntime?.queue),
    [selectedNonStopRuntime],
  );
  const nonStopRoundCurrent = parsePositiveInt(selectedNonStopRuntime?.round);
  const nonStopRoundTotal = parsePositiveInt(selectedNonStopRuntime?.roundsTotal);
  const amMxRoundCurrent = parsePositiveInt(selectedAmMxRuntime?.roundsGenerated);
  const amMxRoundTotal = parsePositiveInt(selectedAmMxRuntime?.roundsTotal);
  const roundOpsRoundLabel =
    nonStopRoundCurrent !== null
      ? `${nonStopRoundCurrent}${nonStopRoundTotal ? ` / ${nonStopRoundTotal}` : ""}`
      : amMxRoundCurrent !== null
        ? `${amMxRoundCurrent}${amMxRoundTotal ? ` / ${amMxRoundTotal}` : ""}`
        : "—";
  const formatRuntimeCategoryLabel = (key: string) => {
    if (key === "global") return "Global";
    const categoryId = parsePositiveInt(key);
    if (!categoryId) return `Categoria ${key}`;
    return eventCategoryLabelById.get(categoryId) ?? `Categoria #${categoryId}`;
  };
  const roundOpsProfileSourceLabel =
    roundOpsCategoryKey === "global"
      ? "Perfil global"
      : selectedCategoryProfileOwn
        ? "Perfil da categoria"
        : globalCategoryProfile
          ? "A usar fallback global"
        : null;

  useEffect(() => {
    if (runtimeCategoryKeys.length === 0) {
      setRoundOpsCategoryKey((prev) => (prev === "global" ? prev : "global"));
      return;
    }
    if (!runtimeCategoryKeys.includes(roundOpsCategoryKey)) {
      const fallbackKey = runtimeCategoryKeys[0] ?? "global";
      setRoundOpsCategoryKey((prev) => (prev === fallbackKey ? prev : fallbackKey));
    }
  }, [roundOpsCategoryKey, runtimeCategoryKeys]);

  useEffect(() => {
    setRoundOpsMessage(null);
    setRoundOpsWarning(null);
    setRoundOpsError(null);
  }, [eventId, roundOpsCategoryKey]);

  useEffect(() => {
    setOpsLiveFeed((prev) => (prev.length === 0 ? prev : []));
  }, [eventId]);

  useEffect(() => {
    setIncidentStatusFilter("ALL");
    setIncidentCategoryFilter("ALL");
    setIncidentFormatFilter("ALL");
    setIncidentActionBusyKey(null);
    setIncidentActionMessage(null);
    setIncidentActionError(null);
  }, [eventId]);

  useEffect(() => {
    const next = String(selectedNonStopRounds);
    setRoundOpsNonStopRoundsDraft((prev) => (prev === next ? prev : next));
  }, [selectedNonStopRounds]);

  useEffect(() => {
    const parseDate = (value: string | Date | null | undefined) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const windowStartDate = parseDate(autoScheduleForm.start) ?? parseDate(calendarEventStart);
    const windowEndDate = parseDate(autoScheduleForm.end) ?? parseDate(calendarEventEnd);
    const duration = Number(autoScheduleForm.duration);
    const buffer = Number(autoScheduleForm.buffer);
    const durationMinutes = Number.isFinite(duration) && duration > 0 ? duration : 60;
    const bufferMinutes = Number.isFinite(buffer) && buffer >= 0 ? buffer : calendarBuffer;
    const effectiveCourtIds =
      autoScheduleCourtIds.length > 0 ? autoScheduleCourtIds : autoScheduleCourtOptions.map((court) => court.id);
    const selectedCourtSet = new Set(effectiveCourtIds);
    const orderedPriorities = autoScheduleCourtPriorityOrder.filter((courtId) => selectedCourtSet.has(courtId));
    const normalizedPriorityOrder = [
      ...orderedPriorities,
      ...effectiveCourtIds.filter((courtId) => !orderedPriorities.includes(courtId)),
    ];

    if (
      !eventId ||
      !windowStartDate ||
      !windowEndDate ||
      windowEndDate <= windowStartDate ||
      effectiveCourtIds.length === 0
    ) {
      setAutoSchedulePlan(null);
      setAutoSchedulePlanError(null);
      setAutoSchedulePlanLoading(false);
      return;
    }

    const categoriesPayload = eventCategories
      .filter((link) => link.isEnabled !== false)
      .map((link) => {
        const categoryId =
          typeof link.padelCategoryId === "number"
            ? link.padelCategoryId
            : typeof link.category?.id === "number"
              ? link.category.id
              : null;
        const teams = resolveCategoryTeamsForPlanning(link, "capacity-first");
        if (!categoryId || teams <= 0) return null;
        return {
          categoryId,
          label: link.category?.label ?? `Categoria #${categoryId}`,
          teams,
          format: typeof link.format === "string" ? link.format : tournamentFormatRaw ?? undefined,
        };
      })
      .filter(
        (entry): entry is { categoryId: number; label: string; teams: number; format: string | undefined } =>
          Boolean(entry),
      );
    const confirmedPairingsRaw = Number(opsSummaryRes?.summary?.confirmedCount ?? 0);
    const confirmedPairings = Number.isFinite(confirmedPairingsRaw) && confirmedPairingsRaw > 0
      ? Math.floor(confirmedPairingsRaw)
      : null;

    const payload: Record<string, unknown> = {
      eventId,
      windowStart: windowStartDate.toISOString(),
      windowEnd: windowEndDate.toISOString(),
      durationMinutes,
      bufferMinutes,
      courtIds: effectiveCourtIds,
      courtPriorityOrder: normalizedPriorityOrder,
    };
    if (categoriesPayload.length > 0) {
      payload.categories = categoriesPayload;
    } else if (confirmedPairings) {
      payload.teams = confirmedPairings;
      payload.format = tournamentFormatRaw ?? undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAutoSchedulePlanLoading(true);
      setAutoSchedulePlanError(null);
      try {
        const res = await fetch("/api/padel/formats/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          if (!controller.signal.aborted) {
            setAutoSchedulePlan(null);
            setAutoSchedulePlanError(sanitizeUiErrorMessage(json?.error, "Planner de capacidade indisponível."));
          }
          return;
        }
        const plan = json?.plan;
        if (!controller.signal.aborted) {
          setAutoSchedulePlan(plan && typeof plan === "object" ? (plan as PadelFormatPlanResult) : null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setAutoSchedulePlan(null);
        setAutoSchedulePlanError("Erro ao calcular capacidade por formato.");
      } finally {
        if (!controller.signal.aborted) setAutoSchedulePlanLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    autoScheduleCourtIds,
    autoScheduleCourtOptions,
    autoScheduleCourtPriorityOrder,
    autoScheduleForm.buffer,
    autoScheduleForm.duration,
    autoScheduleForm.end,
    autoScheduleForm.start,
    calendarBuffer,
    calendarEventEnd,
    calendarEventStart,
    eventCategories,
    eventId,
    opsSummaryRes?.summary?.confirmedCount,
    tournamentFormatRaw,
  ]);

  useEffect(() => {
    const parseDate = (value: string | Date | null | undefined) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const windowStartDate = parseDate(autoScheduleForm.start) ?? parseDate(calendarEventStart);
    const windowEndDate = parseDate(autoScheduleForm.end) ?? parseDate(calendarEventEnd);
    const duration = Number(autoScheduleForm.duration);
    const buffer = Number(autoScheduleForm.buffer);
    const durationMinutes = Number.isFinite(duration) && duration > 0 ? duration : 60;
    const bufferMinutes = Number.isFinite(buffer) && buffer >= 0 ? buffer : calendarBuffer;
    const effectiveCourtIds =
      autoScheduleCourtIds.length > 0 ? autoScheduleCourtIds : autoScheduleCourtOptions.map((court) => court.id);
    const selectedCourtSet = new Set(effectiveCourtIds);
    const orderedPriorities = autoScheduleCourtPriorityOrder.filter((courtId) => selectedCourtSet.has(courtId));
    const normalizedPriorityOrder = [
      ...orderedPriorities,
      ...effectiveCourtIds.filter((courtId) => !orderedPriorities.includes(courtId)),
    ];

    if (
      !eventId ||
      !windowStartDate ||
      !windowEndDate ||
      windowEndDate <= windowStartDate ||
      effectiveCourtIds.length === 0
    ) {
      setRoundOpsPlan(null);
      setRoundOpsPlanError(null);
      setRoundOpsPlanLoading(false);
      return;
    }

    const confirmedPairingsRaw = Number(opsSummaryRes?.summary?.confirmedCount ?? 0);
    const confirmedPairings = Number.isFinite(confirmedPairingsRaw) && confirmedPairingsRaw > 0
      ? Math.floor(confirmedPairingsRaw)
      : null;
    const categoriesPayload =
      roundOpsCategoryId !== null
        ? (() => {
            if (!selectedRoundOpsCategoryLink) return [];
            const teams = selectedRoundOpsCategoryTeams ?? confirmedPairings ?? 0;
            if (teams <= 0) return [];
            return [
              {
                categoryId: roundOpsCategoryId,
                label: selectedRoundOpsCategoryLink.category?.label ?? `Categoria #${roundOpsCategoryId}`,
                teams,
                format: roundOpsFormatValue,
                amMxMode: roundOpsIsAmMxFormat ? selectedAmMxMode : undefined,
                amMxProgressionMode: roundOpsIsAmMxFormat ? selectedAmMxProgressionMode : undefined,
                nonStopMode: roundOpsIsNonStopFormat ? selectedNonStopMode : undefined,
                nonStopRounds: roundOpsIsNonStopFormat ? selectedNonStopRounds : undefined,
              },
            ];
          })()
        : eventCategories
            .filter((link) => link.isEnabled !== false)
            .map((link) => {
              const categoryId =
                typeof link.padelCategoryId === "number"
                  ? link.padelCategoryId
                  : typeof link.category?.id === "number"
                    ? link.category.id
                    : null;
              const teams = resolveCategoryTeamsForPlanning(link, roundOpsPlanningStrategy);
              if (!categoryId || teams <= 0) return null;
              const categoryKey = String(categoryId);
              const profile =
                formatProfilesByCategory[categoryKey] ?? formatProfilesByCategory.global ?? null;
              const formatRaw =
                typeof profile?.format === "string" && PADEL_FORMAT_KEYS.includes(profile.format)
                  ? profile.format
                  : typeof link.format === "string" && PADEL_FORMAT_KEYS.includes(link.format)
                    ? link.format
                    : roundOpsFormatValue;
              const amMxMode =
                profile?.amMxMode === "FIXED_PAIR" || profile?.amMxMode === "INDIVIDUAL_ROTATION"
                  ? profile.amMxMode
                  : undefined;
              const amMxProgressionMode = profile?.amMxProgressionMode === "ROUND_BY_ROUND" ? "ROUND_BY_ROUND" : undefined;
              const nonStopMode =
                profile?.nonStopMode === "ACTIVE_QUEUE" || profile?.nonStopMode === "HARD_CAP_WAITLIST"
                  ? profile.nonStopMode
                  : undefined;
              const nonStopRoundsRaw = parsePositiveInt(profile?.nonStopRounds) ?? parsePositiveInt(profile?.roundsHint);
              return {
                categoryId,
                label: link.category?.label ?? `Categoria #${categoryId}`,
                teams,
                format: formatRaw,
                amMxMode,
                amMxProgressionMode,
                nonStopMode,
                nonStopRounds: nonStopRoundsRaw ?? undefined,
              };
      })
      .filter((entry): entry is PadelFormatPlanCategoryPayload => Boolean(entry));

    if (roundOpsCategoryId !== null && categoriesPayload.length === 0) {
      setRoundOpsPlan(null);
      setRoundOpsPlanError("Define lotação da categoria para calcular viabilidade desta ronda.");
      setRoundOpsPlanLoading(false);
      return;
    }

    const payload: Record<string, unknown> = {
      eventId,
      windowStart: windowStartDate.toISOString(),
      windowEnd: windowEndDate.toISOString(),
      durationMinutes,
      bufferMinutes,
      courtIds: effectiveCourtIds,
      courtPriorityOrder: normalizedPriorityOrder,
    };
    if (categoriesPayload.length > 0) {
      payload.categories = categoriesPayload;
    } else if (confirmedPairings) {
      payload.teams = confirmedPairings;
      payload.format = roundOpsFormatValue;
      if (roundOpsIsAmMxFormat) {
        payload.amMxMode = selectedAmMxMode;
        payload.amMxProgressionMode = selectedAmMxProgressionMode;
      }
      if (roundOpsIsNonStopFormat) {
        payload.nonStopMode = selectedNonStopMode;
        payload.nonStopRounds = selectedNonStopRounds;
      }
    } else {
      setRoundOpsPlan(null);
      setRoundOpsPlanError("Sem equipas suficientes para simular capacidade por formato.");
      setRoundOpsPlanLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setRoundOpsPlanLoading(true);
      setRoundOpsPlanError(null);
      try {
        const res = await fetch("/api/padel/formats/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          if (!controller.signal.aborted) {
            setRoundOpsPlan(null);
            setRoundOpsPlanError(sanitizeUiErrorMessage(json?.error, "Planner operacional indisponível."));
          }
          return;
        }
        const plan = json?.plan;
        if (!controller.signal.aborted) {
          setRoundOpsPlan(plan && typeof plan === "object" ? (plan as PadelFormatPlanResult) : null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setRoundOpsPlan(null);
        setRoundOpsPlanError("Erro ao calcular viabilidade operacional da ronda.");
      } finally {
        if (!controller.signal.aborted) setRoundOpsPlanLoading(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    autoScheduleCourtIds,
    autoScheduleCourtOptions,
    autoScheduleCourtPriorityOrder,
    autoScheduleForm.buffer,
    autoScheduleForm.duration,
    autoScheduleForm.end,
    autoScheduleForm.start,
    calendarBuffer,
    calendarEventEnd,
    calendarEventStart,
    eventCategories,
    eventId,
    formatProfilesByCategory,
    opsSummaryRes?.summary?.confirmedCount,
    roundOpsCategoryId,
    roundOpsFormatValue,
    roundOpsIsAmMxFormat,
    roundOpsIsNonStopFormat,
    roundOpsPlanningStrategy,
    selectedAmMxMode,
    selectedAmMxProgressionMode,
    selectedNonStopMode,
    selectedNonStopRounds,
    selectedRoundOpsCategoryLink,
    selectedRoundOpsCategoryTeams,
  ]);

  const roundOpsPlanCategory = useMemo(() => {
    if (!roundOpsPlan || !Array.isArray(roundOpsPlan.categories) || roundOpsPlan.categories.length === 0) return null;
    if (roundOpsCategoryId === null) return null;
    return (
      roundOpsPlan.categories.find((entry) => entry.categoryId === roundOpsCategoryId || entry.key === String(roundOpsCategoryId)) ??
      roundOpsPlan.categories[0]
    );
  }, [roundOpsCategoryId, roundOpsPlan]);

  const roundOpsPlanAlternatives = useMemo(() => {
    if (!roundOpsPlan || !Array.isArray(roundOpsPlan.alternatives)) return [];
    return roundOpsPlan.alternatives
      .map((item) => item?.summary)
      .filter((summary): summary is string => typeof summary === "string" && summary.trim().length > 0);
  }, [roundOpsPlan]);

  const roundOpsPlanWarnings = useMemo(() => {
    const warnings = new Set<string>();
    if (roundOpsPlan && Array.isArray(roundOpsPlan.warnings)) {
      roundOpsPlan.warnings
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .forEach((entry) => warnings.add(entry));
    }
    if (roundOpsPlanCategory && Array.isArray(roundOpsPlanCategory.warnings)) {
      roundOpsPlanCategory.warnings
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .forEach((entry) => warnings.add(entry));
    }
    return Array.from(warnings);
  }, [roundOpsPlan, roundOpsPlanCategory]);

  const autoScheduleCapacity = useMemo(() => {
    if (!autoSchedulePlan) return null;
    return {
      totalSlots: autoSchedulePlan.totalSlots,
      matchesNeeded: autoSchedulePlan.matchesNeeded,
      courts: autoSchedulePlan.courtsUsed,
      unscheduledMatches: autoSchedulePlan.unscheduledMatches,
    };
  }, [autoSchedulePlan]);

  const autoSchedulePlanAlternatives = useMemo(() => {
    if (!autoSchedulePlan || !Array.isArray(autoSchedulePlan.alternatives)) return [];
    return autoSchedulePlan.alternatives
      .map((item) => item?.summary)
      .filter((summary): summary is string => typeof summary === "string" && summary.trim().length > 0);
  }, [autoSchedulePlan]);

  const autoSchedulePlanBlocking = useMemo(() => {
    if (!autoSchedulePlan || !Array.isArray(autoSchedulePlan.blockingReasons)) return [];
    return autoSchedulePlan.blockingReasons;
  }, [autoSchedulePlan]);

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

  useEffect(() => {
    setLastAutoScheduleRunId(null);
    setEditingMatchId(null);
    setEditingMatchVersion(null);
    setSelectedMatchIds((prev) => (prev.length === 0 ? prev : []));
    setMatchForm((prev) =>
      prev.start === "" && prev.end === "" && prev.courtId === "" ? prev : { start: "", end: "", courtId: "" },
    );
  }, [eventId]);

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

  const showOnlyTournamentGames = calendarDataView === "games";
  const calendarOperationalBlocksRaw = useMemo<CalendarBlock[]>(() => {
    if (calendarOccupancyItemsRaw.length > 0) {
      return calendarOccupancyItemsRaw
        .filter((item) => item.type !== "MATCH" && item.type !== "HARD_BLOCK")
        .map((item) => ({
          id: Number(item.sourceId) || 0,
          startAt: item.startsAt,
          endAt: item.endsAt,
          courtId: item.courtId ?? null,
          label:
            item.label ??
            (item.type === "CLASS_SESSION"
              ? "Aula"
              : item.type === "BOOKING"
                ? "Reserva"
                : item.type === "SOFT_BLOCK"
                  ? "Bloqueio suave"
                  : "Ocupação"),
          note: item.isBlocking ? "Bloqueante" : "Informativo",
          kind: item.type,
        }));
    }

    const fromClasses = calendarClassSessionsRaw.map((session) => ({
      id: Number(`9${session.id}`),
      startAt: session.startsAt,
      endAt: session.endsAt,
      courtId: session.courtId ?? null,
      label: `Aula #${session.id}`,
      note: null,
      kind: "CLASS_SESSION",
    }));
    const fromBookings = calendarBookingsRaw.map((booking) => ({
      id: Number(`8${booking.id}`),
      startAt: booking.startsAt,
      endAt: booking.endsAt,
      courtId: booking.courtId ?? null,
      label: `Reserva #${booking.id}`,
      note: booking.status ?? null,
      kind: "BOOKING",
    }));
    return [...fromClasses, ...fromBookings];
  }, [calendarBookingsRaw, calendarClassSessionsRaw, calendarOccupancyItemsRaw]);
  const calendarOccupancyLegend = useMemo<CalendarOccupancyLegendItem[]>(() => {
    const fallback: CalendarOccupancyLegendItem[] = [
      {
        type: "HARD_BLOCK",
        priority: 5,
        isBlocking: true,
        label: "Bloqueio duro",
        description: "Interdição operacional do campo.",
      },
      {
        type: "CLASS_SESSION",
        priority: 4,
        isBlocking: true,
        label: "Aula",
        description: "Sessão de aula confirmada no campo.",
      },
      {
        type: "MATCH",
        priority: 3,
        isBlocking: true,
        label: "Jogo",
        description: "Jogo de torneio agendado.",
      },
      {
        type: "BOOKING",
        priority: 2,
        isBlocking: true,
        label: "Reserva",
        description: "Reserva ativa no campo.",
      },
      {
        type: "SOFT_BLOCK",
        priority: 1,
        isBlocking: false,
        label: "Bloqueio suave",
        description: "Aviso operacional; não bloqueia por si só.",
      },
    ];
    const source = calendarOccupancyLegendRaw.length > 0 ? calendarOccupancyLegendRaw : fallback;
    return [...source].sort((a, b) => b.priority - a.priority);
  }, [calendarOccupancyLegendRaw]);
  const calendarBlocksForOps =
    showOnlyTournamentGames
      ? []
      : calendarScope === "day" || calendarScope === "week"
        ? calendarBlocksRaw.filter((b) => isWithinRange(b.startAt))
        : calendarBlocksRaw;
  const calendarVisualBlocks =
    showOnlyTournamentGames
      ? []
      : [...calendarBlocksForOps, ...calendarOperationalBlocksRaw];
  const calendarAvailabilities =
    showOnlyTournamentGames
      ? []
      : calendarScope === "day" || calendarScope === "week"
        ? calendarAvailabilitiesRaw.filter((b) => isWithinRange(b.startAt))
        : calendarAvailabilitiesRaw;
  const matchStartsWithinDay = (m: CalendarMatch) => {
    const start = m.startTime || m.plannedStartAt;
    if (!start) return false;
    return isWithinRange(start);
  };
  const matchMatchesCategory = (match: CalendarMatch) => {
    if (!roundOpsCategoryId) return true;
    const categoryId = parsePositiveInt(match.categoryId);
    return categoryId === roundOpsCategoryId;
  };
  const calendarMatchesByCategory = calendarMatchesRaw.filter((match) => matchMatchesCategory(match));
  const calendarMatches =
    calendarScope === "day" || calendarScope === "week"
      ? calendarMatchesByCategory.filter((m) => matchStartsWithinDay(m))
      : calendarMatchesByCategory;
  useEffect(() => {
    setSelectedMatchIds((prev) => {
      if (prev.length === 0) return prev;
      const visibleIds = new Set(calendarMatches.map((match) => match.id));
      const next = prev.filter((matchId) => visibleIds.has(matchId));
      return next.length === prev.length ? prev : next;
    });
  }, [calendarMatches]);
  const v2UnscheduledRows = useMemo(
    () =>
      Object.entries(autoScheduleUnscheduledByReason).map(([label, value]) => ({
        label: label.toLowerCase().replace(/_/g, " "),
        value,
      })),
    [autoScheduleUnscheduledByReason],
  );
  const v2Warnings = useMemo(() => {
    const items: string[] = [];
    if (calendarWarning) items.push(calendarWarning);
    if (calendarError) items.push(calendarError);
    return items;
  }, [calendarError, calendarWarning]);
  const latestAutoScheduleRun = useMemo(() => {
    if (!autoScheduleRunRes?.ok || !autoScheduleRunRes.run) return null;
    const run = autoScheduleRunRes.run;
    const byCategoryRaw = Array.isArray(run.byCategory) ? run.byCategory : [];
    const byCategory = byCategoryRaw
      .map((row) => ({
        categoryId: row.categoryId ?? null,
        categoryLabel:
          row.categoryId === null
            ? "global"
            : eventCategoryLabelById.get(Number(row.categoryId)) || `#${row.categoryId}`,
        scheduledCount: Number(row.scheduledCount ?? 0),
        skippedCount: Number(row.skippedCount ?? 0),
      }))
      .slice(0, 8);
    return {
      id: run.id,
      status: run.status || "DONE",
      scheduledCount: Number(run.scheduledCount ?? 0),
      skippedCount: Number(run.skippedCount ?? 0),
      applied: run.applied === true,
      queued: run.queued === true,
      errorCode: run.errorCode ?? null,
      byCategory,
    };
  }, [autoScheduleRunRes, eventCategoryLabelById]);
  const calendarExportLinks = [
    {
      key: "pdf" as const,
      label: "PDF",
      href: eventId ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "pdf" }) || "#" : "#",
      external: false,
    },
    {
      key: "html" as const,
      label: "HTML",
      href: eventId ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "html" }) || "#" : "#",
      external: true,
    },
    {
      key: "csv" as const,
      label: "CSV",
      href: eventId ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "csv" }) || "#" : "#",
      external: false,
    },
    {
      key: "ics" as const,
      label: "ICS",
      href: eventId ? buildOrgApiPath("/padel/exports/calendario", { eventId, format: "ics" }) || "#" : "#",
      external: false,
    },
  ];

  const resetCalendarForms = () => {
    setBlockForm({ start: "", end: "", label: "", note: "" });
    setAvailabilityForm({ start: "", end: "", playerName: "", playerEmail: "", note: "" });
    setEditingBlockId(null);
    setEditingAvailabilityId(null);
    setEditingBlockVersion(null);
    setEditingAvailabilityVersion(null);
    setCalendarMessage(null);
  };

  const resetMatchScheduleForm = () => {
    setEditingMatchId(null);
    setEditingMatchVersion(null);
    setMatchForm({ start: "", end: "", courtId: "" });
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
        setCalendarError(sanitizeUiErrorMessage(json?.error, "Não foi possível guardar."));
      } else {
        const prev =
          type === "block"
            ? calendarBlocksForOps.find((block) => block.id === editingId)
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
    setEditingMatchId(null);
    setEditingMatchVersion(null);
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
    setEditingMatchId(null);
    setEditingMatchVersion(null);
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

  const resolveCalendarMatchWindow = (match: CalendarMatch) => {
    const start = match.plannedStartAt || match.startTime || null;
    const end =
      match.plannedEndAt ||
      (start && match.plannedDurationMinutes
        ? new Date(new Date(start).getTime() + Number(match.plannedDurationMinutes) * 60_000)
        : null);
    return { start, end };
  };

  const resolveCalendarMatchDurationMinutes = (match: CalendarMatch) => {
    const { start, end } = resolveCalendarMatchWindow(match);
    if (start && end) {
      const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
      if (Number.isFinite(diff) && diff > 0) return diff;
    }
    const fallback = Number(match.plannedDurationMinutes ?? 60);
    return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback) : 60;
  };

  const resolveBlockedByTypeLabel = (blockedByType: string | null) => {
    const normalized = typeof blockedByType === "string" ? blockedByType.trim().toUpperCase() : "";
    if (normalized === "CLASS_SESSION") return "aula";
    if (normalized === "BOOKING") return "reserva";
    if (normalized === "HARD_BLOCK") return "bloqueio rígido";
    if (normalized === "MATCH") return "outro jogo";
    if (normalized === "SOFT_BLOCK") return "bloqueio suave";
    return "ocupação";
  };

  const resolveBlockedByTypeErrorMessage = (params: {
    blockedByType: string | null;
    blockedBySourceId?: string | null;
    prefix: string;
  }) => {
    const label = resolveBlockedByTypeLabel(params.blockedByType);
    const sourceSuffix =
      typeof params.blockedBySourceId === "string" && params.blockedBySourceId.trim().length > 0
        ? ` (#${params.blockedBySourceId.trim()})`
        : "";
    return `${params.prefix} conflito com ${label}${sourceSuffix}.`;
  };

  const resolveCalendarPreflightConflict = (params: {
    matchId: number;
    courtId: number;
    startIso: string;
    endIso: string;
  }) => {
    const start = new Date(params.startIso);
    const end = new Date(params.endIso);
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

    const bufferMinutes = Number.isFinite(Number(calendarBuffer)) ? Math.max(0, Number(calendarBuffer)) : 0;
    const bufferMs = bufferMinutes * 60_000;
    const candidateStartBuffered = startMs - bufferMs;
    const candidateEndBuffered = endMs + bufferMs;

    const fallbackMatches: CalendarOccupancyItem[] = [];
    calendarMatchesRaw.forEach((match) => {
      const { start: matchStart, end: matchEnd } = resolveCalendarMatchWindow(match);
      if (!matchStart || !matchEnd) return;
      fallbackMatches.push({
        type: "MATCH",
        sourceId: String(match.id),
        courtId: match.courtId ?? null,
        startsAt: matchStart,
        endsAt: matchEnd,
        priority: 3,
        isBlocking: true,
        label: match.roundLabel ?? match.groupLabel ?? `Jogo #${match.id}`,
      });
    });

    const fallbackOccupancy: CalendarOccupancyItem[] = [
      ...calendarBlocksRaw.map((block) => ({
        type: "HARD_BLOCK" as const,
        sourceId: String(block.id),
        courtId: block.courtId ?? null,
        startsAt: block.startAt,
        endsAt: block.endAt,
        priority: 5,
        isBlocking: true,
        label: block.label ?? "Bloqueio",
      })),
      ...calendarClassSessionsRaw.map((session) => ({
        type: "CLASS_SESSION" as const,
        sourceId: String(session.id),
        courtId: session.courtId ?? null,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        priority: 4,
        isBlocking: true,
        label: `Aula #${session.id}`,
      })),
      ...fallbackMatches,
      ...calendarBookingsRaw.map((booking) => ({
        type: "BOOKING" as const,
        sourceId: String(booking.id),
        courtId: booking.courtId ?? null,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        priority: 2,
        isBlocking: true,
        label: `Reserva #${booking.id}`,
      })),
    ];

    const occupancy = calendarOccupancyItemsRaw.length > 0 ? calendarOccupancyItemsRaw : fallbackOccupancy;
    const conflicts = occupancy
      .filter((item) => item.isBlocking !== false)
      .filter((item) => item.courtId === null || item.courtId === params.courtId)
      .filter((item) => {
        if (item.type !== "MATCH") return true;
        const id = Number(item.sourceId);
        return !(Number.isFinite(id) && id === params.matchId);
      })
      .map((item) => {
        const itemStart = new Date(item.startsAt).getTime();
        const itemEnd = new Date(item.endsAt).getTime();
        if (!Number.isFinite(itemStart) || !Number.isFinite(itemEnd)) return null;
        const overlap = candidateStartBuffered < itemEnd && itemStart < candidateEndBuffered;
        if (!overlap) return null;
        return {
          ...item,
          _startMs: itemStart,
        };
      })
      .filter((item): item is (CalendarOccupancyItem & { _startMs: number }) => Boolean(item))
      .sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        if (a._startMs !== b._startMs) return a._startMs - b._startMs;
        return a.sourceId.localeCompare(b.sourceId);
      });

    if (conflicts.length === 0) return null;
    const primary = conflicts[0];
    return {
      blockedByType: primary.type,
      blockedBySourceId: primary.sourceId,
      message: resolveBlockedByTypeErrorMessage({
        blockedByType: primary.type,
        blockedBySourceId: primary.sourceId,
        prefix: "Reagendamento bloqueado:",
      }),
      label: primary.label ?? null,
    };
  };

  const handleEditMatch = (match: CalendarMatch) => {
    const { start, end } = resolveCalendarMatchWindow(match);
    if (!start || !end) {
      setCalendarError("O jogo não tem janela válida para editar.");
      return;
    }
    setEditingBlockId(null);
    setEditingAvailabilityId(null);
    setEditingMatchId(match.id);
    setEditingMatchVersion(match.updatedAt || null);
    setMatchForm({
      start: formatDateTimeLocal(start),
      end: formatDateTimeLocal(end),
      courtId: match.courtId ? String(match.courtId) : "",
    });
  };

  const applyCalendarWarning = (warning: any) => {
    const message = typeof warning?.message === "string" ? warning.message : null;
    if (!message) return;
    setCalendarWarning(message);
    toast(message, "warn");
  };

  const patchCalendarMatchSchedule = async (params: {
    matchId: number;
    startIso: string;
    endIso: string;
    durationMinutes: number;
    courtId: number;
    version?: string | Date | null;
  }) => {
    const version =
      typeof params.version === "string"
        ? params.version
        : params.version instanceof Date
          ? params.version.toISOString()
          : undefined;
    const res = await fetch("/api/padel/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "match",
        id: params.matchId,
        startAt: params.startIso,
        endAt: params.endIso,
        plannedDurationMinutes: params.durationMinutes,
        courtId: params.courtId,
        ...(version ? { version } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) {
      const errorCode = typeof json?.error === "string" ? json.error : "UPDATE_FAILED";
      const blockedByTypeRaw =
        typeof json?.details?.blockedByType === "string" ? json.details.blockedByType.trim().toUpperCase() : null;
      const blockedBySourceId =
        typeof json?.details?.blockedBySourceId === "string" ? json.details.blockedBySourceId : null;
      const isAgendaConflict = errorCode === "AGENDA_CONFLICT";
      return {
        ok: false as const,
        errorCode:
          isAgendaConflict && blockedByTypeRaw
            ? `${blockedByTypeRaw}_CONFLICT`
            : errorCode,
        blockedByType: blockedByTypeRaw,
        blockedBySourceId,
        errorMessage:
          isAgendaConflict && blockedByTypeRaw
            ? resolveBlockedByTypeErrorMessage({
                blockedByType: blockedByTypeRaw,
                blockedBySourceId,
                prefix: "Atualização rejeitada:",
              })
            : sanitizeUiErrorMessage(json?.error, "Não foi possível atualizar o jogo."),
      };
    }
    return {
      ok: true as const,
      warningMessage: typeof json?.warning?.message === "string" ? json.warning.message : null,
    };
  };

  const quickRescheduleCalendarMatch = async (params: {
    matchId: number;
    targetCourtId: number;
    targetStartIso: string;
    targetEndIso: string;
    durationMinutes: number;
    origin: "DRAG_SLOT" | "DRAG_COURT" | "BULK";
  }): Promise<boolean> => {
    if (!eventId || !Number.isFinite(params.matchId) || !Number.isFinite(params.targetCourtId)) return false;
    if (savingCalendar) return false;

    const match = calendarMatchesRaw.find((item) => item.id === params.matchId);
    if (!match) return false;
    const startDate = new Date(params.targetStartIso);
    const endDate = new Date(params.targetEndIso);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
      setCalendarError("Janela inválida para reagendar o jogo.");
      return false;
    }

    const preflightConflict = resolveCalendarPreflightConflict({
      matchId: params.matchId,
      courtId: params.targetCourtId,
      startIso: params.targetStartIso,
      endIso: params.targetEndIso,
    });
    if (preflightConflict) {
      setCalendarWarning(preflightConflict.message);
      setCalendarError(preflightConflict.message);
      toast(preflightConflict.message, "warn");
      pushOpsLive("warn", "Conflito de agenda", preflightConflict.message);
      return false;
    }

    setSavingCalendar(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const result = await patchCalendarMatchSchedule({
        matchId: params.matchId,
        startIso: params.targetStartIso,
        endIso: params.targetEndIso,
        durationMinutes: params.durationMinutes,
        courtId: params.targetCourtId,
        version: match.updatedAt ?? null,
      });
      if (!result.ok) {
        setCalendarError(result.errorMessage);
        toast(result.errorMessage, result.errorCode.endsWith("_CONFLICT") ? "warn" : "err");
        pushOpsLive("warn", "Reagendamento rejeitado", result.errorMessage);
        return false;
      }

      const startLabel = formatZoned(params.targetStartIso, calendarTimezone);
      const endLabel = formatZoned(params.targetEndIso, calendarTimezone);
      const message = `Jogo #${params.matchId} reagendado: campo ${params.targetCourtId} · ${startLabel} → ${endLabel}.`;

      if (result.warningMessage) {
        setCalendarWarning(result.warningMessage);
        toast(result.warningMessage, "warn");
      } else {
        setCalendarMessage(message);
        toast("Jogo reagendado", "ok");
      }
      pushOpsLive(
        params.origin === "DRAG_SLOT" ? "ok" : "info",
        "Reagendamento aplicado",
        message,
      );
      if (editingMatchId === params.matchId) {
        setMatchForm((prev) => ({
          ...prev,
          courtId: String(params.targetCourtId),
          start: formatDateTimeLocal(params.targetStartIso),
          end: formatDateTimeLocal(params.targetEndIso),
        }));
      }
      mutateCalendar();
      return true;
    } catch (err) {
      console.error("[padel/calendar] quick reschedule", err);
      setCalendarError("Erro ao reagendar jogo.");
      toast("Erro ao reagendar jogo", "err");
      return false;
    } finally {
      setSavingCalendar(false);
    }
  };

  const saveCalendarMatchSchedule = async () => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para editar o calendário.");
      return;
    }
    if (!editingMatchId) {
      setCalendarError("Seleciona um jogo para editar.");
      return;
    }
    const startIso = toIsoFromLocalInput(matchForm.start);
    const endIso = toIsoFromLocalInput(matchForm.end);
    if (!startIso || !endIso) {
      setCalendarError("Indica início e fim para o jogo.");
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela do jogo é inválida.");
      return;
    }
    const fallbackMatch = calendarMatchesRaw.find((item) => item.id === editingMatchId);
    const courtIdRaw =
      matchForm.courtId && Number.isFinite(Number(matchForm.courtId))
        ? Number(matchForm.courtId)
        : fallbackMatch?.courtId ?? null;
    if (!courtIdRaw) {
      setCalendarError("Seleciona um campo para o jogo.");
      return;
    }
    const durationMinutes = Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
    const updated = await quickRescheduleCalendarMatch({
      matchId: editingMatchId,
      targetCourtId: courtIdRaw,
      targetStartIso: startIso,
      targetEndIso: endIso,
      durationMinutes,
      origin: "DRAG_COURT",
    });
    if (updated) {
      resetMatchScheduleForm();
    }
  };

  const quickMoveCalendarMatch = async (matchId: number, targetCourtId: number) => {
    if (!eventId || !Number.isFinite(matchId) || !Number.isFinite(targetCourtId)) return;
    if (savingCalendar) return;
    const match = calendarMatchesRaw.find((item) => item.id === matchId);
    if (!match) return;
    if ((match.courtId ?? null) === targetCourtId) return;
    const { start, end } = resolveCalendarMatchWindow(match);
    if (!start || !end) {
      setCalendarError("O jogo não tem janela válida para mover.");
      return;
    }

    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    const durationMinutes = resolveCalendarMatchDurationMinutes(match);

    await quickRescheduleCalendarMatch({
      matchId,
      targetCourtId,
      targetStartIso: startIso,
      targetEndIso: endIso,
      durationMinutes,
      origin: "DRAG_COURT",
    });
  };

  const bulkMoveSelectedMatches = async (targetCourtId: number) => {
    if (!eventId || !Number.isFinite(targetCourtId) || targetCourtId <= 0) return;
    const targets = [...selectedMatchIds];
    if (targets.length === 0) return;

    setSavingCalendar(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const localReasonCount: Record<string, number> = {};
      const candidateUpdates: Array<{
        matchId: number;
        courtId: number;
        startAt: string;
        endAt: string;
        durationMinutes: number;
        version: string | Date | null | undefined;
      }> = [];

      for (const matchId of targets) {
        const match = calendarMatchesRaw.find((item) => item.id === matchId);
        if (!match) {
          localReasonCount.MATCH_NOT_FOUND = (localReasonCount.MATCH_NOT_FOUND ?? 0) + 1;
          continue;
        }
        if ((match.courtId ?? null) === targetCourtId) {
          localReasonCount.ALREADY_ON_COURT = (localReasonCount.ALREADY_ON_COURT ?? 0) + 1;
          continue;
        }
        const { start, end } = resolveCalendarMatchWindow(match);
        if (!start || !end) {
          localReasonCount.NO_MATCH_WINDOW = (localReasonCount.NO_MATCH_WINDOW ?? 0) + 1;
          continue;
        }
        const startIso = new Date(start).toISOString();
        const endIso = new Date(end).toISOString();
        candidateUpdates.push({
          matchId,
          courtId: targetCourtId,
          startAt: startIso,
          endAt: endIso,
          durationMinutes: resolveCalendarMatchDurationMinutes(match),
          version: match.updatedAt ?? null,
        });
      }

      if (candidateUpdates.length === 0) {
        const failMsg = formatUnscheduledSummary(localReasonCount) || "Nenhum jogo foi atualizado no lote.";
        setCalendarError(failMsg);
        toast(failMsg, "err");
        return;
      }

      const endpoint = "/api/padel/calendar/matches/bulk-reschedule";
      const payloadBase: Record<string, unknown> = {
        eventId,
        partialMode: "ALLOW_PARTIAL",
        updates: candidateUpdates.map((update) => ({
          matchId: update.matchId,
          courtId: update.courtId,
          startAt: update.startAt,
          endAt: update.endAt,
          durationMinutes: update.durationMinutes,
          version: update.version ? String(update.version) : null,
        })),
      };
      const requestFingerprint = buildAutoSchedulePayloadFingerprint(payloadBase);
      const parsePayload = (value: unknown): Record<string, unknown> =>
        value && typeof value === "object"
          ? ((value as { result?: unknown }).result as Record<string, unknown>) ??
            ((value as { data?: unknown }).data as Record<string, unknown>) ??
            (value as Record<string, unknown>)
          : {};

      const previewRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, mode: "PREVIEW" }),
      });
      const previewJson = await previewRes.json().catch(() => null);
      const previewPayload = parsePayload(previewJson);
      if (!previewRes.ok || previewPayload.ok === false) {
        const errMsg = sanitizeUiErrorMessage(
          previewPayload.error ?? (previewJson && typeof previewJson === "object" ? (previewJson as Record<string, unknown>).error : null),
          "Pré-validação do lote falhou.",
        );
        setCalendarError(errMsg);
        toast(errMsg, "warn");
        pushOpsLive("warn", "Pré-validação do lote falhou", errMsg);
        return;
      }

      const applyRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payloadBase, mode: "APPLY" }),
      });
      const applyJson = await applyRes.json().catch(() => null);
      const applyPayload = parsePayload(applyJson);
      if (!applyRes.ok || applyPayload.ok === false) {
        const unscheduledByReason = normalizeUnscheduledByReason(applyPayload.unscheduledByReason);
        const reasonSummary = formatUnscheduledSummary(unscheduledByReason);
        const errMsg =
          reasonSummary ||
          sanitizeUiErrorMessage(
            applyPayload.error ?? (applyJson && typeof applyJson === "object" ? (applyJson as Record<string, unknown>).error : null),
            "Não foi possível aplicar o lote.",
          );
        setCalendarError(errMsg);
        toast(errMsg, applyRes.status === 409 ? "warn" : "err");
        pushOpsLive("warn", "Lote rejeitado", errMsg);
        return;
      }

      const previewScheduledCount = Number(previewPayload.scheduledCount ?? 0);
      const previewSkippedCount = Number(previewPayload.skippedCount ?? 0);
      const previewUnscheduledByReason = normalizeUnscheduledByReason(previewPayload.unscheduledByReason);
      const applyScheduledCount = Number(applyPayload.scheduledCount ?? 0);
      const applySkippedCount = Number(applyPayload.skippedCount ?? 0);
      const applyUnscheduledByReason = normalizeUnscheduledByReason(applyPayload.unscheduledByReason);

      const mismatch =
        previewScheduledCount !== applyScheduledCount ||
        previewSkippedCount !== applySkippedCount ||
        !areReasonMapsEqual(previewUnscheduledByReason, applyUnscheduledByReason);
      if (mismatch) {
        const mismatchPayload = {
          kind: "padel_metric",
          metric: "calendarConflictPreflightMismatchCount",
          value: 1,
          eventId,
          mode: "BULK_MATCH_RESCHEDULE",
          requestFingerprint,
          previewScheduledCount,
          previewSkippedCount,
          applyScheduledCount,
          applySkippedCount,
        };
        console.log(JSON.stringify(mismatchPayload));
        trackEvent("calendarConflictPreflightMismatchCount", mismatchPayload);
        const mismatchKey = `${requestFingerprint}:bulk`;
        if (eventId && !reportedPreflightMismatchRef.current.has(mismatchKey)) {
          reportedPreflightMismatchRef.current.add(mismatchKey);
          void fetch("/api/padel/calendar/preflight-mismatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              requestFingerprint: mismatchKey,
              previewScheduledCount,
              previewSkippedCount,
              previewUnscheduledByReason,
              applyScheduledCount,
              applySkippedCount,
              applyUnscheduledByReason,
            }),
          }).catch(() => {
            reportedPreflightMismatchRef.current.delete(mismatchKey);
          });
        }
        pushOpsLive(
          "warn",
          "Preview e aplicar divergiram",
          "O estado da agenda mudou entre a pré-validação e a aplicação do lote.",
        );
      }

      const mergedReasonCount = {
        ...applyUnscheduledByReason,
      } as Record<string, number>;
      Object.entries(localReasonCount).forEach(([reason, value]) => {
        mergedReasonCount[reason] = (mergedReasonCount[reason] ?? 0) + Number(value ?? 0);
      });

      const scheduledMatches = Array.isArray(applyPayload.scheduled)
        ? (applyPayload.scheduled as Array<{ matchId?: number }>)
        : [];
      const updatedIds = new Set(
        scheduledMatches
          .map((row) => Number(row.matchId))
          .filter((matchId) => Number.isFinite(matchId)),
      );
      const requested = targets.length;
      const updated = applyScheduledCount;
      const skipped = Math.max(0, requested - updated);
      const skippedSummary = formatUnscheduledSummary(mergedReasonCount);

      if (updated > 0) {
        setCalendarMessage(`Lote aplicado: ${updated}/${requested} jogos atualizados.`);
        if (skipped > 0) {
          setCalendarWarning(
            skippedSummary
              ? `Atualizados ${updated}/${requested}. ${skippedSummary}`
              : `Atualizados ${updated}/${requested}.`,
          );
          toast("Lote aplicado parcialmente", "warn");
          pushOpsLive("warn", "Lote parcial", skippedSummary || "Parte dos jogos não foi atualizada.");
        } else {
          toast("Lote aplicado", "ok");
          pushOpsLive("ok", "Lote aplicado", `Atualizados ${updated}/${requested} jogos.`);
        }
        setSelectedMatchIds((prev) => prev.filter((id) => !updatedIds.has(id)));
        mutateCalendar();
      } else {
        const failMsg = skippedSummary || "Nenhum jogo foi atualizado no lote.";
        setCalendarError(failMsg);
        toast(failMsg, "err");
      }
    } catch (err) {
      console.error("[padel/calendar] bulk move", err);
      setCalendarError("Erro inesperado ao aplicar lote.");
      toast("Erro no lote de jogos", "err");
    } finally {
      setSavingCalendar(false);
    }
  };

  const toggleBulkBlockCourt = (courtId: number) => {
    setBulkBlockCourtIds((prev) =>
      prev.includes(courtId) ? prev.filter((value) => value !== courtId) : [...prev, courtId],
    );
  };

  const submitTournamentBulkBlock = async () => {
    if (!eventId) {
      setBulkBlockError("Seleciona um torneio.");
      return;
    }
    if (!bulkBlockCourtIds.length) {
      setBulkBlockError("Seleciona pelo menos um campo.");
      return;
    }
    const startAtIso = toIsoFromLocalInput(bulkBlockStartAt);
    const endAtIso = toIsoFromLocalInput(bulkBlockEndAt);
    if (!startAtIso || !endAtIso) {
      setBulkBlockError("Indica início e fim do bloqueio.");
      return;
    }
    if (new Date(endAtIso) <= new Date(startAtIso)) {
      setBulkBlockError("A janela do bloqueio é inválida.");
      return;
    }
    const requiresReasonCode = bulkBlockConflictPolicy !== "CASCADE_SAME_COURT" || bulkBlockForce;
    if (requiresReasonCode && !/^[A-Z0-9_]{3,64}$/.test(bulkBlockReasonCode.trim().toUpperCase())) {
      setBulkBlockError("reasonCode obrigatório (A-Z0-9_, 3-64).");
      return;
    }

    const bulkPath = buildOrgApiPath("/tournaments/blocks/bulk");
    if (!bulkPath) {
      setBulkBlockError("Organização indisponível.");
      return;
    }

    setBulkBlockBusy(true);
    setBulkBlockError(null);
    setBulkBlockMessage(null);
    try {
      const res = await fetch(bulkPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          courtIds: bulkBlockCourtIds,
          startAt: startAtIso,
          endAt: endAtIso,
          conflictPolicy: bulkBlockConflictPolicy,
          force: bulkBlockForce,
          reasonCode: bulkBlockReasonCode.trim().toUpperCase() || null,
          reason: bulkBlockReasonText.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(sanitizeUiErrorMessage(json?.errorCode ?? json?.error, "Falha ao criar bloqueios em lote."));
      }
      const operationId = json?.data?.operationId ? String(json.data.operationId) : "";
      if (operationId) {
        setOverrideOperationId(operationId);
      }
      setBulkBlockMessage("Bloqueio em lote aplicado.");
      toast("Bloqueio em lote aplicado.", "ok");
      mutateCalendar();
      mutateTournamentOverrides();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao aplicar bloqueio em lote.";
      setBulkBlockError(message);
      toast(message, "err");
    } finally {
      setBulkBlockBusy(false);
    }
  };

  const submitTournamentOverride = async () => {
    if (!eventId) {
      setOverrideError("Seleciona um torneio.");
      return;
    }
    if (!overrideOperationId.trim() && !overrideSoftBlockId.trim()) {
      setOverrideError("Indica operationId ou softBlockId.");
      return;
    }
    if (!/^[A-Z0-9_]{3,64}$/.test(overrideReasonCode.trim().toUpperCase())) {
      setOverrideError("reasonCode obrigatório (A-Z0-9_, 3-64).");
      return;
    }
    const overridePath = buildOrgApiPath("/tournaments/blocks/overrides");
    if (!overridePath) {
      setOverrideError("Organização indisponível.");
      return;
    }
    setOverrideBusy(true);
    setOverrideError(null);
    setOverrideMessage(null);
    try {
      const softBlockId = overrideSoftBlockId.trim() ? Number(overrideSoftBlockId.trim()) : null;
      const res = await fetch(overridePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          operationId: overrideOperationId.trim() || null,
          softBlockId: Number.isFinite(softBlockId) && (softBlockId ?? 0) > 0 ? softBlockId : null,
          conflictPolicy: overridePolicy,
          reasonCode: overrideReasonCode.trim().toUpperCase(),
          reason: overrideReasonText.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(sanitizeUiErrorMessage(json?.errorCode ?? json?.error, "Falha ao criar override."));
      }
      setOverrideMessage("Override auditável registado.");
      toast("Override registado.", "ok");
      mutateTournamentOverrides();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar override.";
      setOverrideError(message);
      toast(message, "err");
    } finally {
      setOverrideBusy(false);
    }
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
        setCalendarError(sanitizeUiErrorMessage(json?.error, "Não foi possível remover."));
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

  const undoCalendarAction = async (type: "block" | "availability") => {
    if (!lastAction || lastAction.type !== type) return;
    setCalendarMessage(null);
    setCalendarWarning(null);
    setCalendarError(null);
    setSavingCalendar(true);
    try {
      const payload =
        type === "block"
          ? {
              type: "block",
              id: lastAction.id,
              startAt: lastAction.prevStart,
              endAt: lastAction.prevEnd,
              courtId: lastAction.prevCourtId ?? undefined,
              version: lastAction.version ?? undefined,
            }
          : {
              type: "availability",
              id: lastAction.id,
              startAt: lastAction.prevStart,
              endAt: lastAction.prevEnd,
              version: lastAction.version ?? undefined,
            };
      const res = await fetch("/api/padel/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const message = sanitizeUiErrorMessage(json?.error, "Não foi possível desfazer.");
        setCalendarError(message);
        toast(message, "err");
        return;
      }
      setCalendarMessage("Desfeito.");
      toast("Desfeito", "ok");
      setLastAction(null);
      mutateCalendar();
    } catch (err) {
      console.error("[padel/calendar] undo", err);
      setCalendarError("Erro ao desfazer.");
    } finally {
      setSavingCalendar(false);
    }
  };

  const handleEditBlockById = (blockId: number) => {
    const block = calendarBlocksForOps.find((item) => item.id === blockId);
    if (!block) return;
    handleEditBlock(block);
  };

  const handleEditAvailabilityById = (availabilityId: number) => {
    const availability = calendarAvailabilities.find((item) => item.id === availabilityId);
    if (!availability) return;
    handleEditAvailability(availability);
  };

  const handleEditMatchById = (matchId: number) => {
    const match = calendarMatchesRaw.find((item) => item.id === matchId);
    if (!match) return;
    handleEditMatch(match);
  };

  const toggleSelectedMatch = (matchId: number) => {
    if (!Number.isFinite(matchId)) return;
    setSelectedMatchIds((prev) => {
      if (prev.includes(matchId)) return prev.filter((id) => id !== matchId);
      return [...prev, matchId];
    });
  };

  const clearSelectedMatches = () => {
    setSelectedMatchIds([]);
  };

  const autoScheduleEffectiveCourtIds = useMemo(() => {
    if (autoScheduleCourtIds.length > 0) return autoScheduleCourtIds;
    return autoScheduleCourtOptions.map((court) => court.id);
  }, [autoScheduleCourtIds, autoScheduleCourtOptions]);

  const autoScheduleEffectivePriorityOrder = useMemo(() => {
    const selected = new Set(autoScheduleEffectiveCourtIds);
    const prioritized = autoScheduleCourtPriorityOrder.filter((id) => selected.has(id));
    return [...prioritized, ...autoScheduleEffectiveCourtIds.filter((id) => !prioritized.includes(id))];
  }, [autoScheduleCourtPriorityOrder, autoScheduleEffectiveCourtIds]);

  const toggleAutoScheduleCourt = (courtId: number) => {
    if (!Number.isFinite(courtId)) return;
    setAutoScheduleCourtIds((prev) => {
      const exists = prev.includes(courtId);
      if (exists && prev.length <= 1) return prev;
      const next = exists ? prev.filter((id) => id !== courtId) : [...prev, courtId];
      return next;
    });
    setAutoScheduleCourtPriorityOrder((prev) => {
      const exists = prev.includes(courtId);
      if (exists && prev.length <= 1) return prev;
      const next = exists ? prev.filter((id) => id !== courtId) : [...prev, courtId];
      return next;
    });
  };

  const moveAutoScheduleCourtPriority = (courtId: number, direction: -1 | 1) => {
    setAutoScheduleCourtPriorityOrder((prev) => {
      const idx = prev.indexOf(courtId);
      if (idx === -1) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      return next;
    });
  };

  const UNSCHEDULED_REASON_LABELS: Record<string, string> = {
    INVALID_WINDOW: "janela inválida",
    WINDOW_NOT_SET: "janela não definida",
    NO_COURTS_CONFIGURED: "sem campos configurados",
    NO_SLOT_IN_WINDOW: "sem slot na janela",
    NO_COURT_WINDOW: "sem janela disponível nos campos",
    COURT_BLOCKED: "campo bloqueado",
    PLAYER_UNAVAILABLE: "jogador indisponível",
    REST_CONFLICT: "descanso mínimo",
    OVERLAP_CONFLICT: "conflito de sobreposição",
    NO_PARTICIPANTS: "jogo sem participantes",
    MISSING_PARTICIPANTS: "jogo sem participantes",
    COURT_NOT_AVAILABLE: "campo indisponível",
    NO_SLOT_AVAILABLE: "sem slot viável",
    CLASS_SESSION_CONFLICT: "conflito com aula",
    BOOKING_CONFLICT: "conflito com reserva",
    HARD_BLOCK_CONFLICT: "conflito com bloqueio rígido",
    MATCH_CONFLICT: "conflito com outro jogo",
    SOFT_BLOCK_CONFLICT: "conflito com bloqueio suave",
    AGENDA_CONFLICT: "conflito de agenda",
    MATCH_CHANGED: "jogo alterado manualmente",
    MATCH_LOCKED: "jogo bloqueado",
    MATCH_NOT_FOUND: "jogo não encontrado",
    ALREADY_ON_COURT: "já no campo alvo",
    NO_MATCH_WINDOW: "jogo sem janela válida",
    UPDATE_FAILED: "falha de atualização",
    COURT_NOT_FOUND: "campo não encontrado",
    STALE_VERSION: "versão desatualizada",
    INVALID_VERSION: "versão inválida",
    INVALID_UPDATES: "lote inválido",
    DUPLICATE_MATCH_ID: "jogo duplicado no lote",
    NO_CHANGES: "sem alterações",
    AGENDA_WRITE_FAILED: "falha no write canónico",
    BULK_RESCHEDULE_INFEASIBLE: "lote inviável",
  };

  const formatUnscheduledSummary = (value: Record<string, unknown> | null | undefined) => {
    if (!value || typeof value !== "object") return "";
    return Object.entries(value)
      .map(([reason, count]) => {
        const numeric = Number(count);
        const safeCount = Number.isFinite(numeric) ? numeric : 0;
        const label =
          UNSCHEDULED_REASON_LABELS[reason] ??
          reason
            .toLowerCase()
            .replace(/_/g, " ");
        return `${label}: ${safeCount}`;
      })
      .join(" · ");
  };

  const normalizeUnscheduledByReason = (value: unknown) => {
    if (!value || typeof value !== "object") return {} as Record<string, number>;
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, count]) => {
      const numeric = Number(count);
      acc[key] = Number.isFinite(numeric) ? numeric : 0;
      return acc;
    }, {});
  };

  const canonicalizePayload = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalizePayload);
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return Object.keys(record)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = canonicalizePayload(record[key]);
          return acc;
        }, {});
    }
    return value;
  };

  const buildAutoSchedulePayloadFingerprint = (payload: Record<string, unknown>) => {
    return JSON.stringify(canonicalizePayload(payload));
  };

  const areReasonMapsEqual = (a: Record<string, number>, b: Record<string, number>) => {
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
    return keys.every((key) => Number(a[key] ?? 0) === Number(b[key] ?? 0));
  };

  const resolveBlockedReasonCodeFromType = (blockedByType: string | null | undefined) => {
    const normalized = typeof blockedByType === "string" ? blockedByType.trim().toUpperCase() : "";
    if (normalized === "CLASS_SESSION") return "CLASS_SESSION_CONFLICT";
    if (normalized === "BOOKING") return "BOOKING_CONFLICT";
    if (normalized === "HARD_BLOCK") return "HARD_BLOCK_CONFLICT";
    if (normalized === "MATCH") return "MATCH_CONFLICT";
    if (normalized === "SOFT_BLOCK") return "SOFT_BLOCK_CONFLICT";
    return "AGENDA_CONFLICT";
  };

  const resolveAutoScheduleDomainConflictMessage = (params: {
    mode: "PREVIEW" | "APPLY";
    json: Record<string, unknown> | null;
  }) => {
    const blockedByTypeRaw =
      typeof params.json?.details === "object" &&
      params.json?.details &&
      typeof (params.json.details as Record<string, unknown>).blockedByType === "string"
        ? String((params.json.details as Record<string, unknown>).blockedByType).trim().toUpperCase()
        : null;

    const unscheduledByReason = normalizeUnscheduledByReason(
      params.json?.unscheduledByReason,
    );
    const classConflictCount = Number(unscheduledByReason.CLASS_SESSION_CONFLICT ?? 0);
    const bookingConflictCount = Number(unscheduledByReason.BOOKING_CONFLICT ?? 0);
    const hardBlockConflictCount = Number(unscheduledByReason.HARD_BLOCK_CONFLICT ?? 0);

    if (blockedByTypeRaw === "CLASS_SESSION" || classConflictCount > 0) {
      return {
        message:
          params.mode === "APPLY"
            ? "Auto-agendamento bloqueado por conflito com aula (`CLASS_SESSION`)."
            : "Simulação bloqueada por conflito com aula (`CLASS_SESSION`).",
        title: params.mode === "APPLY" ? "Conflito com aula" : "Conflito na simulação",
      };
    }
    if (blockedByTypeRaw === "BOOKING" || bookingConflictCount > 0) {
      return {
        message:
          params.mode === "APPLY"
            ? "Auto-agendamento bloqueado por conflito com reserva (`BOOKING`)."
            : "Simulação bloqueada por conflito com reserva (`BOOKING`).",
        title: params.mode === "APPLY" ? "Conflito com reserva" : "Conflito na simulação",
      };
    }
    if (blockedByTypeRaw === "HARD_BLOCK" || hardBlockConflictCount > 0) {
      return {
        message:
          params.mode === "APPLY"
            ? "Auto-agendamento bloqueado por bloqueio rígido (`HARD_BLOCK`)."
            : "Simulação bloqueada por bloqueio rígido (`HARD_BLOCK`).",
        title: params.mode === "APPLY" ? "Conflito com bloqueio" : "Conflito na simulação",
      };
    }
    return null;
  };

  const resolveAutoScheduleInfeasibleMessage = (params: {
    mode: "PREVIEW" | "APPLY";
    json: Record<string, unknown> | null;
  }) => {
    const errorCode = typeof params.json?.error === "string" ? params.json.error : null;
    if (errorCode !== "AUTO_SCHEDULE_INFEASIBLE") return null;
    const reasons = formatUnscheduledSummary(
      normalizeUnscheduledByReason(params.json?.unscheduledByReason),
    );
    if (params.mode === "APPLY") {
      return reasons
        ? `Auto-agendamento inviável. ${reasons}.`
        : "Auto-agendamento inviável para a janela/campos atuais.";
    }
    return reasons
      ? `Simulação inviável. ${reasons}.`
      : "Simulação inviável para a janela/campos atuais.";
  };
  const pushOpsLive = (level: "ok" | "warn" | "err" | "info", title: string, detail?: string | null) => {
    const at = new Date().toISOString();
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setOpsLiveFeed((prev) => [{ id, level, title, detail: detail ?? null, at }, ...prev].slice(0, 14));
  };

  const generateCalendarMatches = async () => {
    if (!eventId) {
      setCalendarError("Seleciona um torneio para gerar jogos.");
      pushOpsLive("warn", "Geração indisponível", "Seleciona um torneio antes de gerar jogos.");
      return;
    }

    const activeCategoryIds = eventCategories
      .filter((link) => link.isEnabled !== false)
      .map((link) =>
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null,
      )
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0);
    const uniqueCategoryIds = Array.from(new Set(activeCategoryIds));
    const resolvedCategoryId =
      roundOpsCategoryId ??
      (uniqueCategoryIds.length === 1 ? uniqueCategoryIds[0] : null);

    if (!resolvedCategoryId && uniqueCategoryIds.length > 1) {
      const message = "Seleciona uma categoria para gerar jogos sem misturar inscrições.";
      setCalendarError(message);
      toast(message, "warn");
      pushOpsLive("warn", "Categoria obrigatória", message);
      return;
    }

    const formatRaw =
      (resolvedCategoryId ? eventCategoryFormatById.get(resolvedCategoryId) : null) ??
      roundOpsFormatValue ??
      tournamentFormatRaw ??
      DEFAULT_PADEL_FORMAT_FALLBACK;
    const formatValue = parsePadelFormat(formatRaw) ?? DEFAULT_PADEL_FORMAT_FALLBACK;

    const payload: Record<string, unknown> = {
      eventId,
      format: formatValue,
      drawPolicy: "RANDOM_WITH_OPTIONAL_SEEDS",
      seedSource: "TOURNAMENT_CONFIG",
    };
    if (resolvedCategoryId) payload.categoryId = resolvedCategoryId;
    if (formatValue === "GRUPOS_ELIMINATORIAS") payload.phase = "GROUPS";

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const res = await fetch("/api/padel/matches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errorCode = typeof json?.error === "string" ? json.error : null;
        const knownMessage =
          errorCode === "GROUPS_ALREADY_GENERATED"
            ? "Os jogos de grupos já foram gerados para esta categoria."
            : errorCode === "KNOCKOUT_ALREADY_GENERATED"
              ? "As eliminatórias já foram geradas para esta categoria."
              : errorCode === "SEEDS_REQUIRED"
                ? "Este perfil exige seeds válidas para gerar jogos."
                : errorCode === "NEED_PAIRINGS"
                  ? "Não existem duplas completas suficientes para gerar jogos."
                  : null;
        const errMsg = knownMessage ?? sanitizeUiErrorMessage(json?.error, "Não foi possível gerar jogos.");
        setCalendarError(errMsg);
        toast(errMsg, "err");
        pushOpsLive("err", "Falha na geração de jogos", errMsg);
        return;
      }

      const generated = Number(json?.matches ?? 0);
      const stage = typeof json?.stage === "string" ? json.stage : null;
      const drawApplied = json?.drawApplied !== false;
      const seedApplied = json?.seedApplied === true;
      const categoryLabel = resolvedCategoryId
        ? eventCategoryLabelById.get(resolvedCategoryId) ?? `Categoria #${resolvedCategoryId}`
        : "Global";
      const drawLabel = seedApplied ? "draw com seeds" : drawApplied ? "draw aleatório" : "draw aplicado";
      const summary =
        stage === "GROUPS"
          ? `${categoryLabel}: gerados ${generated} jogos de grupos (${drawLabel}).`
          : stage === "KNOCKOUT"
            ? `${categoryLabel}: geradas eliminatórias (${generated} jogos, ${drawLabel}).`
            : `${categoryLabel}: gerados ${generated} jogos (${drawLabel}).`;
      setCalendarMessage(summary);
      toast("Jogos gerados", "ok");
      pushOpsLive("ok", "Jogos gerados", summary);
      mutateCalendar();
      mutatePadelConfig();
      mutateLiveOpsMatches();
    } catch (err) {
      console.error("[padel/calendar] generate matches", err);
      setCalendarError("Erro inesperado ao gerar jogos.");
      toast("Erro ao gerar jogos", "err");
      pushOpsLive("err", "Erro na geração", "Erro inesperado durante geração de jogos.");
    } finally {
      setAutoScheduling(false);
    }
  };

  const runAutoSchedule = async () => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para auto-agendar.");
      pushOpsLive("warn", "Auto-agendamento indisponível", "Seleciona um torneio para agendar.");
      return;
    }
    const startIso = toIsoFromLocalInput(autoScheduleForm.start);
    const endIso = toIsoFromLocalInput(autoScheduleForm.end);
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela termina antes do início.");
      pushOpsLive("warn", "Janela inválida", "Fim do auto-agendamento antes do início.");
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
    if (autoScheduleEffectiveCourtIds.length > 0) payload.courtIds = autoScheduleEffectiveCourtIds;
    if (autoScheduleEffectivePriorityOrder.length > 0) {
      payload.courtPriorityOrder = autoScheduleEffectivePriorityOrder;
    }
    payload.strategy = "BALANCED_BY_CATEGORY";
    payload.partialMode = "ALLOW_PARTIAL";
    payload.executionMode = "SYNC";
    if (roundOpsCategoryId) payload.categoryIds = [roundOpsCategoryId];
    const requestFingerprint = buildAutoSchedulePayloadFingerprint(payload);

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    setAutoScheduleSummary(null);
    setAutoScheduleUnscheduledByReason({});
    setAutoScheduleByCategory([]);
    setAutoSchedulePreview(null);
    try {
      const res = await fetch("/api/padel/calendar/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const conflict = resolveAutoScheduleDomainConflictMessage({
          mode: "APPLY",
          json: json && typeof json === "object" ? (json as Record<string, unknown>) : null,
        });
        if (conflict) {
          setCalendarError(conflict.message);
          setCalendarWarning(conflict.message);
          toast(conflict.message, "warn");
          pushOpsLive("warn", conflict.title, conflict.message);
          return;
        }
        const infeasibleMessage = resolveAutoScheduleInfeasibleMessage({
          mode: "APPLY",
          json: json && typeof json === "object" ? (json as Record<string, unknown>) : null,
        });
        if (infeasibleMessage) {
          setCalendarError(infeasibleMessage);
          toast(infeasibleMessage, "warn");
          pushOpsLive("warn", "Auto-agendamento inviável", infeasibleMessage);
          return;
        }
        const errMsg = sanitizeUiErrorMessage(json?.error, "Não foi possível auto-agendar.");
        setCalendarError(errMsg);
        toast(errMsg, "err");
        pushOpsLive("err", "Falha no auto-agendamento", errMsg);
        return;
      }

      const scheduledCount = Number(json?.scheduledCount ?? 0);
      const skippedCount = Number(json?.skippedCount ?? 0);
      const runId = typeof json?.runId === "string" ? json.runId : null;
      if (runId) setLastAutoScheduleRunId(runId);
      const unscheduledByReason = normalizeUnscheduledByReason(json?.unscheduledByReason);
      const byCategory = Array.isArray(json?.byCategory)
        ? (json.byCategory as Array<{
            categoryId: number | null;
            scheduledCount: number;
            skippedCount: number;
            unscheduledByReason: Record<string, number>;
          }>)
        : [];
      const previewSnapshot = autoSchedulePreviewSnapshotRef.current;
      if (previewSnapshot && previewSnapshot.fingerprint === requestFingerprint) {
        const mismatch =
          previewSnapshot.scheduledCount !== scheduledCount ||
          previewSnapshot.skippedCount !== skippedCount ||
          !areReasonMapsEqual(previewSnapshot.unscheduledByReason, unscheduledByReason);
        if (mismatch) {
          const mismatchPayload = {
            kind: "padel_metric",
            metric: "calendarConflictPreflightMismatchCount",
            value: 1,
            eventId,
            mode: "AUTO_SCHEDULE",
            requestFingerprint,
            previewScheduledCount: previewSnapshot.scheduledCount,
            previewSkippedCount: previewSnapshot.skippedCount,
            applyScheduledCount: scheduledCount,
            applySkippedCount: skippedCount,
          };
          console.log(JSON.stringify(mismatchPayload));
          trackEvent("calendarConflictPreflightMismatchCount", mismatchPayload);
          if (eventId && !reportedPreflightMismatchRef.current.has(requestFingerprint)) {
            reportedPreflightMismatchRef.current.add(requestFingerprint);
            void fetch("/api/padel/calendar/preflight-mismatch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventId,
                requestFingerprint,
                previewScheduledCount: previewSnapshot.scheduledCount,
                previewSkippedCount: previewSnapshot.skippedCount,
                previewUnscheduledByReason: previewSnapshot.unscheduledByReason,
                applyScheduledCount: scheduledCount,
                applySkippedCount: skippedCount,
                applyUnscheduledByReason: unscheduledByReason,
              }),
            }).catch(() => {
              // Se falhar telemetria, mantemos UX intacta e permitimos retry futuro.
              reportedPreflightMismatchRef.current.delete(requestFingerprint);
            });
          }
          pushOpsLive(
            "warn",
            "Preview e aplicar divergiram",
            "O estado da agenda mudou entre a simulação e a aplicação.",
          );
        }
      }
      setAutoScheduleByCategory(byCategory);
      const unscheduledSummary = formatUnscheduledSummary(unscheduledByReason);
      setAutoScheduleUnscheduledByReason(unscheduledByReason);
      const summary = `Agendados ${scheduledCount} jogos${skippedCount ? ` · ${skippedCount} sem slot` : ""}${runId ? ` · run ${runId}` : ""}.`;
      setAutoScheduleSummary(summary);
      if (skippedCount > 0) {
        setCalendarWarning(unscheduledSummary ? `${summary} ${unscheduledSummary}` : summary);
        toast("Auto-agendamento parcial", "warn");
        pushOpsLive("warn", "Auto-agendamento parcial", unscheduledSummary || summary);
      } else {
        setCalendarMessage(summary);
        toast("Auto-agendamento completo", "ok");
        pushOpsLive("ok", "Auto-agendamento completo", summary);
      }
      const warnings = Array.isArray(json?.warnings) ? json.warnings : [];
      if (warnings.length > 0) {
        const first = warnings[0]?.message ? ` ${warnings[0].message}` : "";
        const warnMsg = `Aviso: ${warnings.length} conflito(s) de agenda.${first}`;
        setCalendarWarning(warnMsg);
        toast(warnMsg, "warn");
        pushOpsLive("warn", "Conflitos de agenda detetados", warnMsg);
      }
      mutateCalendar();
    } catch (err) {
      console.error("[padel/calendar] auto-schedule", err);
      setCalendarError("Erro inesperado ao auto-agendar.");
      toast("Erro ao auto-agendar", "err");
      pushOpsLive("err", "Erro no auto-agendamento", "Erro inesperado durante execução.");
    } finally {
      setAutoScheduling(false);
    }
  };

  const undoAutoScheduleRun = async () => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para desfazer o lote.");
      return;
    }
    if (!lastAutoScheduleRunId) {
      setCalendarError("Sem lote recente para desfazer.");
      return;
    }

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    try {
      const res = await fetch("/api/padel/calendar/auto-schedule/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: lastAutoScheduleRunId, eventId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errMsg = sanitizeUiErrorMessage(json?.error, "Não foi possível desfazer o último lote.");
        setCalendarError(errMsg);
        toast(errMsg, "err");
        pushOpsLive("err", "Falha ao desfazer lote", errMsg);
        return;
      }
      const undoneCount = Number(json?.undoneCount ?? 0);
      const requestedCount = Number(json?.requestedCount ?? 0);
      const skippedByReason =
        json?.skippedByReason && typeof json.skippedByReason === "object"
          ? (json.skippedByReason as Record<string, unknown>)
          : null;
      const skippedSummary = formatUnscheduledSummary(skippedByReason);
      const message = `Desfazer lote: ${undoneCount}/${requestedCount} jogos revertidos.`;
      if (skippedSummary) {
        setCalendarWarning(`${message} ${skippedSummary}`);
        toast("Desfazer parcial", "warn");
        pushOpsLive("warn", "Desfazer parcial", skippedSummary);
      } else {
        setCalendarMessage(message);
        toast("Lote desfeito", "ok");
        pushOpsLive("ok", "Lote desfeito", message);
      }
      mutateAutoScheduleRun();
      mutateCalendar();
    } catch (err) {
      console.error("[padel/calendar] undo run", err);
      setCalendarError("Erro inesperado ao desfazer lote.");
      toast("Erro ao desfazer lote", "err");
      pushOpsLive("err", "Erro ao desfazer lote", "Erro inesperado durante rollback.");
    } finally {
      setAutoScheduling(false);
    }
  };

  const previewAutoSchedule = async () => {
    if (!eventId) {
      setCalendarError("Abre a partir de um torneio para simular.");
      pushOpsLive("warn", "Simulação indisponível", "Seleciona um torneio para simular.");
      return;
    }
    const startIso = toIsoFromLocalInput(autoScheduleForm.start);
    const endIso = toIsoFromLocalInput(autoScheduleForm.end);
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela termina antes do início.");
      pushOpsLive("warn", "Janela inválida", "Fim da simulação antes do início.");
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
    if (autoScheduleEffectiveCourtIds.length > 0) payload.courtIds = autoScheduleEffectiveCourtIds;
    if (autoScheduleEffectivePriorityOrder.length > 0) {
      payload.courtPriorityOrder = autoScheduleEffectivePriorityOrder;
    }
    payload.strategy = "BALANCED_BY_CATEGORY";
    payload.partialMode = "ALLOW_PARTIAL";
    payload.executionMode = "SYNC";
    if (roundOpsCategoryId) payload.categoryIds = [roundOpsCategoryId];
    const previewComparePayload = { ...payload };
    delete (previewComparePayload as { dryRun?: boolean }).dryRun;
    const requestFingerprint = buildAutoSchedulePayloadFingerprint(previewComparePayload);

    setAutoScheduling(true);
    setCalendarError(null);
    setCalendarMessage(null);
    setCalendarWarning(null);
    setAutoScheduleSummary(null);
    setAutoScheduleUnscheduledByReason({});
    setAutoScheduleByCategory([]);
    setAutoSchedulePreview(null);
    autoSchedulePreviewSnapshotRef.current = null;
    try {
      const res = await fetch("/api/padel/calendar/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const conflict = resolveAutoScheduleDomainConflictMessage({
          mode: "PREVIEW",
          json: json && typeof json === "object" ? (json as Record<string, unknown>) : null,
        });
        if (conflict) {
          setCalendarError(conflict.message);
          toast(conflict.message, "warn");
          pushOpsLive("warn", conflict.title, conflict.message);
          return;
        }
        const infeasibleMessage = resolveAutoScheduleInfeasibleMessage({
          mode: "PREVIEW",
          json: json && typeof json === "object" ? (json as Record<string, unknown>) : null,
        });
        if (infeasibleMessage) {
          setCalendarError(infeasibleMessage);
          toast(infeasibleMessage, "warn");
          pushOpsLive("warn", "Simulação inviável", infeasibleMessage);
          return;
        }
        const errMsg = sanitizeUiErrorMessage(json?.error, "Não foi possível simular.");
        setCalendarError(errMsg);
        toast(errMsg, "err");
        pushOpsLive("err", "Falha na simulação", errMsg);
        return;
      }
      const scheduledCount = Number(json?.scheduledCount ?? 0);
      const skippedCount = Number(json?.skippedCount ?? 0);
      const runId = typeof json?.runId === "string" ? json.runId : null;
      const unscheduledByReason = normalizeUnscheduledByReason(json?.unscheduledByReason);
      const byCategory = Array.isArray(json?.byCategory)
        ? (json.byCategory as Array<{
            categoryId: number | null;
            scheduledCount: number;
            skippedCount: number;
            unscheduledByReason: Record<string, number>;
          }>)
        : [];
      setAutoScheduleByCategory(byCategory);
      const unscheduledSummary = formatUnscheduledSummary(unscheduledByReason);
      setAutoScheduleUnscheduledByReason(unscheduledByReason);
      const summary = `Simulação: ${scheduledCount} jogos cabem${skippedCount ? ` · ${skippedCount} sem slot` : ""}${runId ? ` · run ${runId}` : ""}.`;
      setAutoScheduleSummary(summary);
      setAutoSchedulePreview(Array.isArray(json?.scheduled) ? json.scheduled : []);
      autoSchedulePreviewSnapshotRef.current = {
        fingerprint: requestFingerprint,
        scheduledCount,
        skippedCount,
        unscheduledByReason,
      };
      if (skippedCount > 0) {
        setCalendarWarning(unscheduledSummary ? `${summary} ${unscheduledSummary}` : summary);
        toast("Simulação parcial", "warn");
        pushOpsLive("warn", "Simulação parcial", unscheduledSummary || summary);
      } else {
        setCalendarMessage(summary);
        toast("Simulação completa", "ok");
        pushOpsLive("info", "Simulação concluída", summary);
      }
      const warnings = Array.isArray(json?.warnings) ? json.warnings : [];
      if (warnings.length > 0) {
        const first = warnings[0]?.message ? ` ${warnings[0].message}` : "";
        const warnMsg = `Aviso: ${warnings.length} conflito(s) de agenda.${first}`;
        setCalendarWarning(warnMsg);
        toast(warnMsg, "warn");
        pushOpsLive("warn", "Conflitos na simulação", warnMsg);
      }
    } catch (err) {
      console.error("[padel/calendar] preview", err);
      setCalendarError("Erro ao simular.");
      toast("Erro ao simular", "err");
      pushOpsLive("err", "Erro na simulação", "Erro inesperado durante simulação.");
    } finally {
      setAutoScheduling(false);
    }
  };

  const saveAutoScheduleDefaults = async () => {
    if (!eventId || !padelConfig) {
      setCalendarError("Sem configuração do torneio para gravar preferências.");
      pushOpsLive("warn", "Sem configuração para guardar", "Define o torneio antes de guardar defaults.");
      return;
    }
    const startIso = toIsoFromLocalInput(autoScheduleForm.start);
    const endIso = toIsoFromLocalInput(autoScheduleForm.end);
    if (startIso && endIso && new Date(endIso) <= new Date(startIso)) {
      setCalendarError("A janela termina antes do início.");
      pushOpsLive("warn", "Janela inválida", "Não foi possível guardar defaults com janela inválida.");
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
          courtSelectionDefaults: {
            useAllCourts:
              autoScheduleCourtOptions.length > 0 &&
              autoScheduleEffectiveCourtIds.length >= autoScheduleCourtOptions.length,
            courtIds: autoScheduleEffectiveCourtIds,
          },
          courtPriorityOrder: autoScheduleEffectivePriorityOrder,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errMsg = sanitizeUiErrorMessage(json?.error, "Não foi possível guardar preferências.");
        setCalendarError(errMsg);
        toast(errMsg, "err");
        pushOpsLive("err", "Falha ao guardar defaults", errMsg);
        return;
      }
      setCalendarMessage("Preferências guardadas.");
      toast("Preferências guardadas", "ok");
      pushOpsLive("ok", "Defaults de agenda guardados", "Prioridade e seleção de campos atualizadas.");
      mutatePadelConfig();
    } catch (err) {
      console.error("[padel/calendar] save defaults", err);
      setCalendarError("Erro ao guardar preferências.");
      toast("Erro ao guardar preferências", "err");
      pushOpsLive("err", "Erro ao guardar defaults", "Erro inesperado no save de preferências.");
    } finally {
      setAutoScheduling(false);
    }
  };

  const saveRoundOpsFormatProfile = async (
    patch: {
      format?: string;
      amMxMode?: "INDIVIDUAL_ROTATION" | "FIXED_PAIR";
      amMxProgressionMode?: "ROUND_BY_ROUND";
      nonStopMode?: "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST";
      nonStopRounds?: number | null;
    },
    _scope: "selected" | "global" = "selected",
  ) => {
    if (!eventId || !padelConfig) {
      setRoundOpsError("Sem configuração do torneio para guardar perfil.");
      pushOpsLive("warn", "Perfil não guardado", "Configuração de torneio indisponível.");
      return;
    }
    const targetKey =
      _scope === "global" ? "global" : roundOpsCategoryId !== null ? String(roundOpsCategoryId) : "global";
    const nextProfiles = Object.entries(formatProfilesByCategory).reduce<Record<string, Record<string, unknown>>>(
      (acc, [key, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return acc;
        acc[key] = { ...(value as Record<string, unknown>) };
        return acc;
      },
      {},
    );
    const currentProfile = { ...(nextProfiles[targetKey] ?? {}) };
    const nextFormat =
      typeof patch.format === "string" && PADEL_FORMAT_KEYS.includes(patch.format) ? patch.format : roundOpsFormatValue;
    const nextProfile: Record<string, unknown> = {
      ...currentProfile,
      format: nextFormat,
    };

    const isAmMx = AM_MX_FORMAT_SET.has(nextFormat);
    const isNonStop = nextFormat === "NON_STOP";
    if (isAmMx) {
      nextProfile.amMxMode =
        patch.amMxMode === "FIXED_PAIR" || patch.amMxMode === "INDIVIDUAL_ROTATION"
          ? patch.amMxMode
          : currentProfile.amMxMode === "FIXED_PAIR"
            ? "FIXED_PAIR"
            : "INDIVIDUAL_ROTATION";
      nextProfile.amMxProgressionMode =
        patch.amMxProgressionMode === "ROUND_BY_ROUND" || currentProfile.amMxProgressionMode === "ROUND_BY_ROUND"
          ? "ROUND_BY_ROUND"
          : "ROUND_BY_ROUND";
    } else {
      delete nextProfile.amMxMode;
      delete nextProfile.amMxProgressionMode;
    }

    if (isNonStop) {
      nextProfile.nonStopMode =
        patch.nonStopMode === "ACTIVE_QUEUE" || patch.nonStopMode === "HARD_CAP_WAITLIST"
          ? patch.nonStopMode
          : currentProfile.nonStopMode === "HARD_CAP_WAITLIST"
            ? "HARD_CAP_WAITLIST"
            : "ACTIVE_QUEUE";
      const roundsSource =
        patch.nonStopRounds !== undefined
          ? patch.nonStopRounds
          : parsePositiveInt(currentProfile.nonStopRounds) ?? parsePositiveInt(currentProfile.roundsHint) ?? selectedNonStopRounds;
      if (typeof roundsSource === "number" && Number.isFinite(roundsSource) && roundsSource > 0) {
        nextProfile.nonStopRounds = Math.floor(roundsSource);
      } else {
        delete nextProfile.nonStopRounds;
      }
    } else {
      delete nextProfile.nonStopMode;
      delete nextProfile.nonStopRounds;
    }

    nextProfiles[targetKey] = nextProfile;

    setRoundOpsProfileBusy(true);
    setRoundOpsMessage(null);
    setRoundOpsWarning(null);
    setRoundOpsError(null);
    try {
      const res = await fetch("/api/padel/tournaments/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          organizationId: padelConfig.organizationId,
          format: padelConfig.format,
          formatProfilesByCategory: nextProfiles,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errMsg = sanitizeUiErrorMessage(json?.error, "Não foi possível guardar perfil de formato.");
        setRoundOpsError(errMsg);
        toast(errMsg, "err");
        pushOpsLive("err", "Falha ao guardar perfil", errMsg);
        return;
      }
      setRoundOpsMessage("Formato do torneio atualizado.");
      toast("Perfil de formato guardado", "ok");
      pushOpsLive(
        "ok",
        "Perfil por formato atualizado",
        targetKey === "global"
          ? "Perfil global atualizado para todas as categorias."
          : `Perfil atualizado para ${roundOpsCategoryLabel}.`,
      );
      mutatePadelConfig();
    } catch (err) {
      console.error("[padel/round-ops] save profile", err);
      setRoundOpsError("Erro ao guardar perfil de formato.");
      toast("Erro ao guardar perfil", "err");
      pushOpsLive("err", "Erro ao guardar perfil", "Erro inesperado no update de perfil.");
    } finally {
      setRoundOpsProfileBusy(false);
    }
  };

  const runRoundsAdvance = async (dryRun = false) => {
    if (!eventId) {
      setRoundOpsError("Seleciona um torneio para avançar rondas.");
      pushOpsLive("warn", "Avanço indisponível", "Seleciona um torneio para avançar rondas.");
      return;
    }
    if (!roundOpsHasRuntime) {
      setRoundOpsWarning("Gera os jogos primeiro para iniciar runtime de rondas.");
      pushOpsLive("warn", "Runtime não iniciado", "Gera jogos antes de avançar rondas.");
      return;
    }

    const payload: Record<string, unknown> = { eventId };
    if (roundOpsCategoryId) payload.categoryId = roundOpsCategoryId;
    if (dryRun) payload.dryRun = true;

    setRoundOpsBusy(true);
    setRoundOpsMessage(null);
    setRoundOpsWarning(null);
    setRoundOpsError(null);
    try {
      const res = await fetch("/api/padel/rounds/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as PadelRoundsAdvanceResponse | null;
      if (!res.ok || json?.ok === false) {
        const errorCode = typeof json?.error === "string" ? json.error : null;
        const fallbackMessage = dryRun
          ? "Não foi possível simular o avanço da ronda."
          : "Não foi possível avançar a ronda.";
        const errorMessage = sanitizeUiErrorMessage(errorCode, fallbackMessage);
        const warnErrors = new Set([
          "ROUND_NOT_FINISHED",
          "ROUND_LIMIT_REACHED",
          "ROUND_ADVANCE_INCOMPLETE",
          "ROUND_STATE_NOT_FOUND",
          "ROUND_STATE_INVALID",
          "ROUND_NOT_READY",
          "ROUND_ADVANCE_NOT_SUPPORTED",
        ]);
        if (errorCode && warnErrors.has(errorCode)) {
          setRoundOpsWarning(errorMessage);
          toast(errorMessage, "warn");
          pushOpsLive("warn", "Avanço de ronda bloqueado", errorMessage);
        } else {
          setRoundOpsError(errorMessage);
          toast(errorMessage, "err");
          pushOpsLive("err", "Falha no avanço de ronda", errorMessage);
        }
        return;
      }

      const generated = Number(json?.generated ?? 0);
      const scheduled = Number(json?.scheduled ?? 0);
      const unscheduledByReason =
        json?.unscheduledByReason && typeof json.unscheduledByReason === "object" ? json.unscheduledByReason : {};
      const unscheduledCount = Object.values(unscheduledByReason).reduce((acc, value) => {
        const numeric = typeof value === "number" ? value : Number(value);
        return acc + (Number.isFinite(numeric) ? numeric : 0);
      }, 0);

      const baseSummary = dryRun
        ? `Simulação pronta: ${generated} jogos para a próxima ronda (${roundOpsCategoryLabel}).`
        : `Ronda avançada (${roundOpsCategoryLabel}): ${generated} jogos gerados, ${scheduled} agendados.`;
      setRoundOpsMessage(baseSummary);
      toast(dryRun ? "Simulação de ronda concluída" : "Ronda avançada", "ok");
      pushOpsLive(dryRun ? "info" : "ok", dryRun ? "Simulação de ronda concluída" : "Ronda avançada", baseSummary);

      if (unscheduledCount > 0) {
        const reasonsLabel = formatUnscheduledSummary(unscheduledByReason);
        const warningLabel = `Sem slot para ${unscheduledCount} jogo(s). ${reasonsLabel}`;
        setRoundOpsWarning(warningLabel);
        toast(warningLabel, "warn");
        pushOpsLive("warn", "Ronda com jogos sem slot", warningLabel);
      }

      if (!dryRun) {
        await Promise.all([mutateCalendar(), mutatePadelConfig()]);
      } else {
        await mutatePadelConfig();
      }
    } catch (err) {
      console.error("[padel/rounds/advance]", err);
      const message = "Erro inesperado ao avançar ronda.";
      setRoundOpsError(message);
      toast(message, "err");
      pushOpsLive("err", "Erro no avanço de ronda", message);
    } finally {
      setRoundOpsBusy(false);
    }
  };

  const buildIncidentBusyKey = (
    action: LiveIncidentAction,
    matchId: number,
    resolutionStatus?: LiveIncidentDisputeResolution,
  ) => `${action}:${matchId}${resolutionStatus ? `:${resolutionStatus}` : ""}`;

  const runLiveIncidentAction = async (
    item: LiveIncidentItem,
    action: LiveIncidentAction,
    resolutionStatus?: LiveIncidentDisputeResolution,
  ) => {
    if (!eventId) {
      setIncidentActionError("Seleciona um torneio para executar ações live.");
      return;
    }

    let endpoint = "";
    let method: "POST" | "PATCH" = "POST";
    const requestId = createClientRequestId("incident");
    let body: Record<string, unknown> = {
      clientRequestId: requestId,
      confirmationSource: "WEB_ORGANIZATION",
    };
    let successMessage = "";
    let successToast = "";
    let feedTitle = "";
    let errorFallback = "Não foi possível executar a ação live.";

    if (action === "confirm") {
      endpoint = `/api/padel/matches/${item.matchId}/result/confirm`;
      successMessage = `Resultado confirmado no jogo #${item.matchId}.`;
      successToast = "Resultado confirmado";
      feedTitle = "Resultado confirmado";
      errorFallback = "Não foi possível confirmar o resultado.";
    } else if (action === "reject") {
      endpoint = `/api/padel/matches/${item.matchId}/result/reject`;
      body = { ...body, reasonText: LIVE_INCIDENT_DEFAULT_REJECT_REASON };
      successMessage = `Resultado rejeitado no jogo #${item.matchId}.`;
      successToast = "Resultado rejeitado";
      feedTitle = "Resultado rejeitado";
      errorFallback = "Não foi possível rejeitar o resultado.";
    } else if (action === "reset_to_submitted") {
      endpoint = `/api/padel/matches/${item.matchId}/result/reset-pending`;
      body = {
        ...body,
        reasonCode: LIVE_INCIDENT_DEFAULT_RESET_CODE,
        reasonText: LIVE_INCIDENT_DEFAULT_RESET_REASON,
        targetState: "RESULT_SUBMITTED",
      };
      successMessage = `Resultado reaberto para validação no jogo #${item.matchId}.`;
      successToast = "Resultado reaberto";
      feedTitle = "Resultado reaberto";
      errorFallback = "Não foi possível reabrir o resultado.";
    } else {
      if (!resolutionStatus) {
        setIncidentActionError("Seleciona um estado de resolução para fechar a disputa.");
        return;
      }
      endpoint = `/api/padel/matches/${item.matchId}/dispute`;
      method = "PATCH";
      body = {
        ...body,
        resolutionStatus,
      };
      successMessage = `Disputa resolvida (${resolutionStatus}) no jogo #${item.matchId}.`;
      successToast = "Disputa resolvida";
      feedTitle = "Disputa resolvida";
      errorFallback = "Não foi possível resolver a disputa.";
    }

    const busyKey = buildIncidentBusyKey(action, item.matchId, resolutionStatus);
    setIncidentActionBusyKey(busyKey);
    setIncidentActionMessage(null);
    setIncidentActionError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const errorCode = extractApiErrorCode(json);
        const message = liveIncidentActionErrorMessage(errorCode, errorFallback);
        setIncidentActionError(message);
        toast(message, "err");
        pushOpsLive("err", feedTitle || "Falha em incidente live", message);
        return;
      }

      setIncidentActionMessage(successMessage);
      toast(successToast, "ok");
      pushOpsLive("ok", feedTitle, `${item.categoryLabel} · ${item.pairingLabel}`);
      await Promise.all([mutateLiveOpsMatches(), mutateCalendar(), mutatePadelConfig()]);
    } catch (err) {
      console.error("[padel/live-incidents] action", err);
      setIncidentActionError(errorFallback);
      toast(errorFallback, "err");
      pushOpsLive("err", feedTitle || "Erro em incidente live", errorFallback);
    } finally {
      setIncidentActionBusyKey(null);
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
        description: "Abrir assistente de padel.",
        shortcut: "G",
        run: () =>
          router.push(
            tournamentsCreateHref,
          ),
        enabled: toolMode === "TOURNAMENTS",
      },
      {
        id: "open-tournaments",
        label: "Torneios",
        description: "Lista e gestão de torneios.",
        shortcut: "T",
        run: () => setPadelSection("tournaments"),
        enabled: toolMode === "TOURNAMENTS",
      },
      {
        id: "open-calendar",
        label: "Calendário",
        description: "Agenda e agendamento automático.",
        shortcut: "C",
        run: () => setPadelSection("calendar"),
        enabled: toolMode === "TOURNAMENTS",
      },
      {
        id: "open-categories",
        label: "Categorias",
        description: "Níveis, género e regras de entrada.",
        shortcut: "S",
        run: () => setPadelSection("categories"),
        enabled: toolMode === "TOURNAMENTS",
      },
      {
        id: "open-teams",
        label: "Equipas",
        description: "Equipas, interclubes e registos.",
        shortcut: "E",
        run: () => setPadelSection("teams"),
        enabled: toolMode === "TOURNAMENTS",
      },
      {
        id: "open-players",
        label: "Jogadores",
        description: "Diretório e perfis.",
        shortcut: "J",
        run: () => setPadelSection("players"),
      },
      {
        id: "open-clubs",
        label: "Clubes",
        description: "Criação e dados base do clube.",
        run: () => setPadelSection("clubs"),
        enabled: toolMode === "CLUB",
      },
      {
        id: "open-coaches",
        label: "Treinadores",
        description: "Perfis e ligação operacional a Reservas.",
        run: () => setPadelSection("coaches"),
        enabled: toolMode === "CLUB",
      },
      {
        id: "open-lessons",
        label: "Aulas",
        description: "Serviços de treino e sessões.",
        run: () => setPadelSection("lessons"),
        enabled: toolMode === "CLUB",
      },
      {
        id: "open-partnerships",
        label: "Parcerias",
        description: "Acordos, reivindicações e exceções entre clubes.",
        run: () => setPadelSection("partnerships"),
        enabled: toolMode === "CLUB",
      },
      {
        id: "open-ops",
        label: "Detalhes do torneio",
        description: "Abrir painel operacional.",
        run: () => {
          if (!eventId) return;
          if (!organizationId) return;
          window.open(buildOrgHref(organizationId, `/events/${eventId}`), "_blank");
        },
        enabled: Boolean(eventId),
      },
      {
        id: "open-monitor",
        label: "Página pública",
        description: "Abrir página pública.",
        run: () => {
          if (!selectedEvent?.slug) return;
          window.open(`/eventos/${selectedEvent.slug}`, "_blank");
        },
        enabled: Boolean(selectedEvent?.slug),
      },
      {
        id: "preview-schedule",
        label: "Simular agendamento automático",
        description: "Pré-visualizar agenda.",
        run: () => previewAutoSchedule(),
        enabled: Boolean(eventId),
      },
      {
        id: "apply-schedule",
        label: "Aplicar agendamento automático",
        description: "Gerar calendário real.",
        run: () => runAutoSchedule(),
        enabled: Boolean(eventId),
      },
      {
        id: "open-ops-drawer",
        label: "Operacional hoje",
        description: "Abrir painel de alertas.",
        shortcut: "O",
        run: () => setShowOpsDrawer(true),
        enabled: Boolean(eventId) && toolMode === "TOURNAMENTS",
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

  return (
    <div className="space-y-5 rounded-3xl border border-white/12  /80 /70 /90 px-4 py-6   md:px-6">
      {switchingTab && <PadelTabSkeleton />}

      {!switchingTab && activeTab === "tournaments" && (
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Operação de torneios</p>
              <p className="text-sm text-white/70">Lista rápida, estado e atalhos para operação/configuração.</p>
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Em curso</p>
              <p className="mt-1 text-xl font-semibold text-white">{inProgressEventsCount}</p>
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
                const inProgress = isTournamentInProgress(event, Date.now());
                const statusTone =
                  inProgress
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
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${statusTone}`}>{statusLabel}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={organizationId ? buildOrgHref(organizationId, `/events/${event.id}`) : buildOrgHubHref("/organizations")} className={CTA_PAD_SECONDARY_SM}>
                        Abrir
                      </Link>
                      <Link href={organizationId ? buildOrgHref(organizationId, `/events/${event.id}`) : buildOrgHubHref("/organizations")} className={CTA_PAD_SECONDARY_SM}>
                        Detalhes
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
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
          <CalendarControls
            eventId={eventId}
            onEventChange={setPadelEventId}
            padelEventsLoading={padelEventsLoading}
            padelEvents={padelEvents}
            categoryKey={roundOpsCategoryKey}
            categoryOptions={runtimeCategoryKeys.map((key) => ({
              key,
              label: formatRuntimeCategoryLabel(key),
            }))}
            onCategoryChange={setRoundOpsCategoryKey}
            formatShortDate={formatShortDate}
            calendarTimezone={calendarTimezone}
            calendarBuffer={calendarBuffer}
            calendarScope={calendarScope}
            onCalendarScopeChange={setCalendarScope}
            switchingTab={switchingTab}
            selectedDay={selectedDay}
            onSelectedDayChange={(next) => {
              setCalendarDayTouched(true);
              setSelectedDay(next);
            }}
            calendarFilter={calendarFilter}
            onCalendarFilterChange={setCalendarFilter}
            slotMinutes={slotMinutes}
            onSlotMinutesChange={setSlotMinutes}
            calendarDataView={calendarDataView}
            onCalendarDataViewChange={setCalendarDataView}
          />

          <div className="rounded-2xl border border-white/12 bg-black/25 p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Torneio · bulk-block</p>
                  <p className="text-[12px] text-white/70">Bloquear vários campos com política de conflito canónica.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[12px] text-white/65">
                    Início
                    <OryaDateTimeField
                      value={bulkBlockStartAt}
                      onChange={setBulkBlockStartAt}
                      stepMinutes={5}
                      className="w-full"
                      dateButtonClassName="w-full rounded-xl border border-white/15 bg-black/30 px-2 py-2 text-white"
                      timeButtonClassName="w-full rounded-xl border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-[12px] text-white/65">
                    Fim
                    <OryaDateTimeField
                      value={bulkBlockEndAt}
                      onChange={setBulkBlockEndAt}
                      stepMinutes={5}
                      className="w-full"
                      dateButtonClassName="w-full rounded-xl border border-white/15 bg-black/30 px-2 py-2 text-white"
                      timeButtonClassName="w-full rounded-xl border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[12px] text-white/65">
                    Política
                    <select
                      value={bulkBlockConflictPolicy}
                      onChange={(event) =>
                        setBulkBlockConflictPolicy(event.target.value as "CASCADE_SAME_COURT" | "REJECT_ON_CONFLICT")
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    >
                      <option value="CASCADE_SAME_COURT">CASCADE_SAME_COURT</option>
                      <option value="REJECT_ON_CONFLICT">REJECT_ON_CONFLICT</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-[12px] text-white/65">
                    reasonCode
                    <input
                      value={bulkBlockReasonCode}
                      onChange={(event) => setBulkBlockReasonCode(event.target.value.toUpperCase())}
                      placeholder="TOURNAMENT_BLOCK"
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-[12px] text-white/65">
                  Nota (opcional)
                  <input
                    value={bulkBlockReasonText}
                    onChange={(event) => setBulkBlockReasonText(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                  />
                </label>
                <label className="flex items-center gap-2 text-[12px] text-white/70">
                  <input
                    type="checkbox"
                    checked={bulkBlockForce}
                    onChange={(event) => setBulkBlockForce(event.target.checked)}
                    className="h-4 w-4 accent-white"
                  />
                  Force override
                </label>
                {bulkBlockError && <p className="text-[12px] text-red-200">{bulkBlockError}</p>}
                {bulkBlockMessage && <p className="text-[12px] text-emerald-200">{bulkBlockMessage}</p>}
                <button
                  type="button"
                  onClick={submitTournamentBulkBlock}
                  disabled={bulkBlockBusy || !eventId}
                  className={CTA_PAD_PRIMARY_SM}
                >
                  {bulkBlockBusy ? "A aplicar…" : "Criar bloqueio em lote"}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Override auditável</p>
                  <p className="text-[12px] text-white/70">Regista política não-default sobre operação/bloco.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[12px] text-white/65">
                    operationId
                    <input
                      value={overrideOperationId}
                      onChange={(event) => setOverrideOperationId(event.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-[12px] text-white/65">
                    softBlockId
                    <input
                      value={overrideSoftBlockId}
                      onChange={(event) => setOverrideSoftBlockId(event.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[12px] text-white/65">
                    Política override
                    <select
                      value={overridePolicy}
                      onChange={(event) =>
                        setOverridePolicy(event.target.value as "REJECT_ON_CONFLICT" | "FORCE_OVERRIDE")
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    >
                      <option value="REJECT_ON_CONFLICT">REJECT_ON_CONFLICT</option>
                      <option value="FORCE_OVERRIDE">FORCE_OVERRIDE</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-[12px] text-white/65">
                    reasonCode
                    <input
                      value={overrideReasonCode}
                      onChange={(event) => setOverrideReasonCode(event.target.value.toUpperCase())}
                      placeholder="MANUAL_OVERRIDE"
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-[12px] text-white/65">
                  Nota
                  <input
                    value={overrideReasonText}
                    onChange={(event) => setOverrideReasonText(event.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
                  />
                </label>
                {overrideError && <p className="text-[12px] text-red-200">{overrideError}</p>}
                {overrideMessage && <p className="text-[12px] text-emerald-200">{overrideMessage}</p>}
                <button
                  type="button"
                  onClick={submitTournamentOverride}
                  disabled={overrideBusy || !eventId}
                  className={CTA_PAD_PRIMARY_SM}
                >
                  {overrideBusy ? "A registar…" : "Registar override"}
                </button>
                <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Últimos overrides</p>
                  <div className="mt-2 space-y-1 text-[12px] text-white/70">
                    {tournamentOverrides.length === 0 && <p>Sem overrides recentes.</p>}
                    {tournamentOverrides.slice(0, 5).map((item) => (
                      <p key={`override-${item.auditId}`}>
                        {item.reasonCode || "—"} · {item.conflictPolicy || "—"} · {item.createdAt ? formatShortDate(item.createdAt) : "—"}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Campos alvo</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {calendarCourts.map((court) => {
                  const active = bulkBlockCourtIds.includes(court.id);
                  return (
                    <button
                      key={`bulk-court-${court.id}`}
                      type="button"
                      onClick={() => toggleBulkBlockCourt(court.id)}
                      className={active ? CTA_PAD_PRIMARY_SM : CTA_PAD_SECONDARY_SM}
                    >
                      {court.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <CalendarMatrixPanel
              eventId={eventId}
              isCalendarLoading={isCalendarLoading}
              padelEventsLoading={padelEventsLoading}
              padelEventsCount={padelEvents.length}
              tournamentsCreateHref={tournamentsCreateHref}
              padelEventsError={padelEventsError}
              hasSelectedEvent={Boolean(selectedEvent)}
              calendarError={calendarError}
              calendarWarning={calendarWarning}
              calendarMessage={calendarMessage}
              calendarScope={calendarScope}
              selectedDay={selectedDay}
              selectedDayLabel={startOfDay ? formatZoned(startOfDay, calendarTimezone) : null}
              onCalendarScopeChange={setCalendarScope}
              weekStart={weekStart}
              calendarCourts={calendarCourts.map((court) => ({ id: court.id, name: court.name }))}
              calendarMatches={calendarMatches}
              calendarBlocks={calendarVisualBlocks}
              calendarAvailabilities={calendarAvailabilities}
              calendarTimezone={calendarTimezone}
              warnings={v2Warnings}
              conflictsCount={calendarConflicts.length}
              occupancyLegend={calendarOccupancyLegend}
              arbitrationPolicy={calendarArbitrationPolicy}
              byCategory={autoScheduleByCategory.map((row) => ({
                ...row,
                categoryLabel:
                  row.categoryId === null
                    ? "global"
                    : eventCategoryLabelById.get(row.categoryId) || `#${row.categoryId}`,
              }))}
              unscheduledRows={v2UnscheduledRows}
              autoScheduling={autoScheduling}
              onGenerate={generateCalendarMatches}
              onSimulate={previewAutoSchedule}
              onApply={runAutoSchedule}
              onUndoLastRun={
                lastAutoScheduleRunId && latestAutoScheduleRun?.applied !== false ? undoAutoScheduleRun : undefined
              }
              onQuickMoveMatch={quickMoveCalendarMatch}
              onQuickRescheduleMatch={(payload) =>
                quickRescheduleCalendarMatch({
                  matchId: payload.matchId,
                  targetCourtId: payload.targetCourtId,
                  targetStartIso: payload.targetStartIso,
                  targetEndIso: payload.targetEndIso,
                  durationMinutes: payload.durationMinutes,
                  origin: "DRAG_SLOT",
                })
              }
              onEditMatch={handleEditMatchById}
              selectedMatchIds={selectedMatchIds}
              onToggleSelectMatch={toggleSelectedMatch}
              latestRun={latestAutoScheduleRun}
              roundOps={{
                categoryKey: roundOpsCategoryKey,
                categoryOptions: runtimeCategoryKeys.map((key) => ({
                  key,
                  label: formatRuntimeCategoryLabel(key),
                })),
                onCategoryChange: setRoundOpsCategoryKey,
                formatLabel: roundOpsFormatLabel,
                roundLabel: roundOpsRoundLabel,
                note: selectedRoundOpsCategoryTeamHint,
                hasRuntime: roundOpsHasRuntime,
                busy: roundOpsBusy,
                profileBusy: roundOpsProfileBusy,
                onSimulate: () => runRoundsAdvance(true),
                onAdvance: () => runRoundsAdvance(false),
                message: roundOpsMessage,
                warning: roundOpsWarning,
                error: roundOpsError,
              }}
            />
            <CalendarExportPanel eventId={eventId} links={calendarExportLinks} />
          </div>
          <CalendarManualAdjustmentsPanel
            eventId={eventId}
            timezone={calendarTimezone}
            saving={savingCalendar}
            formatZoned={formatZoned}
            blockForm={blockForm}
            onBlockFormChange={(patch) => setBlockForm((prev) => ({ ...prev, ...patch }))}
            onSaveBlock={() => saveCalendarItem("block")}
            editingBlockId={editingBlockId}
            onCancelBlockEdit={resetCalendarForms}
            canUndoBlock={Boolean(lastAction && lastAction.type === "block")}
            onUndoBlock={() => undoCalendarAction("block")}
            blocks={calendarBlocksForOps}
            onEditBlock={handleEditBlockById}
            onDeleteBlock={(id) => handleDeleteCalendarItem("block", id)}
            availabilityForm={availabilityForm}
            onAvailabilityFormChange={(patch) => setAvailabilityForm((prev) => ({ ...prev, ...patch }))}
            onSaveAvailability={() => saveCalendarItem("availability")}
            editingAvailabilityId={editingAvailabilityId}
            onCancelAvailabilityEdit={resetCalendarForms}
            canUndoAvailability={Boolean(lastAction && lastAction.type === "availability")}
            onUndoAvailability={() => undoCalendarAction("availability")}
            availabilities={calendarAvailabilities}
            onEditAvailability={handleEditAvailabilityById}
            onDeleteAvailability={(id) => handleDeleteCalendarItem("availability", id)}
          />
          <CalendarMatchAdjustmentsPanel
            eventId={eventId}
            timezone={calendarTimezone}
            saving={savingCalendar}
            formatZoned={formatZoned}
            matches={calendarMatches}
            courts={calendarCourts.map((court) => ({ id: court.id, name: court.name }))}
            editingMatchId={editingMatchId}
            selectedMatchIds={selectedMatchIds}
            form={matchForm}
            onFormChange={(patch) => setMatchForm((prev) => ({ ...prev, ...patch }))}
            onSave={saveCalendarMatchSchedule}
            onCancel={resetMatchScheduleForm}
            onEditMatch={handleEditMatchById}
            onToggleSelectMatch={toggleSelectedMatch}
            onClearSelection={clearSelectedMatches}
            onBulkMove={bulkMoveSelectedMatches}
          />
        </div>
      )}

      {!switchingTab && showCourtsPanel && (
        <ClubsManagementPanel
          isPadelReadOnly={isPadelReadOnly}
          showClubStaffPanel={showClubStaffPanel}
          visibleClubs={visibleClubs}
          drawerClubId={drawerClubId}
          selectedClub={selectedClub}
          loadingDrawer={loadingDrawer}
          courtsPanelReadOnly={courtsPanelReadOnly}
          courts={courts}
          courtForm={courtForm}
          savingCourt={savingCourt}
          courtError={courtError}
          courtMessage={courtMessage}
          draggingCourtId={draggingCourtId}
          staff={staff}
          inheritedStaffCount={inheritedStaffCount}
          staffMode={staffMode}
          staffSearch={staffSearch}
          staffForm={staffForm}
          staffOptions={staffOptions}
          staffError={staffError}
          staffMessage={staffMessage}
          staffInviteNotice={staffInviteNotice}
          ctaPrimaryClass={CTA_PAD_PRIMARY}
          ctaPrimarySmClass={CTA_PAD_PRIMARY_SM}
          badgeClass={badge}
          compactAddress={compactAddress}
          activeCourtsForClub={activeCourtsForClub}
          onOpenNewClubModal={openNewClubModal}
          onSelectClub={(clubId) => {
            setDrawerClubId(clubId);
            loadCourtsAndStaff(clubId);
          }}
          onToggleClubActiveDialog={(club) => setClubDialog({ club, nextActive: !club.isActive })}
          onDeleteClubDialog={(club) => setDeleteClubDialog(club)}
          onCloseDrawer={() => setDrawerClubId(null)}
          onCourtFormPatch={(patch) => setCourtForm((prev) => ({ ...prev, ...patch }))}
          onSubmitCourt={handleSubmitCourt}
          onResetCourt={resetCourtForm}
          onCourtDragStart={setDraggingCourtId}
          onCourtDrop={(courtId) => {
            if (courtsPanelReadOnly) return;
            const updated = reorderCourts(courtId);
            if (updated) {
              persistCourtOrder(updated);
            }
            setDraggingCourtId(null);
          }}
          onCourtDragEnd={() => setDraggingCourtId(null)}
          onEditCourt={handleEditCourt}
          onToggleCourtActiveDialog={(court) => setCourtDialog({ court, nextActive: !court.isActive })}
          onDeleteCourtDialog={setDeleteCourtDialog}
          onStaffModeChange={setStaffMode}
          onStaffSearchChange={setStaffSearch}
          onStaffFormPatch={(patch) => setStaffForm((prev) => ({ ...prev, ...patch }))}
          onSubmitStaff={handleSubmitStaff}
          onResetStaff={resetStaffForm}
          onEditStaff={handleEditStaff}
        />
      )}

      {!switchingTab && activeTab === "categories" && (
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
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
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white ">
              <p className="text-lg font-semibold">Sem categorias.</p>
              <p className="text-sm text-white/70">Cria categorias base.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/12 bg-white/5 p-4 ">
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
                        className={`rounded-2xl border p-4  ${
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
                              className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                              placeholder="Ex: M7, F8, MX Open"
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

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 ">
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

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 ">
            <div>
              <p className="text-sm font-semibold text-white">Nova categoria</p>
              <p className="text-[11px] text-white/60">Cria o nível em falta.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={categoryForm.label}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, label: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                placeholder="Ex: M7, F8, MX Open"
              />
              <select
                value={categoryForm.genderRestriction}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, genderRestriction: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                placeholder="Nível min"
              />
              <input
                value={categoryForm.maxLevel}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, maxLevel: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                placeholder="Nível max"
              />
              <input
                value={categoryForm.season}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, season: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                placeholder="Época"
              />
              <input
                value={categoryForm.year}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, year: e.target.value }))}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
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
                className="w-56 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
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
                  <th className="px-3 py-2">Ranking</th>
                  <th className="px-3 py-2">CRM</th>
                  <th className="px-3 py-2">Torneios</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-[13px] text-white/60" colSpan={6}>
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
                      {p.ranking ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className={badge(p.ranking.orgPosition ? "green" : "slate")}>
                              {p.ranking.orgPosition ? `#${p.ranking.orgPosition}` : "Sem posição"}
                            </span>
                            <span className={badge("slate")}>
                              {p.ranking.rating != null ? `${Math.round(p.ranking.rating)} pts` : "Sem rating"}
                            </span>
                            <span className={badge("slate")}>{p.ranking.matchesPlayed} jogos</span>
                          </div>
                          {p.ranking.blockedNewMatches && (
                            <p className="text-[11px] text-amber-200">Bloqueado para novos jogos</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-white/50">Sem ranking</span>
                      )}
                    </td>
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

      {!switchingTab && activeTab === "partnerships" && (
        <div className="rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
          <PartnershipsPageClient organizationId={organizationId} embedded />
        </div>
      )}

      {!switchingTab && activeTab === "teams" && (
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Equipas & Interclubes</p>
              <p className="text-sm text-white/70">Cria equipas por clube e categoria para ligas interclubes.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 ">
            <div>
              <p className="text-sm font-semibold text-white">Registar equipa no torneio</p>
              <p className="text-[11px] text-white/60">Liga interclubes: associa equipa a um torneio.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={entryTeamId}
                onChange={(e) => setEntryTeamId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
                Não há torneios interclubes. Ativa o modo interclubes no assistente do torneio.
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

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 ">
            <div>
              <p className="text-sm font-semibold text-white">Nova equipa</p>
              <p className="text-[11px] text-white/60">Associa a um clube ou categoria.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                placeholder="Nome da equipa"
              />
              <input
                value={teamLevel}
                onChange={(e) => setTeamLevel(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                placeholder="Nível (opcional)"
              />
              <select
                value={teamClubId}
                onChange={(e) => setTeamClubId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white ">
              <p className="text-lg font-semibold">Sem equipas.</p>
              <p className="text-sm text-white/70">Cria a primeira equipa para começar a liga.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-white/12 bg-white/5 p-4 "
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

      {!switchingTab && activeTab === "coaches" && (
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4  transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Treinadores</p>
              <p className="text-sm text-white/70">Equipa técnica ativa e ligação operacional a Reservas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={organizationId ? buildOrgHref(organizationId, "/team") : buildOrgHubHref("/organizations")}
                className="rounded-full border border-white/25 px-4 py-2 text-[12px] font-semibold text-white hover:border-white/40"
              >
                Equipa
              </Link>
              <Link
                href={organizationId ? buildOrgHref(organizationId, "/bookings/professionals") : buildOrgHubHref("/organizations")}
                className="rounded-full border border-white/15 px-4 py-2 text-[12px] font-semibold text-white/80 hover:border-white/35"
              >
                Profissionais
              </Link>
            </div>
          </div>

          {coachesLoading && <p className="text-[12px] text-white/60">A carregar treinadores…</p>}

          {coachErrorLabel && (
            <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-100">
              {coachErrorLabel}
            </div>
          )}

          {!coachErrorLabel && (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 ">
              <p className="text-sm font-semibold text-white">Adicionar treinador da equipa</p>
              <p className="mt-1 text-[11px] text-white/60">
                Ao associar, o treinador fica imediatamente operacional no fluxo de aulas e Reservas.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-[260px] flex-1">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-white/50">Membro</span>
                  <select
                    value={coachCreateUserId}
                    onChange={(e) => setCoachCreateUserId(e.target.value)}
                    className="w-full rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                  >
                    <option value="">Seleciona um membro</option>
                    {coachMemberCandidates.map((member) => (
                      <option key={`coach-member-${member.userId}`} value={member.userId}>
                        {member.fullName || member.username || member.email || "Sem nome"} · {member.role}
                        {member.rolePack ? ` (${formatRolePackLabel(member.rolePack)})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleAddCoach}
                  disabled={!coachCreateUserId || coachCreating}
                  className={CTA_PAD_PRIMARY_SM}
                >
                  {coachCreating ? "A associar…" : "Adicionar treinador"}
                </button>
              </div>
              {coachMemberCandidates.length === 0 && (
                <p className="mt-2 text-[11px] text-white/50">
                  Todos os membros elegíveis já estão associados como treinadores.
                </p>
              )}
            </div>
          )}

          {!coachesLoading && !coachErrorLabel && coaches.length === 0 && (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white ">
              <p className="text-lg font-semibold">Sem treinadores.</p>
              <p className="text-sm text-white/70">Adiciona um membro da equipa para começar.</p>
            </div>
          )}

          {!coachErrorLabel && coaches.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {coaches.map((coach) => {
                const busy = coachActionLoading === coach.userId;
                return (
                  <div
                    key={coach.userId}
                    className="rounded-2xl border border-white/12 bg-white/5 p-4 "
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={coach.avatarUrl}
                          name={coach.fullName || coach.username || "Treinador"}
                          className="h-10 w-10 rounded-full border border-white/10"
                          textClassName="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80"
                        />
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {coach.fullName || coach.username || "Treinador"}
                          </p>
                          {coach.username && (
                            <p className="text-[11px] text-white/60">@{coach.username}</p>
                          )}
                          <p className="text-[10px] text-white/45">
                            {coach.role || "STAFF"}
                            {coach.rolePack ? ` · ${formatRolePackLabel(coach.rolePack)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100"
                        >
                          Treinador ativo
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                            coach.professionalId && coach.professionalIsActive === true
                              ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                              : "border-amber-300/45 bg-amber-400/10 text-amber-100"
                          }`}
                        >
                          {coach.professionalId && coach.professionalIsActive === true
                            ? "Profissional ativo"
                            : "Profissional pendente"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {coach.professionalId && coach.professionalIsActive === true ? (
                        <Link
                          href={
                            organizationId
                              ? buildOrgHref(organizationId, `/calendar/availability`, {
                                  scopeType: "PROFESSIONAL",
                                  scopeId: coach.professionalId,
                                })
                              : buildOrgHubHref("/organizations")
                          }
                          className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-[11px] text-cyan-100 hover:border-cyan-200/60"
                        >
                          Disponibilidade
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEnsureCoachOperational(coach, "coaches")}
                          disabled={busy}
                          className="rounded-full border border-amber-300/50 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-100 hover:border-amber-200/70 disabled:opacity-60"
                        >
                          {busy ? "A ligar…" : "Ligar Reservas"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCoach(coach)}
                        disabled={busy}
                        className="rounded-full border border-rose-300/50 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-100 hover:border-rose-200/70 disabled:opacity-60"
                      >
                        {busy ? "A remover…" : "Remover treinador"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(coachError || coachMessage) && (
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 ">
              <p className={`text-[12px] ${coachError ? "text-rose-200" : "text-emerald-200"}`}>
                {coachError || coachMessage}
              </p>
            </div>
          )}
        </div>
      )}

      {!switchingTab && activeTab === "lessons" && (
        <div className="space-y-4 rounded-2xl border border-white/12   /60 /85 p-4 text-sm text-white/75  transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Aulas</p>
              <p className="text-sm text-white/70">Catálogo, instrutores e marcações de treino.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPadelSection("coaches")}
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
                href={organizationId ? buildOrgHref(organizationId, "/bookings") : buildOrgHubHref("/organizations")}
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
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white ">
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
                    className="rounded-2xl border border-white/12 bg-white/5 p-4  transition hover:border-white/30"
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
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 space-y-3 ">
              <div>
                <p className="text-sm font-semibold text-white">Nova aula</p>
                <p className="text-[11px] text-white/60">Cria serviço CLASS e série recorrente com sessões.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                <input
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Nome da aula"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                />
                <select
                  value={lessonDuration}
                  onChange={(e) => setLessonDuration(e.target.value)}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
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
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                />
                <select
                  value={lessonCoachUserId}
                  onChange={(e) => setLessonCoachUserId(e.target.value)}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                >
                  <option value="">Seleciona treinador</option>
                  {lessonCoachOptions.map((coach) => (
                    <option key={`lesson-coach-${coach.userId}`} value={coach.userId}>
                      {coach.fullName || coach.username || "Treinador"}
                    </option>
                  ))}
                </select>
                <select
                  value={lessonCourtId}
                  onChange={(e) => setLessonCourtId(e.target.value)}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                >
                  <option value="">Sem campo fixo</option>
                  {activeLessonCourts.map((court) => (
                    <option key={`lesson-court-${court.id}`} value={court.id}>
                      {court.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                <select
                  value={lessonWeekday}
                  onChange={(e) => setLessonWeekday(e.target.value)}
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                >
                  {LESSON_WEEKDAY_OPTIONS.map((option) => (
                    <option key={`lesson-weekday-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={lessonStartTime}
                  onChange={(e) => setLessonStartTime(e.target.value)}
                  placeholder="Hora (HH:MM)"
                  inputMode="numeric"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                />
                <input
                  value={lessonValidFrom}
                  onChange={(e) => setLessonValidFrom(e.target.value)}
                  placeholder="Início (AAAA-MM-DD)"
                  inputMode="numeric"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                />
                <input
                  value={lessonValidUntil}
                  onChange={(e) => setLessonValidUntil(e.target.value)}
                  placeholder="Fim opcional (AAAA-MM-DD)"
                  inputMode="numeric"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                />
                <input
                  value={lessonCapacity}
                  onChange={(e) => setLessonCapacity(e.target.value)}
                  placeholder="Capacidade"
                  inputMode="numeric"
                  className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE]"
                />
              </div>
              {lessonCoachOptions.length === 0 && (
                <p className="text-[11px] text-white/50">
                  Sem treinadores disponíveis. Adiciona primeiro um treinador à organização.
                </p>
              )}
              {selectedLessonCoach &&
                (!selectedLessonCoach.professionalId || selectedLessonCoach.professionalIsActive !== true) && (
                  <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
                    Este treinador ainda não tem profissional ativo em Reservas.
                  </div>
                )}
              <div className="flex flex-wrap items-center gap-2">
                {selectedLessonCoach &&
                  (!selectedLessonCoach.professionalId || selectedLessonCoach.professionalIsActive !== true) && (
                    <button
                      type="button"
                      onClick={handleProvisionLessonCoach}
                      disabled={lessonProvisioningCoach}
                      className={CTA_SECONDARY}
                    >
                      {lessonProvisioningCoach ? "A criar em reservas…" : "Criar em reservas"}
                    </button>
                  )}
                <button
                  type="button"
                  onClick={handleCreateLesson}
                  disabled={
                    lessonCreating ||
                    !lessonCoachUserId ||
                    (selectedLessonCoach
                      ? !selectedLessonCoach.professionalId || selectedLessonCoach.professionalIsActive !== true
                      : false)
                  }
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

      {clubModalOpen &&
        hasMounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 px-4"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) setClubModalOpen(false);
            }}
          >
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c142b] p-6 ">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">
                    {clubForm.id ? "Editar clube" : "Novo clube"}
                  </p>
                  <h3 className="text-xl font-semibold text-white">{clubForm.id ? "Clube" : "Novo clube"}</h3>
                  <p className="text-[11px] text-white/60">
                    Indica nome, morada e número de campos.
                  </p>
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
                <input
                  value={clubForm.name}
                  onChange={(e) => setClubForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do clube"
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                />
                <div className="rounded-xl border border-white/12 bg-black/35 p-3">
                  <AddressCombobox
                    label="Morada"
                    value={clubLocationQuery}
                    onValueChange={(next) => {
                      setClubLocationQuery(next);
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
                    addressId={clubForm.addressId || null}
                    onAddressIdChange={(next) => {
                      setClubForm((prev) => ({
                        ...prev,
                        addressId: next ?? "",
                      }));
                    }}
                    onDetailsResolved={(details: GeoDetailsItem | null) => {
                      applyClubGeoDetails(details, details?.formattedAddress ?? clubLocationQuery);
                    }}
                    minChars={2}
                    maxItems={10}
                    enableRecents
                    enableGeolocationCta
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={clubForm.courtsCount}
                  onChange={(e) => setClubForm((p) => ({ ...p, courtsCount: e.target.value }))}
                  placeholder="Nº de campos"
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                />
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                  {clubError && <span className="text-red-300">{clubError}</span>}
                  {clubMessage && <span>{clubMessage}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitClub}
                    disabled={savingClub}
                    className={`${CTA_PAD_PRIMARY} disabled:cursor-not-allowed disabled:opacity-60`}
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
          </div>,
          document.body,
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
              {eventId && toolMode === "TOURNAMENTS" && (
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
              {eventId && toolMode === "TOURNAMENTS" && (
                <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Fila de incidentes live</p>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                      {filteredLiveIncidentItems.length}/{liveIncidentItems.length}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1 text-[11px] text-white/65">
                      <span>Estado</span>
                      <select
                        value={incidentStatusFilter}
                        onChange={(e) => setIncidentStatusFilter(e.target.value as LiveIncidentStatusFilter)}
                        className="w-full rounded-lg border border-white/15 bg-black/35 px-2 py-1.5 text-[12px] text-white outline-none focus:border-[#22D3EE]"
                      >
                        {LIVE_INCIDENT_STATUS_OPTIONS.map((opt) => (
                          <option key={`incident-status-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-[11px] text-white/65">
                      <span>Categoria</span>
                      <select
                        value={incidentCategoryFilter}
                        onChange={(e) => setIncidentCategoryFilter(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-black/35 px-2 py-1.5 text-[12px] text-white outline-none focus:border-[#22D3EE]"
                      >
                        <option value="ALL">Todas</option>
                        {liveIncidentCategoryOptions.map((opt) => (
                          <option key={`incident-category-${opt.id}`} value={String(opt.id)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-[11px] text-white/65">
                      <span>Formato</span>
                      <select
                        value={incidentFormatFilter}
                        onChange={(e) => setIncidentFormatFilter(e.target.value)}
                        className="w-full rounded-lg border border-white/15 bg-black/35 px-2 py-1.5 text-[12px] text-white outline-none focus:border-[#22D3EE]"
                      >
                        <option value="ALL">Todos</option>
                        {liveIncidentFormatOptions.map((opt) => (
                          <option key={`incident-format-${opt.key}`} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {incidentActionMessage && (
                    <div className="mt-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100">
                      {incidentActionMessage}
                    </div>
                  )}
                  {incidentActionError && (
                    <div className="mt-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
                      {incidentActionError}
                    </div>
                  )}
                  {liveOpsMatchesError && (
                    <div className="mt-2 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
                      {liveOpsMatchesError}
                    </div>
                  )}
                  {liveOpsMatchesLoading && (
                    <p className="mt-2 text-[12px] text-white/65">A carregar incidentes live...</p>
                  )}
                  {!liveOpsMatchesLoading && !liveOpsMatchesError && liveIncidentItems.length === 0 && (
                    <p className="mt-2 text-[12px] text-white/65">Sem incidentes live neste momento.</p>
                  )}
                  {!liveOpsMatchesLoading &&
                    !liveOpsMatchesError &&
                    liveIncidentItems.length > 0 &&
                    filteredLiveIncidentItems.length === 0 && (
                      <p className="mt-2 text-[12px] text-white/65">Sem resultados para os filtros selecionados.</p>
                    )}
                  {!liveOpsMatchesLoading && !liveOpsMatchesError && filteredLiveIncidentItems.length > 0 && (
                    <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {filteredLiveIncidentItems.slice(0, 14).map((item) => {
                        const pendingRemainingLabel = item.pendingConfirmationExpiresAt
                          ? formatRemainingMsLabel(new Date(item.pendingConfirmationExpiresAt).getTime() - Date.now())
                          : formatRemainingMsLabel(item.pendingConfirmationRemainingMs);
                        const canConfirm =
                          item.status === "RESULT_SUBMITTED" ||
                          item.status === "PENDING_CONFIRMATION" ||
                          item.status === "PENDING_REVIEW_EXPIRED";
                        const canReject =
                          item.status === "RESULT_SUBMITTED" ||
                          item.status === "PENDING_CONFIRMATION" ||
                          item.status === "PENDING_REVIEW_EXPIRED";
                        const canReset = item.status === "PENDING_CONFIRMATION" || item.status === "PENDING_REVIEW_EXPIRED";
                        const canResolveDispute = item.status === "DISPUTED";
                        const confirmBusy = incidentActionBusyKey === buildIncidentBusyKey("confirm", item.matchId);
                        const rejectBusy = incidentActionBusyKey === buildIncidentBusyKey("reject", item.matchId);
                        const resetBusy =
                          incidentActionBusyKey === buildIncidentBusyKey("reset_to_submitted", item.matchId);
                        return (
                          <article
                            key={`incident-${item.matchId}`}
                            className="rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-[12px] text-white/80"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusToneClass(item.status)}`}>
                                {formatMatchStatusLabel(item.status)}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {item.streamIsLive && (
                                  <span className="rounded-full border border-fuchsia-300/45 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] text-fuchsia-100">
                                    Stream live
                                  </span>
                                )}
                                {item.status === "IN_PROGRESS" && formatElapsedSecondsLabel(item.elapsedSeconds) && (
                                  <span className="rounded-full border border-emerald-300/45 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-100">
                                    {formatElapsedSecondsLabel(item.elapsedSeconds)}
                                  </span>
                                )}
                                <span className="text-[10px] text-white/60">
                                  {item.startAt ? formatZoned(item.startAt, calendarTimezone) : "Sem hora"}
                                </span>
                              </div>
                            </div>
                            <p className="mt-1 font-semibold text-white">{item.pairingLabel}</p>
                            <p className="text-[11px] text-white/60">
                              {item.categoryLabel} · {item.formatLabel} · {item.phaseLabel}
                            </p>
                            {pendingRemainingLabel && (item.status === "PENDING_CONFIRMATION" || item.status === "PENDING_REVIEW_EXPIRED") && (
                              <p className="mt-1 text-[11px] text-amber-100">Confirmação: {pendingRemainingLabel}</p>
                            )}
                            {item.streamIsLive && item.streamUrl && (
                              <p className="mt-1 text-[11px] text-fuchsia-100/90">{item.streamUrl}</p>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {canConfirm && (
                                <button
                                  type="button"
                                  onClick={() => runLiveIncidentAction(item, "confirm")}
                                  disabled={Boolean(incidentActionBusyKey)}
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                    confirmBusy
                                      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100/70"
                                      : "border-emerald-300/45 bg-emerald-500/15 text-emerald-100 hover:border-emerald-200/70"
                                  } disabled:opacity-60`}
                                >
                                  {confirmBusy ? "A confirmar..." : "Confirmar"}
                                </button>
                              )}
                              {canReject && (
                                <button
                                  type="button"
                                  onClick={() => runLiveIncidentAction(item, "reject")}
                                  disabled={Boolean(incidentActionBusyKey)}
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                    rejectBusy
                                      ? "border-rose-300/20 bg-rose-500/10 text-rose-100/70"
                                      : "border-rose-300/45 bg-rose-500/15 text-rose-100 hover:border-rose-200/70"
                                  } disabled:opacity-60`}
                                >
                                  {rejectBusy ? "A rejeitar..." : "Rejeitar"}
                                </button>
                              )}
                              {canReset && (
                                <button
                                  type="button"
                                  onClick={() => runLiveIncidentAction(item, "reset_to_submitted")}
                                  disabled={Boolean(incidentActionBusyKey)}
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                    resetBusy
                                      ? "border-amber-300/20 bg-amber-500/10 text-amber-100/70"
                                      : "border-amber-300/45 bg-amber-500/15 text-amber-100 hover:border-amber-200/70"
                                  } disabled:opacity-60`}
                                >
                                  {resetBusy ? "A reabrir..." : "Reabrir"}
                                </button>
                              )}
                              {canResolveDispute &&
                                LIVE_INCIDENT_DISPUTE_RESOLUTIONS.map((resolution) => {
                                  const busy =
                                    incidentActionBusyKey === buildIncidentBusyKey("resolve_dispute", item.matchId, resolution);
                                  return (
                                    <button
                                      key={`incident-resolve-${item.matchId}-${resolution}`}
                                      type="button"
                                      onClick={() => runLiveIncidentAction(item, "resolve_dispute", resolution)}
                                      disabled={Boolean(incidentActionBusyKey)}
                                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                        busy
                                          ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100/70"
                                          : "border-cyan-300/45 bg-cyan-500/15 text-cyan-100 hover:border-cyan-200/70"
                                      } disabled:opacity-60`}
                                    >
                                      {busy
                                        ? "A resolver..."
                                        : resolution === "CONFIRMED"
                                          ? "Fechar: confirmado"
                                          : resolution === "CORRECTED"
                                            ? "Fechar: corrigido"
                                            : "Fechar: anulado"}
                                    </button>
                                  );
                                })}
                              {item.status === "IN_PROGRESS" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPadelSection("calendar");
                                    setCalendarDataView("games");
                                    setShowOpsDrawer(false);
                                  }}
                                  className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/85 hover:border-white/45"
                                >
                                  Ir para calendário
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {!eventId && (
                <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-[12px] text-white/70">
                  Abre um torneio para ver métricas operacionais e alertas.
                </div>
              )}
              {eventId && toolMode === "TOURNAMENTS" && (
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
                      onClick={() => setPadelSection("categories")}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                    >
                      Categorias
                    </button>
                    <button
                      type="button"
                      onClick={() => setPadelSection("teams")}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                    >
                      Equipas
                    </button>
                    {selectedEvent?.slug && (
                      <button
                        type="button"
                        onClick={() => window.open(`/eventos/${selectedEvent.slug}`, "_blank")}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                      >
                        Página pública
                      </button>
                    )}
                    {eventId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!organizationId) return;
                          window.open(buildOrgHref(organizationId, `/events/${eventId}`), "_blank");
                        }}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-white/35"
                      >
                        Detalhes
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
              ? "O clube volta a aparecer no assistente e nas sugestões."
              : "O clube ficará inativo e deixa de aparecer nas sugestões do assistente."
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
          description="Remove definitivamente este clube e os campos associados. Não aparecerá mais no painel nem no assistente."
          consequences={["Ação permanente.", "Campos e staff associado deixam de estar disponíveis."]}
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
              ? "O campo volta a ser sugerido no assistente."
              : "O campo fica inativo e deixa de ser sugerido."
          }
          consequences={
            courtDialog.nextActive
              ? ["Mantém a ordem e atributos."]
              : ["Sai das sugestões do assistente.", "Podes reativar mais tarde."]
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
          description="Remove definitivamente este campo. Não aparecerá mais no painel nem no assistente."
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
