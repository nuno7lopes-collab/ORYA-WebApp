import { useCallback, useEffect, useState } from "react";

export type WalletAction = {
  canShowQr?: boolean;
  canCheckIn?: boolean;
  canClaim?: boolean;
};

export type WalletSnapshot = {
  title: string;
  coverUrl?: string | null;
  venueName?: string | null;
  startAt?: string | null;
  timezone?: string | null;
};

export type WalletItem = {
  entitlementId: string;
  status: string;
  type: string;
  snapshot: WalletSnapshot;
  actions: WalletAction;
  updatedAt?: string | null;
  consumedAt?: string | null;
};

export type WalletFilter = "all" | "upcoming" | "past";

export function useWallet(options: { filter?: WalletFilter; enabled?: boolean } = {}) {
  const filter = options.filter ?? "all";
  const enabled = options.enabled ?? true;
  const [items, setItems] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const params = new URLSearchParams();
      if (filter === "upcoming") params.append("filter", "upcoming");
      if (filter === "past") params.append("filter", "past");
      const query = params.toString();
      const url = query ? `/api/me/wallet?${query}` : "/api/me/wallet";
      const res = await fetch(url, { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          setAuthRequired(true);
          throw new Error("Precisas de iniciar sessão para ver a carteira.");
        }
        throw new Error(text || `Erro ${res.status} ao carregar a carteira`);
      }
      const data = await res.json();
      const mapped: WalletItem[] = (data?.items ?? []).map((e: any) => ({
        entitlementId: e.entitlementId ?? e.id,
        status: e.status ?? "ACTIVE",
        type: e.type ?? "ENTITLEMENT",
        snapshot: {
          title: e.snapshot?.title ?? "Entitlement",
          coverUrl: e.snapshot?.coverUrl ?? null,
          venueName: e.snapshot?.venueName ?? null,
          startAt: e.snapshot?.startAt ?? null,
          timezone: e.snapshot?.timezone ?? null,
        },
        actions: e.actions ?? {},
        updatedAt: e.updatedAt ?? null,
        consumedAt: e.consumedAt ?? null,
      }));
      setItems(mapped);
    } catch (err) {
      console.warn("[useWallet] erro", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar a carteira.");
    } finally {
      setLoading(false);
    }
  }, [enabled, filter]);

  useEffect(() => {
    if (!enabled) return;
    fetchWallet();
  }, [enabled, fetchWallet, filter]);

  return { items, loading, error, authRequired, refetch: fetchWallet };
}
