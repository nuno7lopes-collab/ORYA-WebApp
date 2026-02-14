import DashboardClient from "@/app/org/_internal/core/DashboardClient";

export default function OrgBookingsPage() {
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="reservas" />;
}
