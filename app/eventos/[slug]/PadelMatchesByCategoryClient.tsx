"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type LiveCalendarMatch = {
  id: number;
  status: string;
  categoryId?: number | null;
  categoryLabel?: string | null;
  startAt: string;
  pairingA: string;
  pairingB: string;
  scoreLabel: string;
};

type LiveCalendarDay = {
  date: string;
  courts: Array<{
    courtLabel: string;
    matches: LiveCalendarMatch[];
  }>;
};

type PublicLivePayload = {
  ok?: boolean;
  event?: {
    timezone?: string | null;
  } | null;
  calendar_days?: LiveCalendarDay[];
};

type CategoryMatchesBucket = {
  key: string;
  categoryId: number | null;
  categoryLabel: string;
  matches: Array<
    LiveCalendarMatch & {
      courtLabel: string;
      day: string;
    }
  >;
};

const UPCOMING_STATUSES = new Set([
  "PENDING",
  "IN_PROGRESS",
  "RESULT_SUBMITTED",
  "PENDING_CONFIRMATION",
]);

function formatMatchStatus(status: string) {
  if (status === "IN_PROGRESS") return "Em jogo";
  if (status === "RESULT_SUBMITTED") return "Resultado submetido";
  if (status === "PENDING_CONFIRMATION") return "Pendente confirmação";
  return "Agendado";
}

function formatMatchDateTime(value: string, timezone: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data por definir";
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export default function PadelMatchesByCategoryClient({ slug }: { slug: string }) {
  const { data, isLoading } = useSWR<PublicLivePayload>(
    `/api/padel/public/live?slug=${encodeURIComponent(slug)}`,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    },
  );

  const timezone = data?.event?.timezone?.trim() || "Europe/Lisbon";
  const categories = useMemo<CategoryMatchesBucket[]>(() => {
    const calendarDays = Array.isArray(data?.calendar_days) ? data.calendar_days : [];
    const flattened = calendarDays
      .flatMap((day) =>
        day.courts.flatMap((court) =>
          court.matches.map((match) => ({
            ...match,
            courtLabel: court.courtLabel,
            day: day.date,
          })),
        ),
      )
      .filter((match) => UPCOMING_STATUSES.has(match.status))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const grouped = new Map<string, CategoryMatchesBucket>();

    for (const match of flattened) {
      const label =
        typeof match.categoryLabel === "string" && match.categoryLabel.trim().length > 0
          ? match.categoryLabel.trim()
          : "Sem categoria";
      const categoryId = typeof match.categoryId === "number" ? match.categoryId : null;
      const key = categoryId !== null ? `category-${categoryId}` : `label-${label}`;
      const current = grouped.get(key) ?? {
        key,
        categoryId,
        categoryLabel: label,
        matches: [],
      };
      current.matches.push(match);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((entry) => ({ ...entry, matches: entry.matches.slice(0, 6) }))
      .sort((a, b) => {
        const aStart = a.matches[0]?.startAt ? new Date(a.matches[0].startAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bStart = b.matches[0]?.startAt ? new Date(b.matches[0].startAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aStart !== bStart) return aStart - bStart;
        if (a.categoryLabel !== b.categoryLabel) {
          return a.categoryLabel.localeCompare(b.categoryLabel, "pt-PT");
        }
        return a.key.localeCompare(b.key, "pt-PT");
      });
  }, [data?.calendar_days]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory(null);
      return;
    }
    const hasCurrent = selectedCategory ? categories.some((entry) => entry.key === selectedCategory) : false;
    if (hasCurrent) return;
    setSelectedCategory(categories[0].key);
  }, [categories, selectedCategory]);

  const selectedCategoryEntry = selectedCategory
    ? categories.find((entry) => entry.key === selectedCategory) ?? null
    : null;
  const selectedCategoryMatches = selectedCategoryEntry?.matches ?? [];

  return (
    <section className="rounded-3xl border border-white/10 bg-black/45 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Jogos</p>
          <h2 className="mt-2 text-2xl font-semibold">Próximos jogos por categoria</h2>
          <p className="mt-1 text-sm text-white/70">
            Atualização automática. Mostra o próximo bloco operacional de cada categoria.
          </p>
        </div>
        <Link
          href={`/eventos/${slug}/monitor`}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:border-white/35 hover:bg-white/10"
        >
          Abrir monitor ao vivo
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          A carregar quadro de jogos...
        </div>
      ) : !data?.ok ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          Quadro de jogos disponível quando a competição estiver pública.
        </div>
      ) : categories.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          Ainda não existem jogos agendados para publicação.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = selectedCategory === category.key;
              return (
                <button
                  key={`selector-${category.key}`}
                  type="button"
                  onClick={() => setSelectedCategory(category.key)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                    active
                      ? "border-[#6BFFFF]/70 bg-white/12 text-white shadow-[0_10px_30px_rgba(107,255,255,0.2)]"
                      : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30"
                  }`}
                >
                  {category.categoryLabel} ({category.matches.length})
                </button>
              );
            })}
          </div>
          <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="text-sm font-semibold text-white">{selectedCategoryEntry?.categoryLabel ?? "Categoria"}</h3>
            <div className="mt-3 space-y-2">
              {selectedCategoryMatches.map((match) => (
                <div key={`${selectedCategoryEntry?.key ?? "unknown"}-${match.id}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-medium text-white">
                    {match.pairingA} vs {match.pairingB}
                  </p>
                  <p className="mt-1 text-[12px] text-white/65">
                    {formatMatchDateTime(match.startAt, timezone)} · {match.courtLabel}
                  </p>
                  <p className="mt-1 text-[12px] text-white/75">
                    {formatMatchStatus(match.status)} · {match.scoreLabel}
                  </p>
                </div>
              ))}
              {selectedCategoryMatches.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/65">
                  Sem jogos agendados nesta categoria.
                </div>
              )}
              </div>
          </article>
        </div>
      )}
    </section>
  );
}
