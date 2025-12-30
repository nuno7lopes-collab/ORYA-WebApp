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
};

export function useWallet() {
  const [items, setItems] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const res = await fetch("/api/me/wallet", { cache: "no-store", credentials: "include" });
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
      }));
      setItems(mapped);
    } catch (err) {
      console.warn("[useWallet] erro", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar a carteira.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return { items, loading, error, authRequired, refetch: fetchWallet };
}
