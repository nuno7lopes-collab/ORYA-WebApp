"use client";

import useSWR from "swr";
import Link from "next/link";
import { formatEuro, centsToEuro } from "@/lib/money";
import { useUser } from "@/app/hooks/useUser";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Badge = "FREE" | "RESALE" | "SPLIT" | "FULL" | "SINGLE";
type NextAction = "NONE" | "PAY_PARTNER" | "CONFIRM_GUARANTEE";

type Purchase = {
  id: number;
  paymentIntentId: string | null;
  purchaseId?: string | null;
  badge?: Badge;
  nextAction?: NextAction;
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
  const feeMode =
    typeof purchase.feeMode === "string" ? purchase.feeMode.toUpperCase() : null;
  const payorPaysFee = feeMode === "ADDED";
  const badgeLabel =
    purchase.badge === "FREE"
      ? "Gratuito"
      : purchase.badge === "RESALE"
        ? "Revenda"
        : purchase.badge === "SPLIT"
          ? "Split"
          : purchase.badge === "FULL"
            ? "Full"
            : "Compra";
  const nextActionLabel =
    purchase.nextAction === "PAY_PARTNER"
      ? "A tua parte está paga, falta o parceiro."
      : purchase.nextAction === "CONFIRM_GUARANTEE"
        ? "Ação necessária: confirmar a garantia."
        : null;

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5/50 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-white">{eventTitle}</p>
          {dateStr && <p className="text-[12px] text-white/60">{dateStr}</p>}
          <p className="text-[12px] text-white/50">
            Compra #{purchase.id} {purchase.purchaseId ? `· ${purchase.purchaseId}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-2 py-[2px] text-[11px] text-white/80">
              {badgeLabel}
            </span>
            {nextActionLabel && (
              <span className="rounded-full bg-yellow-300/15 px-2 py-[2px] text-[11px] text-yellow-100">
                {nextActionLabel}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-white/80">
          <p className="text-lg font-semibold text-white">{formatEuro(centsToEuro(purchase.totalCents) ?? 0)}</p>
          <p className="text-[11px] text-white/60">{new Date(purchase.createdAt).toLocaleDateString("pt-PT")}</p>
        </div>
      </div>
      {nextActionLabel && (
        <div className="mt-2 rounded-xl border border-yellow-300/20 bg-yellow-400/10 px-3 py-2 text-[12px] text-yellow-100">
          {nextActionLabel}
        </div>
      )}
      <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-black/30 p-3 text-[13px] text-white/80">
        {purchase.lines.map((line) => (
          <div key={`${purchase.id}-${line.ticketTypeId}-${line.quantity}`} className="flex items-center justify-between text-[13px] text-white/70">
            <span>Bilhete #{line.ticketTypeId} × {line.quantity}</span>
            <span>{formatEuro(centsToEuro(line.grossCents) ?? 0)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/60">
        {purchase.discountCents > 0 && <span>Desconto: -{formatEuro(centsToEuro(purchase.discountCents) ?? 0)}</span>}
        {payorPaysFee && purchase.platformFeeCents > 0 && (
          <span>Taxas: {formatEuro(centsToEuro(purchase.platformFeeCents) ?? 0)}</span>
        )}
      </div>
      {purchase.event?.slug && (
        <Link href={`/eventos/${purchase.event.slug}`} className="mt-3 inline-flex text-[12px] text-[#6BFFFF] hover:underline">
          Ver evento
        </Link>
      )}
    </div>
  );
}

export default function PurchasesClient() {
  const { user, profile } = useUser();
  const { data, isLoading } = useSWR<PurchasesResponse>("/api/me/purchases", fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,rgba(131,58,180,0.18),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(45,156,219,0.18),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(99,102,241,0.14),transparent_35%)] text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-14 pt-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-black/50 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Área pessoal</p>
              <h1 className="text-3xl font-semibold">As minhas compras</h1>
              <p className="text-sm text-white/65">Recibos e históricos dos teus bilhetes, num só lugar.</p>
            </div>
            {user && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/75">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] text-sm font-semibold">
                  {(profile?.username ?? user.email ?? "U")[0]?.toUpperCase()}
                </div>
                <div className="leading-tight">
                  <p className="font-semibold text-white">{profile?.fullName || profile?.username || user.email}</p>
                  <p className="text-[11px] text-white/60">Conta ORYA</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-white/70">A carregar compras…</div>
        )}

        {!isLoading && (!data || data.ok === false) && (
          <div className="rounded-3xl border border-red-400/30 bg-red-900/20 p-6 text-sm text-red-100">
            <p className="text-lg font-semibold text-white">Não foi possível carregar as compras.</p>
            <p className="text-white/80">Tenta novamente mais tarde.</p>
          </div>
        )}

        {!isLoading && data && data.ok && data.items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/40 p-8 text-center text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <div className="h-12 w-12 rounded-full border border-white/15 bg-white/5 text-xl flex items-center justify-center">🧾</div>
            <div>
              <p className="text-lg font-semibold text-white">Ainda não tens compras.</p>
              <p className="text-sm text-white/65">Quando comprares bilhetes, aparecem aqui com recibo.</p>
            </div>
            <Link
              href="/explorar"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.02]"
            >
              Explorar eventos
            </Link>
          </div>
        )}

        {!isLoading && data && data.ok && data.items.length > 0 && (
          <div className="space-y-3">
            {data.items.map((p) => (
              <PurchaseCard key={p.id} purchase={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
