

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Tipos esperados da API de overview
type TicketTypeStats = {
  ticketTypeId: string;
  name: string;
  soldTickets: number;
  revenueCents: number;
};

type TimeSeriesPoint = {
  date: string; // ISO string (dia)
  tickets: number;
  revenueCents: number;
};

type TopEventStats = {
  eventId: number;
  title: string;
  slug: string;
  startDate: string | null;
  totalTickets: number;
  totalRevenueCents: number;
  occupancy?: number | null;
};

type OverviewResponse = {
  ok: boolean;
  totalTickets: number;
  totalRevenueCents: number;
  activeEventsCount: number;
  averageOccupancy?: number | null;
  byTicketType?: TicketTypeStats[];
  timeSeries?: TimeSeriesPoint[];
  topEvents?: TopEventStats[];
  error?: string;
};

// Tipos esperados da API de audiência
type AudienceCity = {
  city: string | null;
  buyers: number;
};

type AudienceInterest = {
  interest: string;
  buyers: number;
};

type AudienceResponse = {
  ok: boolean;
  cities: AudienceCity[];
  interests: AudienceInterest[];
  error?: string;
};

type RangeKey = "7d" | "30d" | "all";

function formatMoney(cents: number): string {
  if (!Number.isFinite(cents)) return "€0";
  const value = cents / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function rangeLabel(range: RangeKey): string {
  switch (range) {
    case "7d":
      return "Últimos 7 dias";
    case "30d":
      return "Últimos 30 dias";
    case "all":
      return "Desde sempre";
    default:
      return "Período";
  }
}

export default function OrganizerStatsPage() {
  const [range, setRange] = useState<RangeKey>("30d");

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [audience, setAudience] = useState<AudienceResponse | null>(null);
  const [audienceLoading, setAudienceLoading] = useState<boolean>(true);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // Carregar overview sempre que o range muda
  useEffect(() => {
    let cancelled = false;

    async function fetchOverview() {
      try {
        setOverviewLoading(true);
        setOverviewError(null);

        const res = await fetch(
          `/api/organizador/estatisticas/overview?range=${range}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("[OrganizerStats] Erro ao carregar overview:", text);
          if (!cancelled) {
            setOverviewError(
              "Não foi possível carregar o resumo das vendas. Tenta novamente em alguns segundos."
            );
          }
          return;
        }

        const json = (await res.json().catch(() => null)) as
          | OverviewResponse
          | null;

        if (!json || !json.ok) {
          if (!cancelled) {
            setOverviewError(
              json?.error ||
                "Recebemos uma resposta inesperada ao carregar o resumo das estatísticas."
            );
          }
          return;
        }

        if (!cancelled) {
          setOverview(json);
        }
      } catch (err) {
        console.error("[OrganizerStats] Erro inesperado em overview:", err);
        if (!cancelled) {
          setOverviewError(
            "Ocorreu um problema inesperado ao carregar o resumo. Tenta novamente dentro de instantes."
          );
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    fetchOverview();

    return () => {
      cancelled = true;
    };
  }, [range]);

  // Carregar audiência (independente do range por agora)
  useEffect(() => {
    let cancelled = false;

    async function fetchAudience() {
      try {
        setAudienceLoading(true);
        setAudienceError(null);

        const res = await fetch("/api/organizador/estatisticas/audience", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[OrganizerStats] Erro ao carregar audiência:", text);
          if (!cancelled) {
            setAudienceError(
              "Não foi possível carregar informação sobre a audiência neste momento."
            );
          }
          return;
        }

        const json = (await res.json().catch(() => null)) as
          | AudienceResponse
          | null;

        if (!json || !json.ok) {
          if (!cancelled) {
            setAudienceError(
              json?.error ||
                "Recebemos uma resposta inesperada ao carregar a audiência."
            );
          }
          return;
        }

        if (!cancelled) {
          setAudience(json);
        }
      } catch (err) {
        console.error("[OrganizerStats] Erro inesperado em audiência:", err);
        if (!cancelled) {
          setAudienceError(
            "Ocorreu um problema inesperado ao carregar a audiência. Tenta novamente mais tarde."
          );
        }
      } finally {
        if (!cancelled) {
          setAudienceLoading(false);
        }
      }
    }

    fetchAudience();

    return () => {
      cancelled = true;
    };
  }, []);

  const containerClasses = "mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8 space-y-8 text-white";

  const hasAnyData = !!(
    overview &&
    (overview.totalTickets > 0 ||
      overview.totalRevenueCents > 0 ||
      (overview.topEvents && overview.topEvents.length > 0))
  );

  const ticketTypes = overview?.byTicketType ?? [];
  const series = overview?.timeSeries ?? [];
  const topEvents = overview?.topEvents ?? [];

  const topCities = audience?.cities ?? [];
  const topInterests = audience?.interests ?? [];

  return (
    <div className={containerClasses}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Bilhetes & Vendas</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Estatísticas</h1>
          <p className="mt-1 max-w-xl text-sm text-white/70">
            Acompanha as vendas, receita e audiência dos teus eventos. Os números abaixo são calculados para o período selecionado.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 text-[11px] md:items-end">
          <div className="flex items-center gap-2">
            <Link
              href="/organizador/eventos"
              className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 hover:bg-white/5 transition-colors"
            >
              Ver eventos
            </Link>
            <Link
              href="/organizador"
              className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 hover:bg-white/5 transition-colors"
            >
              Painel
            </Link>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="text-white/55">Período</span>
            <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-[3px]">
              {(["7d", "30d", "all"] as RangeKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    range === key
                      ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold shadow-[0_0_18px_rgba(107,255,255,0.7)]"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  {rangeLabel(key)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {overviewError && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100" role="alert">
          <p className="font-medium">Não foi possível carregar o resumo.</p>
          <p className="mt-1 text-[11px] text-red-100/85">{overviewError}</p>
        </div>
      )}

      {!overviewLoading && !overviewError && !hasAnyData && (
        <div className="rounded-2xl border border-dashed border-white/20 bg-black/60 px-6 py-8 text-center text-sm text-white/70">
          <p className="text-base font-medium text-white">
            Ainda não tens vendas registadas.
          </p>
          <p className="mt-2 max-w-md mx-auto text-white/65">
            Assim que começares a vender bilhetes para os teus eventos na ORYA, vais ver aqui o resumo de vendas, evolução ao longo do tempo e perfil
            da tua audiência.
          </p>
          <div className="mt-4 flex justify-center gap-2 text-[11px]">
            <Link
              href="/organizador/(dashboard)/eventos/novo"
              className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.02] active:scale-95 transition-transform"
            >
              Criar primeiro evento
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            Receita total
          </p>
          <p className="mt-2 text-xl font-semibold">
            {overviewLoading && !overview ? (
              <span className="inline-block h-5 w-24 animate-pulse rounded bg-white/10" />
            ) : (
              formatMoney(overview?.totalRevenueCents ?? 0)
            )}
          </p>
          <p className="mt-1 text-[11px] text-white/55">
            Soma do valor dos bilhetes vendidos no período.
          </p>
        </div>

        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            Bilhetes vendidos
          </p>
          <p className="mt-2 text-xl font-semibold">
            {overviewLoading && !overview ? (
              <span className="inline-block h-5 w-10 animate-pulse rounded bg-white/10" />
            ) : (
              overview?.totalTickets ?? 0
            )}
          </p>
          <p className="mt-1 text-[11px] text-white/55">
            Número total de bilhetes emitidos para os teus eventos.
          </p>
        </div>

        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            Eventos com vendas
          </p>
          <p className="mt-2 text-xl font-semibold">
            {overviewLoading && !overview ? (
              <span className="inline-block h-5 w-8 animate-pulse rounded bg-white/10" />
            ) : (
              overview?.activeEventsCount ?? 0
            )}
          </p>
          <p className="mt-1 text-[11px] text-white/55">
            Quantos eventos tiveram bilhetes vendidos no período.
          </p>
        </div>

        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3 text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            Ocupação média
          </p>
          <p className="mt-2 text-xl font-semibold">
            {overviewLoading && !overview ? (
              <span className="inline-block h-5 w-12 animate-pulse rounded bg-white/10" />
            ) : overview?.averageOccupancy != null ? (
              `${Math.round(overview.averageOccupancy * 100)}%`
            ) : (
              "–"
            )}
          </p>
          <p className="mt-1 text-[11px] text-white/55">
            Percentagem média de lotação dos teus eventos.
          </p>
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">
              Vendas por tipo de bilhete
            </h2>
            <span className="text-[11px] text-white/55">
              {ticketTypes.length} tipo(s)
            </span>
          </div>

          {overviewLoading && !overview ? (
            <div className="mt-4 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/8" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/6" />
            </div>
          ) : ticketTypes.length === 0 ? (
            <p className="mt-3 text-[11px] text-white/60">
              Ainda não há vendas por tipo de bilhete neste período.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-[11px]">
              {ticketTypes.map((tt) => {
                const total = ticketTypes.reduce(
                  (acc, curr) => acc + curr.soldTickets,
                  0
                );
                const percent = total
                  ? Math.round((tt.soldTickets / total) * 100)
                  : 0;

                return (
                  <li
                    key={tt.ticketTypeId}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white/90">
                        {tt.name || "Bilhete"}
                      </span>
                      <span className="text-white/70">
                        {tt.soldTickets} bilhete(s)
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/60 w-10 text-right">
                        {percent}%
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-white/55">
                      Receita: {formatMoney(tt.revenueCents)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">
              Compras ao longo do tempo
            </h2>
            <span className="text-[11px] text-white/55">
              {series.length} ponto(s)
            </span>
          </div>

          {overviewLoading && !overview ? (
            <div className="mt-4 space-y-2">
              <div className="h-32 w-full animate-pulse rounded-xl bg-white/5" />
            </div>
          ) : series.length === 0 ? (
            <p className="mt-3 text-[11px] text-white/60">
              Ainda não há compras registadas neste período.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-[11px] text-white/75">
              <p className="text-white/60">
                (Gráfico mais avançado pode entrar aqui mais tarde. Por agora,
                mostramos os últimos dias em lista.)
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto pr-1">
                {series.map((point) => (
                  <li
                    key={point.date}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-white/5 px-3 py-1.5"
                  >
                    <span className="text-white/80">
                      {formatDate(point.date)}
                    </span>
                    <span className="text-white/75">
                      {point.tickets} bilhete(s) ·{" "}
                      {formatMoney(point.revenueCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/90">
              Eventos com mais vendas
            </h2>
            <span className="text-[11px] text-white/55">
              {topEvents.length} evento(s)
            </span>
          </div>

          {overviewLoading && !overview ? (
            <div className="mt-4 space-y-2">
              <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-white/8" />
              <div className="h-4 w-2/5 animate-pulse rounded bg-white/6" />
            </div>
          ) : topEvents.length === 0 ? (
            <p className="mt-3 text-[11px] text-white/60">
              Assim que tiveres mais do que um evento com vendas, vais ver aqui
              um ranking dos que estão a resultar melhor.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-[11px]">
              {topEvents.map((ev) => (
                <li
                  key={ev.eventId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-white/90 font-medium">
                      {ev.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/60">
                      {formatDate(ev.startDate)} · {ev.totalTickets} bilhetes ·{" "}
                      {formatMoney(ev.totalRevenueCents)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {ev.occupancy != null && (
                      <span className="text-[10px] text-white/70">
                        {Math.round((ev.occupancy ?? 0) * 100)}% lotação
                      </span>
                    )}
                    <Link
                      href={`/eventos/${ev.slug}`}
                      className="rounded-full border border-white/20 px-3 py-1 text-[10px] text-white/80 hover:bg-white/10 transition-colors"
                    >
                      Ver evento
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white/90">
                Cidades dos compradores
              </h2>
            </div>

            {audienceLoading && !audience ? (
              <div className="mt-4 space-y-2">
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-white/8" />
              </div>
            ) : audienceError ? (
              <p className="mt-3 text-[11px] text-white/60">{audienceError}</p>
            ) : topCities.length === 0 ? (
              <p className="mt-3 text-[11px] text-white/60">
                Ainda não temos informação suficiente sobre as cidades dos teus
                compradores.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-[11px]">
                {topCities.map((c, idx) => (
                  <li
                    key={`${c.city ?? "Sem cidade"}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
                  >
                    <span className="text-white/85">
                      {c.city || "Sem cidade"}
                    </span>
                    <span className="text-white/70">
                      {c.buyers} comprador(es)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white/90">
                Interesses mais frequentes
              </h2>
            </div>

            {audienceLoading && !audience ? (
              <div className="mt-4 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/8" />
              </div>
            ) : audienceError ? (
              <p className="mt-3 text-[11px] text-white/60">{audienceError}</p>
            ) : topInterests.length === 0 ? (
              <p className="mt-3 text-[11px] text-white/60">
                Quando os teus compradores começarem a preencher interesses no
                perfil, vais ver aqui quais aparecem com mais frequência.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-[11px]">
                {topInterests.map((i, idx) => (
                  <li
                    key={`${i.interest}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
                  >
                    <span className="text-white/85">{i.interest}</span>
                    <span className="text-white/70">
                      {i.buyers} comprador(es)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
