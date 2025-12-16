"use client";

import { useEffect, useMemo, useState } from "react";

type TicketItem = {
  id: string;
  badge: string;
  paymentStatusLabel?: string;
  nextAction?: string;
  event: { title: string; slug: string };
  isTournament?: boolean;
  liveLink?: string | null;
};

type InscricaoItem = {
  id: string;
  badge: string;
  paymentStatusLabel?: string;
  nextAction?: string;
  event: { title: string; slug: string } | null;
  isCaptain: boolean;
  ctaUrl?: string | null;
  liveLink?: string | null;
};

type FilterKey = "ALL" | "TICKETS" | "TOURNAMENTS" | "FREE" | "RESALE";

export default function CarteiraPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Best-effort claim automático (se email verificado)
    fetch("/api/email/verified", { method: "POST" }).catch(() => undefined);

    const load = async () => {
      setLoading(true);
      try {
        const [tRes, iRes] = await Promise.all([fetch("/api/me/tickets"), fetch("/api/me/inscricoes")]);
        const tJson = await tRes.json();
        const iJson = await iRes.json();
        if (tJson?.tickets) setTickets(tJson.tickets);
        if (iJson?.items) setInscricoes(iJson.items);
      } catch (err) {
        console.warn("Erro a carregar carteira", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const list = useMemo(() => {
    const ticketItems =
      tickets?.map((t) => ({
        id: t.id,
        kind: t.isTournament ? "TORNEIO" : "BILHETE",
        title: t.event?.title ?? "Evento",
        slug: t.event?.slug ?? "",
        badge: t.badge,
        nextAction: t.nextAction,
        paymentStatusLabel: t.paymentStatusLabel,
        liveLink: t.liveLink ?? (t.event?.slug ? `/torneios/${t.event.slug}/live` : null),
      })) ?? [];
    const inscricaoItems =
      inscricoes?.map((i) => ({
        id: `insc-${i.id}`,
        kind: "TORNEIO",
        title: i.event?.title ?? "Torneio",
        slug: i.event?.slug ?? "",
        badge: i.badge,
        nextAction: i.nextAction,
        paymentStatusLabel: i.paymentStatusLabel,
        ctaUrl: i.ctaUrl,
        liveLink: i.liveLink,
      })) ?? [];
    const combined = [...ticketItems, ...inscricaoItems];
    return combined.filter((item) => {
      if (filter === "ALL") return true;
      if (filter === "TICKETS") return item.kind === "BILHETE";
      if (filter === "TOURNAMENTS") return item.kind === "TORNEIO";
      if (filter === "FREE") return item.badge === "FREE";
      if (filter === "RESALE") return item.badge === "RESALE";
      return true;
    });
  }, [tickets, inscricoes, filter]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Carteira</h1>
        <p className="text-sm text-gray-500">Bilhetes e inscrições num só sítio.</p>
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "ALL", label: "Tudo" },
            { key: "TICKETS", label: "Bilhetes" },
            { key: "TOURNAMENTS", label: "Torneios" },
            { key: "FREE", label: "Gratuitos" },
            { key: "RESALE", label: "Revenda" },
          ] satisfies { key: FilterKey; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-sm border ${
                filter === f.key ? "bg-black text-white" : "bg-white text-black"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="text-sm text-gray-500">A carregar...</p>}

      <ul className="space-y-3">
        {list.map((item) => (
          <li key={item.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex gap-2 items-center">
                <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{item.kind}</span>
                <span className="text-xs rounded-full bg-blue-100 px-2 py-0.5">{item.badge}</span>
                {item.paymentStatusLabel && (
                  <span className="text-xs text-gray-500">{item.paymentStatusLabel}</span>
                )}
              </div>
              <div className="text-sm font-medium">{item.title}</div>
            </div>
            <div className="flex gap-2">
              {item.nextAction === "CONFIRM_GUARANTEE" && (
                <a
                  href={item.ctaUrl ?? "#"}
                  className="bg-black text-white px-3 py-1 rounded text-sm"
                >
                  Confirmar garantia
                </a>
              )}
              {item.nextAction === "PAY_PARTNER" && (
                <a href={item.ctaUrl ?? "#"} className="border px-3 py-1 rounded text-sm">
                  Pagar a minha parte
                </a>
              )}
              {item.nextAction === "VIEW_LIVE" && (
                <a href={item.liveLink ?? `/torneios/${item.slug}/live`} className="underline text-sm">
                  Ver ao vivo
                </a>
              )}
              {!item.nextAction && item.liveLink && (
                <a href={item.liveLink} className="underline text-sm">
                  Ver ao vivo
                </a>
              )}
            </div>
          </li>
        ))}
        {!loading && list.length === 0 && <p className="text-sm text-gray-500">Nada para mostrar ainda.</p>}
      </ul>
    </main>
  );
}
