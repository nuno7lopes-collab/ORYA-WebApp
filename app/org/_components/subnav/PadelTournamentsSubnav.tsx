"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PadelTournamentsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "tournaments", label: "Torneios", href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "tournaments" }) },
        { id: "create", label: "Criar", href: buildOrgHref(orgId, "/padel/tournaments/create") },
        { id: "calendar", label: "Calendário", href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "calendar" }) },
        { id: "categories", label: "Categorias", href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "categories" }) },
        { id: "teams", label: "Equipas", href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "teams" }) },
        { id: "players", label: "Jogadores", href: buildOrgHref(orgId, "/padel/tournaments", { tab: "manage", section: "padel-tournaments", padel: "players" }) },
      ]}
    />
  );
}
