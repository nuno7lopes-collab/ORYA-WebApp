"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";

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

type ConfirmPayload = {
  code?: string;
  checkedInAt?: string | null;
};

type Props = {
  backHref: string;
  backLabel: string;
  title?: string;
  subtitle?: string;
  allowOrganizationEvents?: boolean;
  embedded?: boolean;
  showBackLink?: boolean;
};

type ScannerState = "idle" | "previewing" | "previewReady" | "confirming" | "confirmed" | "error";
type CameraEngine = "manual" | "native" | "zxing";

type PreviewContext = {
  qrToken: string;
  eventId: number;
  entitlementId: string | null;
  previewAt: number;
  deviceId: string;
};

type MediaTrackWithTorch = MediaStreamTrack & {
  applyConstraints?: (constraints?: MediaTrackConstraints) => Promise<void>;
  getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean };
};

const CAMERA_SCANNER_ENABLED = process.env.NEXT_PUBLIC_CHECKIN_CAMERA_SCANNER !== "false";

const STATUS_META: Record<
  string,
  { label: string; tone: string; canConfirm: boolean; hint: string; toastVariant: "success" | "error" | "warning" | "info" }
> = {
  OK: {
    label: "Pronto para confirmar",
    tone: "border-emerald-400/50 bg-emerald-500/10 text-emerald-50",
    canConfirm: true,
    hint: "Confirma o check-in apenas com a pessoa presente.",
    toastVariant: "info",
  },
  ALREADY_USED: {
    label: "Já usado",
    tone: "border-amber-400/50 bg-amber-500/10 text-amber-50",
    canConfirm: false,
    hint: "Este bilhete já foi validado.",
    toastVariant: "warning",
  },
  INVALID: {
    label: "QR inválido",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "O QR não está ativo ou expirou.",
    toastVariant: "error",
  },
  REVOKED: {
    label: "Revogado",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Bilhete revogado, sem acesso.",
    toastVariant: "error",
  },
  SUSPENDED: {
    label: "Suspenso",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Bilhete suspenso, requer validação interna.",
    toastVariant: "error",
  },
  NOT_ALLOWED: {
    label: "Não permitido",
    tone: "border-red-400/50 bg-red-500/10 text-red-50",
    canConfirm: false,
    hint: "Este QR não pertence ao evento selecionado.",
    toastVariant: "warning",
  },
  OUTSIDE_WINDOW: {
    label: "Fora da janela",
    tone: "border-amber-400/50 bg-amber-500/10 text-amber-50",
    canConfirm: false,
    hint: "Check-in só disponível dentro da janela do evento.",
    toastVariant: "warning",
  },
};

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readEnvelopeData<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const payload = json as Record<string, unknown>;
  if (payload.data && typeof payload.data === "object") {
    return payload.data as T;
  }
  return payload as unknown as T;
}

function resolveMeta(code: string) {
  return STATUS_META[code] ?? {
    label: "Estado desconhecido",
    tone: "border-white/20 bg-white/5 text-white/80",
    canConfirm: false,
    hint: "Revê o QR e tenta novamente.",
    toastVariant: "warning" as const,
  };
}

function playFeedbackTone(success: boolean) {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = success ? 880 : 320;
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(context.destination);
  const now = context.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  oscillator.start(now);
  oscillator.stop(now + 0.15);
  void context.close();
}

export function CheckinScanner({
  backHref,
  backLabel,
  title = "Modo Receção",
  subtitle = "Valida o Pass ORYA em 2 passos: pré-visualizar e confirmar.",
  allowOrganizationEvents = false,
  embedded = false,
  showBackLink = true,
}: Props) {
  const search = useSearchParams();
  const pathname = usePathname();
  const { pushToast } = useToast();
  const orgId = useMemo(() => parseOrgIdFromPathnameStrict(pathname), [pathname]);
  const orgApiBase = orgId ? `/api/org/${orgId}` : null;

  const eventIdRaw = search.get("eventId");
  const eventId = eventIdRaw ? Number(eventIdRaw) : Number.NaN;
  const hasQueryEvent = Number.isFinite(eventId) && eventId > 0;
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    hasQueryEvent ? eventId : null,
  );
  const [events, setEvents] = useState<
    Array<{ id: number; title: string; startsAt: string | null; locationFormattedAddress: string | null }>
  >([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [deviceId, setDeviceId] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewContext, setPreviewContext] = useState<PreviewContext | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [liveMessage, setLiveMessage] = useState<string>("Pronto para validar.");

  const [enterConfirms, setEnterConfirms] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraEngine, setCameraEngine] = useState<CameraEngine>("manual");
  const [cameraDevices, setCameraDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [torchEnabled, setTorchEnabled] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (hasQueryEvent) {
      setSelectedEventId(eventId);
    }
  }, [eventId, hasQueryEvent]);

  const effectiveEventId = hasQueryEvent ? eventId : selectedEventId ?? Number.NaN;
  const hasEvent = Number.isFinite(effectiveEventId) && effectiveEventId > 0;

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

  useEffect(() => {
    if (!allowOrganizationEvents || hasQueryEvent) return;
    if (!orgApiBase) {
      setEvents([]);
      setEventsError("Contexto de organização inválido.");
      return;
    }
    let active = true;
    setEventsLoading(true);
    setEventsError(null);
    fetch(`${orgApiBase}/events/list?limit=60`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        const data = readEnvelopeData<{ ok?: boolean; items?: Array<{ id: number; title: string; startsAt: string | null; locationFormattedAddress: string | null }>; error?: string }>(json);
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
  }, [allowOrganizationEvents, hasQueryEvent, orgApiBase]);

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

  const isPreviewContextValid = useMemo(() => {
    if (!previewContext) return false;
    const token = qrToken.trim();
    return (
      token.length > 0 &&
      previewContext.qrToken === token &&
      previewContext.eventId === effectiveEventId &&
      previewContext.deviceId === deviceId
    );
  }, [deviceId, effectiveEventId, previewContext, qrToken]);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchEnabled(false);
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const announce = useCallback((message: string) => {
    setLiveMessage(message);
  }, []);

  const invalidatePreview = useCallback(
    (reason?: string) => {
      if (!previewContext) return;
      setPreview(null);
      setPreviewContext(null);
      setConfirmedCode(null);
      setState(reason ? "error" : "idle");
      if (reason) {
        setError(reason);
        announce(reason);
      }
    },
    [announce, previewContext],
  );

  useEffect(() => {
    if (!previewContext) return;
    const token = qrToken.trim();
    if (
      token !== previewContext.qrToken ||
      effectiveEventId !== previewContext.eventId ||
      (deviceId && previewContext.deviceId !== deviceId)
    ) {
      invalidatePreview("Pré-visualização invalidada. Valida novamente antes de confirmar.");
    }
  }, [deviceId, effectiveEventId, invalidatePreview, previewContext, qrToken]);

  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Câmara ${index + 1}`,
        }));
      setCameraDevices(cameras);
      if (!selectedCameraId && cameras[0]?.deviceId) {
        setSelectedCameraId(cameras[0].deviceId);
      }
    } catch {
      // ignore
    }
  }, [selectedCameraId]);

  const handleScannedToken = useCallback(
    (raw: string) => {
      const token = raw.trim();
      if (!token) return;
      setQrToken(token);
      setError(null);
      setConfirmedCode(null);
      announce("QR lido. A validar...");
    },
    [announce],
  );

  const startNativeLoop = useCallback(
    async (detector: { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>> }) => {
      const loop = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const token = results[0]?.rawValue?.trim();
          if (token) {
            handleScannedToken(token);
            stopCamera();
            return;
          }
        } catch {
          // noop
        }
        animationFrameRef.current = window.requestAnimationFrame(() => {
          void loop();
        });
      };
      await loop();
    },
    [handleScannedToken, stopCamera],
  );

  const startCamera = useCallback(async () => {
    if (!CAMERA_SCANNER_ENABLED) {
      setCameraError("Scanner por câmara desativado por configuração.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este navegador não suporta captura de câmara.");
      return;
    }

    setCameraLoading(true);
    setCameraError(null);
    setError(null);
    try {
      await refreshCameraDevices();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        throw new Error("Video indisponível.");
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);

      const globalWindow = window as typeof window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
        };
      };

      if (globalWindow.BarcodeDetector) {
        const detector = new globalWindow.BarcodeDetector({ formats: ["qr_code"] });
        setCameraEngine("native");
        void startNativeLoop(detector);
        announce("Scanner nativo ativo.");
        return;
      }

      const zxing = await import("@zxing/browser");
      const reader = new zxing.BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120 });
      setCameraEngine("zxing");
      zxingControlsRef.current = await reader.decodeFromVideoDevice(
        selectedCameraId || undefined,
        videoRef.current,
        (result) => {
          if (!result) return;
          const token = result.getText().trim();
          if (!token) return;
          handleScannedToken(token);
          stopCamera();
        },
      );
      announce("Scanner ZXing ativo.");
    } catch (err) {
      stopCamera();
      setCameraEngine("manual");
      setCameraError(err instanceof Error ? err.message : "Não foi possível iniciar a câmara.");
      announce("Falha no scanner por câmara. Mantém-se o modo manual.");
    } finally {
      setCameraLoading(false);
    }
  }, [announce, handleScannedToken, refreshCameraDevices, selectedCameraId, startNativeLoop, stopCamera]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0] as MediaTrackWithTorch | undefined;
    if (!track?.applyConstraints || !track?.getCapabilities) return;
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    if (!capabilities?.torch) return;
    try {
      const next = !torchEnabled;
      const advancedTorch = [{ torch: next }] as unknown as MediaTrackConstraintSet[];
      await track.applyConstraints({ advanced: advancedTorch });
      setTorchEnabled(next);
    } catch {
      // ignore
    }
  }, [torchEnabled]);

  const handlePreview = useCallback(
    async (tokenOverride?: string) => {
      setError(null);
      setPreview(null);
      setConfirmedCode(null);
      setPreviewContext(null);

      const token = (tokenOverride ?? qrToken).trim();
      if (!token) {
        const message = "Indica o QR token.";
        setError(message);
        setState("error");
        announce(message);
        return;
      }
      if (!hasEvent) {
        const message = "Seleciona um evento válido.";
        setError(message);
        setState("error");
        announce(message);
        return;
      }
      if (!orgApiBase) {
        const message = "Contexto de organização inválido.";
        setError(message);
        setState("error");
        announce(message);
        return;
      }

      setState("previewing");
      announce("A validar QR...");
      try {
        const res = await fetch(`${orgApiBase}/checkin/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken: token, eventId: effectiveEventId }),
        });
        const json = await res.json().catch(() => null);
        const data = readEnvelopeData<PreviewPayload>(json);
        if (!res.ok || !data) {
          throw new Error("Não foi possível validar o QR.");
        }

        setPreview(data);
        setPreviewContext({
          qrToken: token,
          eventId: effectiveEventId,
          entitlementId: data.entitlement?.id ?? null,
          previewAt: Date.now(),
          deviceId,
        });
        setState("previewReady");
        const status = resolveMeta(data.code);
        announce(`Pré-validação concluída: ${status.label}.`);
        if (data.code !== "OK") {
          pushToast(status.hint, { variant: status.toastVariant });
          if (soundEnabled) playFeedbackTone(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado ao validar.";
        setError(message);
        setState("error");
        announce(message);
        pushToast(message, { variant: "error" });
        if (soundEnabled) playFeedbackTone(false);
      }
    },
    [announce, deviceId, effectiveEventId, hasEvent, orgApiBase, pushToast, qrToken, soundEnabled],
  );

  const handleConfirm = useCallback(async () => {
    if (!preview || preview.code !== "OK") return;
    if (!previewContext || !isPreviewContextValid) {
      const message = "Dados alterados após pré-validação. Valida o QR novamente.";
      setError(message);
      setState("error");
      announce(message);
      pushToast(message, { variant: "warning" });
      if (soundEnabled) playFeedbackTone(false);
      return;
    }
    if (!orgApiBase) {
      const message = "Contexto de organização inválido.";
      setError(message);
      setState("error");
      announce(message);
      return;
    }

    setState("confirming");
    setError(null);
    announce("A confirmar check-in...");

    try {
      const res = await fetch(`${orgApiBase}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: qrToken.trim(), eventId: effectiveEventId, deviceId }),
      });
      const json = await res.json().catch(() => null);
      const data = readEnvelopeData<ConfirmPayload>(json);
      if (!res.ok || !data) {
        throw new Error("Erro ao confirmar check-in.");
      }
      const code = data.code ?? "OK";
      setConfirmedCode(code);
      if (code === "OK") {
        setState("confirmed");
        announce("Check-in confirmado com sucesso.");
        pushToast("Check-in confirmado.", { variant: "success" });
        if (soundEnabled) playFeedbackTone(true);
        if (autoAdvance) {
          window.setTimeout(() => {
            setPreview(null);
            setPreviewContext(null);
            setConfirmedCode(null);
            setQrToken("");
            setError(null);
            setState("idle");
            announce("Pronto para novo check-in.");
            inputRef.current?.focus();
          }, 900);
        }
      } else if (code === "ALREADY_USED") {
        setState("previewReady");
        announce("Este participante já tinha check-in.");
        pushToast("Já existia check-in para este QR.", { variant: "warning" });
        if (soundEnabled) playFeedbackTone(false);
      } else {
        setState("error");
        announce(`Confirmação bloqueada: ${code}.`);
        pushToast(`Confirmação bloqueada: ${code}.`, { variant: "warning" });
        if (soundEnabled) playFeedbackTone(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao confirmar.";
      setError(message);
      setState("error");
      announce(message);
      pushToast(message, { variant: "error" });
      if (soundEnabled) playFeedbackTone(false);
    }
  }, [announce, autoAdvance, deviceId, effectiveEventId, isPreviewContextValid, orgApiBase, preview, previewContext, pushToast, qrToken, soundEnabled]);

  const handleReset = useCallback(() => {
    setPreview(null);
    setPreviewContext(null);
    setConfirmedCode(null);
    setQrToken("");
    setError(null);
    setState("idle");
    announce("Pronto para novo check-in.");
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [announce]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!enterConfirms) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (state === "previewReady" && preview?.code === "OK") {
        event.preventDefault();
        void handleConfirm();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enterConfirms, handleConfirm, preview, state]);

  const shellClass = embedded
    ? "relative w-full text-white"
    : "relative min-h-screen w-full overflow-hidden text-white";
  const containerClass = embedded ? "relative mx-auto w-full max-w-5xl space-y-6" : "relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10";

  return (
    <div className={shellClass}>
      <section className={containerClass}>
        <div className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
          {showBackLink && (
            <a href={backHref} className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white">
              ← {backLabel}
            </a>
          )}
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-white/70">{subtitle}</p>
          <p role="status" aria-live="polite" className="text-xs text-white/65">
            {liveMessage}
          </p>
        </div>

        {!hasEvent && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-50">
            Precisas de escolher um evento para iniciar o check-in.
          </div>
        )}

        {allowOrganizationEvents && !hasQueryEvent && (
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
              {selectedEventId &&
                (() => {
                  const ev = events.find((item) => item.id === selectedEventId);
                  const dateLabel = formatDateTime(ev?.startsAt ?? null);
                  const locationLabel = ev?.locationFormattedAddress ?? null;
                  if (!dateLabel && !locationLabel) return null;
                  return (
                    <p className="text-[11px] text-white/60">
                      {dateLabel}
                      {dateLabel && locationLabel ? " · " : ""}
                      {locationLabel}
                    </p>
                  );
                })()}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Passo 1</p>
            <h2 className="text-lg font-semibold">Validar o QR</h2>
            <p className="text-[12px] text-white/65">
              Introduz token, usa scanner USB ou câmara. A pré-validação não consome o bilhete.
            </p>

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/80">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1">
                <input
                  type="checkbox"
                  checked={enterConfirms}
                  onChange={(event) => setEnterConfirms(event.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Enter confirma
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(event) => setSoundEnabled(event.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Som de feedback
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1">
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(event) => setAutoAdvance(event.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Auto-avanço
              </label>
            </div>

            <div className="rounded-2xl border border-white/12 bg-black/25 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Scanner por câmara</p>
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/70">
                  {cameraEngine === "native" ? "Nativo" : cameraEngine === "zxing" ? "ZXing" : "Manual"}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={selectedCameraId}
                  onChange={(event) => setSelectedCameraId(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
                >
                  <option value="">Câmara automática</option>
                  {cameraDevices.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      disabled={cameraLoading || !CAMERA_SCANNER_ENABLED}
                      className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-50"
                    >
                      {cameraLoading ? "A iniciar..." : "Iniciar câmara"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15"
                    >
                      Parar câmara
                    </button>
                  )}
                  {cameraActive ? (
                    <button
                      type="button"
                      onClick={() => void toggleTorch()}
                      className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15"
                    >
                      {torchEnabled ? "Lanterna off" : "Lanterna"}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/12 bg-black/40">
                <video ref={videoRef} className="h-[180px] w-full object-cover" muted playsInline />
              </div>
              {cameraError ? <p className="text-[12px] text-amber-200">{cameraError}</p> : null}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={qrToken}
              onChange={(e) => {
                setQrToken(e.target.value);
                setState("idle");
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handlePreview();
                }
              }}
              placeholder="QR token"
              className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF]"
            />
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={state === "previewing"}
              className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-60"
            >
              {state === "previewing" ? "A validar..." : "Validar QR"}
            </button>
            {error && (
              <p role="status" aria-live="polite" className="text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Passo 2</p>
            <h2 className="text-lg font-semibold">Confirmar check-in</h2>
            <p className="text-[12px] text-white/65">
              A confirmação consome a entrada e deve ser feita apenas com presença física.
            </p>

            {preview || confirmedCode ? (
              <div className={`rounded-2xl border p-4 text-sm ${meta.tone}`}>
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-80">Estado</p>
                <p className="mt-1 text-lg font-semibold">{meta.label}</p>
                <p className="text-[12px] opacity-80">{meta.hint}</p>
                {previewContext ? (
                  <p className="mt-2 text-[11px] opacity-75">
                    Preview: {new Date(previewContext.previewAt).toLocaleTimeString("pt-PT")} · Entitlement {previewContext.entitlementId || "N/D"}
                  </p>
                ) : null}
                {preview?.entitlement && (
                  <div className="mt-3 space-y-1 text-[12px] text-white/85">
                    <p className="font-semibold">{preview.entitlement.snapshotTitle}</p>
                    <p>{preview.entitlement.holderKey}</p>
                    {preview.entitlement.snapshotVenue ? (
                      <p>{preview.entitlement.snapshotVenue}</p>
                    ) : null}
                    {formatDateTime(preview.entitlement.snapshotStartAt) ? (
                      <p>{formatDateTime(preview.entitlement.snapshotStartAt)}</p>
                    ) : null}
                  </div>
                )}
                {preview?.checkedInAt && (
                  <p className="mt-2 text-[12px] opacity-80">
                    {formatDateTime(preview.checkedInAt)
                      ? `Check-in feito em ${formatDateTime(preview.checkedInAt)}`
                      : "Check-in confirmado"}
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
              onClick={() => void handleConfirm()}
              disabled={!preview || preview.code !== "OK" || state === "confirming" || Boolean(confirmedCode) || !isPreviewContextValid}
              className="w-full rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:opacity-50"
            >
              {state === "confirming" ? "A confirmar..." : confirmedCode ? "Check-in confirmado" : "Confirmar check-in"}
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
