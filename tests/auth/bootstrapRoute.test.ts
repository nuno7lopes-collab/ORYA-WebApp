import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const setUsernameForOwner = vi.hoisted(() => vi.fn());
const claimIdentity = vi.hoisted(() => vi.fn());
const linkPendingWorkforceInvitesToUser = vi.hoisted(() => vi.fn());

const profileFindUnique = vi.hoisted(() => vi.fn());
const profileCreate = vi.hoisted(() => vi.fn());
const profileUpdate = vi.hoisted(() => vi.fn());
const prismaTransaction = vi.hoisted(() => vi.fn());

class UsernameTakenError extends Error {}

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/globalUsernames", () => ({ setUsernameForOwner, UsernameTakenError }));
vi.mock("@/lib/ownership/claimIdentity", () => ({ claimIdentity }));
vi.mock("@/lib/workforceInvites", () => ({ linkPendingWorkforceInvitesToUser }));
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: profileFindUnique,
      create: profileCreate,
      update: profileUpdate,
    },
    $transaction: prismaTransaction,
  },
}));

let POST: typeof import("@/app/api/auth/bootstrap/route").POST;

function makeRequest() {
  return new NextRequest("http://localhost/api/auth/bootstrap", {
    method: "POST",
  });
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({ data: { user: null }, error: null });
  setUsernameForOwner.mockResolvedValue(undefined);
  claimIdentity.mockResolvedValue(undefined);
  linkPendingWorkforceInvitesToUser.mockResolvedValue(undefined);

  profileFindUnique.mockResolvedValue(null);
  profileCreate.mockResolvedValue(null);
  profileUpdate.mockResolvedValue(null);
  prismaTransaction.mockImplementation(async (callback: (tx: { profile: { update: typeof profileUpdate } }) => Promise<unknown>) => {
    const tx = { profile: { update: vi.fn().mockResolvedValue(null) } };
    return callback(tx);
  });

  POST = (await import("@/app/api/auth/bootstrap/route")).POST;
});

describe("POST /api/auth/bootstrap", () => {
  it("devolve 401 quando nao existe utilizador autenticado", async () => {
    getUserWithPolicy.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("UNAUTHENTICATED");
  });

  it("inicializa perfil, aplica pending_username e marca onboarding para utilizador verificado", async () => {
    const user = {
      id: "user-1",
      email: "novo@example.com",
      email_confirmed_at: "2026-02-24T00:00:00.000Z",
      user_metadata: {
        full_name: "Novo Utilizador",
        avatar_url: "https://cdn.example.com/avatar.jpg",
        pending_username: "novo-utilizador",
      },
    };

    const createdProfile = {
      id: "user-1",
      username: null,
      fullName: "Novo Utilizador",
      onboardingDone: false,
      favouriteCategories: [],
      gender: null,
      padelPreferredSide: null,
    };

    const refreshedProfile = {
      ...createdProfile,
      username: "novo-utilizador",
    };

    const updatedProfile = {
      ...refreshedProfile,
      onboardingDone: true,
    };

    const txProfileUpdate = vi.fn().mockResolvedValue(undefined);

    getUserWithPolicy.mockResolvedValueOnce({
      data: { user },
      error: null,
    });
    profileFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(refreshedProfile);
    profileCreate.mockResolvedValueOnce(createdProfile);
    prismaTransaction.mockImplementationOnce(async (callback: (tx: { profile: { update: typeof txProfileUpdate } }) => Promise<unknown>) => {
      const tx = { profile: { update: txProfileUpdate } };
      return callback(tx);
    });
    profileUpdate.mockResolvedValueOnce(updatedProfile);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.user?.id).toBe("user-1");
    expect(body.user?.emailConfirmed).toBe(true);
    expect(body.profile?.username).toBe("novo-utilizador");
    expect(body.profile?.onboardingDone).toBe(true);
    expect(body.needsEmailConfirmation).toBe(false);

    expect(setUsernameForOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "novo-utilizador",
        ownerType: "user",
        ownerId: "user-1",
        allowReservedForEmail: "novo@example.com",
      }),
    );
    expect(txProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { username: "novo-utilizador" },
      }),
    );
    expect(claimIdentity).toHaveBeenCalledWith(
      "novo@example.com",
      "user-1",
      expect.objectContaining({ requireVerified: true, mergedBy: "user-1" }),
    );
    expect(linkPendingWorkforceInvitesToUser).toHaveBeenCalledWith({
      userId: "user-1",
      email: "novo@example.com",
    });
  });
});
