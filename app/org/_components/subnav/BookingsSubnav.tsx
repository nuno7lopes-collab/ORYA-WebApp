"use client";

import { buildOrgHref } from "@/lib/organizationIdUtils";
import ToolSubnavShell from "./ToolSubnavShell";

export default function BookingsSubnav({ orgId, className }: { orgId: number | null; className?: string }) {
  if (!orgId) return null;

  return (
    <ToolSubnavShell
      className={className}
      items={[
        { id: "overview", label: "Overview", href: buildOrgHref(orgId, "/bookings") },
        { id: "services", label: "Services", href: buildOrgHref(orgId, "/bookings/services") },
        { id: "availability", label: "Availability", href: buildOrgHref(orgId, "/bookings/availability") },
        { id: "prices", label: "Prices", href: buildOrgHref(orgId, "/bookings/prices") },
        { id: "customers", label: "Customers", href: buildOrgHref(orgId, "/bookings/customers") },
        { id: "professionals", label: "Professionals", href: buildOrgHref(orgId, "/bookings/professionals") },
        { id: "resources", label: "Resources", href: buildOrgHref(orgId, "/bookings/resources") },
        { id: "policies", label: "Policies", href: buildOrgHref(orgId, "/bookings/policies") },
        { id: "integrations", label: "Integrations", href: buildOrgHref(orgId, "/bookings/integrations") },
      ]}
    />
  );
}
