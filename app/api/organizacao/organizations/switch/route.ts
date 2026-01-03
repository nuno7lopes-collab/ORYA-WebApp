import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";

const COOKIE_NAME = "orya_organization";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const { organizationId } = body as {
      organizationId?: number | string;
    };
    const resolvedId = parseOrganizationId(organizationId);
    if (!resolvedId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    // Validar membership
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: resolvedId, userId: user.id, organization: { status: "ACTIVE" } },
      include: { organization: true },
    });

    if (!membership || !membership.organization) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 403 });
    }

    // Guardar cookie com org atual + atualizar lastUsedAt
    try {
      await prisma.organizationMember.updateMany({
        where: { organizationId: resolvedId, userId: user.id },
        data: { lastUsedAt: new Date() },
      });
    } catch (err: unknown) {
      if (!(typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021")) {
        throw err;
      }
    }

    const res = NextResponse.json({
      ok: true,
      organizationId: resolvedId,
      role: membership.role,
    });
    res.cookies.set(COOKIE_NAME, String(resolvedId), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2021") {
      return NextResponse.json(
        { ok: false, error: "Base de dados sem tabela organization_members. Corre as migrations." },
        { status: 500 },
      );
    }
    console.error("[organização/organizations/switch][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
