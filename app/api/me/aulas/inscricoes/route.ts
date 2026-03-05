import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveEffectiveBookingStatus, resolvePendingBookingState } from "@/lib/reservas/pendingBookingState";

type EnrollmentListItem = {
  id: number;
  status: string;
  classSessionId: number;
  bookingId: number | null;
  createdAt: Date;
  updatedAt: Date;
  classSession: {
    id: number;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    status: string;
    service: {
      id: number;
      title: string;
      coverImageUrl: string | null;
      organization: {
        id: number;
        username: string | null;
        publicName: string | null;
        businessName: string | null;
      };
    };
    professional: {
      id: number;
      name: string;
      user: {
        avatarUrl: string | null;
        username: string | null;
        fullName: string | null;
      } | null;
    } | null;
    court: {
      id: number;
      name: string;
      isActive: boolean;
    } | null;
  } | null;
  booking: {
    id: number;
    status: string;
    startsAt: Date;
    durationMinutes: number;
    pendingExpiresAt: Date | null;
    createdAt: Date;
  } | null;
};

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const now = new Date();

    const enrollments = (await prisma.academyEnrollment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        classSessionId: true,
        bookingId: true,
        createdAt: true,
        updatedAt: true,
        classSession: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            status: true,
            service: {
              select: {
                id: true,
                title: true,
                coverImageUrl: true,
                organization: {
                  select: {
                    id: true,
                    username: true,
                    publicName: true,
                    businessName: true,
                  },
                },
              },
            },
            professional: {
              select: {
                id: true,
                name: true,
                user: { select: { avatarUrl: true, username: true, fullName: true } },
              },
            },
            court: { select: { id: true, name: true, isActive: true } },
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            startsAt: true,
            durationMinutes: true,
            pendingExpiresAt: true,
            createdAt: true,
          },
        },
      },
    })) as EnrollmentListItem[];

    const sessionIds = Array.from(
      new Set(
        enrollments
          .map((enrollment) => enrollment.classSessionId)
          .filter((sessionId): sessionId is number => typeof sessionId === "number" && sessionId > 0),
      ),
    );

    const enrollmentCounts = sessionIds.length
      ? await prisma.academyEnrollment.groupBy({
          by: ["classSessionId"],
          where: {
            classSessionId: { in: sessionIds },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          _count: { _all: true },
        })
      : [];

    const enrolledCountBySession = new Map<number, number>();
    enrollmentCounts.forEach((row) => {
      enrolledCountBySession.set(row.classSessionId, row._count._all);
    });

    const items = enrollments
      .filter((enrollment) => Boolean(enrollment.classSession))
      .map((enrollment) => {
        const session = enrollment.classSession!;
        const booking = enrollment.booking;
        const pendingState = booking
          ? resolvePendingBookingState({
              status: booking.status,
              startsAt: booking.startsAt,
              pendingExpiresAt: booking.pendingExpiresAt,
              createdAt: booking.createdAt,
              now,
            })
          : "NONE";
        const effectiveBookingStatus = booking
          ? resolveEffectiveBookingStatus(booking.status, pendingState)
          : null;
        const enrolledCount = enrolledCountBySession.get(session.id) ?? 0;
        const isFull = session.status !== "SCHEDULED" || enrolledCount >= session.capacity;
        const canCancel =
          Boolean(booking) &&
          ["CONFIRMED", "PENDING", "PENDING_CONFIRMATION"].includes(String(effectiveBookingStatus ?? "")) &&
          session.startsAt.getTime() > now.getTime() &&
          session.status === "SCHEDULED";

        return {
          id: enrollment.id,
          status: enrollment.status,
          createdAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
          classSessionId: session.id,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          capacity: session.capacity,
          enrolledCount,
          isFull,
          sessionStatus: session.status,
          class: {
            id: session.service.id,
            title: session.service.title,
            coverImageUrl: session.service.coverImageUrl ?? null,
          },
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
                name: session.court.name,
                isActive: session.court.isActive,
              }
            : null,
          organization: {
            id: session.service.organization.id,
            username: session.service.organization.username,
            publicName: session.service.organization.publicName,
            businessName: session.service.organization.businessName,
          },
          booking: booking
            ? {
                id: booking.id,
                status: booking.status,
                effectiveStatus: effectiveBookingStatus,
                pendingState,
                pendingExpiresAt: booking.pendingExpiresAt,
              }
            : null,
          cancellation: {
            allowed: canCancel,
            reason: canCancel ? null : "UNAVAILABLE",
          },
        };
      })
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return respondError(
        ctx,
        { errorCode: "UNAUTHENTICATED", message: "Não autenticado.", retryable: false },
        { status: 401 },
      );
    }

    console.error("GET /api/me/aulas/inscricoes error:", err);
    return respondError(
      ctx,
      {
        errorCode: "INTERNAL_ERROR",
        message: "Não foi possível carregar inscrições de aulas.",
        retryable: true,
      },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
