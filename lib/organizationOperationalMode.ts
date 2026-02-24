import {
  parseOrganizationTools,
  resolvePrimaryModule,
  type OperationModule,
  type OrganizationModule,
} from "@/lib/organizationCategories";

export type OrganizationOperationalMode = "EVENT_DRIVEN" | "SLOT_DRIVEN" | "HYBRID";

type OperationalModeInput = {
  primaryModule?: string | null;
  tools?: string[] | null;
};

function isOperationModule(moduleKey: OrganizationModule): moduleKey is OperationModule {
  return moduleKey === "EVENTOS" || moduleKey === "RESERVAS" || moduleKey === "TORNEIOS";
}

function normalizeOperationModules(input: OperationalModeInput): Set<OperationModule> {
  const parsedTools = parseOrganizationTools(input.tools ?? []) ?? [];
  const primary = resolvePrimaryModule(input.primaryModule ?? null, parsedTools);
  const operationModules = new Set<OperationModule>();

  for (const moduleKey of parsedTools) {
    if (isOperationModule(moduleKey)) {
      operationModules.add(moduleKey);
    }
  }

  operationModules.add(primary);
  return operationModules;
}

export function resolveOrganizationOperationalMode(input: OperationalModeInput): OrganizationOperationalMode {
  const operationModules = normalizeOperationModules(input);
  const hasReservas = operationModules.has("RESERVAS");
  const hasEventsDomain = operationModules.has("EVENTOS") || operationModules.has("TORNEIOS");

  if (hasReservas && hasEventsDomain) return "HYBRID";
  if (hasReservas) return "SLOT_DRIVEN";
  return "EVENT_DRIVEN";
}

export function modeSupportsAvailabilityTemplates(mode: OrganizationOperationalMode) {
  return mode !== "EVENT_DRIVEN";
}
