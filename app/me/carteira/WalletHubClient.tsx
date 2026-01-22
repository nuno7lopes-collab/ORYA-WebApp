"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  type: "EVENTO" | "JOGO" | "INSCRICAO" | "RESERVA";
  ctaHref?: string | null;
};

type LoyaltyReward = {
  id: string;
  name: string;
  type: string;
  pointsCost: number;
  stock: number | null;
  isActive: boolean;
  canRedeem: boolean;
};

type LoyaltyProgramItem = {
  organization: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    username?: string | null;
  };
  program: {
    id: string;
    name: string;
    pointsName: string;
    status: string;
  };
  balance: number;
  rewards: LoyaltyReward[];
};

type LoyaltyResponse = {
  ok: boolean;
  items: LoyaltyProgramItem[];
};

type StorePurchaseLine = {
  id: number;
  name: string;
  quantity: number;
  image: { url: string; altText: string } | null;
};

type StorePurchaseItem = {
  id: number;
  orderNumber: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  store: { displayName: string; username: string | null };
  lines: StorePurchaseLine[];
};

type StorePurchaseResponse = {
  ok: boolean;
  items?: StorePurchaseItem[];
};

const PROGRAM_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  DISABLED: "Desativado",
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

export default function WalletHubClient() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const { user } = useUser();
  const { openModal: openAuthModal } = useAuthModal();
  const { items: walletItems, loading: walletLoading } = useWallet();
  const { data: loyaltyData, mutate: mutateLoyalty } = useSWR<LoyaltyResponse>(
    user ? "/api/me/loyalty/recompensas" : null,
    fetcher,
  );
  const { data: storePurchasesData } = useSWR<StorePurchaseResponse>(
    user ? "/api/me/store/purchases?limit=4" : null,
    fetcher,
  );
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);

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

  const agendaItems = useMemo(() => agendaData?.items ?? [], [agendaData?.items]);
  const upcomingItems = useMemo(() => agendaItems.slice(0, 6), [agendaItems]);
  const passes = useMemo(() => walletItems.filter((item) => item.status === "ACTIVE"), [walletItems]);
  const plannedReservations = useMemo(
    () => agendaItems.filter((item) => item.type === "RESERVA").length,
    [agendaItems],
  );
  const loyaltyItems = useMemo(() => loyaltyData?.items ?? [], [loyaltyData]);
  const storePurchases = useMemo(() => storePurchasesData?.items ?? [], [storePurchasesData?.items]);

  const handleRedeem = async (rewardId: string) => {
    if (!rewardId || redeemingRewardId) return;
    setRedeemingRewardId(rewardId);
    setRedeemMessage(null);
    try {
      const res = await fetch(`/api/me/loyalty/recompensas/${rewardId}/resgatar`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error || "Falha ao resgatar recompensa.";
        throw new Error(message);
      }
      setRedeemMessage("Recompensa resgatada com sucesso.");
      await mutateLoyalty();
    } catch (err) {
      setRedeemMessage(err instanceof Error ? err.message : "Erro ao resgatar recompensa.");
    } finally {
      setRedeemingRewardId(null);
    }
  };

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
            Passes, bilhetes, próximos eventos e reservas num só lugar.
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
              <h1 className="text-2xl font-semibold text-white/95">Passes, bilhetes e reservas planeadas</h1>
              <p className="text-sm text-white/65">Tudo o que precisas, sem distrações.</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              id: "passes",
              title: "Passes e bilhetes",
              value: walletItems.length,
              description: "Tudo o que tens guardado na carteira.",
              href: "/me/carteira#wallet",
            },
            {
              id: "ativos",
              title: "Acessos ativos",
              value: passes.length,
              description: "Bilhetes prontos a usar.",
              href: "/me/carteira#wallet",
            },
            {
              id: "reservas",
              title: "Reservas planeadas",
              value: plannedReservations,
              description: "Reservas confirmadas nos próximos 30 dias.",
              href: "/me/carteira#agenda",
            },
          ].map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="group rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition hover:border-white/25 hover:bg-white/10"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Resumo</p>
                  <p className="text-sm font-semibold text-white/90">{card.title}</p>
                </div>
                <div className="text-2xl font-semibold text-white">{card.value}</div>
              </div>
              <p className="mt-2 text-[11px] text-white/60">{card.description}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Loja</p>
              <h2 className="text-lg font-semibold">Compras da loja</h2>
              <p className="text-[12px] text-white/60">Produtos adquiridos e acesso rapido a recibos.</p>
            </div>
            <Link
              href="/me/compras/loja"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs text-white/80 hover:border-white/40"
            >
              Ver compras
            </Link>
          </div>

          {storePurchases.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
              Ainda nao tens compras da loja.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {storePurchases.map((order) => {
                const storeLink = order.store.username ? `/${order.store.username}/loja` : null;
                const preview = order.lines[0];
                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-white/12 bg-black/35 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{order.store.displayName}</p>
                        <p className="text-[11px] text-white/60">
                          {order.orderNumber ?? `Pedido ${order.id}`} ·{" "}
                          {new Date(order.createdAt).toLocaleDateString("pt-PT")}
                        </p>
                      </div>
                      {storeLink ? (
                        <Link
                          href={storeLink}
                          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/40"
                        >
                          Ver loja
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        {preview?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preview.image.url}
                            alt={preview.image.altText}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
                            ORYA
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{preview?.name ?? "Artigos da loja"}</p>
                        <p className="text-[11px] text-white/60">
                          {order.lines.length} artigos ·{" "}
                          {new Intl.NumberFormat("pt-PT", { style: "currency", currency: order.currency }).format(
                            order.totalCents / 100,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="loyalty" className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Pontos</p>
              <h2 className="text-lg font-semibold">Loyalty por organização</h2>
              <p className="text-[12px] text-white/60">Pontos e recompensas disponíveis na tua carteira.</p>
            </div>
            <button
              type="button"
              onClick={() => mutateLoyalty()}
              className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/70"
            >
              Atualizar
            </button>
          </div>
          {redeemMessage ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/70">
              {redeemMessage}
            </div>
          ) : null}
          {!loyaltyData && (
            <p className="mt-4 text-sm text-white/70">A carregar pontos e recompensas...</p>
          )}
          {loyaltyData && loyaltyItems.length === 0 && (
            <p className="mt-4 text-sm text-white/70">Sem programas de pontos ativos.</p>
          )}
          {loyaltyItems.length > 0 && (
            <div className="mt-4 space-y-4">
              {loyaltyItems.map((item) => {
                const orgLabel =
                  item.organization.publicName ||
                  item.organization.businessName ||
                  item.organization.username ||
                  "Organização";
                const statusLabel = PROGRAM_STATUS_LABEL[item.program.status] ?? item.program.status;
                return (
                  <div
                    key={item.program.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{orgLabel}</p>
                        <p className="text-sm font-semibold text-white/90">{item.program.name}</p>
                        <p className="text-[11px] text-white/60">Estado: {statusLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-white/50">Saldo</p>
                        <p className="text-lg font-semibold text-white">
                          {item.balance} {item.program.pointsName}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {item.rewards.length === 0 ? (
                        <p className="text-[12px] text-white/60">Sem recompensas disponíveis.</p>
                      ) : (
                        item.rewards.map((reward) => {
                          const hasStock = reward.stock === null || reward.stock > 0;
                          return (
                            <div
                              key={reward.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                            >
                              <div>
                                <p className="text-[12px] font-semibold text-white">{reward.name}</p>
                                <p className="text-[11px] text-white/60">
                                  {reward.pointsCost} {item.program.pointsName} · {reward.type}
                                </p>
                                <p className="text-[10px] text-white/45">
                                  {reward.stock === null ? "Stock ilimitado" : `Stock: ${reward.stock}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRedeem(reward.id)}
                                disabled={!reward.canRedeem || !hasStock || redeemingRewardId === reward.id}
                                className={`rounded-full px-3 py-1.5 text-[11px] ${
                                  reward.canRedeem && hasStock && redeemingRewardId !== reward.id
                                    ? "bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
                                    : "border border-white/15 text-white/50"
                                }`}
                              >
                                {redeemingRewardId === reward.id ? "A resgatar..." : "Resgatar"}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section id="agenda" className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Próximos</p>
              <h2 className="text-lg font-semibold">Eventos e reservas nos próximos 30 dias</h2>
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

        <section id="wallet" className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
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

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          <span>Movimentos e faturas estão nas Compras.</span>
          <Link
            href="/me/compras"
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/85 hover:bg-white/10"
          >
            Ver movimentos
          </Link>
        </div>
      </div>
    </main>
  );
}
