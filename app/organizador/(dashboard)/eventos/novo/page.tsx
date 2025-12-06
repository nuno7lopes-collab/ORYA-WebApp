"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";

type TicketTypeRow = {
  name: string;
  price: string;
  totalQuantity: string;
};

const CATEGORY_OPTIONS = [
  { key: "padel", value: "SPORT", label: "Torneio de Padel", accent: "from-[#6BFFFF] to-[#22c55e]", categories: ["DESPORTO"] },
  { key: "restaurantes", value: "COMIDA", label: "Restaurante & Jantar", accent: "from-[#f97316] to-[#facc15]", categories: ["COMIDA"] },
  { key: "solidario", value: "VOLUNTEERING", label: "Solidário / Voluntariado", accent: "from-[#10b981] to-[#22d3ee]", categories: ["VOLUNTARIADO"] },
  { key: "festas", value: "PARTY", label: "Festa & Noite", accent: "from-[#FF00C8] to-[#8b5cf6]", categories: ["FESTA"] },
  { key: "outro", value: "OTHER", label: "Outro tipo", accent: "from-[#9ca3af] to-[#6b7280]", categories: [] },
] as const;

const CATEGORY_CHECKBOXES = [
  { value: "DESPORTO", label: "Desporto / Padel" },
  { value: "COMIDA", label: "Restaurantes & Jantares" },
  { value: "FESTA", label: "Festa / Noite" },
  { value: "VOLUNTARIADO", label: "Solidário / Voluntariado" },
  { value: "PALESTRA", label: "Talks / Palestras" },
  { value: "ARTE", label: "Arte" },
  { value: "CONCERTO", label: "Concerto" },
  { value: "DRINKS", label: "Drinks" },
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
  const [ticketTypes, setTicketTypes] = useState<TicketTypeRow[]>([
    { name: "Normal", price: "", totalQuantity: "" },
  ]);
  const [feeMode, setFeeMode] = useState<"ON_TOP" | "INCLUDED">("ON_TOP");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

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

  useEffect(() => {
    const typeParam = searchParams?.get("type");
    const keyParam = searchParams?.get("category") ?? searchParams?.get("preset");
    const match = CATEGORY_OPTIONS.find(
      (opt) => opt.value === typeParam || opt.key === keyParam
    );
    if (match) {
      setSelectedPreset(match.key);
      setTemplateType(match.value);
      setCategories(match.categories);
    }
  }, [searchParams]);

  const showForm = Boolean(selectedPreset);
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
    if (!preset) return;
    setSelectedPreset(preset.key);
    setTemplateType(preset.value);
    setCategories(preset.categories);
    setErrorMessage(null);
  };

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: "/organizador/(dashboard)/eventos/novo",
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

    if (categories.length === 0) {
      setValidationAlert("Revê os campos em destaque antes de criar o evento.");
      setErrorMessage("Escolhe pelo menos uma categoria.");
      return;
    }

    const preparedTickets = ticketTypes
      .map((row) => ({
        name: row.name.trim(),
        price: Number(row.price.replace(",", ".")) || 0,
        totalQuantity: row.totalQuantity
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
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startsAt,
        endsAt: endsAt || null,
        locationName: locationName.trim() || null,
        locationCity: locationCity.trim() || null,
        templateType,
        address: address.trim() || null,
        categories,
        ticketTypes: preparedTickets,
        coverImageUrl: coverUrl,
        feeMode,
        isTest: isAdmin ? isTest : undefined,
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
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map((opt) => (
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
                  {opt.key === "padel" && "Torneios com equipas, jogos e ranking de padel."}
                  {opt.key === "restaurantes" && "Jantares, menus fixos e reservas por horário."}
                  {opt.key === "solidario" && "Angariação, donativos ou voluntariado."}
                  {opt.key === "festas" && "Festas, guest lists, packs e noite."}
                  {opt.key === "outro" && "Qualquer outro formato de evento."}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    ref={cityRef}
                    className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                    placeholder="Porto, Braga, Lisboa…"
                  />
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
                <label className="text-sm font-medium">Tipo de evento</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                >
                  <option value="PARTY">Festa</option>
                  <option value="SPORT">Desporto</option>
                  <option value="VOLUNTEERING">Voluntariado</option>
                  <option value="TALK">Palestra / Talk</option>
                  <option value="COMIDA">Restaurante / Jantar</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categorias (obrigatório)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORY_CHECKBOXES.map((cat) => {
                    const checked = categories.includes(cat.value);
                    return (
                      <label
                        key={cat.value}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition ${
                          checked
                            ? "bg-white text-black border-white shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                            : "bg-black/30 border-white/15 text-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCategories((prev) => [...prev, cat.value]);
                            } else {
                              setCategories((prev) => prev.filter((c) => c !== cat.value));
                            }
                          }}
                        />
                        <span className="h-2 w-2 rounded-full bg-white" />
                        <span>{cat.label}</span>
                      </label>
                    );
                  })}
                </div>
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
                  Bilhetes
                </h2>
                <button
                  type="button"
                  onClick={handleAddTicketType}
                  className="inline-flex items-center rounded-md border border-white/15 bg-black/20 px-3 py-1 text-[13px] font-medium hover:border-white/40"
                >
                  + Adicionar tipo
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
                        <label className="text-sm font-medium">Nome do bilhete *</label>
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
                        <label className="text-sm font-medium">Preço (€) *</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price}
                          onChange={(e) => handleTicketChange(idx, "price", e.target.value)}
                          className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                          placeholder="Ex.: 12.50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Capacidade (opcional)</label>
                        <input
                          type="number"
                          min={0}
                          value={row.totalQuantity}
                          onChange={(e) => handleTicketChange(idx, "totalQuantity", e.target.value)}
                          className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
                          placeholder="Ex.: 100"
                        />
                      </div>
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
  );
}
