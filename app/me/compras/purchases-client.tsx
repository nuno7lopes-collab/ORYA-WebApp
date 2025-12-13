"use client";

import useSWR from "swr";
import Link from "next/link";
import { formatMoney } from "@/lib/money";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Purchase = {
  id: number;
  paymentIntentId: string;
  event: { id: number; title: string; slug: string; startsAt?: string | null; endsAt?: string | null } | null;
  subtotalCents: number;
  discountCents: number;
  platformFeeCents: number;
  totalCents: number;
  netCents: number;
  feeMode?: string | null;
  createdAt: string;
  lines: { ticketTypeId: number; quantity: number; unitPriceCents: number; discountPerUnitCents: number; grossCents: number }[];
};

type PurchasesResponse = { ok: true; items: Purchase[] } | { ok: false; error?: string };

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const eventTitle = purchase.event?.title ?? "Evento";
  const startsAt = purchase.event?.startsAt ? new Date(purchase.event.startsAt) : null;
  const dateStr = startsAt ? startsAt.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">{eventTitle}</p>
          {dateStr && <p className="text-[12px] text-white/60">{dateStr}</p>}
        </div>
        <div className="text-right text-sm text-white/80">
          <p className="text-lg font-semibold text-white">{formatMoney(purchase.totalCents, "EUR")}</p>
          <p className="text-[11px] text-white/60">{new Date(purchase.createdAt).toLocaleDateString("pt-PT")}</p>
        </div>
      </div>
      <div className="space-y-1 text-sm text-white/80">
        {purchase.lines.map((line) => (
          <div key={`${purchase.id}-${line.ticketTypeId}-${line.quantity}`} className="flex items-center justify-between text-[13px] text-white/70">
            <span>Bilhete #{line.ticketTypeId} x{line.quantity}</span>
            <span>{formatMoney(line.grossCents, "EUR")}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[12px] text-white/60">
        {purchase.discountCents > 0 && <span>Desconto: -{formatMoney(purchase.discountCents, "EUR")}</span>}
        {purchase.platformFeeCents > 0 && <span>Taxas: {formatMoney(purchase.platformFeeCents, "EUR")}</span>}
      </div>
      {purchase.event?.slug && (
        <Link href={`/eventos/${purchase.event.slug}`} className="text-[12px] text-[#6BFFFF] hover:underline">
          Ver evento
        </Link>
      )}
    </div>
  );
}

export default function PurchasesClient() {
  const { data, isLoading } = useSWR<PurchasesResponse>("/api/me/purchases", fetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) {
    return <div className="p-6 text-white/70">A carregar compras…</div>;
  }

  if (!data || data.ok === false) {
    return (
      <div className="p-6 text-white/80 space-y-2">
        <p className="text-lg font-semibold">Não foi possível carregar as compras.</p>
        <p className="text-sm text-white/60">Tenta mais tarde.</p>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="p-6 text-white/80 space-y-3">
        <p className="text-lg font-semibold">Ainda não tens compras.</p>
        <p className="text-sm text-white/60">Quando comprares bilhetes, eles aparecem aqui.</p>
        <Link href="/explorar" className="inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.02]">
          Explorar eventos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-4 text-white">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Área pessoal</p>
        <h1 className="text-3xl font-semibold">As minhas compras</h1>
        <p className="text-sm text-white/65">Resumo das tuas compras, com ligações rápidas aos eventos.</p>
      </div>
      <div className="space-y-3">
        {data.items.map((p) => (
          <PurchaseCard key={p.id} purchase={p} />
        ))}
      </div>
    </div>
  );
}
