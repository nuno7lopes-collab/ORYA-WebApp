import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const { organizer } = await getActiveOrganizerForUser(user.id);
    if (!organizer) {
      return NextResponse.json({ ok: false, error: "Organizador não encontrado." }, { status: 403 });
    }

    const categories = await prisma.padelCategory.findMany({
      where: { organizerId: organizer.id, isActive: true },
      orderBy: [{ season: "desc" }, { year: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, level: true },
    });

    return NextResponse.json({ ok: true, items: categories });
  } catch (err) {
    console.error("[padel/categories/my] error", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar categorias." }, { status: 500 });
  }
}
