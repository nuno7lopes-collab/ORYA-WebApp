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
        { id: "courts", label: "Campos", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "courts" }) },
        { id: "players", label: "Jogadores", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "players" }) },
        { id: "partnerships", label: "Parcerias", href: buildOrgHref(orgId, "/padel/parcerias", { tab: "manage", section: "padel-club", padel: "partnerships" }) },
        { id: "community", label: "Comunidade", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "community" }) },
        { id: "trainers", label: "Treinadores", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "trainers" }) },
        { id: "lessons", label: "Aulas", href: buildOrgHref(orgId, "/padel/clubs", { tab: "manage", section: "padel-club", padel: "lessons" }) },
      ]}
    />
  );
}
