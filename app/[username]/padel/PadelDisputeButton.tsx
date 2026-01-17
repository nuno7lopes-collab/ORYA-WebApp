"use client";

import { useState } from "react";

type DisputeStatus = "OPEN" | "RESOLVED" | null;

export default function PadelDisputeButton({
  matchId,
  initialStatus = null,
  initialReason,
}: {
  matchId: number;
  initialStatus?: DisputeStatus;
  initialReason?: string | null;
}) {
  const [status, setStatus] = useState<DisputeStatus>(initialStatus ?? null);
  const [submittedReason, setSubmittedReason] = useState(initialReason ?? "");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Indica um motivo com pelo menos 5 caracteres.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/padel/matches/${matchId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const message =
          json?.error === "INVALID_REASON"
            ? "Motivo demasiado curto."
            : json?.error === "MATCH_NOT_DONE"
              ? "So podes contestar resultados finais."
              : json?.error === "DISPUTE_ALREADY_OPEN"
                ? "Este jogo ja esta em disputa."
                : json?.error || "Erro ao enviar contestacao.";
        setError(message);
        return;
      }
      setStatus("OPEN");
      setSubmittedReason(trimmed);
      setOpen(false);
      setReason("");
    } catch (err) {
      setError("Erro ao enviar contestacao.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      {status === "OPEN" && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 space-y-1">
          <p className="font-semibold">Disputa aberta</p>
          {submittedReason && <p className="text-amber-100/70">Motivo: {submittedReason}</p>}
        </div>
      )}
      {status === "RESOLVED" && (
        <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-50">
          Disputa resolvida.
        </div>
      )}
      {status === null && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Contestar resultado
        </button>
      )}
      {status === null && open && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80">
          <label className="flex flex-col gap-1">
            <span className="text-white/60">Motivo da contestacao</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] text-white"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-60"
            >
              {pending ? "A enviar..." : "Enviar contestacao"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReason("");
                setError(null);
              }}
              disabled={pending}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              Cancelar
            </button>
            {error && <span className="text-amber-200">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
