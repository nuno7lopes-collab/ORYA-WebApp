import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { getPaidSalesGate } from "@/lib/organizationPayments";
import { resolveServicePartySizeRules } from "@/lib/reservas/servicePartySize";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return jsonWrap({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        policyId: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
        instructorId: true,
        title: true,
        description: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        categoryTag: true,
        locationMode: true,
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true } },
        professionalLinks: { select: { professionalId: true } },
        resourceLinks: { select: { resourceId: true } },
        policy: {
          select: {
            id: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
            guestBookingAllowed: true,
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
            username: true,
            brandingAvatarUrl: true,
            publicDescription: true,
            publicWebsite: true,
            publicInstagram: true,
            timezone: true,
            reservationAssignmentMode: true,
            addressId: true,
            addressRef: { select: { formattedAddress: true, canonical: true } },
            orgType: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            officialEmail: true,
            officialEmailVerifiedAt: true,
          },
        },
        addons: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            label: true,
            description: true,
            deltaMinutes: true,
            deltaPriceCents: true,
            maxQty: true,
            category: true,
            sortOrder: true,
          },
        },
        packages: {
          where: { isActive: true },
          orderBy: [{ recommended: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            label: true,
            description: true,
            durationMinutes: true,
            priceCents: true,
            recommended: true,
            sortOrder: true,
          },
        },
        durationPrices: {
          where: { isActive: true },
          orderBy: [{ durationMinutes: "asc" }],
          select: {
            durationMinutes: true,
            priceCents: true,
            isActive: true,
          },
        },
      },
    });

    if (!service) {
      return jsonWrap({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
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
        return jsonWrap({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
      }
    }

    const policy =
      service.policy ??
      (await prisma.organizationPolicy.findFirst({
        where: { organizationId: service.organization.id, policyType: "MODERATE" },
        select: { id: true, name: true, policyType: true, cancellationWindowMinutes: true, guestBookingAllowed: true },
      })) ??
      (await prisma.organizationPolicy.findFirst({
        where: { organizationId: service.organization.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, policyType: true, cancellationWindowMinutes: true, guestBookingAllowed: true },
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

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceMode: service.assignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });

    const [professionals, resources] = await Promise.all([
      prisma.reservationProfessional.findMany({
        where: { organizationId: service.organization.id, isActive: true },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          roleTitle: true,
          user: {
            select: { avatarUrl: true, username: true, fullName: true },
          },
        },
      }),
      prisma.reservationResource.findMany({
        where: {
          organizationId: service.organization.id,
          isActive: true,
          ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
        },
        orderBy: [{ priority: "asc" }, { id: "asc" }],
        select: {
          id: true,
          label: true,
          capacity: true,
          priority: true,
          courtId: true,
        },
      }),
    ]);

    const selectionRules = resolveServicePartySizeRules({
      assignmentMode: assignmentConfig.assignmentMode,
      serviceKind: service.kind ?? null,
      partySizeRequired: service.partySizeRequired,
      partySizeMin: service.partySizeMin,
      partySizeMax: service.partySizeMax,
      partySizeStep: service.partySizeStep,
    });

    return jsonWrap({
      ok: true,
      service: {
        ...service,
        organization: publicOrganization,
        professionals: professionals.map((professional) => ({
          id: professional.id,
          name: professional.name,
          roleTitle: professional.roleTitle,
          avatarUrl: professional.user?.avatarUrl ?? null,
          username: professional.user?.username ?? null,
          fullName: professional.user?.fullName ?? null,
        })),
        resources: resources.map((resource) => ({
          id: resource.id,
          label: resource.label,
          capacity: resource.capacity,
          priority: resource.priority,
          courtId: resource.courtId ?? null,
        })),
        assignment: {
          assignmentMode: assignmentConfig.assignmentMode,
          availabilityMode: assignmentConfig.availabilityMode,
          requiresProfessional: assignmentConfig.requiresProfessional,
          requiresResource: assignmentConfig.requiresResource,
          isHybrid: assignmentConfig.isHybrid,
          isCourtService: assignmentConfig.isCourtService,
        },
        selectionRules: {
          ...selectionRules,
          partySizeRange: {
            min: selectionRules.partySizeMin,
            max: selectionRules.partySizeMax,
            step: selectionRules.partySizeStep,
          },
          requiresProfessional: assignmentConfig.requiresProfessional,
          requiresResource: assignmentConfig.requiresResource,
        },
        packs: [],
        packages: service.kind === "COURT" ? [] : service.packages,
        policy: policy
          ? {
              id: policy.id,
              name: policy.name,
              policyType: policy.policyType,
              cancellationWindowMinutes: policy.cancellationWindowMinutes,
              guestBookingAllowed: policy.guestBookingAllowed ?? false,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("GET /api/servicos/[id] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar serviço." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
