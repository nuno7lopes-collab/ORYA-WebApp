import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureAuthenticated = vi.hoisted(() => vi.fn());

const userConsentFindFirst = vi.hoisted(() => vi.fn());
const userConsentUpsert = vi.hoisted(() => vi.fn());
const crmContactFindFirst = vi.hoisted(() => vi.fn());
const crmContactCreate = vi.hoisted(() => vi.fn());
const crmContactUpdate = vi.hoisted(() => vi.fn());
const crmContactConsentUpsert = vi.hoisted(() => vi.fn());
const organizationFollowsFindFirst = vi.hoisted(() => vi.fn());
const profileFindUnique = vi.hoisted(() => vi.fn());
const usersFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: {} })),
}));

vi.mock("@/lib/security", () => ({
  ensureAuthenticated,
  isUnauthenticatedError: vi.fn(() => false),
}));

vi.mock("@/lib/ownership/identity", () => ({
  resolveIdentityForUser: vi.fn(async () => ({ id: null })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userConsent: {
      findFirst: userConsentFindFirst,
      upsert: userConsentUpsert,
      findMany: vi.fn(),
    },
    crmContact: {
      findFirst: crmContactFindFirst,
      create: crmContactCreate,
      update: crmContactUpdate,
    },
    crmContactConsent: {
      upsert: crmContactConsentUpsert,
    },
    organization_follows: {
      findFirst: organizationFollowsFindFirst,
      findMany: vi.fn(),
    },
    profile: {
      findUnique: profileFindUnique,
    },
    users: {
      findUnique: usersFindUnique,
    },
    organization: {
      findMany: vi.fn(),
    },
  },
}));

let PUT: typeof import("@/app/api/me/consents/route").PUT;

beforeEach(async () => {
  vi.resetModules();

  ensureAuthenticated.mockReset();
  userConsentFindFirst.mockReset();
  userConsentUpsert.mockReset();
  crmContactFindFirst.mockReset();
  crmContactCreate.mockReset();
  crmContactUpdate.mockReset();
  crmContactConsentUpsert.mockReset();
  organizationFollowsFindFirst.mockReset();
  profileFindUnique.mockReset();
  usersFindUnique.mockReset();

  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  userConsentUpsert.mockResolvedValue({ organizationId: 10, type: "MARKETING", status: "GRANTED" });
  crmContactConsentUpsert.mockResolvedValue({ organizationId: 10, type: "MARKETING", status: "GRANTED" });
  crmContactCreate.mockResolvedValue({ id: 77, contactEmail: null, contactPhone: null });
  profileFindUnique.mockResolvedValue({ fullName: "Miguel Orya", username: "migueloryatest", contactPhone: "+351900000000" });
  usersFindUnique.mockResolvedValue({ email: "miguel@example.com" });

  PUT = (await import("@/app/api/me/consents/route")).PUT;
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/me/consents", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/me/consents autorização por follow", () => {
  it("bloqueia update quando utilizador não segue e não tem relação prévia", async () => {
    userConsentFindFirst.mockResolvedValueOnce(null);
    crmContactFindFirst.mockResolvedValueOnce(null);
    organizationFollowsFindFirst.mockResolvedValueOnce(null);

    const res = await PUT(
      makeRequest({ organizationId: 10, type: "MARKETING", granted: true }),
    );

    expect(res.status).toBe(403);
    expect(userConsentUpsert).not.toHaveBeenCalled();
    expect(crmContactConsentUpsert).not.toHaveBeenCalled();
  });

  it("permite update quando utilizador segue a organização", async () => {
    userConsentFindFirst.mockResolvedValueOnce(null);
    crmContactFindFirst.mockResolvedValueOnce(null);
    organizationFollowsFindFirst.mockResolvedValueOnce({ id: 444 });

    const res = await PUT(
      makeRequest({ organizationId: 10, type: "MARKETING", granted: true }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(crmContactCreate).toHaveBeenCalledTimes(1);
    expect(userConsentUpsert).toHaveBeenCalledTimes(1);
    expect(crmContactConsentUpsert).toHaveBeenCalledTimes(1);
    expect(crmContactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { marketingEmailOptIn: true, marketingPushOptIn: true } }),
    );
  });
});
