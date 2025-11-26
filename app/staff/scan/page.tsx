

"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

type ValidateQrResponse = {
  ok: boolean;
  reason?: string;
  message?: string;
  ticketId?: string;
  eventId?: number;
  status?: string;
};

export default function StaffScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ValidateQrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/staff/events", { cache: "no-store" });
        if (res.status === 401) {
          window.location.href = `/staff/login?redirectTo=/staff/scan${eventId ? `?eventId=${eventId}` : ""}`;
          return;
        }
        const json = await res.json().catch(() => null);
        if (!json?.ok) {
          setError("Não tens sessão de staff válida.");
          return;
        }
        const events: { id: number }[] = Array.isArray(json?.events) ? json.events : [];
        const hasAccess =
          events.some((ev) => ev.id === eventId) || events.length > 0;
        if (!hasAccess) {
          setError("Não tens permissões para este evento como staff.");
          return;
        }
      } catch (e) {
        console.error("Erro ao validar sessão de staff:", e);
        setError("Erro ao validar sessão de staff.");
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Start camera
  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch (e) {
      console.error("Camera error:", e);
      setError("Não foi possível aceder à câmara.");
    }
  }

  // Fake scan (MVP) — real scanner virá depois
  async function simulateScan() {
    setError(null);
    setResult(null);
    const fake = prompt("Cola aqui o token ORYA2 para validar:");
    if (!fake) return;
    if (!eventId) {
      setError("Falta o eventId na URL. Abre o scanner a partir da página de eventos de staff.");
      return;
    }
    try {
      const res = await fetch("/api/staff/validate-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: fake, eventId }),
      });

      const json = await res.json();
      setResult(json);

      if (!res.ok || json?.ok === false) {
        setError("Bilhete inválido, expirado ou já utilizado.");
      }
    } catch (e) {
      console.error("Erro a validar QR:", e);
      setError("Erro ao comunicar com o servidor. Tenta novamente.");
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-white/70">A validar sessão de staff...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Scanner ORYA — Staff</h1>

      <p className="text-sm text-white/70 mb-4">
        {eventId
          ? `A validar bilhetes para o evento #${eventId}.`
          : "Nenhum evento seleccionado. Volta à página de eventos de staff e entra pelo botão 'Abrir scanner'."}
      </p>

      {eventId ? (
        <>
          {/* Camera Box */}
          <div className="w-full max-w-md mx-auto rounded-xl border border-white/20 bg-white/5 p-4">
            <video
              ref={videoRef}
              className="w-full rounded-lg"
              autoPlay
              muted
              playsInline
            />

            {!scanning && (
              <button
                onClick={startCamera}
                className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold"
              >
                Activar Câmara
              </button>
            )}
          </div>

          {error && (
            <p className="text-red-400 mt-4 text-center text-sm">{error}</p>
          )}

          {/* Fake Scan Button */}
          <div className="text-center mt-6">
            <button
              onClick={simulateScan}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold"
            >
              Simular Scan (MVP)
            </button>
          </div>

          {/* Result Box */}
          {result && (
            <div className="mt-6 p-4 rounded-xl border border-white/20 bg-white/5 max-w-md mx-auto">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </>
      ) : (
        <p className="mt-6 text-sm text-red-300">
          Nenhum evento seleccionado. Volta à página de eventos de staff e usa o
          botão Abrir scanner para escolher o evento certo.
        </p>
      )}
    </main>
  );
}
