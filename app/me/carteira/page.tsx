"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@/app/components/wallet/useWallet";
import { WalletCard } from "@/app/components/wallet/WalletCard";
import { useUser } from "@/app/hooks/useUser";

type FilterKey = "ALL" | "ACTIVE" | "USED" | "REFUNDED" | "REVOKED" | "SUSPENDED";

export default function CarteiraPage() {
  const { items, loading, error, authRequired, refetch } = useWallet();
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const { user, isLoading: userLoading } = useUser();

  const list = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (filter === "ALL") return true;
      return item.status === filter;
    });
  }, [items, filter]);

  if (!user && !userLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/[0.02] p-8 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur-xl space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Entra para veres a tua carteira</h1>
          <p className="text-sm text-white/70">
            Autentica-te para veres os teus bilhetes e QR. A carteira é privada e só aparece depois de iniciar sessão.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <a
              href="/login?redirectTo=/me/carteira"
              className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold shadow-[0_0_22px_rgba(255,255,255,0.4)]"
            >
              Entrar
            </a>
            <a
              href="/login?mode=signup&redirectTo=/me/carteira"
              className="px-4 py-2.5 rounded-xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10"
            >
              Criar conta
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[12px] uppercase tracking-[0.16em] text-white/60">Carteira</p>
              <h1 className="text-2xl font-semibold text-white">Entitlements ORYA</h1>
              <p className="text-[12px] text-white/65">
                Snapshot + status + ações. QR só aparece quando permitido pelas políticas de acesso.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "ALL", label: "Tudo" },
                { key: "ACTIVE", label: "Ativos" },
                { key: "USED", label: "Usados" },
                { key: "REFUNDED", label: "Refund" },
                { key: "REVOKED", label: "Revogados" },
                { key: "SUSPENDED", label: "Suspensos" },
              ] satisfies { key: FilterKey; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition ${
                    filter === f.key
                      ? "bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.35)]"
                      : "border-white/30 text-white hover:bg-white/10"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-60 rounded-2xl border border-white/10 bg-white/5 animate-pulse shadow-[0_14px_40px_rgba(0,0,0,0.4)]"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-50 space-y-2">
            <div>{error}</div>
            <div className="flex gap-2 flex-wrap">
              {!authRequired && (
                <button
                  onClick={refetch}
                  className="inline-flex px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold shadow"
                >
                  Tentar novamente
                </button>
              )}
              {authRequired && (
                <a
                  href="/login?redirectTo=/me/carteira"
                  className="inline-flex px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold shadow"
                >
                  Iniciar sessão
                </a>
              )}
            </div>
          </div>
        )}

        {!loading && !error && list.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a]/70 via-[#020617]/60 to-black/70 backdrop-blur-2xl p-8 text-center flex flex-col items-center gap-4 shadow-[0_28px_80px_rgba(15,23,42,0.95)]">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center shadow-[0_0_35px_rgba(107,255,255,0.5)] text-black text-3xl font-bold">
              🎟️
            </div>
            <h3 className="text-lg font-semibold text-white/95">Ainda não tens bilhetes ORYA</h3>
            <p className="text-[12px] text-white/70 max-w-sm">
              Compra o teu primeiro bilhete e ele aparece aqui com QR pronto a usar.
            </p>
          </div>
        )}

        {!loading && !error && list.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((item) => (
              <WalletCard key={item.entitlementId} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
