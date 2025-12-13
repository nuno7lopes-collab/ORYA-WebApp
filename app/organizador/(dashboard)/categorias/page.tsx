"use client";

import useSWR from "swr";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useUser } from "@/app/hooks/useUser";

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
    desc: "Criar torneios, ligar clubes e roster automático.",
    template: "PADEL",
    preset: "padel",
    ctaPrimary: "Criar torneio",
    ctaSecondary: "Ver torneios",
    areaLink: "/organizador?tab=padel",
    disabled: false,
  },
  {
    key: "restaurantes",
    title: "Restaurantes & Jantares",
    desc: "Menus fixos, reservas por slot, grupos.",
    template: "COMIDA",
    preset: "restaurante",
    disabled: true,
  },
  {
    key: "solidario",
    title: "Solidário / Voluntariado",
    desc: "Angariação de fundos e inscrições de voluntários.",
    template: "VOLUNTEERING",
    preset: "solidario",
    disabled: true,
  },
  {
    key: "festas",
    title: "Festas & Noite",
    desc: "Guest lists, packs e consumo mínimo.",
    template: "PARTY",
    preset: "party",
    disabled: true,
  },
];

export default function OrganizerCategoriesPage() {
  const { user, isLoading: userLoading } = useUser();
  const [selectedKey, setSelectedKey] = useState<string>("padel");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR<EventsResponse>(
    user ? "/api/organizador/events/list" : null,
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

  const selected = useMemo(() => {
    return cards.find((c) => c.key === selectedKey) || cards[0];
  }, [cards, selectedKey]);
  const isPadel = selected?.key === "padel";

  if (userLoading || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-4 md:px-6 lg:px-8 text-white">
        {userLoading ? "A carregar…" : "Precisas de iniciar sessão para veres as categorias."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6 md:px-6 lg:px-8 text-white">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Categorias</p>
        <h1 className="text-3xl font-semibold">Categorias</h1>
        <p className="text-sm text-white/65">Escolhe a categoria num dropdown e avança para o fluxo certo. Só Padel está disponível; restantes em breve.</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <button
              type="button"
              onClick={() => setOpen((p) => !p)}
              className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none hover:border-white/30"
            >
              <span>{selected?.title || "Escolher categoria"}</span>
              <span className="text-[11px] text-white/60">{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div className="absolute z-10 mt-2 w-full rounded-xl border border-white/15 bg-black/80 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
                {cards.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setSelectedKey(cat.key);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      cat.key === selectedKey ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span>{cat.title}</span>
                    <span className="text-[11px] text-white/60">{cat.disabled ? "Em breve" : "Disponível"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-right text-[12px] text-white/65 space-y-1">
            <p>Ativos: {selected?.active.length ?? 0}</p>
            <p>Futuros: {selected?.future.length ?? 0}</p>
          </div>
        </div>

        {selected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">{selected.title}</h3>
                <p className="text-[13px] text-white/65">{selected.desc}</p>
                {selected.disabled && <p className="text-[12px] text-amber-200">Em breve — mantém-te atento.</p>}
              </div>
              {selected.key === "padel" && (
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/75">Disponível</span>
              )}
              {selected.disabled && (
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/60">Em breve</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
              {selected.filtered.slice(0, 4).map((ev) => (
                <span key={ev.id} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                  {ev.title}
                </span>
              ))}
              {selected.filtered.length === 0 && <span className="text-white/50">Sem eventos nesta categoria.</span>}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!isPadel}
                onClick={() => {
                  if (!isPadel) return;
                  window.location.href = `/organizador/eventos/novo?preset=${selected.preset}`;
                }}
                className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-center ${
                  isPadel
                    ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black shadow hover:brightness-110"
                    : "border border-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                {selected.key === "padel" ? "Criar torneio" : "Em breve"}
              </button>
              <button
                type="button"
                disabled={!isPadel}
                onClick={() => {
                  if (!isPadel) return;
                  window.location.href = `/organizador?tab=events&type=${selected.template}`;
                }}
                className={`flex-1 rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-center ${
                  isPadel ? "text-white/80 hover:bg-white/10" : "text-white/40 cursor-not-allowed"
                }`}
              >
                {isPadel ? "Ver eventos" : "Em breve"}
              </button>
              <button
                type="button"
                disabled={!isPadel || !selected.areaLink}
                onClick={() => {
                  if (!isPadel || !selected.areaLink) return;
                  window.location.href = selected.areaLink;
                }}
                className={`flex-1 rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-center ${
                  isPadel ? "text-white/80 hover:bg-white/10" : "text-white/40 cursor-not-allowed"
                }`}
              >
                {isPadel ? "Área Padel" : "Em breve"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
