"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function MarketingSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveMarketingTab = (searchParams: URLSearchParams) => {
    const value = searchParams.get("marketing");
    if (!value) return "overview";
    if (value === "promos" || value === "content") return value;
    return "overview";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "overview",
          label: "Resumo",
          href: buildOrgHref(orgId, "/marketing", { marketing: "overview" }),
          isActive: ({ searchParams }) => resolveMarketingTab(searchParams) === "overview",
        },
        {
          id: "promos",
          label: "Promoções",
          href: buildOrgHref(orgId, "/marketing", { marketing: "promos" }),
          isActive: ({ searchParams }) => resolveMarketingTab(searchParams) === "promos",
        },
        {
          id: "content",
          label: "Conteúdo",
          href: buildOrgHref(orgId, "/marketing", { marketing: "content" }),
          isActive: ({ searchParams }) => resolveMarketingTab(searchParams) === "content",
        },
      ]}
    />
  );
}
