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
        brandingAvatarUrl: true,
        brandingCoverUrl: true,
        timezone: true,
        reservationAssignmentMode: true,
        orgType: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        addressRef: {
          select: {
            formattedAddress: true,
            canonical: true,
            latitude: true,
            longitude: true,
          },
        },
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

    const classServiceIds = services.filter((service) => service.kind === "CLASS").map((service) => service.id);
    const now = new Date();
    const futureWindowEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingClassSessions = classServiceIds.length
      ? await prisma.classSession.findMany({
          where: {
            organizationId: organization.id,
            serviceId: { in: classServiceIds },
            status: "SCHEDULED",
            startsAt: { gte: now, lte: futureWindowEnd },
          },
          orderBy: [{ startsAt: "asc" }],
          select: {
            id: true,
            serviceId: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            professional: {
              select: {
                id: true,
                name: true,
                user: { select: { avatarUrl: true, username: true, fullName: true } },
              },
            },
            court: { select: { id: true, name: true, isActive: true } },
          },
        })
      : [];
    const classSessionEnrollmentRows = upcomingClassSessions.length
      ? await prisma.academyEnrollment.groupBy({
          by: ["classSessionId"],
          where: {
            organizationId: organization.id,
            classSessionId: { in: upcomingClassSessions.map((session) => session.id) },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          _count: { _all: true },
        })
      : [];
    const enrolledCountBySession = new Map<number, number>();
    classSessionEnrollmentRows.forEach((row) => {
      enrolledCountBySession.set(row.classSessionId, row._count._all);
    });
    const sessionsByService = new Map<
      number,
      Array<{
        id: number;
        startsAt: Date;
        endsAt: Date;
        capacity: number;
        enrolledCount: number;
        isFull: boolean;
        trainer: {
          id: number;
          name: string;
          avatarUrl: string | null;
          username: string | null;
          fullName: string | null;
        } | null;
        court: {
          id: number;
          name: string | null;
          isActive: boolean;
        } | null;
      }>
    >();
    for (const session of upcomingClassSessions) {
      const enrolledCount = enrolledCountBySession.get(session.id) ?? 0;
      const item = {
        id: session.id,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        capacity: session.capacity,
        enrolledCount,
        isFull: enrolledCount >= session.capacity,
        trainer: session.professional
          ? {
              id: session.professional.id,
              name: session.professional.name,
              avatarUrl: session.professional.user?.avatarUrl ?? null,
              username: session.professional.user?.username ?? null,
              fullName: session.professional.user?.fullName ?? null,
            }
          : null,
        court: session.court
          ? {
              id: session.court.id,
              name: session.court.name ?? null,
              isActive: session.court.isActive ?? true,
            }
          : null,
      };
      const bucket = sessionsByService.get(session.serviceId) ?? [];
      bucket.push(item);
      sessionsByService.set(session.serviceId, bucket);
    }

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
      .map((service) => {
        const sessions = (sessionsByService.get(service.id) ?? []).sort(
          (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
        );
        const nextSession = sessions[0] ?? null;
        const trainersMap = new Map<number, NonNullable<(typeof sessions)[number]["trainer"]>>();
        sessions.forEach((session) => {
          if (session.trainer) trainersMap.set(session.trainer.id, session.trainer);
        });
        return {
          ...toPublicService(service),
          trainerCount: trainersMap.size,
          trainers: Array.from(trainersMap.values()),
          availability: {
            totalSessions: sessions.length,
            availableSessions: sessions.filter((session) => !session.isFull).length,
          },
          nextSession: nextSession
            ? {
                sessionId: nextSession.id,
                startsAt: nextSession.startsAt,
                endsAt: nextSession.endsAt,
                capacity: nextSession.capacity,
                enrolledCount: nextSession.enrolledCount,
                isFull: nextSession.isFull,
                trainer: nextSession.trainer,
                court: nextSession.court,
              }
            : null,
        };
      });
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
        brandingAvatarUrl: organization.brandingAvatarUrl ?? null,
        brandingCoverUrl: organization.brandingCoverUrl ?? null,
        timezone: organization.timezone,
        addressRef: organization.addressRef
          ? {
              formattedAddress: organization.addressRef.formattedAddress ?? null,
              canonical: organization.addressRef.canonical ?? null,
              lat:
                typeof organization.addressRef.latitude === "number"
                  ? organization.addressRef.latitude
                  : null,
              lng:
                typeof organization.addressRef.longitude === "number"
                  ? organization.addressRef.longitude
                  : null,
            }
          : null,
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
