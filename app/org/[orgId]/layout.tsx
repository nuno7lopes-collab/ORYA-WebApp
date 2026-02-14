import type { ReactNode } from "react";
import OrganizationAuthLayout from "@/app/org/_internal/core/layout";
import OrganizationDashboardLayout from "@/app/org/_internal/core/(dashboard)/layout";

export default async function OrgScopedLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizationAuthLayout>
      <OrganizationDashboardLayout>{children}</OrganizationDashboardLayout>
    </OrganizationAuthLayout>
  );
}
