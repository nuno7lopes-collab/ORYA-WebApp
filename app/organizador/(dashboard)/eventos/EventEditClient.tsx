"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { TicketTypeStatus } from "@prisma/client";
import { useUser } from "@/app/hooks/useUser";

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

export function EventEditClient({ event, tickets, eventHasTickets }: EventEditClientProps) {
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
  const [templateType, setTemplateType] = useState(event.templateType ?? "OTHER");
  const [isFree, setIsFree] = useState(event.isFree);
  const [coverUrl, setCoverUrl] = useState<string | null>(event.coverImageUrl);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [feeMode, setFeeMode] = useState<string>(event.feeModeOverride ?? "INHERIT");
  const [feeBpsOverride, setFeeBpsOverride] = useState<string>(
    event.platformFeeBpsOverride != null ? String(event.platformFeeBpsOverride) : "",
  );
  const [feeFixedOverride, setFeeFixedOverride] = useState<string>(
    event.platformFeeFixedCentsOverride != null ? String(event.platformFeeFixedCentsOverride) : "",
  );

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
  const [ticketList, setTicketList] = useState<TicketTypeUI[]>(tickets);
  const [stripeAlert, setStripeAlert] = useState<string | null>(null);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);
  const [backendAlert, setBackendAlert] = useState<string | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const startsRef = useRef<HTMLDivElement | null>(null);
  const cityRef = useRef<HTMLInputElement | null>(null);
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
      ticketList.some((t) => t.price > 0 && t.status !== TicketTypeStatus.CANCELLED) ||
      (newTicket.priceEuro && Number(newTicket.priceEuro.replace(",", ".")) > 0),
    [ticketList, newTicket.priceEuro],
  );
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

    const scrollTo = (el?: HTMLElement | null) =>
      el?.scrollIntoView({ behavior: "smooth", block: "center" });

    if (!title.trim()) {
      setValidationAlert("Revê os campos em destaque antes de guardar o evento.");
      setError("O título é obrigatório.");
      scrollTo(titleRef.current);
      titleRef.current?.classList.add("ring-1", "ring-red-400");
      setTimeout(() => titleRef.current?.classList.remove("ring-1", "ring-red-400"), 800);
      return;
    }

    if (!startsAt) {
      setValidationAlert("Revê os campos em destaque antes de guardar o evento.");
      setError("A data/hora de início é obrigatória.");
      scrollTo(startsRef.current);
      startsRef.current?.classList.add("ring-1", "ring-red-400");
      setTimeout(() => startsRef.current?.classList.remove("ring-1", "ring-red-400"), 800);
      return;
    }

    if (!locationCity.trim()) {
      setValidationAlert("Revê os campos em destaque antes de guardar o evento.");
      setError("A cidade é obrigatória.");
      scrollTo(cityRef.current);
      cityRef.current?.classList.add("ring-1", "ring-red-400");
      setTimeout(() => cityRef.current?.classList.remove("ring-1", "ring-red-400"), 800);
      return;
    }

    if (hasPaidTicket && paymentsStatus !== "READY") {
      setStripeAlert("Podes gerir o evento, mas só vender bilhetes pagos depois de ligares o Stripe.");
      setError("Para vender bilhetes pagos, liga a tua conta Stripe em Finanças & Payouts.");
      scrollTo(ctaRef.current);
      return;
    }

    setIsSaving(true);
    try {
      const ticketTypeUpdates = endingIds.map((id) => ({
        id,
        status: TicketTypeStatus.CLOSED,
      }));

      const normalizedFeeMode = feeMode === "INHERIT" ? null : feeMode;
      const feeBps =
        feeBpsOverride.trim() === "" ? null : Number(feeBpsOverride.replace(",", "."));
      const feeFixed =
        feeFixedOverride.trim() === "" ? null : Number(feeFixedOverride.replace(",", "."));

      if (feeBps !== null && (!Number.isFinite(feeBps) || feeBps < 0)) {
        setValidationAlert("Revê os campos em destaque antes de guardar o evento.");
        setError("Fee (%) inválido.");
        scrollTo(ctaRef.current);
        setIsSaving(false);
        return;
      }
      if (feeFixed !== null && (!Number.isFinite(feeFixed) || feeFixed < 0)) {
        setValidationAlert("Revê os campos em destaque antes de guardar o evento.");
        setError("Fee fixa inválida.");
        scrollTo(ctaRef.current);
        setIsSaving(false);
        return;
      }

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
          feeModeOverride: normalizedFeeMode,
          platformFeeBpsOverride: feeBps === null ? null : Math.floor(feeBps),
          platformFeeFixedCentsOverride: feeFixed === null ? null : Math.floor(feeFixed),
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
      setMessage("Evento atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao atualizar evento", err);
      setBackendAlert(err instanceof Error ? err.message : "Erro ao atualizar evento.");
      pushToast(err instanceof Error ? err.message : "Erro ao atualizar evento.");
      scrollTo(ctaRef.current);
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

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Dados do evento
        </h2>

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
          <label className="text-sm font-medium">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            ref={titleRef}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          />
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
          <div ref={startsRef}>
            <InlineDateTimePicker
              label="Data/hora início"
              value={startsAt}
              onChange={(v) => setStartsAt(v)}
            />
          </div>
          <InlineDateTimePicker
            label="Data/hora fim"
            value={endsAt}
            onChange={(v) => setEndsAt(v)}
            minDateTime={startsAt ? new Date(startsAt) : undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Local</label>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Cidade</label>
            <input
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              ref={cityRef}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
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
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
          >
            <option value="PARTY">Festa</option>
            <option value="SPORT">Desporto</option>
            <option value="VOLUNTEERING">Voluntariado</option>
            <option value="TALK">Palestra / Talk</option>
            <option value="OTHER">Outro</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Modo de fee</label>
            <select
              value={feeMode}
              onChange={(e) => setFeeMode(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            >
              <option value="INHERIT">Usar padrão do organizador</option>
              <option value="ADDED">Taxa adicionada ao bilhete</option>
              <option value="INCLUDED">Taxa incluída no preço</option>
            </select>
            <p className="text-[11px] text-white/60">Leave em “padrão” para herdar o configurado no painel.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Fee % (bps)</label>
            <input
              value={feeBpsOverride}
              onChange={(e) => setFeeBpsOverride(e.target.value)}
              placeholder="ex.: 200"
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
            <p className="text-[11px] text-white/60">Em basis points (200 = 2%). Vazio = usar padrão.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Fee fixa (cêntimos)</label>
            <input
              value={feeFixedOverride}
              onChange={(e) => setFeeFixedOverride(e.target.value)}
              placeholder="ex.: 0"
              className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/60"
            />
            <p className="text-[11px] text-white/60">Valor em cêntimos. Vazio = usar padrão.</p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
            disabled={eventHasTickets}
            className="h-4 w-4 rounded border-white/30 bg-black/30 disabled:opacity-50"
          />
          Evento grátis
          {eventHasTickets && (
            <span className="text-[11px] text-red-300">
              Não podes tornar grátis: já existem bilhetes neste evento.
            </span>
          )}
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
          >
            {isSaving ? "A gravar…" : "Guardar alterações"}
          </button>
          <Link
            href={`/organizador/eventos/${event.id}`}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Voltar
          </Link>
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
