"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function CheckInSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const basePath = `/org/${orgId}/check-in`;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "scanner",
          label: "Scanner",
          href: buildOrgHref(orgId, "/check-in/scanner"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === basePath ||
            normalizedPathname === `${basePath}/scanner` ||
            searchParams.get("mode") === "scanner",
        },
        {
          id: "list",
          label: "List",
          href: buildOrgHref(orgId, "/check-in/list"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === `${basePath}/list` || searchParams.get("mode") === "list",
        },
        {
          id: "sessions",
          label: "Sessions",
          href: buildOrgHref(orgId, "/check-in/sessions"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === `${basePath}/sessions` || searchParams.get("mode") === "sessions",
        },
        {
          id: "logs",
          label: "Logs",
          href: buildOrgHref(orgId, "/check-in/logs"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === `${basePath}/logs` || searchParams.get("mode") === "logs",
        },
        {
          id: "devices",
          label: "Devices",
          href: buildOrgHref(orgId, "/check-in/devices"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === `${basePath}/devices` || searchParams.get("mode") === "devices",
        },
      ]}
    />
  );
}
