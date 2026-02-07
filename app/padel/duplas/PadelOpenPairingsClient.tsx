"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { formatDateTime } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PairingItem = {
  id: number;
  paymentMode: string;
  deadlineAt: string | null;
  isExpired: boolean;
  openSlots: number;
  category: { id: number; label: string } | null;
  event: {
    id: number;
    slug: string;
    title: string;
    startsAt: string | null;
    locationFormattedAddress: string | null;
    addressId: string | null;
    coverImageUrl: string | null;
  };
};

type OpenPairingsResponse = {
  ok?: boolean;
  items?: PairingItem[];
  error?: string;
};

export default function PadelOpenPairingsClient() {
  const [query, setQuery] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("limit", "18");
    return params.toString();
  }, [query]);

  const { data, isLoading } = useSWR<OpenPairingsResponse>(
    `/api/padel/public/open-pairings?${queryString}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const items = Array.isArray(data?.items) ? data?.items : [];
  const errorLabel = data?.ok === false ? data?.error || "Erro ao carregar duplas." : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Filtros</p>
          <p className="text-xs text-white/70">Encontra parceiros por evento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisa"
            className="w-40 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[12px] text-white/80 placeholder:text-white/40"
          />
        </div>
      </div>

      {errorLabel ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-50">
          {errorLabel}
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
          A carregar duplas abertas...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
          Sem duplas abertas neste momento.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((pairing) => {
            const startAt = pairing.event.startsAt ? new Date(pairing.event.startsAt) : null;
            const location = pairing.event.locationFormattedAddress || null;

            return (
              <article
                key={pairing.id}
                className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/5 via-black/70 to-black/90 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Dupla aberta</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {pairing.event.title}
                    </h3>
                    <p className="text-[12px] text-white/60">
                      {pairing.category?.label || "Categoria aberta"} · {pairing.openSlots} vaga(s)
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${
                      pairing.isExpired
                        ? "border-amber-400/40 bg-amber-500/10 text-amber-50"
                        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
                    }`}
                  >
                    {pairing.isExpired ? "Expira" : "Aberta"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-[12px] text-white/70">
                  {startAt && <p>{formatDateTime(startAt, "pt-PT")}</p>}
                  {location && <p>{location}</p>}
                  {pairing.deadlineAt && (
                    <p className="text-white/60">
                      Deadline: {formatDateTime(new Date(pairing.deadlineAt), "pt-PT")}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/eventos/${pairing.event.slug}`}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
                  >
                    Ver torneio
                  </Link>
                  <Link
                    href={`/eventos/${pairing.event.slug}#bilhetes`}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
                  >
                    Inscrever dupla
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
