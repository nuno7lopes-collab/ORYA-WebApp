"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function PadelClubSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "clubs", label: "Clubs", href: buildOrgHref(orgId, "/padel/clubs") },
        { id: "courts", label: "Courts", href: buildOrgHref(orgId, "/padel/clubs/courts") },
        { id: "players", label: "Players", href: buildOrgHref(orgId, "/padel/clubs/players") },
        { id: "community", label: "Community", href: buildOrgHref(orgId, "/padel/clubs/community") },
        { id: "trainers", label: "Trainers", href: buildOrgHref(orgId, "/padel/clubs/trainers") },
        { id: "lessons", label: "Lessons", href: buildOrgHref(orgId, "/padel/clubs/lessons") },
      ]}
    />
  );
}
