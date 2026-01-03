import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });
    if (!organization) {
      return NextResponse.json({ ok: false, error: "Organização não encontrado." }, { status: 403 });
    }

    const categories = await prisma.padelCategory.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: [{ season: "desc" }, { year: "desc" }, { createdAt: "desc" }],
      select: { id: true, label: true, minLevel: true, maxLevel: true },
    });

    return NextResponse.json({ ok: true, items: categories });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[padel/categories/my] error", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar categorias." }, { status: 500 });
  }
}
