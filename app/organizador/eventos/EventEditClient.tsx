"use client";

import { useState } from "react";
import Link from "next/link";
import { InlineDateTimePicker } from "@/app/components/forms/InlineDateTimePicker";
import { TicketTypeStatus } from "@prisma/client";

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
  };
  tickets: TicketTypeUI[];
  eventHasTickets?: boolean;
};

export function EventEditClient({ event, tickets, eventHasTickets }: EventEditClientProps) {
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
    setIsSaving(true);
    setError(null);
    setMessage(null);
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
          ticketTypeUpdates,
          newTicketTypes: newTicketsPayload,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar evento.");
      }

      setMessage("Evento atualizado com sucesso.");
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
    } catch (err) {
      console.error("Erro ao atualizar evento", err);
      setError(err instanceof Error ? err.message : "Erro ao atualizar evento.");
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
    } catch (err) {
      console.error("Erro ao terminar venda", err);
      setError(err instanceof Error ? err.message : "Erro ao terminar venda.");
    } finally {
      setIsSaving(false);
      setConfirmId(null);
      setConfirmText("");
    }
  };

  return (
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
      {error && (
        <div className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
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
          <InlineDateTimePicker
            label="Data/hora início"
            value={startsAt}
            onChange={(v) => setStartsAt(v)}
          />
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
          <Link href={`/organizador/estatisticas?eventId=${event.id}`} className="text-[11px] text-[#6BFFFF]">
            Ver estatísticas →
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
  );
}
