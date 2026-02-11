import type { Prisma } from "@prisma/client";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";

type OrganizationContext = {
  id: number;
  primaryModule?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
};

type ModuleAccessResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      errorCode: string;
      message?: string;
      requestId?: string;
      correlationId?: string;
      reasonCode?: string;
      email?: string | null;
      verifyUrl?: string;
      nextStepUrl?: string;
    };

export async function ensureReservasModuleAccess(
  organization: OrganizationContext,
  client?: Prisma.TransactionClient,
  options?: { requireVerifiedEmail?: boolean; reasonCode?: string },
): Promise<ModuleAccessResult> {
  if (options?.requireVerifiedEmail) {
    const emailGate = ensureOrganizationEmailVerified(organization, {
      reasonCode: options?.reasonCode ?? "RESERVAS",
    });
    if (!emailGate.ok) {
      return {
        ok: false,
        error: emailGate.errorCode,
        errorCode: emailGate.errorCode,
        message: emailGate.message,
        requestId: emailGate.requestId,
        correlationId: emailGate.correlationId,
        reasonCode: emailGate.reasonCode,
        email: emailGate.email,
        verifyUrl: emailGate.verifyUrl,
        nextStepUrl: emailGate.nextStepUrl,
      };
    }
  }
  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    organization.primaryModule ?? null,
    client,
  );

  if (!hasAnyActiveModule(activeModules, ["RESERVAS"])) {
    return {
      ok: false as const,
      error: "Reservas indisponíveis para esta organização.",
      errorCode: "RESERVAS_UNAVAILABLE",
      message: "Reservas indisponíveis para esta organização.",
    };
  }

  return { ok: true as const };
}
