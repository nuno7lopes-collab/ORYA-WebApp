import type { Prisma } from "@prisma/client";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";

type OrganizationContext = {
  id: number;
  primaryModule?: string | null;
};

export async function ensureReservasModuleAccess(
  organization: OrganizationContext,
  client?: Prisma.TransactionClient,
) {
  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    organization.primaryModule ?? null,
    client,
  );

  if (!hasAnyActiveModule(activeModules, ["RESERVAS"])) {
    return { ok: false as const, error: "Reservas indisponíveis para esta organização." };
  }

  return { ok: true as const };
}
