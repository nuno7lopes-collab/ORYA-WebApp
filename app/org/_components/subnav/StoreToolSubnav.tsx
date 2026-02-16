"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function StoreToolSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Visão geral", href: buildOrgHref(orgId, "/store?view=overview") },
        { id: "catalog", label: "Catálogo", href: buildOrgHref(orgId, "/store?view=catalog") },
        { id: "orders", label: "Encomendas", href: buildOrgHref(orgId, "/store?view=orders") },
        { id: "shipping", label: "Envios", href: buildOrgHref(orgId, "/store?view=shipping") },
        { id: "marketing", label: "Marketing", href: buildOrgHref(orgId, "/store?view=marketing") },
        { id: "settings", label: "Definições", href: buildOrgHref(orgId, "/store?view=settings") },
      ]}
    />
  );
}
