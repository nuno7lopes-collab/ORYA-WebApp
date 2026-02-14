import { redirect } from "next/navigation";
import DashboardClient from "../../DashboardClient";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";

export default async function OrganizationOverviewPage({
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
    redirect(`/org/overview?${params.toString()}`);
  }

  return <DashboardClient hasOrganization defaultObjective="create" defaultSection="overview" />;
}
