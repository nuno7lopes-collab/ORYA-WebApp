"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [store, setStore] = useState<StoreSnapshot | null>(initialStore);
  const [pendingAction, setPendingAction] = useState<"create" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = pendingAction !== null;

  const handleCreate = async () => {
    if (!storeEnabled || loading || store) return;
    setPendingAction("create");
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar loja.");
      }
      const nextStore = json.store ?? null;
      setStore(nextStore);
      onStoreChange?.(nextStore);
      if (nextStore) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  };

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
          status: "ACTIVE",
          catalogLocked: false,
          checkoutEnabled: true,
          showOnProfile: nextPublic,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar loja.");
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

  const launchChecklist = useMemo(
    () => [
      { id: "created", label: "Loja criada", done: Boolean(store) },
      { id: "catalog", label: "Catalogo desbloqueado", done: Boolean(store && !store.catalogLocked) },
      { id: "checkout", label: "Checkout ativo", done: Boolean(store?.checkoutEnabled) },
      { id: "visibility", label: "Loja publica", done: Boolean(store?.showOnProfile) },
    ],
    [store],
  );

  const completedChecklist = launchChecklist.filter((item) => item.done).length;
  const storeCreationBlocked = !storeEnabled && !store;
  const checklistHint = storeCreationBlocked
    ? "Ativa primeiro o modulo da loja para começares o setup e os passos ficarem disponiveis."
    : store
      ? "Dica: publica apenas quando catálogo, portes e políticas estiverem prontos."
      : "A criação prepara a estrutura inicial. Depois adiciona produtos e ativa checkout.";

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/14 bg-[linear-gradient(150deg,rgba(255,255,255,0.11),rgba(6,10,22,0.9)_48%,rgba(4,7,14,0.96))] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-16 -top-20 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(107,255,255,0.3),transparent_70%)] blur-2xl" />
        <div className="absolute -right-20 -bottom-24 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,122,209,0.28),transparent_72%)] blur-2xl" />
      </div>

      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-white/60">Loja</p>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="text-sm text-white/72">{description}</p>
          </header>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`rounded-full border px-3 py-1 uppercase tracking-[0.2em] ${
                storeEnabled
                  ? "border-emerald-300/35 bg-emerald-500/14 text-emerald-100"
                  : "border-amber-300/35 bg-amber-500/14 text-amber-100"
              }`}
            >
              {storeEnabled ? "Modulo ativo" : "Modulo indisponivel"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/75">
              {store ? "Loja criada" : "Sem loja criada"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/65">
              Checklist: {completedChecklist}/4
            </span>
          </div>

          {!storeEnabled && (
            <div className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
              <p className="font-medium">A loja está temporariamente indisponível nesta instalação.</p>
              <p className="text-amber-100/85">
                Pede à equipa técnica para ativar o módulo da loja antes de continuar.
              </p>
            </div>
          )}

          {store ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white/75">
                {store.showOnProfile
                  ? "A loja está pública. Qualquer pessoa pode ver o catálogo e comprar."
                  : "A loja está escondida do público. Podes preparar catálogo e envios antes de publicar."}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
                  {store.showOnProfile ? "Publica" : "Escondida"}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/70">
                  {store.checkoutEnabled ? "Checkout ativo" : "Checkout bloqueado"}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/70">
                  {store.catalogLocked ? "Catalogo bloqueado" : "Catalogo aberto"}
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
          ) : storeCreationBlocked ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white/72">
                A criação da loja está bloqueada enquanto o módulo estiver indisponível.
                Quando for ativado, o botão de criação aparece aqui automaticamente.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white/72">
                Ainda não tens loja criada. Em poucos segundos criamos a estrutura base para produtos, envios e checkout.
              </p>
              <button
                type="button"
                disabled={!storeEnabled || loading}
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.22)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {pendingAction === "create" ? "A criar..." : "Criar loja"}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/12 bg-black/35 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/58">Plano de lancamento</p>
          <h2 className="mt-2 text-sm font-semibold text-white">Checklist da loja</h2>
          <ul className="mt-3 space-y-2">
            {launchChecklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                    item.done
                      ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                      : "border-white/20 bg-white/10 text-white/55"
                  }`}
                >
                  {item.done ? "OK" : "-"}
                </span>
                <span className={item.done ? "text-white/88" : "text-white/68"}>{item.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] text-white/70">
            {checklistHint}
          </div>
        </aside>
      </div>
    </section>
  );
}
