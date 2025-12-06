import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import OrganizationsHubClient from "../../organizations/OrganizationsHubClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrgPayload = {
  organizerId: number;
  role: string;
  lastUsedAt: string | null;
  organizer: {
    id: number;
    username: string | null;
    displayName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    status: string | null;
  };
};

export default async function OrganizationsHubPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizador/organizations");
  }

  let orgs: OrgPayload[] = [];

  try {
    const memberships = await prisma.organizerMember.findMany({
      where: { userId: user.id },
      include: { organizer: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    orgs = memberships
      .filter((m) => m.organizer)
      .map((m) => ({
        organizerId: m.organizerId,
        role: m.role,
        lastUsedAt: m.lastUsedAt ? m.lastUsedAt.toISOString() : null,
        organizer: {
          id: m.organizer!.id,
          username: m.organizer!.username,
          displayName: m.organizer!.displayName,
          businessName: m.organizer!.businessName,
          city: m.organizer!.city,
          entityType: m.organizer!.entityType,
          status: m.organizer!.status,
        },
      }));
  } catch (err) {
    const msg =
      typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
    // Se a tabela ainda não existir em dev, deixa orgs = []
    if (!(msg.includes("does not exist") || msg.includes("organizer_members"))) {
      throw err;
    }
  }

  // Se não houver nenhuma organização, envia para o onboarding
  if (orgs.length === 0) {
    redirect("/organizador/become");
  }

  const { organizer: activeOrganizer } = await getActiveOrganizerForUser(user.id);
  const activeId = activeOrganizer?.id ?? null;

  return <OrganizationsHubClient initialOrgs={orgs} activeId={activeId} />;
}
