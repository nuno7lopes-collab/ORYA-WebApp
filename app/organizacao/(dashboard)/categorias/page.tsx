"use client";

import useSWR from "swr";
import Link from "next/link";
import { useMemo } from "react";
import { useUser } from "@/app/hooks/useUser";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type EventsResponse = {
  ok: boolean;
  items: {
    id: number;
    title: string;
    startsAt: string | null;
    status: string;
    templateType: string | null;
    categories?: string[] | null;
  }[];
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CATEGORY_CARDS = [
  {
    key: "padel",
    title: "Torneios de Padel",
    desc: "Quadros, equipas, rankings. UI dedicada a padel.",
    template: "PADEL",
    preset: "padel",
  },
  {
    key: "default",
    title: "Evento padrão",
    desc: "Fluxo base para qualquer evento simples.",
    template: "OTHER",
    preset: "default",
  },
];

export default function OrganizationCategoriesPage() {
  const { user, isLoading: userLoading } = useUser();
  const { data } = useSWR<EventsResponse>(
    user ? "/api/organizacao/events/list" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const events = data?.items ?? [];

  const cards = useMemo(() => {
    return CATEGORY_CARDS.map((cat) => {
      const filtered = events.filter((ev) => {
        const matchTemplate = ev.templateType === cat.template;
        const matchCategory = (ev.categories ?? []).includes(cat.template);
        return matchTemplate || matchCategory;
      });
      const future = filtered.filter((ev) => {
        const start = ev.startsAt ? new Date(ev.startsAt) : null;
        return start && start.getTime() > Date.now();
      });
      const active = filtered.filter((ev) => ev.status === "PUBLISHED");
      return { ...cat, filtered, future, active };
    });
  }, [events]);

  if (userLoading || !user) {
    return (
      <div className="w-full px-4 py-8 md:px-6 lg:px-8 text-white">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {userLoading ? "A carregar…" : "Precisas de iniciar sessão para veres as categorias."}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8 space-y-6 md:px-6 lg:px-8 text-white">
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Categorias</p>
        <h1 className="text-3xl font-semibold">Escolhe o modo de trabalho</h1>
        <p className="text-sm text-white/65">
          Atalhos para criar eventos com a categoria certa e filtrar a tua lista. Em breve cada categoria terá UI própria.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((cat) => (
          <div
            key={cat.key}
            className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/65 to-[#050810]/90 p-4 space-y-3 shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{cat.title}</h3>
                <p className="text-[12px] text-white/65">{cat.desc}</p>
              </div>
              <div className="flex flex-col text-[11px] text-white/60 items-end">
                <span>Ativos: {cat.active.length}</span>
                <span>Futuros: {cat.future.length}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
              {cat.filtered.slice(0, 3).map((ev) => (
                <span key={ev.id} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                  {ev.title}
                </span>
              ))}
              {cat.filtered.length === 0 && <span className="text-white/50">Sem eventos nesta categoria.</span>}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/organizacao?tab=manage&section=eventos&cat=${cat.template}`}
                className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10 text-center"
              >
                Ver eventos
              </Link>
              <Link
                href={`/organizacao/eventos/novo?preset=${cat.preset}`}
                className={`${CTA_PRIMARY} flex-1 justify-center px-3 py-1.5 text-[12px]`}
              >
                Criar {cat.preset === "restaurante" ? "jantar" : cat.preset === "padel" ? "torneio" : "evento"}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
