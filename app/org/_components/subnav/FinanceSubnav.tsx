"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function FinanceSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveSection = (searchParams: URLSearchParams) => {
    const tab = searchParams.get("tab");
    const section = searchParams.get("section");
    if (section === "overview" || section === "financas" || section === "invoices" || section === "ops") {
      return section;
    }
    if (tab === "overview") return "overview";
    if (tab === "invoices") return "invoices";
    if (tab === "ops") return "ops";
    return "financas";
  };

  const resolveFinanceFocus = (searchParams: URLSearchParams) => {
    const focus = searchParams.get("finance");
    if (!focus) return "overview";
    if (focus === "payouts") return "payouts";
    if (focus === "refunds" || focus === "refunds-disputes") return "refunds";
    return "overview";
  };

  return (
    <ToolSubnavShell
      className={className}
      items={[
        {
          id: "overview",
          label: "Resumo",
          href: buildOrgHref(orgId, "/finance", { tab: "analyze", section: "overview" }),
          isActive: ({ searchParams }) => resolveSection(searchParams) === "overview",
        },
        {
          id: "revenue",
          label: "Receita",
          href: buildOrgHref(orgId, "/finance", { tab: "analyze", section: "financas" }),
          isActive: ({ searchParams }) => {
            const section = resolveSection(searchParams);
            const focus = resolveFinanceFocus(searchParams);
            return section === "financas" && focus === "overview";
          },
        },
        {
          id: "payouts",
          label: "Transferências",
          href: buildOrgHref(orgId, "/finance", { tab: "analyze", section: "financas", finance: "payouts" }),
          isActive: ({ searchParams }) => resolveSection(searchParams) === "financas" && resolveFinanceFocus(searchParams) === "payouts",
        },
        {
          id: "refunds",
          label: "Reembolsos",
          href: buildOrgHref(orgId, "/finance", { tab: "analyze", section: "financas", finance: "refunds" }),
          isActive: ({ searchParams }) => resolveSection(searchParams) === "financas" && resolveFinanceFocus(searchParams) === "refunds",
        },
        {
          id: "invoices",
          label: "Faturação",
          href: buildOrgHref(orgId, "/finance", { tab: "analyze", section: "invoices" }),
          isActive: ({ searchParams }) => resolveSection(searchParams) === "invoices",
        },
        {
          id: "ops",
          label: "Operações",
          href: buildOrgHref(orgId, "/finance", { tab: "analyze", section: "ops" }),
          isActive: ({ searchParams }) => resolveSection(searchParams) === "ops",
        },
      ]}
    />
  );
}
