"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function MarketingSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Overview", href: buildOrgHref(orgId, "/marketing", { marketing: "overview" }) },
        { id: "promos", label: "Promos", href: buildOrgHref(orgId, "/marketing", { marketing: "promos" }) },
        { id: "promoters", label: "Promoters", href: buildOrgHref(orgId, "/marketing", { marketing: "promoters" }) },
        { id: "content", label: "Content", href: buildOrgHref(orgId, "/marketing", { marketing: "content" }) },
      ]}
    />
  );
}
