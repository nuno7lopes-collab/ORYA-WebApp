import DashboardClient from "@/app/org/_internal/core/DashboardClient";

export default function OrgOverviewPage() {
  return <DashboardClient hasOrganization defaultObjective="create" defaultSection="overview" />;
}
