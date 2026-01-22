import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { Prisma } from "@prisma/client";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const balances = await prisma.$queryRaw<
      Array<{ organization_id: number; program_id: string; balance: number }>
    >(Prisma.sql`
      SELECT
        organization_id,
        program_id,
        SUM(CASE WHEN entry_type IN ('SPEND', 'EXPIRE') THEN -points ELSE points END) AS balance
      FROM app_v3.loyalty_ledger
      WHERE user_id = ${user.id}
      GROUP BY organization_id, program_id
    `);

    const programIds = balances.map((row) => row.program_id);
    if (!programIds.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const programs = await prisma.loyaltyProgram.findMany({
      where: { id: { in: programIds } },
      select: {
        id: true,
        name: true,
        pointsName: true,
        status: true,
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
            username: true,
            primaryModule: true,
          },
        },
      },
    });

    const orgActiveMap = new Map<number, boolean>();
    await Promise.all(
      programs.map(async (program) => {
        const orgId = program.organization.id;
        if (orgActiveMap.has(orgId)) return;
        const { activeModules } = await getOrganizationActiveModules(
          orgId,
          program.organization.primaryModule ?? null,
        );
        orgActiveMap.set(orgId, hasAnyActiveModule(activeModules, ["CRM"]));
      }),
    );

    const rewards = await prisma.loyaltyReward.findMany({
      where: { programId: { in: programIds }, isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        programId: true,
        name: true,
        type: true,
        pointsCost: true,
        stock: true,
        isActive: true,
      },
    });

    const rewardsByProgram = new Map<string, typeof rewards>();
    for (const reward of rewards) {
      const list = rewardsByProgram.get(reward.programId) ?? [];
      list.push(reward);
      rewardsByProgram.set(reward.programId, list);
    }

    const balanceByProgram = new Map(programIds.map((id) => [id, 0]));
    for (const row of balances) {
      balanceByProgram.set(row.program_id, Number(row.balance ?? 0));
    }

    const items = programs
      .filter((program) => orgActiveMap.get(program.organization.id))
      .map((program) => {
        const balance = balanceByProgram.get(program.id) ?? 0;
        const programRewards = rewardsByProgram.get(program.id) ?? [];
        const isProgramActive = program.status === "ACTIVE";
        return {
          organization: program.organization,
          program: {
            id: program.id,
            name: program.name,
            pointsName: program.pointsName,
            status: program.status,
          },
          balance,
          rewards: programRewards.map((reward) => ({
            id: reward.id,
            name: reward.name,
            type: reward.type,
            pointsCost: reward.pointsCost,
            stock: reward.stock,
            isActive: reward.isActive,
            canRedeem:
              reward.isActive &&
              (reward.stock === null || reward.stock > 0) &&
              isProgramActive &&
              balance >= reward.pointsCost,
          })),
        };
      });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/me/loyalty/recompensas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar recompensas." }, { status: 500 });
  }
}
