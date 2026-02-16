"use client";

import { useEffect, useState } from "react";

type StoreSnapshot = {
  id: number;
  status: string;
  catalogLocked: boolean;
  checkoutEnabled: boolean;
  showOnProfile: boolean;
  publicProductsCount?: number;
  createdAt: string;
  updatedAt: string;
};

type StoreActivationCardProps = {
  title: string;
  description: string;
  endpoint: string;
  storeEnabled: boolean;
  initialStore: StoreSnapshot | null;
  onStoreChange?: (store: StoreSnapshot | null) => void;
};

export default function StoreActivationCard({
  title,
  description,
  endpoint,
  storeEnabled,
  initialStore,
  onStoreChange,
}: StoreActivationCardProps) {
  const [store, setStore] = useState<StoreSnapshot | null>(initialStore);
  const [pendingAction, setPendingAction] = useState<"toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = pendingAction !== null;

  useEffect(() => {
    setStore(initialStore);
  }, [initialStore]);

  const handleTogglePublic = async () => {
    if (!storeEnabled || loading || !store) return;
    setPendingAction("toggle");
    setError(null);
    try {
      const nextPublic = !store.showOnProfile;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showOnProfile: nextPublic,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar loja.");
      }
      const nextStore = json.store ?? null;
      setStore(nextStore);
      onStoreChange?.(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  };

  const publicProductsCount = Math.max(0, Number(store?.publicProductsCount ?? 0));

  return (
    <section className="rounded-3xl border border-white/14 bg-[linear-gradient(150deg,rgba(255,255,255,0.11),rgba(6,10,22,0.9)_48%,rgba(4,7,14,0.96))] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
      <div className="space-y-4">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-white/60">Loja</p>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-white/72">{description}</p>
        </header>

        {!storeEnabled ? (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
            A loja está temporariamente indisponível nesta instalação.
          </div>
        ) : null}

        {!store ? (
          <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white/75">
            A carregar estado da loja...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white/75">
              {store.showOnProfile
                ? "A loja está publicada no perfil público."
                : publicProductsCount < 1
                  ? "Para publicar, adiciona pelo menos 1 produto público."
                  : "A loja está escondida no perfil público."}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
                {store.showOnProfile ? "Publicada" : "Escondida"}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/70">
                Estado: {store.status}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/70">
                Produtos públicos: {publicProductsCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleTogglePublic()}
              disabled={!storeEnabled || loading}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.22)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {pendingAction === "toggle" ? "A guardar..." : store.showOnProfile ? "Esconder loja" : "Publicar loja"}
            </button>
          </div>
        )}

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
