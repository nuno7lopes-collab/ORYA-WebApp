"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TicketFromApi = {
  id: string;
  quantity?: number | null;
  pricePaid?: number | null;
  currency?: string | null;
  purchasedAt: string;
  event?: {
    slug?: string | null;
    title?: string | null;
    startDate?: string | null;
    locationName?: string | null;
    coverImageUrl?: string | null;
  } | null;
  ticket?: {
    name?: string | null;
    description?: string | null;
  } | null;
  qrToken?: string | null;
};

type TicketsApiResponse = {
  success: boolean;
  tickets: TicketFromApi[];
};

type UITicketPurchase = {
  id: string;
  quantity: number;
  pricePaid: number;
  currency: string;
  createdAt: string;
  event: {
    slug: string;
    title: string;
    startDate: string;
    locationName: string;
    coverImageUrl?: string | null;
  };
  ticket: {
    name: string;
    description?: string | null;
  };
  qrToken: string | null;
};

export default function MyTicketsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tickets, setTickets] = useState<UITicketPurchase[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch("/api/me/tickets", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (res.status === 401) {
          // Não autenticado → manda para login
          router.push("/login?redirect=/me/tickets");
          return;
        }

        if (!res.ok) {
          const text = await res.text();
          console.error("Erro ao carregar bilhetes:", text);
          if (!cancelled) {
            setErrorMsg(
              "Não foi possível carregar os teus bilhetes. Tenta novamente em alguns segundos."
            );
          }
          return;
        }
        const json = (await res.json()) as TicketsApiResponse;

        if (!json.success || !Array.isArray(json.tickets)) {
          if (!cancelled) {
            setErrorMsg("Resposta inesperada ao tentar carregar os bilhetes.");
          }
          return;
        }
        const mapped: UITicketPurchase[] = json.tickets.map((p: TicketFromApi) => ({
          id: p.id,
          quantity: p.quantity ?? 1,
          pricePaid: Number(p.pricePaid ?? 0),
          currency: p.currency ?? "EUR",
          createdAt: p.purchasedAt,
          qrToken: p.qrToken ?? null,

          event: {
            slug: p.event?.slug ?? "",
            title: p.event?.title ?? "Evento ORYA",
            startDate: p.event?.startDate ?? p.purchasedAt,
            locationName: p.event?.locationName ?? "Local a anunciar",
            coverImageUrl: p.event?.coverImageUrl ?? null,
          },

          ticket: {
            name: p.ticket?.name ?? "Bilhete",
            description: p.ticket?.description ?? null,
          },
        }));

        // Ordenar por data do evento (mais próximo primeiro)
        mapped.sort((a, b) => {
          const da = new Date(a.event.startDate).getTime();
          const db = new Date(b.event.startDate).getTime();
          return da - db;
        });

        if (!cancelled) {
          setTickets(mapped);
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar bilhetes:", err);
        if (!cancelled) {
          setErrorMsg(
            "Ocorreu um problema inesperado. Tenta novamente dentro de instantes."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTickets();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const hasTickets = tickets.length > 0;

  const now = new Date();

  const totalCount = tickets.length;

  const upcomingCount = tickets.filter((purchase) => {
    const date = purchase.event?.startDate
      ? new Date(purchase.event.startDate)
      : null;

    if (!date || Number.isNaN(date.getTime())) {
      return false;
    }

    return date >= now;
  }).length;

  const pastCount = tickets.filter((purchase) => {
    const date = purchase.event?.startDate
      ? new Date(purchase.event.startDate)
      : null;

    if (!date || Number.isNaN(date.getTime())) {
      return false;
    }

    return date < now;
  }).length;

  const filteredTickets = tickets.filter((purchase) => {
    const date = purchase.event?.startDate
      ? new Date(purchase.event.startDate)
      : null;

    if (!date || Number.isNaN(date.getTime())) {
      return activeTab === "all";
    }

    if (activeTab === "upcoming") {
      return date >= now;
    }

    if (activeTab === "past") {
      return date < now;
    }

    return true;
  });

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function formatPrice(amount: number, currency: string) {
    return `${amount.toFixed(2)} ${currency || "EUR"}`;
  }

  return (
    <main
      aria-labelledby="my-tickets-title"
      className="orya-body-bg min-h-screen w-full text-white pb-16"
    >
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                A minha conta
              </p>
              <p className="text-sm text-white/85">
                Todos os bilhetes ligados à tua conta ORYA.
              </p>
            </div>
          </div>

          <Link
            href="/me"
            className="hidden sm:inline-flex text-[11px] px-3 py-1.5 rounded-xl border border-white/15 text-white/75 hover:bg-white/5 transition-colors"
          >
            &larr; Voltar à conta
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 pt-8 md:pt-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1
              id="my-tickets-title"
              className="text-2xl md:text-3xl font-semibold tracking-tight"
            >
              Os meus bilhetes
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-xl">
              Aqui vais encontrar todos os bilhetes que compraste com esta
              conta. No futuro, vais conseguir gerir transferências, revendas e
              upgrades diretamente a partir desta página.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/explorar"
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 active:scale-95 transition-transform shadow-[0_0_26px_rgba(107,255,255,0.45)]"
            >
              Descobrir novos eventos
            </Link>
            <Link
              href="/me/edit"
              className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
            >
              Editar perfil
            </Link>
          </div>
        </div>

        {/* Mensagens de erro / estado */}
        {loading && (
          <div className="mt-6 space-y-4" role="status" aria-live="polite">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              A carregar os teus bilhetes…
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-black/70 to-black/95"
                >
                  <div className="relative aspect-[3/4] w-full animate-pulse bg-gradient-to-br from-[#1b1b2f] via-black to-[#141421]" />

                  <div className="border-t border-white/10 bg-black/80 px-4 py-3 space-y-3">
                    <div className="h-3 w-24 rounded-full bg-white/10" />
                    <div className="h-3 w-32 rounded-full bg-white/10" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-3 w-full rounded-full bg-white/10" />
                      <div className="h-3 w-full rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMsg && !loading && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100 flex items-start gap-2" role="alert" aria-live="assertive">
            <span className="mt-[2px] text-sm">⚠️</span>
            <div className="space-y-1">
              <p className="font-medium text-red-100">Não foi possível carregar</p>
              <p className="text-[11px] text-red-100/80">{errorMsg}</p>
            </div>
          </div>
        )}

        {!loading && !errorMsg && !hasTickets && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/3 px-6 py-8 text-center space-y-3">
            <p className="text-lg font-medium">Ainda não tens bilhetes</p>
            <p className="text-sm text-white/65 max-w-md mx-auto">
              Assim que comprares um bilhete através da ORYA, ele vai aparecer
              aqui — com acesso rápido ao evento, à informação e, em breve, ao
              teu QR code.
            </p>
            <Link
              href="/explorar"
              className="inline-flex mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-105 active:scale-95 transition-transform shadow-[0_0_28px_rgba(107,255,255,0.5)]"
            >
              Ver eventos disponíveis
            </Link>
          </div>
        )}

        {hasTickets && (
          <div className="mt-6 space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2 md:max-w-md">
                <h2 className="text-sm font-semibold text-white/85">
                  Eventos a que vais com bilhetes ORYA
                </h2>
                <p className="text-[11px] text-white/60">
                  Agrupados por próximos, passados e todos os bilhetes ligados à tua conta ORYA, para encontrares tudo em segundos.
                </p>
                <div className="flex flex-wrap gap-3 text-[10px] text-white/55">
                  <span>
                    <span className="font-semibold text-white/80">{upcomingCount}</span>{" "}
                    próximos
                  </span>
                  <span>
                    <span className="font-semibold text-white/80">{pastCount}</span>{" "}
                    passados
                  </span>
                  <span>
                    <span className="font-semibold text-white/80">{totalCount}</span>{" "}
                    no total
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center rounded-full bg-white/5 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("upcoming")}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
                    activeTab === "upcoming"
                      ? "bg-white text-black"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Próximos ({upcomingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("past")}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
                    activeTab === "past"
                      ? "bg-white text-black"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Passados ({pastCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
                    activeTab === "all"
                      ? "bg-white text-black"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Todos ({totalCount})
                </button>
              </div>
            </div>

            {filteredTickets.length === 0 ? (
              <p className="mt-2 text-xs text-white/60">
                Não há bilhetes nesta secção. Experimenta outra aba acima.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTickets.map((purchase) => {
                  const event = purchase.event;
                  const ticket = purchase.ticket;
                  const dateLabel = formatDate(event.startDate);
                  const totalLabel = formatPrice(
                    purchase.pricePaid,
                    purchase.currency
                  );
                  const unitPrice = purchase.quantity > 0
                    ? purchase.pricePaid / purchase.quantity
                    : purchase.pricePaid;

                  const eventDateObj = event.startDate ? new Date(event.startDate) : null;
                  let statusLabel = "Confirmado";
                  let statusClass =
                    "border-emerald-400/50 bg-emerald-500/10 text-emerald-200";

                  if (eventDateObj && !Number.isNaN(eventDateObj.getTime())) {
                    const isPast = eventDateObj.getTime() < now.getTime();

                    const isSameDay =
                      eventDateObj.getFullYear() === now.getFullYear() &&
                      eventDateObj.getMonth() === now.getMonth() &&
                      eventDateObj.getDate() === now.getDate();

                    if (isPast) {
                      statusLabel = "Já aconteceu";
                      statusClass =
                        "border-white/25 bg-white/5 text-white/80";
                    } else if (isSameDay) {
                      statusLabel = "É hoje";
                      statusClass =
                        "border-sky-400/60 bg-sky-500/10 text-sky-100";
                    }
                  }

                  return (
                    <div
                      key={purchase.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-black/80 to-black/95 hover:border-[#6BFFFF]/70 transition-colors shadow-[0_16px_45px_rgba(0,0,0,0.75)]"
                    >
                      {/* Poster visual */}
                      <div className="relative w-full overflow-hidden">
                        <div className="relative aspect-[3/4] w-full">
                          {event.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={event.coverImageUrl}
                              alt={event.title}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1b1b2f] via-black to-[#141421] text-[11px] text-white/40">
                              Sem imagem de capa
                            </div>
                          )}

                          {/* Overlay gradient + basic info sobre o poster */}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                          {/* Badges no topo */}
                          <div className="absolute left-2 right-2 top-2 flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white/85">
                              {purchase.quantity > 1
                                ? `${purchase.quantity} bilhetes`
                                : "1 bilhete"}
                            </span>
                          </div>

                          {/* Título + data na parte de baixo do poster */}
                          <div className="absolute inset-x-2 bottom-2 space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                              Bilhete ORYA
                            </p>
                            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                              {event.title}
                            </h3>
                            {event.locationName && (
                              <p className="text-[11px] text-white/70 line-clamp-1">
                                {event.locationName}
                              </p>
                            )}
                            {dateLabel && (
                              <p className="text-[11px] text-white/80">
                                {dateLabel}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Zona de detalhes por baixo do poster */}
                      <div className="border-t border-white/10 bg-black/80 px-4 py-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="space-y-1">
                            <p className="text-white/50">Total pago</p>
                            <p className="text-white/90">{totalLabel}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white/50">Preço unitário</p>
                            <p className="text-white/90">
                              {formatPrice(unitPrice, purchase.currency)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white/50">Tipo de bilhete</p>
                            <p className="text-white/90 line-clamp-1">
                              {ticket.name}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white/50">Referência</p>
                            <p className="text-white/80 text-[10px] break-all">
                              {purchase.id}
                            </p>
                          </div>
                        </div>

                        <p className="mt-1 text-[10px] text-white/40">
                          QR code disponível neste bilhete. Em breve vais poder transferir bilhetes, revender e gerir tudo diretamente nesta página.
                        </p>

                        {/* QR Code real (se disponível) */}
                        <div className="mt-4 flex justify-center">
                          {purchase.qrToken ? (
                            <div className="bg-white p-3 rounded-2xl shadow-[0_0_30px_rgba(255,0,200,0.4)]">
                              <img
                                src={`/api/qr/${purchase.qrToken}`}
                                alt="QR Code do bilhete ORYA"
                                className="h-32 w-32 object-contain"
                              />
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/20 bg-black/40 px-3 py-2 text-[10px] text-white/70 text-center">
                              A preparar o QR code deste bilhete… se o pagamento acabou de ser confirmado, atualiza a página em alguns segundos.
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              event.slug ? router.push(`/eventos/${event.slug}`) : null
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
                          >
                            Ver evento
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/bilhete/${purchase.id}`)}
                            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1 font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.03] active:scale-95 transition-transform"
                          >
                            Abrir bilhete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}