import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { LoyaltyEntryType, LoyaltySourceType, Prisma } from "@prisma/client";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { recordLoyaltyLedgerOutbox } from "@/domain/loyaltyOutbox";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(_req: NextRequest, context: { params: { rewardId: string } }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const rewardId = context.params.rewardId;
    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId },
      include: {
        program: {
          include: {
            organization: {
              select: { id: true, publicName: true, businessName: true, primaryModule: true },
            },
          },
        },
      },
    });

    if (!reward || !reward.isActive) {
      return jsonWrap({ ok: false, error: "Recompensa indisponível." }, { status: 404 });
    }

    if (reward.pointsCost <= 0) {
      return jsonWrap({ ok: false, error: "Recompensa inválida." }, { status: 400 });
    }

    if (reward.program.status !== "ACTIVE") {
      return jsonWrap({ ok: false, error: "Programa inativo." }, { status: 400 });
    }

    const { activeModules } = await getOrganizationActiveModules(
      reward.program.organizationId,
      reward.program.organization?.primaryModule ?? null,
    );
    if (!hasAnyActiveModule(activeModules, ["CRM"])) {
      return jsonWrap({ ok: false, error: "Programa indisponível." }, { status: 403 });
    }

    const lockKey = `${reward.programId}:${user.id}`;
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
      if (reward.stock !== null) {
        const updated = await tx.loyaltyReward.updateMany({
          where: { id: reward.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (updated.count === 0) {
          throw new Error("OUT_OF_STOCK");
        }
      }

      const balanceRow = await tx.$queryRaw<Array<{ balance: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(CASE WHEN entry_type IN ('SPEND', 'EXPIRE') THEN -points ELSE points END), 0) AS balance
        FROM app_v3.loyalty_ledger
        WHERE user_id = ${user.id} AND program_id = ${reward.programId}
      `);

      const balance = Number(balanceRow?.[0]?.balance ?? 0);
      if (balance < reward.pointsCost) {
        throw new Error("INSUFFICIENT_POINTS");
      }

      const balanceAfter = balance - reward.pointsCost;
      const entry = await tx.loyaltyLedger.create({
        data: {
          organizationId: reward.program.organizationId,
          programId: reward.programId,
          userId: user.id,
          entryType: LoyaltyEntryType.SPEND,
          points: reward.pointsCost,
          balanceAfter,
          sourceType: LoyaltySourceType.REWARD,
          sourceId: reward.id,
          rewardId: reward.id,
          dedupeKey: `redeem:${reward.id}:${user.id}`,
          note: `Resgate: ${reward.name}`,
        },
      });
      await recordLoyaltyLedgerOutbox(entry, tx);

      return { balanceAfter };
    });

    return jsonWrap({
      ok: true,
      reward: {
        id: reward.id,
        name: reward.name,
        pointsCost: reward.pointsCost,
      },
      organization: reward.program.organization,
      balanceAfter: result.balanceAfter,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "OUT_OF_STOCK") {
        return jsonWrap({ ok: false, error: "Sem stock." }, { status: 409 });
      }
      if (err.message === "INSUFFICIENT_POINTS") {
        return jsonWrap({ ok: false, error: "Pontos insuficientes." }, { status: 400 });
      }
    }
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/me/loyalty/recompensas/[rewardId]/resgatar error:", err);
    return jsonWrap({ ok: false, error: "Erro ao resgatar recompensa." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
