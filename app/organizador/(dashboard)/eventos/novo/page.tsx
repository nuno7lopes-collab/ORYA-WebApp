"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { PORTUGAL_CITIES } from "@/config/cities";

type ToastTone = "success" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
};

type PadelClubLite = {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
  courtsCount?: number | null;
  isActive?: boolean | null;
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

type PadelClubStaff = {
  id: number;
  padelClubId: number;
  userId: string | null;
  email: string | null;
  role: string;
  inheritToEvents: boolean;
};

const CATEGORY_OPTIONS = [
  { key: "padel", value: "SPORT", label: "Torneio de Padel", accent: "from-[#6BFFFF] to-[#22c55e]", categories: ["DESPORTO"], preset: "PADEL", soon: false },
  { key: "outro", value: "OTHER", label: "Outro tipo", accent: "from-[#9ca3af] to-[#6b7280]", categories: [], preset: "other", soon: false },
  { key: "restaurantes", value: "COMIDA", label: "Restaurantes", accent: "from-[#d4d4d8] to-[#9ca3af]", categories: ["COMIDA"], preset: "restaurante", soon: true },
  { key: "solidario", value: "VOLUNTEERING", label: "Solidário", accent: "from-[#d4d4d8] to-[#9ca3af]", categories: ["VOLUNTARIADO"], preset: "solidario", soon: true },
  { key: "festas", value: "PARTY", label: "Festas", accent: "from-[#d4d4d8] to-[#9ca3af]", categories: ["FESTA"], preset: "party", soon: true },
] as const;

const DEFAULT_PLATFORM_FEE_BPS = 800; // 8%
const DEFAULT_PLATFORM_FEE_FIXED_CENTS = 30; // €0.30
const DEFAULT_STRIPE_FEE_BPS = 140; // 1.4%
const DEFAULT_STRIPE_FEE_FIXED_CENTS = 25; // €0.25

type PlatformFeeResponse =
  | {
      ok: true;
      orya: { feeBps: number; feeFixedCents: number };
      stripe: { feeBps: number; feeFixedCents: number; region: string };
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function computeFeePreview(
  priceEuro: number,
  mode: "ON_TOP" | "INCLUDED",
  platformFees: { feeBps: number; feeFixedCents: number },
  stripeFees: { feeBps: number; feeFixedCents: number },
) {
  const baseCents = Math.round(Math.max(0, priceEuro) * 100);
  const feeCents = Math.round((baseCents * platformFees.feeBps) / 10_000) + platformFees.feeFixedCents;

  if (mode === "ON_TOP") {
    const totalCliente = baseCents + feeCents;
    const stripeOnTotal = Math.round((totalCliente * stripeFees.feeBps) / 10_000) + stripeFees.feeFixedCents;
    const recebeOrganizador = Math.max(0, baseCents - stripeOnTotal);
    return { baseCents, feeCents, totalCliente, recebeOrganizador, stripeFeeCents: stripeOnTotal };
  }

  const totalCliente = baseCents;
  const stripeOnBase = Math.round((totalCliente * stripeFees.feeBps) / 10_000) + stripeFees.feeFixedCents;
  const recebeOrganizador = Math.max(0, baseCents - feeCents - stripeOnBase);
  return { baseCents, feeCents, totalCliente, recebeOrganizador, stripeFeeCents: stripeOnBase };
}

export default function NewOrganizerEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();
  const { data: platformFeeData } = useSWR<PlatformFeeResponse>("/api/platform/fees", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: organizerStatus } = useSWR<{ paymentsStatus?: string; profileStatus?: string }>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [address, setAddress] = useState("");
  const [templateType, setTemplateType] = useState("OTHER");
  const [categories, setCategories] = useState<string[]>([]);
  const [padelFormat, setPadelFormat] = useState<"TODOS_CONTRA_TODOS" | "QUADRO_ELIMINATORIO">("TODOS_CONTRA_TODOS");
  const [padelCourts, setPadelCourts] = useState<number>(2);
  const [padelRuleSetId, setPadelRuleSetId] = useState<number | null>(null);
  const [padelMainClubId, setPadelMainClubId] = useState<number | null>(null);
  const [padelPartnerClubIds, setPadelPartnerClubIds] = useState<number[]>([]);
  const [padelClubCourts, setPadelClubCourts] = useState<PadelClubCourt[]>([]);
  const [padelClubStaff, setPadelClubStaff] = useState<PadelClubStaff[]>([]);
  const [padelSelectedCourtIds, setPadelSelectedCourtIds] = useState<number[]>([]);
  const [padelAdvancedOpen, setPadelAdvancedOpen] = useState(false);
  const [padelRegistrationLimit, setPadelRegistrationLimit] = useState<string>("");
  const [padelWaitlist, setPadelWaitlist] = useState(false);
  const [padelAllowSecondCategory, setPadelAllowSecondCategory] = useState(false);
  const [padelDetailsLoading, setPadelDetailsLoading] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([
    { name: "Normal", price: "", totalQuantity: "" },
  ]);
  const [feeMode, setFeeMode] = useState<"ON_TOP" | "INCLUDED">("ON_TOP");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const { data: padelClubsData } = useSWR<{ ok: boolean; items: PadelClubLite[] }>(
    selectedPreset === "padel" ? "/api/padel/clubs" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const isOrganizer = roles.includes("organizer");
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripeAlert, setStripeAlert] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [backendAlert, setBackendAlert] = useState<string | null>(null);
  const paymentsStatus = isAdmin ? "READY" : organizerStatus?.paymentsStatus ?? "NO_STRIPE";
  const ctaAlertRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startsRef = useRef<HTMLDivElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (message: string, tone: ToastTone = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  };

  const platformFees =
    platformFeeData && platformFeeData.ok
      ? platformFeeData.orya
      : { feeBps: DEFAULT_PLATFORM_FEE_BPS, feeFixedCents: DEFAULT_PLATFORM_FEE_FIXED_CENTS };
  const stripeFees =
    platformFeeData && platformFeeData.ok
      ? platformFeeData.stripe
      : { feeBps: DEFAULT_STRIPE_FEE_BPS, feeFixedCents: DEFAULT_STRIPE_FEE_FIXED_CENTS, region: "UE" };

  const presetMap = useMemo(() => {
    const map = new Map<string, (typeof CATEGORY_OPTIONS)[number]>();
    CATEGORY_OPTIONS.forEach((opt) => map.set(opt.key, opt));
    return map;
  }, []);
  const hasPaidTicket = useMemo(
    () => ticketTypes.some((t) => Number(t.price.replace(",", ".")) > 0),
    [ticketTypes],
  );
  const activePadelCourts = useMemo(() => padelClubCourts.filter((c) => c.isActive), [padelClubCourts]);
  const activePadelCourtsCount = activePadelCourts.length;
  const padelPartnerOptions = useMemo(
    () => (padelClubsData?.items || []).filter((c) => c.id !== padelMainClubId),
    [padelClubsData, padelMainClubId],
  );

  const ticketSummary = useMemo(
    () =>
      ticketTypes
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          price: Number(t.price.replace(",", ".")) || 0,
          quantity: t.totalQuantity ? Number(t.totalQuantity) : null,
        })),
    [ticketTypes],
  );

  useEffect(() => {
    if (selectedPreset !== "padel") {
      setPadelMainClubId(null);
      setPadelPartnerClubIds([]);
      setPadelClubCourts([]);
      setPadelClubStaff([]);
      setPadelSelectedCourtIds([]);
      return;
    }
    if (!padelMainClubId && padelClubsData?.items?.length) {
      const firstActive = padelClubsData.items.find((c) => c.isActive !== false) ?? padelClubsData.items[0];
      if (firstActive) setPadelMainClubId(firstActive.id);
    }
  }, [selectedPreset, padelClubsData, padelMainClubId]);

  useEffect(() => {
    if (selectedPreset !== "padel" || !padelMainClubId) return;
    const club = padelClubsData?.items?.find((c) => c.id === padelMainClubId);
    if (club) {
      if (!locationCity) setLocationCity(club.city || "");
      if (!address) setAddress(club.address || "");
      if (club.courtsCount && club.courtsCount > 0) setPadelCourts(club.courtsCount);
    }
    const loadDetails = async () => {
      setPadelDetailsLoading(true);
      try {
        const [courtsRes, staffRes] = await Promise.all([
          fetch(`/api/padel/clubs/${padelMainClubId}/courts`),
          fetch(`/api/padel/clubs/${padelMainClubId}/staff`),
        ]);
        const courtsJson = await courtsRes.json().catch(() => null);
        const staffJson = await staffRes.json().catch(() => null);
        if (Array.isArray(courtsJson?.items)) {
          setPadelClubCourts(courtsJson.items as PadelClubCourt[]);
          const activeCount = (courtsJson.items as PadelClubCourt[]).filter((c) => c.isActive).length;
          if (activeCount > 0) {
            setPadelCourts(activeCount);
            const sortedActive = (courtsJson.items as PadelClubCourt[])
              .filter((c) => c.isActive)
              .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
              .slice(0, activeCount)
              .map((c) => c.id);
            setPadelSelectedCourtIds(sortedActive);
          }
        } else {
          setPadelClubCourts([]);
        }
        if (Array.isArray(staffJson?.items)) {
          setPadelClubStaff(staffJson.items as PadelClubStaff[]);
        } else {
          setPadelClubStaff([]);
        }
      } catch (err) {
        console.error("[padel club details] load", err);
        setPadelClubCourts([]);
        setPadelClubStaff([]);
      } finally {
        setPadelDetailsLoading(false);
      }
    };
    loadDetails();
  }, [selectedPreset, padelMainClubId, padelClubsData]);

  useEffect(() => {
    if (selectedPreset !== "padel") return;
    const sortedActive = [...activePadelCourts].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    const maxCourts = Math.max(1, sortedActive.length || padelCourts || 1);
    const clampedCount = Math.min(Math.max(1, padelCourts || 1), maxCourts);
    if (padelCourts !== clampedCount) setPadelCourts(clampedCount);
    const availableIds = sortedActive.map((c) => c.id);
    const filteredSelection = padelSelectedCourtIds.filter((id) => availableIds.includes(id));
    let nextSelection = filteredSelection;
    if (nextSelection.length < clampedCount) {
      const toAdd = availableIds.filter((id) => !nextSelection.includes(id)).slice(0, clampedCount - nextSelection.length);
      nextSelection = [...nextSelection, ...toAdd];
    }
    nextSelection = nextSelection.slice(0, clampedCount);
    const unchanged =
      nextSelection.length === padelSelectedCourtIds.length &&
      nextSelection.every((id, idx) => id === padelSelectedCourtIds[idx]);
    if (!unchanged) {
      setPadelSelectedCourtIds(nextSelection);
    }
  }, [activePadelCourts, padelCourts, padelSelectedCourtIds, selectedPreset]);

  useEffect(() => {
    const typeParam = searchParams?.get("type")?.toUpperCase() ?? null;
    const keyParam = searchParams?.get("category") ?? searchParams?.get("preset");
    const templateTypeParam = searchParams?.get("templateType")?.toUpperCase() ?? null;
    const match = CATEGORY_OPTIONS.find(
      (opt) =>
        opt.value.toUpperCase() === typeParam ||
        opt.key === keyParam ||
        opt.preset === keyParam ||
        (templateTypeParam === "PADEL" && opt.key === "padel"),
    );
    if (match) {
      setSelectedPreset(match.key);
      setTemplateType(match.key === "padel" ? "SPORT" : match.value);
      setCategories(match.categories);
      if (match.key === "padel") {
        setPadelFormat("TODOS_CONTRA_TODOS");
        setTicketTypes([{ name: "Inscrição geral", price: "", totalQuantity: "" }]);
        setPadelPartnerClubIds([]);
      }
    }
  }, [searchParams]);

  const showForm = Boolean(selectedPreset);
  const ticketTitle = selectedPreset === "padel" ? "Inscrições" : "Bilhetes";
  const ticketNameLabel = selectedPreset === "padel" ? "Nome da inscrição *" : "Nome do bilhete *";
  const hideTicketCapacity = selectedPreset === "padel" && Boolean(padelRegistrationLimit);
  const FormAlert = ({
    variant,
    title: alertTitle,
    message,
    actionLabel,
    onAction,
  }: {
    variant: "error" | "warning" | "success";
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    const tones =
      variant === "error"
        ? "border-red-500/40 bg-red-500/10 text-red-100"
        : variant === "warning"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50";
    return (
      <div className={`rounded-md border px-4 py-3 text-sm ${tones}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            {alertTitle && <p className="font-semibold">{alertTitle}</p>}
            <p>{message}</p>
          </div>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-full border border-white/30 px-3 py-1 text-[11px] font-semibold hover:bg-white/10"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleSelectPreset = (key: string) => {
    const preset = presetMap.get(key);
    if (!preset || preset.soon) return;
    setSelectedPreset(preset.key);
    setTemplateType(preset.key === "padel" ? "SPORT" : preset.value);
    setCategories(preset.categories);
    if (preset.key === "padel") {
      setPadelFormat("TODOS_CONTRA_TODOS");
      setPadelCourts(2);
      setTicketTypes([{ name: "Inscrição geral", price: "", totalQuantity: "" }]);
      setPadelPartnerClubIds([]);
    }
    setErrorMessage(null);
  };

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: "/organizador/eventos/novo",
    });
  };

  const handleAddTicketType = () => {
    setTicketTypes((prev) => [
      ...prev,
      { name: "", price: "", totalQuantity: "" },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTicketChange = (
    index: number,
    field: keyof TicketTypeRow,
    value: string
  ) => {
    setTicketTypes((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadingCover(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro no upload de capa", err);
      setErrorMessage("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStripeAlert(null);
    setValidationAlert(null);
    setBackendAlert(null);

    if (!user) {
      handleRequireLogin();
      return;
    }

    if (!isOrganizer) {
      setErrorMessage(
        "Ainda não és organizador. Vai à área de organizador para ativares essa função."
      );
      return;
    }

    if (!selectedPreset) {
      setValidationAlert("Revê os campos em destaque antes de criar o evento.");
      setErrorMessage("Escolhe uma categoria para continuar.");
      return;
    }

    const scrollTo = (el?: HTMLElement | null) => el?.scrollIntoView({ behavior: "smooth", block: "center" });

    if (!title.trim()) {
      setValidationAlert("Revê os campos em destaque antes de criar o evento.");
      setErrorMessage("O título é obrigatório.");
      scrollTo(titleRef.current);
      titleRef.current?.classList.add("ring-1", "ring-red-400");
      setTimeout(() => titleRef.current?.classList.remove("ring-1", "ring-red-400"), 800);
      return;
    }

    if (!startsAt) {
      setValidationAlert("Revê os campos em destaque antes de criar o evento.");
      setErrorMessage("A data/hora de início é obrigatória.");
      scrollTo(startsRef.current);
      startsRef.current?.classList.add("ring-1", "ring-red-400");
      setTimeout(() => startsRef.current?.classList.remove("ring-1", "ring-red-400"), 800);
      return;
    }

    if (!locationCity.trim()) {
      setValidationAlert("Revê os campos em destaque antes de criar o evento.");
      setErrorMessage("A cidade é obrigatória.");
      scrollTo(cityRef.current);
      cityRef.current?.classList.add("ring-1", "ring-red-400");
      setTimeout(() => cityRef.current?.classList.remove("ring-1", "ring-red-400"), 800);
      return;
    }

    if (hasPaidTicket && paymentsStatus !== "READY") {
      setStripeAlert("Podes criar o evento, mas só vender bilhetes pagos depois de ligares o Stripe.");
      setErrorMessage("Para vender bilhetes pagos, liga a tua conta Stripe em Finanças & Payouts.");
      scrollTo(ctaAlertRef.current);
      return;
    }

    const preparedTickets = ticketTypes
      .map((row) => ({
        name: row.name.trim(),
        price: Number(row.price.replace(",", ".")) || 0,
        totalQuantity:
          selectedPreset === "padel" && padelRegistrationLimit
            ? Number(padelRegistrationLimit)
            : row.totalQuantity
                ? Number(row.totalQuantity)
                : null,
      }))
      .filter((t) => t.name);

    if (preparedTickets.length === 0) {
      setErrorMessage("Precisas de ter pelo menos um tipo de bilhete.");
      return;
    }

    setIsSubmitting(true);

    try {
      const padelPayload =
        selectedPreset === "padel"
          ? {
              format: padelFormat,
              numberOfCourts: Math.max(1, padelSelectedCourtIds.length || padelCourts || 1),
              ruleSetId: padelRuleSetId,
              defaultCategoryId: null,
              padelClubId: padelMainClubId,
              partnerClubIds: padelPartnerClubIds,
              advancedSettings: {
                registrationLimit: padelRegistrationLimit ? Number(padelRegistrationLimit) : undefined,
                waitlistEnabled: padelWaitlist,
                allowSecondCategory: padelAllowSecondCategory,
                courtsSnapshot: padelClubCourts,
                staffSnapshot: padelClubStaff,
                selectedCourtIds: padelSelectedCourtIds,
              },
            }
          : null;

      const payloadCategories =
        categories.length > 0 ? categories : selectedPreset === "padel" ? ["DESPORTO"] : [];

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startsAt,
        endsAt: endsAt || null,
        locationName: locationName.trim() || null,
        locationCity: locationCity.trim() || null,
        templateType: selectedPreset === "padel" ? "SPORT" : templateType,
        address: address.trim() || null,
        categories: payloadCategories,
        ticketTypes: preparedTickets,
        coverImageUrl: coverUrl,
        feeMode,
        isTest: isAdmin ? isTest : undefined,
        padel: padelPayload,
      };

      const res = await fetch("/api/organizador/events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao criar evento.");
      }

      const event = data.event;
      pushToast("Evento criado com sucesso.", "success");
      if (event?.id) {
        router.push(`/organizador/eventos/${event.id}`);
      } else if (event?.slug) {
        router.push(`/eventos/${event.slug}`);
      } else {
        router.push("/organizador/eventos");
      }
    } catch (err) {
      console.error("Erro ao criar evento de organizador:", err);
      const message = err instanceof Error ? err.message : null;
      setBackendAlert(message || "Algo correu mal ao guardar o evento. Tenta novamente em segundos.");
      scrollTo(ctaAlertRef.current);
      pushToast(message || "Não foi possível criar o evento agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p>A carregar a tua conta…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p>Precisas de iniciar sessão para criar eventos como organizador.</p>
        <button
          type="button"
          onClick={handleRequireLogin}
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Criar novo evento</h1>
        <p>Ainda não és organizador. Vai à área de organizador para ativar essa função.</p>
        <Link
          href="/organizador"
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Ir para área de organizador
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 md:px-6 lg:px-8 text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Novo evento</p>
          <h1 className="text-2xl font-semibold tracking-tight">Cria o teu evento</h1>
          <p className="text-sm text-white/70">
            Escolhe primeiro o tipo de evento, depois preenche os detalhes base. Podes ajustar bilhetes, lotações e página pública mais tarde.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Link
            href="/organizador"
            className="rounded-full border border-white/20 px-3 py-1.5 text-white/80 hover:bg-white/10 transition"
          >
            Voltar
          </Link>
        </div>
      </div>

      {!showForm && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Que tipo de evento queres criar?</h2>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORY_OPTIONS.filter((opt) => !opt.soon).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectPreset(opt.key)}
                  className={`flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-black/40 p-4 text-left transition hover:border-white/25 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${
                    selectedPreset === opt.key ? "border-white/30 ring-2 ring-[#6BFFFF]/40" : ""
                  }`}
                >
                  <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${opt.accent} px-3 py-1 text-[11px] font-semibold text-black shadow`}>
                    {opt.label}
                  </span>
                  <p className="text-sm text-white/80">
                    {opt.key === "padel" && "Torneios com equipas, courts e staff herdado do clube."}
                    {opt.key === "outro" && "Eventos gerais: festas, talks, concertos, etc."}
                  </p>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {CATEGORY_OPTIONS.filter((opt) => opt.soon).map((opt) => (
                <div
                  key={opt.key}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 text-left opacity-70"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${opt.accent} px-3 py-1 text-[11px] font-semibold text-black shadow`}>
                      {opt.label}
                    </span>
                    <span className="rounded-full bg-amber-300/20 px-2 py-[2px] text-[10px] text-amber-100">Em breve</span>
                  </div>
                  <p className="text-sm text-white/70">
                    {opt.key === "restaurantes" && "Reservas por slot e menus fixos chegam em breve."}
                    {opt.key === "solidario" && "Inscrições de voluntários e donativos."}
                    {opt.key === "festas" && "Guest lists, packs e consumo mínimo."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            {[
              { key: "info", label: "Info base" },
              { key: "tickets", label: ticketTitle },
              { key: "review", label: "Revisão" },
            ].map((step, idx) => (
              <div
                key={step.key}
                className="flex items-center gap-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[12px] font-semibold">
                  {idx + 1}
                </span>
                <span className="text-white/80">{step.label}</span>
                {idx < 2 && <span className="text-white/40">—</span>}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/45 p-4 md:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-white/60">Categoria escolhida:</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-semibold">
                  {presetMap.get(selectedPreset!)?.label ?? "Outro"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreset(null)}
                className="text-[11px] rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
              >
                Trocar categoria
              </button>
            </div>

            <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Detalhes do evento
              </h2>

              {isAdmin && (
                <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isTest}
                    onChange={(e) => setIsTest(e.target.checked)}
                    className="h-4 w-4 rounded border-white/40 bg-transparent"
                  />
                  <span className="text-white/80">
                    Evento de teste (visível só para admin, não aparece em explorar)
                  </span>
                </label>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Imagem de capa</label>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="h-32 w-48 rounded-xl border border-white/15 bg-black/30 overflow-hidden flex items-center justify-center text-[11px] text-white/60">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                    ) : (
                      <span>Sem imagem</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                        <span>{coverUrl ? "Substituir imagem" : "Adicionar imagem de capa"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={uploadingCover || !coverUrl}
                        onClick={() => setCoverUrl(null)}
                        className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 hover:bg-white/10 disabled:opacity-60"
                      >
                        Remover imagem
                      </button>
                    </div>
                    {uploadingCover && <span className="text-[11px] text-white/60">A carregar imagem…</span>}
                  </div>
                </div>
              </div>

              {selectedPreset === "padel" && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f1a3a] via-[#0d1731] to-[#0a1227] p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Padel – setup rápido</p>
                      <p className="text-white/80">Escolhe clube, courts e seguimos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPadelAdvancedOpen((p) => !p)}
                      className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white hover:border-white/35"
                    >
                      {padelAdvancedOpen ? "Fechar avançadas" : "Opções avançadas"}
                    </button>
                  </div>

                  {padelClubsData?.items?.length ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-[12px] text-white/70">Clube principal *</span>
                          <select
                            value={padelMainClubId ?? ""}
                            onChange={(e) => setPadelMainClubId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
                          >
                            <option value="">Escolhe o clube</option>
                            {padelClubsData.items.map((club) => (
                              <option key={club.id} value={club.id}>
                                {club.name} {club.isActive === false ? "(inativo)" : ""}
                              </option>
                            ))}
                          </select>
                          <p className="text-[12px] text-white/60">Usamos cidade/morada do clube ativo.</p>
                        </label>
                        <label className="space-y-1">
                          <div className="flex items-center justify-between text-[12px] text-white/70">
                            <span>Nº de courts (sugerido)</span>
                            <span className="rounded-full border border-white/20 px-2 py-[2px] text-[11px] text-white/80">
                              Máx: {Math.max(1, activePadelCourtsCount || 1)}
                            </span>
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={padelCourts}
                            max={Math.max(1, activePadelCourtsCount || 1)}
                            onChange={(e) => {
                              const next = Number(e.target.value) || 1;
                              const clamped = Math.min(Math.max(1, next), Math.max(1, activePadelCourtsCount || 1));
                              setPadelCourts(clamped);
                            }}
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
                          />
                          <p className="text-[12px] text-white/60">
                            Auto-preenchido pelos courts ativos do clube. Máximo = {Math.max(1, activePadelCourtsCount || 1)}.
                          </p>
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/70">
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                          {padelClubCourts.filter((c) => c.isActive).length} courts herdados
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                          {padelClubStaff.length} membros de staff
                        </span>
                        {padelDetailsLoading && <span className="text-white/60">A carregar courts & staff…</span>}
                        {!padelDetailsLoading && padelMainClubId && (
                          <span className="text-white/70">
                            Este torneio vai usar {Math.max(1, padelSelectedCourtIds.length || padelCourts || 1)} court(s) e {padelClubStaff.length} staff de {padelClubsData?.items.find((c) => c.id === padelMainClubId)?.name ?? "clube escolhido"}.
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-white/20 bg-black/30 p-3 text-white/75">
                      Sem clubes ainda. Cria no hub de Padel para pré-preencher o wizard.
                    </div>
                  )}

                  {padelAdvancedOpen && (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Clubes parceiros</p>
                          <div className="flex flex-wrap gap-2">
                            {padelPartnerOptions.length === 0 && (
                              <span className="text-[12px] text-white/60">Sem clubes extra ainda.</span>
                            )}
                            {padelPartnerOptions.map((club) => {
                              const checked = padelPartnerClubIds.includes(club.id);
                              return (
                                <label
                                  key={club.id}
                                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] ${
                                    checked ? "border-white bg-white text-black" : "border-white/20 bg-black/30 text-white"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setPadelPartnerClubIds((prev) => [...prev, club.id]);
                                      } else {
                                        setPadelPartnerClubIds((prev) => prev.filter((id) => id !== club.id));
                                      }
                                    }}
                                  />
                                  <span>{club.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-white">Courts a usar</p>
                          {activePadelCourtsCount === 0 && <p className="text-[12px] text-white/60">Sem courts ativos no clube.</p>}
                          {activePadelCourtsCount > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {activePadelCourts.map((court) => {
                                const checked = padelSelectedCourtIds.includes(court.id);
                                return (
                                  <button
                                    key={court.id}
                                    type="button"
                                    onClick={() => {
                                      if (checked && padelSelectedCourtIds.length <= 1) return;
                                      const next = checked
                                        ? padelSelectedCourtIds.filter((id) => id !== court.id)
                                        : [...padelSelectedCourtIds, court.id];
                                      setPadelSelectedCourtIds(next);
                                      if (next.length) setPadelCourts(next.length);
                                    }}
                                    className={`rounded-full border px-3 py-1 text-[12px] ${
                                      checked
                                        ? "border-white bg-white text-black"
                                        : "border-white/20 bg-black/30 text-white hover:border-white/40"
                                    }`}
                                  >
                                    {court.name} · {court.indoor ? "Indoor" : "Outdoor"}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="space-y-1">
                            <span className="text-[12px] text-white/70">Limite total de inscrições</span>
                            <input
                              type="number"
                              min={0}
                              value={padelRegistrationLimit}
                              onChange={(e) => setPadelRegistrationLimit(e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
                              placeholder="Ex.: 64 equipas"
                            />
                          </label>
                          <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                            {[
                              { key: true, label: "Lista de espera ON" },
                              { key: false, label: "Lista de espera OFF" },
                            ].map((opt) => (
                              <button
                                key={String(opt.key)}
                                type="button"
                                onClick={() => setPadelWaitlist(opt.key)}
                                className={`rounded-full px-3 py-1 transition ${
                                  padelWaitlist === opt.key
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
                              { key: true, label: "Permitir 2ª categoria" },
                              { key: false, label: "Só 1 categoria" },
                            ].map((opt) => (
                              <button
                                key={String(opt.key)}
                                type="button"
                                onClick={() => setPadelAllowSecondCategory(opt.key)}
                                className={`rounded-full px-3 py-1 transition ${
                                  padelAllowSecondCategory === opt.key
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
                          <p className="text-[12px] text-white/60">
                            Guardamos estes campos em advanced_settings para evoluir o wizard de Padel (lista de espera, 2ª categoria, courts).
                          </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Título *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  ref={titleRef}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                  placeholder="Ex.: Festa de abertura ORYA"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                  placeholder="Conta às pessoas o que podem esperar deste evento."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div ref={startsRef}>
                  <InlineDateTimePicker
                    label="Data/hora início *"
                    value={startsAt}
                    onChange={(v) => setStartsAt(v)}
                    minDateTime={new Date()}
                    required
                  />
                </div>
                <InlineDateTimePicker
                  label="Data/hora fim (opcional)"
                  value={endsAt}
                  onChange={(v) => setEndsAt(v)}
                  minDateTime={startsAt ? new Date(startsAt) : new Date()}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Local</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                    placeholder="Ex.: Casa &amp; Ala, Coliseu, Parque da Cidade…"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Cidade</label>
                  <div className="relative">
                    <input
                      list="pt-cities"
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      ref={cityRef}
                      className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                      placeholder="Porto, Braga, Lisboa…"
                    />
                    <datalist id="pt-cities">
                      {PORTUGAL_CITIES.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Rua / morada (opcional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                  placeholder="Ex.: Rua de exemplo, 123 (TODO: ligar a Mapbox Search)"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Modo de taxas</label>
                <select
                  value={feeMode}
                  onChange={(e) => setFeeMode(e.target.value as "ON_TOP" | "INCLUDED")}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                >
                  <option value="ON_TOP">Adicionar taxa ao preço (cliente paga)</option>
                  <option value="INCLUDED">Incluir taxa no preço (tu absorves)</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  {ticketTitle}
                </h2>
                <button
                  type="button"
                  onClick={handleAddTicketType}
                  className="inline-flex items-center rounded-md border border-white/15 bg-black/20 px-3 py-1 text-[13px] font-medium hover:border-white/40"
                >
                  + Adicionar {selectedPreset === "padel" ? "inscrição" : "tipo"}
                </button>
              </div>

              <div className="space-y-3">
                {ticketTypes.map((row, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 flex-1">
                        <label className="text-sm font-medium">{ticketNameLabel}</label>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleTicketChange(idx, "name", e.target.value)}
                          className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                          placeholder="Ex.: Early bird, Geral, VIP"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTicketType(idx)}
                        className="text-[11px] text-red-300 hover:text-red-200"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            {selectedPreset === "padel" ? "Preço / inscrição (€) *" : "Preço (€) *"}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.price}
                            onChange={(e) => handleTicketChange(idx, "price", e.target.value)}
                            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                            placeholder="Ex.: 12.50"
                          />
                          {selectedPreset === "padel" && (
                            <p className="text-[11px] text-white/60">
                              Chama-se “Inscrição geral” por defeito. Mantém curto e claro.
                            </p>
                          )}
                        </div>
                      {!hideTicketCapacity && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium">
                            {selectedPreset === "padel" ? "Limite desta inscrição" : "Capacidade (opcional)"}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={row.totalQuantity}
                            onChange={(e) => handleTicketChange(idx, "totalQuantity", e.target.value)}
                            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                            placeholder="Ex.: 100"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Pré-visualização de taxas</label>
                        <div className="text-[12px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white/70">
                          {(() => {
                            const priceEuro = Number(row.price || "0");
                            const preview = computeFeePreview(priceEuro, feeMode, platformFees, stripeFees);
                            return (
                              <div className="space-y-0.5">
                                <p>Cliente paga: {(preview.totalCliente / 100).toFixed(2)} €</p>
                                <p>Recebes: {(preview.recebeOrganizador / 100).toFixed(2)} €</p>
                                <p className="text-white/50">Taxas ORYA: {(preview.feeCents / 100).toFixed(2)} €</p>
                                <p className="text-white/50">Taxas Stripe: {(preview.stripeFeeCents / 100).toFixed(2)} €</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div ref={ctaAlertRef} className="space-y-3">
            {stripeAlert && (
              <FormAlert
                variant={hasPaidTicket ? "error" : "warning"}
                title="Stripe incompleto"
                message={stripeAlert}
                actionLabel="Abrir Finanças & Payouts"
                onAction={() => router.push("/organizador?tab=finance")}
              />
            )}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Revisão rápida</p>
              <div className="grid gap-3 sm:grid-cols-3 text-[13px] text-white/80">
                <div>
                  <p className="text-white/60 text-[11px]">Título</p>
                  <p className="font-semibold">{title || "—"}</p>
                </div>
                <div>
                  <p className="text-white/60 text-[11px]">Data/hora</p>
                  <p className="font-semibold">
                    {startsAt
                      ? new Date(startsAt).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-[11px]">Local</p>
                  <p className="font-semibold">{locationCity || locationName || "—"}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-[13px] text-white/80">
                <div className="space-y-1">
                  <p className="text-white/60 text-[11px]">{ticketTitle}</p>
                  {ticketSummary.length === 0 && <p className="text-white/60">Nenhuma {ticketTitle.toLowerCase()} configurada.</p>}
                  {ticketSummary.length > 0 && (
                    <div className="space-y-1">
                      {ticketSummary.map((t) => (
                        <div key={t.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                          <span className="font-semibold">{t.name}</span>
                          <span className="text-white/70">
                            {(t.price || 0).toFixed(2)} €{t.quantity ? ` · ${t.quantity} qty` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPreset === "padel" && (
                  <div className="space-y-1">
                    <p className="text-white/60 text-[11px]">Padel</p>
                    <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-white/75">
                      {padelMainClubId
                        ? `Clube: ${padelClubsData?.items.find((c) => c.id === padelMainClubId)?.name ?? "—"}, courts: ${Math.max(
                            1,
                            padelSelectedCourtIds.length || padelCourts || 1,
                          )}`
                        : "Escolhe um clube para pré-preencher courts e staff."}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {validationAlert && (
              <FormAlert variant="warning" message={validationAlert} />
            )}
            {errorMessage && (
              <FormAlert variant="error" message={errorMessage} />
            )}
            {backendAlert && (
              <FormAlert
                variant="error"
                title="Algo correu mal ao guardar o evento"
                message={backendAlert}
              />
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:scale-[1.01] disabled:opacity-60"
              >
                {isSubmitting ? "A criar..." : "Criar evento"}
              </button>
              <Link
                href="/organizador/eventos"
                className="inline-flex items-center rounded-md border border-white/15 bg-black/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </form>
      )}
    </div>
    {toasts.length > 0 && (
      <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[240px] rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50"
                : "border-red-400/50 bg-red-500/15 text-red-50"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    )}
    </>
  );
}
