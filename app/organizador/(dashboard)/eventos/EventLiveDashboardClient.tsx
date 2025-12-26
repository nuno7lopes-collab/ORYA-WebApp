"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EventLivePrepClient from "@/app/organizador/(dashboard)/eventos/EventLivePrepClient";
import EventLiveClient from "@/app/eventos/[slug]/EventLiveClient";
import { TournamentLiveManager } from "@/app/organizador/(dashboard)/tournaments/[id]/live/page";

type LiveHubVisibility = "PUBLIC" | "PRIVATE" | "DISABLED";

type Props = {
  event: {
    id: number;
    slug: string;
    title: string;
    liveHubMode: "DEFAULT" | "PREMIUM";
    liveHubVisibility: LiveHubVisibility;
    liveStreamUrl: string | null;
    templateType?: string | null;
  };
  organizer: {
    id: number;
    username: string | null;
    liveHubPremiumEnabled: boolean;
  };
  tournamentId: number | null;
};

const TABS = [
  { id: "setup", label: "LiveHub" },
  { id: "bracket", label: "Bracket" },
  { id: "preview", label: "Preview" },
] as const;

export default function EventLiveDashboardClient({ event, organizer, tournamentId }: Props) {
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") || "setup";
  const tabs = TABS;

  const basePath = `/organizador/eventos/${event.id}/live`;
  const organizerHandle = organizer.username ? `@${organizer.username}` : null;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1226]/70 to-[#050912]/90 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Dashboard Live</p>
            <h1 className="text-2xl font-semibold text-white">{event.title}</h1>
            <p className="text-sm text-white/60">
              Modo automático{organizerHandle ? ` · ${organizerHandle}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/70">
            <Link
              href={`/eventos/${event.slug}/live`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-3 py-1 hover:border-white/40"
            >
              Ver Live público
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => {
            const params = new URLSearchParams(searchParams?.toString());
            params.set("tab", item.id);
            if (item.id === "preview") {
              params.set("edit", "1");
            } else {
              params.delete("edit");
            }
            const href = `${basePath}?${params.toString()}`;
            return (
              <Link
                key={item.id}
                href={href}
                className={`rounded-full border px-4 py-1 text-[11px] uppercase tracking-[0.2em] ${
                  tab === item.id
                    ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-100"
                    : "border-white/15 bg-white/5 text-white/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {tab === "setup" && (
        <EventLivePrepClient
          event={{
            id: event.id,
            slug: event.slug,
            title: event.title,
            liveHubMode: event.liveHubMode,
            liveHubVisibility: event.liveHubVisibility,
            liveStreamUrl: event.liveStreamUrl,
          }}
          tournamentId={tournamentId}
        />
      )}

      {tab === "bracket" && (
        <>
          {!tournamentId && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
              Ainda não existe um torneio associado. Cria o torneio no separador LiveHub para começar a preparar a bracket.
            </div>
          )}
          {tournamentId && <TournamentLiveManager tournamentId={tournamentId} />}
        </>
      )}

      {tab === "preview" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            Preview do LiveHub com overlay do organizador. Usa <span className="text-white">Editar</span> nos jogos
            para atualizar resultados.
          </div>
          <EventLiveClient slug={event.slug} />
        </div>
      )}

    </div>
  );
}
