import "server-only";
import { AvailabilityScopeType, Prisma } from "@prisma/client";

export type EventResourceInput = {
  consumesResources?: unknown;
  resourceIds?: unknown;
  professionalIds?: unknown;
};

export type NormalizedEventResourceInput = {
  consumesResources: boolean | null;
  resourceIds: number[];
  professionalIds: number[];
};

export type EventResourceSelection = {
  resourceIds: number[];
  professionalIds: number[];
};

export type EventResourceValidationResult =
  | {
      ok: true;
      selection: EventResourceSelection;
      resources: Array<{ id: number; courtId: number | null }>;
      professionals: Array<{ id: number }>;
    }
  | {
      ok: false;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((entry) => parsePositiveInt(entry))
    .filter((entry): entry is number => entry != null);
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

export function normalizeEventResourceInput(input: EventResourceInput): NormalizedEventResourceInput {
  return {
    consumesResources: parseBoolean(input.consumesResources),
    resourceIds: normalizeIdList(input.resourceIds),
    professionalIds: normalizeIdList(input.professionalIds),
  };
}

export async function validateEventResourceSelection(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  selection: EventResourceSelection;
  requireNonEmpty: boolean;
}): Promise<EventResourceValidationResult> {
  const { tx, organizationId, selection, requireNonEmpty } = params;

  if (requireNonEmpty && selection.resourceIds.length === 0 && selection.professionalIds.length === 0) {
    return {
      ok: false,
      code: "EVENT_RESOURCES_REQUIRED",
      message: "Seleciona pelo menos um recurso ou profissional.",
    };
  }

  const [resources, professionals] = await Promise.all([
    selection.resourceIds.length > 0
      ? tx.reservationResource.findMany({
          where: {
            organizationId,
            id: { in: selection.resourceIds },
            isActive: true,
          },
          select: {
            id: true,
            courtId: true,
          },
        })
      : Promise.resolve([]),
    selection.professionalIds.length > 0
      ? tx.reservationProfessional.findMany({
          where: {
            organizationId,
            id: { in: selection.professionalIds },
            isActive: true,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const resourceIdsFound = new Set(resources.map((resource) => resource.id));
  const professionalIdsFound = new Set(professionals.map((professional) => professional.id));
  const missingResourceIds = selection.resourceIds.filter((id) => !resourceIdsFound.has(id));
  const missingProfessionalIds = selection.professionalIds.filter((id) => !professionalIdsFound.has(id));

  if (missingResourceIds.length > 0 || missingProfessionalIds.length > 0) {
    return {
      ok: false,
      code: "EVENT_RESOURCES_NOT_FOUND",
      message: "Alguns recursos/profissionais não pertencem à organização ou estão inativos.",
      details: {
        missingResourceIds,
        missingProfessionalIds,
      },
    };
  }

  return {
    ok: true,
    selection,
    resources,
    professionals,
  };
}

export async function persistEventResourceSelection(params: {
  tx: Prisma.TransactionClient;
  eventId: number;
  selection: EventResourceSelection;
}) {
  const { tx, eventId, selection } = params;

  await tx.eventResource.deleteMany({ where: { eventId } });

  const rows = [
    ...selection.professionalIds.map((scopeId) => ({
      eventId,
      scopeType: AvailabilityScopeType.PROFESSIONAL,
      scopeId,
    })),
    ...selection.resourceIds.map((scopeId) => ({
      eventId,
      scopeType: AvailabilityScopeType.RESOURCE,
      scopeId,
    })),
  ];

  if (rows.length > 0) {
    await tx.eventResource.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
}

export async function readEventResourceSelection(params: {
  tx: Prisma.TransactionClient;
  eventId: number;
}): Promise<EventResourceSelection> {
  const rows = await params.tx.eventResource.findMany({
    where: { eventId: params.eventId },
    select: {
      scopeType: true,
      scopeId: true,
    },
  });

  const resourceIds: number[] = [];
  const professionalIds: number[] = [];

  for (const row of rows) {
    if (row.scopeType === AvailabilityScopeType.RESOURCE) {
      resourceIds.push(row.scopeId);
      continue;
    }
    if (row.scopeType === AvailabilityScopeType.PROFESSIONAL) {
      professionalIds.push(row.scopeId);
    }
  }

  return {
    resourceIds: Array.from(new Set(resourceIds)).sort((a, b) => a - b),
    professionalIds: Array.from(new Set(professionalIds)).sort((a, b) => a - b),
  };
}
