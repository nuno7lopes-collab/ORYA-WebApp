import { redirect } from "next/navigation";
import DashboardClient from "../../DashboardClient";
import { ensureDashboardAccess } from "@/app/organizacao/_lib/dashboardAccess";

export default async function OrganizationPromotePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activeOrganizationId } = await ensureDashboardAccess();
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const params = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
      }
    }
  }
  if (!params.get("organizationId")) {
    params.set("organizationId", String(activeOrganizationId));
    redirect(`/organizacao/promote?${params.toString()}`);
  }

  const defaultSection =
    typeof resolvedSearchParams?.section === "string" ? resolvedSearchParams.section : "marketing";

  return <DashboardClient hasOrganization defaultObjective="promote" defaultSection={defaultSection} />;
}
