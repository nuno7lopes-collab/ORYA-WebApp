import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import DashboardClient from "../DashboardClient";
import { OrganizerTour } from "../OrganizerTour";
import { cookies } from "next/headers";
import { AuthModalProvider } from "@/app/components/autenticação/AuthModalContext";

export const runtime = "nodejs";

/**
 * Router inteligente do /organizador.
 * Decide o destino com base no estado do utilizador e organizações.
 * Quando há organização ativa, renderiza o dashboard (overview como tab default no client).
 */
export default async function OrganizerRouterPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizador");
  }

  // 1) Contar memberships
  const membershipCount = await prisma.organizerMember.count({ where: { userId: user.id } });

  // Sem organizações → onboarding
  if (membershipCount === 0) {
    redirect("/organizador/become");
  }

  // 2) Existe organização ativa?
  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get("orya_org")?.value;
  const forcedOrgId = cookieOrgId ? Number(cookieOrgId) : undefined;
  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined,
  });
  const activeOrganizerId = organizer?.id ?? null;

  // Tem orgs mas nenhuma ativa → hub
  if (!activeOrganizerId) {
    redirect("/organizador/organizations");
  }

  // Tem org ativa → dashboard
  return (
    <AuthModalProvider>
      <DashboardClient hasOrganizer />
      <OrganizerTour organizerId={activeOrganizerId} />
    </AuthModalProvider>
  );
}
