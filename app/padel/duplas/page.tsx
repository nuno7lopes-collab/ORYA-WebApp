"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Slot = {
  id: number;
  slotStatus: string;
  paymentStatus: string;
  slotRole: string;
  ticket?: { id: string; status: string | null } | null;
};

type Pairing = {
  id: number;
  paymentMode: string;
  pairingStatus: string;
  guaranteeStatus?: string | null;
  inviteToken: string | null;
  lockedUntil: string | null;
  deadlineAt?: string | null;
  slots: Slot[];
  event: { id: number; title: string; slug: string; templateType: string | null };
  category?: { label: string } | null;
};

export default function MinhasDuplasPage() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/padel/pairings/my");
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar duplas");
      setPairings(json.pairings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar duplas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const doAction = async (pairingId: number, action: "cancel" | "assume" | "regularize") => {
    setActionLoading(`${action}-${pairingId}`);
    try {
      const endpoint =
        action === "cancel"
          ? "cancel"
          : action === "assume"
            ? "assume"
            : "regularize";
      const res = await fetch(`/api/padel/pairings/${pairingId}/${endpoint}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Ação falhou");
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro na ação");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  };

  if (loading) return <div className="p-6 text-white">A carregar…</div>;
  if (error) return <div className="p-6 text-red-200">{error}</div>;

  return (
    <div className="min-h-screen text-white px-4 py-10">
      <div className="orya-page-width space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">As minhas duplas (Padel)</h1>
          <p className="text-white/70 text-sm">Acompanha o estado das tuas inscrições e pagamentos.</p>
        </div>

        {pairings.length === 0 && <p className="text-white/70 text-sm">Ainda não tens duplas.</p>}

        <div className="space-y-4">
          {pairings.map((p) => {
            const pendingSlot = p.slots.find((s) => s.slotStatus === "PENDING");
            const canPayPending = pendingSlot && pendingSlot.paymentStatus === "UNPAID" && p.paymentMode === "SPLIT";
            const inviteLink = p.inviteToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/eventos/${p.event?.slug ?? ""}?inviteToken=${p.inviteToken}` : null;
            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-lg font-semibold">{p.event.title}</p>
                    <p className="text-xs text-white/60">
                      {p.category?.label ? `${p.category.label} · ` : ""}Modo {p.paymentMode} · Estado {p.pairingStatus}
                    </p>
                  </div>
                  {p.lockedUntil && (
                    <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[12px] text-amber-100">
                      Limite: {formatDateTime(p.lockedUntil)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-white/75">
                  {p.slots.map((s) => (
                    <span key={s.id} className="rounded-full border border-white/15 px-2 py-1">
                      {s.slotRole} · {s.slotStatus} · {s.paymentStatus}
                    </span>
                  ))}
                </div>

            <div className="mt-4 flex gap-3 flex-wrap">
              {canPayPending && (
                <Link
                  href={`/eventos/${p.event?.slug ?? ""}?pairingId=${p.id}`}
                  className="rounded-full bg-white text-black px-4 py-2 text-sm font-semibold"
                >
                  Pagar o meu lugar
                </Link>
              )}
              {p.pairingStatus !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => doAction(p.id, "cancel")}
                  disabled={actionLoading === `cancel-${p.id}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-60"
                >
                  {actionLoading === `cancel-${p.id}` ? "A cancelar..." : "Cancelar dupla"}
                </button>
              )}
              {canPayPending && (
                <button
                  type="button"
                  onClick={() => doAction(p.id, "assume")}
                  disabled={actionLoading === `assume-${p.id}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-60"
                >
                  {actionLoading === `assume-${p.id}` ? "A assumir..." : "Assumir resto"}
                </button>
              )}
              {p.pairingStatus === "CANCELLED" && p.paymentMode === "SPLIT" && (
                <button
                  type="button"
                  onClick={() => doAction(p.id, "regularize")}
                  disabled={actionLoading === `regularize-${p.id}`}
                  className="rounded-full border border-emerald-300/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/10 disabled:opacity-60"
                >
                  {actionLoading === `regularize-${p.id}` ? "A regularizar..." : "Regularizar"}
                </button>
              )}
              {inviteLink && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                          .writeText(inviteLink)
                          .then(() => alert("Link copiado"))
                          .catch(() => alert("Não foi possível copiar o link"));
                      }}
                      className="rounded-full border border-white/20 px-4 py-2 text-sm"
                    >
                      Copiar link de convite
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
