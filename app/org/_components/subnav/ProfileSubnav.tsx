"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function ProfileSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const basePath = `/org/${orgId}/profile`;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "profile",
          label: "Profile",
          href: buildOrgHref(orgId, "/profile"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === basePath && (searchParams.get("profile") ?? "overview") === "overview",
        },
        {
          id: "followers",
          label: "Followers",
          href: buildOrgHref(orgId, "/profile/followers"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === `${basePath}/followers` || searchParams.get("profile") === "followers",
        },
        {
          id: "requests",
          label: "Requests",
          href: buildOrgHref(orgId, "/profile/requests"),
          isActive: ({ normalizedPathname, searchParams }) =>
            normalizedPathname === `${basePath}/requests` || searchParams.get("profile") === "requests",
        },
      ]}
    />
  );
}
