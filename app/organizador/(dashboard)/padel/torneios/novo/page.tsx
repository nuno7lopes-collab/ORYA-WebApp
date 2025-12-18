"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrganizerDefaults = {
  organizationKind: string | null;
  padelDefaults?: {
    ruleSetId?: number | null;
  } | null;
  displayName?: string | null;
  city?: string | null;
};

type PadelCategory = { id: number; name: string; level?: string | null };

type PadelClub = {
  id: number;
  name: string;
  shortName?: string | null;
  city?: string | null;
  address?: string | null;
  courtsCount?: number | null;
  favoriteCategoryIds?: number[];
  isActive: boolean;
};

type PadelClubCourt = {
  id: number;
  padelClubId: number;
  name: string;
  description: string | null;
  surface: string | null;
  indoor: boolean;
  isActive: boolean;
  displayOrder: number;
};

type PadelStaff = {
  id: number;
  padelClubId: number;
  fullName?: string | null;
  email?: string | null;
  inheritToEvents?: boolean | null;
};

type TicketRow = {
  name: string;
  categoryId: number | null;
  price: string;
  capacity: string;
  registrationType: "TEAM" | "INDIVIDUAL";
};

function formatDateSuggestion() {
  const now = new Date();
  const nextSaturday = new Date(now);
  nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  nextSaturday.setHours(10, 0, 0, 0);
  const start = nextSaturday.toISOString().slice(0, 16);
  const endDate = new Date(nextSaturday);
  endDate.setHours(18, 0, 0, 0);
  const end = endDate.toISOString().slice(0, 16);
  return { start, end };
}

export default function PadelWizardSimple() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [defaults, setDefaults] = useState<OrganizerDefaults | null>(null);
  const [categories, setCategories] = useState<PadelCategory[]>([]);
  const [clubs, setClubs] = useState<PadelClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [partnerClubIds, setPartnerClubIds] = useState<number[]>([]);
  const [clubCourts, setClubCourts] = useState<PadelClubCourt[]>([]);
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [clubStaff, setClubStaff] = useState<PadelStaff[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [city, setCity] = useState("");
  const [clubName, setClubName] = useState("");
  const [address, setAddress] = useState("");
  const [courtsCount, setCourtsCount] = useState("");
  const [tournamentState, setTournamentState] = useState<"OCULTO" | "INSCRICOES" | "PUBLICO" | "TERMINADO" | "CANCELADO">("OCULTO");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [listed, setListed] = useState(true);
  const [gameDuration, setGameDuration] = useState("60");
  const [allowCancelGames, setAllowCancelGames] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxEntriesTotal, setMaxEntriesTotal] = useState("");
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [allowSecondCategory, setAllowSecondCategory] = useState(false);

  const [tickets, setTickets] = useState<TicketRow[]>([
    { name: "", categoryId: null, price: "", capacity: "", registrationType: "TEAM" },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tournamentStateOptions: { value: typeof tournamentState; label: string; hint: string }[] = useMemo(
    () => [
      { value: "OCULTO", label: "Oculto", hint: "Rascunho; não aparece ao público." },
      { value: "INSCRICOES", label: "Inscrições", hint: "Página pública com inscrições abertas." },
      { value: "PUBLICO", label: "Público", hint: "Agenda/jogos em destaque, inscrições fechadas." },
      { value: "TERMINADO", label: "Terminado", hint: "Resultados finais publicados." },
      { value: "CANCELADO", label: "Cancelado", hint: "Visível como cancelado." },
    ],
    [],
  );

  const selectedClub = useMemo(
    () => clubs.find((c) => c.id === selectedClubId) || null,
    [clubs, selectedClubId],
  );

  const hasActiveClub = useMemo(() => clubs.some((c) => c.isActive), [clubs]);

  const applyClubDefaults = (club?: Partial<PadelClub> | null) => {
    if (!club) return;
    setCity(club.city || "");
    setClubName(club.shortName || club.name || "");
    setAddress(club.address || "");
    setCourtsCount(club.courtsCount ? String(club.courtsCount) : "");
    const inheritedCourts = clubCourts.filter((c) => c.padelClubId === club.id && c.isActive).map((c) => c.id);
    if (inheritedCourts.length) setSelectedCourtIds(inheritedCourts);
    const inheritedStaff = clubStaff.filter((s) => s.padelClubId === club.id && s.inheritToEvents).map((s) => s.id);
    if (inheritedStaff.length) setSelectedStaffIds(inheritedStaff);
  };

  // Load organizer defaults + categories + clubes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [orgRes, catRes, clubRes] = await Promise.all([
          fetch("/api/organizador/me"),
          fetch("/api/padel/categories/my"),
          fetch("/api/padel/clubs"),
        ]);
        const [orgJson, catJson, clubJson] = await Promise.all([
          orgRes.json().catch(() => null),
          catRes.json().catch(() => null),
          clubRes.json().catch(() => null),
        ]);
        if (!cancelled) {
          if (orgRes.ok && orgJson?.organizer) {
            const org = orgJson.organizer as OrganizerDefaults;
            setDefaults(org);
            setCity(org.city || "");
            setClubName(org.displayName || "");
          }
          if (catRes.ok && Array.isArray(catJson?.items)) {
            setCategories(catJson.items as PadelCategory[]);
          }
        if (clubRes.ok && Array.isArray(clubJson?.items)) {
          const clubList = (clubJson.items as PadelClub[]).filter((c) => c.isActive);
            setClubs(clubList);
            const activeClub = clubList.find((c) => c.isActive) || clubList[0];
            if (activeClub) {
              setSelectedClubId(activeClub.id);
              applyClubDefaults(activeClub);
            }
          }
        }
      } catch (err) {
        console.warn("[PadelWizard] defaults load failed", err);
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedClub) {
      applyClubDefaults(selectedClub);
      loadCourts(selectedClub.id);
      loadStaff(selectedClub.id);
    }
  }, [selectedClub]);

  useEffect(() => {
    if (selectedClubId) {
      setPartnerClubIds((prev) => prev.filter((id) => id !== selectedClubId));
    }
  }, [selectedClubId]);

  const loadCourts = async (clubId: number) => {
    setLoadingCourts(true);
    try {
      const res = await fetch(`/api/padel/clubs/${clubId}/courts`);
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.items)) {
        const courts = (json.items as PadelClubCourt[]).filter((c) => c.isActive);
        setClubCourts(courts);
        if (selectedClubId === clubId) {
          setSelectedCourtIds(courts.map((c) => c.id));
        }
        if (!courtsCount && courts.length > 0) {
          const activeCount = courts.filter((c) => c.isActive).length || courts.length;
          setCourtsCount(String(activeCount));
        }
      } else {
        setClubCourts([]);
        setSelectedCourtIds([]);
      }
    } catch (err) {
      console.warn("[PadelWizard] load courts failed", err);
      setClubCourts([]);
      setSelectedCourtIds([]);
    } finally {
      setLoadingCourts(false);
    }
  };

  const loadStaff = async (clubId: number) => {
    try {
      const res = await fetch(`/api/padel/clubs/${clubId}/staff`);
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.items)) {
        const staff = json.items as PadelStaff[];
        setClubStaff(staff);
        const inherited = staff.filter((s) => s.inheritToEvents).map((s) => s.id);
        if (selectedClubId === clubId) setSelectedStaffIds(inherited);
      } else {
        setClubStaff([]);
        setSelectedStaffIds([]);
      }
    } catch (err) {
      console.warn("[PadelWizard] load staff failed", err);
      setClubStaff([]);
      setSelectedStaffIds([]);
    }
  };

  const handleUploadCover = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadJson?.url) throw new Error(uploadJson?.error || "Falha no upload da imagem.");
      setCoverUrl(uploadJson.url as string);
    } catch (err) {
      console.error("[PadelWizard] upload cover", err);
      setError("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  // Quick fill
  const handleQuickFill = () => {
    const { start, end } = formatDateSuggestion();
    const clubLabel = selectedClub?.shortName || selectedClub?.name || defaults?.displayName || "Padel";
    setTitle((prev) => prev || `Open ${clubLabel}`);
    setStartsAt(start);
    setEndsAt(end);
    const favIds = selectedClub?.favoriteCategoryIds || [];
    const suggestedCat =
      (favIds[0] && categories.find((c) => c.id === favIds[0])) || categories[0];
    setTickets([
      {
        name: suggestedCat ? `Dupla ${suggestedCat.name}` : "Dupla Masculina 4/5",
        categoryId: suggestedCat?.id ?? null,
        price: "40",
        capacity: "16",
        registrationType: "TEAM",
      },
    ]);
    applyClubDefaults(selectedClub);
  };

  const addTicket = () => {
    setTickets((prev) => [...prev, { name: "", categoryId: null, price: "", capacity: "", registrationType: "TEAM" }]);
  };
  const updateTicket = (idx: number, field: keyof TicketRow, value: string | number | null) => {
    setTickets((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value as any } : t)),
    );
  };
  const removeTicket = (idx: number) => {
    setTickets((prev) => prev.filter((_, i) => i !== idx));
  };

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(title.trim() && startsAt && (city || selectedClub?.city) && selectedClubId);
    if (step === 2) return tickets.some((t) => t.name.trim() && t.price);
    return true;
  }, [step, title, startsAt, city, selectedClub?.city, tickets, selectedClubId]);

  const grossEstimate = useMemo(() => {
    return tickets.reduce((acc, t) => {
      const price = Number(t.price.replace(",", ".")) || 0;
      const cap = Number(t.capacity) || 0;
      return acc + price * cap;
    }, 0);
  }, [tickets]);

  const tournamentStateLabel =
    tournamentStateOptions.find((opt) => opt.value === tournamentState)?.label || "—";

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (!selectedClubId) {
        setError("Adiciona um clube de Padel e seleciona-o para continuares.");
        setStep(1);
        return;
      }
      const defaultRuleSetId = defaults?.padelDefaults?.ruleSetId ?? null;
      const payload = {
        title: title.trim(),
        startsAt,
        endsAt: endsAt || startsAt,
        locationCity: (city || selectedClub?.city || "").trim(),
        locationName: clubName.trim() || selectedClub?.shortName || selectedClub?.name || "",
        address: (address || selectedClub?.address || "").trim() || null,
        coverImageUrl: coverUrl,
        templateType: "PADEL",
        categories: ["DESPORTO"],
        feeMode: "ON_TOP",
        publicListingEnabled: listed,
        visibility,
        padelClubId: selectedClubId,
        partnerClubIds,
        courtsCount: courtsCount ? Number(courtsCount) : selectedClub?.courtsCount,
        tournamentState,
        advancedSettings: {
          maxEntriesTotal: maxEntriesTotal ? Number(maxEntriesTotal) : null,
          waitlistEnabled,
          allowSecondCategory,
          allowCancelGames,
          gameDurationMinutes: gameDuration ? Number(gameDuration) : null,
          categoriesMeta: tickets.map((t) => ({
            name: t.name.trim() || "Categoria",
            categoryId: t.categoryId ?? null,
            registrationType: t.registrationType ?? "TEAM",
            capacity: t.capacity ? Number(t.capacity) : null,
          })),
        },
        ticketTypes: tickets
          .filter((t) => t.name.trim())
          .map((t) => ({
            name: t.name.trim(),
            price: Number(t.price.replace(",", ".")) || 0,
            totalQuantity: t.capacity ? Number(t.capacity) : null,
          })),
          padel: {
            padelV2Enabled: true,
            ruleSetId: defaultRuleSetId,
            staffIds: selectedStaffIds,
            courtIds: selectedCourtIds.length ? selectedCourtIds : clubCourts.filter((c) => c.isActive).map((c) => c.id),
            inheritStaffCount: selectedStaffIds.length,
            inheritCourtsCount: selectedCourtIds.length || clubCourts.filter((c) => c.isActive).length || 0,
          },
      };

      const res = await fetch("/api/organizador/padel/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar torneio.");
      }
      if (json.event?.id) router.push(`/organizador/eventos/${json.event.id}`);
      else if (json.event?.slug) router.push(`/eventos/${json.event.slug}`);
      else router.push("/organizador/eventos");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao criar torneio.");
    } finally {
      setSubmitting(false);
    }
  };

  const formDisabled = !hasActiveClub && !loadingDefaults;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-white md:flex-row md:items-start md:px-8">
      <div className="flex-1 space-y-4">
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/55">Padel · Criar torneio</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Wizard rápido para clubes</h1>
            <button
              type="button"
              onClick={handleQuickFill}
              disabled={formDisabled}
              className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-40"
            >
              Criar torneio rápido
            </button>
          </div>
          <p className="text-sm text-white/65">3 passos: Básico → Categorias → Rever & criar. FULL/SPLIT geridos pela plataforma.</p>
        </header>

        {!hasActiveClub && !loadingDefaults && (
          <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Ainda não tens nenhum clube de Padel configurado.</p>
            <p className="text-amber-50/80">
              Vai a{" "}
              <Link href="/organizador/padel" className="underline">
                Padel → Clubes
              </Link>{" "}
              e adiciona pelo menos um clube para continuares.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 text-[12px]">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s as 1 | 2 | 3 | 4)}
              className={`rounded-full px-3 py-1 border border-white/15 ${
                step === s ? "bg-white text-black font-semibold" : "bg-black/40 text-white/70"
              }`}
            >
              {s === 1
                ? "1. Básico"
                : s === 2
                  ? "2. Categorias"
                  : s === 3
                    ? "3. Jogos & courts"
                    : "4. Rever"}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="space-y-1">
              <label className="text-sm">Clube *</label>
              <select
                value={selectedClubId ?? ""}
                onChange={(e) => setSelectedClubId(e.target.value ? Number(e.target.value) : null)}
                disabled={formDisabled}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
              >
                <option value="">Seleciona o clube</option>
                {clubs
                  .filter((c) => c.isActive)
                  .map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name} {club.city ? `· ${club.city}` : ""}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-white/60">
                Só clubes ativos são apresentados. Gerir em Padel → Clubes.
              </p>
            </div>
            {clubs.filter((c) => c.isActive && c.id !== selectedClubId).length > 0 && (
              <div className="space-y-1">
                <label className="text-sm">Clubes parceiros (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {clubs
                    .filter((c) => c.isActive && c.id !== selectedClubId)
                    .map((club) => {
                      const checked = partnerClubIds.includes(club.id);
                      return (
                        <label
                          key={club.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-[12px] ${
                            checked ? "border-white bg-white text-black" : "border-white/20 text-white/75"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPartnerClubIds((prev) => [...prev, club.id]);
                              } else {
                                setPartnerClubIds((prev) => prev.filter((id) => id !== club.id));
                              }
                            }}
                            disabled={formDisabled}
                          />
                          {club.name} {club.city ? `· ${club.city}` : ""}
                        </label>
                      );
                    })}
                </div>
                <p className="text-[11px] text-white/55">
                  Outside organizers podem usar vários clubes. Seleciona os parceiros para este torneio.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm">Imagem de capa</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-24 w-36 overflow-hidden rounded-xl border border-white/15 bg-black/30 text-[11px] text-white/60 flex items-center justify-center">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                  ) : (
                    "Sem imagem"
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10">
                  <span>{coverUrl ? "Substituir" : "Carregar imagem"}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleUploadCover(e.target.files?.[0] ?? null)}
                    disabled={uploadingCover || formDisabled}
                  />
                </label>
                {coverUrl && (
                  <button type="button" onClick={() => setCoverUrl(null)} className="text-[12px] text-white/70 underline">
                    Remover
                  </button>
                )}
                {uploadingCover && <span className="text-[11px] text-white/60">A carregar…</span>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm">Título *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                placeholder="Open do Clube"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                Início *
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                />
              </label>
              <label className="space-y-1 text-sm">
                Fim
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                Nome curto do evento
                <input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  placeholder="Clube XPTO"
                />
              </label>
              <label className="space-y-1 text-sm">
                Cidade *
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  placeholder="Porto, Lisboa…"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                Morada
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  placeholder="Rua e número"
                />
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Estado inicial do torneio</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tournamentStateOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTournamentState(opt.value)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left text-[12px] transition ${
                      tournamentState === opt.value
                        ? "border-white bg-white text-black shadow"
                        : "border-white/15 bg-black/30 text-white/75 hover:border-white/40"
                    }`}
                    disabled={formDisabled}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="text-[11px] text-white/60">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                Visibilidade
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                >
                  <option value="PUBLIC">Público</option>
                  <option value="PRIVATE">Privado</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Listagem
                <select
                  value={listed ? "yes" : "no"}
                  onChange={(e) => setListed(e.target.value === "yes")}
                  disabled={formDisabled}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                >
                  <option value="yes">Listar na página da organização</option>
                  <option value="no">Não listar</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Categorias & preço</h2>
                <p className="text-[11px] text-white/60">Preço por dupla (a plataforma divide por jogador automaticamente).</p>
              </div>
              <button
                type="button"
                onClick={addTicket}
                disabled={formDisabled}
                className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-40"
              >
                + Adicionar categoria
              </button>
            </div>
            {tickets.map((t, idx) => (
              <div key={idx} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={t.name}
                    onChange={(e) => updateTicket(idx, "name", e.target.value)}
                    placeholder="Nome (ex.: Dupla Masc 4/5)"
                    disabled={formDisabled}
                    className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  />
                  <button onClick={() => removeTicket(idx)} type="button" className="text-[11px] text-red-300">
                    Remover
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  <select
                    value={t.categoryId ?? ""}
                    onChange={(e) => updateTicket(idx, "categoryId", e.target.value ? Number(e.target.value) : null)}
                    disabled={formDisabled}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  >
                    <option value="">Categoria Padel</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.level ? ` · ${c.level}` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    value={t.registrationType}
                    onChange={(e) => updateTicket(idx, "registrationType", e.target.value as "TEAM" | "INDIVIDUAL")}
                    disabled={formDisabled}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  >
                    <option value="TEAM">Equipa / Dupla</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={t.price}
                    onChange={(e) => updateTicket(idx, "price", e.target.value)}
                    placeholder="Preço por dupla (€)"
                    disabled={formDisabled}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min={0}
                    value={t.capacity}
                    onChange={(e) => updateTicket(idx, "capacity", e.target.value)}
                    placeholder="Nº de duplas"
                    disabled={formDisabled}
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-white/55">
              Vagas = nº máximo de duplas nesta categoria. FULL + SPLIT e convites são geridos pela plataforma.
            </p>

            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-semibold"
              >
                Opções avançadas
                <span className="text-[11px] text-white/60">{advancedOpen ? "Esconder" : "Mostrar"}</span>
              </button>
              {advancedOpen && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    Limite total de inscrições
                    <input
                      type="number"
                      min={0}
                      value={maxEntriesTotal}
                      onChange={(e) => setMaxEntriesTotal(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
                      placeholder="ex.: 64"
                    />
                    <span className="text-[11px] text-white/55">Opcional. Bloqueia entradas extra.</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={waitlistEnabled}
                      onChange={(e) => setWaitlistEnabled(e.target.checked)}
                      className="accent-white"
                    />
                    Lista de espera quando lotado
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowSecondCategory}
                      onChange={(e) => setAllowSecondCategory(e.target.checked)}
                      className="accent-white"
                    />
                    Permitir 2ª categoria
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <h2 className="text-sm font-semibold">Jogos & courts</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              Nº de courts a usar
              <input
                type="number"
                min={1}
                max={1000}
                value={courtsCount}
                onChange={(e) => setCourtsCount(e.target.value)}
                disabled={formDisabled}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none disabled:opacity-50 [appearance:textfield]"
                placeholder={clubCourts.length ? String(clubCourts.filter((c) => c.isActive).length || clubCourts.length) : "4"}
              />
              <p className="text-[11px] text-white/60">Sugestão: {clubCourts.filter((c) => c.isActive).length || clubCourts.length || "—"} courts ativos neste clube.</p>
            </label>
            <label className="space-y-1 text-sm">
              Duração padrão de jogo (min)
              <input
                type="number"
                min={15}
                  max={240}
                  value={gameDuration}
                  onChange={(e) => setGameDuration(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="60"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={allowCancelGames}
                onChange={(e) => setAllowCancelGames(e.target.checked)}
                className="accent-white"
              />
              Permitir cancelamento de jogos na grelha
            </label>

            {selectedClub && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Courts do clube (seleciona)</span>
                  {loadingCourts && <span className="text-[11px] text-white/60">A carregar…</span>}
                </div>
                {clubCourts.length === 0 && !loadingCourts && (
                  <p className="text-[12px] text-white/65">Ainda não adicionaste courts a este clube.</p>
                )}
                {clubCourts.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {clubCourts.map((court) => {
                      const checked = selectedCourtIds.includes(court.id);
                      return (
                        <label
                          key={court.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                            checked ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-50" : "border-white/15 bg-black/30 text-white/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedCourtIds((prev) =>
                                e.target.checked ? [...prev, court.id] : prev.filter((id) => id !== court.id),
                              )
                            }
                            className="accent-white"
                          />
                          <span>{court.name}</span>
                          <span className="text-[10px] text-white/60">#{court.displayOrder}</span>
                          {court.indoor && <span className="text-[10px] uppercase tracking-[0.14em]">Indoor</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-white/55">
                  Podes gerir courts em Padel → Clubes. O nº de courts acima é usado para gerar o calendário inicial.
                </p>
                {selectedCourtIds.length === 0 && <p className="text-[11px] text-red-200">Seleciona pelo menos um court.</p>}
              </div>
            )}

            {selectedClub && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Staff herdado</span>
                </div>
                {clubStaff.length === 0 && (
                  <p className="text-[12px] text-white/65">Sem staff neste clube. Adiciona em Padel → Clubes.</p>
                )}
                {clubStaff.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {clubStaff.map((member) => {
                      const checked = selectedStaffIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                            checked ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-50" : "border-white/15 bg-black/30 text-white/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedStaffIds((prev) =>
                                e.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                              )
                            }
                            className="accent-white"
                          />
                          <span>{member.fullName || member.email || "Staff"}</span>
                          {member.inheritToEvents && <span className="text-[10px] text-emerald-300">herdado</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedStaffIds.length === 0 && clubStaff.length > 0 && (
                  <p className="text-[11px] text-red-200">Podes herdar staff (sugerido) — seleciona pelo menos um se precisares.</p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Revisão</h2>
            <div className="space-y-2 text-sm text-white/80">
              <p><strong>Título:</strong> {title || "—"}</p>
              <p><strong>Quando:</strong> {startsAt || "—"} → {endsAt || "—"}</p>
              <p><strong>Onde:</strong> {clubName || selectedClub?.shortName || selectedClub?.name || "—"}, {city || selectedClub?.city || "—"}</p>
              <p><strong>Clubes parceiros:</strong> {partnerClubIds.length ? `${partnerClubIds.length} selecionado(s)` : "—"}</p>
              <p><strong>Listagem:</strong> {visibility === "PUBLIC" ? "Público" : "Privado"} · {listed ? "Listado" : "Não listado"}</p>
              <p><strong>Estado inicial:</strong> {tournamentStateLabel}</p>
              <p><strong>Categorias:</strong> {tickets.length} linha(s)</p>
              <p><strong>Estimativa bruta:</strong> {grossEstimate.toFixed(2)} €</p>
              <p className="text-[11px] text-white/60">
                Courts: {selectedCourtIds.length || clubCourts.filter((c) => c.isActive).length || courtsCount || "—"} · Jogo: {gameDuration || "—"} min
              </p>
              <p className="text-[11px] text-white/60">Staff: {selectedStaffIds.length || 0} selecionado(s)</p>
              <p className="text-[11px] text-white/60">
                Avançadas: limite total {maxEntriesTotal || "—"} · Waitlist {waitlistEnabled ? "ativa" : "off"} · 2ª categoria {allowSecondCategory ? "permitida" : "não"} · Cancelar jogos {allowCancelGames ? "sim" : "não"}.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Anterior
        </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={!canNext || formDisabled}
              onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
            >
              Seguinte
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || formDisabled}
              onClick={handleSubmit}
              className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01] disabled:opacity-60"
            >
              {submitting ? "A criar…" : "Criar torneio de Padel"}
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      <aside className="sticky top-6 w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] md:w-80">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Pré-visualização</p>
        <div className="mt-3 space-y-3">
          <div className="h-36 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 text-[11px] text-white/60 flex items-center justify-center">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
            ) : (
              "Sem imagem"
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title || "Torneio sem título"}</h3>
            <p className="text-sm text-white/65">
              {(city || selectedClub?.city || "Cidade")} · {startsAt || "Data a definir"}
            </p>
          </div>
          <div className="space-y-1 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">Categorias & preço</p>
            {tickets.map((t, i) => (
              <div key={`${t.name}-${i}`} className="flex items-center justify-between text-white/80">
                <span>{t.name || "Sem nome"}</span>
                <span className="text-white">{t.price ? `${Number(t.price || 0).toFixed(2)} €` : "—"}</span>
              </div>
            ))}
            {tickets.length === 0 && <p className="text-[12px] text-white/55">Adiciona pelo menos uma categoria.</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
            <div className="flex items-center justify-between text-white/80">
              <span>Receita bruta estimada</span>
              <span className="text-base font-semibold">{grossEstimate.toFixed(2)} €</span>
            </div>
            <p className="text-[11px] text-white/55">Preço × vagas. FULL/SPLIT e fees tratados pela plataforma.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
