export const runtime = "nodejs";

import DashboardClient from "@/app/org/_internal/core/DashboardClient";

export default async function OrganizationPadelTournamentsPage() {
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="padel-tournaments" />;
}
