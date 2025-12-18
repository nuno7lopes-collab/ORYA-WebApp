"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PurchaseItem = {
  id: number;
  purchaseId: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  badge: string;
  status: string;
  timeline: {
    id: number;
    status: string;
    createdAt: string;
    source: string;
    errorMessage?: string | null;
  }[];
  lines: { id: number; eventTitle: string; eventSlug: string; ticketTypeName: string }[];
};

const statusOptions: { value: string; label: string }[] = [
  { value: "PAID", label: "Pago" },
  { value: "PROCESSING", label: "A processar" },
  { value: "REFUNDED", label: "Reembolsado" },
  { value: "DISPUTED", label: "Em disputa" },
  { value: "FAILED", label: "Falhou" },
];

const statusBadge: Record<
  string,
  { bg: string; text: string; glow: string; label?: string }
> = {
  PAID: {
    bg: "from-emerald-500/20 via-emerald-400/18 to-teal-500/18 border-emerald-300/30",
    text: "text-emerald-50",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.25)]",
    label: "Pago",
  },
  PROCESSING: {
    bg: "from-amber-400/20 via-amber-300/16 to-yellow-400/18 border-amber-200/30",
    text: "text-amber-50",
    glow: "shadow-[0_0_24px_rgba(251,191,36,0.22)]",
    label: "A processar",
  },
  REFUNDED: {
    bg: "from-sky-400/20 via-sky-300/14 to-blue-400/18 border-sky-200/30",
    text: "text-sky-50",
    glow: "shadow-[0_0_24px_rgba(56,189,248,0.22)]",
    label: "Reembolsado",
  },
  DISPUTED: {
    bg: "from-fuchsia-500/20 via-violet-400/14 to-indigo-500/18 border-fuchsia-200/30",
    text: "text-fuchsia-50",
    glow: "shadow-[0_0_24px_rgba(217,70,239,0.24)]",
    label: "Em disputa",
  },
  FAILED: {
    bg: "from-rose-500/20 via-rose-400/14 to-orange-500/18 border-rose-200/30",
    text: "text-rose-50",
    glow: "shadow-[0_0_24px_rgba(244,63,94,0.22)]",
    label: "Falhou",
  },
};

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [includeFree, setIncludeFree] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (includeFree) params.set("includeFree", "true");
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/me/purchases?${params.toString()}`);
        const json = await res.json();
        if (json?.items) setItems(json.items);
      } catch (err) {
        console.warn("Erro a carregar compras", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [statusFilter, includeFree]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatMoney = (cents: number, currency: string) =>
    (cents / 100).toLocaleString("pt-PT", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });

  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_15%_20%,#8a1ecb20_0%,transparent_28%),radial-gradient(circle_at_85%_10%,#00eaff20_0%,transparent_25%),radial-gradient(circle_at_30%_70%,#ff00c820_0%,transparent_35%),linear-gradient(135deg,#050611_0%,#040812_60%,#05060d_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.04),transparent_55%)]" />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-10">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-[#111424]/35 to-white/5 px-5 py-6 shadow-[0_25px_60px_rgba(0,0,0,0.55)] backdrop-blur-3xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Área pessoal</p>
            <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
              Minhas Compras
            </h1>
            <p className="text-sm text-white/70">
              Consulta os teus bilhetes, pagamentos e reembolsos num painel com efeito glassy ORYA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/85 transition hover:border-white/30 hover:bg-white/10">
              <input
                type="checkbox"
                className="accent-[#6BFFFF]"
                checked={includeFree}
                onChange={(e) => setIncludeFree(e.target.checked)}
              />
              Incluir gratuitos
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Status</span>
              <div className="relative">
                <select
                  value={statusFilter ?? ""}
                  onChange={(e) => setStatusFilter(e.target.value || null)}
                  className="rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-sm text-white/90 shadow-inner shadow-black/30 outline-none transition hover:border-white/30 focus:border-[#6BFFFF] focus:ring-2 focus:ring-[#6BFFFF]/40"
                >
                  <option value="">Todos</option>
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-white/5 via-transparent to-white/5" />
              </div>
            </div>
          </div>
        </header>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/0 to-white/10 animate-pulse"
              />
            ))}
          </div>
        )}

        <ul className="space-y-4">
          {items.map((item) => {
            const statusStyle = statusBadge[item.status] ?? statusBadge.PROCESSING;
            const purchaseLabel = item.badge || "Compra";

            return (
              <li
                key={item.id}
                className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#0e1224] via-[#0a0f20]/80 to-[#0a0916] p-5 shadow-[0_25px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
                        {purchaseLabel}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle.text} ${statusStyle.glow} bg-gradient-to-r ${statusStyle.bg}`}
                      >
                        ● {statusStyle.label ?? item.status}
                      </span>
                      {item.purchaseId && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
                          ID {item.purchaseId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/70">
                      {formatDate(item.createdAt)} · {formatMoney(item.totalCents, item.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                    <span className="text-white/60">Total</span>
                    <span className="text-white font-semibold">{formatMoney(item.totalCents, item.currency)}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[2fr,1fr]">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Bilhetes</p>
                    <div className="space-y-2">
                      {item.lines.map((l) => (
                        <div
                          key={l.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85"
                        >
                          <p className="font-semibold text-white">{l.eventTitle}</p>
                          <p className="text-xs text-white/65">{l.ticketTypeName}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-3 text-xs text-white/80">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-white/60">Linha temporal</p>
                    <div className="flex flex-wrap gap-2">
                      {item.timeline.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/80"
                          title={t.errorMessage || undefined}
                        >
                          {t.status} • {t.source} • {formatDate(t.createdAt)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}

          {!loading && !items.length && (
            <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-[#150a23]/70 via-[#0b1224]/60 to-[#05060f]/80 px-6 py-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <p className="text-lg font-semibold text-white">Sem compras (ainda).</p>
              <p className="mt-2 text-sm text-white/70">
                Quando comprares um bilhete ORYA, ele vai aparecer aqui com o mesmo efeito glassy da plataforma.
              </p>
              <Link
                href="/explorar"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_28px_rgba(107,255,255,0.55)] transition hover:brightness-110"
              >
                Explorar eventos
              </Link>
            </div>
          )}
        </ul>
      </div>
    </main>
  );
}
