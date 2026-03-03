import { describe, expect, it } from "vitest";
import { backfillCoachProfessionalLinks } from "@/lib/reservas/backfillCoachProfessionalLinks";

type TrainerRow = {
  id: number;
  organizationId: number;
  userId: string;
  reservationProfessionalId: number | null;
  user: { fullName: string | null; username: string | null } | null;
};

type ProfessionalRow = {
  id: number;
  organizationId: number;
  userId: string | null;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

function createFakePrisma(seed: { trainers: TrainerRow[]; professionals: ProfessionalRow[] }) {
  const trainers = seed.trainers.map((row) => ({ ...row }));
  const professionals = seed.professionals.map((row) => ({ ...row }));
  let nextProfessionalId = Math.max(0, ...professionals.map((row) => row.id)) + 1;

  return {
    trainerProfile: {
      findMany: async (args: any) => {
        const afterId = args?.where?.id?.gt ?? null;
        const take = args?.take ?? 200;
        return trainers
          .filter((row) => (afterId ? row.id > afterId : true))
          .sort((a, b) => a.id - b.id)
          .slice(0, take)
          .map((row) => ({ ...row, user: row.user ? { ...row.user } : null }));
      },
      update: async (args: any) => {
        const row = trainers.find((item) => item.id === args.where.id);
        if (!row) throw new Error("COACH_NOT_FOUND");
        row.reservationProfessionalId = args.data.reservationProfessionalId ?? null;
        return { ...row };
      },
    },
    reservationProfessional: {
      findMany: async (args: any) => {
        const where = args?.where ?? {};
        return professionals
          .filter(
            (row) =>
              row.organizationId === where.organizationId &&
              row.userId === where.userId,
          )
          .map((row) => ({ ...row }));
      },
      create: async (args: any) => {
        const created: ProfessionalRow = {
          id: nextProfessionalId++,
          organizationId: args.data.organizationId,
          userId: args.data.userId,
          name: args.data.name,
          roleTitle: args.data.roleTitle ?? null,
          isActive: args.data.isActive ?? true,
          priority: args.data.priority ?? 0,
          createdAt: new Date("2026-02-21T10:00:00.000Z"),
          updatedAt: new Date("2026-02-21T10:00:00.000Z"),
        };
        professionals.push(created);
        return { id: created.id };
      },
      update: async (args: any) => {
        const row = professionals.find((item) => item.id === args.where.id);
        if (!row) throw new Error("PROFESSIONAL_NOT_FOUND");
        row.isActive = args.data.isActive ?? row.isActive;
        row.updatedAt = new Date("2026-02-21T11:00:00.000Z");
        return { ...row };
      },
    },
    getState: () => ({
      trainers: trainers.map((row) => ({ ...row })),
      professionals: professionals.map((row) => ({ ...row })),
    }),
  };
}

describe("backfillCoachProfessionalLinks", () => {
  it("dry-run não cria nem altera ligações", async () => {
    const prisma = createFakePrisma({
      trainers: [
        {
          id: 1,
          organizationId: 9,
          userId: "u-1",
          reservationProfessionalId: null,
          user: { fullName: "Coach A", username: "coach-a" },
        },
      ],
      professionals: [],
    });

    const summary = await backfillCoachProfessionalLinks(prisma as any, {
      dryRun: true,
      limit: 50,
    });

    const state = prisma.getState();
    expect(summary.createdProfessionals).toBe(1);
    expect(summary.linkedCoachProfiles).toBe(1);
    expect(state.professionals).toHaveLength(0);
    expect(state.trainers[0]?.reservationProfessionalId ?? null).toBeNull();
  });

  it("apply cria profissional e liga treinador; segunda execução é idempotente", async () => {
    const prisma = createFakePrisma({
      trainers: [
        {
          id: 10,
          organizationId: 7,
          userId: "u-10",
          reservationProfessionalId: null,
          user: { fullName: "Coach B", username: "coach-b" },
        },
      ],
      professionals: [],
    });

    const first = await backfillCoachProfessionalLinks(prisma as any, {
      dryRun: false,
      limit: 50,
    });
    const second = await backfillCoachProfessionalLinks(prisma as any, {
      dryRun: false,
      limit: 50,
    });

    const state = prisma.getState();
    expect(first.createdProfessionals).toBe(1);
    expect(first.linkedCoachProfiles).toBe(1);
    expect(second.createdProfessionals).toBe(0);
    expect(second.linkedCoachProfiles).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(state.professionals).toHaveLength(1);
    expect(state.trainers[0]?.reservationProfessionalId).toBe(state.professionals[0]?.id);
  });

  it("reativa profissional inativo e mantém canonical id", async () => {
    const prisma = createFakePrisma({
      trainers: [
        {
          id: 20,
          organizationId: 4,
          userId: "u-20",
          reservationProfessionalId: null,
          user: { fullName: "Coach C", username: null },
        },
      ],
      professionals: [
        {
          id: 3,
          organizationId: 4,
          userId: "u-20",
          name: "Coach C",
          roleTitle: "Treinador",
          isActive: false,
          priority: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const summary = await backfillCoachProfessionalLinks(prisma as any, {
      dryRun: false,
      limit: 50,
    });

    const state = prisma.getState();
    expect(summary.reactivatedProfessionals).toBe(1);
    expect(summary.linkedCoachProfiles).toBe(1);
    expect(state.professionals[0]?.isActive).toBe(true);
    expect(state.trainers[0]?.reservationProfessionalId).toBe(3);
  });
});
