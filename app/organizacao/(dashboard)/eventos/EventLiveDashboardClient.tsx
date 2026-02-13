"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EventLivePrepClient from "@/app/organizacao/(dashboard)/eventos/EventLivePrepClient";
import EventLiveClient from "@/app/eventos/[slug]/EventLiveClient";
import { TournamentLiveManager } from "@/app/organizacao/(dashboard)/tournaments/[id]/live/page";

type LiveHubVisibility = "PUBLIC" | "PRIVATE" | "DISABLED";

type Props = {
  event: {
    id: number;
    slug: string;
    title: string;
    liveVisibility: LiveHubVisibility;
    liveStreamUrl: string | null;
    templateType?: string | null;
  };
  tournamentId: number | null;
  canManageLiveConfig: boolean;
};

const TABS = [
  { id: "setup", label: "LiveHub" },
  { id: "bracket", label: "Bracket" },
  { id: "preview", label: "Preview" },
] as const;

export default function EventLiveDashboardClient({ event, tournamentId, canManageLiveConfig }: Props) {
  const searchParams = useSearchParams();
  const tabs = TABS.filter((item) => (canManageLiveConfig ? true : item.id === "preview"));
  const requestedTab = searchParams?.get("tab") || (canManageLiveConfig ? "setup" : "preview");
  const tab = tabs.find((item) => item.id === requestedTab)?.id ?? tabs[0]?.id ?? "preview";

  const basePath =
    event.templateType === "PADEL"
      ? `/organizacao/padel/torneios/${event.id}/live`
      : `/organizacao/eventos/${event.id}/live`;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0b1226]/70 to-[#050912]/90 p-5 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Live</p>
            <h1 className="text-2xl font-semibold text-white">{event.title}</h1>
            <p className="text-sm text-white/60">LiveHub, bracket e preview.</p>
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
            liveVisibility: event.liveVisibility,
            liveStreamUrl: event.liveStreamUrl,
          }}
          tournamentId={tournamentId}
        />
      )}

      {tab === "bracket" && (
        <>
          {!tournamentId && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
              Sem torneio associado. Cria no separador LiveHub.
            </div>
          )}
          {tournamentId && <TournamentLiveManager tournamentId={tournamentId} />}
        </>
      )}

      {tab === "preview" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            Preview do LiveHub. Usa <span className="text-white">Editar</span> para resultados.
          </div>
          <EventLiveClient slug={event.slug} />
        </div>
      )}

    </div>
  );
}
