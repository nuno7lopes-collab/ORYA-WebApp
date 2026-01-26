import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationStatus } from "@prisma/client";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import {
  getOrganizationActiveModules,
  hasAllActiveModules,
  hasAnyActiveModule,
} from "@/lib/organizationModules";
import type { OrganizationModule } from "@/lib/organizationCategories";

type ModuleGuardLayoutProps = {
  children: ReactNode;
  requiredModules: OrganizationModule[];
  mode?: "any" | "all";
  redirectTo?: string;
};

export default async function ModuleGuardLayout({
  children,
  requiredModules,
  mode = "any",
  redirectTo = "/organizacao?tab=overview&section=modulos",
}: ModuleGuardLayoutProps) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    allowFallback: true,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect("/organizacao/organizations");
  }

  if (!requiredModules.length) {
    return <>{children}</>;
  }

  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    (organization as { primaryModule?: string | null }).primaryModule ?? null,
  );

  const hasAccess =
    mode === "all"
      ? hasAllActiveModules(activeModules, requiredModules)
      : hasAnyActiveModule(activeModules, requiredModules);

  if (!hasAccess) {
    redirect(redirectTo);
  }

  return <>{children}</>;
}
