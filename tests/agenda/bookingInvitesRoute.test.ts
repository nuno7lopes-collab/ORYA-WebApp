import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureAuthenticatedMock,
  recordOrganizationAuditMock,
  queueBookingInviteEmailMock,
  bookingFindUnique,
  bookingInviteFindMany,
  bookingInviteCreateMany,
  bookingInviteFindUnique,
  bookingInviteFindFirst,
  bookingInviteUpdate,
  bookingParticipantUpsert,
  bookingParticipantDeleteMany,
  profileFindUnique,
  prismaMockShape,
} = vi.hoisted(() => {
  const ensureAuthenticatedMock = vi.fn();
  const recordOrganizationAuditMock = vi.fn();
  const queueBookingInviteEmailMock = vi.fn();
  const bookingFindUnique = vi.fn();
  const bookingInviteFindMany = vi.fn();
  const bookingInviteCreateMany = vi.fn();
  const bookingInviteFindUnique = vi.fn();
  const bookingInviteFindFirst = vi.fn();
  const bookingInviteUpdate = vi.fn();
  const bookingParticipantUpsert = vi.fn();
  const bookingParticipantDeleteMany = vi.fn();
  const profileFindUnique = vi.fn();
  const prismaMockShape = {
    booking: {
      findUnique: bookingFindUnique,
    },
    bookingInvite: {
      findMany: bookingInviteFindMany,
      createMany: bookingInviteCreateMany,
      findUnique: bookingInviteFindUnique,
      findFirst: bookingInviteFindFirst,
      update: bookingInviteUpdate,
    },
    bookingParticipant: {
      upsert: bookingParticipantUpsert,
      deleteMany: bookingParticipantDeleteMany,
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        bookingInvite: {
          update: bookingInviteUpdate,
        },
        bookingParticipant: {
          upsert: bookingParticipantUpsert,
          deleteMany: bookingParticipantDeleteMany,
        },
      }),
    ),
    profile: {
      findUnique: profileFindUnique,
    },
  };

  return {
    ensureAuthenticatedMock,
    recordOrganizationAuditMock,
    queueBookingInviteEmailMock,
    bookingFindUnique,
    bookingInviteFindMany,
    bookingInviteCreateMany,
    bookingInviteFindUnique,
    bookingInviteFindFirst,
    bookingInviteUpdate,
    bookingParticipantUpsert,
    bookingParticipantDeleteMany,
    profileFindUnique,
    prismaMockShape,
  };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({})),
}));

vi.mock("@/lib/security", () => ({
  ensureAuthenticated: (...args: any[]) => ensureAuthenticatedMock(...args),
  isUnauthenticatedError: (err: any) => err?.message === "UNAUTHENTICATED",
}));

vi.mock("@/lib/http/requestContext", () => ({
  getRequestContext: () => ({ requestId: "req_test", correlationId: "corr_test" }),
  buildResponseHeaders: (_ctx: any, existing?: HeadersInit) => {
    const headers = new Headers(existing);
    headers.set("x-request-id", "req_test");
    headers.set("x-correlation-id", "corr_test");
    return headers;
  },
}));

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAudit: (...args: any[]) => recordOrganizationAuditMock(...args),
}));

vi.mock("@/domain/notifications/email", () => ({
  queueBookingInviteEmail: (...args: any[]) => queueBookingInviteEmailMock(...args),
  queueImportantUpdateEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMockShape,
}));

vi.mock("@prisma/client", () => ({
  BookingInviteStatus: {
    PENDING: "PENDING",
    ACCEPTED: "ACCEPTED",
    DECLINED: "DECLINED",
  },
}));

import { POST as InvitesPost } from "@/app/api/me/reservas/[id]/invites/route";
import { POST as InviteResponsePost } from "@/app/api/convites/[token]/route";
import { POST as InviteResendPost } from "@/app/api/me/reservas/[id]/invites/resend/route";

describe("booking invites route", () => {
  beforeEach(() => {
    ensureAuthenticatedMock.mockReset();
    recordOrganizationAuditMock.mockReset();
    queueBookingInviteEmailMock.mockReset();
    bookingFindUnique.mockReset();
    bookingInviteFindMany.mockReset();
    bookingInviteCreateMany.mockReset();
    bookingInviteFindUnique.mockReset();
    bookingInviteFindFirst.mockReset();
    bookingInviteUpdate.mockReset();
    bookingParticipantUpsert.mockReset();
    bookingParticipantDeleteMany.mockReset();
    prismaMockShape.$transaction.mockClear();
    profileFindUnique.mockReset();
  });

  it("cria convites para reserva confirmada", async () => {
    ensureAuthenticatedMock.mockResolvedValue({ id: "user-1" });
    bookingFindUnique
      .mockResolvedValueOnce({
        id: 10,
        userId: "user-1",
        organizationId: 20,
        status: "CONFIRMED",
      })
      .mockResolvedValueOnce({
        startsAt: new Date("2026-02-04T10:00:00Z"),
        snapshotTimezone: "Europe/Lisbon",
        service: { title: "Corte" },
        organization: { publicName: "ORG" },
      });
    bookingInviteFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 1,
          token: "tok_1",
          targetName: "Ana",
          targetContact: "ana@example.com",
          message: null,
          status: "PENDING",
          respondedAt: null,
          createdAt: new Date("2026-02-04T10:00:00Z"),
        },
      ]);
    bookingInviteCreateMany.mockResolvedValue({ count: 1 });
    profileFindUnique.mockResolvedValue({ fullName: "Nuno", username: "nuno" });

    const res = await InvitesPost(
      new Request("http://localhost/api/me/reservas/10/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invites: [{ contact: "ana@example.com", name: "Ana" }] }),
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.items).toHaveLength(1);
    expect(recordOrganizationAuditMock).toHaveBeenCalled();
    expect(queueBookingInviteEmailMock).toHaveBeenCalled();
  });

  it("responde a convite público", async () => {
    bookingInviteFindUnique.mockResolvedValue({
      id: 33,
      status: "PENDING",
      bookingId: 10,
      targetName: "Ana",
      targetContact: "ana@example.com",
      booking: {
        id: 10,
        status: "CONFIRMED",
        startsAt: new Date("2026-02-04T10:00:00Z"),
        snapshotTimezone: "Europe/Lisbon",
        service: { title: "Corte" },
        organization: {
          id: 20,
          publicName: "ORG",
          businessName: null,
          officialEmail: "org@x.pt",
          officialEmailVerifiedAt: new Date("2026-02-01T10:00:00Z"),
        },
      },
    });
    bookingInviteUpdate.mockResolvedValue({
      id: 33,
      status: "ACCEPTED",
      respondedAt: new Date("2026-02-04T12:00:00Z"),
    });

    const res = await InviteResponsePost(
      new Request("http://localhost/api/convites/tok_33", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: "sim" }),
      }),
      { params: Promise.resolve({ token: "tok_33" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe("ACCEPTED");
    expect(bookingParticipantUpsert).toHaveBeenCalled();
    expect(bookingInviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 33 },
      }),
    );
  });

  it("reenviá email de convite pendente", async () => {
    ensureAuthenticatedMock.mockResolvedValue({ id: "user-1" });
    bookingFindUnique.mockResolvedValue({
      id: 10,
      userId: "user-1",
      organizationId: 20,
      status: "CONFIRMED",
      startsAt: new Date("2026-02-04T10:00:00Z"),
      snapshotTimezone: "Europe/Lisbon",
      service: { title: "Corte" },
      organization: { publicName: "ORG" },
    });
    bookingInviteFindFirst.mockResolvedValue({
      id: 91,
      token: "tok_91",
      status: "PENDING",
      targetContact: "ana@example.com",
      targetName: "Ana",
      message: null,
    });
    profileFindUnique.mockResolvedValue({ fullName: "Nuno", username: "nuno" });

    const res = await InviteResendPost(
      new Request("http://localhost/api/me/reservas/10/invites/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: 91 }),
      }),
      { params: Promise.resolve({ id: "10" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(queueBookingInviteEmailMock).toHaveBeenCalled();
  });
});
