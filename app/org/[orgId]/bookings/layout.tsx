import type { ReactNode } from "react";
import ModuleGuardLayout from "@/app/org/_internal/core/(dashboard)/_components/ModuleGuardLayout";

export default async function OrgBookingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgId?: string }> | { orgId?: string };
}) {
  return (
    <ModuleGuardLayout requiredModules={["RESERVAS"]} redirectTo="/org/calendar" params={params}>
      {children}
    </ModuleGuardLayout>
  );
}

