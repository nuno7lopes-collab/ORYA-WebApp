import type { Prisma } from "@prisma/client";

export type PackageSelectionInput = {
  packageId: number;
};

export type ResolvedServicePackage = {
  packageId: number;
  label: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  recommended: boolean;
  sortOrder: number;
};

export type PackageResolutionResult =
  | { ok: true; package: ResolvedServicePackage | null }
  | { ok: false; error: string };

const clampPositiveInt = (value: unknown) => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

export function parsePackageId(value: unknown): number | null {
  return clampPositiveInt(value);
}

export async function resolveServicePackageSelection(params: {
  tx: Prisma.TransactionClient;
  serviceId: number;
  packageId: number | null;
  requireActive?: boolean;
}): Promise<PackageResolutionResult> {
  const { tx, serviceId, packageId, requireActive = true } = params;
  if (!packageId) {
    return { ok: true, package: null };
  }

  const pkg = await tx.servicePackage.findFirst({
    where: {
      id: packageId,
      serviceId,
      ...(requireActive ? { isActive: true } : {}),
    },
    select: {
      id: true,
      label: true,
      description: true,
      durationMinutes: true,
      priceCents: true,
      recommended: true,
      sortOrder: true,
    },
  });

  if (!pkg) {
    return { ok: false, error: "Pacote inválido para este serviço." };
  }

  return {
    ok: true,
    package: {
      packageId: pkg.id,
      label: pkg.label,
      description: pkg.description ?? null,
      durationMinutes: Math.max(0, pkg.durationMinutes ?? 0),
      priceCents: Math.max(0, pkg.priceCents ?? 0),
      recommended: Boolean(pkg.recommended),
      sortOrder: pkg.sortOrder ?? 0,
    },
  };
}

export function applyPackageBase(params: {
  baseDurationMinutes: number;
  basePriceCents: number;
  pkg: ResolvedServicePackage | null;
}) {
  if (!params.pkg) {
    return {
      durationMinutes: Math.max(0, params.baseDurationMinutes),
      priceCents: Math.max(0, params.basePriceCents),
    };
  }
  return {
    durationMinutes: Math.max(0, params.pkg.durationMinutes),
    priceCents: Math.max(0, params.pkg.priceCents),
  };
}
