import type { OrganizationMemberRole, Prisma } from "@prisma/client";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";

type OrganizationContext = {
  id: number;
  primaryModule?: string | null;
};

export async function ensureCrmModuleAccess(
  organization: OrganizationContext,
  client?: Prisma.TransactionClient,
  options?: {
    member?: { userId: string; role: OrganizationMemberRole | null };
    required?: "VIEW" | "EDIT";
  },
) {
  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    organization.primaryModule ?? null,
    client,
  );

  if (!hasAnyActiveModule(activeModules, ["CRM"])) {
    return { ok: false as const, error: "CRM indisponível para esta organização." };
  }

  if (options?.member) {
    const memberAccess = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: options.member.userId,
      role: options.member.role,
      moduleKey: "CRM",
      required: options.required ?? "VIEW",
      client,
    });
    if (!memberAccess.ok) {
      return { ok: false as const, error: memberAccess.error };
    }
  }

  return { ok: true as const };
}
