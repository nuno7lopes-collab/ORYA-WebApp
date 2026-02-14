import DashboardClient from "@/app/org/_internal/core/DashboardClient";

export default function OrgMarketingPage() {
  return <DashboardClient hasOrganization defaultObjective="promote" defaultSection="marketing" />;
}
