"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function StoreToolSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Overview", href: buildOrgHref(orgId, "/store?view=overview") },
        { id: "catalog", label: "Catalog", href: buildOrgHref(orgId, "/store?view=catalog") },
        { id: "orders", label: "Orders", href: buildOrgHref(orgId, "/store?view=orders") },
        { id: "shipping", label: "Shipping", href: buildOrgHref(orgId, "/store?view=shipping") },
        { id: "marketing", label: "Marketing", href: buildOrgHref(orgId, "/store?view=marketing") },
        { id: "settings", label: "Settings", href: buildOrgHref(orgId, "/store?view=settings") },
      ]}
    />
  );
}
