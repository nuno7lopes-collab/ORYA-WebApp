import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const serviceId = Number(params.id);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
          organizationCategory: "RESERVAS",
        },
      },
      select: {
        id: true,
        policyId: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        currency: true,
        policy: {
          select: {
            id: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
          },
        },
        organization: {
          select: {
            id: true,
            publicName: true,
            businessName: true,
            city: true,
            username: true,
            brandingAvatarUrl: true,
            publicDescription: true,
            publicWebsite: true,
            publicInstagram: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const policy =
      service.policy ??
      (await prisma.organizationPolicy.findFirst({
        where: { organizationId: service.organization.id, policyType: "MODERATE" },
        select: { id: true, name: true, policyType: true, cancellationWindowMinutes: true },
      })) ??
      (await prisma.organizationPolicy.findFirst({
        where: { organizationId: service.organization.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, policyType: true, cancellationWindowMinutes: true },
      }));

    return NextResponse.json({
      ok: true,
      service: {
        ...service,
        policy: policy
          ? {
              id: policy.id,
              name: policy.name,
              policyType: policy.policyType,
              cancellationWindowMinutes: policy.cancellationWindowMinutes,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("GET /api/servicos/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar serviço." }, { status: 500 });
  }
}
