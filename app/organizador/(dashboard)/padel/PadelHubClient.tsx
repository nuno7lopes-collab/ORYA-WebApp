"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { trackEvent } from "@/lib/analytics";
import { PORTUGAL_CITIES } from "@/config/cities";

type PadelClub = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
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

type Player = {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  level: string | null;
  isActive: boolean;
  createdAt: string | Date;
  tournamentsCount?: number;
};

type OrganizerStaffMember = {
  userId: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
};

type OrganizerStaffResponse = {
  ok: boolean;
  items: OrganizerStaffMember[];
};

const PADEL_TABS = ["calendar", "clubs", "players", "rankings"] as const;

type Props = {
  organizerId: number;
  organizationKind: string | null;
  initialClubs: PadelClub[];
  initialPlayers: Player[];
};

const DEFAULT_FORM = {
  id: null as number | null,
  name: "",
  city: "",
  address: "",
  courtsCount: "1",
  isActive: true,
  slug: "",
  isDefault: false,
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

const badge = (tone: "green" | "amber" | "slate" = "slate") =>
  `rounded-full border px-2 py-[4px] text-[11px] ${
    tone === "green"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
    : tone === "amber"
        ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
        : "border-white/15 bg-white/10 text-white/70"
  }`;
const toast = (msg: string, tone: "ok" | "err" | "warn" = "ok") => {
  if (typeof window === "undefined") return;
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = `fixed right-4 top-4 z-[9999] rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition ${
    tone === "ok"
      ? "bg-emerald-500 text-black"
      : tone === "warn"
        ? "bg-amber-400 text-black"
        : "bg-red-500 text-white"
  }`;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    setTimeout(() => el.remove(), 180);
  }, 1800);
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

type TimelineItem = {
  id: string;
  kind: "match" | "block" | "availability";
  label: string;
  start: Date;
  end: Date;
  laneKey: string;
  laneLabel: string;
  courtId?: number | null;
  version?: string;
  color: string;
};

const TimelineView = ({
  blocks,
  availabilities,
  matches,
  timezone,
  dayStart,
  onDrop,
  laneHints = [],
  conflictMap,
  slotMinutes,
}: {
  blocks: any[];
  availabilities: any[];
  matches: any[];
  timezone: string;
  dayStart: Date | null;
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

  const toDate = (value: string | Date) => {
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
    const laneLabel = b.courtName || (b.courtId ? `Court ${b.courtId}` : "Court");
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
      id: `av-${av.id}`,
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
    const laneLabel = m.courtName || (m.courtNumber ? `Court ${m.courtNumber}` : m.courtId ? `Court ${m.courtId}` : "Court");
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
            <span className="text-white/50">Hoje</span>
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

export default function PadelHubClient({ organizerId, organizationKind, initialClubs, initialPlayers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const padelSectionParam = searchParams?.get("padel") || null;
  const eventIdParam = searchParams?.get("eventId") || null;
  const eventId = eventIdParam && Number.isFinite(Number(eventIdParam)) ? Number(eventIdParam) : null;
  const initialTab = PADEL_TABS.includes(padelSectionParam as any)
    ? (padelSectionParam as (typeof PADEL_TABS)[number])
    : "clubs";

  const [activeTab, setActiveTab] = useState<(typeof PADEL_TABS)[number]>(initialTab);
  const [switchingTab, setSwitchingTab] = useState(false);
  const [clubs, setClubs] = useState<PadelClub[]>(initialClubs);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [search, setSearch] = useState("");
  const [calendarScope, setCalendarScope] = useState<"week" | "day">("week");
  const [calendarFilter, setCalendarFilter] = useState<"all" | "club">("all");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [slotMinutes, setSlotMinutes] = useState<number>(15);
  const [lastAction, setLastAction] = useState<{
    type: "block" | "availability" | "match";
    id: number;
    prevStart: string;
    prevEnd: string;
    prevCourtId?: number | null;
    prevDuration?: number | null;
    version?: string | null;
  } | null>(null);
  const [blockForm, setBlockForm] = useState({
    start: "",
    end: "",
    label: "",
    note: "",
  });
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [editingBlockVersion, setEditingBlockVersion] = useState<string | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    start: "",
    end: "",
    playerName: "",
    playerEmail: "",
    note: "",
  });
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<number | null>(null);
  const [editingAvailabilityVersion, setEditingAvailabilityVersion] = useState<string | null>(null);
  const [savingCalendar, setSavingCalendar] = useState(false);

  const [clubForm, setClubForm] = useState(DEFAULT_FORM);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [clubError, setClubError] = useState<string | null>(null);
  const [clubMessage, setClubMessage] = useState<string | null>(null);

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

  const { data: organizerStaff } = useSWR<OrganizerStaffResponse>(
    organizerId ? `/api/organizador/organizations/members?organizerId=${organizerId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: calendarData, isLoading: isCalendarLoading, mutate: mutateCalendar } = useSWR(
    eventId ? `/api/padel/calendar?eventId=${eventId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (padelSectionParam && PADEL_TABS.includes(padelSectionParam as any) && padelSectionParam !== activeTab) {
      setActiveTab(padelSectionParam as (typeof PADEL_TABS)[number]);
      setSwitchingTab(false);
    }
  }, [padelSectionParam, activeTab]);

  useEffect(() => {
    const timer = switchingTab ? setTimeout(() => setSwitchingTab(false), 280) : null;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [switchingTab]);

  const setPadelSection = (section: (typeof PADEL_TABS)[number]) => {
    setSwitchingTab(true);
    setActiveTab(section);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", "padel");
    params.set("padel", section);
    router.replace(`/organizador?${params.toString()}`, { scroll: false });
    setLastAction(null);
  };

  const hasActiveClub = useMemo(() => clubs.some((c) => c.isActive), [clubs]);
  const sortedClubs = useMemo(() => {
    return [...clubs].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clubs]);

  const selectedClub = useMemo(() => clubs.find((c) => c.id === drawerClubId) || null, [clubs, drawerClubId]);

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((p) => p.fullName.toLowerCase().includes(term) || (p.email || "").toLowerCase().includes(term));
  }, [players, search]);

  const activeCourtsCount = useMemo(() => courts.filter((c) => c.isActive).length, [courts]);
  const staffOptions = useMemo(() => {
    const list = organizerStaff?.items ?? [];
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
  }, [organizerStaff?.items, staffSearch]);
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

  const createDefaultCourts = async (clubId: number, desired: number, startIndex = 1) => {
    const created: PadelClubCourt[] = [];
    for (let i = 0; i < desired; i += 1) {
      const idx = startIndex + i;
      try {
        const res = await fetch(`/api/padel/clubs/${clubId}/courts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Court ${idx}`,
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
    if (!selectedClub) return;
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
    setClubForm(DEFAULT_FORM);
    setClubError(null);
    setClubMessage(null);
    setSlugError(null);
    setClubModalOpen(true);
  };

  const openEditClubModal = (club: PadelClub) => {
    setClubForm({
      id: club.id,
      name: club.name,
      city: club.city || "",
      address: club.address || "",
      courtsCount: club.courtsCount ? String(club.courtsCount) : "1",
      isActive: club.isActive,
      slug: club.slug || "",
      isDefault: Boolean(club.isDefault),
    });
    setClubError(null);
    setClubMessage(null);
    setSlugError(null);
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
      } else setCourtError(courtsJson?.error || "Erro ao carregar courts.");
      if (staffRes.ok && Array.isArray(staffJson?.items)) setStaff(staffJson.items as PadelClubStaff[]);
      else setStaffError(staffJson?.error || "Erro ao carregar equipa.");
    } catch (err) {
      console.error("[padel/clubs] load courts/staff", err);
      setCourtError("Erro ao carregar courts.");
      setStaffError("Erro ao carregar equipa.");
    } finally {
      setLoadingDrawer(false);
    }
  };

  const handleSubmitClub = async () => {
    setClubError(null);
    setSlugError(null);
    setClubMessage(null);
    if (!clubForm.name.trim()) {
      setClubError("Nome do clube é obrigatório.");
      return;
    }
    if (!clubForm.address.trim()) {
      setClubError("Morada é obrigatória.");
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
            organizerId,
            name: clubForm.name.trim(),
            city: clubForm.city.trim(),
            address: clubForm.address.trim(),
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
      setDrawerClubId(club.id);
      trackEvent(clubForm.id ? "padel_club_updated" : "padel_club_created", { clubId: club.id });

      const existingList = await fetchCourtsForClub(club.id);
      const existingCount = existingList.length;
      if (courtsCount > existingCount) {
        const missing = courtsCount - existingCount;
        const createdCourts = await createDefaultCourts(club.id, missing, existingCount + 1);
        const merged = renumberCourts([...existingList, ...createdCourts]);
        if (club.id === selectedClub?.id) setCourts(merged);
        setCourtMessage(`Criados ${createdCourts.length} courts por omissão.`);
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
    try {
      const res = await fetch("/api/padel/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: club.id,
          organizerId,
          name: club.name,
          city: club.city,
          address: club.address,
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
    const fallbackName = courtForm.name.trim() || `Court ${courts.length + 1}`;
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
          setCourtError(json?.error || "Erro ao guardar court.");
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
        setCourtMessage(courtForm.id ? "Court atualizado." : "Court criado.");
        resetCourtForm();
      }
    } catch (err) {
      console.error("[padel/clubs/courts] save", err);
      setCourtError("Erro inesperado ao guardar court.");
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
          organizerId,
          name: club.name,
          city: club.city,
          address: club.address,
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
        setCourtError(json?.error || "Erro ao apagar court.");
      }
    } catch (err) {
      console.error("[padel/clubs/courts] delete", err);
      setCourtError("Erro inesperado ao apagar court.");
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
        if (staffMode === "external" && emailToSend && organizerId) {
          // Tentar enviar convite de organização (viewer) para criar conta
          const inviteRes = await fetch("/api/organizador/organizations/members/invites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organizerId,
              identifier: emailToSend,
              role: "VIEWER",
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

  const compactAddress = (club: PadelClub) => {
    const bits = [club.city, club.address].filter(Boolean);
    return bits.join(" · ") || "Morada por definir";
  };

  const activeCourtsForClub = (club: PadelClub) => {
    if (!club) return 0;
    if (club.id === selectedClub?.id && courts.length > 0) return computeActiveCount(courts);
    return club.courtsCount || 0;
  };

  const totalActiveCourts = useMemo(() => clubs.reduce((acc, c) => acc + (c.courtsCount || 0), 0), [clubs]);
  const calendarBlocksRaw = calendarData?.blocks ?? [];
  const calendarAvailabilitiesRaw = calendarData?.availabilities ?? [];
  const calendarMatchesRaw = calendarData?.matches ?? [];
  const calendarConflicts = calendarData?.conflicts ?? [];
  const calendarTimezone = calendarData?.eventTimezone ?? "Europe/Lisbon";
  const calendarBuffer = calendarData?.bufferMinutes ?? 5;
  const calendarDayLengthMinutes = 24 * 60;
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
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

  const isWithinDay = (date: string | Date) => {
    if (!startOfDay || !endOfDay) return true;
    const d = new Date(date);
    return d >= startOfDay && d <= endOfDay;
  };

  const calendarBlocks =
    calendarScope === "day"
      ? calendarBlocksRaw.filter((b) => isWithinDay(b.startAt))
      : calendarBlocksRaw;
  const calendarAvailabilities =
    calendarScope === "day"
      ? calendarAvailabilitiesRaw.filter((b) => isWithinDay(b.startAt))
      : calendarAvailabilitiesRaw;
  const matchStartsWithinDay = (m: any) => isWithinDay(m.startTime || m.plannedStartAt);
  const calendarMatches =
    calendarScope === "day" ? calendarMatchesRaw.filter((m) => matchStartsWithinDay(m)) : calendarMatchesRaw;
  const matchesById = useMemo(() => {
    const map = new Map<number, any>();
    calendarMatchesRaw.forEach((m) => map.set(m.id, m));
    return map;
  }, [calendarMatchesRaw]);
  const getItemVersion = (kind: "block" | "availability" | "match", id: number) => {
    if (kind === "block") return calendarBlocks.find((b: any) => b.id === id)?.updatedAt;
    if (kind === "availability") return calendarAvailabilities.find((a: any) => a.id === id)?.updatedAt;
    return calendarMatchesRaw.find((m: any) => m.id === id)?.updatedAt;
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
            ? calendarBlocks.find((b: any) => b.id === editingId)
            : calendarAvailabilities.find((a: any) => a.id === editingId);
        if (prev && editingId) {
          setLastAction({
            type,
            id: editingId,
            prevStart: prev.startAt,
            prevEnd: prev.endAt,
            prevCourtId: prev.courtId ?? null,
            version: prev.updatedAt ?? null,
          });
        } else {
          setLastAction(null);
        }
        setCalendarMessage(editingId ? "Atualizado." : "Guardado.");
        toast(editingId ? "Atualizado" : "Guardado", "ok");
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

  const handleEditBlock = (block: any) => {
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

  const handleEditAvailability = (av: any) => {
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

  return (
    <div className="space-y-5 rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 px-4 py-6 shadow-[0_30px_110px_rgba(0,0,0,0.6)] backdrop-blur-3xl md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/12 bg-gradient-to-r from-white/10 via-[#0f1c3d]/70 to-[#0b1021]/85 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            Padel Hub
          </div>
          <h1 className="text-3xl font-semibold text-white drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]">Operação de Padel</h1>
          <p className="text-sm text-white/70">Calendário, clubes, courts, staff e jogadores num só hub.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/12 bg-gradient-to-r from-white/8 via-[#0c1328]/70 to-[#050912]/90 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.55)] sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Calendário</p>
          <p className="text-2xl font-semibold">Slots & conflitos</p>
          <p className="text-[12px] text-white/60">Bloqueios, jogos e indisponibilidades.</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Clubes</p>
          <p className="text-2xl font-semibold">{clubs.length}</p>
          <p className="text-[12px] text-white/60">{hasActiveClub ? "Ativos e prontos a usar." : "Ativa pelo menos um."}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Courts ativos</p>
          <p className="text-2xl font-semibold">{Number.isFinite(totalActiveCourts) ? totalActiveCourts : "—"}</p>
          <p className="text-[12px] text-white/60">Usados como sugestão no wizard.</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Jogadores</p>
          <p className="text-2xl font-semibold">{players.length}</p>
          <p className="text-[12px] text-white/60">Roster auto-alimentado pelas inscrições.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/15 pb-3">
        {[
          { key: "calendar", label: "Calendário" },
          { key: "clubs", label: "Clubes" },
          { key: "players", label: "Jogadores" },
          { key: "rankings", label: "Rankings (em breve)" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`rounded-full border px-3 py-1 text-[12px] ${
              activeTab === tab.key ? "border-white/80 bg-white text-black" : "border-white/10 bg-white/5 text-white/75 hover:border-white/25"
            }`}
            onClick={() => setPadelSection(tab.key as typeof padelTabs[number])}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {switchingTab && <PadelTabSkeleton />}

      {!switchingTab && activeTab === "calendar" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Calendário</p>
              <p className="text-sm text-white/70">Visual por court com jogos, bloqueios e indisponibilidades (padel only).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              {calendarScope === "day" && (
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80 outline-none focus:border-white/60 focus:ring-2 focus:ring-cyan-400/40"
                />
              )}
              <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
                {[
                  { key: "all", label: "Todos os clubes" },
                  { key: "club", label: "Clube ativo" },
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
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="h-[420px] rounded-2xl border border-dashed border-white/15 bg-black/25 p-4 text-white/70">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Timeline</p>
                {isCalendarLoading && <span className="text-[11px] text-white/60 animate-pulse">A carregar…</span>}
              </div>
              {!eventId && (
                <p className="mt-2 text-[12px] text-white/60">
                  Abre este hub a partir de um torneio de padel para ver o calendário (precisa de eventId no URL).
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
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
                      <p className="mb-2 text-[12px] uppercase tracking-[0.16em] text-white/55">Visão rápida (timeline)</p>
                      <TimelineView
                        blocks={calendarBlocks}
                        availabilities={calendarAvailabilities}
                        matches={calendarMatches}
                        timezone={calendarTimezone}
                        dayStart={startOfDay}
                        conflictMap={new Map(
                          calendarConflicts.map((c) => [`${c.type === "block_block" || c.type === "block_match" ? "block" : c.type === "availability_match" ? "availability" : "match"}-${c.aId}`, [c.type]]),
                        )}
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
                                type: kind === "block" ? "block" : kind === "availability" ? "availability" : kind === "match" ? "match" : null,
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
                              if (kind === "block") {
                                const prev = calendarBlocks.find((b: any) => b.id === parsedId);
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
                                const prev = calendarAvailabilities.find((a: any) => a.id === parsedId);
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
                                const end =
                                  prevMatch.plannedEndAt ||
                                  (start && prevMatch.plannedDurationMinutes
                                    ? new Date(new Date(start).getTime() + prevMatch.plannedDurationMinutes * 60 * 1000).toISOString()
                                    : prevMatch.startTime);
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
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] space-y-1"
                            >
                              <p className="font-semibold text-white">Bloqueio {block.label || `#${block.id}`}</p>
                              <p className="text-white/65">
                                {formatZoned(block.startAt, calendarTimezone)} → {formatZoned(block.endAt, calendarTimezone)}
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
                        <p className="text-[12px] uppercase tracking-[0.16em] text-white/55">Indisponibilidades</p>
                        {calendarAvailabilities.length === 0 && (
                          <p className="text-[12px] text-white/55">Sem indisponibilidades.</p>
                        )}
                        {[...calendarAvailabilities]
                          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                          .slice(0, 6)
                          .map((av) => (
                            <div
                              key={`av-${av.id}`}
                              className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[12px] text-white space-y-1"
                            >
                              <p className="font-semibold">{av.playerName || av.playerEmail || "Jogador"}</p>
                              <p className="text-white/70">
                                {formatZoned(av.startAt, calendarTimezone)} → {formatZoned(av.endAt, calendarTimezone)}
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
                  .map((m) => (
                    <div
                      key={`match-${m.id}`}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] text-white shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${
                        calendarConflicts.some((c) => c.aId === m.id && c.type !== "outside_event_window")
                          ? "border-red-400/70 bg-red-500/10"
                          : calendarConflicts.some((c) => c.aId === m.id && c.type === "outside_event_window")
                            ? "border-amber-300/60 bg-amber-500/10"
                            : "border-white/12 bg-gradient-to-r from-white/8 via-[#0f1c3d]/50 to-[#050912]/80"
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="font-semibold">Jogo #{m.id}</p>
                        <p className="text-white/70">
                          {formatZoned(m.startTime || m.plannedStartAt, calendarTimezone)} · Court {m.courtName || m.courtNumber || m.courtId || "—"}
                        </p>
                        <p className="text-white/60">{m.roundLabel || m.groupLabel || "Fase"}</p>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const start = m.startTime || m.plannedStartAt;
                              const end =
                                m.plannedEndAt ||
                                (start && m.plannedDurationMinutes
                                  ? new Date(new Date(start).getTime() + m.plannedDurationMinutes * 60 * 1000).toISOString()
                                  : null);
                              if (!start || !end) return;
                              const newEnd = new Date(new Date(end).getTime() - slotMinutes * 60 * 1000);
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
                                  ? new Date(new Date(start).getTime() + m.plannedDurationMinutes * 60 * 1000).toISOString()
                                  : null);
                              if (!start || !end) return;
                              const newEnd = new Date(new Date(end).getTime() + slotMinutes * 60 * 1000);
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
                        </div>
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-white/75">
                        {m.status}
                      </span>
                    </div>
                          ))}
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
                              <p className="text-[11px] text-red-100/70">Dupla/jogador duplicado no mesmo horário.</p>
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
                  </div>
                )}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4 text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold text-white">Legenda & próximos passos</p>
              <ul className="space-y-2 text-[13px] text-white/70">
                <li>• Bloqueios de court e indisponibilidades de jogador.</li>
                <li>• Conflitos: sobreposição, jogador em dois jogos, fora de horário.</li>
                <li>• Vista por clube ou todos os clubes ativos do torneio.</li>
                <li>• Horas em {calendarTimezone} com buffer de {calendarBuffer} min entre registos.</li>
              </ul>
              <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0f1c3d]/50 to-[#050912]/90 p-3 text-[13px] text-white/75">
                A seguir: endpoints de indisponibilidade + slots de bloqueio; depois ligamos o drag & drop.
              </div>
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
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60"
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
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60"
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

      {!switchingTab && activeTab === "clubs" && (
        <div className="space-y-4 transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Clubes</h2>
              <p className="text-[12px] text-white/65">Morada, courts e default para o wizard.</p>
            </div>
            <button
              type="button"
              onClick={openNewClubModal}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]"
            >
              Novo clube
            </button>
          </div>
          {sortedClubs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-black/35 p-6 text-white">
              <p className="text-lg font-semibold">Ainda sem clubes.</p>
              <p className="text-sm text-white/70">Adiciona o primeiro para preencher morada e courts no wizard.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={openNewClubModal}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow"
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
                    <p className="text-[12px] text-white/55">Courts ativos: {activeCourtsForClub(club)}</p>
                  </div>
                      <span
                        className={
                          club.isActive
                            ? badge("green")
                            : "rounded-full border border-red-400/50 bg-red-500/15 px-3 py-1 text-[12px] text-red-100"
                        }
                      >
                        {club.isActive ? "Ativo" : "Inativo"}
                      </span>
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
                        Courts & equipa
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditClubModal(club)}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/30"
                      >
                        Editar
                      </button>
                      {!club.isDefault && (
                        <button
                          type="button"
                          onClick={() => markDefaultClub(club)}
                          className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/30"
                        >
                          Tornar default
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
                  <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">Courts & equipa</p>
                  <p className="text-sm text-white/70">Courts ativos e staff herdável vão para o wizard de torneio.</p>
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
                    <p className="text-sm font-semibold text-white">Courts do clube</p>
                    <span className={badge("slate")}>{courts.filter((c) => c.isActive).length} ativos</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={courtForm.name}
                      onChange={(e) => setCourtForm((p) => ({ ...p, name: e.target.value }))}
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                      placeholder="Nome do court"
                    />
                    <input
                      value={courtForm.description}
                      onChange={(e) => setCourtForm((p) => ({ ...p, description: e.target.value }))}
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
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
                      disabled={savingCourt}
                      className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow disabled:opacity-60"
                    >
                      {savingCourt ? "A guardar…" : courtForm.id ? "Atualizar court" : "Guardar court"}
                    </button>
                    {courtForm.id && (
                      <button
                        type="button"
                        onClick={resetCourtForm}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35"
                      >
                        Cancelar
                      </button>
                    )}
                {(courtError || courtMessage) && (
                  <span className="text-[12px] text-white/70">{courtError || courtMessage}</span>
                )}
              </div>
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80">
                {courts.length === 0 && <p className="text-white/60">Sem courts ainda.</p>}
                {courts.map((c, idx) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDraggingCourtId(c.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
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
                        className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setCourtDialog({ court: c, nextActive: !c.isActive })}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
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
                          className="rounded-full border border-red-400/60 bg-red-500/15 px-2 py-1 text-[11px] text-red-50 hover:border-red-300/80"
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
                        label: "Staff do organizador",
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
                      className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black shadow"
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
                    {staff.length === 0 && <p className="text-white/60">Sem staff ainda.</p>}
                    {staff.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-1.5">
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
                              {s.inheritToEvents ? "Herdado p/ torneios" : "Só no clube"}
                            </span>
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-[2px]">
                              {s.userId ? "Staff global" : "Externo"}
                            </span>
                            {!s.userId && <span className="rounded-full border border-amber-300/50 bg-amber-400/10 px-2 py-[2px] text-amber-50">Pendente (sem conta)</span>}
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

      {!switchingTab && activeTab === "players" && (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Jogadores</p>
              <p className="text-sm text-white/70">Roster automático. Sem criação manual nesta fase.</p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar por nome ou email"
              className="w-60 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            />
          </div>
          <div className="overflow-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-[12px] uppercase tracking-[0.12em] text-white/60">
                <tr>
                  <th className="px-3 py-2">Jogador</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Torneios</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-[13px] text-white/60" colSpan={4}>
                      Sem jogadores ainda. Quando houver inscrições em Padel, a lista aparece aqui.
                    </td>
                  </tr>
                )}
                {filteredPlayers.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="px-3 py-2 font-semibold text-white">
                      <div>{p.fullName}</div>
                      <p className="text-[11px] text-white/60">{p.level || "Nível não definido"}</p>
                    </td>
                    <td className="px-3 py-2">{p.email || "—"}</td>
                    <td className="px-3 py-2">{p.phone || "—"}</td>
                    <td className="px-3 py-2">
                    <span className={badge("slate")}>{p.tournamentsCount ?? 0} torneios</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!switchingTab && activeTab === "rankings" && (
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-sm text-white/75 space-y-2 shadow-[0_18px_60px_rgba(0,0,0,0.5)] transition-all duration-250 ease-out opacity-100 translate-y-0">
          <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Rankings</p>
          <p>Rankings multi-torneio chegam numa próxima versão.</p>
        </div>
      )}

      {organizationKind !== "CLUBE_PADEL" && (
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-4 text-[12px] text-white/70 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
          Ferramentas de Padel disponíveis mesmo sem seres clube. Usa quando precisares.
        </div>
      )}

      {clubModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c142b] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">
                  {clubForm.id ? "Editar clube" : "Novo clube"}
                </p>
                <h3 className="text-xl font-semibold text-white">Só o essencial.</h3>
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
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <input
                    list="pt-cities"
                    value={clubForm.city}
                    onChange={(e) => setClubForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Cidade"
                    className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                  />
                  <datalist id="pt-cities">
                    {PORTUGAL_CITIES.map((city) => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
                <input
                  value={clubForm.address}
                  onChange={(e) => setClubForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Morada"
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={(clubForm as any).slug ?? ""}
                  onChange={(e) => {
                    setSlugError(null);
                    setClubForm((p: any) => ({ ...p, slug: e.target.value }));
                  }}
                  placeholder="Slug / código curto (opcional)"
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                />
                {slugError && <p className="mt-1 text-[12px] font-semibold text-red-300">{slugError}</p>}
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={clubForm.courtsCount}
                  onChange={(e) => setClubForm((p) => ({ ...p, courtsCount: e.target.value }))}
                  placeholder="Nº de courts"
                  className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={clubForm.isActive}
                  onChange={(e) => setClubForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4"
                />
                Ativo (disponível no wizard)
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
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
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
              ? ["Courts ativos continuam disponíveis."]
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
          description="Remove definitivamente este clube e os courts associados. Não aparecerá mais no hub ou no wizard."
          consequences={["Ação permanente.", "Court e staff associados deixam de estar disponíveis."]}
          confirmLabel="Apagar"
          dangerLevel="high"
          onClose={() => setDeleteClubDialog(null)}
          onConfirm={() => handleDeleteClub(deleteClubDialog)}
        />
      )}

      {courtDialog && (
        <ConfirmDestructiveActionDialog
          open
          title={courtDialog.nextActive ? "Reativar court?" : "Desativar court?"}
          description={
            courtDialog.nextActive
              ? "O court volta a ser sugerido no wizard."
              : "O court fica inativo e deixa de ser sugerido."
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
          title="Apagar court?"
          description="Remove definitivamente este court. Não aparecerá mais no hub ou no wizard."
          consequences={["Ação permanente.", "Podes criar outro mais tarde."]}
          confirmLabel="Apagar"
          dangerLevel="high"
          onClose={() => setDeleteCourtDialog(null)}
          onConfirm={() => handleDeleteCourt(deleteCourtDialog)}
        />
      )}
    </div>
  );
}
