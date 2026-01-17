"use client";

import { useState } from "react";

type StoreVisibilityToggleProps = {
  endpoint: string;
  storeEnabled: boolean;
  initialStore: {
    showOnProfile: boolean;
  };
};

export default function StoreVisibilityToggle({
  endpoint,
  storeEnabled,
  initialStore,
}: StoreVisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialStore.showOnProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!storeEnabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const nextPublic = !isPublic;
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
      setIsPublic(Boolean(json.store?.showOnProfile));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = loading ? "A guardar..." : isPublic ? "Esconder loja" : "Publicar loja";
  const buttonTone = isPublic
    ? "border-rose-500/50 bg-rose-500/20 text-rose-50"
    : "border-emerald-400/60 bg-emerald-400/15 text-emerald-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={!storeEnabled || loading}
        className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 ${buttonTone}`}
      >
        {buttonLabel}
      </button>
      {error ? <span className="text-xs text-rose-200">{error}</span> : null}
    </div>
  );
}
