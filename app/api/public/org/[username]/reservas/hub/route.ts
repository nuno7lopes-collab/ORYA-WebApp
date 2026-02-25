export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeUsernameInput } from "@/lib/username";
import { getPaidSalesGate } from "@/lib/organizationPayments";
import { resolveBookingVerticalFromServiceKind } from "@/lib/reservas/bookingVertical";

function parsePositiveInt(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

type ServiceRow = {
  id: number;
  title: string;
  description: string | null;
  kind: "GENERAL" | "COURT" | "CLASS";
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  categoryTag: string | null;
  coverImageUrl: string | null;
  locationMode: "FIXED" | "CHOOSE_AT_BOOKING";
  addressId: string | null;
  addressRef: { formattedAddress: string | null } | null;
  assignmentMode: "PROFESSIONAL_ONLY" | "RESOURCE_ONLY" | "PROFESSIONAL_AND_RESOURCE";
  partySizeRequired: boolean;
  partySizeMin: number;
  partySizeMax: number;
  partySizeStep: number;
  category: {
    id: number;
    slug: string;
    label: string;
    domain: "COURT" | "CLASS" | "SERVICE";
  } | null;
  durationPrices: Array<{ durationMinutes: number; priceCents: number; isActive: boolean }>;
};

function toPublicService(service: ServiceRow) {
  return {
    id: service.id,
    title: service.title,
    description: service.description,
    durationMinutes: service.durationMinutes,
    unitPriceCents: service.unitPriceCents,
    currency: service.currency,
    kind: service.kind,
    bookingVertical: resolveBookingVerticalFromServiceKind(service.kind),
    assignmentMode: service.assignmentMode,
    partySizeRequired: service.partySizeRequired,
    partySizeMin: service.partySizeMin,
    partySizeMax: service.partySizeMax,
    partySizeStep: service.partySizeStep,
    category: service.category,
    categoryTag: service.category?.label ?? service.categoryTag ?? null,
    coverImageUrl: service.coverImageUrl,
    locationMode: service.locationMode,
    addressId: service.addressId,
    addressRef: service.addressRef,
    durationPrices: service.durationPrices,
  };
}

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const resolvedParams = await params;
  const username = normalizeUsernameInput(resolvedParams.username);
  if (!username) {
    return jsonWrap({ ok: false, error: "INVALID_USERNAME" }, { status: 400 });
  }

  const serviceIdParam = parsePositiveInt(req.nextUrl.searchParams.get("serviceId"));

  try {
    const organization = await prisma.organization.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: {
        id: true,
        username: true,
        publicName: true,
        businessName: true,
        timezone: true,
        reservationAssignmentMode: true,
        orgType: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        settings: {
          select: { bookingAcceptNewReservations: true },
        },
      },
    });

    if (!organization) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const paidGate = getPaidSalesGate({
      officialEmail: organization.officialEmail ?? null,
      officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
      stripeAccountId: organization.stripeAccountId ?? null,
      stripeChargesEnabled: organization.stripeChargesEnabled ?? false,
      stripePayoutsEnabled: organization.stripePayoutsEnabled ?? false,
      requireStripe: organization.orgType !== "PLATFORM",
    });
    const allowPaidServices = paidGate.ok;

    const [services, professionals, resources, courtConfigs] = await Promise.all([
      prisma.service.findMany({
        where: {
          organizationId: organization.id,
          isActive: true,
          ...(allowPaidServices ? {} : { unitPriceCents: 0 }),
          ...(serviceIdParam ? { id: serviceIdParam } : {}),
        },
        orderBy: [{ kind: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          kind: true,
          durationMinutes: true,
          unitPriceCents: true,
          currency: true,
          categoryTag: true,
          coverImageUrl: true,
          locationMode: true,
          addressId: true,
          addressRef: { select: { formattedAddress: true } },
          assignmentMode: true,
          partySizeRequired: true,
          partySizeMin: true,
          partySizeMax: true,
          partySizeStep: true,
          category: {
            select: {
              id: true,
              slug: true,
              label: true,
              domain: true,
            },
          },
          durationPrices: {
            where: { isActive: true },
            orderBy: { durationMinutes: "asc" },
            select: {
              durationMinutes: true,
              priceCents: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.reservationProfessional.findMany({
        where: { organizationId: organization.id, isActive: true },
        orderBy: [{ priority: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          roleTitle: true,
          user: { select: { avatarUrl: true, username: true } },
        },
      }),
      prisma.reservationResource.findMany({
        where: { organizationId: organization.id, isActive: true },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: {
          id: true,
          label: true,
          capacity: true,
          courtId: true,
        },
      }),
      prisma.courtBookingConfig.findMany({
        where: { organizationId: organization.id },
        orderBy: [{ isActive: "desc" }, { courtId: "asc" }],
        select: {
          id: true,
          courtId: true,
          backingServiceId: true,
          categoryId: true,
          displayName: true,
          displayDescription: true,
          coverImageUrl: true,
          isActive: true,
          category: {
            select: {
              id: true,
              slug: true,
              label: true,
              domain: true,
            },
          },
          court: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    const servicesById = new Map(services.map((service) => [service.id, service]));
    const courts = courtConfigs
      .map((config) => {
        const backingService = servicesById.get(config.backingServiceId);
        if (!backingService || backingService.kind !== "COURT") return null;
        return {
          id: config.courtId,
          configId: config.id,
          isActive: config.isActive,
          name: config.displayName,
          description: config.displayDescription,
          coverImageUrl: config.coverImageUrl || backingService.coverImageUrl,
          category: config.category ?? backingService.category ?? null,
          bookingVertical: "COURT" as const,
          serviceId: backingService.id,
          service: toPublicService(backingService),
          court: {
            id: config.court.id,
            name: config.court.name,
            isActive: config.court.isActive,
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const classes = services
      .filter((service) => service.kind === "CLASS")
      .map(toPublicService);
    const generalServices = services
      .filter((service) => service.kind === "GENERAL")
      .map(toPublicService);

    return jsonWrap({
      ok: true,
      organization: {
        id: organization.id,
        username: organization.username,
        publicName: organization.publicName,
        businessName: organization.businessName,
        timezone: organization.timezone,
        reservationAssignmentMode: organization.reservationAssignmentMode,
        acceptNewBookings: organization.settings?.bookingAcceptNewReservations ?? true,
      },
      sections: {
        courts,
        classes,
        services: generalServices,
      },
      professionals: professionals.map((professional) => ({
        id: professional.id,
        name: professional.name,
        roleTitle: professional.roleTitle,
        avatarUrl: professional.user?.avatarUrl ?? null,
        username: professional.user?.username ?? null,
      })),
      resources: resources.map((resource) => ({
        id: resource.id,
        label: resource.label,
        capacity: resource.capacity,
        courtId: resource.courtId,
      })),
      paidVisibility: {
        allowPaidServices,
      },
    });
  } catch (err) {
    console.error("GET /api/public/org/[username]/reservas/hub error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
