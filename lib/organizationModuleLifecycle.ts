import {
  BookingStatus,
  OrganizationFormStatus,
  PadelTournamentLifecycleStatus,
  Prisma,
  StoreOrderStatus,
  StoreStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EVENT_OPERATIONAL_STATUSES } from "@/domain/events/lifecycle";
import {
  NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET,
  ORGANIZATION_MODULES,
  type OrganizationModule,
} from "@/lib/organizationCategories";
import { ensureDefaultOrganizationAvailabilityForReservas } from "@/lib/reservas/defaultOrganizationAvailability";

type PrismaReadClient = Prisma.TransactionClient | typeof prisma;

const ORGANIZATION_MODULE_SET = new Set<OrganizationModule>(ORGANIZATION_MODULES);

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_CONFIRMATION,
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.DISPUTED,
];
const ACTIVE_TOURNAMENT_LIFECYCLE_STATUSES = [
  PadelTournamentLifecycleStatus.DRAFT,
  PadelTournamentLifecycleStatus.PUBLISHED,
  PadelTournamentLifecycleStatus.LOCKED,
];
const ACTIVE_STORE_ORDER_STATUSES = [
  StoreOrderStatus.PENDING,
  StoreOrderStatus.PAID,
  StoreOrderStatus.FULFILLED,
  StoreOrderStatus.PARTIAL_REFUND,
];
const ACTIVE_FORM_STATUSES = [OrganizationFormStatus.DRAFT, OrganizationFormStatus.PUBLISHED];

export type OrganizationModuleDeactivationBlocker = {
  moduleKey: OrganizationModule;
  reasonCode: string;
  activeCount: number;
  message: string;
};

export type OrganizationModuleMutationPreview = {
  previousModules: OrganizationModule[];
  nextModules: OrganizationModule[];
  enabledModules: OrganizationModule[];
  disabledModules: OrganizationModule[];
  blockers: OrganizationModuleDeactivationBlocker[];
};

export class OrganizationModuleDeactivationBlockedError extends Error {
  readonly blockers: OrganizationModuleDeactivationBlocker[];

  constructor(blockers: OrganizationModuleDeactivationBlocker[]) {
    const firstMessage =
      blockers[0]?.message ??
      "Nao foi possivel desativar a ferramenta porque existem operacoes ativas.";
    super(firstMessage);
    this.name = "OrganizationModuleDeactivationBlockedError";
    this.blockers = blockers;
  }
}

export class OrganizationBaseToolRequiredError extends Error {
  readonly toolKey: OrganizationModule;

  constructor(toolKey: OrganizationModule) {
    super("Esta ferramenta e base da organizacao e nao pode ser desativada.");
    this.name = "OrganizationBaseToolRequiredError";
    this.toolKey = toolKey;
  }
}

function toUniqueNormalizedModules(modules: string[]): OrganizationModule[] {
  const normalized: OrganizationModule[] = [];
  const seen = new Set<OrganizationModule>();
  for (const raw of modules) {
    const candidate = raw.trim().toUpperCase();
    if (!candidate || !ORGANIZATION_MODULE_SET.has(candidate as OrganizationModule)) continue;
    const moduleKey = candidate as OrganizationModule;
    if (seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    normalized.push(moduleKey);
  }
  return normalized;
}

async function getEnabledModulesSnapshot(
  organizationId: number,
  client: PrismaReadClient,
): Promise<OrganizationModule[]> {
  const rows = await client.organizationModuleEntry.findMany({
    where: { organizationId, enabled: true },
    select: { moduleKey: true },
    orderBy: { moduleKey: "asc" },
  });
  return toUniqueNormalizedModules(
    rows.map((row) => String(row.moduleKey)),
  );
}

function parseOrganizationToolKey(input: string): OrganizationModule | null {
  const candidate = input.trim().toUpperCase();
  if (!candidate) return null;
  if (!ORGANIZATION_MODULE_SET.has(candidate as OrganizationModule)) return null;
  return candidate as OrganizationModule;
}

export function parseOrganizationToolKeyStrict(input: string): OrganizationModule | null {
  return parseOrganizationToolKey(input);
}

async function resolveEventosDeactivationBlocker(params: {
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  const activeEvents = await params.client.event.count({
    where: {
      organizationId: params.organizationId,
      isDeleted: false,
      NOT: { templateType: "PADEL" },
      status: { in: EVENT_OPERATIONAL_STATUSES },
    },
  });
  if (activeEvents <= 0) return null;
  return {
    moduleKey: "EVENTOS",
    reasonCode: "EVENTOS_ACTIVE_ITEMS",
    activeCount: activeEvents,
    message:
      "Nao podes desativar a ferramenta de Eventos enquanto existirem eventos ativos.",
  };
}

async function resolveReservasDeactivationBlocker(params: {
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  const [activeServices, activeBookings, pendingChangeRequests] = await Promise.all([
    params.client.service.count({
      where: {
        organizationId: params.organizationId,
        isActive: true,
      },
    }),
    params.client.booking.count({
      where: {
        organizationId: params.organizationId,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
    }),
    params.client.bookingChangeRequest.count({
      where: {
        organizationId: params.organizationId,
        status: "PENDING",
      },
    }),
  ]);

  const activeCount = activeServices + activeBookings + pendingChangeRequests;
  if (activeCount <= 0) return null;
  return {
    moduleKey: "RESERVAS",
    reasonCode: "RESERVAS_ACTIVE_ITEMS",
    activeCount,
    message:
      "Nao podes desativar a ferramenta de Reservas enquanto existirem servicos, reservas ou alteracoes pendentes.",
  };
}

async function resolveTorneiosDeactivationBlocker(params: {
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  const [activeTournaments, activeClubs] = await Promise.all([
    params.client.padelTournamentConfig.count({
      where: {
        organizationId: params.organizationId,
        lifecycleStatus: { in: ACTIVE_TOURNAMENT_LIFECYCLE_STATUSES },
      },
    }),
    params.client.padelClub.count({
      where: {
        organizationId: params.organizationId,
        isActive: true,
        deletedAt: null,
      },
    }),
  ]);

  const activeCount = activeTournaments + activeClubs;
  if (activeCount <= 0) return null;
  return {
    moduleKey: "TORNEIOS",
    reasonCode: "TORNEIOS_ACTIVE_ITEMS",
    activeCount,
    message:
      "Nao podes desativar a ferramenta de Padel enquanto existirem clubes ativos ou torneios em curso.",
  };
}

async function resolveInscricoesDeactivationBlocker(params: {
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  const activeForms = await params.client.organizationForm.count({
    where: {
      organizationId: params.organizationId,
      status: { in: ACTIVE_FORM_STATUSES },
    },
  });
  if (activeForms <= 0) return null;
  return {
    moduleKey: "INSCRICOES",
    reasonCode: "INSCRICOES_ACTIVE_ITEMS",
    activeCount: activeForms,
    message:
      "Nao podes desativar a ferramenta de Inscricoes enquanto existirem formularios ativos ou em preparacao.",
  };
}

async function resolveLojaDeactivationBlocker(params: {
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  const [activeStore, activeOrders] = await Promise.all([
    params.client.store.count({
      where: {
        ownerOrganizationId: params.organizationId,
        status: StoreStatus.ACTIVE,
      },
    }),
    params.client.storeOrder.count({
      where: {
        store: { ownerOrganizationId: params.organizationId },
        status: { in: ACTIVE_STORE_ORDER_STATUSES },
      },
    }),
  ]);

  const activeCount = activeStore + activeOrders;
  if (activeCount <= 0) return null;
  return {
    moduleKey: "LOJA",
    reasonCode: "LOJA_ACTIVE_ITEMS",
    activeCount,
    message:
      "Nao podes desativar a ferramenta de Loja enquanto existirem operacoes de loja ativas.",
  };
}

async function resolveMensagensDeactivationBlocker(params: {
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  const activeConversations = await params.client.chatConversation.count({
    where: {
      organizationId: params.organizationId,
      closeAt: null,
    },
  });
  if (activeConversations <= 0) return null;
  return {
    moduleKey: "MENSAGENS",
    reasonCode: "MENSAGENS_ACTIVE_ITEMS",
    activeCount: activeConversations,
    message:
      "Nao podes desativar a ferramenta de Mensagens enquanto existirem conversas internas abertas.",
  };
}

async function resolveModuleDeactivationBlocker(params: {
  moduleKey: OrganizationModule;
  organizationId: number;
  client: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker | null> {
  switch (params.moduleKey) {
    case "EVENTOS":
      return resolveEventosDeactivationBlocker(params);
    case "RESERVAS":
      return resolveReservasDeactivationBlocker(params);
    case "TORNEIOS":
      return resolveTorneiosDeactivationBlocker(params);
    case "INSCRICOES":
      return resolveInscricoesDeactivationBlocker(params);
    case "LOJA":
      return resolveLojaDeactivationBlocker(params);
    case "MENSAGENS":
      return resolveMensagensDeactivationBlocker(params);
    default:
      return null;
  }
}

export async function resolveOrganizationModuleDeactivationBlockers(params: {
  organizationId: number;
  removedModules: OrganizationModule[];
  client?: PrismaReadClient;
}): Promise<OrganizationModuleDeactivationBlocker[]> {
  const client = params.client ?? prisma;
  const blockers: OrganizationModuleDeactivationBlocker[] = [];
  for (const moduleKey of params.removedModules) {
    const blocker = await resolveModuleDeactivationBlocker({
      moduleKey,
      organizationId: params.organizationId,
      client,
    });
    if (blocker) blockers.push(blocker);
  }
  return blockers;
}

export async function previewOrganizationModuleMutation(params: {
  organizationId: number;
  nextModules: OrganizationModule[];
  client?: PrismaReadClient;
}): Promise<OrganizationModuleMutationPreview> {
  const client = params.client ?? prisma;
  const previousModules = await getEnabledModulesSnapshot(params.organizationId, client);
  const nextModules = toUniqueNormalizedModules(params.nextModules);

  const previousSet = new Set(previousModules);
  const nextSet = new Set(nextModules);

  const enabledModules = nextModules.filter((moduleKey) => !previousSet.has(moduleKey));
  const disabledModules = previousModules.filter((moduleKey) => !nextSet.has(moduleKey));
  const baseToolBlockers: OrganizationModuleDeactivationBlocker[] = disabledModules
    .filter((toolKey) => NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET.has(toolKey))
    .map((toolKey) => ({
      moduleKey: toolKey,
      reasonCode: "TOOL_BASE_REQUIRED",
      activeCount: 1,
      message: "Esta ferramenta e base da organizacao e nao pode ser desativada.",
    }));
  const toolsWithRuntimeChecks = disabledModules.filter(
    (toolKey) => !NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET.has(toolKey),
  );
  const runtimeBlockers = await resolveOrganizationModuleDeactivationBlockers({
    organizationId: params.organizationId,
    removedModules: toolsWithRuntimeChecks,
    client,
  });
  const blockers = [...baseToolBlockers, ...runtimeBlockers];

  return {
    previousModules,
    nextModules,
    enabledModules,
    disabledModules,
    blockers,
  };
}

export async function applyOrganizationModuleMutation(params: {
  organizationId: number;
  preview: OrganizationModuleMutationPreview;
  client?: typeof prisma;
}) {
  const client = params.client ?? prisma;
  const { organizationId, preview } = params;
  const baseToolDisabled = preview.disabledModules.find((toolKey) =>
    NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET.has(toolKey),
  );
  if (baseToolDisabled) {
    throw new OrganizationBaseToolRequiredError(baseToolDisabled);
  }
  if (preview.blockers.length > 0) {
    throw new OrganizationModuleDeactivationBlockedError(preview.blockers);
  }

  await client.$transaction(async (tx) => {
    await tx.organizationModuleEntry.deleteMany({
      where: { organizationId },
    });

    if (preview.nextModules.length > 0) {
      await tx.organizationModuleEntry.createMany({
        data: preview.nextModules.map((moduleKey) => ({
          organizationId,
          moduleKey,
          enabled: true,
        })),
      });
    }

    if (preview.enabledModules.includes("RESERVAS")) {
      await ensureDefaultOrganizationAvailabilityForReservas({
        tx,
        organizationId,
      });
    }
  });

  return {
    previousModules: preview.previousModules,
    nextModules: preview.nextModules,
    enabledModules: preview.enabledModules,
    disabledModules: preview.disabledModules,
  };
}

export async function applyOrganizationToolCommand(params: {
  organizationId: number;
  toolKey: string;
  action: "enable" | "disable";
  client?: typeof prisma;
}) {
  const client = params.client ?? prisma;
  const parsedToolKey = parseOrganizationToolKey(params.toolKey);
  if (!parsedToolKey) {
    throw new Error("INVALID_TOOL_KEY");
  }

  if (params.action === "disable" && NON_DEACTIVABLE_ORGANIZATION_TOOL_MODULE_SET.has(parsedToolKey)) {
    throw new OrganizationBaseToolRequiredError(parsedToolKey);
  }

  const currentTools = await getEnabledModulesSnapshot(params.organizationId, client);
  const currentSet = new Set(currentTools);
  const nextTools =
    params.action === "enable"
      ? currentSet.has(parsedToolKey)
        ? currentTools
        : [...currentTools, parsedToolKey]
      : currentTools.filter((toolKey) => toolKey !== parsedToolKey);

  const preview = await previewOrganizationModuleMutation({
    organizationId: params.organizationId,
    nextModules: nextTools,
    client,
  });
  const mutation = await applyOrganizationModuleMutation({
    organizationId: params.organizationId,
    preview,
    client,
  });

  return {
    toolKey: parsedToolKey,
    enabled: mutation.nextModules.includes(parsedToolKey),
    ...mutation,
  };
}
