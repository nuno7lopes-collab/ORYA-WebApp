"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function FinanceSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Overview", href: buildOrgHref(orgId, "/finance", { tab: "overview", finance: "overview" }) },
        { id: "ledger", label: "Ledger", href: buildOrgHref(orgId, "/finance", { tab: "financas", finance: "ledger" }) },
        { id: "dimensions", label: "Dimensions", href: buildOrgHref(orgId, "/finance", { tab: "financas", finance: "dimensions" }) },
        { id: "payouts", label: "Payouts", href: buildOrgHref(orgId, "/finance", { tab: "financas", finance: "payouts" }) },
        { id: "refunds_disputes", label: "Refunds & disputes", href: buildOrgHref(orgId, "/finance", { tab: "ops", finance: "refunds-disputes" }) },
        { id: "subscriptions", label: "Subscriptions", href: buildOrgHref(orgId, "/finance", { tab: "invoices", finance: "subscriptions" }) },
      ]}
    />
  );
}
