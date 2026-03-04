import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";

export async function handleAcademyStudentsGet(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 20);

  if (query.length < 2) {
    return respondOk(access.ctx, { items: [] });
  }

  const items = await prisma.profile.findMany({
    where: {
      isDeleted: false,
      AND: [
        {
          OR: [
            { bookings: { some: { organizationId: access.organization.id } } },
            { bookingParticipants: { some: { booking: { organizationId: access.organization.id } } } },
          ],
        },
        {
          OR: [
            { username: { contains: query, mode: "insensitive" } },
            { fullName: { contains: query, mode: "insensitive" } },
            { contactPhone: { contains: query, mode: "insensitive" } },
            { users: { email: { contains: query, mode: "insensitive" } } },
          ],
        },
      ],
    },
    take: limit,
    select: {
      id: true,
      fullName: true,
      username: true,
      contactPhone: true,
      users: { select: { email: true } },
    },
  });

  return respondOk(access.ctx, {
    items: items.map((item) => ({
      id: item.id,
      fullName: item.fullName,
      username: item.username,
      contactPhone: item.contactPhone,
      email: item.users?.email ?? null,
    })),
  });
}
