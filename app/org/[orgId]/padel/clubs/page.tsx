export const runtime = "nodejs";

import DashboardClient from "@/app/organizacao/DashboardClient";

export default async function OrgPadelClubPage() {
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="padel-club" />;
}
