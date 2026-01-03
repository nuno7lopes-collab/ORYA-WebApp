import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import DashboardClient from "../DashboardClient";
import { OrganizationTour } from "../OrganizationTour";
import { cookies } from "next/headers";
import { AuthModalProvider } from "@/app/components/autenticação/AuthModalContext";

export const runtime = "nodejs";

/**
 * Router inteligente do /organizacao.
 * Decide o destino com base no estado do utilizador e organizações.
 * Quando há organização ativa, renderiza o dashboard (overview como tab default no client).
 */
export default async function OrganizationRouterPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizacao");
  }

  // 1) Contar memberships
  const membershipCount = await prisma.organizationMember.count({ where: { userId: user.id } });

  // Sem organizações → onboarding
  if (membershipCount === 0) {
    redirect("/organizacao/become");
  }

  // 2) Existe organização ativa?
  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get("orya_organization")?.value;
  const forcedOrgId = cookieOrgId ? Number(cookieOrgId) : undefined;
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined,
    allowFallback: true,
  });
  const activeOrganizationId = organization?.id ?? null;

  // Tem orgs mas nenhuma ativa → hub
  if (!activeOrganizationId) {
    redirect("/organizacao/organizations");
  }

  // Tem org ativa → dashboard
  return (
    <AuthModalProvider>
      <DashboardClient hasOrganization />
      <OrganizationTour organizationId={activeOrganizationId} />
    </AuthModalProvider>
  );
}
