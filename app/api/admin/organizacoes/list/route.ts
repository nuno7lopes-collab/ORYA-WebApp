import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";

const MAX_LIMIT = 200;

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT) : 100;

    const organizations = await prisma.organization.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicName: true,
        status: true,
        createdAt: true,
        orgType: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        members: {
          where: { role: "OWNER" },
          take: 1,
          select: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                users: { select: { email: true } },
              },
            },
          },
        },
      },
    });

    const normalized = organizations.map((org) => {
      const ownerUser = org.members[0]?.user ?? null;
      return {
        id: org.id,
        publicName: org.publicName,
        status: org.status,
        createdAt: org.createdAt.toISOString(),
        orgType: org.orgType,
        stripeAccountId: org.stripeAccountId,
        stripeChargesEnabled: org.stripeChargesEnabled,
        stripePayoutsEnabled: org.stripePayoutsEnabled,
        officialEmail: org.officialEmail,
        officialEmailVerifiedAt: org.officialEmailVerifiedAt?.toISOString() ?? null,
        owner: ownerUser
          ? {
              id: ownerUser.id,
              username: ownerUser.username,
              fullName: ownerUser.fullName,
              email: ownerUser.users?.email ?? null,
            }
          : null,
        eventsCount: null,
        totalTickets: null,
        totalRevenueCents: null,
      };
    });

    return jsonWrap({ ok: true, organizations: normalized });
  } catch (err) {
    console.error("[admin][organizacoes][list] error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
