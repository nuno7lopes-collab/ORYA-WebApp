import { describe, expect, it, vi } from "vitest";
import {
  applyOrganizationToolCommand,
  OrganizationBaseToolRequiredError,
  applyOrganizationModuleMutation,
  OrganizationModuleDeactivationBlockedError,
  previewOrganizationModuleMutation,
  type OrganizationModuleMutationPreview,
} from "@/lib/organizationModuleLifecycle";

describe("organization module lifecycle", () => {
  it("bloqueia desativacao de eventos quando existem eventos ativos", async () => {
    const client = {
      organizationModuleEntry: {
        findMany: vi.fn().mockResolvedValue([{ moduleKey: "EVENTOS" }, { moduleKey: "STAFF" }]),
      },
      event: {
        count: vi.fn().mockResolvedValue(2),
      },
    } as any;

    const preview = await previewOrganizationModuleMutation({
      organizationId: 42,
      nextModules: ["STAFF"],
      client,
    });

    expect(preview.disabledModules).toEqual(["EVENTOS"]);
    expect(preview.blockers).toHaveLength(1);
    expect(preview.blockers[0]).toMatchObject({
      moduleKey: "EVENTOS",
      reasonCode: "EVENTOS_ACTIVE_ITEMS",
      activeCount: 2,
    });
  });

  it("permite desativar mensagens quando nao existem conversas abertas", async () => {
    const client = {
      organizationModuleEntry: {
        findMany: vi.fn().mockResolvedValue([{ moduleKey: "MENSAGENS" }, { moduleKey: "STAFF" }]),
      },
      chatConversation: {
        count: vi.fn().mockResolvedValue(0),
      },
    } as any;

    const preview = await previewOrganizationModuleMutation({
      organizationId: 7,
      nextModules: ["STAFF"],
      client,
    });

    expect(preview.disabledModules).toEqual(["MENSAGENS"]);
    expect(preview.blockers).toEqual([]);
  });

  it("aplica mutacao e cria disponibilidade base quando Reservas e ativada", async () => {
    const tx = {
      organizationModuleEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      availabilitySchedule: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 99 }),
      },
      weeklyAvailabilityTemplate: {
        count: vi.fn().mockResolvedValue(0),
        createMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
    } as any;
    const client = {
      $transaction: vi.fn(async (fn: (innerTx: typeof tx) => Promise<void>) => fn(tx)),
    } as any;

    const preview: OrganizationModuleMutationPreview = {
      previousModules: ["EVENTOS", "STAFF"],
      nextModules: ["EVENTOS", "STAFF", "RESERVAS"],
      enabledModules: ["RESERVAS"],
      disabledModules: [],
      blockers: [],
    };

    await applyOrganizationModuleMutation({
      organizationId: 11,
      preview,
      client,
    });

    expect(tx.organizationModuleEntry.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 11 },
    });
    expect(tx.organizationModuleEntry.createMany).toHaveBeenCalled();
    expect(tx.availabilitySchedule.findFirst).toHaveBeenCalled();
    expect(tx.weeklyAvailabilityTemplate.createMany).toHaveBeenCalled();
  });

  it("nao cria disponibilidade quando Reservas nao foi ativada nesta mutacao", async () => {
    const tx = {
      organizationModuleEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      availabilitySchedule: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      weeklyAvailabilityTemplate: {
        count: vi.fn(),
        createMany: vi.fn(),
      },
    } as any;
    const client = {
      $transaction: vi.fn(async (fn: (innerTx: typeof tx) => Promise<void>) => fn(tx)),
    } as any;

    const preview: OrganizationModuleMutationPreview = {
      previousModules: ["EVENTOS", "STAFF", "MENSAGENS"],
      nextModules: ["EVENTOS", "STAFF"],
      enabledModules: [],
      disabledModules: ["MENSAGENS"],
      blockers: [],
    };

    await applyOrganizationModuleMutation({
      organizationId: 12,
      preview,
      client,
    });

    expect(tx.availabilitySchedule.findFirst).not.toHaveBeenCalled();
    expect(tx.weeklyAvailabilityTemplate.createMany).not.toHaveBeenCalled();
  });

  it("marca ferramenta base como bloqueada no preview", async () => {
    const client = {
      organizationModuleEntry: {
        findMany: vi.fn().mockResolvedValue([{ moduleKey: "RESERVAS" }, { moduleKey: "STAFF" }]),
      },
    } as any;

    const preview = await previewOrganizationModuleMutation({
      organizationId: 18,
      nextModules: ["STAFF"],
      client,
    });

    expect(preview.disabledModules).toEqual(["RESERVAS"]);
    expect(preview.blockers).toHaveLength(1);
    expect(preview.blockers[0]).toMatchObject({
      moduleKey: "RESERVAS",
      reasonCode: "TOOL_BASE_REQUIRED",
    });
  });

  it("falha em modo fail-closed quando preview contem bloqueios de desativacao", async () => {
    const client = {
      $transaction: vi.fn(),
    } as any;

    const preview: OrganizationModuleMutationPreview = {
      previousModules: ["EVENTOS", "STAFF"],
      nextModules: ["STAFF"],
      enabledModules: [],
      disabledModules: ["EVENTOS"],
      blockers: [
        {
          moduleKey: "EVENTOS",
          reasonCode: "EVENTOS_ACTIVE_ITEMS",
          activeCount: 1,
          message: "Nao podes desativar Eventos com operacoes ativas.",
        },
      ],
    };

    await expect(
      applyOrganizationModuleMutation({
        organizationId: 50,
        preview,
        client,
      }),
    ).rejects.toBeInstanceOf(OrganizationModuleDeactivationBlockedError);

    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("falha em modo fail-closed quando preview tenta desativar ferramenta base", async () => {
    const client = {
      $transaction: vi.fn(),
    } as any;

    const preview: OrganizationModuleMutationPreview = {
      previousModules: ["RESERVAS", "STAFF"],
      nextModules: ["STAFF"],
      enabledModules: [],
      disabledModules: ["RESERVAS"],
      blockers: [],
    };

    await expect(
      applyOrganizationModuleMutation({
        organizationId: 51,
        preview,
        client,
      }),
    ).rejects.toBeInstanceOf(OrganizationBaseToolRequiredError);

    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("bloqueia desativacao de ferramenta base", async () => {
    const client = {
      organizationModuleEntry: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    } as any;

    await expect(
      applyOrganizationToolCommand({
        organizationId: 91,
        toolKey: "RESERVAS",
        action: "disable",
        client,
      }),
    ).rejects.toBeInstanceOf(OrganizationBaseToolRequiredError);

    expect(client.organizationModuleEntry.findMany).not.toHaveBeenCalled();
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("ativa ferramenta por comando direto sem payload de lista", async () => {
    const tx = {
      organizationModuleEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn(),
      },
      availabilitySchedule: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 10 }),
      },
      weeklyAvailabilityTemplate: {
        count: vi.fn().mockResolvedValue(0),
        createMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      event: { count: vi.fn().mockResolvedValue(0) },
      booking: { count: vi.fn().mockResolvedValue(0) },
      bookingChangeRequest: { count: vi.fn().mockResolvedValue(0) },
      padelTournamentConfig: { count: vi.fn().mockResolvedValue(0) },
      padelClub: { count: vi.fn().mockResolvedValue(0) },
      organizationForm: { count: vi.fn().mockResolvedValue(0) },
      store: { count: vi.fn().mockResolvedValue(0) },
      storeOrder: { count: vi.fn().mockResolvedValue(0) },
      chatConversation: { count: vi.fn().mockResolvedValue(0) },
    } as any;
    const client = {
      organizationModuleEntry: {
        findMany: vi.fn().mockResolvedValue([{ moduleKey: "STAFF" }]),
      },
      $transaction: vi.fn(async (fn: (innerTx: typeof tx) => Promise<void>) => fn(tx)),
      event: tx.event,
      booking: tx.booking,
      bookingChangeRequest: tx.bookingChangeRequest,
      padelTournamentConfig: tx.padelTournamentConfig,
      padelClub: tx.padelClub,
      organizationForm: tx.organizationForm,
      store: tx.store,
      storeOrder: tx.storeOrder,
      chatConversation: tx.chatConversation,
    } as any;

    const result = await applyOrganizationToolCommand({
      organizationId: 77,
      toolKey: "EVENTOS",
      action: "enable",
      client,
    });

    expect(result.toolKey).toBe("EVENTOS");
    expect(result.enabled).toBe(true);
    expect(result.enabledModules).toEqual(["EVENTOS"]);
    expect(result.nextModules).toEqual(["STAFF", "EVENTOS"]);
    expect(client.$transaction).toHaveBeenCalled();
  });
});
