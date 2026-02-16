import DashboardClient from "../../DashboardClient";
import { ensureDashboardAccess } from "@/app/org/_internal/core/_lib/dashboardAccess";

export default async function OrganizationOverviewPage({
}: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureDashboardAccess();

  return <DashboardClient hasOrganization defaultObjective="create" defaultSection="overview" />;
}
