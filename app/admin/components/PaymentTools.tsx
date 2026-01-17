"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function PaymentTools() {
  const [pi, setPi] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleReprocess(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/payments/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: pi.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setStatus("error");
        setMessage(json?.error || "Falha a reprocessar PaymentIntent.");
        return;
      }
      setStatus("success");
      setMessage(`Reprocessado: ${json.paymentIntentId || pi}`);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Erro inesperado. Ver logs.");
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleReprocess} className="admin-card-soft space-y-2 p-3">
        <label className="text-[10px] uppercase tracking-[0.2em] text-white/45">Reprocessar PaymentIntent</label>
        <input
          type="text"
          value={pi}
          onChange={(e) => setPi(e.target.value)}
          placeholder="pi_..."
          className="admin-input"
          required
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="admin-button px-4 py-2 text-sm disabled:opacity-60"
        >
          {status === "loading" ? "A reprocessar..." : "Reprocessar"}
        </button>
        {message && (
          <p
            className={`text-[11px] ${
              status === "success" ? "text-emerald-200" : "text-rose-200"
            }`}
          >
            {message}
          </p>
        )}
        <p className="text-[10px] text-white/50">
          Usa este botão se um webhook falhou. Idempotente: se já houver bilhetes, não duplica.
        </p>
      </form>
    </div>
  );
}
