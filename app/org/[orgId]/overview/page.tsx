import DashboardClient from "@/app/organizacao/DashboardClient";

export default function OrgOverviewPage() {
  return <DashboardClient hasOrganization defaultObjective="create" defaultSection="overview" />;
}
