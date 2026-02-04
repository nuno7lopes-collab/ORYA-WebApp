export const runtime = "nodejs";

import DashboardClient from "@/app/organizacao/DashboardClient";

export default async function OrganizationPadelTournamentsPage() {
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="padel-tournaments" />;
}
