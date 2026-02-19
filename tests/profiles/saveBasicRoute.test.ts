import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.hoisted(() => vi.fn());
const setUsernameForOwner = vi.hoisted(() => vi.fn());
const normalizeAndValidateUsername = vi.hoisted(() => vi.fn());
const getNotificationPrefs = vi.hoisted(() => vi.fn());
const normalizeProfileAvatarUrl = vi.hoisted(() => vi.fn((value) => value));
const normalizeProfileCoverUrl = vi.hoisted(() => vi.fn((value) => value));
const normalizeInterestSelection = vi.hoisted(() => vi.fn((items) => items));
const findExistingProfile = vi.hoisted(() => vi.fn());
const upsertProfile = vi.hoisted(() => vi.fn());
const upsertNotificationPreference = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock("@/lib/globalUsernames", () => ({
  setUsernameForOwner,
  normalizeAndValidateUsername,
  UsernameTakenError: class UsernameTakenError extends Error {
    code = "USERNAME_TAKEN";
  },
}));

vi.mock("@/lib/notifications", () => ({ getNotificationPrefs }));
vi.mock("@/lib/profileMedia", () => ({ normalizeProfileAvatarUrl, normalizeProfileCoverUrl }));
vi.mock("@/lib/interests", () => ({
  INTEREST_MAX_SELECTION: 6,
  normalizeInterestSelection,
}));
vi.mock("@/lib/phone", () => ({
  isValidPhone: vi.fn(() => true),
  normalizePhone: vi.fn((value: string) => value),
  resolvePhoneNormalizationOptions: vi.fn(() => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) =>
      cb({
        profile: {
          findUnique: findExistingProfile,
          upsert: upsertProfile,
        },
        notificationPreference: {
          upsert: upsertNotificationPreference,
        },
      }),
    ),
  },
}));

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

let POST: typeof import("@/app/api/profiles/save-basic/route").POST;

beforeEach(async () => {
  vi.resetModules();

  getUser.mockReset();
  setUsernameForOwner.mockReset();
  normalizeAndValidateUsername.mockReset();
  getNotificationPrefs.mockReset();
  normalizeProfileAvatarUrl.mockReset();
  normalizeProfileCoverUrl.mockReset();
  normalizeInterestSelection.mockReset();
  findExistingProfile.mockReset();
  upsertProfile.mockReset();
  upsertNotificationPreference.mockReset();

  getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "joao@example.com" } }, error: null });
  normalizeAndValidateUsername.mockReturnValue({ ok: true, username: "joao" });
  getNotificationPrefs.mockResolvedValue({
    allowEmailNotifications: true,
    allowEventReminders: true,
    allowFollowRequests: true,
  });
  normalizeProfileAvatarUrl.mockImplementation((value: string | null) => value);
  normalizeProfileCoverUrl.mockImplementation((value: string | null) => value);
  normalizeInterestSelection.mockImplementation((items: string[]) => items);
  findExistingProfile.mockResolvedValue({ onboardingDone: false });
  upsertProfile.mockResolvedValue({
    id: "user-1",
    username: "joao",
    fullName: "João Silva",
    avatarUrl: null,
    coverUrl: null,
    updatedAt: new Date(),
    bio: null,
    padelLevel: null,
    favouriteCategories: ["padel"],
    onboardingDone: false,
    roles: ["user"],
    visibility: "PUBLIC",
  });

  POST = (await import("@/app/api/profiles/save-basic/route")).POST;
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/profiles/save-basic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/profiles/save-basic onboardingDone behavior", () => {
  it("mantém comportamento default e força onboardingDone=true sem flag", async () => {
    await POST(makeRequest({ fullName: "João Silva", username: "joao" }));

    const update = upsertProfile.mock.calls[0][0].update;
    expect(update.onboardingDone).toBe(true);
  });

  it("aceita onboardingDone=false para manter perfil incompleto quando ainda não estava concluído", async () => {
    findExistingProfile.mockResolvedValueOnce({ onboardingDone: false });

    await POST(
      makeRequest({ fullName: "João Silva", username: "joao", onboardingDone: false }),
    );

    const update = upsertProfile.mock.calls[0][0].update;
    expect(update.onboardingDone).toBe(false);
  });

  it("não faz downgrade quando onboardingDone já estava true", async () => {
    findExistingProfile.mockResolvedValueOnce({ onboardingDone: true });

    await POST(
      makeRequest({ fullName: "João Silva", username: "joao", onboardingDone: false }),
    );

    const update = upsertProfile.mock.calls[0][0].update;
    expect(Object.prototype.hasOwnProperty.call(update, "onboardingDone")).toBe(false);
  });
});
