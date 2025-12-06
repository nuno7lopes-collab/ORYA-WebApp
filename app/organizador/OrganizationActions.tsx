"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrganizationActions({ organizerId }: { organizerId: number }) {
  const router = useRouter();
  const [targetEmail, setTargetEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const call = async (url: string, body: Record<string, unknown>, method: "POST" | "DELETE" = "POST") => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Ação falhou. Tenta novamente.");
      } else {
        setSuccess("Ação concluída.");
        router.refresh();
      }
    } catch (err) {
      console.error("[OrganizationActions]", err);
      setError("Erro inesperado.");
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    if (!targetEmail.trim()) {
      setError("Indica o email/ID do novo owner.");
      return;
    }
    await call("/api/organizador/organizations/transfer", {
      organizerId,
      targetUserId: targetEmail.trim(),
    });
    if (!error) setTargetEmail("");
  };

  const handleLeave = async () => {
    await call("/api/organizador/organizations/leave", { organizerId });
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Esta ação remove a organização (soft delete). Se houver vendas ativas será bloqueado. Continuar?"
    );
    if (!confirmed) return;
    await call(`/api/organizador/organizations/${organizerId}`, {}, "DELETE");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-white">Gestão da organização</h3>
        <label className="text-[12px] text-white/70">Transferir propriedade</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            placeholder="Email ou ID do novo Owner"
          />
          <button
            type="button"
            onClick={handleTransfer}
            disabled={busy}
            className="rounded-full bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            Transferir
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLeave}
          disabled={busy}
          className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-60"
        >
          Sair desta organização
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="w-full rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100 hover:bg-red-500/20 disabled:opacity-60"
        >
          Apagar organização
        </button>
      </div>

      {(error || success) && (
        <p className={`text-[12px] ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || success}
        </p>
      )}
    </div>
  );
}
