"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@/app/components/wallet/useWallet";
import { WalletCard } from "@/app/components/wallet/WalletCard";
import { useUser } from "@/app/hooks/useUser";
import TicketLiveQr from "@/app/components/tickets/TicketLiveQr";

type FilterKey = "ALL" | "ACTIVE" | "USED" | "REFUNDED" | "REVOKED" | "SUSPENDED";

export default function CarteiraPage() {
  const { items, loading, error, authRequired, refetch } = useWallet();
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const { user, isLoading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const entitlementId = searchParams.get("entitlementId");

  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passData, setPassData] = useState<null | {
    entitlementId: string;
    status: string;
    snapshot: {
      title: string;
      venueName?: string | null;
      startAt?: string | null;
    };
    actions?: { canShowQr?: boolean };
    qrToken?: string | null;
    event?: {
      slug: string;
      organizerName: string | null;
      organizerUsername: string | null;
    } | null;
    cached?: boolean;
  }>(null);

  useEffect(() => {
    if (!entitlementId) {
      setPassData(null);
      setPassError(null);
      setPassLoading(false);
      return;
    }

    const cacheKey = `orya-pass-${entitlementId}`;
    let cancelled = false;

    const load = async () => {
      setPassLoading(true);
      setPassError(null);
      try {
        const res = await fetch(`/api/me/wallet/${entitlementId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Erro ao carregar o Pass ORYA.");
        }
        if (cancelled) return;
        const payload = {
          entitlementId: data?.entitlementId ?? entitlementId,
          status: data?.status ?? "ACTIVE",
          snapshot: {
            title: data?.snapshot?.title ?? "Pass ORYA",
            venueName: data?.snapshot?.venueName ?? null,
            startAt: data?.snapshot?.startAt ?? null,
          },
          actions: data?.actions ?? {},
          qrToken: data?.qrToken ?? null,
          event: data?.event ?? null,
          cached: false,
        };
        setPassData(payload);
        window.localStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (err) {
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (!cancelled) {
              setPassData({ ...parsed, cached: true });
              setPassError("Sem ligação — a mostrar a última versão guardada.");
            }
          } catch {
            setPassError(err instanceof Error ? err.message : "Erro ao carregar o Pass ORYA.");
          }
        } else {
          setPassError(err instanceof Error ? err.message : "Erro ao carregar o Pass ORYA.");
        }
      } finally {
        if (!cancelled) setPassLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [entitlementId]);

  const list = useMemo(() => {
    const filtered = (items ?? []).filter((item) => {
      if (filter === "ALL") return true;
      return item.status === filter;
    });
    const now = Date.now();
    const toTime = (value?: string | null) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.getTime();
    };
    return filtered.sort((a, b) => {
      const aTime = toTime(a.snapshot?.startAt ?? null);
      const bTime = toTime(b.snapshot?.startAt ?? null);
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      const aUpcoming = aTime >= now;
      const bUpcoming = bTime >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming) return aTime - bTime;
      return bTime - aTime;
    });
  }, [items, filter]);

  const passStatusLabel = useMemo(() => {
    if (!passData) return "";
    const map: Record<string, string> = {
      ACTIVE: "Confirmado",
      USED: "Usado",
      REFUNDED: "Reembolsado",
      REVOKED: "Revogado",
      SUSPENDED: "Suspenso",
    };
    return map[passData.status] ?? passData.status;
  }, [passData]);

  const passDateLabel = useMemo(() => {
    if (!passData?.snapshot?.startAt) return "Data a anunciar";
    const parsed = new Date(passData.snapshot.startAt);
    if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
    return parsed.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [passData]);

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

        {entitlementId && (
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Pass ORYA</p>
                <h2 className="text-2xl font-semibold text-white">Credencial pessoal</h2>
              </div>
              <Link
                href="/me/carteira"
                className="text-[12px] text-white/60 hover:text-white"
              >
                Fechar Pass
              </Link>
            </div>

            {passLoading && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                A carregar o teu Pass ORYA…
              </div>
            )}

            {!passLoading && passData && (
              <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Evento</p>
                        <h3 className="mt-2 text-lg font-semibold">{passData.snapshot.title}</h3>
                        <p className="text-[12px] text-white/70">
                          {passData.snapshot.venueName ?? "Local a anunciar"} · {passDateLabel}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] text-white/80">
                        {passStatusLabel}
                      </span>
                    </div>
                    {passData.event?.organizerName && (
                      <p className="mt-3 text-[12px] text-white/60">
                        Organização:{" "}
                        {passData.event.organizerUsername ? (
                          <Link
                            href={`/${passData.event.organizerUsername}`}
                            className="text-white hover:text-white/80"
                          >
                            {passData.event.organizerName}
                          </Link>
                        ) : (
                          <span className="text-white">{passData.event.organizerName}</span>
                        )}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
                      {passData.event?.slug && (
                        <Link
                          href={`/eventos/${passData.event.slug}`}
                          className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-white/80 hover:bg-white/20"
                        >
                          Ver página do evento
                        </Link>
                      )}
                    </div>
                    {passData.cached && (
                      <p className="mt-3 text-[11px] text-amber-200">
                        Sem ligação — a mostrar a última versão guardada.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-black/40 p-4 text-[12px] text-white/70">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Estado</p>
                    <p className="mt-2">
                      Usa o QR apenas quando fores chamado para check-in. Mantém o Pass aberto para atualizar a
                      disponibilidade.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/40 p-4 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">QR do Pass</p>
                  <div className="mt-4 flex items-center justify-center">
                    {passData.actions?.canShowQr && passData.qrToken ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <TicketLiveQr qrToken={passData.qrToken} />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-[12px] text-white/70">
                        QR indisponível neste momento.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!passLoading && passError && !passData?.cached && (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-50">
                {passError}
              </div>
            )}
          </section>
        )}

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
