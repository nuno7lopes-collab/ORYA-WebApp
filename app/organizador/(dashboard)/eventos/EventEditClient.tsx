"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { useUser } from "@/app/hooks/useUser";

const TicketTypeStatus = {
  ON_SALE: "ON_SALE",
  UPCOMING: "UPCOMING",
  CLOSED: "CLOSED",
  SOLD_OUT: "SOLD_OUT",
} as const;

type TicketTypeStatus = (typeof TicketTypeStatus)[keyof typeof TicketTypeStatus];

type ToastTone = "success" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

type TicketTypeUI = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  totalQuantity: number | null;
  soldQuantity: number;
  status: TicketTypeStatus;
  startsAt: string | null;
  endsAt: string | null;
};

type EventEditClientProps = {
  event: {
    id: number;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    locationName: string | null;
    locationCity: string | null;
    address: string | null;
    templateType: string | null;
    isFree: boolean;
    coverImageUrl: string | null;
    feeModeOverride?: string | null;
    platformFeeBpsOverride?: number | null;
    platformFeeFixedCentsOverride?: number | null;
    payoutMode?: string | null;
  };
  tickets: TicketTypeUI[];
  eventHasTickets?: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function EventEditClient({ event, tickets }: EventEditClientProps) {
  const { user, profile } = useUser();
  const { data: organizerStatus } = useSWR<{ paymentsStatus?: string }>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(event.startsAt);
  const [endsAt, setEndsAt] = useState(event.endsAt);
  const [locationName, setLocationName] = useState(event.locationName ?? "");
  const [locationCity, setLocationCity] = useState(event.locationCity ?? "");
  const [address, setAddress] = useState(event.address ?? "");
  const [templateType] = useState(event.templateType ?? "OTHER");
  const [isFree] = useState(event.isFree);
  const [coverUrl, setCoverUrl] = useState<string | null>(event.coverImageUrl);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [ticketList, setTicketList] = useState<TicketTypeUI[]>(tickets);
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"title" | "startsAt" | "endsAt" | "locationCity" | "locationName", string>>>({});
  const [errorSummary, setErrorSummary] = useState<{ field: string; message: string }[]>([]);
  const steps = useMemo(
    () =>
      isFree
        ? [
            { key: "base", label: "Essenciais", desc: "Imagem e localização" },
            { key: "dates", label: "Datas & Local", desc: "Início e fim" },
            { key: "summary", label: "Revisão", desc: "Confirmar e guardar" },
          ]
        : [
            { key: "base", label: "Essenciais", desc: "Imagem e localização" },
            { key: "dates", label: "Datas & Local", desc: "Início e fim" },
            { key: "tickets", label: "Bilhetes / Inscrições", desc: "Gestão e vendas" },
          ],
    [isFree],
  );
  const freeCapacity = useMemo(() => {
    if (!isFree) return null;
    const total = ticketList.reduce((sum, t) => {
      if (t.totalQuantity == null) return sum;
      return sum + t.totalQuantity;
    }, 0);
    return total > 0 ? total : null;
  }, [isFree, ticketList]);

  const [newTicket, setNewTicket] = useState({
    name: "",
    description: "",
    priceEuro: "",
    totalQuantity: "",
    startsAt: "",
    endsAt: "",
  });

  const [endingIds, setEndingIds] = useState<number[]>([]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeAlert, setStripeAlert] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [backendAlert, setBackendAlert] = useState<string | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startsRef = useRef<HTMLDivElement | null>(null);
  const endsRef = useRef<HTMLDivElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
  const locationNameRef = useRef<HTMLInputElement | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (message: string, tone: ToastTone = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  };
  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
  const payoutMode = (event.payoutMode ?? "ORGANIZER").toUpperCase();
  const isPlatformPayout = payoutMode === "PLATFORM";
  const paymentsStatusRaw = isAdmin ? "READY" : organizerStatus?.paymentsStatus ?? "NO_STRIPE";
  const paymentsStatus = isPlatformPayout ? "READY" : paymentsStatusRaw;
  const hasPaidTicket = useMemo(
    () =>
      ticketList.some((t) => t.price > 0 && t.status !== TicketTypeStatus.CLOSED) ||
      (newTicket.priceEuro && Number(newTicket.priceEuro.replace(",", ".")) > 0),
    [ticketList, newTicket.priceEuro],
  );
  const templateLabel = templateType === "PADEL" ? "Padel" : "Evento padrão";
  const FormAlert = ({
    variant,
    title,
    message,
  }: {
    variant: "error" | "warning" | "success";
    title?: string;
    message: string;
  }) => {
    const tones =
      variant === "error"
        ? "border-red-500/40 bg-red-500/10 text-red-100"
        : variant === "warning"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
          : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50";
    return (
      <div className={`rounded-md border px-4 py-3 text-sm ${tones}`}>
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
      </div>
    );
  };

  const focusField = (field: string) => {
    const target =
      field === "title"
        ? titleRef.current
        : field === "startsAt"
          ? (startsRef.current?.querySelector("button") as HTMLElement | null)
        : field === "endsAt"
            ? (endsRef.current?.querySelector("button") as HTMLElement | null)
            : field === "locationCity"
              ? cityRef.current
              : field === "locationName"
                ? locationNameRef.current
                : null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  };

  const applyErrors = (issues: { field: string; message: string }[]) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      issues.forEach((issue) => {
        next[issue.field as keyof typeof next] = issue.message;
      });
      return next;
    });
    setErrorSummary(issues);
    if (issues.length > 0) {
      setTimeout(() => errorSummaryRef.current?.focus({ preventScroll: false }), 40);
    }
  };

  const clearErrorsForFields = (fields: string[]) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f as keyof typeof next]);
      return next;
    });
    setErrorSummary((prev) => prev.filter((err) => !fields.includes(err.field)));
  };

  const collectErrors = (step: number | "all") => {
    const stepsToCheck = step === "all" ? [0, 1] : [step];
    const issues: { field: string; message: string }[] = [];

    stepsToCheck.forEach((idx) => {
      if (idx === 0) {
        if (!title.trim()) issues.push({ field: "title", message: "Título obrigatório." });
        if (!locationName.trim()) issues.push({ field: "locationName", message: "Local obrigatório." });
        if (!locationCity.trim()) issues.push({ field: "locationCity", message: "Cidade obrigatória." });
      }
      if (idx === 1) {
        if (!startsAt) issues.push({ field: "startsAt", message: "Data/hora de início obrigatória." });
        if (endsAt && startsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
          issues.push({ field: "endsAt", message: "A data/hora de fim tem de ser depois do início." });
        }
      }
    });

    return issues;
  };

  const validateStep = (step: number) => {
    const issues = collectErrors(step);
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos assinalados antes de continuar.");
      setError(issues[0]?.message ?? null);
      return false;
    }
    clearErrorsForFields(step === 0 ? ["title", "locationCity", "locationName"] : ["startsAt", "endsAt"]);
    setValidationAlert(null);
    setError(null);
    return true;
  };

  useEffect(() => {
    if (title.trim()) clearErrorsForFields(["title"]);
  }, [title]);

  useEffect(() => {
    if (locationName.trim()) clearErrorsForFields(["locationName"]);
  }, [locationName]);

  useEffect(() => {
    if (locationCity.trim()) clearErrorsForFields(["locationCity"]);
  }, [locationCity]);

  useEffect(() => {
    if (startsAt) clearErrorsForFields(["startsAt"]);
  }, [startsAt]);

  useEffect(() => {
    if (!endsAt) {
      clearErrorsForFields(["endsAt"]);
      return;
    }
    if (startsAt && new Date(endsAt).getTime() >= new Date(startsAt).getTime()) {
      clearErrorsForFields(["endsAt"]);
    }
  }, [endsAt, startsAt]);

  const goNext = () => {
    const ok = validateStep(currentStep);
    if (!ok) return;
    if (currentStep < steps.length - 1) {
      setValidationAlert(null);
      setError(null);
      setErrorSummary([]);
      setCurrentStep((s) => s + 1);
    } else {
      handleSave();
    }
  };

  const goPrev = () => {
    setValidationAlert(null);
    setError(null);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da imagem.");
      }
      setCoverUrl(json.url as string);
    } catch (err) {
      console.error("Erro upload cover", err);
      setError("Não foi possível carregar a imagem de capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    setStripeAlert(null);
    setValidationAlert(null);
    setBackendAlert(null);
    setError(null);
    setMessage(null);

    const issues = collectErrors("all");
    if (issues.length > 0) {
      applyErrors(issues);
      setValidationAlert("Revê os campos assinalados antes de guardar o evento.");
      setError(issues[0]?.message ?? null);
      return;
    }
    clearErrorsForFields(["title", "locationCity", "locationName", "startsAt", "endsAt"]);

    if (hasPaidTicket && paymentsStatus !== "READY") {
      setStripeAlert("Podes gerir o evento, mas só vender bilhetes pagos depois de ligares o Stripe.");
      setError("Liga o Stripe em Finanças & Payouts para vender bilhetes pagos.");
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSaving(true);
    try {
      const ticketTypeUpdates = endingIds.map((id) => ({
        id,
        status: TicketTypeStatus.CLOSED,
      }));

      const newTicketsPayload =
        newTicket.name.trim() && newTicket.priceEuro
          ? [
              {
                name: newTicket.name.trim(),
                description: newTicket.description?.trim() || null,
                price: Math.round(Number(newTicket.priceEuro.replace(",", ".")) * 100) || 0,
                totalQuantity: newTicket.totalQuantity
                  ? Number(newTicket.totalQuantity)
                  : null,
                startsAt: newTicket.startsAt || null,
                endsAt: newTicket.endsAt || null,
              },
            ]
          : [];

      const res = await fetch("/api/organizador/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          title,
          description,
          startsAt,
          endsAt,
          locationName,
          locationCity,
          address,
          templateType,
          isFree,
          coverImageUrl: coverUrl,
          feeModeOverride: null,
          platformFeeBpsOverride: null,
          platformFeeFixedCentsOverride: null,
          ticketTypeUpdates,
          newTicketTypes: newTicketsPayload,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar evento.");
      }

      setMessage("Evento atualizado com sucesso.");
      pushToast("Evento atualizado com sucesso.", "success");
      setEndingIds([]);
      if (ticketTypeUpdates.length > 0) {
        setTicketList((prev) =>
          prev.map((t) =>
            endingIds.includes(t.id) ? { ...t, status: TicketTypeStatus.CLOSED } : t
          )
        );
      }
      if (newTicketsPayload.length > 0) {
        // Não temos ID do novo ticket aqui, mas podemos forçar refresh manual ou deixar como está.
        // Para feedback imediato, adicionamos placeholder sem ID real.
        setTicketList((prev) => [
          ...prev,
          {
            id: Date.now(), // placeholder local
            name: newTicketsPayload[0].name,
            description: newTicketsPayload[0].description ?? null,
            price: newTicketsPayload[0].price,
            currency: "EUR",
            totalQuantity: newTicketsPayload[0].totalQuantity ?? null,
            soldQuantity: 0,
            status: TicketTypeStatus.ON_SALE,
            startsAt: newTicketsPayload[0].startsAt,
            endsAt: newTicketsPayload[0].endsAt,
          },
        ]);
      }
      setNewTicket({
        name: "",
        description: "",
        priceEuro: "",
        totalQuantity: "",
        startsAt: "",
        endsAt: "",
      });
      setErrorSummary([]);
      setFieldErrors({});
      setMessage("Evento atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao atualizar evento", err);
      setBackendAlert(err instanceof Error ? err.message : "Erro ao atualizar evento.");
      pushToast(err instanceof Error ? err.message : "Erro ao atualizar evento.");
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setIsSaving(false);
    }
  };

  const openConfirmEnd = (id: number) => {
    setConfirmId(id);
    setConfirmText("");
  };

  const confirmEnd = async () => {
    if (!confirmId) return;
    if (confirmText.trim().toUpperCase() !== "TERMINAR VENDA") {
      setError('Escreve "TERMINAR VENDA" para confirmar.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizador/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeUpdates: [{ id: confirmId, status: TicketTypeStatus.CLOSED }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao terminar venda.");
      }
      setTicketList((prev) =>
        prev.map((t) => (t.id === confirmId ? { ...t, status: TicketTypeStatus.CLOSED } : t)),
      );
      setMessage("Venda terminada para este bilhete.");
      pushToast("Venda terminada para este bilhete.", "success");
    } catch (err) {
      console.error("Erro ao terminar venda", err);
      setError(err instanceof Error ? err.message : "Erro ao terminar venda.");
      pushToast(err instanceof Error ? err.message : "Erro ao terminar venda.");
    } finally {
      setIsSaving(false);
      setConfirmId(null);
      setConfirmText("");
    }
  };

  const progress = steps.length > 1 ? Math.min(100, (currentStep / (steps.length - 1)) * 100) : 100;

  const renderStepContent = () => {
    const baseBlock = (
      <div className="space-y-4">
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Título *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            ref={titleRef}
            aria-invalid={Boolean(fieldErrors.title)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
          {fieldErrors.title && (
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
              <span aria-hidden>⚠️</span>
              {fieldErrors.title}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Local *</label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              ref={locationNameRef}
              aria-invalid={Boolean(fieldErrors.locationName)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
            {fieldErrors.locationName && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.locationName}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Cidade *</label>
            <input
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              ref={cityRef}
              aria-invalid={Boolean(fieldErrors.locationCity)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
            {fieldErrors.locationCity && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.locationCity}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Morada</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Template</label>
          <div className="rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/80">
            {templateLabel}
          </div>
          <p className="text-[11px] text-white/55">O template não pode ser alterado depois de criar o evento.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          <p className="font-semibold text-white">Taxas</p>
          <p className="text-[12px] text-white/65">
            As taxas são definidas pela ORYA. O organizador não altera fee mode nem valores (para orgs de plataforma, taxa
            ORYA é zero; apenas taxa Stripe aplica).
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
          <p className="font-semibold text-white">Evento grátis</p>
          <p className="text-[12px] text-white/65">
            Só é possível definir se é grátis no momento da criação. Estado atual: {isFree ? "grátis" : "pago"}.
            {isFree && (
              <span className="block text-[12px] text-white/60 mt-1">
                Vagas/inscrições: {freeCapacity != null ? freeCapacity : "Sem limite definido"}.
              </span>
            )}
          </p>
        </div>
      </div>
    );

    const datesBlock = (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div ref={startsRef} className="space-y-1">
            <InlineDateTimePicker
              label="Data/hora início"
              value={startsAt}
              onChange={(v) => setStartsAt(v)}
            />
            {fieldErrors.startsAt && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.startsAt}
              </p>
            )}
          </div>
          <div ref={endsRef} className="space-y-1">
            <InlineDateTimePicker
              label="Data/hora fim"
              value={endsAt}
              onChange={(v) => setEndsAt(v)}
              minDateTime={startsAt ? new Date(startsAt) : undefined}
            />
            {fieldErrors.endsAt && (
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-100">
                <span aria-hidden>⚠️</span>
                {fieldErrors.endsAt}
              </p>
            )}
          </div>
        </div>
      </div>
    );

    const ticketsBlock = (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Bilhetes (não removemos, só terminamos venda)
          </h2>
          <Link href={`/organizador?tab=sales&eventId=${event.id}`} className="text-[11px] text-[#6BFFFF]">
            Ver vendas →
          </Link>
        </div>

        <div className="space-y-2">
          {ticketList.map((t) => {
            const price = (t.price / 100).toFixed(2);
            const remaining =
              t.totalQuantity !== null && t.totalQuantity !== undefined
                ? t.totalQuantity - t.soldQuantity
                : null;
            const isEnding = endingIds.includes(t.id) || t.status === TicketTypeStatus.CLOSED;

            return (
              <div
                key={t.id}
                className="rounded-xl border border-white/12 bg-black/30 p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-[11px] text-white/60">
                      {price} € • Vendidos: {t.soldQuantity}
                      {remaining !== null ? ` • Stock restante: ${remaining}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/75">
                    {isEnding ? "Venda terminada" : t.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => openConfirmEnd(t.id)}
                    disabled={t.status === TicketTypeStatus.CLOSED}
                    className={`rounded-full px-3 py-1 border ${
                      t.status === TicketTypeStatus.CLOSED
                        ? "border-white/15 text-white/40 cursor-not-allowed"
                        : "border-amber-300/60 text-amber-100 hover:bg-amber-500/10"
                    }`}
                  >
                    Terminar venda
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/12 bg-black/25 p-3 space-y-2">
          <p className="text-[12px] font-semibold">Adicionar novo bilhete</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              placeholder="Nome"
              value={newTicket.name}
              onChange={(e) => setNewTicket((p) => ({ ...p, name: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Preço (euros)"
              value={newTicket.priceEuro}
              onChange={(e) => setNewTicket((p) => ({ ...p, priceEuro: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Quantidade total"
              value={newTicket.totalQuantity}
              onChange={(e) => setNewTicket((p) => ({ ...p, totalQuantity: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              placeholder="Descrição (opcional)"
              value={newTicket.description}
              onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-white/70">
              Início vendas
              <input
                type="datetime-local"
                value={newTicket.startsAt}
                onChange={(e) => setNewTicket((p) => ({ ...p, startsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
            <div className="text-[11px] text-white/70">
              Fim vendas
              <input
                type="datetime-local"
                value={newTicket.endsAt}
                onChange={(e) => setNewTicket((p) => ({ ...p, endsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-[11px] text-white/50">
            Novo bilhete fica ON_SALE por padrão. Não removemos bilhetes antigos para manter histórico.
          </p>
        </div>
      </div>
    );

    const summaryBlock = (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Resumo rápido</p>
          <p className="text-white/70 text-sm mt-1">Confirma os detalhes antes de guardar.</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/80">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Evento</p>
              <p className="font-semibold">{title || "Sem título"}</p>
              <p className="text-white/60 text-sm line-clamp-2">{description || "Sem descrição"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Local e datas</p>
              <p>{locationName || "Local a definir"}</p>
              <p className="text-white/70">{locationCity || "Cidade a definir"}</p>
              <p className="text-white/70">
                {startsAt ? new Date(startsAt).toLocaleString() : "Início por definir"}{" "}
                {endsAt ? `→ ${new Date(endsAt).toLocaleString()}` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-white/60">Estado</p>
              <p className="font-semibold">{isFree ? "Evento grátis" : "Evento pago"}</p>
              {isFree && (
                <p className="text-white/70">
                  Vagas/inscrições: {freeCapacity != null ? freeCapacity : "Sem limite definido"}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    switch (steps[currentStep].key) {
      case "base":
        return baseBlock;
      case "dates":
        return datesBlock;
      case "tickets":
        return ticketsBlock;
      case "summary":
        return summaryBlock;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="space-y-6">
        {confirmId && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur">
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] space-y-3">
              <h3 className="text-lg font-semibold">Terminar venda do bilhete?</h3>
              <p className="text-sm text-white/70">
                Esta ação é definitiva para este tipo de bilhete. Escreve{" "}
                <span className="font-semibold">TERMINAR VENDA</span> para confirmar.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
                placeholder="TERMINAR VENDA"
              />
              <div className="flex justify-end gap-2 text-[12px]">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmId(null);
                    setConfirmText("");
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/75 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmEnd}
                  className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1 font-semibold text-black shadow"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Edição em passos</p>
              <p className="text-lg font-semibold text-white">Editar evento</p>
              <p className="text-sm text-white/60">
                Define o teu evento passo a passo. Podes guardar como rascunho em qualquer momento.
              </p>
            </div>
            <div className="text-right text-[12px] text-white/60">
              <p>Estado: {isFree ? "Grátis" : "Pago"}</p>
              <p>Template: {templateLabel}</p>
            </div>
          </div>

          {errorSummary.length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
            >
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>⚠️</span>
                <span>Revê estes campos antes de continuar</span>
              </div>
              <ul className="mt-2 space-y-1 text-[13px]">
                {errorSummary.map((err) => (
                  <li key={`${err.field}-${err.message}`}>
                    <button
                      type="button"
                      onClick={() => focusField(err.field)}
                      className="inline-flex items-center gap-2 text-left font-semibold text-white underline decoration-amber-200 underline-offset-4 hover:text-amber-50"
                    >
                      <span aria-hidden>↘</span>
                      <span>{err.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div className="relative h-1 rounded-full bg-white/10">
              <div
                className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {steps.map((step, idx) => {
                const state = idx === currentStep ? "active" : idx < currentStep ? "done" : "future";
                const allowClick = idx < currentStep;
                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => allowClick && setCurrentStep(idx)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-3 text-left transition ${
                      state === "active"
                        ? "border-white/40 bg-white/10 shadow"
                        : state === "done"
                          ? "border-white/15 bg-white/5 text-white/80"
                          : "border-white/10 bg-black/10 text-white/60"
                    } ${!allowClick ? "cursor-default" : "hover:border-white/30 hover:bg-white/5"}`}
                    disabled={!allowClick}
                  >
                    <div
                      className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full border ${
                        state === "active"
                          ? "border-white bg-white text-black shadow-[0_0_0_6px_rgba(255,255,255,0.08)]"
                          : state === "done"
                            ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100"
                            : "border-white/30 text-white/70"
                      }`}
                    >
                      {state === "done" ? "✔" : idx + 1}
                    </div>
                    <p className="text-sm font-semibold text-white">{step.label}</p>
                    <p className="text-[12px] text-white/60">{step.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            {renderStepContent()}
          </div>

          <div ref={ctaRef} className="space-y-3">
            {stripeAlert && (
              <FormAlert
                variant={hasPaidTicket ? "error" : "warning"}
                title="Stripe incompleto"
                message={stripeAlert}
              />
            )}
            {validationAlert && <FormAlert variant="warning" message={validationAlert} />}
            {error && <FormAlert variant="error" message={error} />}
            {backendAlert && (
              <FormAlert
                variant="error"
                title="Algo correu mal ao guardar o evento"
                message={backendAlert}
              />
            )}
            {message && <FormAlert variant="success" message={message} />}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentStep === 0 || isSaving}
                  className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Anterior
                </button>
                <Link
                  href={`/organizador/eventos/${event.id}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10"
                >
                  Voltar
                </Link>
              </div>
              <button
                type="button"
                onClick={goNext}
                disabled={isSaving}
                className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
              >
                {currentStep === steps.length - 1 ? (isSaving ? "A gravar…" : "Guardar alterações") : "Continuar"}
              </button>
            </div>
          </div>
        </div>
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
