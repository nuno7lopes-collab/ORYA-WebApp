import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserWithPolicy = vi.hoisted(() => vi.fn());
const resolveUsernameOwner = vi.hoisted(() => vi.fn());
const getUserFollowCounts = vi.hoisted(() => vi.fn());
const getUserFollowStatus = vi.hoisted(() => vi.fn());
const isOrganizationFollowed = vi.hoisted(() => vi.fn());

const profileFindUnique = vi.hoisted(() => vi.fn());
const profileFindFirst = vi.hoisted(() => vi.fn());
const eventCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

vi.mock("@/lib/auth/getUserWithPolicy", () => ({
  getUserWithPolicy,
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({})),
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
  },
}));

let GET: typeof import("@/app/api/public/profile/route").GET;

beforeEach(async () => {
  vi.resetModules();
  delete process.env.FEATURE_SOCIAL_FRIENDS_ONLY;

  getUserWithPolicy.mockReset();
  resolveUsernameOwner.mockReset();
  getUserFollowCounts.mockReset();
  getUserFollowStatus.mockReset();
  isOrganizationFollowed.mockReset();
  profileFindUnique.mockReset();
  profileFindFirst.mockReset();
  eventCount.mockReset();

  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "viewer-1" } } });
  resolveUsernameOwner.mockResolvedValue({ ownerType: "user", ownerId: "target-1" });
  profileFindUnique.mockResolvedValue({
    id: "target-1",
    username: "target",
    fullName: "Target User",
    avatarUrl: null,
    coverUrl: null,
    bio: "bio privada",
    visibility: "FOLLOWERS",
    padelLevel: "4",
    padelPreferredSide: "DIREITA",
    gender: "MALE",
    favouriteCategories: ["padel"],
    isDeleted: false,
  });
  profileFindFirst.mockResolvedValue(null);
  eventCount.mockResolvedValue(4);
  getUserFollowCounts.mockResolvedValue({
    followersCount: 9,
    followingTotal: 13,
    followingOrganizationsCount: 5,
  });
  getUserFollowStatus.mockResolvedValue({
    isFollowing: true,
    isFollower: false,
    isMutual: false,
    isFriend: false,
    requestPending: false,
  });
  isOrganizationFollowed.mockResolvedValue(false);

  GET = (await import("@/app/api/public/profile/route")).GET;
});

describe("GET /api/public/profile friends-only privacy", () => {
  it("não permite ver perfil privado com follow unilateral", async () => {
    const req = new NextRequest("http://localhost/api/public/profile?username=target");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.privacy?.isPrivate).toBe(true);
    expect(body.privacy?.canView).toBe(false);
    expect(body.counts?.followers).toBe(9);
    expect(body.counts?.following).toBe(5);
    expect(body.viewer?.isFollowing).toBe(true);
    expect(body.viewer?.isFriend).toBe(false);
    expect(body.profile?.padelLevel).toBeNull();
    expect(body.profile?.padelPreferredSide).toBeNull();
    expect(body.profile?.favouriteCategories).toEqual([]);
  });
});
