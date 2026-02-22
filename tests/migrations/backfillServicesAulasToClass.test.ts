import { describe, expect, it } from "vitest";
import { backfillServicesAulasToClass } from "@/lib/reservas/backfillServicesAulasToClass";

type ServiceRow = {
  id: number;
  kind: "GENERAL" | "CLASS";
  categoryTag: string | null;
  title: string;
  description: string | null;
  classSeriesCount: number;
  classSessionsCount: number;
};

type AvailabilityRow = {
  serviceId: number;
  startsAt: Date;
  durationMinutes: number;
};

function createFakePrisma(seed: { services: ServiceRow[]; availabilities: AvailabilityRow[] }) {
  const services = seed.services.map((row) => ({ ...row }));
  const availabilities = seed.availabilities.map((row) => ({ ...row }));

  return {
    service: {
      findMany: async (args: any) => {
        const afterId = args?.where?.id?.gt ?? null;
        const kind = args?.where?.kind;
        const take = args?.take ?? 200;
        return services
          .filter((row) => (kind ? row.kind === kind : true))
          .filter((row) => (afterId ? row.id > afterId : true))
          .sort((a, b) => a.id - b.id)
          .slice(0, take)
          .map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            categoryTag: row.categoryTag,
            _count: {
              classSeries: row.classSeriesCount,
              classSessions: row.classSessionsCount,
              availabilities: availabilities.filter((entry) => entry.serviceId === row.id).length,
            },
          }));
      },
      update: async (args: any) => {
        const row = services.find((item) => item.id === args.where.id);
        if (!row) throw new Error("SERVICE_NOT_FOUND");
        row.kind = args.data.kind;
        return { ...row };
      },
    },
    availability: {
      findMany: async (args: any) => {
        return availabilities
          .filter((entry) => entry.serviceId === args.where.serviceId)
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
          .slice(0, args.take ?? 300)
          .map((entry) => ({ startsAt: entry.startsAt, durationMinutes: entry.durationMinutes }));
      },
    },
    getState: () => ({
      services: services.map((row) => ({ ...row })),
      availabilities: availabilities.map((row) => ({ ...row })),
    }),
  };
}

describe("backfillServicesAulasToClass", () => {
  it("dry-run contabiliza conversões sem mutar estado", async () => {
    const prisma = createFakePrisma({
      services: [
        {
          id: 1,
          kind: "GENERAL",
          categoryTag: "AULAS",
          title: "Aula Técnica",
          description: null,
          classSeriesCount: 0,
          classSessionsCount: 0,
        },
      ],
      availabilities: [],
    });

    const summary = await backfillServicesAulasToClass(prisma as any, {
      dryRun: true,
      limit: 50,
    });

    const state = prisma.getState();
    expect(summary.converted).toBe(1);
    expect(state.services[0]?.kind).toBe("GENERAL");
  });

  it("apply converte serviço recorrente por padrão de availabilities e é idempotente", async () => {
    const prisma = createFakePrisma({
      services: [
        {
          id: 20,
          kind: "GENERAL",
          categoryTag: "AULAS",
          title: "Sessão nível 2",
          description: "grupo",
          classSeriesCount: 0,
          classSessionsCount: 0,
        },
      ],
      availabilities: [
        { serviceId: 20, startsAt: new Date("2026-03-02T18:00:00.000Z"), durationMinutes: 90 },
        { serviceId: 20, startsAt: new Date("2026-03-09T18:00:00.000Z"), durationMinutes: 90 },
        { serviceId: 20, startsAt: new Date("2026-03-16T18:00:00.000Z"), durationMinutes: 90 },
      ],
    });

    const first = await backfillServicesAulasToClass(prisma as any, {
      dryRun: false,
      limit: 50,
    });
    const second = await backfillServicesAulasToClass(prisma as any, {
      dryRun: false,
      limit: 50,
    });

    const state = prisma.getState();
    expect(first.converted).toBe(1);
    expect(first.recurringConverted).toBe(1);
    expect(second.scanned).toBe(0);
    expect(state.services[0]?.kind).toBe("CLASS");
  });

  it("mantém em revisão manual quando AULAS não é recorrente nem claramente aula", async () => {
    const prisma = createFakePrisma({
      services: [
        {
          id: 30,
          kind: "GENERAL",
          categoryTag: "AULAS",
          title: "Sessão Especial",
          description: "evento único privado",
          classSeriesCount: 0,
          classSessionsCount: 0,
        },
      ],
      availabilities: [{ serviceId: 30, startsAt: new Date("2026-03-01T10:00:00.000Z"), durationMinutes: 60 }],
    });

    const summary = await backfillServicesAulasToClass(prisma as any, {
      dryRun: false,
      limit: 50,
    });

    const state = prisma.getState();
    expect(summary.converted).toBe(0);
    expect(summary.manualReview).toBe(1);
    expect(state.services[0]?.kind).toBe("GENERAL");
  });
});
