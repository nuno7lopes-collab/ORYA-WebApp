"use client";

import Link from "next/link";

export default function OrganizadorPadelPlaceholder() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 space-y-6 text-white md:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Torneios · Padel</p>
        <h1 className="text-3xl font-bold leading-tight">Em breve: gestão de torneios de padel</h1>
        <p className="text-sm text-white/70">
          Estamos a preparar inscrições, equipas, calendário e resultados em tempo real dentro do dashboard.
        </p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 space-y-3">
        <p>O que vem aí:</p>
        <ul className="list-disc list-inside space-y-1 text-white/75">
          <li>Gestão de categorias, equipas e inscrições.</li>
          <li>Geração automática de grupos e eliminatórias.</li>
          <li>Calendário de jogos e inserção de resultados.</li>
          <li>Vista pública de ranking e calendário.</li>
        </ul>
      </div>
      <div className="flex gap-3">
        <Link
          href="/organizador"
          className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow"
        >
          Voltar ao dashboard
        </Link>
        <Link
          href="/organizador/eventos/novo"
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          Criar evento
        </Link>
      </div>
    </div>
  );
}
