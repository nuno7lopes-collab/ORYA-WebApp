"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PreviewPayload = {
  code: string;
  window?: { start: string | null; end: string | null };
  checkedInAt?: string | null;
  entitlement?: {
    id: string;
    status: string;
    holderKey: string;
    snapshotTitle: string;
    snapshotVenue: string | null;
    snapshotStartAt: string | null;
    snapshotTimezone: string | null;
  };
};

type Props = {
  backHref: string;
  backLabel: string;
  title?: string;
  subtitle?: string;
  allowOrganizerEvents?: boolean;
  embedded?: boolean;
  showBackLink?: boolean;
};

const STATUS_META: Record<
  string,
  { label: string; tone: string; canConfirm: boolean; hint: string }
> = {
  OK: {
    label: "Pronto para confirmar",
    tone: "border-emerald-400/50 bg-emerald-500/10 text-emerald-50",
    canConfirm: true,
    hint: "Confirma o check-in no passo seguinte.",
  },
  ALREADY_USED: {
    label: "Já usado",
    tone: "border-amber-400/50 bg-amber-500/10 text-amber-50",
    canConfirm: false,
    hint: "Este bilhete já foi validado.",
  },
  INVALID: {
    label: "QR inválido",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "O QR não está ativo ou expirou.",
  },
  REFUNDED: {
    label: "Reembolsado",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Bilhete reembolsado — não pode entrar.",
  },
  REVOKED: {
    label: "Revogado",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Bilhete revogado — não pode entrar.",
  },
  SUSPENDED: {
    label: "Suspenso",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Bilhete suspenso — pede ajuda ao organizador.",
  },
  NOT_ALLOWED: {
    label: "Não permitido",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Este QR não pertence a este evento.",
  },
  OUTSIDE_WINDOW: {
    label: "Fora da janela",
    tone: "border-amber-400/50 bg-amber-500/10 text-amber-50",
    canConfirm: false,
    hint: "Check-in só disponível na janela do evento.",
  },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "A definir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "A definir";
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function resolveMeta(code: string) {
  return STATUS_META[code] ?? {
    label: "Estado desconhecido",
    tone: "border-white/20 bg-white/5 text-white/80",
    canConfirm: false,
    hint: "Revê o QR e tenta novamente.",
  };
}

export function CheckinScanner({
  backHref,
  backLabel,
  title = "Modo Receção",
  subtitle = "Valida o Pass ORYA em 2 passos: pré-visualizar e confirmar.",
  allowOrganizerEvents = false,
  embedded = false,
  showBackLink = true,
}: Props) {
  const search = useSearchParams();
  const eventIdRaw = search.get("eventId");
  const eventId = eventIdRaw ? Number(eventIdRaw) : Number.NaN;
  const hasQueryEvent = Number.isFinite(eventId) && eventId > 0;
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    hasQueryEvent ? eventId : null,
  );
  const [events, setEvents] = useState<
    Array<{ id: number; title: string; startsAt: string | null; locationName: string | null }>
  >([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    if (hasQueryEvent) {
      setSelectedEventId(eventId);
    }
  }, [eventId, hasQueryEvent]);

  const effectiveEventId = hasQueryEvent ? eventId : selectedEventId ?? Number.NaN;
  const hasEvent = Number.isFinite(effectiveEventId) && effectiveEventId > 0;

  useEffect(() => {
    if (!allowOrganizerEvents || hasQueryEvent) return;
    let active = true;
    setEventsLoading(true);
    setEventsError(null);
    fetch("/api/organizador/events/list?limit=60")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Erro ao carregar eventos.");
        }
        if (!active) return;
        setEvents(data.items ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setEventsError(err instanceof Error ? err.message : "Erro ao carregar eventos.");
      })
      .finally(() => {
        if (active) setEventsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [allowOrganizerEvents, hasQueryEvent]);

  const [deviceId, setDeviceId] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.localStorage.getItem("oryaCheckinDeviceId");
    if (existing) {
      setDeviceId(existing);
      return;
    }
    const next =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `device-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem("oryaCheckinDeviceId", next);
    setDeviceId(next);
  }, []);

  const meta = useMemo(() => {
    const code = confirmedCode ?? preview?.code ?? "";
    const base = resolveMeta(code);
    if (confirmedCode === "OK") {
      return {
        ...base,
        label: "Check-in confirmado",
        hint: "Entrada validada com sucesso.",
        tone: "border-emerald-400/50 bg-emerald-500/10 text-emerald-50",
      };
    }
    return base;
  }, [preview, confirmedCode]);

  const handlePreview = async () => {
    setError(null);
    setPreview(null);
    setConfirmedCode(null);
    if (!qrToken.trim()) {
      setError("Indica o QR token.");
      return;
    }
    if (!hasEvent) {
      setError("Seleciona um evento válido.");
      return;
    }
    setPreviewing(true);
    try {
      const res = await fetch("/api/organizador/checkin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: qrToken.trim(), eventId: effectiveEventId }),
      });
      const data = (await res.json().catch(() => null)) as PreviewPayload | null;
      if (!res.ok) {
        setError(data?.code ? `Erro: ${data.code}` : "Não foi possível validar o QR.");
        setPreviewing(false);
        return;
      }
      setPreview(data);
    } catch (err) {
      console.error("[checkin][preview]", err);
      setError("Erro inesperado ao validar.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || preview.code !== "OK") return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/organizador/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: qrToken.trim(), eventId: effectiveEventId, deviceId }),
      });
      const data = (await res.json().catch(() => null)) as { code?: string } | null;
      if (!res.ok) {
        setError("Erro ao confirmar check-in.");
        setConfirming(false);
        return;
      }
      setConfirmedCode(data?.code ?? "OK");
    } catch (err) {
      console.error("[checkin][confirm]", err);
      setError("Erro inesperado ao confirmar.");
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setConfirmedCode(null);
    setQrToken("");
    setError(null);
  };

  const shellClass = embedded
    ? "relative w-full text-white"
    : "relative orya-body-bg min-h-screen w-full overflow-hidden text-white";
  const containerClass = embedded ? "relative mx-auto w-full max-w-5xl space-y-6" : "relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10";

  return (
    <div className={shellClass}>
      {!embedded && (
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
        </div>
      )}

      <section className={containerClass}>
        <div className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
          {showBackLink && (
            <a href={backHref} className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white">
              ← {backLabel}
            </a>
          )}
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-white/70">{subtitle}</p>
        </div>

        {!hasEvent && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-50">
            Precisas de escolher um evento para iniciar o check-in.
          </div>
        )}

        {allowOrganizerEvents && !hasQueryEvent && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Evento</p>
            <p className="mt-1 text-[12px] text-white/70">
              Seleciona o evento antes de validar o QR.
            </p>
            <div className="mt-3 space-y-2">
              <select
                value={selectedEventId ?? ""}
                onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
              >
                <option value="">Seleciona um evento</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
              {eventsLoading && <p className="text-[11px] text-white/60">A carregar eventos…</p>}
              {eventsError && <p className="text-[11px] text-red-300">{eventsError}</p>}
              {selectedEventId && (
                <p className="text-[11px] text-white/60">
                  {formatDateTime(events.find((ev) => ev.id === selectedEventId)?.startsAt ?? null)} ·{" "}
                  {events.find((ev) => ev.id === selectedEventId)?.locationName ?? "Local a anunciar"}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Passo 1</p>
            <h2 className="text-lg font-semibold">Validar o QR</h2>
            <p className="text-[12px] text-white/65">
              Introduz o QR token ou lê o código. A validação não consome o bilhete.
            </p>
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="QR token"
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
            />
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {previewing ? "A validar..." : "Validar QR"}
            </button>
            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>

          <div className="space-y-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Passo 2</p>
            <h2 className="text-lg font-semibold">Confirmar check-in</h2>
            <p className="text-[12px] text-white/65">
              Confirma apenas quando estiveres com a pessoa presente.
            </p>

            {preview || confirmedCode ? (
              <div className={`rounded-2xl border p-4 text-sm ${meta.tone}`}>
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">Estado</p>
                <p className="mt-1 text-lg font-semibold">{meta.label}</p>
                <p className="text-[12px] opacity-80">{meta.hint}</p>
                {preview?.entitlement && (
                  <div className="mt-3 space-y-1 text-[12px] text-white/85">
                    <p className="font-semibold">{preview.entitlement.snapshotTitle}</p>
                    <p>{preview.entitlement.holderKey}</p>
                    <p>{preview.entitlement.snapshotVenue ?? "Local a anunciar"}</p>
                    <p>{formatDateTime(preview.entitlement.snapshotStartAt)}</p>
                  </div>
                )}
                {preview?.checkedInAt && (
                  <p className="mt-2 text-[12px] opacity-80">
                    Check-in feito em {formatDateTime(preview.checkedInAt)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-[12px] text-white/70">
                Primeiro valida um QR para veres os detalhes.
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!preview || preview.code !== "OK" || confirming || Boolean(confirmedCode)}
              className="w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-50"
            >
              {confirming ? "A confirmar..." : confirmedCode ? "Check-in confirmado" : "Confirmar check-in"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-full border border-white/30 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              Novo check-in
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
