"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type MeResponse = {
  ok: boolean;
  organizer?: { id: number; displayName?: string | null } | null;
  membershipRole?: string | null;
};

type ScanResultStatus = "OK" | "ALREADY_USED" | "CANCELLED" | "REFUNDED" | "INVALID" | "WRONG_EVENT";

type ScanResponse = {
  status: ScanResultStatus;
  message: string;
  ticket: {
    id: string;
    holderName: string | null;
    ticketTypeName: string | null;
    checkins: number;
    maxCheckins: number;
  } | null;
  checkedInAt: string | null;
  firstCheckinAt: string | null;
};

const statusTone: Record<ScanResultStatus, { bg: string; text: string }> = {
  OK: { bg: "bg-emerald-500", text: "text-emerald-50" },
  ALREADY_USED: { bg: "bg-amber-400", text: "text-amber-950" },
  CANCELLED: { bg: "bg-rose-500", text: "text-rose-50" },
  REFUNDED: { bg: "bg-rose-500", text: "text-rose-50" },
  INVALID: { bg: "bg-rose-600", text: "text-rose-50" },
  WRONG_EVENT: { bg: "bg-rose-600", text: "text-rose-50" },
};

function StatusBanner({ result }: { result: ScanResponse | null }) {
  if (!result) return null;
  const tone = statusTone[result.status];
  return (
    <div className={`rounded-2xl px-4 py-3 ${tone.bg} ${tone.text} shadow-lg`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{result.message}</p>
          {result.ticket && (
            <p className="text-xs opacity-80">
              {result.ticket.holderName || "Portador"} · {result.ticket.ticketTypeName || "Bilhete"}
            </p>
          )}
        </div>
        <div className="text-[11px] uppercase tracking-[0.18em]">{result.status}</div>
      </div>
      {result.checkedInAt && (
        <p className="mt-1 text-[12px] opacity-80">Check-in: {new Date(result.checkedInAt).toLocaleTimeString()}</p>
      )}
      {result.firstCheckinAt && result.status === "ALREADY_USED" && (
        <p className="text-[12px] opacity-80">Primeiro uso: {new Date(result.firstCheckinAt).toLocaleString()}</p>
      )}
    </div>
  );
}

export default function ScanClient() {
  const { user, isLoading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const eventIdParam = searchParams?.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const { data: me } = useSWR<MeResponse>(user ? "/api/organizador/me" : null, fetcher, { revalidateOnFocus: false });

  const [ticketCode, setTicketCode] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.localStorage.getItem("orya_scan_device");
    if (existing) setDeviceId(existing);
    else {
      const random = crypto.randomUUID();
      setDeviceId(random);
      window.localStorage.setItem("orya_scan_device", random);
    }
  }, []);

  const resolvedEventId = useMemo(() => {
    if (!eventId || Number.isNaN(eventId)) return null;
    return eventId;
  }, [eventId]);

  const canScan = Boolean(me?.membershipRole === "OWNER" || me?.membershipRole === "CO_OWNER" || me?.membershipRole === "ADMIN" || me?.membershipRole === "STAFF");

  const handleScan = async () => {
    if (!resolvedEventId) {
      setError("Seleciona um evento válido.");
      return;
    }
    if (!ticketCode.trim()) {
      setError("Introduz um código/QR.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: resolvedEventId, ticketCode: ticketCode.trim(), deviceId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Sem permissão para fazer check-in.");
        setResult(null);
        return;
      }
      setResult(json as ScanResponse);
      setTicketCode("");
    } catch (err) {
      console.error("[scan]", err);
      setError("Erro inesperado ao validar bilhete.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleScan();
    }
  };

  if (userLoading) {
    return <div className="p-6 text-white/70">A carregar…</div>;
  }

  if (!user) {
    return (
      <div className="p-6 text-white/80 space-y-3">
        <p className="text-lg font-semibold">Precisas de iniciar sessão para fazer check-in.</p>
        <Link href="/login" className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-black shadow">
          Entrar
        </Link>
      </div>
    );
  }

  if (!canScan) {
    return (
      <div className="p-6 space-y-3 text-white/80">
        <p className="text-lg font-semibold">Sem permissão para scan.</p>
        <p className="text-sm text-white/60">Pede ao Owner/Co-owner/Admin para te dar acesso ou adicionar-te como staff deste evento.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] via-[#0A0F1A] to-black text-white px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Check-in / QR</p>
          <h1 className="text-3xl font-bold">Scanner rápido</h1>
          <p className="text-sm text-white/70">Optimizado para telemóvel. Usa a câmara nativa ou introduz o código.</p>
        </div>
        <Link href="/organizador" className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white hover:bg-white/10">
          Dashboard
        </Link>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col gap-3">
          <label className="text-[12px] text-white/70">Código do bilhete / QR</label>
          <input
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value)}
            onKeyDown={handleKey}
            className="w-full rounded-2xl border border-white/15 bg-black/30 px-3 py-3 text-lg outline-none focus:border-[#6BFFFF]"
            placeholder="Lê o QR ou cola o código"
            autoFocus
          />
          <button
            type="button"
            onClick={handleScan}
            disabled={loading}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow disabled:opacity-60"
          >
            {loading ? "A validar…" : "Validar entrada"}
          </button>
          {error && <p className="text-[12px] text-rose-200">{error}</p>}
        </div>
        <StatusBanner result={result} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3 text-sm text-white/70 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
        <p className="text-[12px] uppercase tracking-[0.2em] text-white/50">Modo mobile</p>
        <p>Para usar a câmara nativa, abre o leitor de QR do telemóvel e escolhe “Abrir app”. Este ecrã fica pronto para colar o código.</p>
        <p className="text-[12px] text-white/60">Em breve: leitura direta da câmara.</p>
      </div>
    </div>
  );
}
