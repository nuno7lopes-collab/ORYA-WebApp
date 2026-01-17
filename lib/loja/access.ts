import type { Prisma } from "@prisma/client";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";

type OrganizationContext = {
  id: number;
  primaryModule?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
};

export async function ensureLojaModuleAccess(
  organization: OrganizationContext,
  client?: Prisma.TransactionClient,
  options?: { requireVerifiedEmail?: boolean },
) {
  if (options?.requireVerifiedEmail) {
    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return { ok: false as const, error: emailGate.error };
    }
  }
  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    organization.primaryModule ?? null,
    client,
  );

  if (!hasAnyActiveModule(activeModules, ["LOJA"])) {
    return { ok: false as const, error: "Loja indisponível para esta organização." };
  }

  return { ok: true as const };
}
