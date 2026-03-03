"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PadelClubSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolvePadelTab = (searchParams: URLSearchParams) => {
    const value = searchParams.get("padel");
    if (!value) return "clubs";
    if (value === "partnerships" || value === "players" || value === "coaches" || value === "lessons") {
      return value;
    }
    return "clubs";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "clubs",
          label: "Clubes",
          href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "clubs" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "clubs",
        },
        {
          id: "partnerships",
          label: "Parcerias",
          href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "partnerships" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "partnerships",
        },
        {
          id: "players",
          label: "Jogadores",
          href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "players" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "players",
        },
        {
          id: "coaches",
          label: "Treinadores",
          href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "coaches" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "coaches",
        },
        {
          id: "lessons",
          label: "Aulas",
          href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "lessons" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "lessons",
        },
      ]}
    />
  );
}
