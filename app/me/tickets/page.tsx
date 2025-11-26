"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

type ResaleMode = "ALWAYS" | "AFTER_SOLD_OUT" | "DISABLED";

type TicketFromApi = {
  id: string;
  pricePaid?: number | null; // cêntimos
  currency?: string | null;
  purchasedAt: string;
  event?: {
    id?: number | null;
    slug?: string | null;
    title?: string | null;
    startDate?: string | null;
    locationName?: string | null;
    coverImageUrl?: string | null;
    resaleMode?: ResaleMode | null;
    isSoldOut?: boolean | null;
  } | null;
  ticket?: {
    id?: string | null;
    name?: string | null;
    description?: string | null;
  } | null;
  qrToken?: string | null;
  resaleId?: string | null;
  resaleStatus?: "LISTED" | "SOLD" | "CANCELLED" | null;
  resalePrice?: number | null; // cêntimos
  resaleCurrency?: string | null;
};

type TicketsApiResponse = {
  success: boolean;
  tickets: TicketFromApi[];
};

type UITicket = {
  id: string;
  eventId: number;
  ticketTypeId: string;
  priceCents: number;
  priceEur: number;
  currency: string;
  createdAt: string;
  qrToken: string | null;
  resaleId?: string | null;
  resaleStatus?: "LISTED" | "SOLD" | "CANCELLED" | null;
  resalePriceCents?: number | null;
  resaleCurrency?: string | null;
};

type UITicketGroup = {
  key: string;
  quantity: number;
  totalPaidEur: number;
  currency: string;
  event: {
    id: number;
    slug: string;
    title: string;
    startDate: string;
    locationName: string;
    coverImageUrl?: string | null;
    resaleMode: ResaleMode;
    isSoldOut: boolean;
  };
  ticket: {
    id: string;
    name: string;
    description?: string | null;
  };
  tickets: UITicket[];
};

export default function MyTicketsPage() {
  const router = useRouter();
  const { openModal } = useAuthModal();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ticketGroups, setTicketGroups] = useState<UITicketGroup[]>([]);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">("upcoming");

  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    ticketId: string | null;
    ticketTitle: string | null;
  }>({
    open: false,
    ticketId: null,
    ticketTitle: null,
  });

  const [transferUsername, setTransferUsername] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

    const [resaleModal, setResaleModal] = useState<{
    open: boolean;
    ticketId: string | null;
    ticketTitle: string | null;
  }>({
    open: false,
    ticketId: null,
    ticketTitle: null,
  });
  const [resalePrice, setResalePrice] = useState("");
  const [resaleLoading, setResaleLoading] = useState(false);
  const [resaleError, setResaleError] = useState<string | null>(null);
  const [resaleSuccess, setResaleSuccess] = useState<string | null>(null);
  const [toasts, setToasts] = useState<
    { id: number; type: "error" | "success"; message: string }[]
  >([]);

  function pushToast(message: string, type: "error" | "success" = "error") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

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
          // Não autenticado → abre modal de autenticação e define redirect para esta página
          openModal({ mode: "login", redirectTo: "/me/tickets" });
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

        const apiTicketMap = new Map<string, TicketFromApi>(
          json.tickets.map((t: TicketFromApi) => [t.id, t])
        );

        // Normalizar tickets individuais (1 entrada = 1 registo)
        const singles: UITicket[] = json.tickets.map((p: TicketFromApi) => {
          const priceCents = Number(p.pricePaid ?? 0);
          const eventId = Number(p.event?.id ?? -1);
          const ticketTypeId = (p.ticket?.id ?? "").toString();

          return {
            id: p.id,
            eventId,
            ticketTypeId,
            priceCents,
            priceEur: priceCents / 100,
            currency: p.currency ?? "EUR",
            createdAt: p.purchasedAt,
            qrToken: p.qrToken ?? null,
            resaleId: p.resaleId ?? null,
            resaleStatus:
              (p.resaleStatus as "LISTED" | "SOLD" | "CANCELLED" | null) ?? null,
            resalePriceCents: p.resalePrice ?? null,
            resaleCurrency: p.resaleCurrency ?? null,
          };
        });

        // Agrupar por evento + tipo de bilhete para o cartão principal,
        // mas manter cada QR individual dentro do grupo.
        const groupsMap = new Map<string, UITicketGroup>();

        for (const single of singles) {
          const source = apiTicketMap.get(single.id) as TicketFromApi | undefined;
          const event = source?.event ?? {};
          const ticket = source?.ticket ?? {};

          const eventData = {
            id: Number(event.id ?? single.eventId ?? -1),
            slug: event.slug ?? "",
            title: event.title ?? "Evento ORYA",
            startDate: event.startDate ?? single.createdAt,
            locationName: event.locationName ?? "Local a anunciar",
            coverImageUrl: event.coverImageUrl ?? null,
            resaleMode: (event.resaleMode as ResaleMode | undefined) ?? "ALWAYS",
            isSoldOut: Boolean(event.isSoldOut),
          };

          const ticketData = {
            id: ticket.id ? String(ticket.id) : "wave",
            name: ticket.name ?? "Bilhete",
            description: ticket.description ?? null,
          };

          const eventKey = eventData.id > 0 ? String(eventData.id) : eventData.slug;
          const key = `${eventKey}-${ticketData.id}`;

          if (!groupsMap.has(key)) {
            groupsMap.set(key, {
              key,
              quantity: 1,
              totalPaidEur: single.priceEur,
              currency: single.currency,
              event: eventData,
              ticket: ticketData,
              tickets: [single],
            });
          } else {
            const existing = groupsMap.get(key)!;
            existing.quantity += 1;
            existing.totalPaidEur += single.priceEur;
            existing.tickets.push(single);
          }
        }

        const mapped = Array.from(groupsMap.values());

        // Ordenar por data do evento (mais próximo primeiro)
        mapped.sort((a, b) => {
          const da = new Date(a.event.startDate).getTime();
          const db = new Date(b.event.startDate).getTime();
          return da - db;
        });

        if (!cancelled) {
          setTicketGroups(mapped);
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

  const hasTickets = ticketGroups.length > 0;

  const now = new Date();
  const rotationWindow = Math.floor(now.getTime() / 15000);

  const totalCount = ticketGroups.reduce((sum, group) => sum + group.quantity, 0);

  const upcomingCount = ticketGroups.reduce((sum, group) => {
    const date = group.event?.startDate ? new Date(group.event.startDate) : null;
    if (!date || Number.isNaN(date.getTime())) return sum;
    return date >= now ? sum + group.quantity : sum;
  }, 0);

  const pastCount = ticketGroups.reduce((sum, group) => {
    const date = group.event?.startDate ? new Date(group.event.startDate) : null;
    if (!date || Number.isNaN(date.getTime())) return sum;
    return date < now ? sum + group.quantity : sum;
  }, 0);

  const filteredGroups = ticketGroups.filter((group) => {
    const date = group.event?.startDate ? new Date(group.event.startDate) : null;

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
    const safeCurrency = currency || "EUR";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function openTransferModalForTicket(ticketId: string, ticketTitle: string) {
    setTransferModal({
      open: true,
      ticketId,
      ticketTitle,
    });
    setTransferUsername("");
    setTransferError(null);
    setTransferSuccess(null);
  }

  async function handleConfirmTransfer() {
    if (!transferModal.ticketId) return;

    const username = transferUsername.trim();
    if (!username) {
      setTransferError("Indica o username ORYA do teu amigo.");
      setTransferSuccess(null);
      return;
    }

    try {
      setTransferLoading(true);
      setTransferError(null);
      setTransferSuccess(null);

      const res = await fetch("/api/tickets/transfer/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId: transferModal.ticketId,
          targetIdentifier: username,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const code = (data?.error || data?.reason || "").toString();
        const friendly =
          code === "CANNOT_TRANSFER_TO_SELF"
            ? "Não podes enviar um bilhete para ti próprio."
            : code === "TARGET_NOT_FOUND"
              ? "Não encontrámos esse username. Confirma o @ do teu amigo."
              : code === "TRANSFER_ALREADY_PENDING"
                ? "Já tens uma transferência pendente para este bilhete."
                : "Não foi possível iniciar a transferência. Tenta novamente.";
        const reason = friendly;
        setTransferError(reason);
        pushToast(reason, "error");
        setTransferSuccess(null);
        return;
      }

      setTransferSuccess(
        `Transferência enviada para @${username}. O teu amigo vai poder aceitar ou recusar.`
      );
      pushToast(`Transferência enviada para @${username}.`, "success");
    } catch (err) {
      console.error("Erro ao iniciar transferência:", err);
      setTransferError(
        "Ocorreu um erro inesperado ao iniciar a transferência. Tenta novamente dentro de instantes."
      );
      setTransferSuccess(null);
      pushToast(
        "Ocorreu um erro inesperado ao iniciar a transferência. Tenta novamente.",
        "error"
      );
    } finally {
      setTransferLoading(false);
    }
  }

  function openResaleModalForTicket(ticketId: string, ticketTitle: string) {
    setResaleModal({
      open: true,
      ticketId,
      ticketTitle,
    });
    setResalePrice("");
    setResaleError(null);
    setResaleSuccess(null);
  }

  async function handleConfirmResale() {
    if (!resaleModal.ticketId) return;

    const targetGroup = ticketGroups.find((g) =>
      g.tickets.some((t) => t.id === resaleModal.ticketId)
    );
    if (targetGroup) {
      const resaleMode = targetGroup.event.resaleMode ?? "ALWAYS";
      const allowed =
        resaleMode === "ALWAYS" ||
        (resaleMode === "AFTER_SOLD_OUT" && targetGroup.event.isSoldOut);
      if (!allowed) {
        setResaleError(
          resaleMode === "DISABLED"
            ? "Este evento não permite revendas."
            : "A revenda fica disponível quando o evento estiver esgotado."
        );
        setResaleSuccess(null);
        return;
      }
    }

    const raw = resalePrice.replace(",", ".").trim();
    const value = Number(raw);
    if (!value || Number.isNaN(value) || value <= 0) {
      setResaleError("Indica um preço válido em euros (ex: 15 ou 15,50).");
      setResaleSuccess(null);
      return;
    }

    const cents = Math.round(value * 100);

    try {
      setResaleLoading(true);
      setResaleError(null);
      setResaleSuccess(null);

      const res = await fetch("/api/tickets/resale/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId: resaleModal.ticketId,
          price: cents,
          priceCents: cents,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const code = (data?.error || data?.reason || "").toString();
        const friendly =
          code === "RESALE_DISABLED_FOR_EVENT"
            ? "Este evento não permite revendas."
            : code === "RESALE_ONLY_AFTER_SOLD_OUT"
              ? "Só podes revender depois de o evento esgotar."
              : code === "TICKET_ALREADY_IN_RESALE"
                ? "Este bilhete já está listado."
                : code === "TRANSFER_ALREADY_PENDING"
                  ? "Tens uma transferência pendente para este bilhete."
                  : "Não foi possível listar este bilhete à venda. Tenta novamente.";
        setResaleError(friendly);
        pushToast(friendly, "error");
        setResaleSuccess(null);
        return;
      }

      setResaleSuccess(
        "Bilhete colocado em revenda. Outros utilizadores já o podem comprar."
      );
      pushToast("Bilhete colocado em revenda.", "success");

      setTicketGroups((prev) =>
        prev.map((group) => {
          if (!group.tickets.some((t) => t.id === resaleModal.ticketId)) {
            return group;
          }

          return {
            ...group,
            tickets: group.tickets.map((t) =>
              t.id === resaleModal.ticketId
                ? {
                    ...t,
                    resaleStatus: "LISTED",
                    resaleId: (data.resaleId as string | undefined) ?? t.resaleId ?? null,
                    resalePriceCents: cents,
                    resaleCurrency: t.currency,
                  }
                : t
            ),
          };
        })
      );
    } catch (err) {
      console.error("Erro ao criar revenda:", err);
      setResaleError(
        "Ocorreu um erro inesperado ao listar o bilhete. Tenta novamente dentro de instantes."
      );
      setResaleSuccess(null);
      pushToast(
        "Ocorreu um erro inesperado ao listar o bilhete. Tenta novamente dentro de instantes.",
        "error"
      );
    } finally {
      setResaleLoading(false);
    }
  }

  async function handleCancelResale(resaleId: string, ticketId: string) {
    try {
      const res = await fetch("/api/tickets/resale/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resaleId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        console.error("Erro ao cancelar revenda:", data);
        alert("Não foi possível cancelar esta revenda. Tenta novamente.");
        pushToast("Não foi possível cancelar esta revenda. Tenta novamente.", "error");
        return;
      }

      setTicketGroups((prev) =>
        prev.map((group) => {
          if (!group.tickets.some((t) => t.id === ticketId)) return group;

          return {
            ...group,
            tickets: group.tickets.map((t) =>
              t.id === ticketId
                ? { ...t, resaleStatus: null, resaleId: null, resalePriceCents: null }
                : t
            ),
          };
        })
      );
      pushToast("Revenda cancelada com sucesso.", "success");
    } catch (err) {
      console.error("Erro ao cancelar revenda:", err);
      alert(
        "Ocorreu um erro inesperado ao cancelar a revenda. Tenta novamente dentro de instantes."
      );
      pushToast(
        "Ocorreu um erro inesperado ao cancelar a revenda. Tenta novamente.",
        "error"
      );
    }
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[240px] rounded-xl px-3 py-2 text-[11px] shadow-lg backdrop-blur ${
              toast.type === "success"
                ? "bg-emerald-500/20 border border-emerald-400/50 text-emerald-50"
                : "bg-red-500/15 border border-red-400/50 text-red-50"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

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
              aqui — com acesso rápido ao evento, à informação e ao teu QR code.
            </p>
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

            {filteredGroups.length === 0 ? (
              <p className="mt-2 text-xs text-white/60">
                Não há bilhetes nesta secção. Experimenta outra aba acima.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGroups.map((group) => {
                  const event = group.event;
                  const ticket = group.ticket;
                  const dateLabel = formatDate(event.startDate);
                  const totalLabel = formatPrice(group.totalPaidEur, group.currency);
                  const unitPrice =
                    group.quantity > 0
                      ? group.totalPaidEur / group.quantity
                      : group.totalPaidEur;

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

                  const isExpanded = expandedGroupKey === group.key;
                  const resaleMode = event.resaleMode ?? "ALWAYS";
                  const resaleAllowed =
                    resaleMode === "ALWAYS" ||
                    (resaleMode === "AFTER_SOLD_OUT" && event.isSoldOut);
                  const resaleDisabledReason =
                    resaleMode === "DISABLED"
                      ? "Revenda desativada pelo organizador."
                      : "A revenda fica disponível quando o evento estiver esgotado.";

                  return (
                    <div
                      key={group.key}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-black/80 to-black/95 hover:border-[#6BFFFF]/70 transition-colors shadow-[0_16px_45px_rgba(0,0,0,0.75)]"
                    >
                      <div className="flex items-center gap-3 px-4 py-3 bg-black/40 border-b border-white/10">
                        <div className="h-12 w-12 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center text-[11px] text-white/70 font-semibold">
                          {group.quantity}x
                        </div>
                        <div className="flex flex-col">
                          <p className="text-white font-medium leading-tight">{event.title}</p>
                          <p className="text-xs text-white/60 leading-tight">
                            {ticket.name}
                          </p>
                        </div>
                        <div className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/60">
                          <span
                            className={`rounded-full border px-2 py-0.5 ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                          <span className="rounded-full border border-white/15 px-2 py-0.5 bg-white/5">
                            {resaleMode === "DISABLED"
                              ? "Revenda OFF"
                              : resaleMode === "AFTER_SOLD_OUT"
                                ? event.isSoldOut
                                  ? "Revenda ON (esgotado)"
                                  : "Revenda após esgotar"
                                : "Revenda ON"}
                          </span>
                        </div>
                      </div>

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
                              {group.quantity > 1
                                ? `${group.quantity} bilhetes`
                                : "1 bilhete"}
                            </span>
                          </div>

                          {/* Título + data na parte de baixo do poster */}
                          <div className="absolute inset-x-2 bottom-2 space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                              Bilhetes ORYA
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
                            <p className="text-white/50">Preço médio</p>
                            <p className="text-white/90">
                              {formatPrice(unitPrice, group.currency)}
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
                              {group.tickets[0]?.id}
                              {group.quantity > 1 ? " (+)" : ""}
                            </p>
                          </div>
                        </div>

                        <p className="mt-1 text-[10px] text-white/45">
                          Os QR codes aparecem apenas ao abrir este cartão. Cada bilhete tem o seu QR único.
                        </p>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                event.slug ? router.push(`/eventos/${event.slug}`) : null
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
                            >
                              Ver evento
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGroupKey(isExpanded ? null : group.key)
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1 font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.03] active:scale-95 transition-transform"
                          >
                            {isExpanded ? "Fechar bilhetes" : `Ver bilhetes (${group.quantity})`}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-3">
                            {group.tickets.map((t, idx) => {
                              const isListed = t.resaleStatus === "LISTED" && t.resaleId;
                              const ticketLabel = `${event.title} — ${ticket.name} (#${idx + 1})`;

                              return (
                                <div
                                  key={t.id}
                                  className="rounded-xl border border-white/12 bg-black/60 p-3 space-y-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-col">
                                      <p className="text-sm font-medium text-white">
                                        Bilhete #{idx + 1}
                                      </p>
                                      <p className="text-[10px] text-white/60 break-all">
                                        Ref: {t.id}
                                      </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] text-white/80">
                                      {isListed ? "À venda" : "Na tua carteira"}
                                    </span>
                                  </div>

                                  <div className="flex items-start gap-3">
                                        {t.qrToken ? (
                                          <div className="shrink-0 rounded-2xl bg-white p-2 shadow-[0_0_28px_rgba(255,0,200,0.35)]">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={`/api/qr/${t.qrToken}?r=${rotationWindow}`}
                                              alt="QR Code do bilhete ORYA"
                                              className="h-20 w-20 object-contain"
                                            />
                                          </div>
                                    ) : (
                                      <div className="shrink-0 rounded-2xl border border-dashed border-white/25 bg-black/40 px-3 py-2 text-[10px] text-white/60 text-center max-w-[120px]">
                                        A preparar o QR…
                                      </div>
                                    )}

                                    <div className="flex-1 space-y-2 text-[11px]">
                                      <p className="text-white/80">
                                        Preço pago: {formatPrice(t.priceEur, t.currency)}
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openTransferModalForTicket(t.id, ticketLabel)
                                          }
                                          className="inline-flex items-center gap-1 rounded-full border border-white/25 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
                                        >
                                          Enviar a amigo
                                        </button>
                                        {isListed ? (
                                          <button
                                            type="button"
                                            onClick={() => handleCancelResale(t.resaleId as string, t.id)}
                                            className="inline-flex items-center gap-1 rounded-full border border-red-400/60 px-3 py-1 text-red-100 hover:bg-red-500/15 transition-colors"
                                          >
                                            Cancelar venda
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => openResaleModalForTicket(t.id, ticketLabel)}
                                            disabled={!resaleAllowed}
                                            title={!resaleAllowed ? resaleDisabledReason : undefined}
                                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition-colors ${
                                              resaleAllowed
                                                ? "border-[#6BFFFF]/70 text-[#6BFFFF] hover:bg-[#6BFFFF]/10"
                                                : "border-white/15 text-white/40 cursor-not-allowed"
                                            }`}
                                          >
                                            Pôr à venda
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => router.push(`/bilhete/${t.id}`)}
                                          className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 transition-colors"
                                        >
                                          Abrir bilhete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {transferModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                  Transferir bilhete
                </p>
                <h2 className="mt-1 text-sm font-semibold text-white">
                  Enviar a um amigo
                </h2>
                {transferModal.ticketTitle && (
                  <p className="mt-1 text-[11px] text-white/65">
                    Evento: <span className="font-medium">{transferModal.ticketTitle}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setTransferModal({ open: false, ticketId: null, ticketTitle: null })
                }
                className="text-[11px] text-white/50 hover:text-white"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-[11px] text-white/70">
                Username ORYA do teu amigo
              </label>
              <input
                type="text"
                value={transferUsername}
                onChange={(e) => setTransferUsername(e.target.value)}
                placeholder="@username"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/70"
              />

              {transferError && (
                <p className="mt-2 text-[11px] text-red-300">
                  {transferError}
                </p>
              )}

              {transferSuccess && (
                <p className="mt-2 text-[11px] text-emerald-300">
                  {transferSuccess}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() =>
                  setTransferModal({ open: false, ticketId: null, ticketTitle: null })
                }
                className="px-3 py-1.5 rounded-full border border-white/20 text-white/75 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={transferLoading}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
              >
                {transferLoading ? "A enviar…" : "Confirmar transferência"}
              </button>
            </div>
          </div>
        </div>
      )}
      {resaleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                  Revender bilhete
                </p>
                <h2 className="mt-1 text-sm font-semibold text-white">
                  Colocar à venda
                </h2>
                {resaleModal.ticketTitle && (
                  <p className="mt-1 text-[11px] text-white/65">
                    Evento:{" "}
                    <span className="font-medium">
                      {resaleModal.ticketTitle}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setResaleModal({
                    open: false,
                    ticketId: null,
                    ticketTitle: null,
                  })
                }
                className="text-[11px] text-white/50 hover:text-white"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-[11px] text-white/70">
                Preço de revenda (em €)
              </label>
              <input
                type="text"
                value={resalePrice}
                onChange={(e) => setResalePrice(e.target.value)}
                placeholder="ex: 15 ou 15,50"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#6BFFFF]/70"
              />

              {resaleError && (
                <p className="mt-2 text-[11px] text-red-300">
                  {resaleError}
                </p>
              )}

              {resaleSuccess && (
                <p className="mt-2 text-[11px] text-emerald-300">
                  {resaleSuccess}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={() =>
                  setResaleModal({
                    open: false,
                    ticketId: null,
                    ticketTitle: null,
                  })
                }
                className="px-3 py-1.5 rounded-full border border-white/20 text-white/75 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResale}
                disabled={resaleLoading}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.7)] hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60 disabled:hover:scale-100"
              >
                {resaleLoading ? "A listar…" : "Confirmar revenda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
