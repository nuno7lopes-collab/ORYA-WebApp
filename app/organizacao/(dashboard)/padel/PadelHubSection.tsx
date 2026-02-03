"use client";

import useSWR from "swr";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import PadelHubClient from "./PadelHubClient";

type PadelClub = {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  kind?: "OWN" | "PARTNER";
  sourceClubId?: number | null;
  locationSource?: "APPLE_MAPS" | "OSM" | "MANUAL" | null;
  locationProviderId?: string | null;
  locationFormattedAddress?: string | null;
  locationComponents?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  courtsCount: number;
  slug?: string | null;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string | Date;
};

type Player = {
  id: number;
  userId?: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  level: string | null;
  isActive: boolean;
  createdAt: string | Date;
  tournamentsCount?: number;
  profile?: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  crm?: {
    id: string;
    status: string;
    tags: string[];
    totalSpentCents: number;
    totalTournaments: number;
    lastActivityAt: string | Date | null;
    marketingOptIn: boolean;
  } | null;
};

type PadelHubResponse<T> = {
  ok: boolean;
  items?: T[];
};

type Props = {
  organizationId: number;
  organizationKind: string | null;
  toolMode: "CLUB" | "TOURNAMENTS";
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PadelHubSection({ organizationId, organizationKind, toolMode }: Props) {
  const clubsUrl = organizationId ? `/api/padel/clubs?includeInactive=1&organizationId=${organizationId}` : null;
  const playersUrl = organizationId ? `/api/padel/players?organizationId=${organizationId}` : null;

  const {
    data: clubsRes,
    isLoading: clubsLoading,
    error: clubsError,
    mutate: mutateClubs,
  } = useSWR<PadelHubResponse<PadelClub>>(clubsUrl, fetcher);

  const {
    data: playersRes,
    isLoading: playersLoading,
    error: playersError,
    mutate: mutatePlayers,
  } = useSWR<PadelHubResponse<Player>>(playersUrl, fetcher);

  const clubs = Array.isArray(clubsRes?.items) ? clubsRes.items : [];
  const players = Array.isArray(playersRes?.items) ? playersRes.items : [];
  const isLoading = clubsLoading || playersLoading;
  const hasError = Boolean(clubsError || playersError || clubsRes?.ok === false || playersRes?.ok === false);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/12 bg-white/5 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] animate-pulse space-y-3">
        <div className="h-4 w-44 rounded-full bg-white/10" />
        <div className="h-8 w-72 rounded-2xl bg-white/10" />
        <div className="h-40 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Não foi possível carregar o Hub Padel.</p>
          <p className="text-[12px] text-red-100/80">Tenta novamente ou recarrega a página.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            mutateClubs();
            mutatePlayers();
          }}
          className={CTA_SECONDARY}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <PadelHubClient
      organizationId={organizationId}
      organizationKind={organizationKind}
      toolMode={toolMode}
      initialClubs={clubs}
      initialPlayers={players}
    />
  );
}
