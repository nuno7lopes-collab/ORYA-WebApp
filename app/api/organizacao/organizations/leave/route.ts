import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 403 });
    }

    if (membership.role === "OWNER") {
      const otherOwners = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "OWNER",
          userId: { not: user.id },
        },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "És o último Owner desta organização. Transfere a propriedade antes de sair.",
          },
          { status: 400 },
        );
      }
    }

    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/organizations/leave]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
