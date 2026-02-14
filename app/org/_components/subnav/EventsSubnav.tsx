"use client";

import { usePathname } from "next/navigation";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { normalizeOrganizationPathname } from "@/app/org/_internal/core/topbarRouteUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function EventsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  const normalizedPathname = normalizeOrganizationPathname(usePathname());
  if (!orgId) return null;
  const liveMatch = normalizedPathname?.match(new RegExp(`^/org/${orgId}/events/([^/]+)/live$`));
  const eventId = liveMatch?.[1] ?? null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "list", label: "List", href: buildOrgHref(orgId, "/events") },
        { id: "new", label: "New", href: buildOrgHref(orgId, "/events/new") },
        {
          id: "live",
          label: "Live",
          href: eventId ? buildOrgHref(orgId, `/events/${eventId}/live`) : buildOrgHref(orgId, "/events"),
          hidden: !eventId,
        },
      ]}
    />
  );
}
