"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type Props = {
  organizerId: number;
  organizationKind: string | null;
  initialClubs: PadelClub[];
  initialPlayers: Player[];
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  const [activeTab, setActiveTab] = useState<"clubs" | "players" | "rankings">("clubs");
  const [clubs, setClubs] = useState<PadelClub[]>(initialClubs);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [search, setSearch] = useState("");

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
  const [draggingCourtId, setDraggingCourtId] = useState<number | null>(null);
  const [clubDialog, setClubDialog] = useState<{ club: PadelClub; nextActive: boolean } | null>(null);
  const [deleteClubDialog, setDeleteClubDialog] = useState<PadelClub | null>(null);
  const [deleteCourtDialog, setDeleteCourtDialog] = useState<PadelClubCourt | null>(null);

  const { data: organizerStaff } = useSWR<OrganizerStaffResponse>(
    organizerId ? `/api/organizador/organizations/members?organizerId=${organizerId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setStaffError(null);
    setStaffMessage(null);
    try {
      const res = await fetch(`/api/padel/clubs/${selectedClub.id}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: staffForm.id,
          email: emailToSend,
          userId: staffMode === "existing" ? selectedMember?.userId : null,
          role: staffForm.role,
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

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-black/35 px-4 py-5 shadow-[0_22px_70px_rgba(0,0,0,0.55)] md:px-6 md:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-[#0b1021] via-[#0d152f] to-[#0f1c3d] px-4 py-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Padel</p>
          <h1 className="text-2xl font-semibold">Clubes, courts, staff e jogadores.</h1>
          <p className="text-sm text-white/65">Tudo num hub único. Copy curta e ações claras.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNewClubModal}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]"
          >
            Novo clube
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 sm:grid-cols-3">
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

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {[
          { key: "clubs", label: "Clubes" },
          { key: "players", label: "Jogadores" },
          { key: "rankings", label: "Rankings (em breve)" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`rounded-full border px-3 py-1 text-[12px] ${
              activeTab === tab.key ? "border-white/80 bg-white text-black" : "border-white/10 bg-white/5 text-white/75 hover:border-white/25"
            }`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "clubs" && (
        <div className="space-y-4">
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
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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
                      <div key={idx} className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 animate-pulse">
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
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
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

                <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Staff do clube</p>
                    <span className={badge("slate")}>{staff.filter((s) => s.inheritToEvents).length} herdam</span>
                  </div>
                  <div className="space-y-2">
                    <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                      {[
                        { key: "existing", label: "Usar staff do organizador" },
                        { key: "external", label: "Adicionar contacto externo" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setStaffMode(opt.key as typeof staffMode)}
                          className={`rounded-full px-3 py-1 transition ${
                            staffMode === opt.key ? "bg-white text-black font-semibold shadow" : "text-white/75 hover:bg-white/5"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {staffMode === "existing" ? (
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
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={staffForm.email}
                          onChange={(e) => setStaffForm((p) => ({ ...p, email: e.target.value }))}
                          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
                          placeholder="Email do contacto"
                        />
                        <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-[12px] text-white/70">
                          Sem conta ORYA: guardamos só email + role.
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
                    {(staffError || staffMessage) && (
                      <span className="text-[12px] text-white/70">{staffError || staffMessage}</span>
                    )}
                  </div>
                  <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80">
                    {staff.length === 0 && <p className="text-white/60">Sem staff ainda.</p>}
                    {staff.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-1.5">
                        <div>
                          <p className="text-sm text-white">{s.email || s.userId || "Sem contacto"}</p>
                          <p className="text-[11px] text-white/55">
                            {s.role} · {s.inheritToEvents ? "Herdar para torneios" : "Só no clube"} ·{" "}
                            {s.userId ? "Staff global" : "Externo"}
                          </p>
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

      {activeTab === "players" && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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

      {activeTab === "rankings" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/75 space-y-2">
          <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Rankings</p>
          <p>Rankings multi-torneio chegam numa próxima versão.</p>
        </div>
      )}

      {organizationKind !== "CLUBE_PADEL" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[12px] text-white/65">
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
