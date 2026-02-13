"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PadelTournamentsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "tournaments", label: "Tournaments", href: buildOrgHref(orgId, "/padel/tournaments") },
        { id: "create", label: "Create", href: buildOrgHref(orgId, "/padel/tournaments/create") },
        { id: "calendar", label: "Calendar", href: buildOrgHref(orgId, "/padel/tournaments/calendar") },
        { id: "categories", label: "Categories", href: buildOrgHref(orgId, "/padel/tournaments/categories") },
        { id: "teams", label: "Teams", href: buildOrgHref(orgId, "/padel/tournaments/teams") },
        { id: "players", label: "Players", href: buildOrgHref(orgId, "/padel/tournaments/players") },
      ]}
    />
  );
}
