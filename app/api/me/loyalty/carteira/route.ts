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
    const programs = programIds.length
      ? await prisma.loyaltyProgram.findMany({
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
        })
      : [];

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

    const programMap = new Map(programs.map((program) => [program.id, program]));

    const items = balances
      .map((row) => {
        const program = programMap.get(row.program_id);
        if (!program) return null;
        if (!orgActiveMap.get(program.organization.id)) return null;
        return {
          organization: program.organization,
          program: {
            id: program.id,
            name: program.name,
            pointsName: program.pointsName,
            status: program.status,
          },
          balance: Number(row.balance ?? 0),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/me/loyalty/carteira error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar carteira." }, { status: 500 });
  }
}
