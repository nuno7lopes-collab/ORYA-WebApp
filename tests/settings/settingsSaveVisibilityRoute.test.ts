import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.hoisted(() => vi.fn());
const profileFindUnique = vi.hoisted(() => vi.fn());
const profileUpdate = vi.hoisted(() => vi.fn());
const profileUpsert = vi.hoisted(() => vi.fn());
const notificationPreferenceUpsert = vi.hoisted(() => vi.fn());
const clearUsernameForOwner = vi.hoisted(() => vi.fn());
const getNotificationPrefs = vi.hoisted(() => vi.fn());
const normalizeInterestSelection = vi.hoisted(() => vi.fn((items: string[]) => items));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: profileFindUnique,
      update: profileUpdate,
      upsert: profileUpsert,
    },
    notificationPreference: {
      upsert: notificationPreferenceUpsert,
    },
  },
}));

vi.mock("@/lib/globalUsernames", () => ({
  clearUsernameForOwner,
}));

vi.mock("@/lib/notifications", () => ({
  getNotificationPrefs,
}));

vi.mock("@/lib/interests", () => ({
  INTEREST_MAX_SELECTION: 6,
  normalizeInterestSelection,
}));

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

let PATCH: typeof import("@/app/api/me/settings/save/route").PATCH;

beforeEach(async () => {
  vi.resetModules();

  getUser.mockReset();
  profileFindUnique.mockReset();
  profileUpdate.mockReset();
  profileUpsert.mockReset();
  notificationPreferenceUpsert.mockReset();
  clearUsernameForOwner.mockReset();
  getNotificationPrefs.mockReset();
  normalizeInterestSelection.mockReset();

  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  getNotificationPrefs.mockResolvedValue({
    allowEmailNotifications: true,
    allowSocialNotifications: true,
    allowEventNotifications: true,
    allowSystemNotifications: true,
    allowMarketingNotifications: true,
    allowEventReminders: true,
    allowFollowRequests: true,
    allowSalesAlerts: true,
    allowSystemAnnouncements: true,
    allowMarketingCampaigns: true,
  });
  normalizeInterestSelection.mockImplementation((items: string[]) => items);
  profileUpsert.mockResolvedValue({
    visibility: "FOLLOWERS",
    favouriteCategories: [],
  });

  PATCH = (await import("@/app/api/me/settings/save/route")).PATCH;
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/me/settings/save", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/me/settings/save visibilidade", () => {
  it("normaliza PRIVATE para FOLLOWERS no update/create", async () => {
    const res = await PATCH(makeRequest({ visibility: "PRIVATE" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    expect(profileUpsert).toHaveBeenCalledTimes(1);
    const call = profileUpsert.mock.calls[0]?.[0];
    expect(call.update.visibility).toBe("FOLLOWERS");
    expect(call.create.visibility).toBe("FOLLOWERS");
  });

  it("rejeita visibilidade inválida", async () => {
    const res = await PATCH(makeRequest({ visibility: "INVALID" }));

    expect(res.status).toBe(400);
    expect(profileUpsert).not.toHaveBeenCalled();
  });

  it("normaliza interesses com limite máximo antes de persistir", async () => {
    normalizeInterestSelection.mockReturnValueOnce(["padel", "concertos", "workshops"]);

    const res = await PATCH(
      makeRequest({
        favouriteCategories: [
          "padel",
          "concertos",
          "festas",
          "viagens",
          "bem_estar",
          "gastronomia",
          "workshops",
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(normalizeInterestSelection).toHaveBeenCalledWith(
      ["padel", "concertos", "festas", "viagens", "bem_estar", "gastronomia", "workshops"],
      6,
    );
    const call = profileUpsert.mock.calls[0]?.[0];
    expect(call.update.favouriteCategories).toEqual(["padel", "concertos", "workshops"]);
    expect(call.create.favouriteCategories).toEqual(["padel", "concertos", "workshops"]);
  });
});
