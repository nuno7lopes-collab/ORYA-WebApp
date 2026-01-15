"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type EventItem = {
  id: number;
  title: string;
  startsAt?: string | null;
  templateType?: string | null;
};

type EventsResponse = {
  ok: boolean;
  items: EventItem[];
  error?: string;
};

type HistoryItem = {
  broadcastId: string;
  title: string | null;
  body: string | null;
  eventId: number | null;
  eventTitle: string | null;
  eventTemplateType: string | null;
  createdAt: string;
  recipients: number;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

type HistoryResponse = { ok: boolean; items: HistoryItem[]; error?: string };

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MensagensClient() {
  const { data: eventsData } = useSWR<EventsResponse>(
    "/api/organizacao/events/list?limit=200",
    fetcher,
  );
  const {
    data: historyData,
    mutate: mutateHistory,
    isLoading: historyLoading,
  } = useSWR<HistoryResponse>("/api/organizacao/mensagens/history", fetcher);

  const events = useMemo(
    () => (eventsData?.ok ? eventsData.items : []),
    [eventsData],
  );
  const historyItems = useMemo(
    () => (historyData?.ok ? historyData.items : []),
    [historyData],
  );

  const [eventId, setEventId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === Number(eventId)) ?? null,
    [eventId, events],
  );

  const canSend = Boolean(eventId) && title.trim().length > 2 && body.trim().length > 4;

  const handleSend = async () => {
    if (!canSend || sending) return;
    setError(null);
    setSuccess(null);

    const ctaLabelTrimmed = ctaLabel.trim();
    const ctaUrlTrimmed = ctaUrl.trim();
    if ((ctaLabelTrimmed && !ctaUrlTrimmed) || (!ctaLabelTrimmed && ctaUrlTrimmed)) {
      setError("Define o texto e o link do CTA.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/organizacao/mensagens/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: Number(eventId),
          title: title.trim(),
          body: body.trim(),
          ctaLabel: ctaLabelTrimmed || null,
          ctaUrl: ctaUrlTrimmed || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Nao foi possivel enviar o anuncio.");
        setSending(false);
        return;
      }
      setTitle("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
      setSuccess(`Anuncio enviado para ${json?.recipients ?? 0} pessoas.`);
      mutateHistory();
    } catch (err) {
      console.error("[mensagens][broadcast] erro", err);
      setError("Erro inesperado ao enviar o anuncio.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#0b1124]/70 to-[#050a12]/92 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Anuncios</p>
            <h2 className="text-lg font-semibold text-white">Broadcast rapido</h2>
            <p className="text-[12px] text-white/65">
              Envia comunicacao a participantes de um evento ou torneio.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1.9fr]">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/55">Alvo</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.25)]"
            >
              <option value="">Selecionar evento/torneio</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} · {ev.templateType === "PADEL" ? "Torneio" : "Evento"}
                </option>
              ))}
            </select>
            {!eventsData?.ok && (
              <p className="text-[12px] text-red-300">{eventsData?.error || "Nao foi possivel carregar eventos."}</p>
            )}
            {eventsData?.ok && events.length === 0 && (
              <p className="text-[12px] text-white/60">Ainda nao tens eventos para anunciar.</p>
            )}
            {selectedEvent && (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                {selectedEvent.templateType === "PADEL" ? "Torneio" : "Evento"} ·{" "}
                {selectedEvent.startsAt ? formatDateTime(selectedEvent.startsAt) : "Sem data definida"}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.22em] text-white/55">Titulo</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.25)]"
                placeholder="Ex: Check-in aberto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-[0.22em] text-white/55">Mensagem</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.25)]"
                placeholder="Escreve a tua mensagem curta."
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.22em] text-white/55">CTA</label>
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.25)]"
                  placeholder="Ex: Abrir detalhes"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-[0.22em] text-white/55">Link</label>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#6BFFFF] focus:ring-2 focus:ring-[rgba(107,255,255,0.25)]"
                  placeholder="https://"
                />
              </div>
            </div>
            {error && <p className="text-[12px] text-red-300">{error}</p>}
            {success && <p className="text-[12px] text-emerald-200">{success}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canSend || sending}
                onClick={handleSend}
                className={cn(CTA_PRIMARY, "text-[12px]", (!canSend || sending) && "opacity-60")}
              >
                {sending ? "A enviar..." : "Enviar anuncio"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setBody("");
                  setCtaLabel("");
                  setCtaUrl("");
                  setError(null);
                  setSuccess(null);
                }}
                className={cn(CTA_SECONDARY, "text-[12px]")}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0b1226]/80 via-[#0b1124]/70 to-[#050a12]/92 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Historico</p>
            <h2 className="text-lg font-semibold text-white">Ultimos envios</h2>
          </div>
          <button
            type="button"
            onClick={() => mutateHistory()}
            className={cn(CTA_SECONDARY, "text-[12px]")}
          >
            Atualizar
          </button>
        </div>

        {historyLoading && <p className="mt-3 text-sm text-white/60">A carregar historico...</p>}
        {!historyLoading && historyItems.length === 0 && (
          <p className="mt-3 text-sm text-white/60">Ainda nao enviaste anuncios.</p>
        )}
        {historyItems.length > 0 && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {historyItems.map((item) => (
              <div
                key={item.broadcastId}
                className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-white/75 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">
                      {item.eventTemplateType === "PADEL" ? "Torneio" : "Evento"}
                    </p>
                    <p className="text-base font-semibold text-white">
                      {item.title || "Sem titulo"}
                    </p>
                    <p className="text-[12px] text-white/60">{item.eventTitle || "Sem alvo"}</p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {item.recipients} envios
                  </span>
                </div>
                <p className="text-[12px] text-white/70">{item.body}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                  <span>{formatDateTime(item.createdAt)}</span>
                  {item.ctaLabel && item.ctaUrl && (
                    <span className="rounded-full border border-white/20 px-2 py-0.5">
                      CTA: {item.ctaLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
