"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PadelTournamentsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolvePadelTab = (searchParams: URLSearchParams) => {
    const value = searchParams.get("padel");
    if (!value) return "tournaments";
    if (value === "calendar" || value === "categories" || value === "teams" || value === "players") {
      return value;
    }
    return "tournaments";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "tournaments",
          label: "Torneios",
          href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "tournaments" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "tournaments",
        },
        { id: "create", label: "Criar", href: buildOrgHref(orgId, "/padel/tournaments/create") },
        {
          id: "calendar",
          label: "Calendário",
          href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "calendar" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "calendar",
        },
        {
          id: "categories",
          label: "Categorias",
          href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "categories" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "categories",
        },
        {
          id: "teams",
          label: "Equipas",
          href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "teams" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "teams",
        },
        {
          id: "players",
          label: "Jogadores",
          href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "players" }),
          isActive: ({ searchParams }) => resolvePadelTab(searchParams) === "players",
        },
      ]}
    />
  );
}
