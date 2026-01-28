import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return jsonWrap({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organization: {
          status: "ACTIVE",
        },
      },
      select: { id: true },
    });

    if (!service) {
      return jsonWrap({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const balance = await prisma.serviceCreditBalance.findUnique({
      where: { userId_serviceId: { userId: user.id, serviceId } },
      select: { remainingUnits: true, expiresAt: true, status: true },
    });

    return jsonWrap({ ok: true, balance });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/servicos/[id]/creditos error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar créditos." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);