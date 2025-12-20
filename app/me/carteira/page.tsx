"use client";

import Link from "next/link";
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
      <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white flex items-center justify-center px-4">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_55%)]" />
        <div className="relative max-w-lg w-full rounded-3xl border border-white/15 bg-white/5 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-2xl space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Entra para veres a tua carteira</h1>
          <p className="text-sm text-white/70">
            Autentica-te para veres os teus bilhetes e QR. A carteira é privada e só aparece depois de iniciar sessão.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/login?redirectTo=/me/carteira"
              className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_55px_rgba(255,255,255,0.25)]"
            >
              Entrar
            </Link>
            <Link
              href="/login?mode=signup&redirectTo=/me/carteira"
              className="px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 text-sm font-semibold text-white hover:border-white/45 hover:bg-white/20"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_55%)]" />
      <section className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">Carteira</p>
              <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
                Carteira ORYA
              </h1>
              <p className="text-sm text-white/70">
                Os teus bilhetes num só lugar: snapshot, status e ações. QR só aparece quando permitido pelas políticas de acesso.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
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
                  className={`rounded-full px-3 py-1.5 font-semibold border transition backdrop-blur ${
                    filter === f.key
                      ? "bg-white text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
                      : "border-white/30 bg-white/10 text-white/85 hover:border-white/45 hover:bg-white/20"
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
                className="h-60 rounded-2xl border border-white/15 bg-white/5 animate-pulse shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-50 space-y-2 shadow-[0_18px_50px_rgba(127,29,29,0.4)] backdrop-blur-xl">
            <div>{error}</div>
            <div className="flex gap-2 flex-wrap">
              {!authRequired && (
                <button
                  onClick={refetch}
                  className="inline-flex px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
                >
                  Tentar novamente
                </button>
              )}
              {authRequired && (
                <Link
                  href="/login?redirectTo=/me/carteira"
                  className="inline-flex px-3 py-1.5 rounded-lg bg-white text-black text-[11px] font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
                >
                  Iniciar sessão
                </Link>
              )}
            </div>
          </div>
        )}

        {!loading && !error && list.length === 0 && (
          <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-10 text-center flex flex-col items-center gap-5 shadow-[0_32px_90px_rgba(5,6,16,0.82)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.06),transparent_42%),radial-gradient(circle_at_82%_12%,rgba(255,255,255,0.05),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,0.05),transparent_45%)]" />
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 rounded-2xl bg-white/12 blur-2xl" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-white/10 via-white/6 to-white/10 border border-white/18 shadow-[0_0_32px_rgba(255,255,255,0.28)] flex items-center justify-center text-2xl text-white">
                🎟️
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white/95">Ainda não tens bilhetes ORYA</h3>
              <p className="text-[12px] text-white/70 max-w-sm">
                Compra o teu primeiro bilhete e ele aparece aqui com QR pronto a usar.
              </p>
            </div>
            <div className="relative flex gap-2 flex-wrap justify-center">
              <Link
                href="/explorar"
                className="inline-flex mt-2 px-4 py-2.5 rounded-full bg-white text-black text-xs font-semibold shadow-[0_18px_45px_rgba(0,0,0,0.35)] hover:scale-[1.03] active:scale-95 transition-transform"
              >
                Explorar eventos
              </Link>
              <Link
                href="/me"
                className="inline-flex mt-2 px-4 py-2.5 rounded-full border border-white/30 bg-white/10 text-xs font-semibold text-white hover:border-white/45 hover:bg-white/20 shadow-[0_0_16px_rgba(255,255,255,0.1)]"
              >
                Ver perfil
              </Link>
            </div>
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
