import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.hoisted(() => vi.fn());
const resolveUsernameOwner = vi.hoisted(() => vi.fn());
const getUserFollowCounts = vi.hoisted(() => vi.fn());
const getUserFollowStatus = vi.hoisted(() => vi.fn());
const isOrganizationFollowed = vi.hoisted(() => vi.fn());

const profileFindUnique = vi.hoisted(() => vi.fn());
const profileFindFirst = vi.hoisted(() => vi.fn());
const eventCount = vi.hoisted(() => vi.fn());
const organizationFindUnique = vi.hoisted(() => vi.fn());
const organizationFollowsCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));

vi.mock("@/lib/username/resolveUsernameOwner", () => ({
  resolveUsernameOwner,
}));

vi.mock("@/domain/social/follows", () => ({
  getUserFollowCounts,
  getUserFollowStatus,
  isOrganizationFollowed,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: profileFindUnique,
      findFirst: profileFindFirst,
    },
    event: {
      count: eventCount,
    },
    organization: {
      findUnique: organizationFindUnique,
    },
    organization_follows: {
      count: organizationFollowsCount,
    },
  },
}));

let GET: typeof import("@/app/api/public/profile/route").GET;

beforeEach(async () => {
  vi.resetModules();

  getUser.mockReset();
  resolveUsernameOwner.mockReset();
  getUserFollowCounts.mockReset();
  getUserFollowStatus.mockReset();
  isOrganizationFollowed.mockReset();
  profileFindUnique.mockReset();
  profileFindFirst.mockReset();
  eventCount.mockReset();
  organizationFindUnique.mockReset();
  organizationFollowsCount.mockReset();

  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  resolveUsernameOwner.mockResolvedValue(null);
  profileFindFirst.mockResolvedValue(null);
  profileFindUnique.mockResolvedValue({
    id: "user-1",
    username: "migueloryatest",
    fullName: "Miguel Orya Test",
    avatarUrl: null,
    coverUrl: null,
    bio: null,
    visibility: "PUBLIC",
    padelLevel: "6",
    padelPreferredSide: "DIREITA",
    gender: "MALE",
    favouriteCategories: [],
    isDeleted: false,
  });
  getUserFollowCounts.mockResolvedValue({ followersCount: 101, followingTotal: 109 });
  getUserFollowStatus.mockResolvedValue({ isFollowing: false, requestPending: false, isMutual: false });
  eventCount.mockResolvedValue(22);
  isOrganizationFollowed.mockResolvedValue(false);
  organizationFindUnique.mockResolvedValue(null);
  organizationFollowsCount.mockResolvedValue(0);

  GET = (await import("@/app/api/public/profile/route")).GET;
});

describe("GET /api/public/profile fallback self-profile", () => {
  it("usa perfil Prisma do próprio utilizador para incluir dados de padel sem fallback Supabase", async () => {
    const req = new NextRequest("http://localhost/api/public/profile?username=migueloryatest");

    const res = await GET(req);
    const body = await res.json();

    const payloadProfile = body.profile ?? body.data?.profile ?? body.result?.profile;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(payloadProfile).toBeTruthy();
    expect(payloadProfile.padelLevel).toBe("6");
    expect(payloadProfile.padelPreferredSide).toBe("DIREITA");
    expect(payloadProfile.padelGender).toBe("MALE");

    expect(profileFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });
});
