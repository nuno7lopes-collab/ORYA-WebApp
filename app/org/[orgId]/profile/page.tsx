import DashboardClient from "@/app/organizacao/DashboardClient";

export default function OrgProfilePage() {
  return <DashboardClient hasOrganization defaultObjective="profile" defaultSection="perfil" />;
}
