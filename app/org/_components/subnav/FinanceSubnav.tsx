"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function FinanceSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  const resolveView = (searchParams: URLSearchParams) => {
    const view = searchParams.get("view");
    if (
      view === "overview" ||
      view === "invoicing" ||
      view === "payouts" ||
      view === "refunds-disputes" ||
      view === "reconciliation" ||
      view === "ledger" ||
      view === "exports" ||
      view === "ops"
    ) {
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
          label: "Resumo",
          href: buildOrgHref(orgId, "/finance", { view: "overview" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "overview",
        },
        {
          id: "invoicing",
          label: "Faturação",
          href: buildOrgHref(orgId, "/finance", { view: "invoicing" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "invoicing",
        },
        {
          id: "payouts",
          label: "Transferências",
          href: buildOrgHref(orgId, "/finance", { view: "payouts" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "payouts",
        },
        {
          id: "refunds",
          label: "Reembolsos",
          href: buildOrgHref(orgId, "/finance", { view: "refunds-disputes" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "refunds-disputes",
        },
        {
          id: "reconciliation",
          label: "Reconciliação",
          href: buildOrgHref(orgId, "/finance", { view: "reconciliation" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "reconciliation",
        },
        {
          id: "ledger",
          label: "Ledger",
          href: buildOrgHref(orgId, "/finance", { view: "ledger" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "ledger",
        },
        {
          id: "exports",
          label: "Exports",
          href: buildOrgHref(orgId, "/finance", { view: "exports" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "exports",
        },
        {
          id: "ops",
          label: "Operações",
          href: buildOrgHref(orgId, "/finance", { view: "ops" }),
          isActive: ({ searchParams }) => resolveView(searchParams) === "ops",
        },
      ]}
    />
  );
}
