"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function StoreToolSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveStoreView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (!view) return "overview";
    if (view === "catalog" || view === "orders" || view === "shipping" || view === "marketing") {
      return view;
    }
    return "overview";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "overview",
          label: "Visão geral",
          href: buildOrgHref(orgId, "/store?view=overview"),
          isActive: ({ searchParams }) => resolveStoreView(searchParams) === "overview",
        },
        {
          id: "catalog",
          label: "Catálogo",
          href: buildOrgHref(orgId, "/store?view=catalog"),
          isActive: ({ searchParams }) => resolveStoreView(searchParams) === "catalog",
        },
        {
          id: "orders",
          label: "Encomendas",
          href: buildOrgHref(orgId, "/store?view=orders"),
          isActive: ({ searchParams }) => resolveStoreView(searchParams) === "orders",
        },
        {
          id: "shipping",
          label: "Envios",
          href: buildOrgHref(orgId, "/store?view=shipping"),
          isActive: ({ searchParams }) => resolveStoreView(searchParams) === "shipping",
        },
        {
          id: "marketing",
          label: "Marketing",
          href: buildOrgHref(orgId, "/store?view=marketing"),
          isActive: ({ searchParams }) => resolveStoreView(searchParams) === "marketing",
        },
      ]}
    />
  );
}
