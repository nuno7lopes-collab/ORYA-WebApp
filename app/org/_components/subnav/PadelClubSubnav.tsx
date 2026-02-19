"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PadelClubSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "clubs", label: "Clubes", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "clubs" }) },
        { id: "partnerships", label: "Parcerias", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "partnerships" }) },
        { id: "players", label: "Jogadores", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "players" }) },
        { id: "trainers", label: "Treinadores", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "trainers" }) },
        { id: "lessons", label: "Aulas", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "lessons" }) },
      ]}
    />
  );
}
