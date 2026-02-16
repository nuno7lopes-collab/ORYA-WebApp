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
          isActive: ({ normalizedPathname, searchParams }) => {
            const mode = searchParams.get("mode");
            if (mode) return mode === "scanner";
            return normalizedPathname === basePath || normalizedPathname === `${basePath}/scanner`;
          },
        },
        {
          id: "list",
          label: "Lista",
          href: buildOrgHref(orgId, "/check-in/list"),
          isActive: ({ normalizedPathname, searchParams }) => {
            const mode = searchParams.get("mode");
            if (mode) return mode === "list";
            return normalizedPathname === `${basePath}/list`;
          },
        },
        {
          id: "sessions",
          label: "Sessões",
          href: buildOrgHref(orgId, "/check-in/sessions"),
          isActive: ({ normalizedPathname, searchParams }) => {
            const mode = searchParams.get("mode");
            if (mode) return mode === "sessions";
            return normalizedPathname === `${basePath}/sessions`;
          },
        },
        {
          id: "logs",
          label: "Registos",
          href: buildOrgHref(orgId, "/check-in/logs"),
          isActive: ({ normalizedPathname, searchParams }) => {
            const mode = searchParams.get("mode");
            if (mode) return mode === "logs";
            return normalizedPathname === `${basePath}/logs`;
          },
        },
        {
          id: "devices",
          label: "Dispositivos",
          href: buildOrgHref(orgId, "/check-in/devices"),
          isActive: ({ normalizedPathname, searchParams }) => {
            const mode = searchParams.get("mode");
            if (mode) return mode === "devices";
            return normalizedPathname === `${basePath}/devices`;
          },
        },
      ]}
    />
  );
}
