"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { useWallet } from "@/app/components/wallet/useWallet";
import { WalletCard } from "@/app/components/wallet/WalletCard";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AgendaItem = {
  id: string;
  title: string;
  startAt: string;
  label?: string | null;
  type: string;
  ctaHref?: string | null;
};

type PurchaseItem = {
  id: number;
  purchaseId: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  badge: string;
  status: string;
  lines: { id: number; eventTitle: string; eventSlug: string; ticketTypeName: string }[];
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}


export default function WalletHubClient() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const { user } = useUser();
  const { openModal: openAuthModal } = useAuthModal();
  const { items: walletItems, loading: walletLoading } = useWallet();

  const { startIso, endIso } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);

  const agendaUrl = user ? `/api/me/agenda?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}` : null;
  const { data: agendaData } = useSWR<{ ok: boolean; items?: AgendaItem[] }>(agendaUrl, fetcher);

  const purchasesUrl = user ? "/api/me/purchases?limit=6" : null;
  const { data: purchasesData } = useSWR<{ items?: PurchaseItem[] }>(purchasesUrl, fetcher);

  const upcomingItems = useMemo(() => (agendaData?.items ?? []).slice(0, 6), [agendaData?.items]);
  const passes = useMemo(() => walletItems.filter((item) => item.status === "ACTIVE"), [walletItems]);

  useEffect(() => {
    if (section !== "wallet") return;
    const el = document.getElementById("wallet");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [section]);

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_12%_12%,rgba(120,160,255,0.16),transparent_55%),radial-gradient(circle_at_88%_18%,rgba(120,255,214,0.12),transparent_60%),linear-gradient(160deg,#090d1c,#0b0f1f)] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">Carteira ORYA</p>
          <h1 className="mt-4 text-3xl font-semibold">Entra para veres a tua carteira</h1>
          <p className="mt-3 text-sm text-white/70">
            Passes, bilhetes, proximos eventos e reservas num so lugar.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal({ mode: "login", redirectTo: "/me/carteira", showGoogle: true })}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => openAuthModal({ mode: "signup", redirectTo: "/me/carteira", showGoogle: true })}
              className="rounded-full border border-white/30 px-6 py-2 text-sm text-white"
            >
              Criar conta
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_12%,rgba(120,160,255,0.16),transparent_55%),radial-gradient(circle_at_88%_18%,rgba(120,255,214,0.12),transparent_60%),linear-gradient(160deg,#080b18,#0c1124)] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">Carteira</p>
              <h1 className="text-2xl font-semibold text-white/95">Passes, bilhetes e proximos momentos</h1>
              <p className="text-sm text-white/65">Tudo o que precisas, sem distracoes.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/me/compras"
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                Historico de compras
              </Link>
              <Link
                href="/me/settings"
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                Definicoes
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Proximos</p>
              <h2 className="text-lg font-semibold">Eventos e reservas nos proximos 30 dias</h2>
            </div>
            <Link href="/me" className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/70">
              Ver perfil
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {upcomingItems.length === 0 && (
              <p className="text-sm text-white/70">Sem itens agendados.</p>
            )}
            {upcomingItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white/90">{item.title}</p>
                  <p className="text-[12px] text-white/60">{item.label ?? item.type} · {formatDateTime(item.startAt)}</p>
                </div>
                <Link
                  href={item.ctaHref ?? "/me"}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/70"
                >
                  Ver
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section id="wallet" className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Passes e bilhetes</p>
              <h2 className="text-lg font-semibold">Os teus acessos ativos</h2>
            </div>
          </div>
          {walletLoading && <p className="mt-4 text-sm text-white/70">A carregar carteira...</p>}
          {!walletLoading && passes.length === 0 && (
            <p className="mt-4 text-sm text-white/70">Sem bilhetes na carteira.</p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {passes.map((item) => (
              <WalletCard key={item.entitlementId} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Historico</p>
              <h2 className="text-lg font-semibold">Compras recentes</h2>
              <p className="text-sm text-white/60">Consulta o detalhe completo e faturas quando existirem.</p>
            </div>
            <Link
              href="/me/compras"
              className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white/70"
            >
              Ver historico
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {(purchasesData?.items ?? []).length === 0 && (
              <p className="text-sm text-white/70">Sem compras recentes.</p>
            )}
            {(purchasesData?.items ?? []).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.lines[0]?.eventTitle ?? "Compra"}</p>
                    <p className="text-[12px] text-white/60">{formatDateTime(item.createdAt)}</p>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {formatMoney(item.totalCents, item.currency)}
                  </div>
                </div>
                <p className="mt-2 text-[12px] text-white/60">{item.status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
