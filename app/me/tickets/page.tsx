/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

        const json = await res.json();

        if (!json.success || !Array.isArray(json.tickets)) {
          if (!cancelled) {
            setErrorMsg("Resposta inesperada ao tentar carregar os bilhetes.");
          }
          return;
        }

        const mapped: UITicketPurchase[] = json.tickets.map((p: any) => ({
          id: p.id,
          quantity: p.quantity ?? 1,
          pricePaid: Number(p.pricePaid ?? 0),
          currency: p.currency ?? "EUR",
          createdAt: p.purchasedAt,

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
    <main className="orya-body-bg min-h-screen w-full text-white pb-16">
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

          <a
            href="/me"
            className="hidden sm:inline-flex text-[11px] px-3 py-1.5 rounded-xl border border-white/15 text-white/75 hover:bg-white/5 transition-colors"
          >
            &larr; Voltar à conta
          </a>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-5 pt-8 md:pt-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Os meus bilhetes
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-xl">
              Aqui vais encontrar todos os bilhetes que compraste com esta
              conta. No futuro, vais conseguir gerir transferências, revendas e
              upgrades diretamente a partir desta página.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <a
              href="/explorar"
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold hover:scale-105 active:scale-95 transition-transform shadow-[0_0_26px_rgba(107,255,255,0.45)]"
            >
              Descobrir novos eventos
            </a>
            <a
              href="/me/edit"
              className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
            >
              Editar perfil
            </a>
          </div>
        </div>

        {/* Mensagens de erro / estado */}
        {loading && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            A carregar os teus bilhetes…
          </div>
        )}

        {errorMsg && !loading && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100 flex items-start gap-2">
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
            <a
              href="/explorar"
              className="inline-flex mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-105 active:scale-95 transition-transform shadow-[0_0_28px_rgba(107,255,255,0.5)]"
            >
              Ver eventos disponíveis
            </a>
          </div>
        )}

        {hasTickets && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white/85">
                Bilhetes ativos &amp; históricos
              </h2>
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
                  Próximos
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
                  Passados
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
                  Todos
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

                  return (
                    <div
                      key={purchase.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/4 via-black/70 to-black/90 hover:border-[#6BFFFF]/60 transition-colors shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
                    >
                      {/* Capa */}
                      {event.coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.coverImageUrl}
                          alt={event.title}
                          className="h-32 w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 mb-0.5">
                              Bilhete ORYA
                            </p>
                            <h3 className="text-sm font-semibold leading-snug">
                              {event.title}
                            </h3>
                            {event.locationName && (
                              <p className="text-[11px] text-white/55 mt-1">
                                {event.locationName}
                              </p>
                            )}
                          </div>
                          <span className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                            Confirmado
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                          <div className="space-y-1">
                            <p className="text-white/55">Data</p>
                            <p className="text-white/90">{dateLabel}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white/55">Bilhete</p>
                            <p className="text-white/90">
                              {ticket.name}{" "}
                              {purchase.quantity > 1 &&
                                `× ${purchase.quantity}`}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white/55">Total pago</p>
                            <p className="text-white/90">{totalLabel}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-white/55">Preço unitário</p>
                            <p className="text-white/90">
                              {formatPrice(unitPrice, purchase.currency)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-2 text-[10px] text-white/40">
                          Em breve: QR code, transferência de bilhetes e gestão
                          avançada diretamente nesta página.
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() =>
                              event.slug ? router.push(`/eventos/${event.slug}`) : null
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
                          >
                            Ver evento
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/bilhete/${purchase.id}`)}
                            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1 font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.6)] hover:scale-[1.02] active:scale-95 transition-transform"
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