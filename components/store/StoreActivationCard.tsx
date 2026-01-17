"use client";

import { useState } from "react";

type StoreSnapshot = {
  id: number;
  status: string;
  catalogLocked: boolean;
  checkoutEnabled: boolean;
  showOnProfile: boolean;
  createdAt: string;
  updatedAt: string;
};

type StoreActivationCardProps = {
  title: string;
  description: string;
  endpoint: string;
  storeEnabled: boolean;
  initialStore: StoreSnapshot | null;
};

export default function StoreActivationCard({
  title,
  description,
  endpoint,
  storeEnabled,
  initialStore,
}: StoreActivationCardProps) {
  const [store, setStore] = useState<StoreSnapshot | null>(initialStore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!storeEnabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar loja.");
      }
      setStore(json.store ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublic = async () => {
    if (!storeEnabled || loading || !store) return;
    setLoading(true);
    setError(null);
    try {
      const nextPublic = !store.showOnProfile;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "OPEN",
          catalogLocked: false,
          checkoutEnabled: true,
          showOnProfile: nextPublic,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar loja.");
      }
      setStore(json.store ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-white/55">Loja</p>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-white/70">{description}</p>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A funcionalidade da loja está desativada globalmente. Define `STORE_ENABLED=true` para continuar.
        </div>
      )}

      {store ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
              Estado
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80">
              {store.showOnProfile ? "Publica" : "Escondida"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/60">
              {store.showOnProfile ? "Visivel ao publico" : "Nao visivel ao publico"}
            </span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/75">
            {store.showOnProfile
              ? "A loja esta publica. Qualquer pessoa pode ver e comprar."
              : "A loja esta escondida do publico, mas continua pronta para gerir."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleTogglePublic()}
              disabled={!storeEnabled || loading}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "A guardar..." : store.showOnProfile ? "Esconder loja" : "Publicar loja"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-white/70">Ainda não tens loja criada.</p>
          <button
            type="button"
            disabled={!storeEnabled || loading}
            onClick={handleCreate}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "A criar..." : "Criar loja"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
    </section>
  );
}
