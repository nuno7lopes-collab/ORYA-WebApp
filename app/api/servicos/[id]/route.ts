import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaidSalesGate } from "@/lib/organizationPayments";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
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
          OR: [
            { primaryModule: "RESERVAS" },
            { organizationModules: { some: { moduleKey: "RESERVAS", enabled: true } } },
          ],
        },
      },
      select: {
        id: true,
        policyId: true,
        kind: true,
        instructorId: true,
        title: true,
        description: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        categoryTag: true,
        locationMode: true,
        defaultLocationText: true,
        policy: {
          select: {
            id: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
          },
        },
        instructor: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
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
            timezone: true,
            reservationAssignmentMode: true,
            orgType: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            officialEmail: true,
            officialEmailVerifiedAt: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    if (service.unitPriceCents > 0) {
      const isPlatformOrg = service.organization?.orgType === "PLATFORM";
      const gate = getPaidSalesGate({
        officialEmail: service.organization?.officialEmail ?? null,
        officialEmailVerifiedAt: service.organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: service.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: service.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: service.organization?.stripePayoutsEnabled ?? false,
        requireStripe: !isPlatformOrg,
      });
      if (!gate.ok) {
        return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
      }
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

    const {
      orgType: _orgType,
      stripeAccountId: _stripeAccountId,
      stripeChargesEnabled: _stripeChargesEnabled,
      stripePayoutsEnabled: _stripePayoutsEnabled,
      officialEmail: _officialEmail,
      officialEmailVerifiedAt: _officialEmailVerifiedAt,
      ...publicOrganization
    } = service.organization;

    return NextResponse.json({
      ok: true,
      service: {
        ...service,
        organization: publicOrganization,
        packs: await prisma.servicePack.findMany({
          where: { serviceId: service.id, isActive: true },
          orderBy: [{ recommended: "desc" }, { quantity: "asc" }],
          select: { id: true, quantity: true, packPriceCents: true, label: true, recommended: true },
        }),
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
