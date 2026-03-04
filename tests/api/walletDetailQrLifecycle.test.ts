import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const resolveActions = vi.hoisted(() => vi.fn());
const getUserIdentityIds = vi.hoisted(() => vi.fn());
const isWalletPassEnabled = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  entitlement: { findUnique: vi.fn() },
  entitlementCheckin: { findMany: vi.fn() },
  profile: { findUnique: vi.fn() },
  event: { findUnique: vi.fn() },
  entitlementQrToken: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  saleLine: { findUnique: vi.fn() },
  padelPairingSlot: { findUnique: vi.fn() },
  padelPairing: { findUnique: vi.fn() },
  saleSummary: { findFirst: vi.fn() },
  refund: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/entitlements/accessResolver", () => ({ resolveActions }));
vi.mock("@/lib/ownership/identity", () => ({ getUserIdentityIds }));
vi.mock("@/lib/wallet/pass", () => ({ isWalletPassEnabled }));
vi.mock("@/lib/env", () => ({
  env: {
    qrSecretKey: "test_qr_secret",
  },
}));

const buildDeterministicToken = (entitlementId: string, expiresAt: Date) => {
  const expirySec = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${entitlementId}:${expirySec}`;
  const signature = crypto
    .createHmac("sha256", "test_qr_secret")
    .update(payload)
    .digest("hex");
  return `orya_qr_v2:${payload}:${signature}`;
};

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildEntitlement = (snapshotStartAt: Date) => ({
  id: "ent_1",
  type: "EVENT_TICKET",
  status: "ACTIVE",
  eventId: 77,
  tournamentId: null,
  seasonId: null,
  ownerIdentityId: "identity-1",
  purchaseId: null,
  saleLineId: null,
  snapshotTitle: "Torneio Primavera",
  snapshotCoverUrl: null,
  snapshotVenueName: "Clube X",
  snapshotStartAt,
  snapshotTimezone: "Europe/Lisbon",
  updatedAt: new Date("2030-01-01T12:00:00.000Z"),
  createdAt: new Date("2030-01-01T10:00:00.000Z"),
});

describe("GET /api/me/wallet/[entitlementId] QR lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createSupabaseServer.mockResolvedValue({});
    getUserWithPolicy.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          email_confirmed_at: "2030-01-01T00:00:00.000Z",
        },
      },
    });
    resolveActions.mockReturnValue({ canShowQr: true });
    getUserIdentityIds.mockResolvedValue(["identity-1"]);
    isWalletPassEnabled.mockReturnValue(false);
    prisma.entitlementCheckin.findMany.mockResolvedValue([]);
    prisma.profile.findUnique.mockResolvedValue({
      roles: [],
      username: "user1",
    });
    prisma.saleLine.findUnique.mockResolvedValue(null);
    prisma.padelPairingSlot.findUnique.mockResolvedValue(null);
    prisma.padelPairing.findUnique.mockResolvedValue(null);
    prisma.saleSummary.findFirst.mockResolvedValue(null);
    prisma.refund.findFirst.mockResolvedValue(null);
    prisma.entitlementQrToken.deleteMany.mockResolvedValue({ count: 0 });
    prisma.entitlementQrToken.create.mockResolvedValue({});
  });

  it("reutiliza token ativo sem rotação e devolve qrExpiresAt", async () => {
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const ent = buildEntitlement(startsAt);
    const activeExpiresAt = new Date(Date.now() + 35 * 60 * 1000);
    const reusableToken = buildDeterministicToken(ent.id, activeExpiresAt);

    prisma.entitlement.findUnique.mockResolvedValue(ent);
    prisma.event.findUnique.mockResolvedValue({
      id: 77,
      slug: "evento-77",
      startsAt,
      endsAt,
      organization: { username: "clubex", publicName: "Clube X", businessName: null },
    });
    prisma.entitlementQrToken.findFirst.mockResolvedValue({
      tokenHash: hashToken(reusableToken),
      expiresAt: activeExpiresAt,
    });

    const { GET } = await import("@/app/api/me/wallet/[entitlementId]/route");
    const req = new NextRequest("http://localhost/api/me/wallet/ent_1");
    const res = await GET(req, { params: Promise.resolve({ entitlementId: "ent_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.qrToken).toBe(reusableToken);
    expect(body.qrExpiresAt).toBe(activeExpiresAt.toISOString());
    expect(prisma.entitlementQrToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.entitlementQrToken.create).not.toHaveBeenCalled();
  });

  it("forceRefreshQr=1 roda token mesmo com token ativo", async () => {
    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const ent = buildEntitlement(startsAt);
    const oldExpiresAt = new Date(Date.now() + 20 * 60 * 1000);
    const oldToken = buildDeterministicToken(ent.id, oldExpiresAt);

    prisma.entitlement.findUnique.mockResolvedValue(ent);
    prisma.event.findUnique.mockResolvedValue({
      id: 77,
      slug: "evento-77",
      startsAt,
      endsAt,
      organization: { username: "clubex", publicName: "Clube X", businessName: null },
    });
    prisma.entitlementQrToken.findFirst.mockResolvedValue({
      tokenHash: hashToken(oldToken),
      expiresAt: oldExpiresAt,
    });

    const { GET } = await import("@/app/api/me/wallet/[entitlementId]/route");
    const req = new NextRequest("http://localhost/api/me/wallet/ent_1?forceRefreshQr=1");
    const res = await GET(req, { params: Promise.resolve({ entitlementId: "ent_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.qrToken).toBeTruthy();
    expect(body.qrToken).not.toBe(oldToken);
    expect(typeof body.qrExpiresAt).toBe("string");
    expect(prisma.entitlementQrToken.findFirst).not.toHaveBeenCalled();
    expect(prisma.entitlementQrToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.entitlementQrToken.create).toHaveBeenCalledTimes(1);
  });

  it("gera novo token com validade máxima de 1 hora quando não existe token ativo", async () => {
    const startsAt = new Date(Date.now() + 30 * 60 * 1000);
    const endsAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const ent = buildEntitlement(startsAt);
    const before = Date.now();

    prisma.entitlement.findUnique.mockResolvedValue(ent);
    prisma.event.findUnique.mockResolvedValue({
      id: 77,
      slug: "evento-77",
      startsAt,
      endsAt,
      organization: { username: "clubex", publicName: "Clube X", businessName: null },
    });
    prisma.entitlementQrToken.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/me/wallet/[entitlementId]/route");
    const req = new NextRequest("http://localhost/api/me/wallet/ent_1");
    const res = await GET(req, { params: Promise.resolve({ entitlementId: "ent_1" }) });
    const body = await res.json();
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.qrExpiresAt).toBe("string");
    const expiresMs = new Date(body.qrExpiresAt).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 61 * 60 * 1000);
    expect(prisma.entitlementQrToken.create).toHaveBeenCalledTimes(1);
  });

  it("limita validade ao fim da janela de check-in quando a janela é mais curta que 1 hora", async () => {
    const startsAt = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const endsAt = new Date(Date.now() - (5 * 60 + 50) * 60 * 1000);
    const expectedCheckinWindowEnd = new Date(endsAt.getTime() + 6 * 60 * 60 * 1000);
    const ent = buildEntitlement(startsAt);

    prisma.entitlement.findUnique.mockResolvedValue(ent);
    prisma.event.findUnique.mockResolvedValue({
      id: 77,
      slug: "evento-77",
      startsAt,
      endsAt,
      organization: { username: "clubex", publicName: "Clube X", businessName: null },
    });
    prisma.entitlementQrToken.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/me/wallet/[entitlementId]/route");
    const req = new NextRequest("http://localhost/api/me/wallet/ent_1");
    const res = await GET(req, { params: Promise.resolve({ entitlementId: "ent_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.qrExpiresAt).toBe("string");
    const expiresMs = new Date(body.qrExpiresAt).getTime();
    expect(Math.abs(expiresMs - expectedCheckinWindowEnd.getTime())).toBeLessThanOrEqual(1500);
  });
});
