import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import DashboardClient from "../DashboardClient";

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

  // 1) Contar memberships; se tabela não existir em dev, assume 0
  let membershipCount = 0;
  try {
    membershipCount = await prisma.organizerMember.count({ where: { userId: user.id } });
  } catch (err: unknown) {
    const msg =
      typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
    if (!(msg.includes("does not exist") || msg.includes("organizer_members"))) {
      throw err;
    }
  }

  // Sem organizações → onboarding
  if (membershipCount === 0) {
    redirect("/organizador/become");
  }

  // 2) Existe organização ativa?
  let activeOrganizerId: number | null = null;
  try {
    const { organizer } = await getActiveOrganizerForUser(user.id);
    activeOrganizerId = organizer?.id ?? null;
  } catch (err: unknown) {
    const msg =
      typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
    if (!(msg.includes("does not exist") || msg.includes("organizer_members"))) {
      throw err;
    }
  }

  // Tem orgs mas nenhuma ativa → hub
  if (!activeOrganizerId) {
    redirect("/organizador/organizations");
  }

  // Tem org ativa → dashboard
  return <DashboardClient />;
}
