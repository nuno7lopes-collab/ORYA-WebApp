"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PORTUGAL_CITIES } from "@/config/cities";

const pageClass = "min-h-screen w-full text-white";

const cardClass =
  "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
  };
  nextAvailability: string | null;
};

type Response = {
  ok: boolean;
  items: ServiceItem[];
  pagination: { nextCursor: number | null; hasMore: boolean };
  debug?: string;
  error?: string;
};

export default function ServicosPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (city.trim()) params.set("city", city.trim());
    return params;
  }, [search, city]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/servicos/list?${queryParams.toString()}`, {
          signal: controller.signal,
        });
        const rawText = await res.text().catch(() => "");
        let json: Response | null = null;
        if (rawText.trim()) {
          try {
            json = JSON.parse(rawText) as Response;
          } catch {
            json = null;
          }
        }
        if (!res.ok || !json || !json.ok) {
          const detail =
            json?.debug ||
            json?.error ||
            (rawText ? rawText.slice(0, 200) : null) ||
            `HTTP ${res.status}`;
          throw new Error(`Erro ao carregar serviços: ${detail}`);
        }
        if (!cancelled && json) {
          setItems(json.items);
          setNextCursor(json.pagination.nextCursor ?? null);
          setHasMore(Boolean(json.pagination.hasMore));
        }
      } catch (err) {
        if (!cancelled) setError("Não foi possível carregar serviços.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [queryParams]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(queryParams);
      params.set("cursor", String(nextCursor));
      const res = await fetch(`/api/servicos/list?${params.toString()}`);
      const json = (await res.json()) as Response;
      if (res.ok && json.ok) {
        setItems((prev) => [...prev, ...json.items]);
        setNextCursor(json.pagination.nextCursor ?? null);
        setHasMore(Boolean(json.pagination.hasMore));
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className={pageClass}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Reservas</p>
          <h1 className="text-3xl font-semibold text-white">Serviços para reservar</h1>
          <p className="text-sm text-white/65">Agenda cuidados, experiências e serviços locais.</p>
        </div>

        <section className={cardClass}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-xs text-white/70">Pesquisar</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex: manicure, corte, sala de reuniões"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/35"
              />
            </div>
            <div>
              <label className="text-xs text-white/70">Cidade</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none focus:border-white/35"
              >
                <option value="">Todas</option>
                {PORTUGAL_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-32 rounded-3xl border border-white/10 orya-skeleton-surface animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/70">
            Sem serviços disponíveis.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/servicos/${item.id}`}
              className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/5 via-[#0b1224]/75 to-[#050a13]/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] transition hover:border-white/25 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="text-[12px] text-white/65">
                    {item.durationMinutes} min · {(item.price / 100).toFixed(2)} {item.currency}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                  {item.organization.city || "Cidade"}
                </span>
              </div>
              {item.description && (
                <p className="mt-2 text-[12px] text-white/65 line-clamp-2">{item.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[12px] text-white/60">
                  {item.organization.publicName || item.organization.businessName || "Organização"}
                </div>
                <div className="text-[12px] text-white/70">
                  {item.nextAvailability
                    ? `Próximo horário: ${new Date(item.nextAvailability).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}`
                    : "Sem horários"}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            className="self-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            disabled={loadingMore}
          >
            {loadingMore ? "A carregar..." : "Carregar mais"}
          </button>
        )}
      </div>
    </main>
  );
}
